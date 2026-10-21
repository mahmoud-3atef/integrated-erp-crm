using System.Globalization;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Attendance.Contracts;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

public sealed record CreateStaffRunInput(Guid LegalEntityId, string Period);

public sealed record StaffAdjustmentRequest(Guid EmployeeId, string Kind, decimal Amount, string Reason);

/// <summary>What the «new payroll run» dialog shows before creating one.</summary>
public sealed record StaffRunChecks(
    string Period,
    DateOnly? From,
    DateOnly? To,
    bool AttendanceClosed,
    int Employees,
    int NoSalary,
    int WithoutIban,
    int WithoutRegistration,
    string? ExistingRunNo,
    string? EarlierOpenRunNo);

public sealed record PaySettingsDto(decimal OvertimePremiumPercent, decimal HoursPerDay, string LateMode, decimal MonthlyCapPercent);

public sealed record GosiRateDto(Guid Id, string Category, DateOnly EffectiveFrom, decimal EmployeePercent, decimal EmployerPercent, decimal MinBase, decimal MaxBase);

public sealed record GosiRateInput(string Category, DateOnly EffectiveFrom, decimal EmployeePercent, decimal EmployerPercent, decimal MinBase, decimal MaxBase);

/// <summary>
/// The staff payroll runs (docs/03-migration-plan/11): one per commercial registration and closed attendance month, in
/// order; calculated from the staff's salaries, the closed attendance, the due advances, penalties and deductions, and
/// GOSI; recalculated while open; adjusted with a reason; and sent through approval (HR, finance, then management).
/// </summary>
internal sealed class StaffPayrollService(
    PayrollDbContext db,
    IStaffPayroll staff,
    IAttendanceMonths attendance,
    IStaffDeductions deductions,
    ILegalEntityDirectory legalEntities,
    IApprovalService approvals,
    NumberSequenceService numbering,
    ICurrentUser user,
    IClock clock)
{
    public const string Sequence = "staff_payroll";

    public async Task<StaffRunChecks> ChecksAsync(Guid legalEntityId, string period, CancellationToken cancellationToken)
    {
        var month = Valid(period) ? await attendance.ClosedAsync(period, cancellationToken).ConfigureAwait(false) : null;
        var withoutRegistration = await staff.WithoutRegistrationAsync(cancellationToken).ConfigureAwait(false);
        var existing = await db.StaffRuns.AsNoTracking().Where(r => r.LegalEntityId == legalEntityId && r.Period == period).Select(r => r.RunNo).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        var earlier = await EarlierOpenAsync(null, legalEntityId, period, cancellationToken).ConfigureAwait(false);
        if (month is null)
        {
            return new StaffRunChecks(period, null, null, false, 0, 0, 0, withoutRegistration, existing, earlier);
        }

        var mine = (await staff.PayInfoAsync(month.From, month.To, cancellationToken).ConfigureAwait(false))
            .Where(e => e.LegalEntityId == legalEntityId && StaffPayCalculator.ServiceDays(month.From, month.To, e.HireDate, e.EndedOn) > 0).ToList();
        var paid = mine.Where(e => e.Salary is { Total: > 0 }).ToList();
        return new StaffRunChecks(period, month.From, month.To, true, paid.Count, mine.Count - paid.Count, paid.Count(e => e.Iban is null), withoutRegistration, existing, earlier);
    }

    public async Task<Result<Guid>> CreateAsync(CreateStaffRunInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!Valid(input.Period))
        {
            return Result.Failure<Guid>(PayrollErrors.Period);
        }

        var entity = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(e => e.Id == input.LegalEntityId && e.IsActive);
        if (entity is null)
        {
            return Result.Failure<Guid>(PayrollErrors.LegalEntity);
        }

        var month = await attendance.ClosedAsync(input.Period, cancellationToken).ConfigureAwait(false);
        if (month is null)
        {
            return Result.Failure<Guid>(PayrollErrors.AttendanceNotClosed);
        }

        if (await db.StaffRuns.AnyAsync(r => r.LegalEntityId == entity.Id && r.Period == input.Period, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(PayrollErrors.PeriodTaken);
        }

        if (await EarlierOpenAsync(null, entity.Id, input.Period, cancellationToken).ConfigureAwait(false) is not null)
        {
            return Result.Failure<Guid>(PayrollErrors.EarlierOpen);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, Sequence, month.To, cancellationToken).ConfigureAwait(false);
        var run = StaffPayrollRun.Create(number, entity.Id, entity.NameAr, input.Period, month.From, month.To, user.DisplayName, clock.UtcNow);
        db.StaffRuns.Add(run);
        var calculated = await CalculateAsync(run, month, cancellationToken).ConfigureAwait(false);
        if (calculated.IsFailure)
        {
            return Result.Failure<Guid>(calculated.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(run.Id);
    }

    public async Task<Result> RecalculateAsync(Guid id, CancellationToken cancellationToken)
    {
        var run = await db.StaffRuns.FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return Result.Failure(PayrollErrors.NotFound);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var calculated = await CalculateAsync(run, null, cancellationToken).ConfigureAwait(false);
        if (calculated.IsFailure)
        {
            return calculated;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>Recalculates (so what is sent is what the inputs make now) and starts the approval.</summary>
    public async Task<Result> SubmitAsync(Guid id, CancellationToken cancellationToken)
    {
        var run = await db.StaffRuns.FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return Result.Failure(PayrollErrors.NotFound);
        }

        if (await EarlierOpenAsync(run.Id, run.LegalEntityId, run.Period, cancellationToken).ConfigureAwait(false) is not null)
        {
            return Result.Failure(PayrollErrors.EarlierOpen);
        }

        await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false))
        {
            var calculated = await CalculateAsync(run, null, cancellationToken).ConfigureAwait(false);
            if (calculated.IsFailure)
            {
                return calculated;
            }

            var marked = run.MarkSubmitted(clock.UtcNow);
            if (marked.IsFailure)
            {
                await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
                return marked;
            }

            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }

        var started = await approvals.SubmitAsync(
            new ApprovalSubmission(StaffPayrollAdapter.ScreenCode, run.Id, $"{run.RunNo} — {run.LegalEntityName}", run.LegalEntityId), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            run.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure(started.Error);
        }

        return Result.Success();
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var run = await db.StaffRuns.FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return Result.Failure(PayrollErrors.NotFound);
        }

        if (!run.IsEditable)
        {
            return Result.Failure(PayrollErrors.NotEditable);
        }

        await db.StaffAdjustments.Where(a => a.RunId == id).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        db.StaffRuns.Remove(run);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> AddAdjustmentAsync(Guid id, StaffAdjustmentRequest input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var run = await db.StaffRuns.FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return Result.Failure(PayrollErrors.NotFound);
        }

        if (!run.IsEditable)
        {
            return Result.Failure(PayrollErrors.NotEditable);
        }

        if (!await db.StaffLines.AnyAsync(l => l.RunId == id && l.EmployeeId == input.EmployeeId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(PayrollErrors.LineNotFound);
        }

        var created = StaffPayrollAdjustment.Create(run.Id, input.EmployeeId, Enum.TryParse<AdjustmentKind>(input.Kind, out var k) ? k : AdjustmentKind.Addition, input.Amount, input.Reason, user.DisplayName, clock.UtcNow);
        if (created.IsFailure)
        {
            return created;
        }

        db.StaffAdjustments.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return await RecalculateAsync(id, cancellationToken).ConfigureAwait(false);
    }

    public async Task<Result> RemoveAdjustmentAsync(Guid id, Guid adjustmentId, CancellationToken cancellationToken)
    {
        var run = await db.StaffRuns.FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return Result.Failure(PayrollErrors.NotFound);
        }

        if (!run.IsEditable)
        {
            return Result.Failure(PayrollErrors.NotEditable);
        }

        var adjustment = await db.StaffAdjustments.FirstOrDefaultAsync(a => a.Id == adjustmentId && a.RunId == id, cancellationToken).ConfigureAwait(false);
        if (adjustment is null)
        {
            return Result.Failure(PayrollErrors.LineNotFound);
        }

        db.StaffAdjustments.Remove(adjustment);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return await RecalculateAsync(id, cancellationToken).ConfigureAwait(false);
    }

    public async Task<StaffPaySetting> SettingAsync(CancellationToken cancellationToken)
    {
        var setting = await db.StaffPaySettings.FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (setting is not null)
        {
            await EnsureNewSubscriberStepsAsync(cancellationToken).ConfigureAwait(false);
            return setting;
        }

        setting = StaffPaySetting.Default();
        db.StaffPaySettings.Add(setting);
        if (!await db.GosiRates.AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            // The rates in force (docs/03-migration-plan/11 §8, 4): finance reviews them before the first run.
            var start = new DateOnly(2014, 1, 1);
            db.GosiRates.Add(GosiRate.Create(GosiCategory.SaudiLegacy, start, 9.75m, 11.75m, 1500, 45000).Value);
            db.GosiRates.Add(GosiRate.Create(GosiCategory.SaudiNew, StaffPayCalculator.GosiNewFrom, 9.75m, 11.75m, 1500, 45000).Value);
            db.GosiRates.Add(GosiRate.Create(GosiCategory.NonSaudi, start, 0, 2, 1500, 45000).Value);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await EnsureNewSubscriberStepsAsync(cancellationToken).ConfigureAwait(false);
        return setting;
    }

    /// <summary>The new subscribers' graduated rates (4.9), added once beside the first rate if they are missing.</summary>
    private async Task EnsureNewSubscriberStepsAsync(CancellationToken cancellationToken)
    {
        var dates = await db.GosiRates.Where(r => r.Category == GosiCategory.SaudiNew).Select(r => r.EffectiveFrom).ToListAsync(cancellationToken).ConfigureAwait(false);
        if (dates.Count == 0)
        {
            return;
        }

        var added = false;
        foreach (var (from, employee, employer) in GosiRules.NewSubscriberSteps.Where(s => !dates.Contains(s.From)))
        {
            db.GosiRates.Add(GosiRate.Create(GosiCategory.SaudiNew, from, employee, employer, 1500, 45000).Value);
            added = true;
        }

        if (added)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task<PaySettingsDto> SettingsAsync(CancellationToken cancellationToken)
    {
        var s = await SettingAsync(cancellationToken).ConfigureAwait(false);
        var rules = await deductions.RulesAsync(cancellationToken).ConfigureAwait(false);
        return new PaySettingsDto(s.OvertimePremiumPercent, s.HoursPerDay, s.LateMode.ToString(), rules.MonthlyCapPercent);
    }

    public async Task<Result> SaveSettingsAsync(PaySettingsDto input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var s = await SettingAsync(cancellationToken).ConfigureAwait(false);
        var set = s.Set(input.OvertimePremiumPercent, input.HoursPerDay, Enum.TryParse<LateDeductionMode>(input.LateMode, out var m) ? m : LateDeductionMode.None);
        if (set.IsSuccess)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return set;
    }

    public async Task<IReadOnlyList<GosiRateDto>> GosiRatesAsync(CancellationToken cancellationToken)
    {
        await SettingAsync(cancellationToken).ConfigureAwait(false);
        return await db.GosiRates.AsNoTracking().OrderBy(r => r.Category).ThenByDescending(r => r.EffectiveFrom)
            .Select(r => new GosiRateDto(r.Id, r.Category.ToString(), r.EffectiveFrom, r.EmployeePercent, r.EmployerPercent, r.MinBase, r.MaxBase))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<Result<Guid>> SaveGosiRateAsync(Guid? id, GosiRateInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        await SettingAsync(cancellationToken).ConfigureAwait(false);
        if (!Enum.TryParse<GosiCategory>(input.Category, out var category))
        {
            return Result.Failure<Guid>(PayrollErrors.Setting);
        }

        if (id is { } existing)
        {
            var rate = await db.GosiRates.FirstOrDefaultAsync(r => r.Id == existing, cancellationToken).ConfigureAwait(false);
            if (rate is null)
            {
                return Result.Failure<Guid>(PayrollErrors.Setting);
            }

            var set = rate.Set(input.EffectiveFrom, input.EmployeePercent, input.EmployerPercent, input.MinBase, input.MaxBase);
            if (set.IsFailure)
            {
                return Result.Failure<Guid>(set.Error);
            }

            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Success(rate.Id);
        }

        var created = GosiRate.Create(category, input.EffectiveFrom, input.EmployeePercent, input.EmployerPercent, input.MinBase, input.MaxBase);
        if (created.IsFailure)
        {
            return Result.Failure<Guid>(created.Error);
        }

        db.GosiRates.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(created.Value.Id);
    }

    private async Task<Result> CalculateAsync(StaffPayrollRun run, ClosedAttendanceMonth? month, CancellationToken cancellationToken)
    {
        if (!run.IsEditable)
        {
            return Result.Failure(PayrollErrors.NotEditable);
        }

        month ??= await attendance.ClosedAsync(run.Period, cancellationToken).ConfigureAwait(false);
        if (month is null)
        {
            return Result.Failure(PayrollErrors.AttendanceNotClosed);
        }

        var setting = await SettingAsync(cancellationToken).ConfigureAwait(false);
        var rules = new StaffPayRules(setting.OvertimePremiumPercent, setting.HoursPerDay, setting.LateMode, (await deductions.RulesAsync(cancellationToken).ConfigureAwait(false)).MonthlyCapPercent);
        var gosi = await GosiRules.RatesAsync(db, run.To, cancellationToken).ConfigureAwait(false);
        var registered = await db.GosiMembers.AsNoTracking().Where(m => m.Kind == GosiPersonKind.Staff && m.RegisteredWage != null && m.ExcludedOn == null)
            .ToDictionaryAsync(m => m.PersonId, m => m.RegisteredWage!.Value, cancellationToken).ConfigureAwait(false);

        var employees = (await staff.PayInfoAsync(run.From, run.To, cancellationToken).ConfigureAwait(false))
            .Where(e => e.LegalEntityId == run.LegalEntityId && StaffPayCalculator.ServiceDays(run.From, run.To, e.HireDate, e.EndedOn) > 0).ToList();
        var attended = month.Lines.GroupBy(l => l.EmployeeId).ToDictionary(g => g.Key, g => g.First());
        var due = (await deductions.DueAsync(run.Period, cancellationToken).ConfigureAwait(false)).ToLookup(d => d.EmployeeId);
        var adjustments = (await db.StaffAdjustments.AsNoTracking().Where(a => a.RunId == run.Id).ToListAsync(cancellationToken).ConfigureAwait(false))
            .ToLookup(a => a.EmployeeId);

        // The days an approved settlement paid (its unpaid days, and a vacation's leave), by the 30-day rule: all the run's days are 30.
        var settlements = (await db.Settlements.AsNoTracking()
                .Where(s => s.Party == SettlementParty.Staff && (s.Status == SettlementStatus.Approved || s.Status == SettlementStatus.Paid))
                .Select(s => new { s.PersonId, s.UnpaidFrom, s.UnpaidDays, s.LastDay, s.LeaveFrom, s.LeaveTo })
                .ToListAsync(cancellationToken).ConfigureAwait(false))
            .ToLookup(s => s.PersonId);
        int Overlap(DateOnly? start, DateOnly? end) =>
            start is { } f && end is { } t ? Math.Max(0, Math.Min(t.DayNumber, run.To.DayNumber) - Math.Max(f.DayNumber, run.From.DayNumber) + 1) : 0;
        decimal Settled(Guid employeeId)
        {
            var days = settlements[employeeId].Sum(s => Overlap(s.UnpaidDays > 0 ? s.UnpaidFrom : null, s.LastDay) + Overlap(s.LeaveFrom, s.LeaveTo));
            return days >= run.To.DayNumber - run.From.DayNumber + 1 ? 30 : Math.Min(30, days);
        }

        var lines = new List<StaffPayrollLine>();
        var noSalary = 0;
        foreach (var e in employees)
        {
            if (e.Salary is not { Total: > 0 } salary)
            {
                noSalary++;
                continue;
            }

            var settled = Settled(e.EmployeeId);
            if (settled > 0 && StaffPayCalculator.ServiceDays(run.From, run.To, e.HireDate, e.EndedOn) <= settled)
            {
                continue;
            }

            var category = StaffPayCalculator.CategoryOf(e, run.From);
            var rate = gosi.GetValueOrDefault(category);
            var (values, items) = StaffPayCalculator.Line(
                e, salary, attended.GetValueOrDefault(e.EmployeeId), due[e.EmployeeId].ToList(),
                adjustments[e.EmployeeId].Select(a => new StaffAdjustmentInput(a.Id, a.Kind, a.Amount, a.Reason)).ToList(),
                rate, rules, run.From, run.To, registered.TryGetValue(e.EmployeeId, out var wage) ? wage : null, settled);
            lines.Add(StaffPayrollLine.Create(run.Id, values, items));
        }

        // The run's old rows go first (deleted in the database, and no longer tracked).
        foreach (var entry in db.ChangeTracker.Entries().Where(x => x.Entity is StaffPayrollLine l && l.RunId == run.Id || x.Entity is StaffPayrollItem i && i.RunId == run.Id).ToList())
        {
            entry.State = EntityState.Detached;
        }

        await db.StaffItems.Where(i => i.RunId == run.Id).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        await db.StaffLines.Where(l => l.RunId == run.Id).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        var calculated = run.Calculate(lines.OrderBy(l => l.EmployeeNo, StringComparer.Ordinal).ToList(), noSalary, clock.UtcNow);
        if (calculated.IsSuccess && db.Entry(run).State != EntityState.Added)
        {
            db.StaffLines.AddRange(lines);
        }

        return calculated;
    }

    /// <summary>An earlier run of the registration not approved yet: runs go in order, so a deduction is never taken twice.</summary>
    private Task<string?> EarlierOpenAsync(Guid? id, Guid legalEntityId, string period, CancellationToken cancellationToken) =>
#pragma warning disable CA1309 // EF translates string.Compare to SQL; the periods are ASCII "YYYY-MM".
        db.StaffRuns.AsNoTracking().Where(r => r.Id != id && r.LegalEntityId == legalEntityId && r.Status != PayrollStatus.Approved && string.Compare(r.Period, period) < 0)
#pragma warning restore CA1309
            .OrderBy(r => r.Period).Select(r => r.RunNo).FirstOrDefaultAsync(cancellationToken);

    private static bool Valid(string? period) =>
        period is { Length: 7 } && DateOnly.TryParseExact(period + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
}
