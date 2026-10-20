using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Deductions.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Deductions.Infrastructure;

internal sealed class DeductionsDbContext(DbContextOptions<DeductionsDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "deduction";

    public override string Schema => SchemaName;

    public DbSet<DeductionSetting> Settings => Set<DeductionSetting>();

    public DbSet<PenaltyType> PenaltyTypes => Set<PenaltyType>();

    public DbSet<Advance> Advances => Set<Advance>();

    public DbSet<AdvanceInstallment> Installments => Set<AdvanceInstallment>();

    public DbSet<Penalty> Penalties => Set<Penalty>();
}

internal sealed class DeductionSettingConfiguration : IEntityTypeConfiguration<DeductionSetting>
{
    public void Configure(EntityTypeBuilder<DeductionSetting> builder)
    {
        builder.ToTable("setting");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        foreach (var name in new[] { nameof(DeductionSetting.AdvanceCapPercent), nameof(DeductionSetting.PenaltyMaxDaysPerViolation), nameof(DeductionSetting.PenaltyMaxDaysPerMonth), nameof(DeductionSetting.SuspensionMaxDaysPerMonth), nameof(DeductionSetting.MonthlyCapPercent) })
        {
            builder.Property<decimal>(name).HasPrecision(7, 2);
        }

        builder.HasIndex(s => s.TenantId).IsUnique();
    }
}

internal sealed class PenaltyTypeConfiguration : IEntityTypeConfiguration<PenaltyType>
{
    public void Configure(EntityTypeBuilder<PenaltyType> builder)
    {
        builder.ToTable("penalty_type");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.Code).HasMaxLength(30).IsRequired();
        builder.Property(t => t.NameAr).HasMaxLength(100).IsRequired();
        builder.Property(t => t.NameEn).HasMaxLength(100).IsRequired();
        builder.Property(t => t.Effect).HasConversion<string>().HasMaxLength(20);
    }
}

internal sealed class AdvanceConfiguration : IEntityTypeConfiguration<Advance>
{
    public void Configure(EntityTypeBuilder<Advance> builder)
    {
        builder.ToTable("advance");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.AdvanceNo).HasMaxLength(40).IsRequired();
        builder.Property(a => a.EmployeeName).HasMaxLength(300).IsRequired();
        builder.Property(a => a.Amount).HasPrecision(18, 2);
        builder.Property(a => a.SalaryAtRequest).HasPrecision(18, 2);
        builder.Property(a => a.FirstPeriod).HasMaxLength(7).IsRequired();
        builder.Property(a => a.Reason).HasMaxLength(500).IsRequired();
        builder.Property(a => a.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(a => a.PaidBy).HasMaxLength(200);
        builder.Property(a => a.PaymentMethod).HasMaxLength(50);
        builder.Property(a => a.PaymentReference).HasMaxLength(100);
        builder.Property(a => a.CreatedByName).HasMaxLength(200).IsRequired();
        builder.Property(a => a.LastComment).HasMaxLength(2000);
        builder.Ignore(a => a.Remaining);
        builder.HasMany(a => a.Installments).WithOne().HasForeignKey(i => i.AdvanceId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(a => a.Installments).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(a => new { a.TenantId, a.AdvanceNo }).IsUnique();
        builder.HasIndex(a => new { a.TenantId, a.EmployeeId });
    }
}

internal sealed class AdvanceInstallmentConfiguration : IEntityTypeConfiguration<AdvanceInstallment>
{
    public void Configure(EntityTypeBuilder<AdvanceInstallment> builder)
    {
        builder.ToTable("advance_installment");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Period).HasMaxLength(7).IsRequired();
        builder.Property(i => i.Amount).HasPrecision(18, 2);
        builder.Property(i => i.Deducted).HasPrecision(18, 2);
        builder.Property(i => i.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(i => i.Note).HasMaxLength(500);
        builder.HasIndex(i => new { i.TenantId, i.Period });
    }
}

internal sealed class PenaltyConfiguration : IEntityTypeConfiguration<Penalty>
{
    public void Configure(EntityTypeBuilder<Penalty> builder)
    {
        builder.ToTable("penalty");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.PenaltyNo).HasMaxLength(40).IsRequired();
        builder.Property(p => p.Category).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.EmployeeName).HasMaxLength(300).IsRequired();
        builder.Property(p => p.Effect).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.Description).HasMaxLength(1000).IsRequired();
        builder.Property(p => p.Statement).HasMaxLength(2000);
        builder.Property(p => p.Days).HasPrecision(6, 2);
        builder.Property(p => p.Amount).HasPrecision(18, 2);
        builder.Property(p => p.Period).HasMaxLength(7).IsRequired();
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.CreatedByName).HasMaxLength(200).IsRequired();
        builder.Property(p => p.LastComment).HasMaxLength(2000);
        builder.HasIndex(p => new { p.TenantId, p.PenaltyNo }).IsUnique();
        builder.HasIndex(p => new { p.TenantId, p.EmployeeId, p.Period });
    }
}

internal sealed class DeductionsDesignTimeDbContextFactory : IDesignTimeDbContextFactory<DeductionsDbContext>
{
    public DeductionsDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<DeductionsDbContext>();
        PersistenceExtensions.Configure(options, connectionString, DeductionsDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new DeductionsDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
