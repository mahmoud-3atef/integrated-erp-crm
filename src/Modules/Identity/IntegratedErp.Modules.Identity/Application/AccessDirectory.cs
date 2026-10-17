using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Identity.Application;

/// <summary>Bound to the current company by the tenant filter on memberships, roles and assignments (and RLS).</summary>
internal sealed class AccessDirectory(IdentityDbContext db, IOptions<IdentityOptions> options) : IAccessDirectory
{
    public async Task<IReadOnlyList<RoleInfo>> ListRolesAsync(CancellationToken cancellationToken) =>
        await db.Roles.AsNoTracking().OrderBy(r => r.NameEn)
            .Select(r => new RoleInfo(r.Id, r.Code, r.NameAr, r.NameEn, r.IsActive, r.Kind == RoleKind.Administrator))
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task<IReadOnlyList<MemberInfo>> ListMembersAsync(CancellationToken cancellationToken)
    {
        var provider = options.Value.DirectoryProvider;
        return await (
                from m in db.Memberships.AsNoTracking()
                join u in db.Users.AsNoTracking() on m.UserAccountId equals u.Id
                where m.IsActive && u.IsActive
                orderby u.DisplayName
                select new MemberInfo(
                    u.Id,
                    u.DisplayName,
                    db.ExternalLogins.Where(l => l.UserAccountId == u.Id && l.Provider == provider).Select(l => l.UserName).FirstOrDefault()))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<Guid>> MembersInRoleAsync(Guid roleId, Guid? legalEntityId, CancellationToken cancellationToken) =>
        await (
                from a in db.RoleAssignments.AsNoTracking()
                join r in db.Roles.AsNoTracking() on a.RoleId equals r.Id
                join m in db.Memberships.AsNoTracking() on a.MembershipId equals m.Id
                join u in db.Users.AsNoTracking() on m.UserAccountId equals u.Id
                where a.RoleId == roleId && r.IsActive && m.IsActive && u.IsActive
                      && (a.LegalEntityId == null || (legalEntityId != null && a.LegalEntityId == legalEntityId))
                select u.Id)
            .Distinct()
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task<IReadOnlyList<Guid>> MembersWithPermissionAsync(string permissionCode, Guid? legalEntityId, CancellationToken cancellationToken) =>
        await (
                from a in db.RoleAssignments.AsNoTracking()
                join r in db.Roles.AsNoTracking() on a.RoleId equals r.Id
                join m in db.Memberships.AsNoTracking() on a.MembershipId equals m.Id
                join u in db.Users.AsNoTracking() on m.UserAccountId equals u.Id
                where r.IsActive && r.Kind != RoleKind.Administrator && r.Permissions.Any(p => p.PermissionCode == permissionCode)
                      && m.IsActive && u.IsActive
                      && (a.LegalEntityId == null || (legalEntityId != null && a.LegalEntityId == legalEntityId))
                select u.Id)
            .Distinct()
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    public Task<bool> IsMemberAsync(Guid userAccountId, CancellationToken cancellationToken) =>
        (from m in db.Memberships
         join u in db.Users on m.UserAccountId equals u.Id
         where m.UserAccountId == userAccountId && m.IsActive && u.IsActive
         select m.Id).AnyAsync(cancellationToken);
}
