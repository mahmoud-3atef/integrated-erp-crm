using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

public sealed record DeliveryRowDto(
    Guid Id,
    string OrderNo,
    string Source,
    string Status,
    int? CrmStatus,
    Guid? ProjectId,
    string ProjectName,
    string? CustomerName,
    string? ProjectManager,
    DateOnly? DeliverOn,
    DateOnly? StartOn,
    int Workers,
    decimal TotalPrice,
    int SpecialPrices,
    string ReceiverName,
    string CreatedByName,
    DateTimeOffset CreatedAt);

/// <summary>The list's cards: all orders, under preparation, with the operations manager, delivered, closed without delivery.</summary>
public sealed record DeliveryTotalsDto(int All, int UnderPreparation, int WithOperations, int Delivered, int Closed);

public sealed record DeliveryListDto(int Total, DeliveryTotalsDto Totals, IReadOnlyList<DeliveryRowDto> Items);

public sealed record DeliveryLineDto(
    Guid Id,
    int LineNo,
    Guid? WorkerId,
    string WorkerNo,
    string Name,
    string? ProfessionCode,
    string? ProfessionAr,
    string? ProfessionEn,
    string? NationalityCode,
    string? NationalityAr,
    string? NationalityEn,
    string? IqamaNo,
    Guid? PackageId,
    string? PackageNo,
    decimal Salary,
    decimal ServiceFee,
    decimal Housing,
    bool HousingBillable,
    decimal Transport,
    bool TransportBillable,
    decimal TotalPrice,
    bool IsSpecialPrice,
    string? SpecialReason,
    DateOnly? StartOn,
    DateOnly? StartedOn,
    string? WorkStartNo);

public sealed record DeliveryDetailDto(
    DeliveryRowDto Summary,
    string? ProjectCode,
    string? ContractType,
    string? ReceiverTitle,
    string? DelayReason,
    string? Notes,
    string? LastComment,
    DateTimeOffset? SubmittedAt,
    DateTimeOffset? DeliveredAt,
    string? DeliveredByName,
    IReadOnlyList<DeliveryLineDto> Lines,
    ApprovalStatusInfo? Approval,
    bool AwaitingApproval,
    bool CanEdit,
    bool CanSubmit,
    bool CanCancel);

public sealed record DeliveryListFilter(string? Search, string? Status, string? Source, string? Sort, bool Descending, int Page, int PageSize);

internal sealed class DeliveryOrderQueries(
    OperationsDbContext db,
    IReferenceData reference,
    IApprovalService approvals,
    IProjectDirectory projects,
    IPermissionService permissions)
{
    public async Task<DeliveryListDto> ListAsync(DeliveryListFilter filter, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        var rows = await RowsAsync(null, cancellationToken).ConfigureAwait(false);
        var totals = new DeliveryTotalsDto(
            rows.Count,
            rows.Count(r => IsPreparing(r.Status)),
            rows.Count(r => IsWithOperations(r.Status)),
            rows.Count(r => r.Status == nameof(DeliveryStatus.Delivered)),
            rows.Count(r => IsClosed(r.Status)));

        IEnumerable<DeliveryRowDto> query = rows;
        if (filter.Search?.Trim() is { Length: > 0 } search)
        {
            query = query.Where(r => Has(r.OrderNo, search) || Has(r.ProjectName, search) || Has(r.CustomerName, search) || Has(r.ReceiverName, search) || Has(r.ProjectManager, search));
        }

        query = filter.Status switch
        {
            "preparing" => query.Where(r => IsPreparing(r.Status)),
            "operations" => query.Where(r => IsWithOperations(r.Status)),
            "delivered" => query.Where(r => r.Status == nameof(DeliveryStatus.Delivered)),
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
            ("deliverOn", false) => query.OrderBy(r => r.DeliverOn),
            ("deliverOn", true) => query.OrderByDescending(r => r.DeliverOn),
            ("startOn", false) => query.OrderBy(r => r.StartOn),
            ("startOn", true) => query.OrderByDescending(r => r.StartOn),
            ("workers", false) => query.OrderBy(r => r.Workers),
            ("workers", true) => query.OrderByDescending(r => r.Workers),
            ("orderNo", false) => query.OrderBy(r => r.OrderNo, StringComparer.Ordinal),
            ("orderNo", true) => query.OrderByDescending(r => r.OrderNo, StringComparer.Ordinal),
            (_, false) => query.OrderBy(r => r.CreatedAt),
            _ => query.OrderByDescending(r => r.CreatedAt),
        };
        var list = query.ToList();
        var pageSize = Math.Clamp(filter.PageSize, 10, 200);
        return new DeliveryListDto(list.Count, totals, list.Skip(Math.Max(0, filter.Page - 1) * pageSize).Take(pageSize).ToList());
    }

    public async Task<DeliveryDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.DeliveryOrders.AsNoTracking().Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return null;
        }

        var row = (await RowsAsync(id, cancellationToken).ConfigureAwait(false)).Single();
        var professions = (await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal);
        var nationalities = (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal);
        var lines = order.Lines.OrderBy(l => l.LineNo).Select(l =>
            {
                var profession = l.ProfessionCode is { } pc ? professions.GetValueOrDefault(pc) : null;
                var nationality = l.NationalityCode is { } nc ? nationalities.GetValueOrDefault(nc) : null;
                return new DeliveryLineDto(
                    l.Id, l.LineNo, l.WorkerId, l.WorkerNo, l.Name, l.ProfessionCode, profession?.NameAr, profession?.NameEn,
                    l.NationalityCode, nationality?.NameAr, nationality?.NameEn, l.IqamaNo, l.PackageId, l.PackageNo,
                    l.Salary, l.ServiceFee, l.Housing, l.HousingBillable, l.Transport, l.TransportBillable, l.TotalPrice,
                    l.IsSpecialPrice, l.SpecialReason, l.StartOn, l.StartedOn, l.WorkStartNo);
            })
            .ToList();
        var approval = order.Source == DocumentSource.System
            ? await approvals.StatusAsync(DeliveryOrderAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false)
            : null;
        var granted = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        var canCreate = granted.Has(OperationsPermissions.DeliveryCreate);
        var system = order.Source == DocumentSource.System;
        return new DeliveryDetailDto(
            row, order.ProjectCode, order.ContractType, order.ReceiverTitle, order.DelayReason, order.Notes, order.LastComment,
            order.SubmittedAt, order.DeliveredAt, order.DeliveredByName, lines, approval,
            AwaitingApproval: order.AwaitingApproval,
            CanEdit: canCreate && order.IsEditable,
            CanSubmit: canCreate && order.IsEditable && !order.AwaitingApproval && lines.Count > 0,
            CanCancel: canCreate && system && order.IsEditable && !order.AwaitingApproval);
    }

    /// <summary>The projects an order can be for.</summary>
    public Task<IReadOnlyList<ProjectInfo>> ProjectsAsync(CancellationToken cancellationToken) => projects.ActiveAsync(cancellationToken);

    private async Task<List<DeliveryRowDto>> RowsAsync(Guid? only, CancellationToken cancellationToken)
    {
        var rows = await db.DeliveryOrders.AsNoTracking()
            .Where(o => only == null || o.Id == only)
            .Select(o => new
            {
                o.Id, o.OrderNo, o.Source, o.Status, o.CrmStatus, o.ProjectId, o.ProjectName, o.CustomerName, o.ProjectManager,
                o.DeliverOn, o.StartOn, o.ReceiverName, o.CreatedByName, o.CreatedAt,
                Workers = o.Lines.Count,
                Total = o.Lines.Sum(l => (decimal?)l.TotalPrice) ?? 0,
                Specials = o.Lines.Count(l => l.IsSpecialPrice),
            })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.Select(o => new DeliveryRowDto(
                o.Id, o.OrderNo, o.Source.ToString(), o.Status.ToString(), o.CrmStatus, o.ProjectId, o.ProjectName, o.CustomerName, o.ProjectManager,
                o.DeliverOn, o.StartOn, o.Workers, o.Total, o.Specials, o.ReceiverName, o.CreatedByName, o.CreatedAt))
            .ToList();
    }

    private static bool IsPreparing(string status) => status is nameof(DeliveryStatus.UnderPreparation) or nameof(DeliveryStatus.Returned);

    private static bool IsWithOperations(string status) => status is nameof(DeliveryStatus.SentToOperationsManager) or nameof(DeliveryStatus.InApproval);

    private static bool IsClosed(string status) =>
        status is nameof(DeliveryStatus.Rejected) or nameof(DeliveryStatus.Canceled) or nameof(DeliveryStatus.NotDelivered);

    private static bool Has(string? value, string search) => value?.Contains(search, StringComparison.OrdinalIgnoreCase) == true;
}
