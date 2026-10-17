using IntegratedErp.Modules.Organization.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Organization.Infrastructure;

internal sealed class NumberingSettingConfiguration : IEntityTypeConfiguration<NumberingSetting>
{
    public void Configure(EntityTypeBuilder<NumberingSetting> builder)
    {
        builder.ToTable("numbering_setting");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.Key).HasMaxLength(50).IsRequired();
        builder.Property(s => s.Pattern).HasMaxLength(40).IsRequired();
        builder.Property(s => s.Reset).HasConversion<string>().HasMaxLength(10);
        builder.Property(s => s.UpdatedByName).HasMaxLength(200).IsRequired();
        builder.HasIndex(s => new { s.TenantId, s.Key }).IsUnique();
    }
}
