using System.Globalization;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Contracts;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Leave.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

/// <param name="LeaveRequestId">A staff vacation settlement: the approved annual leave it pays.</param>
/// <param name="EmployeeId">A staff end-of-service settlement: the employee; a worker's settlement: the worker.</param>
/// <param name="Party">Staff (the default) or Worker.</param>
/// <param name="LeaveFrom">A worker's vacation settlement: the leave's first and last days.</param>
public sealed record CreateSettlementInput(
    string Kind, Guid? LeaveRequestId, Guid? EmployeeId, string? Reason, DateOnly? LastDay, string? Term, DateOnly? ContractEndsOn,
    string? Party = null, DateOnly? LeaveFrom = null, DateOnly? LeaveTo = null);

/// <summary>A worker on the company's sponsorship, for the «new settlement» dialog.</summary>
public sealed record SettlementWorkerDto(Guid Id, string WorkerNo, string Name, string? Sponsor, string Placement, string? ProjectName);

public sealed record SettlementEditInput(
    string? Reason, DateOnly? LastDay, string? Term, DateOnly? ContractEndsOn, decimal OtherAdditions, decimal Custody, decimal OtherDeductions, bool DeductFullAdvance, string? Notes);

public sealed record SettlementPaymentInput(DateOnly PaidOn, string Method, string? Reference);

/// <summary>An approved annual leave that has no settlement yet (the «new vacation settlement» list).</summary>
public sealed record SettlementLeaveDto(Guid RequestId, string RequestNo, Guid EmployeeId, string EmployeeNo, string Name, DateOnly From, DateOnly To, decimal Days);

/// <summary>
/// The staff's settlements (docs/03-migration-plan/18, 4.11أ): made from an approved annual leave or for an employee's
/// end of service; calculated from the file's salary and dates, the payroll runs already approved, the leave balance and
/// unpaid leaves, and the advances, penalties and deductions due; recalculated while open; sent through approval (HR,
/// payroll, then finance); approved, the deductions are recorded and an ended service closes the file; finance pays it.
/// </summary>
internal sealed class SettlementService(
    PayrollDbContext db,
    IStaffPayroll staff,
    IStaffDeductions deductions,
    IApprovedLeaves leaves,
    ILeavePayroll leavePayroll,
    IWorkerSalaries workerSalaries,
    IWorkforceDirectory workforce,
    ITimesheetPayroll timesheets,
    IPeriodLedger ledger,
    IApprovalService approvals,
    NumberSequenceService numbering,
    ICurrentUser user,
    IClock clock)
{
    public const string VacationSequence = "settlement_vacation";
    public const string FinalSequence = "settlement_final";
    public const string AnnualLeave = "annual";

    /// <summary>A settlement line paying an approved timesheet line (the payroll leaves that line out).</summary>
    public const string TimesheetPayCode = "timesheet_pay";

    /// <summary>An unpaid leave as the leave module's contract writes its pay.</summary>
    public const string UnpaidLeave = "Unpaid";

    /// <summary>The approved annual leaves from 60 days ago on with no open settlement.</summary>
    public async Task<IReadOnlyList<SettlementLeaveDto>> LeavesAsync(CancellationToken cancellationToken)
    {
        var from = clock.Today.AddDays(-60);
        var approved = (await leaves.InAsync(from, clock.Today.AddYears(1), null, cancellationToken).ConfigureAwait(false))
            .Where(l => l.TypeCode == AnnualLeave && l.From >= from).ToList();
        var taken = await db.Settlements.AsNoTracking().Where(s => s.LeaveRequestId != null && s.Status != SettlementStatus.Cancelled)
            .Select(s => s.LeaveRequestId!.Value).ToListAsync(cancellationToken).ConfigureAwait(false);
        var people = (await staff.PayInfoAsync(from, clock.Today, cancellationToken).ConfigureAwait(false)).ToDictionary(e => e.EmployeeId);
        return approved.Where(l => !taken.Contains(l.RequestId) && people.ContainsKey(l.EmployeeId))
            .Select(l => new SettlementLeaveDto(l.RequestId, l.RequestNo, l.EmployeeId, people[l.EmployeeId].EmployeeNo, people[l.EmployeeId].Name, l.From, l.To, LeaveDays(l)))
            .OrderBy(l => l.From).ToList();
    }

    /// <summary>The workers on the sponsorship of one of the company's registrations matching a search.</summary>
    public async Task<IReadOnlyList<SettlementWorkerDto>> WorkersAsync(string search, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(search))
        {
            return [];
        }

        var sponsors = await SponsorsAsync(cancellationToken).ConfigureAwait(false);
        return (await workforce.SearchAsync(search.Trim(), 40, cancellationToken).ConfigureAwait(false))
            .Where(w => w.Sponsor is { } sp && sponsors.ContainsKey(sp.Trim()))
            .Take(20)
            .Select(w => new SettlementWorkerDto(w.Id, w.WorkerNo, w.Name, w.Sponsor, w.Placement, w.ProjectName))
            .ToList();
    }

    public async Task<Result<Guid>> CreateAsync(CreateSettlementInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!Enum.TryParse<SettlementKind>(input.Kind, out var kind))
        {
            return Result.Failure<Guid>(SettlementErrors.End);
        }

        if (input.Party == nameof(SettlementParty.Worker))
        {
            return await CreateWorkerAsync(kind, input, cancellationToken).ConfigureAwait(false);
        }

        ApprovedLeave? leave = null;
        Guid employeeId;
        if (kind == SettlementKind.Vacation)
        {
            leave = (await leaves.InAsync(clock.Today.AddDays(-60), clock.Today.AddYears(1), null, cancellationToken).ConfigureAwait(false))
                .FirstOrDefault(l => l.RequestId == input.LeaveRequestId && l.TypeCode == AnnualLeave);
            if (leave is null)
            {
                return Result.Failure<Guid>(SettlementErrors.Leave);
            }

            if (await db.Settlements.AnyAsync(s => s.LeaveRequestId == leave.RequestId && s.Status != SettlementStatus.Cancelled, cancellationToken).ConfigureAwait(false))
            {
                return Result.Failure<Guid>(SettlementErrors.Exists);
            }

            employeeId = leave.EmployeeId;
        }
        else
        {
            if (input.EmployeeId is not { } id || !Enum.TryParse<EndReason>(input.Reason, out _) || input.LastDay is null)
            {
                return Result.Failure<Guid>(SettlementErrors.End);
            }

            if (await db.Settlements.AnyAsync(s => s.PersonId == id && s.Kind == SettlementKind.EndOfService && s.Status != SettlementStatus.Cancelled, cancellationToken).ConfigureAwait(false))
            {
                return Result.Failure<Guid>(SettlementErrors.Exists);
            }

            employeeId = id;
        }

        var on = leave?.From ?? input.LastDay!.Value;
        var person = (await staff.PayInfoAsync(on, on, cancellationToken).ConfigureAwait(false)).FirstOrDefault(e => e.EmployeeId == employeeId);
        if (person?.HireDate is not { } hired)
        {
            return Result.Failure<Guid>(SettlementErrors.Employee);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, kind == SettlementKind.Vacation ? VacationSequence : FinalSequence, on, cancellationToken).ConfigureAwait(false);
        var settlement = Settlement.Create(
            number, kind, SettlementParty.Staff,
            new SettlementPerson(person.EmployeeId, person.EmployeeNo, person.Name, person.LegalEntityId, person.DepartmentAr, person.DepartmentEn, person.JobTitleAr, person.JobTitleEn, hired),
            user.DisplayName, clock.UtcNow);
        var set = leave is not null
            ? settlement.SetLeave(leave.RequestId, leave.RequestNo, leave.From, leave.To)
            : settlement.SetEnd(Enum.Parse<EndReason>(input.Reason!), input.LastDay!.Value, Term(input.Term), input.ContractEndsOn);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        db.Settlements.Add(settlement);
        var calculated = await CalculateAsync(settlement, cancellationToken).ConfigureAwait(false);
        if (calculated.IsFailure)
        {
            return Result.Failure<Guid>(calculated.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(settlement.Id);
    }

    public async Task<Result> UpdateAsync(Guid id, SettlementEditInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var settlement = await db.Settlements.Include(s => s.Lines).FirstOrDefaultAsync(s => s.Id == id, cancellationToken).ConfigureAwait(false);
        if (settlement is null)
        {
            return Result.Failure(SettlementErrors.NotFound);
        }

        if (settlement.Kind == SettlementKind.EndOfService)
        {
            if (!Enum.TryParse<EndReason>(input.Reason, out var reason) || input.LastDay is not { } lastDay)
            {
                return Result.Failure(SettlementErrors.End);
            }

            var ended = settlement.SetEnd(reason, lastDay, Term(input.Term), input.ContractEndsOn);
            if (ended.IsFailure)
            {
                return ended;
            }
        }

        var set = settlement.SetManual(input.OtherAdditions, input.Custody, input.OtherDeductions, input.DeductFullAdvance, input.Notes);
        if (set.IsFailure)
        {
            return set;
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var calculated = await CalculateAsync(settlement, cancellationToken).ConfigureAwait(false);
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
        var settlement = await db.Settlements.Include(s => s.Lines).FirstOrDefaultAsync(s => s.Id == id, cancellationToken).ConfigureAwait(false);
        if (settlement is null)
        {
            return Result.Failure(SettlementErrors.NotFound);
        }

        await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false))
        {
            var calculated = await CalculateAsync(settlement, cancellationToken).ConfigureAwait(false);
            if (calculated.IsFailure)
            {
                return calculated;
            }

            var marked = settlement.MarkSubmitted(clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            if (marked.IsFailure)
            {
                return marked;
            }
        }

        var started = await approvals.SubmitAsync(
            new ApprovalSubmission(settlement.Party == SettlementParty.Worker ? WorkerSettlementAdapter.ScreenCode : SettlementAdapter.ScreenCode, settlement.Id, $"{settlement.SettlementNo} — {settlement.Name}", settlement.LegalEntityId), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            settlement.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure(started.Error);
        }

        return Result.Success();
    }

    public async Task<Result> PayAsync(Guid id, SettlementPaymentInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var settlement = await db.Settlements.FirstOrDefaultAsync(s => s.Id == id, cancellationToken).ConfigureAwait(false);
        if (settlement is null)
        {
            return Result.Failure(SettlementErrors.NotFound);
        }

        var paid = settlement.Pay(input.PaidOn, input.Method, input.Reference, user.DisplayName);
        if (paid.IsSuccess)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return paid;
    }

    public async Task<Result> CancelAsync(Guid id, string? comment, CancellationToken cancellationToken)
    {
        var settlement = await db.Settlements.FirstOrDefaultAsync(s => s.Id == id, cancellationToken).ConfigureAwait(false);
        if (settlement is null)
        {
            return Result.Failure(SettlementErrors.NotFound);
        }

        var cancelled = settlement.Cancel(comment);
        if (cancelled.IsSuccess)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return cancelled;
    }

    /// <summary>
    /// The figures from the file and the other modules: the wage in effect on the last day (the total salary and the
    /// acting allowance); the first day no approved payroll run (nor an earlier final settlement) paid; the leave's days
    /// or the unused balance; the unpaid leaves above 20 days a year; and the month's installments (all of them when the
    /// rest is taken), penalties and deductions.
    /// </summary>
    private async Task<Result> CalculateAsync(Settlement s, CancellationToken cancellationToken)
    {
        if (!s.IsEditable)
        {
            return Result.Failure(SettlementErrors.NotEditable);
        }

        if (s.Party == SettlementParty.Worker)
        {
            return await CalculateWorkerAsync(s, cancellationToken).ConfigureAwait(false);
        }

        var on = s.Kind == SettlementKind.Vacation ? s.LeaveFrom!.Value : s.LastDay;
        var person = (await staff.PayInfoAsync(on, on, cancellationToken).ConfigureAwait(false)).FirstOrDefault(e => e.EmployeeId == s.PersonId);
        if (person?.Salary is not { Total: > 0 } salary)
        {
            return Result.Failure(SettlementErrors.Employee);
        }

        var wage = salary.Total + person.ActingAllowance;
        var paidTo = await db.StaffLines.AsNoTracking().Where(l => l.EmployeeId == s.PersonId)
            .Join(db.StaffRuns.AsNoTracking().Where(r => r.Status == PayrollStatus.Approved), l => l.RunId, r => r.Id, (l, r) => (DateOnly?)r.To)
            .MaxAsync(cancellationToken).ConfigureAwait(false);
        var settledTo = (await db.Settlements.AsNoTracking()
                .Where(x => x.Id != s.Id && x.PersonId == s.PersonId && (x.Status == SettlementStatus.Approved || x.Status == SettlementStatus.Paid))
                .Select(x => new { x.LastDay, x.LeaveTo }).ToListAsync(cancellationToken).ConfigureAwait(false))
            .Select(x => (DateOnly?)(x.LeaveTo ?? x.LastDay)).Max();

        // No approved run yet: the old system paid the months before; the settlement pays its own month's days.
        var unpaidFrom = paidTo?.AddDays(1) ?? new DateOnly(s.LastDay.Year, s.LastDay.Month, 1);
        if (settledTo is { } settled && settled >= unpaidFrom)
        {
            unpaidFrom = settled.AddDays(1);
        }

        if (unpaidFrom < s.HireDate)
        {
            unpaidFrom = s.HireDate;
        }

        var period = on.ToString("yyyy-MM", CultureInfo.InvariantCulture);
        var due = (await deductions.DueAsync(period, cancellationToken).ConfigureAwait(false)).Where(d => d.EmployeeId == s.PersonId).ToList();
        if (s.DeductFullAdvance)
        {
            due = due.Where(d => d.Kind != DeductionItemKind.Installment)
                .Concat(await deductions.OpenInstallmentsAsync(s.PersonId, cancellationToken).ConfigureAwait(false)).ToList();
        }

        decimal leaveDays, excluded = 0;
        if (s.Kind == SettlementKind.Vacation)
        {
            var leave = (await leaves.InAsync(s.LeaveFrom!.Value, s.LeaveTo!.Value, s.PersonId, cancellationToken).ConfigureAwait(false))
                .FirstOrDefault(l => l.RequestId == s.LeaveRequestId);
            leaveDays = leave is null ? s.LeaveTo.Value.DayNumber - s.LeaveFrom.Value.DayNumber + 1 : LeaveDays(leave);
        }
        else
        {
            leaveDays = Math.Max(0, (await leavePayroll.AnnualAsync(s.LastDay, cancellationToken).ConfigureAwait(false)).FirstOrDefault(b => b.EmployeeId == s.PersonId)?.Balance ?? 0);
            var unpaidLeaves = (await leaves.InAsync(s.HireDate, s.LastDay, s.PersonId, cancellationToken).ConfigureAwait(false))
                .Where(l => l.Pay == UnpaidLeave).Select(l => (l.From, l.To)).ToList();
            excluded = SettlementCalculator.ExcludedDays(s.HireDate, s.LastDay, unpaidLeaves);
        }

        var result = SettlementCalculator.Calculate(new SettlementCalculation(
            s.Kind, s.Reason, s.Term, s.ContractEndsOn, wage, s.HireDate, s.LastDay, unpaidFrom, excluded, leaveDays, due, s.OtherAdditions, s.Custody, s.OtherDeductions));
        return await StoreAsync(s, new SettlementFacts(period, wage, unpaidFrom, excluded, leaveDays), result, cancellationToken).ConfigureAwait(false);
    }

    private async Task<Result> StoreAsync(Settlement s, SettlementFacts facts, SettlementResult result, CancellationToken cancellationToken)
    {
        // The settlement's old lines go first (deleted in the database, and no longer tracked).
        foreach (var entry in db.ChangeTracker.Entries<SettlementLine>().Where(x => x.Entity.SettlementId == s.Id).ToList())
        {
            entry.State = EntityState.Detached;
        }

        if (db.Entry(s).State != EntityState.Added)
        {
            await db.SettlementLines.Where(l => l.SettlementId == s.Id).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        }

        var calculated = s.Calculate(facts, result, clock.UtcNow);
        if (calculated.IsSuccess && db.Entry(s).State != EntityState.Added)
        {
            db.SettlementLines.AddRange(s.Lines);
        }

        return calculated;
    }

    /// <summary>A worker's settlement (4.11ب): only a worker on the sponsorship of one of the company's registrations.</summary>
    private async Task<Result<Guid>> CreateWorkerAsync(SettlementKind kind, CreateSettlementInput input, CancellationToken cancellationToken)
    {
        if (input.EmployeeId is not { } workerId || await workerSalaries.ServiceAsync(workerId, cancellationToken).ConfigureAwait(false) is not { } w)
        {
            return Result.Failure<Guid>(SettlementErrors.Employee);
        }

        var sponsors = await SponsorsAsync(cancellationToken).ConfigureAwait(false);
        if (w.Sponsor is not { } sponsor || !sponsors.TryGetValue(sponsor.Trim(), out var legalEntityId))
        {
            return Result.Failure<Guid>(SettlementErrors.NotSponsored);
        }

        if ((w.ContractStartsOn ?? w.ArrivedOn) is not { } started)
        {
            return Result.Failure<Guid>(SettlementErrors.Employee);
        }

        if (kind == SettlementKind.Vacation)
        {
            if (input.LeaveFrom is not { } from || input.LeaveTo is null)
            {
                return Result.Failure<Guid>(SettlementErrors.Leave);
            }

            if (await db.Settlements.AnyAsync(s => s.PersonId == workerId && s.Kind == SettlementKind.Vacation && s.LeaveFrom == from && s.Status != SettlementStatus.Cancelled, cancellationToken).ConfigureAwait(false))
            {
                return Result.Failure<Guid>(SettlementErrors.Exists);
            }
        }
        else
        {
            if (!Enum.TryParse<EndReason>(input.Reason, out _) || input.LastDay is null)
            {
                return Result.Failure<Guid>(SettlementErrors.End);
            }

            if (await db.Settlements.AnyAsync(s => s.PersonId == workerId && s.Kind == SettlementKind.EndOfService && s.Status != SettlementStatus.Cancelled, cancellationToken).ConfigureAwait(false))
            {
                return Result.Failure<Guid>(SettlementErrors.Exists);
            }
        }

        var on = input.LeaveFrom ?? input.LastDay!.Value;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, kind == SettlementKind.Vacation ? VacationSequence : FinalSequence, on, cancellationToken).ConfigureAwait(false);
        var settlement = Settlement.Create(
            number, kind, SettlementParty.Worker,
            new SettlementPerson(w.WorkerId, w.WorkerNo, w.Name, legalEntityId, w.ProjectName, w.ProjectName, w.ProfessionAr, w.ProfessionEn, started),
            user.DisplayName, clock.UtcNow);
        var set = kind == SettlementKind.Vacation
            ? settlement.SetWorkerLeave(input.LeaveFrom!.Value, input.LeaveTo!.Value)
            : settlement.SetEnd(Enum.Parse<EndReason>(input.Reason!), input.LastDay!.Value, Term(input.Term), input.ContractEndsOn ?? w.ContractEndsOn);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        db.Settlements.Add(settlement);
        var calculated = await CalculateAsync(settlement, cancellationToken).ConfigureAwait(false);
        if (calculated.IsFailure)
        {
            return Result.Failure<Guid>(calculated.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(settlement.Id);
    }

    /// <summary>
    /// A worker's figures (decision 7: housing days are not paid; only work is): the approved timesheet lines to the last
    /// day no run (nor another settlement) paid, at the timesheet's net; then the days on the job after the last approved
    /// timesheet, by the ledger, at the wage ÷ 30 (a whole month is 30); the leave's days or the leave left in the file.
    /// The worker's loans are on the timesheets; the custody and other deductions are entered.
    /// </summary>
    private async Task<Result> CalculateWorkerAsync(Settlement s, CancellationToken cancellationToken)
    {
        if (await workerSalaries.ServiceAsync(s.PersonId, cancellationToken).ConfigureAwait(false) is not { TotalSalary: > 0 } w)
        {
            return Result.Failure(SettlementErrors.Employee);
        }

        var wage = w.TotalSalary;
        var lines = (await timesheets.CompanyLinesAsync(s.LastDay.AddDays(-400), s.LastDay, cancellationToken).ConfigureAwait(false))
            .Where(l => l.WorkerId == s.PersonId && l.TimesheetStatus == "Approved").ToList();
        var ids = lines.Select(l => l.LineId).ToList();
        var inRuns = await db.Sources.AsNoTracking().Where(x => ids.Contains(x.TimesheetLineId)).Select(x => x.TimesheetLineId).ToListAsync(cancellationToken).ConfigureAwait(false);
        var inSettlements = await db.SettlementLines.AsNoTracking()
            .Where(l => l.Code == TimesheetPayCode && l.SourceId != null && ids.Contains(l.SourceId.Value) && l.SettlementId != s.Id)
            .Join(db.Settlements.AsNoTracking().Where(x => x.Status != SettlementStatus.Cancelled), l => l.SettlementId, x => x.Id, (l, x) => l.SourceId!.Value)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var toPay = lines.Where(l => !inRuns.Contains(l.LineId) && !inSettlements.Contains(l.LineId)).OrderBy(l => l.LineFrom)
            .Select(l => new TimesheetPay(l.LineId, l.TimesheetNo, l.WorkDays - l.AbsenceDays, l.WorkerNet)).ToList();

        var settledTo = (await db.Settlements.AsNoTracking()
                .Where(x => x.Id != s.Id && x.PersonId == s.PersonId && (x.Status == SettlementStatus.Approved || x.Status == SettlementStatus.Paid))
                .Select(x => new { x.LastDay, x.LeaveTo }).ToListAsync(cancellationToken).ConfigureAwait(false))
            .Select(x => (DateOnly?)(x.LeaveTo ?? x.LastDay)).Max();
        var coveredTo = new[] { lines.Select(l => (DateOnly?)l.LineTo).Max(), settledTo }.Max();
        var unpaidFrom = coveredTo?.AddDays(1) ?? new DateOnly(s.LastDay.Year, s.LastDay.Month, 1);
        if (unpaidFrom < s.HireDate)
        {
            unpaidFrom = s.HireDate;
        }

        decimal worked = 0;
        if (unpaidFrom <= s.LastDay)
        {
            var spans = (await ledger.WorkAsync(null, unpaidFrom, s.LastDay, cancellationToken).ConfigureAwait(false)).Where(x => x.WorkerId == s.PersonId).ToList();
            worked = WorkedDays(unpaidFrom, s.LastDay, spans.Select(x => (x.StartsOn, x.EndsOn)).ToList());
        }

        var leaveDays = s.Kind == SettlementKind.Vacation
            ? s.LeaveTo!.Value.DayNumber - s.LeaveFrom!.Value.DayNumber + 1
            : Math.Max(0, w.LeaveRemaining ?? 0);
        var period = (s.LeaveFrom ?? s.LastDay).ToString("yyyy-MM", CultureInfo.InvariantCulture);
        var result = SettlementCalculator.Calculate(new SettlementCalculation(
            s.Kind, s.Reason, s.Term, s.ContractEndsOn, wage, s.HireDate, s.LastDay, unpaidFrom, 0, leaveDays, [], s.OtherAdditions, s.Custody, s.OtherDeductions,
            toPay, worked));
        return await StoreAsync(s, new SettlementFacts(period, wage, unpaidFrom, 0, leaveDays), result, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>The days on the job from one day to another by the payroll's rule: a month worked through is 30.</summary>
    public static decimal WorkedDays(DateOnly from, DateOnly to, IReadOnlyList<(DateOnly StartsOn, DateOnly? EndsOn)> spans)
    {
        ArgumentNullException.ThrowIfNull(spans);
        decimal days = 0;
        for (var start = from; start <= to;)
        {
            var monthEnd = new DateOnly(start.Year, start.Month, DateTime.DaysInMonth(start.Year, start.Month));
            var end = monthEnd < to ? monthEnd : to;
            var inMonth = spans.Sum(x => Math.Max(0, Math.Min((x.EndsOn?.AddDays(-1) ?? end).DayNumber, end.DayNumber) - Math.Max(x.StartsOn.DayNumber, start.DayNumber) + 1));
            var whole = start.Day == 1 && end == monthEnd && inMonth >= end.Day;
            days += whole ? 30 : Math.Min(30, inMonth);
            start = end.AddDays(1);
        }

        return days;
    }

    /// <summary>The old system's sponsors linked to the company's registrations (payroll.sponsor_registration).</summary>
    private async Task<Dictionary<string, Guid>> SponsorsAsync(CancellationToken cancellationToken) =>
        (await db.Sponsors.AsNoTracking().Select(x => new { x.Sponsor, x.LegalEntityId }).ToListAsync(cancellationToken).ConfigureAwait(false))
            .GroupBy(x => x.Sponsor.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().LegalEntityId, StringComparer.OrdinalIgnoreCase);

    private static decimal LeaveDays(ApprovedLeave l) => l.Days > 0 ? l.Days : l.To.DayNumber - l.From.DayNumber + 1;

    private static ContractTerm Term(string? term) => Enum.TryParse<ContractTerm>(term, out var t) ? t : ContractTerm.Indefinite;
}
