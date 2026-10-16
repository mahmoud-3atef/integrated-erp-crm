namespace IntegratedErp.Modules.Organization.Contracts;

/// <summary>A commercial registration of the current company, as other modules may see it.</summary>
public sealed record LegalEntityInfo(Guid Id, string Code, string NameAr, string NameEn, bool IsActive);

/// <summary>Read access to the current company's commercial registrations (e.g. Identity scoping a role to one).</summary>
public interface ILegalEntityDirectory
{
    Task<IReadOnlyList<LegalEntityInfo>> ListAsync(CancellationToken cancellationToken);
}
