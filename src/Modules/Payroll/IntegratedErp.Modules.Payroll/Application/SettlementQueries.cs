using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

public sealed record SettlementQuery(string? Party, string? Kind, string? Status, string? Search, string? Sort, bool Desc, int Page, int PageSize);

public sealed record SettlementItemDto(
    Guid Id, string SettlementNo, string Kind, string Party, Guid PersonId, string PersonNo, string Name, string? Reason, DateOnly? LeaveFrom, DateOnly LastDay,
    decimal ServiceYears, decimal TotalAdditions, decimal TotalDeductions, decimal Net, string Status, bool AwaitingApproval, DateTimeOffset CreatedAt);

/// <summary>The list's KPIs, over all the settlements (never a page of them).</summary>
public sealed record SettlementCountsDto(int Drafts, int InApproval, DateTimeOffset? OldestInApproval, int Approved, decimal ApprovedNet, int PaidThisMonth, decimal PaidThisMonthNet, int Staff, int Workers);

public sealed record SettlementListDto(SettlementCountsDto Counts, int Total, IReadOnlyList<SettlementItemDto> Items);

public sealed record SettlementLineDto(int LineNo, string Side, string Code, decimal Days, decimal Rate, decimal Amount, string? Reference, string? SourcePeriod);

public sealed record SettlementDetailDto(
    Guid Id,
    string SettlementNo,
    string Kind,
    string Party,
    Guid PersonId,
    string PersonNo,
    string Name,
    string? DepartmentAr,
    string? DepartmentEn,
    string? JobTitleAr,
    string? JobTitleEn,
    string? Reason,
    string Term,
    DateOnly? ContractEndsOn,
    Guid? LeaveRequestId,
    string? LeaveRequestNo,
    DateOnly? LeaveFrom,
    DateOnly? LeaveTo,
    DateOnly HireDate,
    DateOnly LastDay,
    string Period,
    decimal Wage,
    DateOnly? UnpaidFrom,
    decimal UnpaidDays,
    decimal ServiceDays,
    decimal ExcludedDays,
    decimal ServiceYears,
    decimal LeaveDays,
    decimal AwardFull,
    decimal AwardFactor,
    bool DeductFullAdvance,
    decimal OtherAdditions,
    decimal Custody,
    decimal OtherDeductions,
    string? Notes,
    decimal TotalAdditions,
    decimal TotalDeductions,
    decimal Net,
    string Status,
    bool AwaitingApproval,
    bool CanEdit,
    bool CanPay,
    DateTimeOffset CreatedAt,
    string CreatedByName,
    DateTimeOffset CalculatedAt,
    DateTimeOffset? ApprovedAt,
    string? ApprovedByName,
    string? LastComment,
    DateOnly? PaidOn,
    string? PaymentMethod,
    string? PaymentReference,
    string? PaidByName,
    IReadOnlyList<SettlementLineDto> Lines,
    ApprovalStatusInfo? Approval);

/// <summary>The settlements' list (filtered, sorted and paged on the server, its KPIs over all of them) and one settlement.</summary>
internal sealed class SettlementQueries(PayrollDbContext db, IApprovalService approvals, IPermissionService permissions, IClock clock)
{
    public async Task<SettlementListDto> ListAsync(SettlementQuery q, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(q);
        var all = db.Settlements.AsNoTracking().Where(s => s.Status != SettlementStatus.Cancelled);
        var month = new DateOnly(clock.Today.Year, clock.Today.Month, 1);
        var counts = await all.GroupBy(_ => 1).Select(g => new SettlementCountsDto(
                g.Count(s => s.Status == SettlementStatus.Draft || s.Status == SettlementStatus.Returned),
                g.Count(s => s.Status == SettlementStatus.InApproval),
                g.Where(s => s.Status == SettlementStatus.InApproval).Min(s => s.SubmittedAt),
                g.Count(s => s.Status == SettlementStatus.Approved),
                g.Where(s => s.Status == SettlementStatus.Approved).Sum(s => (decimal?)s.Net) ?? 0,
                g.Count(s => s.Status == SettlementStatus.Paid && s.PaidOn >= month),
                g.Where(s => s.Status == SettlementStatus.Paid && s.PaidOn >= month).Sum(s => (decimal?)s.Net) ?? 0,
                g.Count(s => s.Party == SettlementParty.Staff),
                g.Count(s => s.Party == SettlementParty.Worker)))
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false) ?? new SettlementCountsDto(0, 0, null, 0, 0, 0, 0, 0, 0);

        var query = q.Status == "Cancelled" ? db.Settlements.AsNoTracking().Where(s => s.Status == SettlementStatus.Cancelled) : all;
        if (Enum.TryParse<SettlementParty>(q.Party, out var party))
        {
            query = query.Where(s => s.Party == party);
        }

        if (Enum.TryParse<SettlementKind>(q.Kind, out var kind))
        {
            query = query.Where(s => s.Kind == kind);
        }

        query = q.Status switch
        {
            "Open" => query.Where(s => s.Status == SettlementStatus.Draft || s.Status == SettlementStatus.Returned),
            "InApproval" => query.Where(s => s.Status == SettlementStatus.InApproval),
            "Approved" => query.Where(s => s.Status == SettlementStatus.Approved),
            "Paid" => query.Where(s => s.Status == SettlementStatus.Paid),
            _ => query,
        };
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            query = query.Where(s => s.Name.Contains(term) || s.PersonNo.Contains(term) || s.SettlementNo.Contains(term));
        }

        query = (q.Sort, q.Desc) switch
        {
            ("name", false) => query.OrderBy(s => s.Name),
            ("name", true) => query.OrderByDescending(s => s.Name),
            ("net", false) => query.OrderBy(s => s.Net),
            ("net", true) => query.OrderByDescending(s => s.Net),
            ("date", false) => query.OrderBy(s => s.LastDay),
            ("date", true) => query.OrderByDescending(s => s.LastDay),
            _ => query.OrderByDescending(s => s.CreatedAt),
        };
        var total = await query.CountAsync(cancellationToken).ConfigureAwait(false);
        var size = Math.Clamp(q.PageSize, 1, 100);
        var items = await query.Skip((Math.Max(1, q.Page) - 1) * size).Take(size)
            .Select(s => new SettlementItemDto(
                s.Id, s.SettlementNo, s.Kind.ToString(), s.Party.ToString(), s.PersonId, s.PersonNo, s.Name, s.Reason == null ? null : s.Reason.ToString(), s.LeaveFrom, s.LastDay,
                s.ServiceYears, s.TotalAdditions, s.TotalDeductions, s.Net, s.Status.ToString(), s.AwaitingApproval, s.CreatedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return new SettlementListDto(counts, total, items);
    }

    public async Task<SettlementDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var s = await db.Settlements.AsNoTracking().Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (s is null)
        {
            return null;
        }

        var granted = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        var approval = await approvals.StatusAsync(SettlementAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        return new SettlementDetailDto(
            s.Id, s.SettlementNo, s.Kind.ToString(), s.Party.ToString(), s.PersonId, s.PersonNo, s.Name, s.DepartmentAr, s.DepartmentEn, s.JobTitleAr, s.JobTitleEn,
            s.Reason?.ToString(), s.Term.ToString(), s.ContractEndsOn, s.LeaveRequestId, s.LeaveRequestNo, s.LeaveFrom, s.LeaveTo, s.HireDate, s.LastDay, s.Period,
            s.Wage, s.UnpaidFrom, s.UnpaidDays, s.ServiceDays, s.ExcludedDays, s.ServiceYears, s.LeaveDays, s.AwardFull, s.AwardFactor, s.DeductFullAdvance,
            s.OtherAdditions, s.Custody, s.OtherDeductions, s.Notes, s.TotalAdditions, s.TotalDeductions, s.Net, s.Status.ToString(), s.AwaitingApproval,
            granted.Has(PayrollPermissions.SettlementsManage) && s.IsEditable,
            granted.Has(PayrollPermissions.SettlementsPay) && s.Status == SettlementStatus.Approved,
            s.CreatedAt, s.CreatedByName, s.CalculatedAt, s.ApprovedAt, s.ApprovedByName, s.LastComment, s.PaidOn, s.PaymentMethod, s.PaymentReference, s.PaidByName,
            s.Lines.OrderBy(l => l.LineNo).Select(l => new SettlementLineDto(l.LineNo, l.Side.ToString(), l.Code, l.Days, l.Rate, l.Amount, l.Reference, l.SourcePeriod)).ToList(),
            approval);
    }
}
