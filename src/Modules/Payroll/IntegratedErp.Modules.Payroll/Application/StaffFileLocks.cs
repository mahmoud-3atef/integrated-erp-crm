using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>A staff payroll run in approval or approved that pays the employee on or after the day, or a settlement of theirs (not cancelled) up to it.</summary>
internal sealed class StaffFileLocks(PayrollDbContext db) : IStaffFileLocks
{
    public async Task<string?> LockedFromAsync(Guid employeeId, DateOnly day, CancellationToken cancellationToken)
    {
        var run = await (from l in db.StaffLines.AsNoTracking()
                         join r in db.StaffRuns.AsNoTracking() on l.RunId equals r.Id
                         where l.EmployeeId == employeeId && r.To >= day && (r.Status == PayrollStatus.Approved || r.Status == PayrollStatus.InApproval)
                         orderby r.To
                         select r.RunNo).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return run ?? await db.Settlements.AsNoTracking()
            .Where(s => s.Party == SettlementParty.Staff && s.PersonId == employeeId && s.LastDay >= day && s.Status != SettlementStatus.Cancelled)
            .Select(s => s.SettlementNo)
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
    }
}
