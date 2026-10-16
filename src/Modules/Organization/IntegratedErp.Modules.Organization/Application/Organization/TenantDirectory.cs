using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Organization.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Organization.Application.Organization;

internal sealed class TenantDirectory(OrganizationDbContext db) : ITenantDirectory
{
    public async Task<TenantInfo?> FindByCodeAsync(string code, CancellationToken cancellationToken)
    {
        var normalized = (code ?? string.Empty).Trim().ToLowerInvariant();
        return await db.Tenants.AsNoTracking()
            .Where(t => t.Code == normalized)
            .Select(t => new TenantInfo(t.Id, t.Code, t.NameAr, t.NameEn, t.IsActive))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<TenantInfo>> GetAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ids);
        return await db.Tenants.AsNoTracking()
            .Where(t => ids.Contains(t.Id))
            .OrderBy(t => t.NameEn)
            .Select(t => new TenantInfo(t.Id, t.Code, t.NameAr, t.NameEn, t.IsActive))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}
