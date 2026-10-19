using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Payroll.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Payroll.Infrastructure;

internal sealed class PayrollDbContext(DbContextOptions<PayrollDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "payroll";

    public override string Schema => SchemaName;

    public DbSet<PayrollRun> Runs => Set<PayrollRun>();

    public DbSet<PayrollLine> Lines => Set<PayrollLine>();

    public DbSet<PayrollLineSource> Sources => Set<PayrollLineSource>();

    public DbSet<PayrollExclusion> Exclusions => Set<PayrollExclusion>();

    public DbSet<SponsorRegistration> Sponsors => Set<SponsorRegistration>();
}

internal sealed class PayrollRunConfiguration : IEntityTypeConfiguration<PayrollRun>
{
    public void Configure(EntityTypeBuilder<PayrollRun> builder)
    {
        builder.ToTable("payroll_run");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.RunNo).HasMaxLength(40).IsRequired();
        builder.Property(r => r.Group).HasConversion<string>().HasMaxLength(30);
        builder.Property(r => r.LegalEntityName).HasMaxLength(300).IsRequired();
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(r => r.CreatedByName).HasMaxLength(200).IsRequired();
        builder.Property(r => r.ApprovedByName).HasMaxLength(200);
        builder.Property(r => r.LastComment).HasMaxLength(2000);
        builder.ComplexProperty(r => r.Totals, t =>
        {
            t.Property(x => x.Workers).HasColumnName("total_workers");
            t.Property(x => x.Excluded).HasColumnName("total_excluded");
            foreach (var name in new[]
                     {
                         nameof(PayrollTotals.PaidDays), nameof(PayrollTotals.Base), nameof(PayrollTotals.Housing), nameof(PayrollTotals.Food),
                         nameof(PayrollTotals.Transport), nameof(PayrollTotals.OtherAllowances), nameof(PayrollTotals.Overtime), nameof(PayrollTotals.Additions),
                         nameof(PayrollTotals.Allowances), nameof(PayrollTotals.Deductions), nameof(PayrollTotals.Net),
                     })
            {
                t.Property<decimal>(name).HasPrecision(18, 2).HasColumnName("total_" + Snake(name));
            }
        });
        builder.HasMany(r => r.Lines).WithOne().HasForeignKey(l => l.RunId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(r => r.Lines).HasField("_lines").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasMany(r => r.Exclusions).WithOne().HasForeignKey(e => e.RunId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(r => r.Exclusions).HasField("_exclusions").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(r => new { r.TenantId, r.RunNo }).IsUnique();
        builder.HasIndex(r => new { r.TenantId, r.Group, r.LegalEntityId, r.From });
    }

    private static string Snake(string name) =>
        string.Concat(name.Select((c, i) => i > 0 && char.IsUpper(c) ? "_" + char.ToLowerInvariant(c) : char.ToLowerInvariant(c).ToString()));
}

internal sealed class PayrollLineConfiguration : IEntityTypeConfiguration<PayrollLine>
{
    public void Configure(EntityTypeBuilder<PayrollLine> builder)
    {
        builder.ToTable("payroll_line");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();
        builder.Property(l => l.WorkerNo).HasMaxLength(50).IsRequired();
        builder.Property(l => l.Name).HasMaxLength(300).IsRequired();
        builder.Property(l => l.ProfessionCode).HasMaxLength(50);
        builder.Property(l => l.StatusAr).HasMaxLength(100);
        builder.Property(l => l.StatusEn).HasMaxLength(100);
        builder.Property(l => l.ProjectName).HasMaxLength(300).IsRequired();
        builder.Property(l => l.Notes).HasMaxLength(200).IsRequired();
        foreach (var name in new[]
                 {
                     nameof(PayrollLine.MonthlySalary), nameof(PayrollLine.PaidDays), nameof(PayrollLine.AbsenceDays), nameof(PayrollLine.Base),
                     nameof(PayrollLine.Housing), nameof(PayrollLine.Food), nameof(PayrollLine.Transport), nameof(PayrollLine.OtherAllowances),
                     nameof(PayrollLine.Overtime), nameof(PayrollLine.ClientAdditions), nameof(PayrollLine.InternalAdditions), nameof(PayrollLine.Allowances),
                     nameof(PayrollLine.ClientDeductions), nameof(PayrollLine.CustomerLoans), nameof(PayrollLine.InternalDeductions),
                     nameof(PayrollLine.Deductions), nameof(PayrollLine.Net),
                 })
        {
            builder.Property<decimal>(name).HasPrecision(18, 2);
        }

        builder.HasMany(l => l.Sources).WithOne().HasForeignKey(s => s.LineId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(l => l.Sources).HasField("_sources").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(l => new { l.RunId, l.WorkerId }).IsUnique();
        builder.HasIndex(l => new { l.RunId, l.ProjectCrmId });
    }
}

internal sealed class PayrollLineSourceConfiguration : IEntityTypeConfiguration<PayrollLineSource>
{
    public void Configure(EntityTypeBuilder<PayrollLineSource> builder)
    {
        builder.ToTable("payroll_line_source");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.TimesheetNo).HasMaxLength(40).IsRequired();
        builder.Property(s => s.ProjectName).HasMaxLength(300).IsRequired();
        foreach (var name in new[]
                 {
                     nameof(PayrollLineSource.WorkDays), nameof(PayrollLineSource.DayDivisor), nameof(PayrollLineSource.AbsenceDays), nameof(PayrollLineSource.PaySalary),
                     nameof(PayrollLineSource.SalaryPart), nameof(PayrollLineSource.Overtime), nameof(PayrollLineSource.OvertimeHours), nameof(PayrollLineSource.ClientAdditions),
                     nameof(PayrollLineSource.ClientDeductions), nameof(PayrollLineSource.CustomerLoans), nameof(PayrollLineSource.InternalAdditions),
                     nameof(PayrollLineSource.InternalDeductions), nameof(PayrollLineSource.Net),
                 })
        {
            builder.Property<decimal>(name).HasPrecision(18, 2);
        }

        // A timesheet line is paid in one run only.
        builder.HasIndex(s => new { s.TenantId, s.TimesheetLineId }).IsUnique();
        builder.HasIndex(s => s.RunId);
    }
}

internal sealed class PayrollExclusionConfiguration : IEntityTypeConfiguration<PayrollExclusion>
{
    public void Configure(EntityTypeBuilder<PayrollExclusion> builder)
    {
        builder.ToTable("payroll_exclusion");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Kind).HasConversion<string>().HasMaxLength(30);
        builder.Property(e => e.WorkerNo).HasMaxLength(50).IsRequired();
        builder.Property(e => e.Name).HasMaxLength(300).IsRequired();
        builder.Property(e => e.ProjectName).HasMaxLength(300);
        builder.Property(e => e.Reference).HasMaxLength(60);
        builder.HasIndex(e => e.RunId);
    }
}

internal sealed class SponsorRegistrationConfiguration : IEntityTypeConfiguration<SponsorRegistration>
{
    public void Configure(EntityTypeBuilder<SponsorRegistration> builder)
    {
        builder.ToTable("sponsor_registration");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.Sponsor).HasMaxLength(100).IsRequired();
        builder.HasIndex(s => new { s.TenantId, s.Sponsor }).IsUnique();
    }
}

internal sealed class PayrollDesignTimeDbContextFactory : IDesignTimeDbContextFactory<PayrollDbContext>
{
    public PayrollDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<PayrollDbContext>();
        PersistenceExtensions.Configure(options, connectionString, PayrollDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new PayrollDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
