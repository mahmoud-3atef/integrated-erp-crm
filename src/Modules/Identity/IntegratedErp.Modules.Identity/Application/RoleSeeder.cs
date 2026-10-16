using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Identity.Application;

/// <summary>Every company has the built-in roles (administrator, read-only); created on first need.</summary>
internal static class RoleSeeder
{
    public static async Task<Role> EnsureBuiltInRolesAsync(IdentityDbContext db, Guid tenantId, CancellationToken cancellationToken)
    {
        var existing = await db.Roles.Where(r => r.TenantId == tenantId && r.Kind != RoleKind.Custom)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        foreach (var kind in new[] { RoleKind.Administrator, RoleKind.ReadOnly }.Where(k => existing.All(r => r.Kind != k)))
        {
            var role = Role.BuiltIn(tenantId, kind);
            db.Roles.Add(role);
            existing.Add(role);
        }

        if (db.ChangeTracker.HasChanges())
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return existing.First(r => r.Kind == RoleKind.Administrator);
    }
}
