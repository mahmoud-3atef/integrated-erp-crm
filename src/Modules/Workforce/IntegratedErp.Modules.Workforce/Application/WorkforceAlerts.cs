using System.Globalization;
using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

/// <summary>
/// The workforce's alerts: a working worker's iqama that expires within the threshold (or has expired) —
/// docs/02-target-architecture/12 §6. Workers out of service (in the old system or here) and inactive ones are left out.
/// </summary>
internal sealed class WorkforceAlerts(WorkforceDbContext db) : IAlertProvider
{
    public const string IqamaExpiring = "workforce.iqama_expiring";

    public IReadOnlyList<AlertDefinition> Definitions { get; } =
    [
        new(IqamaExpiring, "شؤون العمالة", "Workers", "إقامة قاربت على الانتهاء أو انتهت", "Iqama expiring or expired",
            "التنبيه قبل الانتهاء بعدد أيام", "Days before the expiry", 60,
            WorkforcePermissions.WorkersView, WorkforcePermissions.WorkersView),
    ];

    public async Task<IReadOnlyList<AlertItem>> AlertsAsync(AlertQuery query, IReadOnlySet<string> codes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(codes);
        if (!codes.Contains(IqamaExpiring))
        {
            return [];
        }

        var until = query.Today.AddDays(query.DaysOf(Definitions[0]));
        var outHere = db.Periods.Where(p => p.EndsOn == null && p.Kind == PeriodKind.Out).Select(p => p.WorkerId);
        var rows = await db.Workers.AsNoTracking()
            .Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm && w.Lifecycle == Lifecycle.Active
                        && w.Placement != Placement.Exited && w.Placement != Placement.Inactive && !outHere.Contains(w.Id))
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { w.Id, w.WorkerNo, p.NameEn, PersonId = p.Id })
            .Join(db.Identifiers.Where(i => i.Type == IdentifierType.Iqama && i.IsCurrent && i.ExpiresOn != null && i.ExpiresOn <= until),
                x => x.PersonId, i => i.PersonId, (x, i) => new { x.Id, x.WorkerNo, x.NameEn, i.Number, ExpiresOn = i.ExpiresOn!.Value })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.Select(r =>
            {
                var days = r.ExpiresOn.DayNumber - query.Today.DayNumber;
                var on = r.ExpiresOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                var expired = days < 0;
                return new AlertItem(
                    IqamaExpiring, $"{r.Id:N}:{on}", expired ? AlertSeverity.Critical : days <= 15 ? AlertSeverity.Warning : AlertSeverity.Info,
                    $"إقامة {r.NameEn} ({r.WorkerNo}) {(expired ? "منتهية" : "تنتهي قريبًا")}",
                    $"{r.NameEn}'s iqama ({r.WorkerNo}) {(expired ? "has expired" : "expires soon")}",
                    expired ? $"الإقامة {r.Number} انتهت في {on} منذ {ArabicCount.Days(-days)}." : $"الإقامة {r.Number} تنتهي في {on} بعد {ArabicCount.Days(days)}.",
                    expired ? $"Iqama {r.Number} expired on {on}, {-days} days ago." : $"Iqama {r.Number} expires on {on}, in {days} days.",
                    $"/workforce/workers/{r.Id}", r.ExpiresOn);
            })
            .OrderBy(a => a.Since)
            .ToList();
    }
}
