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

/// <param name="Status">working, housing, vacation or other (where the worker is now).</param>
/// <param name="WorkShare">The share of the days since joining spent at work (and <paramref name="HousingShare"/> in housing).</param>
public sealed record NewWorkerDto(string WorkerNo, string Name, string? Supplier, DateOnly ArrivedOn, string Status, string? Project, DateOnly? FirstWorkOn, int? DaysToFirstWork, int DaysSince, int WorkDays, int HousingDays, decimal WorkShare, decimal HousingShare);

public sealed record SupplierArrivalsDto(string Supplier, int Total, int Working, int Housing, int Vacation, int Other, decimal WorkShare);

public sealed record MonthCountDto(string Month, int Count);

/// <param name="WorkShare">The average share of their days since joining the new workers spent at work (<paramref name="HousingShare"/> in housing).</param>
/// <param name="DaysToFirstWork">The average days from joining to the first work, of those who have started one (null: none).</param>
public sealed record NewArrivalsDto(
    int Total,
    int Working,
    int Housing,
    int Vacation,
    int NotDelivered,
    int WorkedOnce,
    decimal? WorkShare,
    decimal? HousingShare,
    decimal? DaysToFirstWork,
    IReadOnlyList<RankDto> ByStatus,
    IReadOnlyList<MonthCountDto> ByMonth,
    IReadOnlyList<SupplierArrivalsDto> BySupplier,
    IReadOnlyList<NewWorkerDto> Rows);

public sealed record HousingEntriesDto(int Total, IReadOnlyList<RankDto> ByManager, IReadOnlyList<RankDto> ByProject, IReadOnlyList<RankDto> ByEntry, IReadOnlyList<RankDto> Reasons, IReadOnlyList<EntryRowDto> Rows);

/// <summary>
/// The old system's executive dashboard (ManagementDashboard.aspx, docs/03-migration-plan/19), as it was: the project
/// deliveries and the housing entries of a period, by project manager and by project, with their lists. The figures
/// and the finance come from the executive report's own computations.
/// </summary>
internal sealed class ManagementDashboard(IWorkforceReport workforce, IPeriodLedger ledger, IHousingEntries entries, IProjectDirectory projects, LegacyTasks legacyTasks, IClock clock)
{
    private const string NoManager = "—";

    private static readonly string[] Statuses = ["working", "housing", "vacation", "other"];

    /// <summary>The completed tasks a list shows after the pending ones (the old dashboard's 300).</summary>
    public const int CompletedShown = 300;

    /// <summary>
    /// The old system's tasks created or changed in a period (as the old dashboard took them; cancelled ones left out):
    /// their counts, the staff by late then pending tasks, the types, and the list.
    /// </summary>
    public async Task<TasksDto> TasksAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var today = clock.Today;
        bool In(DateOnly? d) => d is { } x && x >= from && x <= to;
        var tasks = (await legacyTasks.LoadAsync(cancellationToken).ConfigureAwait(false))
            .Where(t => !t.Canceled && (In(t.CreatedOn) || In(t.ModifiedOn))).ToList();
        var completed = tasks.Count(t => t.Completed);
        var onTime = tasks.Count(TaskRules.OnTime);

        var owners = tasks.GroupBy(t => string.IsNullOrWhiteSpace(t.Owner) ? NoManager : t.Owner, StringComparer.Ordinal)
            .Select(g =>
            {
                var pending = g.Where(t => !t.Completed).ToList();
                var done = g.Count(t => t.Completed);
                var oldest = pending.Select(t => t.CreatedOn).OfType<DateOnly>().DefaultIfEmpty(today).Min();
                return new TaskOwnerDto(g.Key, g.Count(), done, pending.Count, pending.Count(t => TaskRules.Late(t, today)), pending.Count == 0 ? 0 : Math.Max(0, today.DayNumber - oldest.DayNumber),
                    TaskRules.Rate(done, g.Count()) ?? 0, TaskRules.Rate(g.Count(TaskRules.OnTime), done) ?? 0);
            })
            .OrderByDescending(o => o.Overdue).ThenByDescending(o => o.Open).ThenByDescending(o => o.Total).ToList();

        var types = tasks.GroupBy(t => t.Type, StringComparer.Ordinal)
            .Select(g => new TaskTypeDto(g.Key, g.Count(), g.Count(t => t.Completed), g.Count(t => !t.Completed)))
            .OrderByDescending(x => x.Total).ToList();

        TaskRowDto Row(LegacyTask t)
        {
            var (timing, days) = TaskRules.Timing(t, today);
            return new TaskRowDto(t.CrmId, t.Subject, string.IsNullOrWhiteSpace(t.Owner) ? NoManager : t.Owner, t.Type, t.Regarding, t.CreatedOn, t.DueOn, t.Completed ? t.ModifiedOn : null,
                t.Completed ? "done" : TaskRules.Late(t, today) ? "late" : "open", timing, days, t.CreatedOn is { } c ? Math.Max(0, today.DayNumber - c.DayNumber) : 0);
        }

        var rows = tasks.Where(t => !t.Completed).OrderBy(t => t.DueOn ?? t.CreatedOn).Select(Row)
            .Concat(tasks.Where(t => t.Completed).OrderByDescending(t => t.ModifiedOn).Take(CompletedShown).Select(Row))
            .ToList();
        return new TasksDto(tasks.Count, completed, tasks.Count - completed, tasks.Count(t => TaskRules.Late(t, today)), onTime,
            TaskRules.Rate(completed, tasks.Count), TaskRules.Rate(onTime, completed), owners, types, rows);
    }

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

    /// <summary>
    /// The workers who joined the company in a period (the old dashboard's «العمالة دخول جديد»): where they are now, how
    /// much of their time since has been work, how soon they first worked, by month and by supplier.
    /// </summary>
    public async Task<NewArrivalsDto> NewArrivalsAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        const string NoSupplier = "—";
        var today = clock.Today;
        var rows = (await workforce.ArrivalsAsync(from, to, cancellationToken).ConfigureAwait(false)).Select(a =>
            {
                var since = Math.Max(1, today.DayNumber - a.ArrivedOn.DayNumber + 1);
                // On the job as the old system counts it: «InActive Employee» workers too.
                var status = a.Placement switch { "Working" or "Inactive" => "working", "Housing" or "New" => "housing", "Vacation" => "vacation", _ => "other" };
                return new NewWorkerDto(a.WorkerNo, a.Name, string.IsNullOrWhiteSpace(a.Agent) ? null : a.Agent.Trim(), a.ArrivedOn, status, a.Project, a.FirstWorkOn,
                    a.FirstWorkOn is { } f ? Math.Max(0, f.DayNumber - a.ArrivedOn.DayNumber) : null, since, a.WorkDays, a.HousingDays,
                    Math.Min(100, Math.Round(a.WorkDays * 100m / since, 1)), Math.Min(100, Math.Round(a.HousingDays * 100m / since, 1)));
            })
            .ToList();
        decimal? Average(IEnumerable<decimal> values) => values.Any() ? Math.Round(values.Average(), 1) : null;
        int Count(string status) => rows.Count(r => r.Status == status);

        var bySupplier = rows.GroupBy(r => r.Supplier ?? NoSupplier, StringComparer.Ordinal)
            .Select(g => new SupplierArrivalsDto(g.Key, g.Count(), g.Count(r => r.Status == "working"), g.Count(r => r.Status == "housing"), g.Count(r => r.Status == "vacation"), g.Count(r => r.Status == "other"),
                Math.Round(g.Average(r => r.WorkShare), 0)))
            .OrderByDescending(s => s.Total).ToList();
        var byMonth = rows.GroupBy(r => r.ArrivedOn.ToString("yyyy-MM", System.Globalization.CultureInfo.InvariantCulture))
            .Select(g => new MonthCountDto(g.Key, g.Count())).OrderBy(m => m.Month, StringComparer.Ordinal).ToList();
        var byStatus = Statuses.Select(s => new RankDto(s, s, Count(s))).Where(r => r.Count > 0).ToList();

        // Not delivered yet: in housing and never at work since joining.
        return new NewArrivalsDto(rows.Count, Count("working"), Count("housing"), Count("vacation"), rows.Count(r => r.FirstWorkOn is null && r.Status == "housing"), rows.Count(r => r.FirstWorkOn is not null),
            Average(rows.Select(r => r.WorkShare)), Average(rows.Select(r => r.HousingShare)), Average(rows.Where(r => r.DaysToFirstWork is not null).Select(r => (decimal)r.DaysToFirstWork!.Value)),
            byStatus, byMonth, bySupplier, rows);
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
