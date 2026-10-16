namespace IntegratedErp.BuildingBlocks.Context;

/// <summary>The tenant the current operation runs for.</summary>
public interface ITenantContext
{
    /// <summary>Current tenant, or null when none is established (anonymous request, system job).</summary>
    Guid? TenantId { get; }

    /// <summary>
    /// True only for trusted system operations (migrations, cross-tenant maintenance jobs) that must
    /// see all tenants. Never set from a user request.
    /// </summary>
    bool IsSystem { get; }
}

/// <summary>Who performs the current operation (for audit and ownership).</summary>
public interface ICurrentUser
{
    /// <summary>Stable user id (from the identity provider); null for anonymous/system.</summary>
    string? UserId { get; }

    string DisplayName { get; }
}

/// <summary>Mutable per-scope holder; set once by middleware or by a system job, then read everywhere.</summary>
public sealed class ExecutionContextAccessor : ITenantContext, ICurrentUser
{
    public Guid? TenantId { get; private set; }

    public bool IsSystem { get; private set; }

    public string? UserId { get; private set; }

    public string DisplayName { get; private set; } = "anonymous";

    public void SetTenant(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant id must not be empty.", nameof(tenantId));
        }

        if (TenantId is { } existing && existing != tenantId)
        {
            throw new InvalidOperationException("The tenant of an operation cannot change once set.");
        }

        TenantId = tenantId;
    }

    public void SetUser(string? userId, string displayName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(displayName);
        UserId = userId;
        DisplayName = displayName;
    }

    /// <summary>Marks the scope as a trusted system operation (all tenants visible).</summary>
    public void RunAsSystem(string displayName = "system")
    {
        IsSystem = true;
        UserId = null;
        DisplayName = displayName;
    }
}
