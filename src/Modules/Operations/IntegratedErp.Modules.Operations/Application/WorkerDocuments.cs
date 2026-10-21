using IntegratedErp.Modules.Operations.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>
/// A document a worker is on, for the worker's actions timeline to open: a period's source is matched to it by the
/// document's id (recorded here), the old system's work start number on a delivery line (<see cref="WorkStartNo"/>) or
/// the old system's housing order (<see cref="CrmId"/>).
/// </summary>
/// <param name="Type">delivery_order, return_order, transfer_order or worker_movement (as a period's source type).</param>
/// <param name="Reason">A return order's reason.</param>
public sealed record WorkerDocumentDto(
    string Type, Guid Id, string No, string Status, Guid? CrmId, string? WorkStartNo, string? Reason, string? CreatedByName, DateTimeOffset? CreatedAt);

/// <summary>The documents one worker is on, across the operations documents.</summary>
internal sealed class WorkerDocuments(OperationsDbContext db)
{
    public async Task<IReadOnlyList<WorkerDocumentDto>> ForAsync(Guid workerId, CancellationToken cancellationToken)
    {
        var delivery = await db.DeliveryLines.AsNoTracking().Where(l => l.WorkerId == workerId)
            .Join(db.DeliveryOrders.AsNoTracking(), l => l.OrderId, o => o.Id, (l, o) => new { o.Id, o.OrderNo, o.Status, o.CrmId, l.WorkStartNo, o.CreatedByName, o.CreatedAt })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var returns = await db.ReturnOrders.AsNoTracking().Where(o => o.WorkerId == workerId)
            .Select(o => new { o.Id, o.OrderNo, o.Status, o.CrmId, o.Reason, o.CreatedByName, o.CreatedAt })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var transfers = await db.TransferLines.AsNoTracking().Where(l => l.WorkerId == workerId)
            .Join(db.TransferOrders.AsNoTracking(), l => l.OrderId, o => o.Id, (l, o) => new { o.Id, o.OrderNo, o.Status, o.CreatedByName, o.CreatedAt })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var movements = await db.Movements.AsNoTracking().Where(m => m.WorkerId == workerId)
            .Select(m => new { m.Id, m.MovementNo, m.Status, m.CreatedByName, m.CreatedAt })
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        return delivery.Select(d => new WorkerDocumentDto(DeliveryOrderAdapter.SourceType, d.Id, d.OrderNo, d.Status.ToString(), d.CrmId, d.WorkStartNo, null, Name(d.CreatedByName), d.CreatedAt))
            .Concat(returns.Select(r => new WorkerDocumentDto(ReturnOrderAdapter.SourceType, r.Id, r.OrderNo, r.Status.ToString(), r.CrmId, null, r.Reason, Name(r.CreatedByName), r.CreatedAt)))
            .Concat(transfers.Select(t => new WorkerDocumentDto(TransferOrderAdapter.SourceType, t.Id, t.OrderNo, t.Status.ToString(), null, null, null, Name(t.CreatedByName), t.CreatedAt)))
            .Concat(movements.Select(m => new WorkerDocumentDto(MovementAdapter.SourceType, m.Id, m.MovementNo, m.Status.ToString(), null, null, null, Name(m.CreatedByName), m.CreatedAt)))
            .ToList();
    }

    private static string? Name(string? name) => string.IsNullOrWhiteSpace(name) ? null : name;
}
