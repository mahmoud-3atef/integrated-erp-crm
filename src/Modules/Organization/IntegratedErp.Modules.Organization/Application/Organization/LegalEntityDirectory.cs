using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Organization.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Organization.Application.Organization;

/// <summary>Bound to the current tenant by the query filter (and RLS).</summary>
internal sealed class LegalEntityDirectory(OrganizationDbContext db) : ILegalEntityDirectory
{
    public async Task<IReadOnlyList<LegalEntityInfo>> ListAsync(CancellationToken cancellationToken) =>
        await db.LegalEntities.AsNoTracking()
            .OrderBy(e => e.Code)
            .Select(e => new LegalEntityInfo(e.Id, e.Code, e.NameAr, e.NameEn, e.IsActive))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
}
