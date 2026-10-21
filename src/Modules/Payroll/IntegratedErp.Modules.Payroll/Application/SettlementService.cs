using System.Globalization;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Leave.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

/// <param name="LeaveRequestId">A vacation settlement: the approved annual leave it pays.</param>
/// <param name="EmployeeId">An end-of-service settlement: the employee.</param>
public sealed record CreateSettlementInput(string Kind, Guid? LeaveRequestId, Guid? EmployeeId, string? Reason, DateOnly? LastDay, string? Term, DateOnly? ContractEndsOn);

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
    IApprovalService approvals,
    NumberSequenceService numbering,
    ICurrentUser user,
    IClock clock)
{
    public const string VacationSequence = "settlement_vacation";
    public const string FinalSequence = "settlement_final";
    public const string AnnualLeave = "annual";

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

    public async Task<Result<Guid>> CreateAsync(CreateSettlementInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!Enum.TryParse<SettlementKind>(input.Kind, out var kind))
        {
            return Result.Failure<Guid>(SettlementErrors.End);
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
            new ApprovalSubmission(SettlementAdapter.ScreenCode, settlement.Id, $"{settlement.SettlementNo} — {settlement.Name}", settlement.LegalEntityId), cancellationToken).ConfigureAwait(false);
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

        // The settlement's old lines go first (deleted in the database, and no longer tracked).
        foreach (var entry in db.ChangeTracker.Entries<SettlementLine>().Where(x => x.Entity.SettlementId == s.Id).ToList())
        {
            entry.State = EntityState.Detached;
        }

        if (db.Entry(s).State != EntityState.Added)
        {
            await db.SettlementLines.Where(l => l.SettlementId == s.Id).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        }

        var calculated = s.Calculate(new SettlementFacts(period, wage, unpaidFrom, excluded, leaveDays), result, clock.UtcNow);
        if (calculated.IsSuccess && db.Entry(s).State != EntityState.Added)
        {
            db.SettlementLines.AddRange(s.Lines);
        }

        return calculated;
    }

    private static decimal LeaveDays(ApprovedLeave l) => l.Days > 0 ? l.Days : l.To.DayNumber - l.From.DayNumber + 1;

    private static ContractTerm Term(string? term) => Enum.TryParse<ContractTerm>(term, out var t) ? t : ContractTerm.Indefinite;
}
