using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.Modules.Attendance.Contracts;
using IntegratedErp.Modules.Attendance.Domain;
using IntegratedErp.Modules.Attendance.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Attendance.Application;

/// <summary>The closed months' frozen figures, for the staff payroll.</summary>
internal sealed class AttendanceMonths(AttendanceDbContext db) : IAttendanceMonths
{
    public async Task<ClosedAttendanceMonth?> ClosedAsync(string period, CancellationToken cancellationToken)
    {
        var month = await db.Months.AsNoTracking().Include(m => m.Lines).FirstOrDefaultAsync(m => m.Period == period && m.Status == MonthStatus.Closed, cancellationToken).ConfigureAwait(false);
        return month is null
            ? null
            : new ClosedAttendanceMonth(
                month.Period, month.From, month.To, month.ClosedAt ?? DateTimeOffset.MinValue,
                month.Lines.Select(l => new ClosedAttendanceLine(l.EmployeeId, l.EmployeeNo, l.LegalEntityId, l.WorkDays, l.Present, l.Absent, l.Leave, l.LateMinutes, l.EarlyMinutes, l.DeductionDays, l.OvertimeMinutes)).ToList());
    }
}

/// <summary>The attendance alerts: a month ended some days ago and still not closed (the staff payroll waits for it).</summary>
internal sealed class AttendanceAlerts(AttendanceDbContext db) : IAlertProvider
{
    public const string MonthNotClosed = "attendance.month_not_closed";

    public IReadOnlyList<AlertDefinition> Definitions { get; } =
    [
        new(MonthNotClosed, "الموارد البشرية", "Human resources", "شهر حضور انتهى ولم يُقفل", "Attendance month ended and not closed",
            "أيام بعد نهاية الشهر", "Days after the month's end", 5, AttendancePermissions.View, AttendancePermissions.Manage),
    ];

    public async Task<IReadOnlyList<AlertItem>> AlertsAsync(AlertQuery query, IReadOnlySet<string> codes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(codes);
        if (!codes.Contains(MonthNotClosed))
        {
            return [];
        }

        var setting = await db.Settings.AsNoTracking().FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (setting is null || !await db.Imports.AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            return [];
        }

        var today = query.Today;
        var grace = query.DaysOf(Definitions[0]);
        var alerts = new List<AlertItem>();

        // The last two months that ended at least the given days ago (and after the first import).
        var firstImport = await db.Imports.AsNoTracking().MinAsync(i => i.From, cancellationToken).ConfigureAwait(false);
        var months = await db.Months.AsNoTracking().ToDictionaryAsync(m => m.Period, cancellationToken).ConfigureAwait(false);
        for (var back = 1; back <= 2; back++)
        {
            var d = today.AddMonths(-back);
            var (from, to) = setting.Period(d.Year, d.Month);
            if (to.AddDays(grace) > today || to < firstImport)
            {
                continue;
            }

            var period = $"{d.Year:D4}-{d.Month:D2}";
            if (months.TryGetValue(period, out var m) && m.Status == MonthStatus.Closed)
            {
                continue;
            }

            var sent = m?.Status == MonthStatus.InApproval;
            alerts.Add(new AlertItem(
                MonthNotClosed, period, today.DayNumber - to.DayNumber > grace * 2 ? AlertSeverity.Critical : AlertSeverity.Warning,
                $"حضور {period} لم يُقفل بعد", $"Attendance {period} not closed yet",
                sent ? "الشهر قيد الاعتماد." : $"انتهى الشهر في {to:yyyy/MM/dd} ولم يُرسل للإقفال.",
                sent ? "The month is in approval." : $"The month ended on {to:yyyy-MM-dd} and was not sent for closing.",
                $"/hr/attendance?period={period}", today));
        }

        return alerts;
    }
}
