using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Reports.Application;

/// <summary>A figure of the period with the same figure of the period before (null when it cannot be known).</summary>
public sealed record Figure(decimal? Value, decimal? Previous);

/// <param name="MovesPreviousTo">
/// While the period is running, the movements compare with the same number of days of the period before (October's
/// first 20 days with September's first 20); the invoices, dated at their period's end, with the whole period before.
/// </param>
public sealed record PeriodDto(DateOnly From, DateOnly To, DateOnly PreviousFrom, DateOnly PreviousTo, DateOnly MovesPreviousTo);

public sealed record MonthMovesDto(string Month, int Starts, int Returns);

public sealed record MonthMoneyDto(string Month, decimal Invoiced, decimal Collected, decimal? Rate);

public sealed record RankDto(string Key, string Name, int Count);

public sealed record ProjectMovesDto(Guid? ProjectCrmId, string Name, string? Manager, int Starts, int Returns);

public sealed record CoverageProjectDto(Guid ProjectCrmId, string Name, string? Manager, int Worked, int Invoiced, bool HasInvoice);

/// <param name="Month">The latest ended month with invoices up to the period's end (a running month is not billed yet).</param>
public sealed record CoverageDto(string? Month, int Full, int Partial, int Missing, int WorkersNotInvoiced, IReadOnlyList<CoverageProjectDto> Gaps);

public sealed record OverviewDto(
    PeriodDto Period,
    int ActiveProjects,
    int OnJob,
    int InHousing,
    Figure Starts,
    Figure Returns,
    Figure Net,
    Figure Invoiced,
    Figure InvoiceCount,
    Figure CollectionRate,
    decimal Overdue60,
    decimal TotalDebt,
    IReadOnlyList<MonthMovesDto> Moves,
    IReadOnlyList<MonthMoneyDto> Money,
    IReadOnlyList<RankDto> StartsByManager,
    IReadOnlyList<ProjectMovesDto> Projects,
    CoverageDto Coverage,
    bool FinanceVisible);

public sealed record StatusSumDto(int Code, string NameAr, string NameEn, int Count, decimal Total);

/// <param name="Bucket">1: 0–30 days, 2: 31–60, 3: 61–90, 4: 91–180, 5: more.</param>
public sealed record AgingDto(int Bucket, int Count, decimal Amount, decimal Percent);

public sealed record DebtorDto(Guid? ProjectCrmId, string Name, string? Manager, decimal Outstanding, decimal Invoiced, decimal Collected, decimal Rate, int OpenInvoices, int OldestDays);

public sealed record ManagerCollectionDto(string Manager, int Projects, int Invoices, decimal Invoiced, decimal Collected, decimal Outstanding, decimal Rate);

public sealed record InvoiceRowDto(
    Guid CrmId,
    string No,
    Guid? ProjectCrmId,
    string ProjectName,
    string? Manager,
    int Workers,
    decimal Total,
    decimal Collected,
    decimal Remaining,
    decimal Rate,
    int Status,
    string StatusAr,
    string StatusEn,
    DateOnly To,
    DateOnly CreatedOn,
    int AgeDays);

public sealed record FinanceDto(
    PeriodDto Period,
    Figure Invoiced,
    Figure BeforeVat,
    Figure Vat,
    Figure InvoiceCount,
    Figure Workers,
    Figure Collected,
    Figure CollectionRate,
    Figure Remaining,
    decimal TotalDebt,
    int OpenInvoices,
    decimal Overdue60,
    int Overdue60Invoices,
    decimal? Overdue60Share,
    decimal? Dso,
    IReadOnlyList<MonthMoneyDto> Money,
    IReadOnlyList<StatusSumDto> Statuses,
    IReadOnlyList<AgingDto> Aging,
    IReadOnlyList<DebtorDto> Debtors,
    IReadOnlyList<ManagerCollectionDto> Managers,
    IReadOnlyList<InvoiceRowDto> Invoices,
    int InvoicesTotal);

public sealed record MoveRowDto(string WorkerNo, string Name, string Kind, DateOnly On, Guid? ProjectCrmId, string? Project, string? Manager);

/// <summary>What a list of the report narrows to (the clicked month, manager, project, status, debt age...).</summary>
public sealed record ReportFilter(DateOnly From, DateOnly To, Guid? Project = null, string? Manager = null, int? Status = null, int? Bucket = null, string? Month = null, string? Kind = null, bool Open = false);

/// <summary>
/// The executive report (docs/03-migration-plan/14, phase A): the overview and the finance, each figure with the period
/// before; computed on the server from the modules' numbers and the old system's invoices of the parallel phase.
/// </summary>
internal sealed class ExecutiveReport(LegacyInvoices legacy, IWorkforceReport workforce, IPeriodLedger ledger, IWorkforceDirectory directory, IProjectDirectory projects, IClock clock, IOptions<ReportsOptions> options)
{
    private const string NoManager = "—";

    /// <summary>
    /// The period and the one before it: whole months against the same number of months before (October against
    /// September, a quarter against the quarter before), any other period against the same number of days before.
    /// </summary>
    public static PeriodDto PeriodOf(DateOnly from, DateOnly to, DateOnly today)
    {
        var previousTo = from.AddDays(-1);
        var previousFrom = from.Day == 1 && to.AddDays(1).Day == 1
            ? from.AddMonths(-(((to.Year - from.Year) * 12) + to.Month - from.Month + 1))
            : previousTo.AddDays(-(to.DayNumber - from.DayNumber));
        var movesTo = today >= from && today < to ? Min(previousTo, previousFrom.AddDays(today.DayNumber - from.DayNumber)) : previousTo;
        return new PeriodDto(from, to, previousFrom, previousTo, movesTo);
    }

    public async Task<OverviewDto> OverviewAsync(DateOnly from, DateOnly to, bool financeVisible, CancellationToken cancellationToken)
    {
        var period = PeriodOf(from, to, clock.Today);
        var months = Months(to);
        var allActive = await projects.ActiveAsync(cancellationToken).ConfigureAwait(false);
        var active = allActive.Where(p => !options.Value.IsExcluded(p.Code)).ToList();
        var excluded = allActive.Where(p => options.Value.IsExcluded(p.Code)).Select(p => p.CrmId).ToHashSet();
        var managers = await ManagersAsync(cancellationToken).ConfigureAwait(false);
        var now = await workforce.NowAsync(cancellationToken).ConfigureAwait(false);
        var moves = await workforce.MovesAsync(Min(period.PreviousFrom, months[0]), to, cancellationToken).ConfigureAwait(false);

        bool In(DateOnly d, DateOnly a, DateOnly b) => d >= a && d <= b;
        var current = moves.Where(m => In(m.StartsOn, from, to)).ToList();
        var before = moves.Where(m => In(m.StartsOn, period.PreviousFrom, period.MovesPreviousTo)).ToList();
        int Starts(IEnumerable<WorkforceMove> list) => list.Count(m => m.Kind == "Work");
        int Returns(IEnumerable<WorkforceMove> list) => list.Count(m => m.Kind == "Housing");

        var byManager = current.Where(m => m.Kind == "Work")
            .GroupBy(m => Manager(managers, m.ProjectCrmId))
            .Select(g => new RankDto(g.Key, g.Key, g.Count())).OrderByDescending(r => r.Count).ToList();
        var byProject = current
            .GroupBy(m => m.Kind == "Work" ? (m.ProjectCrmId, m.Place) : (m.FromProjectCrmId, m.FromPlace))
            .Select(g => new ProjectMovesDto(g.Key.Item1, g.Key.Item2 ?? "—", g.Key.Item1 is { } id ? managers.GetValueOrDefault(id) : null, g.Count(m => m.Kind == "Work"), g.Count(m => m.Kind == "Housing")))
            .OrderByDescending(p => p.Starts + p.Returns).Take(10).ToList();

        var finance = financeVisible ? await legacy.LoadAsync(cancellationToken).ConfigureAwait(false) : new LegacyFinance([], new Dictionary<Guid, HashSet<Guid>>());
        var invoices = finance.Invoices;
        var now0 = clock.Today;
        var inPeriod = invoices.Where(i => In(i.To, from, to)).ToList();
        var inBefore = invoices.Where(i => In(i.To, period.PreviousFrom, period.PreviousTo)).ToList();
        return new OverviewDto(
            period, active.Count, now.OnJob, now.InHousing,
            new Figure(Starts(current), Starts(before)), new Figure(Returns(current), Returns(before)),
            new Figure(Starts(current) - Returns(current), Starts(before) - Returns(before)),
            financeVisible ? new Figure(inPeriod.Sum(i => i.Total), inBefore.Sum(i => i.Total)) : new Figure(null, null),
            financeVisible ? new Figure(inPeriod.Count, inBefore.Count) : new Figure(null, null),
            financeVisible ? new Figure(Rate(inPeriod), Rate(inBefore)) : new Figure(null, null),
            invoices.Where(i => i.Remaining > 0.01m && Age(i, now0) > 60).Sum(i => i.Remaining),
            invoices.Sum(i => i.Remaining),
            months.Select(m => new MonthMovesDto(Key(m), Starts(moves.Where(x => Same(x.StartsOn, m))), Returns(moves.Where(x => Same(x.StartsOn, m))))).ToList(),
            financeVisible ? MoneyTrend(invoices, months) : [],
            byManager, byProject,
            financeVisible ? await CoverageAsync(finance, to, managers, excluded, cancellationToken).ConfigureAwait(false) : new CoverageDto(null, 0, 0, 0, 0, []),
            financeVisible);
    }

    public async Task<FinanceDto> FinanceAsync(DateOnly from, DateOnly to, Guid? project, CancellationToken cancellationToken)
    {
        var period = PeriodOf(from, to, clock.Today);
        var today = clock.Today;
        var all = (await legacy.LoadAsync(cancellationToken).ConfigureAwait(false)).Invoices.Where(i => project is null || i.ProjectCrmId == project).ToList();
        var inPeriod = all.Where(i => i.To >= from && i.To <= to).ToList();
        var inBefore = all.Where(i => i.To >= period.PreviousFrom && i.To <= period.PreviousTo).ToList();
        var open = all.Where(i => i.Remaining > 0.01m).ToList();
        var totalDebt = open.Sum(i => i.Remaining);
        var overdue = open.Where(i => Age(i, today) > 60).ToList();

        // Days sales outstanding: today's debt against the average day's billing of the last 90 days.
        var last90 = all.Where(i => i.To > today.AddDays(-90) && i.To <= today).Sum(i => i.Total);
        decimal? dso = last90 > 0 ? Math.Round(totalDebt / (last90 / 90m), 0) : null;

        var aging = Enumerable.Range(1, 5).Select(b =>
        {
            var inBucket = open.Where(i => Bucket(Age(i, today)) == b).ToList();
            var amount = inBucket.Sum(i => i.Remaining);
            return new AgingDto(b, inBucket.Count, amount, totalDebt > 0 ? Math.Round(amount * 100 / totalDebt, 1) : 0);
        }).ToList();
        var debtors = open.GroupBy(i => i.ProjectCrmId)
            .Select(g =>
            {
                var invoices = all.Where(i => i.ProjectCrmId == g.Key).ToList();
                var invoiced = invoices.Sum(i => i.Total);
                var collected = invoices.Sum(i => i.Collected);
                return new DebtorDto(g.Key, g.First().ProjectName, g.First().Manager, g.Sum(i => i.Remaining), invoiced, collected,
                    invoiced > 0 ? Math.Round(collected * 100 / invoiced, 0) : 0, g.Count(), g.Max(i => Age(i, today)));
            })
            .OrderByDescending(d => d.Outstanding).Take(8).ToList();
        var managersRows = inPeriod.GroupBy(i => i.Manager ?? NoManager)
            .Select(g =>
            {
                var invoiced = g.Sum(i => i.Total);
                var collected = g.Sum(i => i.Collected);
                return new ManagerCollectionDto(g.Key, g.Select(i => i.ProjectCrmId).Distinct().Count(), g.Count(), invoiced, collected, Math.Max(0, invoiced - collected),
                    invoiced > 0 ? Math.Round(collected * 100 / invoiced, 0) : 0);
            })
            .OrderByDescending(m => m.Invoiced).ToList();
        var statuses = inPeriod.GroupBy(i => i.Status)
            .Select(g => new StatusSumDto(g.Key, Status(g.Key).Ar, Status(g.Key).En, g.Count(), g.Sum(i => i.Total)))
            .OrderByDescending(s => s.Total).ToList();
        var rows = inPeriod.OrderByDescending(i => i.Remaining).ThenByDescending(i => i.To).ToList();

        return new FinanceDto(
            period,
            new Figure(inPeriod.Sum(i => i.Total), inBefore.Sum(i => i.Total)),
            new Figure(inPeriod.Sum(i => i.BeforeVat), inBefore.Sum(i => i.BeforeVat)),
            new Figure(inPeriod.Sum(i => i.Vat), inBefore.Sum(i => i.Vat)),
            new Figure(inPeriod.Count, inBefore.Count),
            new Figure(inPeriod.Sum(i => i.Workers), inBefore.Sum(i => i.Workers)),
            new Figure(inPeriod.Sum(i => i.Collected), inBefore.Sum(i => i.Collected)),
            new Figure(Rate(inPeriod), Rate(inBefore)),
            new Figure(inPeriod.Sum(i => i.Remaining), inBefore.Sum(i => i.Remaining)),
            totalDebt, open.Count, overdue.Sum(i => i.Remaining), overdue.Count,
            totalDebt > 0 ? Math.Round(overdue.Sum(i => i.Remaining) * 100 / totalDebt, 0) : null,
            dso, MoneyTrend(all, Months(to)), statuses, aging, debtors, managersRows,
            rows.Take(250).Select(i => Row(i, today)).ToList(), rows.Count);
    }

    /// <summary>The invoices behind a clicked figure (at most 2,000), most to collect first.</summary>
    public async Task<IReadOnlyList<InvoiceRowDto>> InvoicesAsync(ReportFilter f, CancellationToken cancellationToken)
    {
        var today = clock.Today;
        IEnumerable<LegacyInvoice> list = (await legacy.LoadAsync(cancellationToken).ConfigureAwait(false)).Invoices;
        list = f.Open || f.Bucket is not null
            ? list.Where(i => i.Remaining > 0.01m)
            : list.Where(i => i.To >= f.From && i.To <= f.To);
        if (f.Month is { } month)
        {
            list = list.Where(i => Key(i.To) == month);
        }

        if (f.Project is { } project)
        {
            list = list.Where(i => i.ProjectCrmId == project);
        }

        if (f.Manager is { } manager)
        {
            list = list.Where(i => (i.Manager ?? NoManager) == manager);
        }

        if (f.Status is { } status)
        {
            list = list.Where(i => i.Status == status);
        }

        if (f.Bucket is { } bucket)
        {
            list = list.Where(i => Bucket(Age(i, today)) == bucket);
        }

        return list.OrderByDescending(i => i.Remaining).ThenByDescending(i => i.To).Take(2000).Select(i => Row(i, today)).ToList();
    }

    /// <summary>The work starts or returns behind a clicked figure.</summary>
    public async Task<IReadOnlyList<MoveRowDto>> MovesAsync(ReportFilter f, CancellationToken cancellationToken)
    {
        var managers = await ManagersAsync(cancellationToken).ConfigureAwait(false);
        var (from, to) = f.Month is { } month && DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var first) ? (first, first.AddMonths(1).AddDays(-1)) : (f.From, f.To);
        IEnumerable<WorkforceMove> list = await workforce.MovesAsync(from, to, cancellationToken).ConfigureAwait(false);
        if (f.Kind is "Work" or "Housing")
        {
            list = list.Where(m => m.Kind == f.Kind);
        }

        if (f.Project is { } project)
        {
            list = list.Where(m => (m.Kind == "Work" ? m.ProjectCrmId : m.FromProjectCrmId) == project);
        }

        if (f.Manager is { } manager)
        {
            list = list.Where(m => m.Kind == "Work" && Manager(managers, m.ProjectCrmId) == manager);
        }

        return list.OrderByDescending(m => m.StartsOn).Take(5000)
            .Select(m =>
            {
                var projectId = m.Kind == "Work" ? m.ProjectCrmId : m.FromProjectCrmId;
                return new MoveRowDto(m.WorkerNo, m.Name, m.Kind, m.StartsOn, projectId, m.Kind == "Work" ? m.Place : m.FromPlace, projectId is { } id ? managers.GetValueOrDefault(id) : null);
            })
            .ToList();
    }

    /// <summary>
    /// The billing coverage of the latest ended month with invoices up to the period's end: each project with workers on the
    /// job that month, against the workers on its invoices of that month.
    /// </summary>
    private async Task<CoverageDto> CoverageAsync(LegacyFinance finance, DateOnly to, IReadOnlyDictionary<Guid, string> managers, HashSet<Guid> excluded, CancellationToken cancellationToken)
    {
        // A month still running is not billed yet: the latest month that has ended (and has invoices) up to the period's end.
        var today = clock.Today;
        var latest = finance.Invoices.Select(i => new DateOnly(i.To.Year, i.To.Month, 1))
            .Where(m => m.AddMonths(1).AddDays(-1) <= to && m.AddMonths(1) <= today)
            .DefaultIfEmpty().Max();
        if (latest == default)
        {
            return new CoverageDto(null, 0, 0, 0, 0, []);
        }

        var end = latest.AddMonths(1).AddDays(-1);
        var spans = await ledger.WorkAsync(null, latest, end, cancellationToken).ConfigureAwait(false);
        var crmIds = (await directory.CardsAsync(spans.Select(s => s.WorkerId).Distinct().ToList(), cancellationToken).ConfigureAwait(false)).ToDictionary(c => c.Id, c => c.CrmId);
        var invoicedByProject = finance.Invoices.Where(i => i.To >= latest && i.To <= end && i.ProjectCrmId is not null)
            .GroupBy(i => i.ProjectCrmId!.Value)
            .ToDictionary(g => g.Key, g => g.SelectMany(i => finance.WorkersByInvoice.GetValueOrDefault(i.CrmId) ?? []).ToHashSet());
        var rows = spans.Where(s => !excluded.Contains(s.ProjectCrmId)).GroupBy(s => s.ProjectCrmId)
            .Select(g =>
            {
                var worked = g.Select(s => crmIds.GetValueOrDefault(s.WorkerId)).Where(id => id != Guid.Empty).ToHashSet();
                var hasInvoice = invoicedByProject.TryGetValue(g.Key, out var invoiced);
                var covered = hasInvoice ? worked.Count(w => invoiced!.Contains(w)) : 0;
                return new CoverageProjectDto(g.Key, g.First().ProjectName ?? "—", managers.GetValueOrDefault(g.Key), worked.Count, covered, hasInvoice);
            })
            .Where(r => r.Worked > 0)
            .ToList();
        var full = rows.Count(r => r.HasInvoice && r.Invoiced >= r.Worked);
        var partial = rows.Count(r => r.HasInvoice && r.Invoiced < r.Worked);
        var missing = rows.Count(r => !r.HasInvoice);
        var gaps = rows.Where(r => !r.HasInvoice || r.Invoiced < r.Worked).OrderBy(r => r.HasInvoice).ThenByDescending(r => r.Worked - r.Invoiced).Take(12).ToList();
        return new CoverageDto(Key(latest), full, partial, missing, rows.Sum(r => r.Worked - r.Invoiced), gaps);
    }

    private async Task<IReadOnlyDictionary<Guid, string>> ManagersAsync(CancellationToken cancellationToken) =>
        (await projects.ActiveAsync(cancellationToken).ConfigureAwait(false))
            .Where(p => !string.IsNullOrWhiteSpace(p.Manager)).ToDictionary(p => p.CrmId, p => p.Manager!.Trim());

    private static string Manager(IReadOnlyDictionary<Guid, string> managers, Guid? project) =>
        project is { } id && managers.TryGetValue(id, out var name) ? name : NoManager;

    private static List<MonthMoneyDto> MoneyTrend(IReadOnlyList<LegacyInvoice> invoices, IReadOnlyList<DateOnly> months) =>
        months.Select(m =>
        {
            var of = invoices.Where(i => Same(i.To, m)).ToList();
            return new MonthMoneyDto(Key(m), of.Sum(i => i.Total), of.Sum(i => i.Collected), Rate(of));
        }).ToList();

    private static InvoiceRowDto Row(LegacyInvoice i, DateOnly today) => new(
        i.CrmId, i.No, i.ProjectCrmId, i.ProjectName, i.Manager, i.Workers, i.Total, i.Collected, i.Remaining,
        i.Total > 0 ? Math.Round(i.Collected * 100 / i.Total, 0) : 0, i.Status, Status(i.Status).Ar, Status(i.Status).En, i.To, i.CreatedOn, Age(i, today));

    private static (string Ar, string En) Status(int code) => LegacyInvoices.Statuses.TryGetValue(code, out var s) ? s : ("غير محدد", "Not set");

    private static decimal? Rate(IReadOnlyCollection<LegacyInvoice> invoices)
    {
        var total = invoices.Sum(i => i.Total);
        return total > 0 ? Math.Round(invoices.Sum(i => i.Collected) * 100 / total, 1) : null;
    }

    /// <summary>A debt's age: from the end of the invoice's period to today.</summary>
    internal static int Age(LegacyInvoice i, DateOnly today) => Math.Max(0, today.DayNumber - i.To.DayNumber);

    internal static int Bucket(int age) => age <= 30 ? 1 : age <= 60 ? 2 : age <= 90 ? 3 : age <= 180 ? 4 : 5;

    /// <summary>The six months ending with the period's month.</summary>
    internal static IReadOnlyList<DateOnly> Months(DateOnly to)
    {
        var last = new DateOnly(to.Year, to.Month, 1);
        return Enumerable.Range(0, 6).Select(i => last.AddMonths(i - 5)).ToList();
    }

    private static bool Same(DateOnly day, DateOnly month) => day.Year == month.Year && day.Month == month.Month;

    internal static string Key(DateOnly month) => month.ToString("yyyy-MM", System.Globalization.CultureInfo.InvariantCulture);

    private static DateOnly Min(DateOnly a, DateOnly b) => a < b ? a : b;
}
