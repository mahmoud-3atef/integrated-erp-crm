namespace IntegratedErp.Modules.Identity.Contracts;

/// <summary>A role of the current company, as other modules may see it (e.g. to choose approvers).</summary>
/// <param name="IsAdministrator">The built-in company administrator role (every permission).</param>
public sealed record RoleInfo(Guid Id, string Code, string NameAr, string NameEn, bool IsActive, bool IsAdministrator);

/// <summary>An active member of the current company.</summary>
public sealed record MemberInfo(Guid UserAccountId, string DisplayName, string? UserName);

/// <summary>Read access to the current company's roles and members for other modules.</summary>
public interface IAccessDirectory
{
    Task<IReadOnlyList<RoleInfo>> ListRolesAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<MemberInfo>> ListMembersAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Active members holding the role for all commercial registrations, or for <paramref name="legalEntityId"/>
    /// when given (a role limited to another registration does not count).
    /// </summary>
    Task<IReadOnlyList<Guid>> MembersInRoleAsync(Guid roleId, Guid? legalEntityId, CancellationToken cancellationToken);

    /// <summary>
    /// Active members holding a permission through an active role (not the administrator role, which holds every
    /// permission), for all commercial registrations or for <paramref name="legalEntityId"/> when given.
    /// </summary>
    Task<IReadOnlyList<Guid>> MembersWithPermissionAsync(string permissionCode, Guid? legalEntityId, CancellationToken cancellationToken);

    /// <summary>Whether the user is an active member of the current company.</summary>
    Task<bool> IsMemberAsync(Guid userAccountId, CancellationToken cancellationToken);
}
