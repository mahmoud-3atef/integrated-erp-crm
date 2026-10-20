using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.Modules.Leave.Domain;
using IntegratedErp.Modules.Leave.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Leave.Application;

/// <summary>
/// The leave alerts: a leave ended and the return not confirmed after some days, and a leave starting soon that is still
/// in approval.
/// </summary>
internal sealed class LeaveAlerts(LeaveDbContext db) : IAlertProvider
{
    public const string ReturnNotConfirmed = "leave.return_not_confirmed";
    public const string StartingInApproval = "leave.starting_in_approval";

    private const string GroupAr = "الموارد البشرية";
    private const string GroupEn = "Human resources";

    public IReadOnlyList<AlertDefinition> Definitions { get; } =
    [
        new(ReturnNotConfirmed, GroupAr, GroupEn, "إجازة انتهت ولم تُؤكَّد العودة", "Leave ended with the return not confirmed",
            "أيام بعد نهاية الإجازة", "Days after the leave's end", 2, LeavePermissions.View, LeavePermissions.Manage),
        new(StartingInApproval, GroupAr, GroupEn, "إجازة تبدأ قريبًا وما زالت قيد الاعتماد", "Leave starting soon still in approval",
            "أيام قبل بداية الإجازة", "Days before the leave starts", 3, LeavePermissions.View, LeavePermissions.Manage),
    ];

    public async Task<IReadOnlyList<AlertItem>> AlertsAsync(AlertQuery query, IReadOnlySet<string> codes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(codes);
        var today = query.Today;
        var alerts = new List<AlertItem>();
        if (codes.Contains(ReturnNotConfirmed))
        {
            var before = today.AddDays(-query.DaysOf(Definitions[0]));
            var ended = await db.Requests.AsNoTracking().Where(r => r.Status == RequestStatus.Approved && r.ReturnedOn == null && r.To <= before)
                .Select(r => new { r.Id, r.RequestNo, r.EmployeeName, r.To }).ToListAsync(cancellationToken).ConfigureAwait(false);
            alerts.AddRange(ended.Select(r => new AlertItem(
                ReturnNotConfirmed, r.Id.ToString("N"), AlertSeverity.Warning,
                $"{r.EmployeeName}: لم تُؤكَّد العودة من الإجازة", $"{r.EmployeeName}: return from leave not confirmed",
                $"{r.RequestNo} · انتهت في {r.To:yyyy/MM/dd}.", $"{r.RequestNo} · ended on {r.To:yyyy-MM-dd}.",
                $"/hr/leave/{r.Id}", today)));
        }

        if (codes.Contains(StartingInApproval))
        {
            var until = today.AddDays(query.DaysOf(Definitions[1]));
            var soon = await db.Requests.AsNoTracking().Where(r => r.Status == RequestStatus.InApproval && r.From <= until)
                .Select(r => new { r.Id, r.RequestNo, r.EmployeeName, r.From }).ToListAsync(cancellationToken).ConfigureAwait(false);
            alerts.AddRange(soon.Select(r => new AlertItem(
                StartingInApproval, r.Id.ToString("N"), r.From <= today ? AlertSeverity.Critical : AlertSeverity.Warning,
                $"{r.EmployeeName}: إجازة تبدأ {r.From:yyyy/MM/dd} وما زالت قيد الاعتماد", $"{r.EmployeeName}: leave starting {r.From:yyyy-MM-dd} still in approval",
                r.RequestNo, r.RequestNo, $"/hr/leave/{r.Id}", today)));
        }

        return alerts;
    }
}
