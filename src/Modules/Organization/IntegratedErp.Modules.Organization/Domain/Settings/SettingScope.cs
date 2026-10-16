namespace IntegratedErp.Modules.Organization.Domain.Settings;

/// <summary>
/// Level a setting value applies to, from the most general to the most specific.
/// A more specific scope overrides a more general one (docs/02-target-architecture/14 §3).
/// </summary>
public enum SettingScopeType
{
    /// <summary>Whole deployment (no tenant).</summary>
    System = 0,

    Tenant = 10,

    LegalEntity = 20,

    Customer = 30,

    Contract = 40,

    Project = 50,
}

/// <summary>Where a setting value is stored: the scope level plus the id of the scoped record.</summary>
public sealed record SettingScope
{
    private SettingScope(SettingScopeType type, Guid? tenantId, Guid? scopeId)
    {
        Type = type;
        TenantId = tenantId;
        ScopeId = scopeId;
    }

    public SettingScopeType Type { get; }

    public Guid? TenantId { get; }

    /// <summary>Id of the legal entity / customer / contract / project; null for System and Tenant.</summary>
    public Guid? ScopeId { get; }

    public static SettingScope System { get; } = new(SettingScopeType.System, null, null);

    public static SettingScope ForTenant(Guid tenantId) => new(SettingScopeType.Tenant, Required(tenantId), null);

    public static SettingScope For(SettingScopeType type, Guid tenantId, Guid scopeId)
    {
        if (type is SettingScopeType.System or SettingScopeType.Tenant)
        {
            throw new ArgumentException($"Use {nameof(System)} or {nameof(ForTenant)} for scope '{type}'.", nameof(type));
        }

        return new SettingScope(type, Required(tenantId), Required(scopeId));
    }

    internal static SettingScope Restore(SettingScopeType type, Guid? tenantId, Guid? scopeId) => new(type, tenantId, scopeId);

    private static Guid Required(Guid id) =>
        id == Guid.Empty ? throw new ArgumentException("Scope id must not be empty.", nameof(id)) : id;
}

/// <summary>
/// The records a lookup is made for: the tenant plus any of legal entity / customer / contract / project.
/// Resolution walks from the most specific scope present down to System.
/// </summary>
public sealed record SettingContext(
    Guid? TenantId = null,
    Guid? LegalEntityId = null,
    Guid? CustomerId = null,
    Guid? ContractId = null,
    Guid? ProjectId = null)
{
    /// <summary>Scopes to try, most specific first.</summary>
    public IEnumerable<SettingScope> ScopesByPrecedence()
    {
        if (TenantId is { } tenant)
        {
            if (ProjectId is { } project)
            {
                yield return SettingScope.For(SettingScopeType.Project, tenant, project);
            }

            if (ContractId is { } contract)
            {
                yield return SettingScope.For(SettingScopeType.Contract, tenant, contract);
            }

            if (CustomerId is { } customer)
            {
                yield return SettingScope.For(SettingScopeType.Customer, tenant, customer);
            }

            if (LegalEntityId is { } legalEntity)
            {
                yield return SettingScope.For(SettingScopeType.LegalEntity, tenant, legalEntity);
            }

            yield return SettingScope.ForTenant(tenant);
        }

        yield return SettingScope.System;
    }
}
