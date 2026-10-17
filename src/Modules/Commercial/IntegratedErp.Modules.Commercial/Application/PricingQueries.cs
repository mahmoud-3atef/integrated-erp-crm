using IntegratedErp.Modules.Commercial.Domain;
using IntegratedErp.Modules.Commercial.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Commercial.Application;

public sealed record PackageRowDto(
    Guid Id,
    Guid ProjectId,
    string ProjectCode,
    string ProjectName,
    string? CustomerName,
    string? ContractType,
    string? ProfessionAr,
    string? ProfessionEn,
    string? NationalityAr,
    string? NationalityEn,
    string Basis,
    decimal? TotalPrice,
    decimal? ServiceFee,
    decimal Housing,
    decimal Transport,
    int Workers,
    int SpecialWorkers,
    int MissingWorkers,
    DateOnly? Since);

/// <summary>The prices page's cards: packages, workers on a package, at a special price, and without a price.</summary>
public sealed record PricingTotalsDto(int Packages, int Projects, int OnPackage, int Special, int Missing);

public sealed record PackageListDto(int Total, PricingTotalsDto Totals, IReadOnlyList<PackageRowDto> Items);

public sealed record WorkerPriceDto(
    Guid Id,
    Guid WorkerId,
    string WorkerNo,
    string Name,
    Guid ProjectId,
    string ProjectName,
    string? ProfessionAr,
    string? ProfessionEn,
    string? NationalityAr,
    string? NationalityEn,
    decimal Salary,
    decimal? ServicePrice,
    decimal Housing,
    decimal Transport,
    string Kind,
    Guid? PackageId,
    decimal? PackagePrice,
    decimal? Difference,
    string? WorkStartNo,
    DateOnly? StartedOn,
    bool FromWorkerDefault);

public sealed record WorkerPriceListDto(int Total, IReadOnlyList<WorkerPriceDto> Items);

public sealed record ProjectPricesDto(IReadOnlyList<PackageRowDto> Packages, IReadOnlyList<WorkerPriceDto> Workers);

/// <summary>Price packages and worker prices of the current company.</summary>
internal sealed class PricingQueries(CommercialDbContext db, IReferenceData reference)
{
    public async Task<PackageListDto> PackagesAsync(ListFilter filter, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        var rows = await PackageRowsAsync(null, cancellationToken).ConfigureAwait(false);
        var prices = await db.WorkerPrices.AsNoTracking().GroupBy(p => p.Kind).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken).ConfigureAwait(false);
        var totals = new PricingTotalsDto(
            rows.Count, rows.Select(r => r.ProjectId).Distinct().Count(),
            prices.GetValueOrDefault(WorkerPriceKind.Package), prices.GetValueOrDefault(WorkerPriceKind.Special), prices.GetValueOrDefault(WorkerPriceKind.Missing));

        IEnumerable<PackageRowDto> query = rows;
        if (filter.Search?.Trim() is { Length: > 0 } search)
        {
            query = query.Where(r => Has(r.ProjectCode, search) || Has(r.ProjectName, search) || Has(r.CustomerName, search)
                || Has(r.ProfessionAr, search) || Has(r.ProfessionEn, search) || Has(r.NationalityAr, search) || Has(r.NationalityEn, search));
        }

        query = filter.Status switch
        {
            "special" => query.Where(r => r.SpecialWorkers > 0),
            "missing" => query.Where(r => r.MissingWorkers > 0),
            "costPlus" => query.Where(r => r.Basis == nameof(PricingBasis.SalaryPlusFee)),
            "fixedTotal" => query.Where(r => r.Basis == nameof(PricingBasis.FixedTotal)),
            _ => query,
        };
        query = (filter.Sort, filter.Descending) switch
        {
            ("project", false) => query.OrderBy(r => r.ProjectName, StringComparer.OrdinalIgnoreCase),
            ("project", true) => query.OrderByDescending(r => r.ProjectName, StringComparer.OrdinalIgnoreCase),
            ("price", false) => query.OrderBy(r => r.TotalPrice ?? r.ServiceFee),
            ("price", true) => query.OrderByDescending(r => r.TotalPrice ?? r.ServiceFee),
            ("special", false) => query.OrderBy(r => r.SpecialWorkers),
            ("special", true) => query.OrderByDescending(r => r.SpecialWorkers),
            ("workers", false) => query.OrderBy(r => r.Workers),
            _ => query.OrderByDescending(r => r.Workers + r.SpecialWorkers + r.MissingWorkers),
        };
        var list = query.ToList();
        var pageSize = Math.Clamp(filter.PageSize, 10, 200);
        return new PackageListDto(list.Count, totals, list.Skip(Math.Max(0, filter.Page - 1) * pageSize).Take(pageSize).ToList());
    }

    /// <summary>Workers at a special price or without one (status "special" / "missing"; both when empty).</summary>
    public async Task<WorkerPriceListDto> ExceptionsAsync(ListFilter filter, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        var kinds = filter.Status switch
        {
            "special" => new[] { WorkerPriceKind.Special },
            "missing" => new[] { WorkerPriceKind.Missing },
            _ => new[] { WorkerPriceKind.Special, WorkerPriceKind.Missing },
        };
        var rows = await WorkerRowsAsync(null, kinds, cancellationToken).ConfigureAwait(false);
        IEnumerable<WorkerPriceDto> query = rows;
        if (filter.Search?.Trim() is { Length: > 0 } search)
        {
            query = query.Where(r => Has(r.WorkerNo, search) || Has(r.Name, search) || Has(r.ProjectName, search)
                || Has(r.ProfessionAr, search) || Has(r.ProfessionEn, search) || Has(r.NationalityAr, search) || Has(r.NationalityEn, search));
        }

        query = (filter.Sort, filter.Descending) switch
        {
            ("name", false) => query.OrderBy(r => r.Name, StringComparer.OrdinalIgnoreCase),
            ("name", true) => query.OrderByDescending(r => r.Name, StringComparer.OrdinalIgnoreCase),
            ("difference", false) => query.OrderBy(r => r.Difference ?? decimal.MaxValue),
            ("difference", true) => query.OrderByDescending(r => r.Difference.HasValue ? Math.Abs(r.Difference.Value) : decimal.MinValue),
            _ => query.OrderBy(r => r.ProjectName, StringComparer.OrdinalIgnoreCase).ThenBy(r => r.Name, StringComparer.OrdinalIgnoreCase),
        };
        var list = query.ToList();
        var pageSize = Math.Clamp(filter.PageSize, 10, 200);
        return new WorkerPriceListDto(list.Count, list.Skip(Math.Max(0, filter.Page - 1) * pageSize).Take(pageSize).ToList());
    }

    public async Task<ProjectPricesDto?> ProjectAsync(Guid projectId, CancellationToken cancellationToken)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == projectId, cancellationToken).ConfigureAwait(false))
        {
            return null;
        }

        var packages = (await PackageRowsAsync(projectId, cancellationToken).ConfigureAwait(false))
            .OrderByDescending(p => p.Workers + p.SpecialWorkers + p.MissingWorkers).ToList();
        var workers = (await WorkerRowsAsync(projectId, null, cancellationToken).ConfigureAwait(false))
            .OrderBy(w => w.Kind == nameof(WorkerPriceKind.Package)).ThenBy(w => w.Name, StringComparer.OrdinalIgnoreCase).ToList();
        return new ProjectPricesDto(packages, workers);
    }

    private async Task<List<PackageRowDto>> PackageRowsAsync(Guid? projectId, CancellationToken cancellationToken)
    {
        var names = await NamesAsync(cancellationToken).ConfigureAwait(false);
        var missing = await db.WorkerPrices.AsNoTracking()
            .Where(p => p.Kind == WorkerPriceKind.Missing && p.PackageId != null && (projectId == null || p.ProjectId == projectId))
            .GroupBy(p => p.PackageId!.Value).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken).ConfigureAwait(false);
        var data = await db.PricePackages.AsNoTracking()
            .Where(p => projectId == null || p.ProjectId == projectId)
            .Join(db.Projects, p => p.ProjectId, pr => pr.Id, (p, pr) => new { Package = p, Project = pr })
            .Join(db.Contracts, x => x.Package.ContractId, c => c.Id, (x, c) => new { x.Package, x.Project, c.Type })
            .GroupJoin(db.Customers, x => x.Project.CustomerId, c => c.Id, (x, cs) => new { x.Package, x.Project, x.Type, Customers = cs })
            .SelectMany(x => x.Customers.DefaultIfEmpty(), (x, c) => new { x.Package, x.Project, x.Type, CustomerName = c == null ? null : c.Name })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return data.Select(x =>
            {
                var profession = names.Profession(x.Package.ProfessionCode);
                var nationality = names.Nationality(x.Package.NationalityCode);
                return new PackageRowDto(
                    x.Package.Id, x.Project.Id, x.Project.Code, x.Project.Name, x.CustomerName, x.Type?.ToString(),
                    profession?.NameAr, profession?.NameEn, nationality?.NameAr, nationality?.NameEn,
                    x.Package.Basis.ToString(), x.Package.TotalPrice, x.Package.ServiceFee, x.Package.Housing, x.Package.Transport,
                    x.Package.Workers, x.Package.SpecialWorkers, missing.GetValueOrDefault(x.Package.Id), x.Package.Since);
            })
            .ToList();
    }

    private async Task<List<WorkerPriceDto>> WorkerRowsAsync(Guid? projectId, WorkerPriceKind[]? kinds, CancellationToken cancellationToken)
    {
        var names = await NamesAsync(cancellationToken).ConfigureAwait(false);
        var data = await db.WorkerPrices.AsNoTracking()
            .Where(p => (projectId == null || p.ProjectId == projectId) && (kinds == null || kinds.Contains(p.Kind)))
            .Join(db.Projects, p => p.ProjectId, pr => pr.Id, (p, pr) => new { Price = p, ProjectName = pr.Name })
            .GroupJoin(db.PricePackages, x => x.Price.PackageId, pk => pk.Id, (x, pks) => new { x.Price, x.ProjectName, Packages = pks })
            .SelectMany(x => x.Packages.DefaultIfEmpty(), (x, package) => new { x.Price, x.ProjectName, Package = package })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return data.Select(x =>
            {
                var p = x.Price;
                var profession = names.Profession(p.ProfessionCode);
                var nationality = names.Nationality(p.NationalityCode);
                decimal? packagePrice = x.Package?.PriceFor(p.Salary);
                return new WorkerPriceDto(
                    p.Id, p.WorkerId, p.WorkerNo, p.Name, p.ProjectId, x.ProjectName,
                    profession?.NameAr, profession?.NameEn, nationality?.NameAr, nationality?.NameEn,
                    p.Salary, p.ServicePrice, p.Housing, p.Transport, p.Kind.ToString(), p.PackageId, packagePrice,
                    p.ServicePrice is { } price && packagePrice is { } expected ? price - expected : null,
                    p.WorkStartNo, p.StartedOn, p.FromWorkerDefault);
            })
            .ToList();
    }

    private async Task<Names> NamesAsync(CancellationToken cancellationToken) => new(
        (await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal),
        (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal));

    private sealed record Names(Dictionary<string, ReferenceItemInfo> Professions, Dictionary<string, ReferenceItemInfo> Nationalities)
    {
        public ReferenceItemInfo? Profession(string? code) => code is null ? null : Professions.GetValueOrDefault(code);

        public ReferenceItemInfo? Nationality(string? code) => code is null ? null : Nationalities.GetValueOrDefault(code);
    }

    private static bool Has(string? value, string search) => value?.Contains(search, StringComparison.OrdinalIgnoreCase) == true;
}
