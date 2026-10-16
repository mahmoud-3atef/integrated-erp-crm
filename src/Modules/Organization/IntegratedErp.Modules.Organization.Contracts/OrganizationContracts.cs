namespace IntegratedErp.Modules.Organization.Contracts;

/// <summary>
/// Public surface of the Organization module (tenants, legal entities, branches, reference codes,
/// settings). Other modules may reference this assembly only — never the module implementation.
/// Interfaces and integration events are added here as the module grows (slice 0.6).
/// </summary>
public static class OrganizationContracts
{
    public const string ModuleName = "Organization";
}
