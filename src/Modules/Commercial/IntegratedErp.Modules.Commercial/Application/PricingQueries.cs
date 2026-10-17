using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Domain;
using IntegratedErp.Modules.Commercial.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Commercial.Application;

public sealed record PackageRowDto(
    Guid Id,
    string PackageNo,
    Guid? ProjectId,
    string? ProjectCode,
    string? ProjectName,
    string? CustomerName,
    string? ContractType,
    string ProfessionCode,
    string? ProfessionAr,
    string? ProfessionEn,
    string? NationalityCode,
    string? NationalityAr,
    string? NationalityEn,
    decimal Salary,
    decimal ServiceFee,
    decimal Housing,
    bool HousingBillable,
    decimal Transport,
    bool TransportBillable,
    decimal TotalPrice,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    bool IsActive,
    bool IsCurrent,
    int Workers,
    string? Notes);

/// <summary>The prices page's cards: active packages, and the workers on the job compared with them.</summary>
public sealed record PricingTotalsDto(int Packages, int OnPackage, int Special, int WithoutPackage, int WithoutPrice);

public sealed record PackageListDto(int Total, PricingTotalsDto Totals, IReadOnlyList<PackageRowDto> Items);

public sealed record SuggestionRowDto(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    string? CustomerName,
    string? ContractType,
    string? ProfessionCode,
    string? ProfessionAr,
    string? ProfessionEn,
    string? NationalityCode,
    string? NationalityAr,
    string? NationalityEn,
    decimal TotalPrice,
    decimal Salary,
    decimal? FeeAboveSalary,
    decimal Housing,
    decimal Transport,
    int Workers,
    int OtherPrices,
    int WithoutPrice,
    DateOnly? Since,
    Guid? CoveredById,
    string? CoveredByNo);

public sealed record SuggestionListDto(int Total, int Covered, IReadOnlyList<SuggestionRowDto> Items);

/// <summary>Worker price status against the packages: Package, Special, NoPackage, Missing (no price at all).</summary>
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
    string Status,
    Guid? PackageId,
    string? PackageNo,
    decimal? PackagePrice,
    decimal? Difference,
    string? WorkStartNo,
    DateOnly? StartedOn,
    bool FromWorkerDefault);

public sealed record WorkerPriceListDto(int Total, IReadOnlyList<WorkerPriceDto> Items);

public sealed record ProjectPricesDto(IReadOnlyList<PackageRowDto> Packages, IReadOnlyList<SuggestionRowDto> Suggestions, IReadOnlyList<WorkerPriceDto> Workers);

public sealed record OptionDto(string Code, string NameAr, string NameEn);

public sealed record ProjectOptionDto(Guid Id, string Code, string Name, string? ContractType);

public sealed record PackageOptionsDto(IReadOnlyList<ProjectOptionDto> Projects, IReadOnlyList<OptionDto> Nationalities, IReadOnlyList<OptionDto> Professions);

/// <summary>Price packages, the suggestions from the old system's prices, and each worker's price compared with them.</summary>
internal sealed class PricingQueries(CommercialDbContext db, IReferenceData reference, IClock clock)
{
    public const string StatusPackage = "Package";
    public const string StatusSpecial = "Special";
    public const string StatusNoPackage = "NoPackage";
    public const string StatusMissing = "Missing";

    public async Task<PackageListDto> PackagesAsync(ListFilter filter, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        var context = await LoadAsync(cancellationToken).ConfigureAwait(false);
        var workers = WorkerRows(context, null);
        var rows = PackageRows(context, workers, null);
        var totals = new PricingTotalsDto(
            rows.Count(r => r.IsCurrent),
            workers.Count(w => w.Status == StatusPackage),
            workers.Count(w => w.Status == StatusSpecial),
            workers.Count(w => w.Status == StatusNoPackage),
            workers.Count(w => w.Status == StatusMissing));

        IEnumerable<PackageRowDto> query = rows;
        if (filter.Search?.Trim() is { Length: > 0 } search)
        {
            query = query.Where(r => Has(r.PackageNo, search) || Has(r.ProjectCode, search) || Has(r.ProjectName, search) || Has(r.CustomerName, search)
                || Has(r.ProfessionAr, search) || Has(r.ProfessionEn, search) || Has(r.NationalityAr, search) || Has(r.NationalityEn, search));
        }

        query = filter.Status switch
        {
            "current" => query.Where(r => r.IsCurrent),
            "inactive" => query.Where(r => !r.IsActive),
            "general" => query.Where(r => r.ProjectId == null),
            _ => query,
        };
        query = (filter.Sort, filter.Descending) switch
        {
            ("project", false) => query.OrderBy(r => r.ProjectName ?? string.Empty, StringComparer.OrdinalIgnoreCase),
            ("project", true) => query.OrderByDescending(r => r.ProjectName ?? string.Empty, StringComparer.OrdinalIgnoreCase),
            ("price", false) => query.OrderBy(r => r.TotalPrice),
            ("price", true) => query.OrderByDescending(r => r.TotalPrice),
            ("workers", false) => query.OrderBy(r => r.Workers),
            ("workers", true) => query.OrderByDescending(r => r.Workers),
            (_, false) => query.OrderBy(r => r.PackageNo, StringComparer.Ordinal),
            _ => query.OrderByDescending(r => r.PackageNo, StringComparer.Ordinal),
        };
        var list = query.ToList();
        var pageSize = Math.Clamp(filter.PageSize, 10, 200);
        return new PackageListDto(list.Count, totals, list.Skip(Math.Max(0, filter.Page - 1) * pageSize).Take(pageSize).ToList());
    }

    public async Task<SuggestionListDto> SuggestionsAsync(ListFilter filter, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        var context = await LoadAsync(cancellationToken).ConfigureAwait(false);
        var rows = SuggestionRows(context, null);
        IEnumerable<SuggestionRowDto> query = rows;
        if (filter.Search?.Trim() is { Length: > 0 } search)
        {
            query = query.Where(r => Has(r.ProjectName, search) || Has(r.CustomerName, search)
                || Has(r.ProfessionAr, search) || Has(r.ProfessionEn, search) || Has(r.NationalityAr, search) || Has(r.NationalityEn, search));
        }

        query = filter.Status switch
        {
            "open" => query.Where(r => r.CoveredById is null),
            "covered" => query.Where(r => r.CoveredById is not null),
            _ => query,
        };
        var list = query.OrderBy(r => r.CoveredById is not null).ThenByDescending(r => r.Workers + r.OtherPrices).ToList();
        var pageSize = Math.Clamp(filter.PageSize, 10, 200);
        return new SuggestionListDto(list.Count, rows.Count(r => r.CoveredById is not null), list.Skip(Math.Max(0, filter.Page - 1) * pageSize).Take(pageSize).ToList());
    }

    /// <summary>Workers by price status ("special", "noPackage", "missing", "package"; all but "package" when empty).</summary>
    public async Task<WorkerPriceListDto> WorkersAsync(ListFilter filter, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        var context = await LoadAsync(cancellationToken).ConfigureAwait(false);
        IEnumerable<WorkerPriceDto> query = WorkerRows(context, null);
        query = filter.Status switch
        {
            "special" => query.Where(r => r.Status == StatusSpecial),
            "noPackage" => query.Where(r => r.Status == StatusNoPackage),
            "missing" => query.Where(r => r.Status == StatusMissing),
            "package" => query.Where(r => r.Status == StatusPackage),
            _ => query.Where(r => r.Status != StatusPackage),
        };
        if (filter.Search?.Trim() is { Length: > 0 } search)
        {
            query = query.Where(r => Has(r.WorkerNo, search) || Has(r.Name, search) || Has(r.ProjectName, search)
                || Has(r.ProfessionAr, search) || Has(r.ProfessionEn, search) || Has(r.NationalityAr, search) || Has(r.NationalityEn, search));
        }

        query = (filter.Sort, filter.Descending) switch
        {
            ("name", false) => query.OrderBy(r => r.Name, StringComparer.OrdinalIgnoreCase),
            ("name", true) => query.OrderByDescending(r => r.Name, StringComparer.OrdinalIgnoreCase),
            ("difference", _) => query.OrderByDescending(r => r.Difference.HasValue ? Math.Abs(r.Difference.Value) : decimal.MinValue),
            _ => query.OrderBy(r => r.ProjectName, StringComparer.OrdinalIgnoreCase).ThenBy(r => r.Name, StringComparer.OrdinalIgnoreCase),
        };
        var list = query.ToList();
        var pageSize = Math.Clamp(filter.PageSize, 10, 200);
        return new WorkerPriceListDto(list.Count, list.Skip(Math.Max(0, filter.Page - 1) * pageSize).Take(pageSize).ToList());
    }

    /// <summary>A project's packages (its own and the general ones for its professions), suggestions and workers.</summary>
    public async Task<ProjectPricesDto?> ProjectAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var context = await LoadAsync(cancellationToken).ConfigureAwait(false);
        if (!context.Projects.ContainsKey(projectId))
        {
            return null;
        }

        var workers = WorkerRows(context, projectId);
        var professions = context.Prices.Where(p => p.ProjectId == projectId).Select(p => p.ProfessionCode).ToHashSet(StringComparer.Ordinal);
        var all = WorkerRows(context, null);
        var packages = PackageRows(context, all, projectId)
            .Concat(PackageRows(context, all, Guid.Empty).Where(p => professions.Contains(p.ProfessionCode)))
            .OrderBy(p => p.ProjectId == null).ThenByDescending(p => p.IsCurrent).ThenBy(p => p.PackageNo, StringComparer.Ordinal)
            .ToList();
        var suggestions = SuggestionRows(context, projectId).OrderBy(s => s.CoveredById is not null).ThenByDescending(s => s.Workers + s.OtherPrices).ToList();
        return new ProjectPricesDto(
            packages, suggestions,
            workers.OrderBy(w => w.Status == StatusPackage).ThenBy(w => w.Name, StringComparer.OrdinalIgnoreCase).ToList());
    }

    public async Task<PackageRowDto?> PackageAsync(Guid id, CancellationToken cancellationToken)
    {
        var context = await LoadAsync(cancellationToken).ConfigureAwait(false);
        var package = context.Packages.FirstOrDefault(p => p.Id == id);
        return package is null ? null : PackageRows(context, WorkerRows(context, null), package.ProjectId ?? Guid.Empty).Single(p => p.Id == id);
    }

    /// <summary>
    /// Choices for the package form: active projects, nationalities, and professions (those of the workers on the job
    /// and of the packages, or those matching <paramref name="search"/>).
    /// </summary>
    public async Task<PackageOptionsDto> OptionsAsync(string? search, CancellationToken cancellationToken)
    {
        var projects = await db.Projects.AsNoTracking().Where(p => !p.RemovedInCrm && p.IsActive)
            .Join(db.Contracts, p => p.ContractId, c => c.Id, (p, c) => new { p.Id, p.Code, p.Name, c.Type })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var nationalities = (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false))
            .Where(i => i.IsActive).OrderBy(i => i.NameAr, StringComparer.Ordinal).Select(i => new OptionDto(i.Code, i.NameAr, i.NameEn)).ToList();
        var allProfessions = (await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false)).Where(i => i.IsActive);
        IEnumerable<ReferenceItemInfo> professions;
        if (search?.Trim() is { Length: > 0 } text)
        {
            professions = allProfessions.Where(i => Has(i.NameAr, text) || Has(i.NameEn, text) || Has(i.Code, text)).Take(50);
        }
        else
        {
            var used = (await db.WorkerPrices.AsNoTracking().Select(p => p.ProfessionCode).Distinct().ToListAsync(cancellationToken).ConfigureAwait(false))
                .Concat(await db.PricePackages.AsNoTracking().Select(p => p.ProfessionCode).Distinct().ToListAsync(cancellationToken).ConfigureAwait(false))
                .Where(c => c is not null).ToHashSet(StringComparer.Ordinal);
            professions = allProfessions.Where(i => used.Contains(i.Code));
        }

        return new PackageOptionsDto(
            projects.OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase).Select(p => new ProjectOptionDto(p.Id, p.Code, p.Name, p.Type?.ToString())).ToList(),
            nationalities,
            professions.OrderBy(i => i.NameAr, StringComparer.Ordinal).Select(i => new OptionDto(i.Code, i.NameAr, i.NameEn)).ToList());
    }

    private async Task<Context> LoadAsync(CancellationToken cancellationToken)
    {
        var projects = await db.Projects.AsNoTracking().Where(p => !p.RemovedInCrm)
            .Join(db.Contracts, p => p.ContractId, c => c.Id, (p, c) => new { Project = p, c.Type })
            .GroupJoin(db.Customers, x => x.Project.CustomerId, c => c.Id, (x, cs) => new { x.Project, x.Type, Customers = cs })
            .SelectMany(x => x.Customers.DefaultIfEmpty(), (x, c) => new ProjectInfo(x.Project.Id, x.Project.Code, x.Project.Name, c == null ? null : c.Name, x.Type))
            .ToDictionaryAsync(p => p.Id, cancellationToken).ConfigureAwait(false);
        var packages = await db.PricePackages.AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false);
        var suggestions = await db.PriceSuggestions.AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false);
        var prices = await db.WorkerPrices.AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false);
        var professions = (await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal);
        var nationalities = (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal);
        return new Context(projects, packages, suggestions, prices, professions, nationalities, clock.Today);
    }

    /// <summary>Packages of a project (<paramref name="projectId"/>), the general ones (<see cref="Guid.Empty"/>) or all (null).</summary>
    private static List<PackageRowDto> PackageRows(Context c, List<WorkerPriceDto> workers, Guid? projectId)
    {
        var covered = workers.Where(w => w.Status == StatusPackage).GroupBy(w => w.PackageId!.Value).ToDictionary(g => g.Key, g => g.Count());
        return c.Packages
            .Where(p => projectId == null || (projectId == Guid.Empty ? p.ProjectId == null : p.ProjectId == projectId))
            .Select(p =>
            {
                var project = p.ProjectId is { } id ? c.Projects.GetValueOrDefault(id) : null;
                var profession = c.Professions.GetValueOrDefault(p.ProfessionCode);
                var nationality = p.NationalityCode is { } n ? c.Nationalities.GetValueOrDefault(n) : null;
                return new PackageRowDto(
                    p.Id, p.PackageNo, p.ProjectId, project?.Code, project?.Name, project?.CustomerName, project?.Type?.ToString(),
                    p.ProfessionCode, profession?.NameAr, profession?.NameEn, p.NationalityCode, nationality?.NameAr, nationality?.NameEn,
                    p.Salary, p.ServiceFee, p.Housing, p.HousingBillable, p.Transport, p.TransportBillable, p.TotalPrice,
                    p.ValidFrom, p.ValidTo, p.IsActive, p.IsValidOn(c.Today), covered.GetValueOrDefault(p.Id), p.Notes);
            })
            .ToList();
    }

    private static List<SuggestionRowDto> SuggestionRows(Context c, Guid? projectId) =>
        c.Suggestions
            .Where(s => projectId == null || s.ProjectId == projectId)
            .Select(s =>
            {
                var project = c.Projects.GetValueOrDefault(s.ProjectId);
                var profession = s.ProfessionCode is { } pc ? c.Professions.GetValueOrDefault(pc) : null;
                var nationality = s.NationalityCode is { } nc ? c.Nationalities.GetValueOrDefault(nc) : null;
                var covering = PackageResolution.Resolve(c.Packages, s.ProjectId, s.ProfessionCode, s.NationalityCode, c.Today);
                return new SuggestionRowDto(
                    s.Id, s.ProjectId, project?.Name ?? "—", project?.CustomerName, project?.Type?.ToString(),
                    s.ProfessionCode, profession?.NameAr, profession?.NameEn, s.NationalityCode, nationality?.NameAr, nationality?.NameEn,
                    s.TotalPrice, s.Salary, s.FeeAboveSalary, s.Housing, s.Transport, s.Workers, s.OtherPrices, s.WithoutPrice, s.Since,
                    covering?.Id, covering?.PackageNo);
            })
            .ToList();

    /// <summary>Each worker's price compared with the package that applies to them today.</summary>
    private static List<WorkerPriceDto> WorkerRows(Context c, Guid? projectId) =>
        c.Prices
            .Where(p => projectId == null || p.ProjectId == projectId)
            .Select(p =>
            {
                var project = c.Projects.GetValueOrDefault(p.ProjectId);
                var profession = p.ProfessionCode is { } pc ? c.Professions.GetValueOrDefault(pc) : null;
                var nationality = p.NationalityCode is { } nc ? c.Nationalities.GetValueOrDefault(nc) : null;
                var package = PackageResolution.Resolve(c.Packages, p.ProjectId, p.ProfessionCode, p.NationalityCode, c.Today);
                decimal? expected = package?.PriceFor(project?.Type == ContractType.CostPlus, p.Salary);
                var status = p.ServicePrice is null ? StatusMissing
                    : expected is null ? StatusNoPackage
                    : p.ServicePrice == expected ? StatusPackage
                    : StatusSpecial;
                return new WorkerPriceDto(
                    p.Id, p.WorkerId, p.WorkerNo, p.Name, p.ProjectId, project?.Name ?? "—",
                    profession?.NameAr, profession?.NameEn, nationality?.NameAr, nationality?.NameEn,
                    p.Salary, p.ServicePrice, p.Housing, p.Transport, status, package?.Id, package?.PackageNo, expected,
                    p.ServicePrice is { } price && expected is { } e ? price - e : null,
                    p.WorkStartNo, p.StartedOn, p.FromWorkerDefault);
            })
            .ToList();

    private static bool Has(string? value, string search) => value?.Contains(search, StringComparison.OrdinalIgnoreCase) == true;

    private sealed record ProjectInfo(Guid Id, string Code, string Name, string? CustomerName, ContractType? Type);

    private sealed record Context(
        Dictionary<Guid, ProjectInfo> Projects,
        List<PricePackage> Packages,
        List<PriceSuggestion> Suggestions,
        List<WorkerPrice> Prices,
        Dictionary<string, ReferenceItemInfo> Professions,
        Dictionary<string, ReferenceItemInfo> Nationalities,
        DateOnly Today);
}
