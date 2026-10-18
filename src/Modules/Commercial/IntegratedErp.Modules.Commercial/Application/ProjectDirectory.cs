using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Commercial.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Commercial.Application;

internal sealed class ProjectDirectory(CommercialDbContext db) : IProjectDirectory
{
    public async Task<IReadOnlyList<ProjectInfo>> ActiveAsync(CancellationToken cancellationToken) =>
        (await QueryAsync(db.Projects.Where(p => !p.RemovedInCrm && p.IsActive), cancellationToken).ConfigureAwait(false))
            .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase).ToList();

    public async Task<IReadOnlyList<ProjectInfo>> FindAsync(IReadOnlyCollection<Guid> ids, IReadOnlyCollection<Guid> crmIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ids);
        ArgumentNullException.ThrowIfNull(crmIds);
        var idList = ids.Distinct().ToList();
        var crmList = crmIds.Distinct().ToList();
        return await QueryAsync(db.Projects.Where(p => idList.Contains(p.Id) || crmList.Contains(p.CrmId)), cancellationToken).ConfigureAwait(false);
    }

    public async Task<ProjectBillTo?> BillToAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var row = await db.Projects.AsNoTracking().Where(p => p.Id == projectId)
            .GroupJoin(db.Customers, p => p.CustomerId, c => c.Id, (p, cs) => new { Project = p, Customers = cs })
            .SelectMany(x => x.Customers.DefaultIfEmpty(), (x, c) => new { x.Project, Customer = c })
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (row is null)
        {
            return null;
        }

        var (p, c) = (row.Project, row.Customer);
        return c is null
            ? new ProjectBillTo(null, p.NameAr ?? p.Name, p.NameEn, null, p.CommercialRegistration, p.City)
            : new ProjectBillTo(c.Id, c.Name, c.NameEn, c.VatNumber, c.CommercialRegistration ?? p.CommercialRegistration, c.City ?? p.City);
    }

    private async Task<List<ProjectInfo>> QueryAsync(IQueryable<Domain.Project> projects, CancellationToken cancellationToken)
    {
        var rows = await projects.AsNoTracking()
            .Join(db.Contracts, p => p.ContractId, c => c.Id, (p, c) => new { Project = p, c.Type })
            .GroupJoin(db.Customers, x => x.Project.CustomerId, c => c.Id, (x, cs) => new { x.Project, x.Type, Customers = cs })
            .SelectMany(x => x.Customers.DefaultIfEmpty(), (x, c) => new { x.Project, x.Type, CustomerName = c == null ? null : c.Name })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.Select(x => new ProjectInfo(
                x.Project.Id, x.Project.CrmId, x.Project.Code, x.Project.Name, x.CustomerName, x.Project.Manager, x.Type?.ToString(),
                x.Project.IsActive && !x.Project.RemovedInCrm))
            .ToList();
    }
}
