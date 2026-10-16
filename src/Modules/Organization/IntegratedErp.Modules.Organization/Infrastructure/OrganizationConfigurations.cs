using IntegratedErp.Modules.Organization.Domain.Branches;
using IntegratedErp.Modules.Organization.Domain.LegalEntities;
using IntegratedErp.Modules.Organization.Domain.Reference;
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

internal sealed class BranchConfiguration : IEntityTypeConfiguration<Branch>
{
    public void Configure(EntityTypeBuilder<Branch> builder)
    {
        builder.ToTable("branch");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).ValueGeneratedNever();
        builder.Property(b => b.Code).HasMaxLength(Branch.CodeMaxLength).IsRequired();
        builder.Property(b => b.NameAr).HasMaxLength(Branch.NameMaxLength).IsRequired();
        builder.Property(b => b.NameEn).HasMaxLength(Branch.NameMaxLength).IsRequired();
        builder.Property(b => b.City).HasMaxLength(Branch.CityMaxLength);
        builder.HasOne<LegalEntity>().WithMany().HasForeignKey(b => b.LegalEntityId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(b => new { b.TenantId, b.Code }).IsUnique();
    }
}

internal sealed class ReferenceItemConfiguration : IEntityTypeConfiguration<ReferenceItem>
{
    public void Configure(EntityTypeBuilder<ReferenceItem> builder)
    {
        builder.ToTable("reference_item");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.ListCode).HasMaxLength(50).IsRequired();
        builder.Property(i => i.Code).HasMaxLength(ReferenceItem.CodeMaxLength).IsRequired();
        builder.Property(i => i.NameAr).HasMaxLength(ReferenceItem.NameMaxLength).IsRequired();
        builder.Property(i => i.NameEn).HasMaxLength(ReferenceItem.NameMaxLength).IsRequired();
        builder.HasIndex(i => new { i.TenantId, i.ListCode, i.Code }).IsUnique();
    }
}
