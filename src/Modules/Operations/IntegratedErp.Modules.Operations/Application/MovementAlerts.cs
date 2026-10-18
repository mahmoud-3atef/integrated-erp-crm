using System.Globalization;
using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>
/// Operations' alerts: a worker whose vacation should have ended (its expected return passed by more than the grace
/// days) and who has no movement since — to record the return, or report the absconding (docs/02-target-architecture/05 §2.7).
/// </summary>
internal sealed class MovementAlerts(OperationsDbContext db) : IAlertProvider
{
    public const string VacationOverdue = "operations.vacation_overdue";

    public IReadOnlyList<AlertDefinition> Definitions { get; } =
    [
        new(VacationOverdue, "العمليات", "Operations", "عامل لم يعد من الإجازة", "Worker not back from vacation",
            "أيام السماح بعد تاريخ العودة المتوقع", "Grace days after the expected return", 3,
            OperationsPermissions.MovementsView, OperationsPermissions.MovementsManage),
    ];

    public async Task<IReadOnlyList<AlertItem>> AlertsAsync(AlertQuery query, IReadOnlySet<string> codes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(codes);
        if (!codes.Contains(VacationOverdue))
        {
            return [];
        }

        var limit = query.Today.AddDays(-query.DaysOf(Definitions[0]));
        var departures = await db.Movements.AsNoTracking()
            .Where(m => m.Type == MovementType.VacationDeparture && m.Status == MovementStatus.Executed && m.ExpectedReturnOn != null && m.ExpectedReturnOn < limit)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        // Still away: nothing executed for the worker after the departure.
        var workers = departures.Select(d => d.WorkerId).Distinct().ToList();
        var later = await db.Movements.AsNoTracking()
            .Where(m => workers.Contains(m.WorkerId) && m.Status == MovementStatus.Executed && m.Type != MovementType.VacationDeparture)
            .Select(m => new { m.WorkerId, m.EffectiveOn })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return departures
            .Where(d => !later.Any(l => l.WorkerId == d.WorkerId && l.EffectiveOn > d.EffectiveOn))
            .GroupBy(d => d.WorkerId).Select(g => g.OrderByDescending(d => d.EffectiveOn).First())
            .Select(d =>
            {
                var late = query.Today.DayNumber - d.ExpectedReturnOn!.Value.DayNumber;
                var expected = d.ExpectedReturnOn.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                return new AlertItem(
                    VacationOverdue, $"{d.WorkerId:N}:{d.Id:N}", late > 14 ? AlertSeverity.Critical : AlertSeverity.Warning,
                    $"{d.WorkerName} ({d.WorkerNo}) لم يعد من الإجازة", $"{d.WorkerName} ({d.WorkerNo}) is not back from vacation",
                    $"كانت عودته متوقعة في {expected} — متأخر {ArabicCount.Days(late)}. سجّل العودة أو بلاغ الانقطاع.",
                    $"Expected back on {expected} — {late} days late. Record the return or an absconding report.",
                    $"/operations/movements/new?worker={d.WorkerId}", d.ExpectedReturnOn.Value);
            })
            .ToList();
    }
}
