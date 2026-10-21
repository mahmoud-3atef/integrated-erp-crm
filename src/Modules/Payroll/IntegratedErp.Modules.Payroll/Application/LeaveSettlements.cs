using IntegratedErp.Modules.Leave.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>A vacation settlement made from a leave request (not cancelled) holds the leave.</summary>
internal sealed class LeaveSettlements(PayrollDbContext db) : ILeaveUsage
{
    public async Task<string?> UsedByAsync(Guid leaveRequestId, CancellationToken cancellationToken) =>
        await db.Settlements.AsNoTracking()
            .Where(s => s.LeaveRequestId == leaveRequestId && s.Status != SettlementStatus.Cancelled)
            .Select(s => s.SettlementNo)
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
}
