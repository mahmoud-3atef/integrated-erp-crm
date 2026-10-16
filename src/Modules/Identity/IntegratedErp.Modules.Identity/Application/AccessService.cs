using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Documents.Contracts;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Identity.Infrastructure.Ldap;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Identity.Application;

public sealed record PermissionDto(string Code, string GroupAr, string GroupEn, string NameAr, string NameEn);

public sealed record RoleDto(Guid Id, string Code, string NameAr, string NameEn, RoleKind Kind, bool IsActive, IReadOnlyList<string> Permissions);

public sealed record AssignmentDto(Guid RoleId, Guid? LegalEntityId);

public sealed record MemberDto(Guid MembershipId, Guid UserAccountId, string DisplayName, string? UserName, string? Email, bool IsActive, IReadOnlyList<AssignmentDto> Roles);

/// <summary>
/// Company administration of access (current company only — every query is bound to the current tenant):
/// roles, members and role assignments. Guards against privilege escalation (nobody grants a permission they
/// do not hold) and against locking the company out (the last full administrator cannot be removed).
/// </summary>
internal sealed partial class AccessService(
    IdentityDbContext db,
    IDirectory directory,
    ILegalEntityDirectory legalEntities,
    IPermissionService permissions,
    PermissionCatalog catalog,
    ITenantContext tenant,
    ICurrentUser user,
    ITenantDirectory tenants,
    IEnumerable<INotifier> notifiers,
    ILogger<AccessService> logger,
    IOptions<IdentityOptions> options)
{
    public static readonly Error RoleNotFound = Error.NotFound("role", "Role not found.");
    public static readonly Error MemberNotFound = Error.NotFound("member", "Member not found.");
    public static readonly Error UserNotInDirectory = Error.Validation("user_not_in_directory", "No such user in the company directory.");
    public static readonly Error LegalEntityUnknown = Error.Validation("legal_entity_unknown", "Unknown commercial registration.");
    public static readonly Error LastAdministrator = Error.Validation("last_administrator", "The company must keep at least one full administrator.");
    public static readonly Error NotYourself = Error.Validation("not_yourself", "You cannot deactivate your own access.");
    public static readonly Error BeyondOwnPermissions = Error.Validation("beyond_own_permissions", "You cannot grant permissions you do not have.");
    public static readonly Error CodeTaken = Error.Conflict("role_code_taken", "A role with this code already exists.");

    public IReadOnlyList<PermissionDto> Permissions() =>
        catalog.All.Select(p => new PermissionDto(p.Code, p.GroupAr, p.GroupEn, p.NameAr, p.NameEn)).ToList();

    public async Task<IReadOnlyList<RoleDto>> ListRolesAsync(CancellationToken cancellationToken)
    {
        await RoleSeeder.EnsureBuiltInRolesAsync(db, CurrentTenant, cancellationToken).ConfigureAwait(false);
        var roles = await db.Roles.AsNoTracking().Include(r => r.Permissions)
            .OrderBy(r => r.Kind == RoleKind.Custom).ThenBy(r => r.NameEn)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return roles.Select(ToDto).ToList();
    }

    public async Task<Result<RoleDto>> CreateRoleAsync(string code, string nameAr, string nameEn, IReadOnlyCollection<string> codes, CancellationToken cancellationToken)
    {
        if (!await HoldsAllAsync(codes, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<RoleDto>(BeyondOwnPermissions);
        }

        var created = Role.Create(code, nameAr, nameEn, codes, catalog);
        if (created.IsFailure)
        {
            return Result.Failure<RoleDto>(created.Error);
        }

        if (await db.Roles.AnyAsync(r => r.Code == created.Value.Code, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<RoleDto>(CodeTaken);
        }

        db.Roles.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(created.Value));
    }

    public async Task<Result<RoleDto>> UpdateRoleAsync(Guid id, string nameAr, string nameEn, IReadOnlyCollection<string> codes, CancellationToken cancellationToken)
    {
        var role = await db.Roles.Include(r => r.Permissions).FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (role is null)
        {
            return Result.Failure<RoleDto>(RoleNotFound);
        }

        // Only the permissions being added must be held; keeping existing ones is allowed.
        var added = codes.Except(role.Permissions.Select(p => p.PermissionCode), StringComparer.Ordinal).ToList();
        if (!await HoldsAllAsync(added, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<RoleDto>(BeyondOwnPermissions);
        }

        var outcome = role.Rename(nameAr, nameEn);
        if (outcome.IsSuccess)
        {
            outcome = role.SetPermissions(codes, catalog);
        }

        if (outcome.IsFailure)
        {
            return Result.Failure<RoleDto>(outcome.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(role));
    }

    public async Task<IReadOnlyList<MemberDto>> ListMembersAsync(CancellationToken cancellationToken)
    {
        var provider = options.Value.DirectoryProvider;
        var rows = await (
                from m in db.Memberships.AsNoTracking()
                join u in db.Users.AsNoTracking() on m.UserAccountId equals u.Id
                select new
                {
                    m.Id,
                    m.UserAccountId,
                    u.DisplayName,
                    u.Email,
                    m.IsActive,
                    UserName = db.ExternalLogins.Where(l => l.UserAccountId == u.Id && l.Provider == provider).Select(l => l.UserName).FirstOrDefault(),
                })
            .OrderBy(r => r.DisplayName)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        var assignments = await db.RoleAssignments.AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false);
        var byMember = assignments.ToLookup(a => a.MembershipId);

        return rows.Select(r => new MemberDto(
                r.Id, r.UserAccountId, r.DisplayName, r.UserName, r.Email, r.IsActive,
                byMember[r.Id].Select(a => new AssignmentDto(a.RoleId, a.LegalEntityId)).ToList()))
            .ToList();
    }

    /// <summary>Adds a company AD user to the current company (no roles yet — they see nothing until given one).</summary>
    public async Task<Result<MemberDto>> AddMemberAsync(string userName, CancellationToken cancellationToken)
    {
        var name = LdapDirectory.NormalizeUserName(userName ?? string.Empty);
        var found = name.Length == 0 ? null : await directory.FindUserAsync(name, cancellationToken).ConfigureAwait(false);
        if (found is null || !found.IsEnabled)
        {
            return Result.Failure<MemberDto>(UserNotInDirectory);
        }

        var provider = options.Value.DirectoryProvider;
        var subject = found.ObjectGuid.ToString();
        var login = await db.ExternalLogins.FirstOrDefaultAsync(l => l.Provider == provider && l.Subject == subject, cancellationToken).ConfigureAwait(false);
        UserAccount account;
        if (login is null)
        {
            account = UserAccount.Create(found.DisplayName, found.Email);
            db.Users.Add(account);
            db.ExternalLogins.Add(new ExternalLogin(account.Id, provider, subject, found.SamAccountName));
        }
        else
        {
            account = await db.Users.FirstAsync(u => u.Id == login.UserAccountId, cancellationToken).ConfigureAwait(false);
        }

        var membership = await db.Memberships.FirstOrDefaultAsync(m => m.UserAccountId == account.Id, cancellationToken).ConfigureAwait(false);
        var joined = membership is null || !membership.IsActive;
        if (membership is null)
        {
            membership = new Membership(account.Id, CurrentTenant);
            db.Memberships.Add(membership);
        }
        else
        {
            membership.Activate();
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        if (joined)
        {
            var company = await CompanyNamesAsync(cancellationToken).ConfigureAwait(false);
            await NotifyAsync(
                account.Id,
                "identity.member_added",
                "تمت إضافتك إلى شركة",
                "You were added to a company",
                $"أضافك {user.DisplayName} إلى شركة «{company.Ar}». ستظهر لك الشاشات بعد أن يُسند إليك دور.",
                $"{user.DisplayName} added you to {company.En}. Screens will appear once you are given a role.",
                cancellationToken).ConfigureAwait(false);
        }

        var roles = await db.RoleAssignments.AsNoTracking().Where(a => a.MembershipId == membership.Id)
            .Select(a => new AssignmentDto(a.RoleId, a.LegalEntityId)).ToListAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(new MemberDto(membership.Id, account.Id, account.DisplayName, found.SamAccountName, account.Email, membership.IsActive, roles));
    }

    /// <summary>Replaces a member's roles. Each role applies to all registrations or to one.</summary>
    public async Task<Result> SetMemberRolesAsync(Guid membershipId, IReadOnlyCollection<AssignmentDto> wanted, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(wanted);
        if (!await db.Memberships.AnyAsync(m => m.Id == membershipId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(MemberNotFound);
        }

        var wantedSet = wanted.Distinct().ToList();
        var roleIds = wantedSet.Select(a => a.RoleId).Distinct().ToList();
        var roles = await db.Roles.AsNoTracking().Include(r => r.Permissions).Where(r => roleIds.Contains(r.Id))
            .ToDictionaryAsync(r => r.Id, cancellationToken).ConfigureAwait(false);
        if (roles.Count != roleIds.Count)
        {
            return Result.Failure(RoleNotFound);
        }

        var entityIds = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).Select(e => e.Id).ToHashSet();
        if (wantedSet.Any(a => a.LegalEntityId is { } id && !entityIds.Contains(id)))
        {
            return Result.Failure(LegalEntityUnknown);
        }

        var current = await db.RoleAssignments.Where(a => a.MembershipId == membershipId).ToListAsync(cancellationToken).ConfigureAwait(false);
        var adding = wantedSet.Where(w => !current.Any(c => c.RoleId == w.RoleId && c.LegalEntityId == w.LegalEntityId)).ToList();

        // Nobody hands out a permission they do not hold themselves (for the same registrations).
        var mine = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        if (adding.Any(a => roles[a.RoleId].Effective(catalog).Any(code => !Covers(mine, code, a.LegalEntityId))))
        {
            return Result.Failure(BeyondOwnPermissions);
        }

        db.RoleAssignments.RemoveRange(current.Where(c => !wantedSet.Contains(new AssignmentDto(c.RoleId, c.LegalEntityId))));
        db.RoleAssignments.AddRange(adding.Select(a => new RoleAssignment(membershipId, a.RoleId, a.LegalEntityId)));

        if (!await StillHasAdministratorAsync(cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(LastAdministrator);
        }

        var changed = db.ChangeTracker.HasChanges();
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        if (changed)
        {
            var accountId = await db.Memberships.Where(m => m.Id == membershipId).Select(m => m.UserAccountId).FirstAsync(cancellationToken).ConfigureAwait(false);
            var company = await CompanyNamesAsync(cancellationToken).ConfigureAwait(false);
            await NotifyAsync(
                accountId,
                "identity.roles_changed",
                "تغيّرت صلاحياتك",
                "Your access changed",
                $"عدّل {user.DisplayName} أدوارك في شركة «{company.Ar}». قد تتغير الشاشات المتاحة لك.",
                $"{user.DisplayName} changed your roles in {company.En}. The screens available to you may change.",
                cancellationToken).ConfigureAwait(false);
        }

        return Result.Success();
    }

    public async Task<Result> SetMemberActiveAsync(Guid membershipId, bool active, CancellationToken cancellationToken)
    {
        var membership = await db.Memberships.FirstOrDefaultAsync(m => m.Id == membershipId, cancellationToken).ConfigureAwait(false);
        if (membership is null)
        {
            return Result.Failure(MemberNotFound);
        }

        if (active)
        {
            membership.Activate();
        }
        else
        {
            if (membership.UserAccountId.ToString() == user.UserId)
            {
                return Result.Failure(NotYourself);
            }

            membership.Deactivate();
            if (!await StillHasAdministratorAsync(cancellationToken).ConfigureAwait(false))
            {
                return Result.Failure(LastAdministrator);
            }
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public Task<IReadOnlyList<LegalEntityInfo>> LegalEntitiesAsync(CancellationToken cancellationToken) => legalEntities.ListAsync(cancellationToken);

    /// <summary>Best effort after the change is saved: a failed notification never undoes an access change.</summary>
    private async Task NotifyAsync(Guid recipient, string kind, string titleAr, string titleEn, string bodyAr, string bodyEn, CancellationToken cancellationToken)
    {
        foreach (var notifier in notifiers)
        {
            try
            {
                await notifier.NotifyAsync(new NotificationRequest([recipient], kind, titleAr, titleEn, bodyAr, bodyEn, "/"), cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogNotifyFailed(logger, kind, ex);
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Notification {Kind} could not be sent")]
    private static partial void LogNotifyFailed(ILogger logger, string kind, Exception exception);

    private async Task<(string Ar, string En)> CompanyNamesAsync(CancellationToken cancellationToken)
    {
        var found = await tenants.GetAsync([CurrentTenant], cancellationToken).ConfigureAwait(false);
        var company = found.Count > 0 ? found[0] : null;
        return company is null ? (string.Empty, string.Empty) : (company.NameAr, company.NameEn);
    }

    private Guid CurrentTenant => tenant.TenantId ?? throw new InvalidOperationException("A company must be selected.");

    private static bool Covers(UserPermissions mine, string code, Guid? legalEntityId) =>
        legalEntityId is { } entity ? mine.Has(code, entity) : mine.LegalEntitiesFor(code) is null;

    private async Task<bool> HoldsAllAsync(IEnumerable<string> codes, CancellationToken cancellationToken)
    {
        var mine = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        return codes.All(code => !catalog.Contains(code) || mine.LegalEntitiesFor(code) is null);
    }

    /// <summary>Checked against the pending (unsaved) changes: an active member holding the administrator role for all registrations.</summary>
    private async Task<bool> StillHasAdministratorAsync(CancellationToken cancellationToken)
    {
        var adminRoleIds = await db.Roles.Where(r => r.Kind == RoleKind.Administrator && r.IsActive).Select(r => r.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var activeMembers = (await db.Memberships.ToListAsync(cancellationToken).ConfigureAwait(false))
            .Where(m => m.IsActive).Select(m => m.Id).ToHashSet();

        var assignments = (await db.RoleAssignments.ToListAsync(cancellationToken).ConfigureAwait(false))
            .Concat(db.ChangeTracker.Entries<RoleAssignment>().Where(e => e.State == EntityState.Added).Select(e => e.Entity))
            .Where(a => db.Entry(a).State != EntityState.Deleted)
            .Distinct();
        return assignments.Any(a => a.LegalEntityId is null && adminRoleIds.Contains(a.RoleId) && activeMembers.Contains(a.MembershipId));
    }

    private RoleDto ToDto(Role role) => new(
        role.Id, role.Code, role.NameAr, role.NameEn, role.Kind, role.IsActive,
        role.Effective(catalog).OrderBy(c => c, StringComparer.Ordinal).ToList());
}
