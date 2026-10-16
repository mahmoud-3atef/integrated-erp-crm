using IntegratedErp.Modules.Organization.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Organization.Infrastructure;

internal sealed class SettingConfiguration : IEntityTypeConfiguration<Setting>
{
    public void Configure(EntityTypeBuilder<Setting> builder)
    {
        builder.ToTable("setting", t =>
        {
            t.HasCheckConstraint("ck_setting_effective_range", "effective_to IS NULL OR effective_to > effective_from");
            // System scope has neither tenant nor scope id; Tenant scope has a tenant only; the rest have both.
            t.HasCheckConstraint(
                "ck_setting_scope_shape",
                "(scope_type = 'System' AND tenant_id IS NULL AND scope_id IS NULL) OR " +
                "(scope_type = 'Tenant' AND tenant_id IS NOT NULL AND scope_id IS NULL) OR " +
                "(scope_type IN ('LegalEntity','Customer','Contract','Project') AND tenant_id IS NOT NULL AND scope_id IS NOT NULL)");
        });

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.Key).HasMaxLength(Setting.KeyMaxLength).IsRequired();
        // Stored as a stable code, never as a number that could be re-ordered.
        builder.Property(s => s.ScopeType).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(s => s.Value).IsRequired();
        builder.Ignore(s => s.Scope);

        // One version per key, scope and start date; supports timeline lookups.
        // No filter: SQL Server treats NULLs as equal in a unique index, which is exactly what
        // System (no tenant, no scope id) and Tenant (no scope id) rows need.
        builder.HasIndex(s => new { s.Key, s.ScopeType, s.TenantId, s.ScopeId, s.EffectiveFrom })
            .IsUnique()
            .HasFilter(null);
    }
}
