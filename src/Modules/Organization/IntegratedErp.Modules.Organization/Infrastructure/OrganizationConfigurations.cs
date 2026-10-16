using IntegratedErp.Modules.Organization.Domain.LegalEntities;
using IntegratedErp.Modules.Organization.Domain.Tenants;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Organization.Infrastructure;

internal sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenant");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.Code).HasMaxLength(Tenant.CodeMaxLength).IsRequired();
        builder.Property(t => t.NameAr).HasMaxLength(Tenant.NameMaxLength).IsRequired();
        builder.Property(t => t.NameEn).HasMaxLength(Tenant.NameMaxLength).IsRequired();
        builder.HasIndex(t => t.Code).IsUnique();
    }
}

internal sealed class LegalEntityConfiguration : IEntityTypeConfiguration<LegalEntity>
{
    public void Configure(EntityTypeBuilder<LegalEntity> builder)
    {
        builder.ToTable("legal_entity");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Code).HasMaxLength(LegalEntity.CodeMaxLength).IsRequired();
        builder.Property(e => e.NameAr).HasMaxLength(LegalEntity.NameMaxLength).IsRequired();
        builder.Property(e => e.NameEn).HasMaxLength(LegalEntity.NameMaxLength).IsRequired();
        builder.Property(e => e.CommercialRegistrationNo).HasMaxLength(10).IsRequired();
        builder.Property(e => e.VatNumber).HasMaxLength(15);
        builder.HasOne<Tenant>().WithMany().HasForeignKey(e => e.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(e => new { e.TenantId, e.Code }).IsUnique();
    }
}
