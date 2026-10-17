using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

public sealed record ReturnRowDto(
    Guid Id,
    string OrderNo,
    string Source,
    string Status,
    int? CrmStatus,
    string Entry,
    Guid? WorkerId,
    string WorkerNo,
    string Name,
    string? ProjectName,
    DateOnly? ArrivedOn,
    string Reason,
    string? CustomerWish,
    bool StopSalary,
    string? HousingName,
    string CreatedByName,
    DateTimeOffset CreatedAt);

/// <summary>The list's cards: all, under preparation, in approval, in housing (completed), closed without completing.</summary>
public sealed record ReturnTotalsDto(int All, int UnderPreparation, int InApproval, int Completed, int Closed);

public sealed record ReturnListDto(int Total, ReturnTotalsDto Totals, IReadOnlyList<ReturnRowDto> Items);

public sealed record ReturnDetailDto(
    ReturnRowDto Summary,
    string? ProfessionAr,
    string? ProfessionEn,
    string? NationalityAr,
    string? NationalityEn,
    string? IqamaNo,
    Guid? ProjectId,
    DateOnly? WorkStartedOn,
    string? ReasonNotes,
    string? DelayReason,
    string? Notes,
    string? LastComment,
    DateTimeOffset? CompletedAt,
    string? CompletedByName,
    ApprovalStatusInfo? Approval,
    bool AwaitingApproval,
    bool CanEdit,
    bool CanSubmit,
    bool CanCancel);

internal sealed class ReturnOrderQueries(OperationsDbContext db, IReferenceData reference, IApprovalService approvals, IPermissionService permissions)
{
    public async Task<ReturnListDto> ListAsync(DeliveryListFilter filter, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        var rows = (await db.ReturnOrders.AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false)).Select(Row).ToList();
        var totals = new ReturnTotalsDto(
            rows.Count, rows.Count(r => IsPreparing(r.Status)), rows.Count(r => IsInApproval(r.Status)),
            rows.Count(r => r.Status == nameof(ReturnStatus.Completed)), rows.Count(r => IsClosed(r.Status)));

        IEnumerable<ReturnRowDto> query = rows;
        if (filter.Search?.Trim() is { Length: > 0 } search)
        {
            query = query.Where(r => Has(r.OrderNo, search) || Has(r.WorkerNo, search) || Has(r.Name, search) || Has(r.ProjectName, search) || Has(r.HousingName, search));
        }

        query = filter.Status switch
        {
            "preparing" => query.Where(r => IsPreparing(r.Status)),
            "approval" => query.Where(r => IsInApproval(r.Status)),
            "completed" => query.Where(r => r.Status == nameof(ReturnStatus.Completed)),
            "closed" => query.Where(r => IsClosed(r.Status)),
            _ => query,
        };
        query = filter.Source switch
        {
            "system" => query.Where(r => r.Source == nameof(DocumentSource.System)),
            "crm" => query.Where(r => r.Source == nameof(DocumentSource.Crm)),
            _ => query,
        };
        query = (filter.Sort, filter.Descending) switch
        {
            ("arrivedOn", false) => query.OrderBy(r => r.ArrivedOn),
            ("arrivedOn", true) => query.OrderByDescending(r => r.ArrivedOn),
            ("orderNo", false) => query.OrderBy(r => r.OrderNo, StringComparer.Ordinal),
            ("orderNo", true) => query.OrderByDescending(r => r.OrderNo, StringComparer.Ordinal),
            ("name", false) => query.OrderBy(r => r.Name, StringComparer.OrdinalIgnoreCase),
            ("name", true) => query.OrderByDescending(r => r.Name, StringComparer.OrdinalIgnoreCase),
            (_, false) => query.OrderBy(r => r.CreatedAt),
            _ => query.OrderByDescending(r => r.CreatedAt),
        };
        var list = query.ToList();
        var pageSize = Math.Clamp(filter.PageSize, 10, 200);
        return new ReturnListDto(list.Count, totals, list.Skip(Math.Max(0, filter.Page - 1) * pageSize).Take(pageSize).ToList());
    }

    public async Task<ReturnDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var o = await db.ReturnOrders.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (o is null)
        {
            return null;
        }

        var profession = o.ProfessionCode is { } pc
            ? (await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false)).FirstOrDefault(i => i.Code == pc)
            : null;
        var nationality = o.NationalityCode is { } nc
            ? (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false)).FirstOrDefault(i => i.Code == nc)
            : null;
        var approval = o.Source == DocumentSource.System
            ? await approvals.StatusAsync(ReturnOrderAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false)
            : null;
        var canCreate = (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(OperationsPermissions.ReturnCreate);
        return new ReturnDetailDto(
            Row(o), profession?.NameAr, profession?.NameEn, nationality?.NameAr, nationality?.NameEn, o.IqamaNo, o.ProjectId, o.WorkStartedOn,
            o.ReasonNotes, o.DelayReason, o.Notes, o.LastComment, o.CompletedAt, o.CompletedByName, approval, o.AwaitingApproval,
            CanEdit: canCreate && o.IsEditable,
            CanSubmit: canCreate && o.IsEditable && !o.AwaitingApproval,
            CanCancel: canCreate && o.IsEditable && !o.AwaitingApproval);
    }

    private static ReturnRowDto Row(ReturnOrder o) => new(
        o.Id, o.OrderNo, o.Source.ToString(), o.Status.ToString(), o.CrmStatus, o.Entry.ToString(), o.WorkerId, o.WorkerNo, o.Name, o.ProjectName,
        o.ArrivedOn, o.Reason, o.CustomerWish, o.StopSalary, o.HousingName, o.CreatedByName, o.CreatedAt);

    private static bool IsPreparing(string status) => status is nameof(ReturnStatus.UnderPreparation) or nameof(ReturnStatus.Returned);

    private static bool IsInApproval(string status) =>
        status is nameof(ReturnStatus.SentToSales) or nameof(ReturnStatus.SentToOperationsManager) or nameof(ReturnStatus.InApproval);

    private static bool IsClosed(string status) => status is nameof(ReturnStatus.Rejected) or nameof(ReturnStatus.Canceled);

    private static bool Has(string? value, string search) => value?.Contains(search, StringComparison.OrdinalIgnoreCase) == true;
}
