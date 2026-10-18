using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

public sealed record TransferRowDto(
    Guid Id,
    string OrderNo,
    string Status,
    Guid ProjectId,
    string ProjectName,
    string? CustomerName,
    string? FromProjects,
    DateOnly TransferOn,
    int Workers,
    decimal TotalPrice,
    int SpecialPrices,
    string CreatedByName,
    DateTimeOffset CreatedAt);

/// <summary>The list's cards: all orders, under preparation, with the operations manager, transferred, closed without transfer.</summary>
public sealed record TransferTotalsDto(int All, int UnderPreparation, int WithOperations, int Transferred, int Closed);

public sealed record TransferListDto(int Total, TransferTotalsDto Totals, IReadOnlyList<TransferRowDto> Items);

public sealed record TransferLineDto(
    Guid Id,
    int LineNo,
    Guid WorkerId,
    string WorkerNo,
    string Name,
    string? ProfessionCode,
    string? ProfessionAr,
    string? ProfessionEn,
    string? NationalityCode,
    string? NationalityAr,
    string? NationalityEn,
    string? IqamaNo,
    Guid? FromProjectId,
    string? FromProjectName,
    DateOnly? FromStartedOn,
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
    decimal? FromTotalPrice = null);

public sealed record TransferDetailDto(
    TransferRowDto Summary,
    string ProjectCode,
    string? ContractType,
    string? ProjectManager,
    string? ReceiverName,
    string? ReceiverTitle,
    string? DelayReason,
    string? Notes,
    string? LastComment,
    DateTimeOffset? SubmittedAt,
    DateTimeOffset? TransferredAt,
    string? TransferredByName,
    IReadOnlyList<TransferLineDto> Lines,
    ApprovalStatusInfo? Approval,
    bool AwaitingApproval,
    bool CanEdit,
    bool CanSubmit,
    bool CanCancel);

internal sealed class TransferOrderQueries(OperationsDbContext db, IReferenceData reference, IApprovalService approvals, IPermissionService permissions, IPeriodLedger ledger)
{
    public async Task<TransferListDto> ListAsync(DeliveryListFilter filter, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        var rows = await RowsAsync(null, cancellationToken).ConfigureAwait(false);
        var totals = new TransferTotalsDto(
            rows.Count,
            rows.Count(r => IsPreparing(r.Status)),
            rows.Count(r => IsWithOperations(r.Status)),
            rows.Count(r => r.Status == nameof(TransferStatus.Transferred)),
            rows.Count(r => IsClosed(r.Status)));

        IEnumerable<TransferRowDto> query = rows;
        if (filter.Search?.Trim() is { Length: > 0 } search)
        {
            query = query.Where(r => Has(r.OrderNo, search) || Has(r.ProjectName, search) || Has(r.CustomerName, search) || Has(r.FromProjects, search));
        }

        query = filter.Status switch
        {
            "preparing" => query.Where(r => IsPreparing(r.Status)),
            "operations" => query.Where(r => IsWithOperations(r.Status)),
            "transferred" => query.Where(r => r.Status == nameof(TransferStatus.Transferred)),
            "closed" => query.Where(r => IsClosed(r.Status)),
            _ => query,
        };
        query = (filter.Sort, filter.Descending) switch
        {
            ("transferOn", false) => query.OrderBy(r => r.TransferOn),
            ("transferOn", true) => query.OrderByDescending(r => r.TransferOn),
            ("workers", false) => query.OrderBy(r => r.Workers),
            ("workers", true) => query.OrderByDescending(r => r.Workers),
            ("orderNo", false) => query.OrderBy(r => r.OrderNo, StringComparer.Ordinal),
            ("orderNo", true) => query.OrderByDescending(r => r.OrderNo, StringComparer.Ordinal),
            (_, false) => query.OrderBy(r => r.CreatedAt),
            _ => query.OrderByDescending(r => r.CreatedAt),
        };
        var list = query.ToList();
        var pageSize = Math.Clamp(filter.PageSize, 10, 200);
        return new TransferListDto(list.Count, totals, list.Skip(Math.Max(0, filter.Page - 1) * pageSize).Take(pageSize).ToList());
    }

    public async Task<TransferDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.TransferOrders.AsNoTracking().Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return null;
        }

        var row = (await RowsAsync(id, cancellationToken).ConfigureAwait(false)).Single();
        var professions = (await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal);
        var nationalities = (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal);
        // What each worker cost on the project they leave: the work period there that the transfer closes (or will).
        var fromPrices = new Dictionary<Guid, decimal?>();
        foreach (var l in order.Lines)
        {
            var periods = await ledger.PeriodsAsync(l.WorkerId, cancellationToken).ConfigureAwait(false);
            fromPrices[l.Id] = periods
                .Where(p => p.Kind == "Work" && p.ProjectId == l.FromProjectId && p.StartsOn < order.TransferOn)
                .OrderByDescending(p => p.StartsOn)
                .Select(p => p.TotalPrice)
                .FirstOrDefault();
        }

        var lines = order.Lines.OrderBy(l => l.LineNo).Select(l =>
            {
                var profession = l.ProfessionCode is { } pc ? professions.GetValueOrDefault(pc) : null;
                var nationality = l.NationalityCode is { } nc ? nationalities.GetValueOrDefault(nc) : null;
                return new TransferLineDto(
                    l.Id, l.LineNo, l.WorkerId, l.WorkerNo, l.Name, l.ProfessionCode, profession?.NameAr, profession?.NameEn,
                    l.NationalityCode, nationality?.NameAr, nationality?.NameEn, l.IqamaNo, l.FromProjectId, l.FromProjectName, l.FromStartedOn,
                    l.PackageId, l.PackageNo, l.Salary, l.ServiceFee, l.Housing, l.HousingBillable, l.Transport, l.TransportBillable, l.TotalPrice,
                    l.IsSpecialPrice, l.SpecialReason, fromPrices.GetValueOrDefault(l.Id));
            })
            .ToList();
        var approval = await approvals.StatusAsync(TransferOrderAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        var canCreate = (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(OperationsPermissions.TransferCreate);
        return new TransferDetailDto(
            row, order.ProjectCode, order.ContractType, order.ProjectManager, order.ReceiverName, order.ReceiverTitle, order.DelayReason, order.Notes,
            order.LastComment, order.SubmittedAt, order.TransferredAt, order.TransferredByName, lines, approval,
            AwaitingApproval: order.AwaitingApproval,
            CanEdit: canCreate && order.IsEditable,
            CanSubmit: canCreate && order.IsEditable && !order.AwaitingApproval && lines.Count > 0,
            CanCancel: canCreate && order.IsEditable && !order.AwaitingApproval);
    }

    private async Task<List<TransferRowDto>> RowsAsync(Guid? only, CancellationToken cancellationToken)
    {
        var orders = await db.TransferOrders.AsNoTracking()
            .Where(o => only == null || o.Id == only)
            .Select(o => new
            {
                o.Id, o.OrderNo, o.Status, o.ProjectId, o.ProjectName, o.CustomerName, o.TransferOn, o.CreatedByName, o.CreatedAt,
                Workers = o.Lines.Count,
                Total = o.Lines.Sum(l => (decimal?)l.TotalPrice) ?? 0,
                Specials = o.Lines.Count(l => l.IsSpecialPrice),
            })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var ids = orders.Select(o => o.Id).ToList();
        var from = (await db.TransferLines.AsNoTracking().Where(l => ids.Contains(l.OrderId)).Select(l => new { l.OrderId, l.FromProjectName })
                .ToListAsync(cancellationToken).ConfigureAwait(false))
            .ToLookup(l => l.OrderId, l => l.FromProjectName);
        return orders.Select(o => new TransferRowDto(
                o.Id, o.OrderNo, o.Status.ToString(), o.ProjectId, o.ProjectName, o.CustomerName,
                from[o.Id].OfType<string>().Distinct().ToList() is { Count: > 0 } names ? string.Join("، ", names) : null,
                o.TransferOn, o.Workers, o.Total, o.Specials, o.CreatedByName, o.CreatedAt))
            .ToList();
    }

    private static bool IsPreparing(string status) => status is nameof(TransferStatus.UnderPreparation) or nameof(TransferStatus.Returned);

    private static bool IsWithOperations(string status) => status is nameof(TransferStatus.SentToOperationsManager) or nameof(TransferStatus.InApproval);

    private static bool IsClosed(string status) => status is nameof(TransferStatus.Rejected) or nameof(TransferStatus.Canceled);

    private static bool Has(string? value, string search) => value?.Contains(search, StringComparison.OrdinalIgnoreCase) == true;
}
