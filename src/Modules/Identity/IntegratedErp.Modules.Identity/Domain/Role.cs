using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Identity.Domain;

/// <summary>
/// Built-in roles compute their permissions from the catalog, so a newly enabled module's permissions reach
/// them without editing the role. Custom roles hold an explicit list chosen by the company administrator.
/// </summary>
public enum RoleKind
{
    Custom = 0,

    /// <summary>Company administrator: every permission of the enabled modules.</summary>
    Administrator = 1,

    /// <summary>Read-only: every <c>.view</c> permission.</summary>
    ReadOnly = 2,
}

/// <summary>A role inside one company (roles never span companies: the same person can have different roles in each).</summary>
public sealed class Role : ITenantOwned
{
    public const int CodeMaxLength = 50;
    public const int NameMaxLength = 200;

    private readonly List<RoleGrant> _permissions = [];

    private Role()
    {
        Code = string.Empty;
        NameAr = string.Empty;
        NameEn = string.Empty;
    }

    private Role(Guid tenantId, string code, string nameAr, string nameEn, RoleKind kind)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        Code = code;
        NameAr = nameAr;
        NameEn = nameEn;
        Kind = kind;
        IsActive = true;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>Unique within the company, lower-case, e.g. <c>accountant-05</c>.</summary>
    public string Code { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    public RoleKind Kind { get; private set; }

    public bool IsActive { get; private set; }

    public bool IsBuiltIn => Kind != RoleKind.Custom;

    public IReadOnlyCollection<RoleGrant> Permissions => _permissions;

    public static Role BuiltIn(Guid tenantId, RoleKind kind) => kind switch
    {
        RoleKind.Administrator => new Role(tenantId, "admin", "مدير الشركة", "Company administrator", kind),
        RoleKind.ReadOnly => new Role(tenantId, "read-only", "عرض فقط", "Read only", kind),
        _ => throw new ArgumentOutOfRangeException(nameof(kind)),
    };

    public static Result<Role> Create(string code, string nameAr, string nameEn, IEnumerable<string> permissions, PermissionCatalog catalog)
    {
        var normalized = (code ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized.Length is 0 or > CodeMaxLength || !normalized.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_'))
        {
            return Result.Failure<Role>(Error.Validation("role_code_invalid", "Code: 1-50 letters, digits, '-' or '_'."));
        }

        var role = new Role(Guid.Empty, normalized, string.Empty, string.Empty, RoleKind.Custom);
        var renamed = role.Rename(nameAr, nameEn);
        if (renamed.IsFailure)
        {
            return Result.Failure<Role>(renamed.Error);
        }

        var set = role.SetPermissions(permissions, catalog);
        return set.IsFailure ? Result.Failure<Role>(set.Error) : Result.Success(role);
    }

    public Result Rename(string nameAr, string nameEn)
    {
        nameAr = (nameAr ?? string.Empty).Trim();
        nameEn = (nameEn ?? string.Empty).Trim();
        if (nameAr.Length is 0 or > NameMaxLength || nameEn.Length is 0 or > NameMaxLength)
        {
            return Result.Failure(Error.Validation("role_name_invalid", "Arabic and English names are required (up to 200 characters)."));
        }

        if (IsBuiltIn)
        {
            return Result.Failure(Error.Validation("role_built_in", "Built-in roles cannot be changed."));
        }

        NameAr = nameAr;
        NameEn = nameEn;
        return Result.Success();
    }

    public Result SetPermissions(IEnumerable<string> codes, PermissionCatalog catalog)
    {
        ArgumentNullException.ThrowIfNull(codes);
        ArgumentNullException.ThrowIfNull(catalog);
        if (IsBuiltIn)
        {
            return Result.Failure(Error.Validation("role_built_in", "Built-in roles cannot be changed."));
        }

        var wanted = codes.Select(c => (c ?? string.Empty).Trim()).Where(c => c.Length > 0).ToHashSet(StringComparer.Ordinal);
        if (wanted.FirstOrDefault(c => !catalog.Contains(c)) is { } unknown)
        {
            return Result.Failure(Error.Validation("permission_unknown", $"Unknown permission '{unknown}'."));
        }

        _permissions.RemoveAll(p => !wanted.Contains(p.PermissionCode));
        foreach (var code in wanted.Where(c => _permissions.All(p => p.PermissionCode != c)))
        {
            _permissions.Add(new RoleGrant(Id, TenantId, code));
        }

        return Result.Success();
    }

    public void Deactivate() => IsActive = false;

    /// <summary>Permission codes this role grants with the current catalog (unknown/removed codes are ignored).</summary>
    public IEnumerable<string> Effective(PermissionCatalog catalog)
    {
        ArgumentNullException.ThrowIfNull(catalog);
        if (!IsActive)
        {
            return [];
        }

        return Kind switch
        {
            RoleKind.Administrator => catalog.All.Select(p => p.Code),
            RoleKind.ReadOnly => catalog.All.Where(p => p.IsView).Select(p => p.Code),
            _ => _permissions.Select(p => p.PermissionCode).Where(catalog.Contains),
        };
    }
}

public sealed class RoleGrant : ITenantOwned
{
    private RoleGrant()
    {
        PermissionCode = string.Empty;
    }

    internal RoleGrant(Guid roleId, Guid tenantId, string permissionCode)
    {
        Id = Guid.CreateVersion7();
        RoleId = roleId;
        TenantId = tenantId;
        PermissionCode = permissionCode;
    }

    public Guid Id { get; private set; }

    public Guid RoleId { get; private set; }

    public Guid TenantId { get; private set; }

    public string PermissionCode { get; private set; }
}

/// <summary>
/// A role given to a company member, for all of the company's commercial registrations
/// (<see cref="LegalEntityId"/> null) or for one of them (e.g. accountant of Care-Pro 05 only).
/// </summary>
public sealed class RoleAssignment : ITenantOwned
{
    private RoleAssignment()
    {
    }

    public RoleAssignment(Guid membershipId, Guid roleId, Guid? legalEntityId, Guid tenantId = default)
    {
        Id = Guid.CreateVersion7();
        MembershipId = membershipId;
        RoleId = roleId;
        LegalEntityId = legalEntityId;
        TenantId = tenantId;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid MembershipId { get; private set; }

    public Guid RoleId { get; private set; }

    public Guid? LegalEntityId { get; private set; }
}
