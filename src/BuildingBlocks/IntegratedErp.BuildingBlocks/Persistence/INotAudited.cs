namespace IntegratedErp.BuildingBlocks.Persistence;

/// <summary>
/// Marks an entity whose changes are not written to the audit log: high-volume copies of data owned elsewhere
/// (e.g. records staged from the old CRM), where the copy job keeps its own run log instead.
/// Tenant isolation still applies.
/// </summary>
public interface INotAudited;
