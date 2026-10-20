using IntegratedErp.Modules.Operations.Contracts;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>The approved housing orders of a period (returns, new arrivals, back from vacation), for the reports.</summary>
internal sealed class HousingEntries(OperationsDbContext db) : IHousingEntries
{
    public async Task<IReadOnlyList<HousingEntryFact>> InAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken) =>
        await db.ReturnOrders.AsNoTracking()
            .Where(o => o.Status == ReturnStatus.Completed && o.ArrivedOn != null && o.ArrivedOn >= from && o.ArrivedOn <= to)
            .OrderBy(o => o.ArrivedOn)
            .Select(o => new HousingEntryFact(o.WorkerId, o.WorkerNo, o.Name, o.ArrivedOn!.Value, o.Entry.ToString(), o.Reason, o.ProjectCrmId, o.ProjectName, o.HousingName))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
}
