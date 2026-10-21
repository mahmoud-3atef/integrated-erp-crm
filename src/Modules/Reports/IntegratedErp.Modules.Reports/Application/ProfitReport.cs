using System.Globalization;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Expenses.Contracts;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Reports.Application;

/// <summary>An expense's share in the month, with its category's name.</summary>
public sealed record ExpenseItemDto(string ExpenseNo, string Category, string CategoryAr, string CategoryEn, decimal Amount);

/// <summary>
/// How a worker's cost was reached (docs/03-migration-plan/16): for a company worker the salary due on their invoice
/// lines and a day's salary for the days on the job not billed; for a supplier's the agreed monthly cost by the days on
/// the job and, when fixed monthly, the days in housing; then their expenses.
/// </summary>
public sealed record CostPartsDto(
    decimal BilledSalary,
    decimal BilledDays,
    int UnbilledDays,
    decimal DailySalary,
    decimal UnbilledSalary,
    decimal? SupplierMonthly,
    bool? ByWorkingDays,
    int MonthDays,
    decimal SupplierWork,
    int IdleDays,
    decimal IdleCost,
    IReadOnlyList<ExpenseItemDto> Expenses);

/// <summary>One worker's month: their days, what was billed for them, and what they cost.</summary>
/// <param name="Source"><c>Company</c>, <c>Supplier</c> or <c>Unknown</c>.</param>
/// <param name="WorkCost">The salary (company) or the supplier's cost for the days on the job.</param>
/// <param name="IdleCost">A supplier's fixed cost for the days in housing (paid, not billed).</param>
/// <param name="CostMissing">A supplier's worker without a cost entered: their cost is not counted.</param>
internal sealed record WorkerMonth(
    Guid WorkerId,
    string WorkerNo,
    string Name,
    string Source,
    string? Supplier,
    IReadOnlyList<ProjectDays> Projects,
    int WorkDays,
    int HousingDays,
    decimal Revenue,
    decimal WorkCost,
    decimal IdleCost,
    decimal Expenses,
    bool CostMissing,
    CostPartsDto Parts)
{
    public decimal Cost => WorkCost + IdleCost + Expenses;

    public decimal Profit => Revenue - Cost;
}

/// <param name="CompanyCost">Of the workers' cost: the company workers' salaries (and their expenses) on the project's days.</param>
/// <param name="SupplierCost">Of the workers' cost: the suppliers' cost (and the expenses) of their workers on the project's days.</param>
internal sealed record ProjectMonth(Guid? ProjectCrmId, string Name, string? Manager, int Workers, int WorkDays, decimal Revenue, decimal WorkerCost, decimal Expenses, int UnbilledWorkers, int MissingCosts, decimal CompanyCost, decimal SupplierCost, IReadOnlyList<ExpenseItemDto> ExpenseItems)
{
    public decimal Cost => WorkerCost + Expenses;

    public decimal Profit => Revenue - Cost;
}

/// <param name="Revenue">The month's project invoices before VAT.</param>
/// <param name="UncostedRevenue">What was billed for the suppliers' workers whose cost is not entered: left out of the profit.</param>
/// <param name="UnallocatedExpenses">Workers' expenses in a month they did not work (no project to carry them).</param>
internal sealed record MonthProfit(
    DateOnly Month,
    decimal Revenue,
    decimal UncostedRevenue,
    int UncostedWorkers,
    decimal CompanySalaries,
    decimal SupplierCosts,
    decimal IdleCost,
    decimal WorkerExpenses,
    decimal ProjectExpenses,
    decimal GeneralExpenses,
    decimal UnallocatedExpenses,
    int IdleDays,
    IReadOnlyList<WorkerMonth> Workers,
    IReadOnlyList<ProjectMonth> Projects)
{
    public decimal Cost => CompanySalaries + SupplierCosts + IdleCost + WorkerExpenses + ProjectExpenses + GeneralExpenses + UnallocatedExpenses;

    /// <summary>The revenue whose cost is known: the profit is counted on it.</summary>
    public decimal CostedRevenue => Revenue - UncostedRevenue;

    public decimal Profit => CostedRevenue - Cost;

    public decimal? Margin => CostedRevenue > 0 ? Math.Round(Profit * 100 / CostedRevenue, 1) : null;
}

/// <summary>
/// The company's profit and loss of an invoiced month (docs/03-migration-plan/16), worker by worker:
/// <list type="bullet">
/// <item>revenue: the worker's lines on the month's project invoices (before VAT);</item>
/// <item>a company worker's cost: the salary due on those lines, or the salary ÷ 30 for each day on the job not billed
/// (days in housing are unpaid);</item>
/// <item>a supplier's worker: the agreed cost — fixed monthly (the days in housing are paid too: the idle cost) or by
/// the days on the job;</item>
/// <item>expenses: a worker's are shared by the projects they worked on, a project's are its own, the rest the company's.</item>
/// </list>
/// </summary>
internal sealed class ProfitReport(
    LegacyInvoices legacy,
    IWorkforceReport workforce,
    IWorkforceDirectory directory,
    IWorkerCosts costs,
    IExpenseLedger expenses,
    IReferenceData referenceData,
    IProjectDirectory projects,
    ITenantContext tenant,
    IMemoryCache cache,
    IClock clock,
    IOptions<ReportsOptions> options)
{
    /// <summary>The ended months that have project invoices, the latest first.</summary>
    public async Task<IReadOnlyList<DateOnly>> InvoicedMonthsAsync(CancellationToken cancellationToken)
    {
        var today = clock.Today;
        return (await legacy.LoadAsync(cancellationToken).ConfigureAwait(false)).Invoices
            .Select(i => new DateOnly(i.To.Year, i.To.Month, 1)).Distinct()
            .Where(m => m.AddMonths(1) <= today).OrderDescending().ToList();
    }

    public Task<MonthProfit> MonthAsync(DateOnly month, CancellationToken cancellationToken)
    {
        var first = new DateOnly(month.Year, month.Month, 1);
        return cache.GetOrCreateAsync($"reports.profit.{tenant.TenantId}.{first:yyyyMM}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            return await ComputeAsync(first, cancellationToken).ConfigureAwait(false);
        })!;
    }

    private async Task<MonthProfit> ComputeAsync(DateOnly first, CancellationToken cancellationToken)
    {
        var last = first.AddMonths(1).AddDays(-1);
        var monthDays = last.Day;
        var finance = await legacy.LoadAsync(cancellationToken).ConfigureAwait(false);
        var invoices = finance.Invoices.Where(i => i.To >= first && i.To <= last).ToDictionary(i => i.CrmId);
        var lines = finance.Lines.Where(l => invoices.ContainsKey(l.InvoiceCrmId)).ToList();

        // Every worker with days in the month or a line on its invoices.
        var days = (await workforce.DaysAsync(first, last, cancellationToken).ConfigureAwait(false)).ToDictionary(d => d.CrmId);
        var billedOnly = lines.Select(l => l.WorkerCrmId).Where(id => !days.ContainsKey(id)).Distinct().ToList();
        if (billedOnly.Count > 0)
        {
            foreach (var card in await directory.CardsByCrmAsync([], billedOnly, cancellationToken).ConfigureAwait(false))
            {
                days.TryAdd(card.CrmId, new WorkerDays(card.Id, card.CrmId, card.WorkerNo, card.Name, card.Sponsor, card.TotalSalary, [], 0));
            }
        }

        var cost = (await costs.CostsAsync(days.Values.Select(d => d.WorkerId).ToList(), last, cancellationToken).ConfigureAwait(false)).ToDictionary(c => c.WorkerId);
        var shares = await expenses.SharesAsync(first, last, cancellationToken).ConfigureAwait(false);
        var categories = (await referenceData.ListAllAsync("expense_categories", cancellationToken).ConfigureAwait(false))
            .GroupBy(c => c.Code, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        ExpenseItemDto Item(ExpenseShare s) => categories.TryGetValue(s.Category, out var c)
            ? new ExpenseItemDto(s.ExpenseNo, s.Category, c.NameAr, c.NameEn, Math.Round(s.Amount, 2))
            : new ExpenseItemDto(s.ExpenseNo, s.Category, s.Category, s.Category, Math.Round(s.Amount, 2));
        var workerItems = shares.Where(s => s.ProjectCrmId is null && s.WorkerId is not null).ToLookup(s => s.WorkerId!.Value, Item);
        var projectItems = shares.Where(s => s.ProjectCrmId is not null).ToLookup(s => s.ProjectCrmId!.Value, Item);
        var workerExpenses = shares.Where(s => s.ProjectCrmId is null && s.WorkerId is not null).GroupBy(s => s.WorkerId!.Value).ToDictionary(g => g.Key, g => g.Sum(s => s.Amount));
        var projectExpenses = shares.Where(s => s.ProjectCrmId is not null).GroupBy(s => s.ProjectCrmId!.Value).ToDictionary(g => g.Key, g => g.Sum(s => s.Amount));
        var linesByWorker = lines.ToLookup(l => l.WorkerCrmId);

        var workers = new List<WorkerMonth>();
        var allocated = new Dictionary<Guid, Slot>();
        decimal companySalaries = 0, supplierCosts = 0, idle = 0, allocatedExpenses = 0, unallocated = 0;
        var idleDays = 0;
        foreach (var d in days.Values)
        {
            var info = cost.GetValueOrDefault(d.WorkerId);
            var source = info?.Source ?? "Unknown";
            var mine = linesByWorker[d.CrmId].ToList();
            var revenue = mine.Sum(l => l.BeforeVat);
            decimal work, idleCost = 0, billedSalary = 0, dailySalary = 0, unbilledSalary = 0;
            decimal billedDays = 0;
            int unbilledDays = 0, paidIdleDays = 0;
            var missing = false;
            if (source == "Supplier")
            {
                if (info?.SupplierMonthlyCost is { } monthly)
                {
                    var daily = monthly / monthDays;
                    work = daily * d.WorkDays;
                    if (info.ByWorkingDays != true)
                    {
                        paidIdleDays = Math.Min(d.HousingDays, Math.Max(0, monthDays - d.WorkDays));
                        idleCost = daily * paidIdleDays;
                        idleDays += d.HousingDays;
                    }
                }
                else
                {
                    work = 0;
                    missing = true;
                }

                supplierCosts += work;
                idle += idleCost;
            }
            else
            {
                // The salary billed on the lines, and a day's salary for each day on the job not billed.
                billedDays = mine.Sum(l => l.WorkingDays);
                billedSalary = mine.Sum(l => l.DueSalary);
                dailySalary = (info?.Salary ?? d.Salary) / 30m;
                unbilledDays = (int)Math.Max(0, d.WorkDays - billedDays);
                unbilledSalary = dailySalary * unbilledDays;
                work = billedSalary + unbilledSalary;
                companySalaries += work;
            }

            var expense = workerExpenses.GetValueOrDefault(d.WorkerId);
            if (d.WorkDays > 0)
            {
                allocatedExpenses += expense;
            }
            else
            {
                unallocated += expense;
            }

            workers.Add(new WorkerMonth(d.WorkerId, d.WorkerNo, d.Name, source, info?.Supplier ?? d.Sponsor, d.Projects, d.WorkDays, d.HousingDays,
                Math.Round(revenue, 2), Math.Round(work, 2), Math.Round(idleCost, 2), Math.Round(expense, 2), missing,
                new CostPartsDto(Math.Round(billedSalary, 2), billedDays, unbilledDays, Math.Round(dailySalary, 2), Math.Round(unbilledSalary, 2),
                    source == "Supplier" ? info?.SupplierMonthlyCost : null, source == "Supplier" ? info?.ByWorkingDays : null, monthDays,
                    source == "Supplier" ? Math.Round(work, 2) : 0, paidIdleDays, Math.Round(idleCost, 2), workerItems[d.WorkerId].ToList())));

            // The work cost and the worker's expenses go to their projects by the days on each.
            foreach (var p in d.Projects)
            {
                var slot = allocated.TryGetValue(p.ProjectCrmId ?? Guid.Empty, out var found) ? found : allocated[p.ProjectCrmId ?? Guid.Empty] = new Slot();
                var part = d.WorkDays > 0 ? (work + expense) * p.Days / d.WorkDays : 0;
                slot.Cost += part;
                if (source == "Supplier")
                {
                    slot.Supplier += part;
                }
                else
                {
                    slot.Company += part;
                }

                slot.Workers.Add(d.WorkerId);
                slot.Days += p.Days;
                slot.Missing += missing ? 1 : 0;
            }
        }

        // The projects: revenue from their invoices, cost from the workers' days on them and their own expenses.
        var revenueByProject = invoices.Values.GroupBy(i => i.ProjectCrmId ?? Guid.Empty).ToDictionary(g => g.Key, g => g.Sum(i => i.BeforeVat));
        var billedWorkersByProject = lines.GroupBy(l => invoices[l.InvoiceCrmId].ProjectCrmId ?? Guid.Empty).ToDictionary(g => g.Key, g => g.Select(l => l.WorkerCrmId).ToHashSet());
        var crmByWorker = days.Values.ToDictionary(d => d.WorkerId, d => d.CrmId);
        var keys = revenueByProject.Keys.Concat(allocated.Keys).Concat(projectExpenses.Keys).Distinct().ToList();
        var ids = keys.Where(k => k != Guid.Empty).ToList();
        var known = (await projects.FindAsync([], ids, cancellationToken).ConfigureAwait(false)).ToDictionary(p => p.CrmId);
        var invoiceNames = invoices.Values.Where(i => i.ProjectCrmId is not null).GroupBy(i => i.ProjectCrmId!.Value).ToDictionary(g => g.Key, g => g.First().ProjectName);
        var places = days.Values.SelectMany(d => d.Projects).Where(p => p.ProjectCrmId is not null && p.Place is not null).GroupBy(p => p.ProjectCrmId!.Value).ToDictionary(g => g.Key, g => g.First().Place!);
        var projectRows = new List<ProjectMonth>();
        foreach (var key in keys)
        {
            Guid? id = key == Guid.Empty ? null : key;
            var info = known.GetValueOrDefault(key);
            var slot = allocated.GetValueOrDefault(key) ?? new Slot();
            if (options.Value.IsExcluded(info?.Code))
            {
                continue;
            }

            var billed = billedWorkersByProject.GetValueOrDefault(key) ?? [];
            var unbilled = slot.Workers.Count(w => !billed.Contains(crmByWorker[w]));
            projectRows.Add(new ProjectMonth(
                id, info?.Name ?? invoiceNames.GetValueOrDefault(key) ?? places.GetValueOrDefault(key) ?? "—",
                string.IsNullOrWhiteSpace(info?.Manager) ? null : info.Manager.Trim(),
                Math.Max(slot.Workers.Count, billed.Count), slot.Days, Math.Round(revenueByProject.GetValueOrDefault(key), 2),
                Math.Round(slot.Cost, 2), Math.Round(projectExpenses.GetValueOrDefault(key), 2), unbilled, slot.Missing,
                Math.Round(slot.Company, 2), Math.Round(slot.Supplier, 2), key == Guid.Empty ? [] : projectItems[key].ToList()));
        }

        return new MonthProfit(
            first,
            Math.Round(invoices.Values.Sum(i => i.BeforeVat), 2),
            Math.Round(workers.Where(w => w.CostMissing).Sum(w => w.Revenue), 2),
            workers.Count(w => w.CostMissing),
            Math.Round(companySalaries, 2), Math.Round(supplierCosts, 2), Math.Round(idle, 2), Math.Round(allocatedExpenses, 2),
            Math.Round(projectExpenses.Values.Sum(), 2),
            Math.Round(shares.Where(s => s.ProjectCrmId is null && s.WorkerId is null).Sum(s => s.Amount), 2),
            Math.Round(unallocated, 2), idleDays,
            workers, projectRows.OrderBy(p => p.Profit).ToList());
    }

    private sealed class Slot
    {
        public decimal Cost { get; set; }

        public decimal Company { get; set; }

        public decimal Supplier { get; set; }

        public HashSet<Guid> Workers { get; } = [];

        public int Days { get; set; }

        public int Missing { get; set; }
    }

    internal static string Key(DateOnly month) => month.ToString("yyyy-MM", CultureInfo.InvariantCulture);
}
