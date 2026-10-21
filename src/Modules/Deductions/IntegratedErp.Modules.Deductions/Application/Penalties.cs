using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Deductions.Domain;
using IntegratedErp.Modules.Deductions.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Deductions.Application;

public sealed record PenaltyInput(Guid EmployeeId, string Category, Guid? PenaltyTypeId, DateOnly ViolationDate, string Description, string? Statement, decimal? Days, decimal? Amount, string Period, bool AboveCap);

public sealed record PenaltyPreview(
    string Effect,
    decimal MaxDaysPerViolation,
    decimal MaxDaysPerMonth,
    decimal DaysThisMonth,
    decimal? MonthDeductions,
    decimal? MonthCap,
    IReadOnlyList<string> Problems,
    IReadOnlyList<string> NeedsAboveCap);

/// <summary>
/// Penalties for violations (the effect from the penalty type, the labour law's limits per violation and per month) and
/// other deductions (an amount with its reason), through approval and into a payroll month.
/// </summary>
internal sealed class PenaltyService(
    DeductionsDbContext db,
    IStaffDirectory staff,
    DeductionSetup setup,
    NumberSequenceService numbering,
    IApprovalService approvals,
    ICurrentUser user,
    IPermissionService permissions,
    IClock clock)
{
    public async Task<Result<PenaltyPreview>> PreviewAsync(PenaltyInput input, Guid? penaltyId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var setting = await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        var member = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(m => m.Id == input.EmployeeId);
        if (member is null)
        {
            return Result.Failure<PenaltyPreview>(DeductionErrors.EmployeeNotFound);
        }

        var category = Enum.TryParse<PenaltyCategory>(input.Category, out var c) ? c : PenaltyCategory.Penalty;
        PenaltyEffect effect;
        if (category == PenaltyCategory.Other)
        {
            effect = PenaltyEffect.DeductAmount;
        }
        else if (input.PenaltyTypeId is { } typeId && await db.PenaltyTypes.AsNoTracking().FirstOrDefaultAsync(t => t.Id == typeId && t.IsActive, cancellationToken).ConfigureAwait(false) is { } type)
        {
            effect = type.Effect;
        }
        else
        {
            return Result.Failure<PenaltyPreview>(DeductionErrors.TypeNotFound);
        }

        var problems = new List<string>();
        var aboveCap = new List<string>();
        if (string.IsNullOrWhiteSpace(input.Description) || !Periods.Valid(input.Period)
            || (effect is PenaltyEffect.DeductDays or PenaltyEffect.Suspension && input.Days is not > 0) || (effect == PenaltyEffect.DeductAmount && input.Amount is not > 0))
        {
            problems.Add("fields");
        }

        if ((member.HireDate is { } h && input.ViolationDate < h) || (member.EndedOn is { } e ? input.ViolationDate > e : member.Status == "Left"))
        {
            problems.Add("not_employed");
        }

        var period = Periods.Valid(input.Period) ? input.Period : Periods.Of(clock.Today);
        var sameMonth = await db.Penalties.AsNoTracking()
            .Where(p => p.EmployeeId == member.Id && p.Id != penaltyId && p.Period == period && (p.Status == PenaltyStatus.InApproval || p.Status == PenaltyStatus.Applied))
            .Select(p => new { p.Effect, p.Days }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var daysThisMonth = sameMonth.Where(p => p.Effect == PenaltyEffect.DeductDays).Sum(p => p.Days ?? 0);
        if (effect == PenaltyEffect.DeductDays && input.Days > setting.PenaltyMaxDaysPerViolation)
        {
            problems.Add("per_violation");
        }

        if (effect == PenaltyEffect.DeductDays && daysThisMonth + (input.Days ?? 0) > setting.PenaltyMaxDaysPerMonth)
        {
            problems.Add("per_month");
        }

        if (effect == PenaltyEffect.Suspension && sameMonth.Where(p => p.Effect == PenaltyEffect.Suspension).Sum(p => p.Days ?? 0) + (input.Days ?? 0) > setting.SuspensionMaxDaysPerMonth)
        {
            problems.Add("per_month");
        }

        var pay = await staff.SalaryAsync(member.Id, clock.Today, cancellationToken).ConfigureAwait(false);
        var month = await AdvanceService.MonthTotalAsync(db, member.Id, period, null, penaltyId, cancellationToken).ConfigureAwait(false)
            + (effect == PenaltyEffect.DeductAmount ? input.Amount ?? 0 : effect == PenaltyEffect.DeductDays && pay is not null ? decimal.Round(pay.Total / 30 * (input.Days ?? 0), 2) : 0);
        decimal? monthCap = pay is null ? null : decimal.Round(pay.Total * setting.MonthlyCapPercent / 100, 2);
        if (monthCap is { } mc && month > mc)
        {
            aboveCap.Add("month_cap");
            if (!input.AboveCap)
            {
                problems.Add("above_cap");
            }
        }

        var seeSalary = (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(AdvanceService.SalariesView);
        return Result.Success(new PenaltyPreview(effect.ToString(), setting.PenaltyMaxDaysPerViolation, setting.PenaltyMaxDaysPerMonth, daysThisMonth, seeSalary ? month : null, seeSalary ? monthCap : null, problems, aboveCap));
    }

    public async Task<Result<Guid>> RequestAsync(PenaltyInput input, CancellationToken cancellationToken)
    {
        var preview = await PreviewAsync(input, null, cancellationToken).ConfigureAwait(false);
        if (preview.IsFailure)
        {
            return Result.Failure<Guid>(preview.Error);
        }

        if (Refusal(preview.Value) is { } refused)
        {
            return Result.Failure<Guid>(refused);
        }

        var member = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).First(m => m.Id == input.EmployeeId);
        var category = Enum.TryParse<PenaltyCategory>(input.Category, out var c) ? c : PenaltyCategory.Penalty;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, category == PenaltyCategory.Other ? DeductionsModule.OtherSequence : DeductionsModule.PenaltySequence, clock.Today, cancellationToken).ConfigureAwait(false);
        var penalty = Penalty.Create(number, category, member.Id, member.NameAr ?? member.NameEn, user.DisplayName, clock.UtcNow);
        var set = penalty.Set(category == PenaltyCategory.Other ? null : input.PenaltyTypeId, Enum.Parse<PenaltyEffect>(preview.Value.Effect), input.ViolationDate, input.Description, input.Statement, input.Days, input.Amount, input.Period, preview.Value.NeedsAboveCap.Count > 0 && input.AboveCap);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        db.Penalties.Add(penalty);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return await SendAsync(penalty, member.LegalEntityId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<Result<Guid>> ResubmitAsync(Guid id, PenaltyInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Penalties.FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false) is not { } penalty)
        {
            return Result.Failure<Guid>(DeductionErrors.PenaltyNotFound);
        }

        if (penalty.Status != PenaltyStatus.Returned)
        {
            return Result.Failure<Guid>(DeductionErrors.NotReturned);
        }

        var fixedInput = input with { EmployeeId = penalty.EmployeeId, Category = penalty.Category.ToString() };
        var preview = await PreviewAsync(fixedInput, id, cancellationToken).ConfigureAwait(false);
        if (preview.IsFailure)
        {
            return Result.Failure<Guid>(preview.Error);
        }

        if (Refusal(preview.Value) is { } refused)
        {
            return Result.Failure<Guid>(refused);
        }

        var set = penalty.Set(penalty.Category == PenaltyCategory.Other ? null : input.PenaltyTypeId, Enum.Parse<PenaltyEffect>(preview.Value.Effect), input.ViolationDate, input.Description, input.Statement, input.Days, input.Amount, input.Period, preview.Value.NeedsAboveCap.Count > 0 && input.AboveCap);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var legalEntity = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(m => m.Id == penalty.EmployeeId)?.LegalEntityId;
        return await SendAsync(penalty, legalEntity, cancellationToken).ConfigureAwait(false);
    }

    private static Error? Refusal(PenaltyPreview p) => (p.Problems.Count > 0 ? p.Problems[0] : null) switch
    {
        null => null,
        "fields" => DeductionErrors.PenaltyFields,
        "not_employed" => DeductionErrors.NotEmployed,
        "per_violation" => DeductionErrors.PerViolation,
        "per_month" => DeductionErrors.PerMonth,
        _ => DeductionErrors.AboveCap,
    };

    private async Task<Result<Guid>> SendAsync(Penalty penalty, Guid? legalEntityId, CancellationToken cancellationToken)
    {
        var screen = penalty.Category == PenaltyCategory.Other ? OtherDeductionAdapter.ScreenCode : PenaltyAdapter.ScreenCode;
        var started = await approvals.SubmitAsync(new ApprovalSubmission(screen, penalty.Id, $"{penalty.PenaltyNo} — {penalty.EmployeeName}", legalEntityId), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            penalty.Ended(PenaltyStatus.Returned, null, clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure<Guid>(started.Error);
        }

        return Result.Success(penalty.Id);
    }
}

/// <summary>What penalties and other deductions share as approval records.</summary>
internal abstract class PenaltyAdapterBase(DeductionsDbContext db, IClock clock) : IApprovalRecordAdapter
{
    protected static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public abstract ApprovalScreen Screen { get; }

    protected static object Stage(string id, string ar, string en, string permission) => new
    {
        type = "approval", id, label = ar, nameAr = ar, nameEn = en,
        assignees = new[] { new { kind = "Permission", permission } }, rule = "Any",
    };

    protected static IReadOnlyList<RecordField> Fields() =>
    [
        new("employee", "الموظف", "Employee", RecordFieldType.Text, Updatable: false),
        new("days", "الأيام", "Days", RecordFieldType.Number, Updatable: false),
        new("amount", "المبلغ", "Amount", RecordFieldType.Money, Updatable: false),
        new("above_cap", "يتجاوز السقف", "Above the cap", RecordFieldType.Boolean, Updatable: false),
    ];

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var p = await db.Penalties.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return p is null
            ? null
            : new Dictionary<string, string?>
            {
                ["employee"] = p.EmployeeName,
                ["days"] = p.Days?.ToString(CultureInfo.InvariantCulture),
                ["amount"] = p.Amount?.ToString(CultureInfo.InvariantCulture),
                ["above_cap"] = p.AboveCap ? "true" : "false",
            };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("deduction_penalty_field_not_settable", "A process cannot change a penalty.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        if (await db.Penalties.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { } p)
        {
            return Result.Failure(DeductionErrors.PenaltyNotFound);
        }

        p.Started();
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        if (await db.Penalties.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { Status: PenaltyStatus.InApproval } p)
        {
            return;
        }

        p.Ended(end switch { ApprovalEnd.Approved => PenaltyStatus.Applied, ApprovalEnd.Rejected => PenaltyStatus.Rejected, _ => PenaltyStatus.Returned }, comment, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}

/// <summary>A penalty: HR, then senior management.</summary>
internal sealed class PenaltyAdapter(DeductionsDbContext db, IClock clock) : PenaltyAdapterBase(db, clock)
{
    public const string ScreenCode = "deduction.penalty";

    private static readonly string Definition = JsonSerializer.Serialize(
        new { startCondition = (object?)null, steps = new[] { Stage("hr", "الموارد البشرية", "HR", DeductionPermissions.ApproveHr), Stage("management", "الإدارة العليا", "Senior management", DeductionPermissions.ApproveManagement) } },
        JsonOptions);

    public override ApprovalScreen Screen { get; } = new(
        ScreenCode, "الجزاءات", "Penalties", "/hr/penalties/{id}", Fields(),
        DefaultProcess: new DefaultApprovalProcess("اعتماد الجزاءات", "Penalty approval", Definition));
}

/// <summary>Another deduction (damage, custody…): HR, then finance.</summary>
internal sealed class OtherDeductionAdapter(DeductionsDbContext db, IClock clock) : PenaltyAdapterBase(db, clock)
{
    public const string ScreenCode = "deduction.other";

    private static readonly string Definition = JsonSerializer.Serialize(
        new { startCondition = (object?)null, steps = new[] { Stage("hr", "الموارد البشرية", "HR", DeductionPermissions.ApproveHr), Stage("finance", "المالية", "Finance", DeductionPermissions.ApproveFinance) } },
        JsonOptions);

    public override ApprovalScreen Screen { get; } = new(
        ScreenCode, "الخصومات الأخرى", "Other deductions", "/hr/penalties/{id}", Fields(),
        DefaultProcess: new DefaultApprovalProcess("اعتماد الخصومات الأخرى", "Other deduction approval", Definition));
}

/// <summary>The month's deductions for the staff payroll (the payroll applies the cap and defers the rest).</summary>
internal sealed class StaffDeductions(DeductionsDbContext db, DeductionSetup setup) : IStaffDeductions
{
    public async Task<IReadOnlyList<MonthDeductions>> MonthAsync(string period, CancellationToken cancellationToken)
    {
        var due = await (from i in db.Installments.AsNoTracking()
                         join a in db.Advances.AsNoTracking() on i.AdvanceId equals a.Id
                         where i.Period == period && a.Status == AdvanceStatus.Disbursed && (i.Status == InstallmentStatus.Scheduled || i.Status == InstallmentStatus.Deferred)
                         select new { a.EmployeeId, Amount = i.Amount - i.Deducted, a.AboveCap }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var penalties = await db.Penalties.AsNoTracking().Where(p => p.Period == period && p.Status == PenaltyStatus.Applied)
            .Select(p => new { p.EmployeeId, p.Category, p.Effect, p.Days, p.Amount, p.AboveCap }).ToListAsync(cancellationToken).ConfigureAwait(false);
        return due.Select(d => d.EmployeeId).Concat(penalties.Select(p => p.EmployeeId)).Distinct()
            .Select(id => new MonthDeductions(
                id,
                due.Where(d => d.EmployeeId == id).Sum(d => d.Amount),
                penalties.Where(p => p.EmployeeId == id && p.Effect == PenaltyEffect.DeductDays).Sum(p => p.Days ?? 0),
                penalties.Where(p => p.EmployeeId == id && p.Category == PenaltyCategory.Penalty && p.Effect == PenaltyEffect.DeductAmount).Sum(p => p.Amount ?? 0),
                penalties.Where(p => p.EmployeeId == id && p.Effect == PenaltyEffect.Suspension).Sum(p => p.Days ?? 0),
                penalties.Where(p => p.EmployeeId == id && p.Category == PenaltyCategory.Other).Sum(p => p.Amount ?? 0),
                due.Any(d => d.EmployeeId == id && d.AboveCap) || penalties.Any(p => p.EmployeeId == id && p.AboveCap)))
            .ToList();
    }

    public async Task<IReadOnlyList<AdvanceBalance>> OutstandingAsync(CancellationToken cancellationToken)
    {
        var open = await (from i in db.Installments.AsNoTracking()
                          join a in db.Advances.AsNoTracking() on i.AdvanceId equals a.Id
                          where a.Status == AdvanceStatus.Disbursed && (i.Status == InstallmentStatus.Scheduled || i.Status == InstallmentStatus.Deferred || i.Status == InstallmentStatus.Postponed)
                          select new { a.EmployeeId, a.AdvanceNo, Left = i.Amount - i.Deducted }).ToListAsync(cancellationToken).ConfigureAwait(false);
        return open.GroupBy(x => (x.EmployeeId, x.AdvanceNo)).Select(g => new AdvanceBalance(g.Key.EmployeeId, g.Key.AdvanceNo, g.Sum(x => x.Left), g.Count()))
            .Where(b => b.Remaining > 0).OrderBy(b => b.AdvanceNo, StringComparer.Ordinal).ToList();
    }

    public async Task<IReadOnlyList<DueDeduction>> OpenInstallmentsAsync(Guid employeeId, CancellationToken cancellationToken)
    {
        var open = await (from i in db.Installments.AsNoTracking()
                          join a in db.Advances.AsNoTracking() on i.AdvanceId equals a.Id
                          where a.EmployeeId == employeeId && a.Status == AdvanceStatus.Disbursed
                              && (i.Status == InstallmentStatus.Scheduled || i.Status == InstallmentStatus.Deferred || i.Status == InstallmentStatus.Postponed)
                          orderby i.Period
                          select new { i.Id, a.AdvanceNo, i.Period, Due = i.Amount - i.Deducted, a.AboveCap })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return open.Where(i => i.Due > 0)
            .Select(i => new DueDeduction(i.Id, DeductionItemKind.Installment, employeeId, i.AdvanceNo, i.Period, 0, i.Due, i.AboveCap, i.AdvanceNo))
            .ToList();
    }

    public async Task<DeductionRules> RulesAsync(CancellationToken cancellationToken) =>
        new((await setup.SettingAsync(cancellationToken).ConfigureAwait(false)).MonthlyCapPercent);

#pragma warning disable CA1309 // EF translates string.Compare to SQL; the periods are ASCII "YYYY-MM", so the order is the same.
    public async Task<IReadOnlyList<DueDeduction>> DueAsync(string period, CancellationToken cancellationToken)
    {
        var installments = await (from i in db.Installments.AsNoTracking()
                                  join a in db.Advances.AsNoTracking() on i.AdvanceId equals a.Id
                                  where a.Status == AdvanceStatus.Disbursed && string.Compare(i.Period, period) <= 0
                                      && (i.Status == InstallmentStatus.Scheduled || i.Status == InstallmentStatus.Deferred)
                                  orderby i.Period
                                  select new { i.Id, a.EmployeeId, a.AdvanceNo, i.Period, Due = i.Amount - i.Deducted, a.AboveCap, a.Months })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var penalties = await db.Penalties.AsNoTracking()
            .Where(p => p.Status == PenaltyStatus.Applied && p.DeductedIn == null && p.Effect != PenaltyEffect.Warning && string.Compare(p.Period, period) <= 0)
            .OrderBy(p => p.Period).ThenBy(p => p.CreatedAt)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return installments.Where(i => i.Due > 0)
            .Select(i => new DueDeduction(i.Id, DeductionItemKind.Installment, i.EmployeeId, i.AdvanceNo, i.Period, 0, i.Due, i.AboveCap, i.AdvanceNo))
            .Concat(penalties.Select(p => new DueDeduction(
                p.Id,
                p.Category == PenaltyCategory.Other ? DeductionItemKind.Other
                    : p.Effect switch { PenaltyEffect.DeductDays => DeductionItemKind.PenaltyDays, PenaltyEffect.Suspension => DeductionItemKind.Suspension, _ => DeductionItemKind.PenaltyAmount },
                p.EmployeeId, p.PenaltyNo, p.Period, p.Days ?? 0, p.Amount ?? 0, p.AboveCap, p.Description)))
            .ToList();
    }
#pragma warning restore CA1309

    public async Task RecordAsync(string runNo, IReadOnlyList<DeductionSettlement> settlements, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(settlements);
        var installmentIds = settlements.Where(s => s.Kind == DeductionItemKind.Installment).Select(s => s.Id).ToList();
        var penaltyIds = settlements.Where(s => s.Kind != DeductionItemKind.Installment).Select(s => s.Id).ToList();
        var installments = await db.Installments.Where(i => installmentIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id, cancellationToken).ConfigureAwait(false);
        var penalties = await db.Penalties.Where(p => penaltyIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, cancellationToken).ConfigureAwait(false);
        foreach (var s in settlements)
        {
            if (s.Kind == DeductionItemKind.Installment)
            {
                installments.GetValueOrDefault(s.Id)?.Deduct(s.Deducted, runNo);
            }
            else if (penalties.GetValueOrDefault(s.Id) is { } p)
            {
                if (s.Deferred)
                {
                    p.Defer();
                }
                else
                {
                    p.Deduct(s.Deducted, runNo);
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        // An advance whose last installment is deducted is settled.
        var advanceIds = installments.Values.Select(i => i.AdvanceId).Distinct().ToList();
        var advances = await db.Advances.Include(a => a.Installments).Where(a => advanceIds.Contains(a.Id)).ToListAsync(cancellationToken).ConfigureAwait(false);
        foreach (var a in advances)
        {
            a.CheckSettled();
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
