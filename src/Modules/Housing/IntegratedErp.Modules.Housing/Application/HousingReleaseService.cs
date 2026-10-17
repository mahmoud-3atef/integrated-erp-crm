using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.Housing.Infrastructure;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Housing.Application;

/// <summary>
/// After every sync: frees the rooms of workers no longer in housing (delivered or moved in the old system, on
/// vacation, exited…). A worker who went to work leaves their room on the day they started; anyone else, today.
/// </summary>
internal sealed class HousingReleaseService(HousingDbContext db, IWorkforceDirectory workforce, IClock clock) : ICrmStagingConsumer
{
    public string Name => "housing rooms";

    public async Task<string> ApplyAsync(CancellationToken cancellationToken)
    {
        var open = await db.Assignments.Where(a => a.EndsOn == null).ToListAsync(cancellationToken).ConfigureAwait(false);
        if (open.Count == 0)
        {
            return "no rooms in use";
        }

        var cards = (await workforce.CardsAsync(open.Select(a => a.WorkerId).Distinct().ToList(), cancellationToken).ConfigureAwait(false)).ToDictionary(c => c.Id);
        var released = 0;
        foreach (var assignment in open)
        {
            if (cards.TryGetValue(assignment.WorkerId, out var card) && card.Available)
            {
                continue;
            }

            assignment.Close(card is { OnJob: true, ProjectJoinedOn: { } started } ? started : clock.Today);
            released++;
        }

        if (released > 0)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return $"{open.Count - released} workers in rooms, {released} left housing";
    }
}
