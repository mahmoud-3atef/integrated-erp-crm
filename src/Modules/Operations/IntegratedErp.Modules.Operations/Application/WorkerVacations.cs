using IntegratedErp.Modules.Operations.Contracts;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>The executed vacation departures with their expected return (the workers' leave requests).</summary>
internal sealed class WorkerVacations(OperationsDbContext db) : IWorkerVacations
{
    public async Task<IReadOnlyList<WorkerVacation>> ApprovedAsync(DateOnly from, Guid? workerId, CancellationToken cancellationToken) =>
        await db.Movements.AsNoTracking()
            .Where(m => m.Type == MovementType.VacationDeparture && m.Status == MovementStatus.Executed && m.EffectiveOn >= from && m.ExpectedReturnOn != null
                && (workerId == null || m.WorkerId == workerId))
            .OrderBy(m => m.EffectiveOn)
            .Select(m => new WorkerVacation(m.Id, m.MovementNo, m.WorkerId, m.WorkerNo, m.WorkerName, m.EffectiveOn, m.ExpectedReturnOn!.Value, m.VacationKind == VacationKind.Client))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
}
