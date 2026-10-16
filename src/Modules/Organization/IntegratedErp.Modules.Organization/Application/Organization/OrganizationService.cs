using IntegratedErp.Modules.Organization.Domain.LegalEntities;
using IntegratedErp.Modules.Organization.Domain.Tenants;
using IntegratedErp.Modules.Organization.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Organization.Application.Organization;

public sealed record TenantDto(Guid Id, string Code, string NameAr, string NameEn, bool IsActive);

public sealed record LegalEntityDto(Guid Id, string Code, string NameAr, string NameEn, string CommercialRegistrationNo, string? VatNumber, bool IsActive);

/// <summary>Tenants and legal entities.</summary>
internal sealed class OrganizationService(OrganizationDbContext db)
{
    public async Task<Result<TenantDto>> CreateTenantAsync(string code, string nameAr, string nameEn, CancellationToken cancellationToken)
    {
        var created = Tenant.Create(code, nameAr, nameEn);
        if (created.IsFailure)
        {
            return Result.Failure<TenantDto>(created.Error);
        }

        if (await db.Tenants.AnyAsync(t => t.Code == created.Value.Code, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<TenantDto>(Error.Conflict("tenant_code_taken", $"Tenant code '{created.Value.Code}' already exists."));
        }

        db.Tenants.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(created.Value));
    }

    public async Task<IReadOnlyList<TenantDto>> ListTenantsAsync(CancellationToken cancellationToken) =>
        (await db.Tenants.AsNoTracking().OrderBy(t => t.Code).ToListAsync(cancellationToken).ConfigureAwait(false))
            .Select(ToDto).ToList();

    /// <summary>Creates a legal entity for the current tenant.</summary>
    public async Task<Result<LegalEntityDto>> CreateLegalEntityAsync(string code, string nameAr, string nameEn, string crNumber, string? vatNumber, CancellationToken cancellationToken)
    {
        var created = LegalEntity.Create(code, nameAr, nameEn, crNumber, vatNumber);
        if (created.IsFailure)
        {
            return Result.Failure<LegalEntityDto>(created.Error);
        }

        // The tenant filter limits this check to the current tenant.
        if (await db.LegalEntities.AnyAsync(e => e.Code == created.Value.Code, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<LegalEntityDto>(Error.Conflict("legal_entity_code_taken", $"Legal entity code '{created.Value.Code}' already exists."));
        }

        db.LegalEntities.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(created.Value));
    }

    /// <summary>Legal entities of the current tenant only (query filter + row-level security).</summary>
    public async Task<IReadOnlyList<LegalEntityDto>> ListLegalEntitiesAsync(CancellationToken cancellationToken) =>
        (await db.LegalEntities.AsNoTracking().OrderBy(e => e.Code).ToListAsync(cancellationToken).ConfigureAwait(false))
            .Select(ToDto).ToList();

    private static TenantDto ToDto(Tenant t) => new(t.Id, t.Code, t.NameAr, t.NameEn, t.IsActive);

    private static LegalEntityDto ToDto(LegalEntity e) =>
        new(e.Id, e.Code, e.NameAr, e.NameEn, e.CommercialRegistrationNo, e.VatNumber, e.IsActive);
}
