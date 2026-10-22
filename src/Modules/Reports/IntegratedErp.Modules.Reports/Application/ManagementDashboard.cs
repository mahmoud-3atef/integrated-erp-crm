using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Operations.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;

namespace IntegratedErp.Modules.Reports.Application;

/// <param name="Status"><c>Working</c> (still on the project), <c>Ended</c>, or <c>NotStarted</c> (a start after today).</param>
/// <param name="Days">The days on the project to its end or to today (0 before it starts: the old page showed them negative).</param>
/// <param name="Price">The monthly service price of the work period (null when the period is not found).</param>
public sealed record StartRowDto(string WorkerNo, string Name, Guid? ProjectCrmId, string? Project, string? Manager, decimal? Price, DateOnly StartsOn, DateOnly? EndsOn, string Status, int Days);

public sealed record DeliveryDto(int Total, IReadOnlyList<RankDto> ByManager, IReadOnlyList<RankDto> ByProject, IReadOnlyList<StartRowDto> Rows);

/// <param name="Entry">ReturnedWorker, NewArrival or BackFromVacation.</param>
/// <param name="Days">In housing to the next work start, or to today while still there.</param>
public sealed record EntryRowDto(string WorkerNo, string Name, Guid? ProjectCrmId, string? Project, string? Manager, DateOnly ArrivedOn, string Entry, string Reason, string? Housing, int Days);

public sealed record HousingEntriesDto(int Total, IReadOnlyList<RankDto> ByManager, IReadOnlyList<RankDto> ByProject, IReadOnlyList<RankDto> ByEntry, IReadOnlyList<RankDto> Reasons, IReadOnlyList<EntryRowDto> Rows);

/// <summary>
/// The old system's executive dashboard (ManagementDashboard.aspx, docs/03-migration-plan/19), as it was: the project
/// deliveries and the housing entries of a period, by project manager and by project, with their lists. The figures
/// and the finance come from the executive report's own computations.
/// </summary>
internal sealed class ManagementDashboard(IWorkforceReport workforce, IPeriodLedger ledger, IHousingEntries entries, IProjectDirectory projects, IClock clock)
{
    private const string NoManager = "—";

    public async Task<DeliveryDto> DeliveryAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var managers = await ManagersAsync(cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        var starts = (await workforce.MovesAsync(from, to, cancellationToken).ConfigureAwait(false))
            .Where(m => m.Kind == "Work" && m.StartsOn >= from && m.StartsOn <= to).ToList();

        // Each start's work period: its end (the first day no longer there) and its price.
        var spans = (await ledger.WorkAsync(null, from, to, cancellationToken).ConfigureAwait(false))
            .GroupBy(s => (s.WorkerId, s.ProjectCrmId, s.StartsOn)).ToDictionary(g => g.Key, g => g.First());
        var rows = starts.OrderByDescending(m => m.StartsOn).ThenBy(m => m.Name, StringComparer.Ordinal).Select(m =>
            {
                var span = m.ProjectCrmId is { } p ? spans.GetValueOrDefault((m.WorkerId, p, m.StartsOn)) : null;
                var last = span?.EndsOn?.AddDays(-1);
                var status = m.StartsOn > today ? "NotStarted" : last is { } e && e < today ? "Ended" : "Working";
                var days = status == "NotStarted" ? 0 : Min(last ?? today, today).DayNumber - m.StartsOn.DayNumber + 1;
                return new StartRowDto(m.WorkerNo, m.Name, m.ProjectCrmId, m.Place, Manager(managers, m.ProjectCrmId), span?.TotalPrice, m.StartsOn, last, status, days);
            })
            .ToList();

        return new DeliveryDto(
            rows.Count,
            Rank(rows.Select(r => r.Manager ?? NoManager)),
            Rank(rows.Select(r => r.Project ?? NoManager)),
            rows);
    }

    public async Task<HousingEntriesDto> HousingEntriesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var managers = await ManagersAsync(cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        var orders = await entries.InAsync(from, to, cancellationToken).ConfigureAwait(false);

        // How long each stayed: to the worker's next work start after the entry, or to today.
        var later = orders.Count == 0 ? [] : await workforce.MovesAsync(orders.Min(o => o.ArrivedOn), today, cancellationToken).ConfigureAwait(false);
        var startsByWorker = later.Where(m => m.Kind == "Work").GroupBy(m => m.WorkerId).ToDictionary(g => g.Key, g => g.Select(m => m.StartsOn).Order().ToList());
        var rows = orders.OrderByDescending(o => o.ArrivedOn).ThenBy(o => o.Name, StringComparer.Ordinal).Select(o =>
            {
                var next = o.WorkerId is { } w && startsByWorker.TryGetValue(w, out var list) ? list.FirstOrDefault(d => d > o.ArrivedOn) : default;
                var end = next != default ? next : today.AddDays(1);
                return new EntryRowDto(o.WorkerNo, o.Name, o.ProjectCrmId, o.ProjectName, Manager(managers, o.ProjectCrmId), o.ArrivedOn, o.Entry, o.Reason, o.HousingName, Math.Max(0, end.DayNumber - o.ArrivedOn.DayNumber));
            })
            .ToList();

        return new HousingEntriesDto(
            rows.Count,
            Rank(rows.Select(r => r.Manager ?? NoManager)),
            Rank(rows.Select(r => r.Project ?? NoManager)),
            Rank(rows.Select(r => r.Entry)),
            Rank(rows.Where(r => r.Entry == "ReturnedWorker").Select(r => r.Reason)),
            rows);
    }

    private static List<RankDto> Rank(IEnumerable<string> keys) =>
        keys.GroupBy(k => k, StringComparer.Ordinal).Select(g => new RankDto(g.Key, g.Key, g.Count()))
            .OrderByDescending(r => r.Count).ThenBy(r => r.Name, StringComparer.Ordinal).ToList();

    private async Task<IReadOnlyDictionary<Guid, string>> ManagersAsync(CancellationToken cancellationToken) =>
        (await projects.ActiveAsync(cancellationToken).ConfigureAwait(false))
            .Where(p => !string.IsNullOrWhiteSpace(p.Manager)).ToDictionary(p => p.CrmId, p => p.Manager!.Trim());

    private static string Manager(IReadOnlyDictionary<Guid, string> managers, Guid? project) =>
        project is { } id && managers.TryGetValue(id, out var name) ? name : NoManager;

    private static DateOnly Min(DateOnly a, DateOnly b) => a < b ? a : b;
}
