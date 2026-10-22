using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>
/// A worker payroll run in approval or approved that pays the worker on or after the day, or a settlement of theirs not
/// cancelled — made from the document (a vacation departure) or up to the day.
/// </summary>
internal sealed class WorkerPeriodLocks(PayrollDbContext db) : IWorkerPeriodLocks
{
    public async Task<string?> LockedFromAsync(Guid workerId, Guid sourceId, DateOnly day, CancellationToken cancellationToken)
    {
        var run = await (from l in db.Lines.AsNoTracking()
                         join r in db.Runs.AsNoTracking() on l.RunId equals r.Id
                         where l.WorkerId == workerId && r.To >= day && (r.Status == PayrollStatus.Approved || r.Status == PayrollStatus.InApproval)
                         orderby r.To
                         select r.RunNo).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return run ?? await db.Settlements.AsNoTracking()
            .Where(s => s.Party == SettlementParty.Worker && s.PersonId == workerId && s.Status != SettlementStatus.Cancelled && (s.LeaveRequestId == sourceId || s.LastDay >= day))
            .Select(s => s.SettlementNo)
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
    }
}
