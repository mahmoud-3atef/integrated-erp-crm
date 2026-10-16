namespace IntegratedErp.Modules.Organization.Contracts;

/// <summary>A company that operates the system (tenant), as other modules may see it.</summary>
public sealed record TenantInfo(Guid Id, string Code, string NameAr, string NameEn, bool IsActive);

/// <summary>Read access to companies for other modules (e.g. Identity listing a user's companies).</summary>
public interface ITenantDirectory
{
    Task<TenantInfo?> FindByCodeAsync(string code, CancellationToken cancellationToken);

    Task<IReadOnlyList<TenantInfo>> GetAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken);
}
