using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Workforce.Contracts;

namespace IntegratedErp.Modules.Reports.Application;

public sealed record MoneyFigure(decimal? Value, decimal? Previous);

public sealed record LineDto(string Key, decimal Amount);

public sealed record TrendDto(string Month, decimal Revenue, decimal Cost, decimal Profit);

public sealed record SourceDto(string Source, int Workers, decimal Revenue, decimal Cost, decimal Profit, decimal? Margin, int MissingCosts);

public sealed record AlertsDto(int LosingProjects, decimal LosingTotal, string? WorstProject, decimal? WorstLoss, int UnbilledProjects, int UnbilledWorkers, string? UnbilledLargest, int SuppliersInHousing, decimal DailyIdleCost, int MissingCosts, decimal UncostedRevenue);

/// <param name="Month">The invoiced month shown (<c>yyyy-MM</c>).</param>
/// <param name="Months">The ended months with invoices, the latest first (the month picker).</param>
public sealed record CeoOverviewDto(
    string Month,
    IReadOnlyList<string> Months,
    MoneyFigure Revenue,
    decimal UncostedRevenue,
    int UncostedWorkers,
    MoneyFigure Cost,
    MoneyFigure Profit,
    MoneyFigure Margin,
    MoneyFigure IdleCost,
    int IdleDays,
    MoneyFigure CollectionRate,
    int OnJob,
    int InHousing,
    IReadOnlyList<LineDto> Breakdown,
    IReadOnlyList<TrendDto> Trend,
    IReadOnlyList<SourceDto> Sources,
    AlertsDto Alerts);

public sealed record ProjectProfitDto(Guid? ProjectCrmId, string Name, string? Manager, int Workers, int WorkDays, decimal Revenue, decimal Cost, decimal Expenses, decimal Profit, decimal? Margin, int UnbilledWorkers, int MissingCosts);

public sealed record SupplierProfitDto(string Supplier, int Workers, decimal Revenue, decimal Cost, decimal IdleCost, int IdleDays, decimal Profit, int MissingCosts);

public sealed record ProfitTabDto(
    string Month,
    MoneyFigure Profit,
    MoneyFigure Margin,
    int LosingProjects,
    decimal LosingTotal,
    decimal? AverageWorkerProfit,
    int LosingWorkers,
    decimal LosingWorkersTotal,
    IReadOnlyList<SourceDto> Sources,
    IReadOnlyList<ProjectProfitDto> Projects,
    IReadOnlyList<SupplierProfitDto> Suppliers);

public sealed record WorkerProfitDto(Guid WorkerId, string WorkerNo, string Name, string Source, string? Supplier, string? Projects, int WorkDays, int HousingDays, decimal Revenue, decimal Cost, decimal IdleCost, decimal Expenses, decimal Profit, bool CostMissing);

public sealed record WorkerProfitFilter(Guid? Project, string? Supplier, string? Source, bool Losing, bool Housing, string? Search);

/// <summary>
/// The CEO report (docs/03-migration-plan/16): the invoiced month's profit and loss against the month before, where
/// the money goes, what needs a decision, and the profitability of the projects, the suppliers and each worker.
/// </summary>
internal sealed class CeoReport(ProfitReport profit, LegacyInvoices legacy, IWorkforceReport workforce, IWorkerCosts costs, IClock clock)
{
    private static readonly string[] SourceOrder = ["Company", "Supplier", "Unknown"];

    public async Task<string?> DefaultMonthAsync(CancellationToken cancellationToken) =>
        (await profit.InvoicedMonthsAsync(cancellationToken).ConfigureAwait(false)) is [var latest, ..] ? ProfitReport.Key(latest) : null;

    public async Task<CeoOverviewDto?> OverviewAsync(DateOnly? month, CancellationToken cancellationToken)
    {
        var months = await profit.InvoicedMonthsAsync(cancellationToken).ConfigureAwait(false);
        if (Pick(month, months) is not { } m)
        {
            return null;
        }

        var now = await profit.MonthAsync(m, cancellationToken).ConfigureAwait(false);
        var before = months.Contains(m.AddMonths(-1)) ? await profit.MonthAsync(m.AddMonths(-1), cancellationToken).ConfigureAwait(false) : null;
        var trendMonths = months.Where(x => x <= m).Take(6).Reverse().ToList();
        var trend = new List<TrendDto>();
        foreach (var t in trendMonths)
        {
            var p = await profit.MonthAsync(t, cancellationToken).ConfigureAwait(false);
            trend.Add(new TrendDto(ProfitReport.Key(t), p.Revenue, p.Cost, p.Profit));
        }

        var finance = await legacy.LoadAsync(cancellationToken).ConfigureAwait(false);
        decimal? Rate(DateOnly x)
        {
            var of = finance.Invoices.Where(i => i.To.Year == x.Year && i.To.Month == x.Month).ToList();
            var total = of.Sum(i => i.Total);
            return total > 0 ? Math.Round(of.Sum(i => i.Collected) * 100 / total, 1) : null;
        }

        var current = await workforce.NowAsync(cancellationToken).ConfigureAwait(false);
        var alerts = await AlertsAsync(now, cancellationToken).ConfigureAwait(false);
        return new CeoOverviewDto(
            ProfitReport.Key(m), months.Select(ProfitReport.Key).ToList(),
            new MoneyFigure(now.Revenue, before?.Revenue), now.UncostedRevenue, now.UncostedWorkers, new MoneyFigure(now.Cost, before?.Cost), new MoneyFigure(now.Profit, before?.Profit),
            new MoneyFigure(now.Margin, before?.Margin), new MoneyFigure(now.IdleCost, before?.IdleCost), now.IdleDays,
            new MoneyFigure(Rate(m), before is null ? null : Rate(m.AddMonths(-1))),
            current.OnJob, current.InHousing,
            [
                new("CompanySalaries", now.CompanySalaries), new("SupplierCosts", now.SupplierCosts), new("IdleCost", now.IdleCost),
                new("WorkerExpenses", now.WorkerExpenses + now.UnallocatedExpenses), new("ProjectExpenses", now.ProjectExpenses), new("GeneralExpenses", now.GeneralExpenses),
            ],
            trend, Sources(now), alerts);
    }

    public async Task<ProfitTabDto?> ProfitAsync(DateOnly? month, CancellationToken cancellationToken)
    {
        var months = await profit.InvoicedMonthsAsync(cancellationToken).ConfigureAwait(false);
        if (Pick(month, months) is not { } m)
        {
            return null;
        }

        var now = await profit.MonthAsync(m, cancellationToken).ConfigureAwait(false);
        var before = months.Contains(m.AddMonths(-1)) ? await profit.MonthAsync(m.AddMonths(-1), cancellationToken).ConfigureAwait(false) : null;
        var losing = now.Projects.Where(Losing).ToList();
        var counted = now.Workers.Where(w => !w.CostMissing && (w.WorkDays > 0 || w.Revenue > 0)).ToList();
        var losingWorkers = now.Workers.Where(w => !w.CostMissing && w.Profit < 0).ToList();
        return new ProfitTabDto(
            ProfitReport.Key(m), new MoneyFigure(now.Profit, before?.Profit), new MoneyFigure(now.Margin, before?.Margin),
            losing.Count, losing.Sum(p => p.Profit),
            counted.Count > 0 ? Math.Round(counted.Sum(w => w.Profit) / counted.Count, 0) : null,
            losingWorkers.Count, losingWorkers.Sum(w => w.Profit),
            Sources(now),
            now.Projects.Select(p => new ProjectProfitDto(p.ProjectCrmId, p.Name, p.Manager, p.Workers, p.WorkDays, p.Revenue, p.Cost, p.Expenses, p.Profit, p.Revenue > 0 ? Math.Round(p.Profit * 100 / p.Revenue, 1) : null, p.UnbilledWorkers, p.MissingCosts)).ToList(),
            now.Workers.Where(w => w.Source == "Supplier").GroupBy(w => w.Supplier ?? "—")
                .Select(g => new SupplierProfitDto(g.Key, g.Count(), g.Sum(w => w.Revenue), g.Sum(w => w.Cost), g.Sum(w => w.IdleCost), g.Sum(w => w.HousingDays), g.Where(w => !w.CostMissing).Sum(w => w.Profit), g.Count(w => w.CostMissing)))
                .OrderByDescending(s => s.Workers).ToList());
    }

    /// <summary>The workers behind a figure (at most 3,000), the biggest losses first.</summary>
    public async Task<IReadOnlyList<WorkerProfitDto>> WorkersAsync(DateOnly? month, WorkerProfitFilter f, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(f);
        var months = await profit.InvoicedMonthsAsync(cancellationToken).ConfigureAwait(false);
        if (Pick(month, months) is not { } m)
        {
            return [];
        }

        IEnumerable<WorkerMonth> list = (await profit.MonthAsync(m, cancellationToken).ConfigureAwait(false)).Workers;
        if (f.Project is { } project)
        {
            list = list.Where(w => w.Projects.Any(p => p.ProjectCrmId == project));
        }

        if (!string.IsNullOrWhiteSpace(f.Supplier))
        {
            list = list.Where(w => string.Equals(w.Supplier, f.Supplier, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(f.Source))
        {
            list = list.Where(w => w.Source == f.Source);
        }

        if (f.Losing)
        {
            list = list.Where(w => !w.CostMissing && w.Profit < 0);
        }

        if (f.Housing)
        {
            list = list.Where(w => w.HousingDays > 0);
        }

        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var q = f.Search.Trim();
            list = list.Where(w => w.WorkerNo.Contains(q, StringComparison.OrdinalIgnoreCase) || w.Name.Contains(q, StringComparison.OrdinalIgnoreCase));
        }

        return list.OrderBy(w => w.CostMissing).ThenBy(w => w.Profit).Take(3000)
            .Select(w => new WorkerProfitDto(w.WorkerId, w.WorkerNo, w.Name, w.Source, w.Supplier, w.Projects.Count == 0 ? null : string.Join(" · ", w.Projects.OrderByDescending(p => p.Days).Select(p => p.Place ?? "—")),
                w.WorkDays, w.HousingDays, w.Revenue, w.Cost, w.IdleCost, w.Expenses, w.Profit, w.CostMissing))
            .ToList();
    }

    private async Task<AlertsDto> AlertsAsync(MonthProfit now, CancellationToken cancellationToken)
    {
        var losing = now.Projects.Where(Losing).OrderBy(p => p.Profit).ToList();
        var unbilled = now.Projects.Where(p => p.UnbilledWorkers > 0).OrderByDescending(p => p.UnbilledWorkers).ToList();

        // Today's suppliers' workers in housing: what they cost a day while no one is billed for them.
        var housed = await workforce.InHousingAsync(cancellationToken).ConfigureAwait(false);
        var housedCosts = (await costs.CostsAsync(housed.Select(h => h.WorkerId).ToList(), clock.Today, cancellationToken).ConfigureAwait(false))
            .Where(c => c.Source == "Supplier").ToList();
        var daily = housedCosts.Where(c => c.SupplierMonthlyCost is not null && c.ByWorkingDays != true).Sum(c => c.SupplierMonthlyCost!.Value / 30m);
        return new AlertsDto(losing.Count, losing.Sum(p => p.Profit), losing.FirstOrDefault()?.Name, losing.FirstOrDefault()?.Profit,
            unbilled.Count, unbilled.Sum(p => p.UnbilledWorkers), unbilled.FirstOrDefault()?.Name, housedCosts.Count, Math.Round(daily, 0), now.UncostedWorkers, now.UncostedRevenue);
    }

    /// <summary>A project billed in the month that cost more than it was billed (one not billed at all is «worked, not billed»).</summary>
    private static bool Losing(ProjectMonth p) => p.Revenue > 0 && p.Profit < 0 && p.MissingCosts == 0;

    private static List<SourceDto> Sources(MonthProfit m) =>
        SourceOrder.Select(s =>
        {
            var of = m.Workers.Where(w => w.Source == s).ToList();
            var counted = of.Where(w => !w.CostMissing).ToList();
            var revenue = counted.Sum(w => w.Revenue);
            var profit = counted.Sum(w => w.Profit);
            return new SourceDto(s, of.Count, of.Sum(w => w.Revenue), counted.Sum(w => w.Cost), profit, revenue > 0 ? Math.Round(profit * 100 / revenue, 1) : null, of.Count(w => w.CostMissing));
        }).Where(s => s.Workers > 0).ToList();

    private static DateOnly? Pick(DateOnly? month, IReadOnlyList<DateOnly> months) =>
        month is { } x ? months.FirstOrDefault(m => m.Year == x.Year && m.Month == x.Month) is var found && found != default ? found : null
        : months.Count > 0 ? months[0] : null;
}
