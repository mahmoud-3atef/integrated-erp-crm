using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>A timesheet in approval or approved that has the worker on or after the day: their periods there are billed.</summary>
internal sealed class TimesheetPeriodLocks(BillingDbContext db) : IWorkerPeriodLocks
{
    public async Task<string?> LockedFromAsync(Guid workerId, Guid sourceId, DateOnly day, CancellationToken cancellationToken) =>
        await (from l in db.TimesheetLines.AsNoTracking()
               join t in db.Timesheets.AsNoTracking() on l.TimesheetId equals t.Id
               where l.WorkerId == workerId && t.To >= day && (t.Status == TimesheetStatus.InApproval || t.Status == TimesheetStatus.Approved)
               orderby t.To
               select t.TimesheetNo).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
}
