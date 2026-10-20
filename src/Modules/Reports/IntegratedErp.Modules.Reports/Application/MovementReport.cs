using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Operations.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;

namespace IntegratedErp.Modules.Reports.Application;

/// <param name="AverageStint">The average days on the project of the workers who came back that month (null: none came back).</param>
public sealed record MonthMovementDto(string Month, int Starts, int Returns, int Arrivals, decimal? AverageStint);

/// <param name="Days">To the first work, or to today while the worker has not been delivered.</param>
public sealed record ArrivalRowDto(string WorkerNo, string Name, string? Sponsor, DateOnly ArrivedOn, string Placement, DateOnly? FirstWorkOn, string? FirstProject, int Days, int WorkDays, int HousingDays);

public sealed record WaitingRowDto(string WorkerNo, string Name, DateOnly Since, int Days, string? Housing, Guid? FromProjectCrmId, string? FromProject, string? Manager);

public sealed record ReturnRowDto(string WorkerNo, string Name, DateOnly On, string Reason, Guid? ProjectCrmId, string? Project, string? Manager, string? Housing);

/// <param name="ArrivalsDelivered">Of the period's new workers, how many have started a first work.</param>
/// <param name="AverageStint">The average days on the project of the workers who came back to housing in the period.</param>
/// <param name="Waiting">The workers in housing now, waiting to be delivered; <paramref name="OldestWaitingDays"/> the longest there.</param>
/// <param name="Reasons">The return orders of the period by reason (their count can differ from the returns, which come from the work periods).</param>
public sealed record MovementDto(
    PeriodDto Period,
    Figure Starts,
    Figure Returns,
    Figure Arrivals,
    int ArrivalsDelivered,
    Figure Net,
    Figure AverageStint,
    int Waiting,
    int? OldestWaitingDays,
    IReadOnlyList<MonthMovementDto> Months,
    IReadOnlyList<RankDto> StartsByManager,
    IReadOnlyList<RankDto> StartsByProject,
    IReadOnlyList<RankDto> Reasons,
    IReadOnlyList<ArrivalRowDto> NewWorkers,
    int NewWorkersTotal);

/// <summary>
/// The workforce movement report (docs/03-migration-plan/14, phase B): the starts and the returns of a period against
/// the period before, the new workers and their delivery, how long the returning workers stayed, why they came back, and
/// who waits in housing now.
/// </summary>
internal sealed class MovementReport(IWorkforceReport workforce, IHousingEntries entries, IProjectDirectory projects, IClock clock)
{
    private const string NoManager = "—";
    private const string Returned = "ReturnedWorker";

    public async Task<MovementDto> OverviewAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var period = ExecutiveReport.PeriodOf(from, to, today);
        var months = ExecutiveReport.Months(to);
        var start = Min(period.PreviousFrom, months[0]);
        var managers = await ManagersAsync(cancellationToken).ConfigureAwait(false);
        var moves = await workforce.MovesAsync(start, to, cancellationToken).ConfigureAwait(false);
        var arrivals = await workforce.ArrivalsAsync(start, to, cancellationToken).ConfigureAwait(false);
        var waiting = await workforce.InHousingAsync(cancellationToken).ConfigureAwait(false);
        var orders = await entries.InAsync(from, to, cancellationToken).ConfigureAwait(false);

        bool In(DateOnly d, DateOnly a, DateOnly b) => d >= a && d <= b;
        var current = moves.Where(m => In(m.StartsOn, from, to)).ToList();
        var before = moves.Where(m => In(m.StartsOn, period.PreviousFrom, period.MovesPreviousTo)).ToList();
        int Starts(IEnumerable<WorkforceMove> list) => list.Count(m => m.Kind == "Work");
        int Returns(IEnumerable<WorkforceMove> list) => list.Count(m => m.Kind == "Housing");
        var arrived = arrivals.Where(a => In(a.ArrivedOn, from, to)).ToList();
        var arrivedBefore = arrivals.Count(a => In(a.ArrivedOn, period.PreviousFrom, period.MovesPreviousTo));

        var byManager = current.Where(m => m.Kind == "Work").GroupBy(m => Manager(managers, m.ProjectCrmId))
            .Select(g => new RankDto(g.Key, g.Key, g.Count())).OrderByDescending(r => r.Count).ThenBy(r => r.Name, StringComparer.Ordinal).ToList();
        var byProject = current.Where(m => m.Kind == "Work").GroupBy(m => (m.ProjectCrmId, m.Place))
            .Select(g => new RankDto(g.Key.ProjectCrmId?.ToString() ?? "", g.Key.Place ?? "—", g.Count())).OrderByDescending(r => r.Count).Take(8).ToList();
        var reasons = orders.Where(o => o.Entry == Returned).GroupBy(o => o.Reason)
            .Select(g => new RankDto(g.Key, g.Key, g.Count())).OrderByDescending(r => r.Count).ToList();

        return new MovementDto(
            period,
            new Figure(Starts(current), Starts(before)),
            new Figure(Returns(current), Returns(before)),
            new Figure(arrived.Count, arrivedBefore),
            arrived.Count(a => a.FirstWorkOn is not null),
            new Figure(Starts(current) - Returns(current), Starts(before) - Returns(before)),
            new Figure(Stint(current), Stint(before)),
            waiting.Count,
            waiting.Count > 0 ? today.DayNumber - waiting.Min(w => w.Since).DayNumber : null,
            months.Select(m =>
            {
                var of = moves.Where(x => Same(x.StartsOn, m)).ToList();
                return new MonthMovementDto(ExecutiveReport.Key(m), Starts(of), Returns(of), arrivals.Count(a => Same(a.ArrivedOn, m)), Stint(of));
            }).ToList(),
            byManager, byProject, reasons,
            arrived.Take(50).Select(a => Arrival(a, today)).ToList(), arrived.Count);
    }

    /// <summary>The new workers of a period (or of a month), the delivered or the waiting ones only when asked.</summary>
    public async Task<IReadOnlyList<ArrivalRowDto>> ArrivalsAsync(DateOnly from, DateOnly to, string? month, bool? delivered, CancellationToken cancellationToken)
    {
        var (a, b) = MonthOr(month, from, to);
        var today = clock.Today;
        return (await workforce.ArrivalsAsync(a, b, cancellationToken).ConfigureAwait(false))
            .Where(x => delivered is null || (x.FirstWorkOn is not null) == delivered)
            .Select(x => Arrival(x, today)).ToList();
    }

    /// <summary>The return orders of a period, of one reason when asked.</summary>
    public async Task<IReadOnlyList<ReturnRowDto>> ReturnsAsync(DateOnly from, DateOnly to, string? month, string? reason, CancellationToken cancellationToken)
    {
        var (a, b) = MonthOr(month, from, to);
        var managers = await ManagersAsync(cancellationToken).ConfigureAwait(false);
        return (await entries.InAsync(a, b, cancellationToken).ConfigureAwait(false))
            .Where(o => o.Entry == Returned && (reason is null || o.Reason == reason))
            .OrderByDescending(o => o.ArrivedOn)
            .Select(o => new ReturnRowDto(o.WorkerNo, o.Name, o.ArrivedOn, o.Reason, o.ProjectCrmId, o.ProjectName, o.ProjectCrmId is { } id ? managers.GetValueOrDefault(id) : null, o.HousingName))
            .ToList();
    }

    /// <summary>The workers in housing now, the longest there first.</summary>
    public async Task<IReadOnlyList<WaitingRowDto>> WaitingAsync(CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var managers = await ManagersAsync(cancellationToken).ConfigureAwait(false);
        return (await workforce.InHousingAsync(cancellationToken).ConfigureAwait(false))
            .Select(w => new WaitingRowDto(w.WorkerNo, w.Name, w.Since, today.DayNumber - w.Since.DayNumber, w.Place, w.FromProjectCrmId, w.FromPlace, w.FromProjectCrmId is { } id ? managers.GetValueOrDefault(id) : null))
            .ToList();
    }

    /// <summary>How long, on average, the workers who came back had stayed on their project.</summary>
    internal static decimal? Stint(IEnumerable<WorkforceMove> moves)
    {
        var days = moves.Where(m => m.Kind == "Housing" && m.FromStartedOn is { } s && s <= m.StartsOn).Select(m => m.StartsOn.DayNumber - m.FromStartedOn!.Value.DayNumber).ToList();
        return days.Count > 0 ? Math.Round((decimal)days.Average(), 0) : null;
    }

    private static ArrivalRowDto Arrival(WorkforceArrival a, DateOnly today) => new(
        a.WorkerNo, a.Name, a.Sponsor, a.ArrivedOn, a.Placement, a.FirstWorkOn, a.FirstProject,
        Math.Max(0, (a.FirstWorkOn ?? today).DayNumber - a.ArrivedOn.DayNumber), a.WorkDays, a.HousingDays);

    private static (DateOnly From, DateOnly To) MonthOr(string? month, DateOnly from, DateOnly to) =>
        month is not null && DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var first) ? (first, first.AddMonths(1).AddDays(-1)) : (from, to);

    private async Task<IReadOnlyDictionary<Guid, string>> ManagersAsync(CancellationToken cancellationToken) =>
        (await projects.ActiveAsync(cancellationToken).ConfigureAwait(false))
            .Where(p => !string.IsNullOrWhiteSpace(p.Manager)).ToDictionary(p => p.CrmId, p => p.Manager!.Trim());

    private static string Manager(IReadOnlyDictionary<Guid, string> managers, Guid? project) =>
        project is { } id && managers.TryGetValue(id, out var name) ? name : NoManager;

    private static bool Same(DateOnly day, DateOnly month) => day.Year == month.Year && day.Month == month.Month;

    private static DateOnly Min(DateOnly a, DateOnly b) => a < b ? a : b;
}
