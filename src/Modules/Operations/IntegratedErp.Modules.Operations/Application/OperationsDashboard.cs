using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>The open documents of one kind: being prepared, and waiting in approval.</summary>
public sealed record OpenDocumentsDto(int Preparing, int InApproval);

/// <summary>A document of this system, for the dashboard's latest activity.</summary>
public sealed record RecentDocumentDto(string Kind, Guid Id, string OrderNo, string Title, string Status, int Workers, string CreatedByName, DateTimeOffset CreatedAt);

/// <summary>The operations part of the dashboard: open documents, this month's movements, and the latest documents.</summary>
public sealed record OperationsDashboardDto(
    OpenDocumentsDto Deliveries,
    OpenDocumentsDto Returns,
    OpenDocumentsDto Transfers,
    int DeliveredThisMonth,
    int ReturnedThisMonth,
    int TransferredThisMonth,
    IReadOnlyList<RecentDocumentDto> Recent);

/// <summary>
/// The movement documents in numbers: what waits (being prepared or in approval), the workers delivered, returned and
/// transferred this month (both systems), and the latest documents written here.
/// </summary>
internal sealed class OperationsDashboard(OperationsDbContext db, IClock clock)
{
    private static readonly DeliveryStatus[] DeliveryPreparing = [DeliveryStatus.UnderPreparation, DeliveryStatus.Returned];
    private static readonly DeliveryStatus[] DeliveryApproving = [DeliveryStatus.SentToOperationsManager, DeliveryStatus.InApproval];
    private static readonly ReturnStatus[] ReturnPreparing = [ReturnStatus.UnderPreparation, ReturnStatus.Returned];
    private static readonly ReturnStatus[] ReturnApproving = [ReturnStatus.SentToSales, ReturnStatus.SentToOperationsManager, ReturnStatus.InApproval];
    private static readonly TransferStatus[] TransferPreparing = [TransferStatus.UnderPreparation, TransferStatus.Returned];
    private static readonly TransferStatus[] TransferApproving = [TransferStatus.SentToOperationsManager, TransferStatus.InApproval];

    public async Task<OperationsDashboardDto> GetAsync(CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var month = new DateOnly(today.Year, today.Month, 1);
        var next = month.AddMonths(1);

        var deliveries = new OpenDocumentsDto(
            await db.DeliveryOrders.CountAsync(o => o.Source == DocumentSource.System && DeliveryPreparing.Contains(o.Status), cancellationToken).ConfigureAwait(false),
            await db.DeliveryOrders.CountAsync(o => o.Source == DocumentSource.System && DeliveryApproving.Contains(o.Status), cancellationToken).ConfigureAwait(false));
        var returns = new OpenDocumentsDto(
            await db.ReturnOrders.CountAsync(o => o.Source == DocumentSource.System && ReturnPreparing.Contains(o.Status), cancellationToken).ConfigureAwait(false),
            await db.ReturnOrders.CountAsync(o => o.Source == DocumentSource.System && ReturnApproving.Contains(o.Status), cancellationToken).ConfigureAwait(false));
        var transfers = new OpenDocumentsDto(
            await db.TransferOrders.CountAsync(o => TransferPreparing.Contains(o.Status), cancellationToken).ConfigureAwait(false),
            await db.TransferOrders.CountAsync(o => TransferApproving.Contains(o.Status), cancellationToken).ConfigureAwait(false));

        // This month, in both systems: a line's confirmed start (the order's start on the old system's orders).
        var delivered = await db.DeliveryLines.AsNoTracking()
            .Join(db.DeliveryOrders.AsNoTracking().Where(o => o.Status == DeliveryStatus.Delivered), l => l.OrderId, o => o.Id, (l, o) => l.StartedOn ?? l.StartOn ?? o.StartOn)
            .CountAsync(d => d >= month && d < next, cancellationToken).ConfigureAwait(false);
        var returned = await db.ReturnOrders.AsNoTracking()
            .CountAsync(o => o.Status == ReturnStatus.Completed && o.Entry == HousingEntry.ReturnedWorker && o.ArrivedOn >= month && o.ArrivedOn < next, cancellationToken).ConfigureAwait(false);
        var transferred = await db.TransferLines.AsNoTracking()
            .Join(db.TransferOrders.AsNoTracking().Where(o => o.Status == TransferStatus.Transferred && o.TransferOn >= month && o.TransferOn < next), l => l.OrderId, o => o.Id, (l, o) => l.Id)
            .CountAsync(cancellationToken).ConfigureAwait(false);

        var recent = new List<RecentDocumentDto>();
        recent.AddRange(await db.DeliveryOrders.AsNoTracking().Where(o => o.Source == DocumentSource.System).OrderByDescending(o => o.CreatedAt).Take(8)
            .Select(o => new RecentDocumentDto("delivery", o.Id, o.OrderNo, o.ProjectName, o.Status.ToString(), o.Lines.Count, o.CreatedByName, o.CreatedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false));
        recent.AddRange(await db.ReturnOrders.AsNoTracking().Where(o => o.Source == DocumentSource.System).OrderByDescending(o => o.CreatedAt).Take(8)
            .Select(o => new RecentDocumentDto("return", o.Id, o.OrderNo, o.Name, o.Status.ToString(), 1, o.CreatedByName, o.CreatedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false));
        recent.AddRange(await db.TransferOrders.AsNoTracking().OrderByDescending(o => o.CreatedAt).Take(8)
            .Select(o => new RecentDocumentDto("transfer", o.Id, o.OrderNo, o.ProjectName, o.Status.ToString(), o.Lines.Count, o.CreatedByName, o.CreatedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false));

        return new OperationsDashboardDto(deliveries, returns, transfers, delivered, returned, transferred,
            recent.OrderByDescending(r => r.CreatedAt).Take(8).ToList());
    }
}
