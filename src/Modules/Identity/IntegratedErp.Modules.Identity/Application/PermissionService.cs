using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Identity.Application;

/// <summary>
/// The current user's permissions in the current company, read from the database once per request — so a role
/// change or a deactivated membership takes effect on the next call, not at the next sign-in.
/// No active membership (or an inactive account) means no permissions at all.
/// </summary>
internal sealed class PermissionService(IdentityDbContext db, ITenantContext tenant, ICurrentUser user, PermissionCatalog catalog) : IPermissionService
{
    private UserPermissions? _current;

    public async Task<UserPermissions> GetCurrentAsync(CancellationToken cancellationToken)
    {
        if (_current is not null)
        {
            return _current;
        }

        if (tenant.TenantId is not { } tenantId || !Guid.TryParse(user.UserId, out var userId))
        {
            return _current = UserPermissions.None;
        }

        var membershipId = await (
                from m in db.Memberships
                join u in db.Users on m.UserAccountId equals u.Id
                where m.UserAccountId == userId && m.TenantId == tenantId && m.IsActive && u.IsActive
                select (Guid?)m.Id)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
        if (membershipId is null)
        {
            return _current = UserPermissions.None;
        }

        var assignments = await db.RoleAssignments.AsNoTracking()
            .Where(a => a.MembershipId == membershipId)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        var roleIds = assignments.Select(a => a.RoleId).Distinct().ToList();
        var roles = await db.Roles.AsNoTracking()
            .Include(r => r.Permissions)
            .Where(r => roleIds.Contains(r.Id))
            .ToDictionaryAsync(r => r.Id, cancellationToken)
            .ConfigureAwait(false);

        return _current = Combine(assignments, roles, catalog);
    }

    /// <summary>Union of all assignments: a grant for every registration wins over a grant for some.</summary>
    internal static UserPermissions Combine(IEnumerable<RoleAssignment> assignments, IReadOnlyDictionary<Guid, Role> roles, PermissionCatalog catalog)
    {
        var grants = new Dictionary<string, HashSet<Guid>?>(StringComparer.Ordinal);
        foreach (var assignment in assignments)
        {
            if (!roles.TryGetValue(assignment.RoleId, out var role))
            {
                continue;
            }

            foreach (var code in role.Effective(catalog))
            {
                if (assignment.LegalEntityId is not { } entity)
                {
                    grants[code] = null;
                }
                else if (!grants.TryGetValue(code, out var entities))
                {
                    grants[code] = [entity];
                }
                else
                {
                    entities?.Add(entity);
                }
            }
        }

        return new UserPermissions(grants.ToDictionary(g => g.Key, g => (IReadOnlySet<Guid>?)g.Value, StringComparer.Ordinal));
    }
}
