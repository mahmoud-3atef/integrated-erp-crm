using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Domain;
using IntegratedErp.Modules.Commercial.Infrastructure;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Commercial.Application;

public sealed record ProjectRowDto(
    Guid Id,
    string Code,
    string Name,
    string? NameAr,
    Guid? CustomerId,
    string? CustomerName,
    string? Manager,
    int Workers,
    string? ContractType,
    string? ContractStatus,
    DateOnly? StartsOn,
    DateOnly? EndsOn,
    int? DaysLeft,
    bool IsActive,
    DateTimeOffset? CreatedAt);

/// <summary>The old projects page's cards: projects, workers on them, contracts ending within 60 days, projects without a customer.</summary>
public sealed record ProjectTotalsDto(int Projects, int Workers, int EndingSoon, int WithoutCustomer);

public sealed record ProjectListDto(int Total, ProjectTotalsDto Totals, IReadOnlyList<ProjectRowDto> Items);

public sealed record ProjectDetailDto(
    ProjectRowDto Summary,
    string? NameEn,
    string? CommercialRegistration,
    string? City,
    string? Sector,
    string? ContactName,
    string? ContactMobile,
    string? ContactEmails,
    string ContractNo,
    IReadOnlyList<WorkerInfo> Workers);

public sealed record CustomerRowDto(
    Guid Id,
    string? CustomerNo,
    string Name,
    string? NameEn,
    string? CommercialRegistration,
    string? VatNumber,
    string? Mobile,
    string? City,
    int Projects,
    int ActiveProjects,
    int Workers,
    bool IsActive,
    DateTimeOffset? CreatedAt);

public sealed record CustomerListDto(int Total, int Active, int WithProjects, int Workers, IReadOnlyList<CustomerRowDto> Items);

public sealed record CustomerDetailDto(CustomerRowDto Summary, string? Email, string? ContactName, string? LaborOfficeNo, IReadOnlyList<ProjectRowDto> Projects);

public sealed record ListFilter(string? Search, string? Status, string? Sort, bool Descending, int Page, int PageSize);

/// <summary>Projects and customers of the current company, with the workers on them (from the Workforce module).</summary>
internal sealed class CommercialQueries(CommercialDbContext db, IWorkforceDirectory workforce, IClock clock)
{
    private DateOnly Today => DateOnly.FromDateTime(clock.UtcNow.ToOffset(TimeSpan.FromHours(3)).DateTime);

    public async Task<ProjectListDto> ProjectsAsync(ListFilter filter, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        var rows = await ProjectRowsAsync(null, cancellationToken).ConfigureAwait(false);
        var totals = new ProjectTotalsDto(
            rows.Count(r => r.IsActive),
            rows.Sum(r => r.Workers),
            rows.Count(r => r.IsActive && r.DaysLeft is >= 0 and <= 60),
            rows.Count(r => r.CustomerId is null));

        IEnumerable<ProjectRowDto> query = rows;
        if (filter.Search?.Trim() is { Length: > 0 } search)
        {
            query = query.Where(r => Has(r.Code, search) || Has(r.Name, search) || Has(r.NameAr, search) || Has(r.CustomerName, search) || Has(r.Manager, search));
        }

        query = filter.Status switch
        {
            "active" => query.Where(r => r.IsActive),
            "ending" => query.Where(r => r.IsActive && r.DaysLeft is >= 0 and <= 60),
            "noCustomer" => query.Where(r => r.CustomerId is null),
            "withWorkers" => query.Where(r => r.Workers > 0),
            _ => query,
        };
        query = (filter.Sort, filter.Descending) switch
        {
            ("name", false) => query.OrderBy(r => r.Name, StringComparer.OrdinalIgnoreCase),
            ("name", true) => query.OrderByDescending(r => r.Name, StringComparer.OrdinalIgnoreCase),
            ("workers", false) => query.OrderBy(r => r.Workers),
            ("workers", true) => query.OrderByDescending(r => r.Workers),
            ("ends", false) => query.OrderBy(r => r.EndsOn ?? DateOnly.MaxValue),
            ("ends", true) => query.OrderByDescending(r => r.EndsOn ?? DateOnly.MinValue),
            (_, false) => query.OrderBy(r => r.CreatedAt),
            _ => query.OrderByDescending(r => r.CreatedAt),
        };
        var list = query.ToList();
        var pageSize = Math.Clamp(filter.PageSize, 10, 200);
        return new ProjectListDto(list.Count, totals, list.Skip(Math.Max(0, filter.Page - 1) * pageSize).Take(pageSize).ToList());
    }

    /// <summary>A project by its id, or by the old system's id (a worker's periods copied from the CRM know only that one).</summary>
    public async Task<ProjectDetailDto?> ProjectAsync(Guid id, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false)
            ?? await db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.CrmId == id, cancellationToken).ConfigureAwait(false);
        if (project is null)
        {
            return null;
        }

        var row = (await ProjectRowsAsync(project.Id, cancellationToken).ConfigureAwait(false)).Single();
        var contract = await db.Contracts.AsNoTracking().FirstAsync(c => c.Id == project.ContractId, cancellationToken).ConfigureAwait(false);
        var workers = await workforce.OnProjectAsync(project.CrmId, cancellationToken).ConfigureAwait(false);
        return new ProjectDetailDto(
            row, project.NameEn, project.CommercialRegistration, project.City, project.Sector,
            project.ContactName, project.ContactMobile, project.ContactEmails, contract.ContractNo, workers);
    }

    public async Task<CustomerListDto> CustomersAsync(ListFilter filter, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        var rows = await CustomerRowsAsync(null, cancellationToken).ConfigureAwait(false);
        IEnumerable<CustomerRowDto> query = rows;
        if (filter.Search?.Trim() is { Length: > 0 } search)
        {
            query = query.Where(r => Has(r.Name, search) || Has(r.NameEn, search) || Has(r.CustomerNo, search) || Has(r.CommercialRegistration, search) || Has(r.VatNumber, search) || Has(r.Mobile, search));
        }

        query = filter.Status switch
        {
            "active" => query.Where(r => r.IsActive),
            "withProjects" => query.Where(r => r.Projects > 0),
            "withWorkers" => query.Where(r => r.Workers > 0),
            _ => query,
        };
        query = (filter.Sort, filter.Descending) switch
        {
            ("name", false) => query.OrderBy(r => r.Name, StringComparer.OrdinalIgnoreCase),
            ("name", true) => query.OrderByDescending(r => r.Name, StringComparer.OrdinalIgnoreCase),
            ("workers", false) => query.OrderBy(r => r.Workers),
            ("workers", true) => query.OrderByDescending(r => r.Workers),
            (_, false) => query.OrderBy(r => r.CreatedAt),
            _ => query.OrderByDescending(r => r.CreatedAt),
        };
        var list = query.ToList();
        var pageSize = Math.Clamp(filter.PageSize, 10, 200);
        return new CustomerListDto(
            list.Count, rows.Count(r => r.IsActive), rows.Count(r => r.Projects > 0), rows.Sum(r => r.Workers),
            list.Skip(Math.Max(0, filter.Page - 1) * pageSize).Take(pageSize).ToList());
    }

    public async Task<CustomerDetailDto?> CustomerAsync(Guid id, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, cancellationToken).ConfigureAwait(false);
        if (customer is null)
        {
            return null;
        }

        var row = (await CustomerRowsAsync(id, cancellationToken).ConfigureAwait(false)).Single();
        var projects = (await ProjectRowsAsync(null, cancellationToken).ConfigureAwait(false)).Where(p => p.CustomerId == id)
            .OrderByDescending(p => p.IsActive).ThenByDescending(p => p.Workers).ToList();
        return new CustomerDetailDto(row, customer.Email, customer.ContactName, customer.LaborOfficeNo, projects);
    }

    private async Task<List<ProjectRowDto>> ProjectRowsAsync(Guid? only, CancellationToken cancellationToken)
    {
        var working = await workforce.WorkingByProjectAsync(cancellationToken).ConfigureAwait(false);
        var data = await db.Projects.AsNoTracking()
            .Where(p => !p.RemovedInCrm && (only == null || p.Id == only))
            .Join(db.Contracts, p => p.ContractId, c => c.Id, (p, c) => new { Project = p, Contract = c })
            .GroupJoin(db.Customers, x => x.Project.CustomerId, c => c.Id, (x, cs) => new { x.Project, x.Contract, Customers = cs })
            .SelectMany(x => x.Customers.DefaultIfEmpty(), (x, customer) => new { x.Project, x.Contract, CustomerName = customer == null ? null : customer.Name })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var today = Today;
        return data.Select(x => new ProjectRowDto(
                x.Project.Id, x.Project.Code, x.Project.Name, x.Project.NameAr, x.Project.CustomerId, x.CustomerName, x.Project.Manager,
                working.GetValueOrDefault(x.Project.CrmId),
                x.Contract.Type?.ToString(), x.Contract.Status?.ToString(), x.Contract.StartsOn, x.Contract.EndsOn,
                x.Contract.EndsOn is { } ends ? ends.DayNumber - today.DayNumber : null,
                x.Project.IsActive, x.Project.CrmCreatedAt))
            .ToList();
    }

    private async Task<List<CustomerRowDto>> CustomerRowsAsync(Guid? only, CancellationToken cancellationToken)
    {
        var projects = await ProjectRowsAsync(null, cancellationToken).ConfigureAwait(false);
        var byCustomer = projects.Where(p => p.CustomerId != null).ToLookup(p => p.CustomerId!.Value);
        var customers = await db.Customers.AsNoTracking().Where(c => !c.RemovedInCrm && (only == null || c.Id == only))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return customers.Select(c => new CustomerRowDto(
                c.Id, c.CustomerNo, c.Name, c.NameEn, c.CommercialRegistration, c.VatNumber, c.Mobile, c.City,
                byCustomer[c.Id].Count(), byCustomer[c.Id].Count(p => p.IsActive), byCustomer[c.Id].Sum(p => p.Workers),
                c.IsActive, c.CrmCreatedAt))
            .ToList();
    }

    private static bool Has(string? value, string search) => value?.Contains(search, StringComparison.OrdinalIgnoreCase) == true;
}
