namespace IntegratedErp.SharedKernel;

/// <summary>
/// Marks an entity that belongs to exactly one tenant (a separate company using the system).
/// The persistence layer fills <see cref="TenantId"/> on insert, filters every query by the
/// current tenant, and SQL Server row-level security blocks cross-tenant access as a second line.
/// </summary>
public interface ITenantOwned
{
    Guid TenantId { get; }
}
