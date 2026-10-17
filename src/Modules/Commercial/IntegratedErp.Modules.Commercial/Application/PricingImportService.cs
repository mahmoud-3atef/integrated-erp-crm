using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Domain;
using IntegratedErp.Modules.Commercial.Infrastructure;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Commercial.Application;

/// <summary>
/// Derives the price packages from the prices on the open work starts (docs/03-migration-plan/02 "أسعار المباشرات
/// المفتوحة"): every worker on the job gets the price of their latest work start on their project (or their default
/// service price when it has none); the most common price of each project × profession × nationality is the package
/// and the others are special prices. On Cost Plus contracts the salary passes through, so the package is the fee
/// above the salary. Runs after the workers and projects are imported, after every sync: it reads the whole copy (a few
/// thousand records), so a manual merge of professions or nationalities regroups the packages at once.
/// </summary>
internal sealed class PricingImportService(CommercialDbContext db, ICrmStaging staging, IWorkforceDirectory workforce, IClock clock) : ICrmStagingConsumer
{
    private static readonly TimeSpan Riyadh = TimeSpan.FromHours(3);

    public string Name => "price packages";

    public async Task<string> ApplyAsync(CancellationToken cancellationToken)
    {
        var state = await db.PricingImports.FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (state is null)
        {
            state = new PricingImport();
            db.PricingImports.Add(state);
        }

        var now = clock.UtcNow;
        var projects = await db.Projects.AsNoTracking().Where(p => !p.RemovedInCrm)
            .Join(db.Contracts, p => p.ContractId, c => c.Id, (p, c) => new { p.Id, p.CrmId, p.ContractId, c.Type })
            .ToDictionaryAsync(p => p.CrmId, cancellationToken).ConfigureAwait(false);

        // The latest active work start of each worker on each project.
        var workStarts = new Dictionary<(Guid Worker, Guid Project), WorkStart>();
        var allWorkStarts = await staging.ChangedSinceAsync("new_empwork", null, cancellationToken).ConfigureAwait(false);
        foreach (var record in allWorkStarts.Where(r => !r.IsDeleted))
        {
            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            if (Int(row, "statecode") is not (null or 0) || Id(row, "new_employeeid") is not { } worker || Id(row, "new_projectid") is not { } project)
            {
                continue;
            }

            var start = new WorkStart(
                Text(row, "new_number"), Date(row, "new_startdate"), Text(row, "createdon") ?? string.Empty,
                Money(row, "new_serviceprice") ?? Money(row, "new_totalservices"),
                Money(row, "new_housing") ?? Money(row, "new_phallaowance") ?? 0,
                Money(row, "new_transportation") ?? Money(row, "new_transportationallowance") ?? 0);
            if (!workStarts.TryGetValue((worker, project), out var current) || start.IsLaterThan(current))
            {
                workStarts[(worker, project)] = start;
            }
        }

        // The worker's default service price, for work starts without a price.
        var allWorkers = await staging.ChangedSinceAsync("new_employee", null, cancellationToken).ConfigureAwait(false);
        var defaults = new Dictionary<Guid, decimal>();
        foreach (var record in allWorkers.Where(r => !r.IsDeleted))
        {
            using var document = JsonDocument.Parse(record.Payload);
            if (Money(document.RootElement, "new_totalservices") is { } price and > 0)
            {
                defaults[record.CrmId] = price;
            }
        }

        // Each worker's current price.
        var existingPrices = await db.WorkerPrices.ToDictionaryAsync(p => p.WorkerCrmId, cancellationToken).ConfigureAwait(false);
        var priced = new List<(WorkerPrice Price, Guid ContractId, PricingBasis Basis)>();
        foreach (var worker in await workforce.WorkingAsync(cancellationToken).ConfigureAwait(false))
        {
            if (!projects.TryGetValue(worker.ProjectCrmId, out var project))
            {
                continue; // a project that is not brought over (created before 2025) or removed in the CRM
            }

            workStarts.TryGetValue((worker.CrmId, worker.ProjectCrmId), out var start);
            decimal? price = start?.Price is > 0 ? start.Price : null;
            var fromDefault = false;
            if (price is null && defaults.TryGetValue(worker.CrmId, out var fallback))
            {
                price = fallback;
                fromDefault = true;
            }

            if (!existingPrices.Remove(worker.CrmId, out var workerPrice))
            {
                workerPrice = new WorkerPrice(worker.Id, worker.CrmId);
                db.WorkerPrices.Add(workerPrice);
            }

            workerPrice.Update(new WorkerPriceSnapshot(
                worker.Id, worker.WorkerNo, worker.Name, project.Id, worker.ProfessionCode, worker.NationalityCode, Math.Round(worker.TotalSalary, 2),
                price, start?.Housing ?? 0, start?.Transport ?? 0, start?.Number, start?.StartedOn ?? worker.JoinedOn, fromDefault));
            priced.Add((workerPrice, project.ContractId, project.Type == ContractType.CostPlus ? PricingBasis.SalaryPlusFee : PricingBasis.FixedTotal));
        }

        db.WorkerPrices.RemoveRange(existingPrices.Values); // no longer on the job

        // Packages: the most common price of each project × profession × nationality.
        var existingPackages = (await db.PricePackages.ToListAsync(cancellationToken).ConfigureAwait(false)).ToDictionary(p => (p.ProjectId, p.ProfessionCode, p.NationalityCode));
        int total = 0, added = 0, removed = 0, special = 0, missing = 0, onPackage = 0;
        foreach (var group in priced.GroupBy(p => (p.Price.ProjectId, p.Price.ProfessionCode, p.Price.NationalityCode)))
        {
            var basis = group.First().Basis;
            var withPrice = group.Where(p => p.Price.ServicePrice is not null).ToList();
            var chosen = withPrice
                .GroupBy(p => Variant(p.Price, basis))
                .OrderByDescending(g => g.Count())
                .ThenByDescending(g => g.Max(p => p.Price.StartedOn ?? DateOnly.MinValue))
                .ThenByDescending(g => g.Key.Amount)
                .FirstOrDefault();
            existingPackages.Remove(group.Key, out var package);
            if (chosen is null)
            {
                if (package is not null)
                {
                    db.PricePackages.Remove(package);
                    removed++;
                }

                foreach (var (price, _, _) in group)
                {
                    price.Classify(WorkerPriceKind.Missing, null);
                    missing++;
                }

                continue;
            }

            if (package is null)
            {
                package = new PricePackage(group.Key.ProjectId, group.First().ContractId, group.Key.ProfessionCode, group.Key.NationalityCode);
                db.PricePackages.Add(package);
                added++;
            }

            var specials = withPrice.Count - chosen.Count();
            package.Derive(basis, chosen.Key.Amount, chosen.Key.Housing, chosen.Key.Transport, chosen.Count(), specials, chosen.Min(p => p.Price.StartedOn), now);
            foreach (var (price, _, _) in group)
            {
                var kind = price.ServicePrice is null ? WorkerPriceKind.Missing
                    : Variant(price, basis) == chosen.Key ? WorkerPriceKind.Package
                    : WorkerPriceKind.Special;
                price.Classify(kind, package.Id);
            }

            total++;
            onPackage += chosen.Count();
            special += specials;
            missing += group.Count() - withPrice.Count;
        }

        db.PricePackages.RemoveRange(existingPackages.Values);
        removed += existingPackages.Count;
        var summary = $"{total} packages ({added} new, {removed} removed); "
            + $"workers: {onPackage} on a package, {special} special prices, {missing} without a price";
        state.Derived(now, summary);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return summary;
    }

    /// <summary>What a worker's price is compared on: the total, or the fee above the salary on Cost Plus.</summary>
    private static (decimal Amount, decimal Housing, decimal Transport) Variant(WorkerPrice price, PricingBasis basis) =>
        (basis == PricingBasis.SalaryPlusFee ? price.ServicePrice!.Value - price.Salary : price.ServicePrice!.Value, price.Housing, price.Transport);

    private sealed record WorkStart(string? Number, DateOnly? StartedOn, string CreatedOn, decimal? Price, decimal Housing, decimal Transport)
    {
        public bool IsLaterThan(WorkStart other) =>
            (StartedOn ?? DateOnly.MinValue).CompareTo(other.StartedOn ?? DateOnly.MinValue) is var byStart && byStart != 0
                ? byStart > 0
                : string.CompareOrdinal(CreatedOn, other.CreatedOn) > 0;
    }

    private static string? Text(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString()!.Trim() : null;

    private static Guid? Id(JsonElement row, string field) => Guid.TryParse(Text(row, field), out var id) ? id : null;

    private static int? Int(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static decimal? Money(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) ? v.ValueKind switch
        {
            JsonValueKind.Number when v.TryGetDecimal(out var d) => Math.Round(d, 2),
            JsonValueKind.String when decimal.TryParse(v.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) => Math.Round(d, 2),
            _ => null,
        } : null;

    private static DateOnly? Date(JsonElement row, string field) =>
        DateTimeOffset.TryParse(Text(row, field), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at)
            ? DateOnly.FromDateTime(at.ToOffset(Riyadh).DateTime)
            : null;
}
