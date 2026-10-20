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

    public DbSet<StaffPayrollRun> StaffRuns => Set<StaffPayrollRun>();

    public DbSet<StaffPayrollLine> StaffLines => Set<StaffPayrollLine>();

    public DbSet<StaffPayrollItem> StaffItems => Set<StaffPayrollItem>();

    public DbSet<StaffPayrollAdjustment> StaffAdjustments => Set<StaffPayrollAdjustment>();

    public DbSet<StaffPaySetting> StaffPaySettings => Set<StaffPaySetting>();

    public DbSet<GosiRate> GosiRates => Set<GosiRate>();

    public DbSet<GosiMember> GosiMembers => Set<GosiMember>();

    public DbSet<GosiTask> GosiTasks => Set<GosiTask>();

    public DbSet<GosiInvoice> GosiInvoices => Set<GosiInvoice>();

    public DbSet<SaudizationSetting> SaudizationSettings => Set<SaudizationSetting>();

    public DbSet<SaudizationTarget> SaudizationTargets => Set<SaudizationTarget>();

    public DbSet<PayslipPrint> PayslipPrints => Set<PayslipPrint>();
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
                         nameof(PayrollTotals.GosiEmployee), nameof(PayrollTotals.GosiEmployer),
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
        builder.Property(l => l.GosiCategory).HasMaxLength(20).IsRequired().HasDefaultValue(string.Empty);
        foreach (var name in new[]
                 {
                     nameof(PayrollLine.MonthlySalary), nameof(PayrollLine.PaidDays), nameof(PayrollLine.AbsenceDays), nameof(PayrollLine.Base),
                     nameof(PayrollLine.Housing), nameof(PayrollLine.Food), nameof(PayrollLine.Transport), nameof(PayrollLine.OtherAllowances),
                     nameof(PayrollLine.Overtime), nameof(PayrollLine.ClientAdditions), nameof(PayrollLine.InternalAdditions), nameof(PayrollLine.Allowances),
                     nameof(PayrollLine.ClientDeductions), nameof(PayrollLine.CustomerLoans), nameof(PayrollLine.InternalDeductions),
                     nameof(PayrollLine.Deductions), nameof(PayrollLine.Net),
                     nameof(PayrollLine.GosiBase), nameof(PayrollLine.GosiEmployee), nameof(PayrollLine.GosiEmployer),
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

internal sealed class StaffPayrollRunConfiguration : IEntityTypeConfiguration<StaffPayrollRun>
{
    public void Configure(EntityTypeBuilder<StaffPayrollRun> builder)
    {
        builder.ToTable("staff_run");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.RunNo).HasMaxLength(40).IsRequired();
        builder.Property(r => r.LegalEntityName).HasMaxLength(300).IsRequired();
        builder.Property(r => r.Period).HasMaxLength(7).IsRequired();
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(r => r.CreatedByName).HasMaxLength(200).IsRequired();
        builder.Property(r => r.ApprovedByName).HasMaxLength(200);
        builder.Property(r => r.LastComment).HasMaxLength(2000);
        builder.ComplexProperty(r => r.Totals, t =>
        {
            foreach (var name in new[] { nameof(StaffRunTotals.Employees), nameof(StaffRunTotals.NoSalary), nameof(StaffRunTotals.WithoutIban), nameof(StaffRunTotals.Joiners), nameof(StaffRunTotals.Leavers) })
            {
                t.Property<int>(name).HasColumnName("total_" + Names.Snake(name));
            }

            foreach (var name in new[]
                     {
                         nameof(StaffRunTotals.PaidDays), nameof(StaffRunTotals.Basic), nameof(StaffRunTotals.Housing), nameof(StaffRunTotals.OtherAllowances),
                         nameof(StaffRunTotals.Overtime), nameof(StaffRunTotals.Additions), nameof(StaffRunTotals.Allowances), nameof(StaffRunTotals.Absence),
                         nameof(StaffRunTotals.Penalties), nameof(StaffRunTotals.Advances), nameof(StaffRunTotals.OtherDeductions), nameof(StaffRunTotals.GosiEmployee),
                         nameof(StaffRunTotals.GosiEmployer), nameof(StaffRunTotals.Deductions), nameof(StaffRunTotals.Deferred), nameof(StaffRunTotals.Net),
                     })
            {
                t.Property<decimal>(name).HasPrecision(18, 2).HasColumnName("total_" + Names.Snake(name));
            }
        });
        builder.HasMany(r => r.Lines).WithOne().HasForeignKey(l => l.RunId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(r => r.Lines).HasField("_lines").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(r => new { r.TenantId, r.RunNo }).IsUnique();
        builder.HasIndex(r => new { r.TenantId, r.LegalEntityId, r.Period }).IsUnique();
    }
}

internal sealed class StaffPayrollLineConfiguration : IEntityTypeConfiguration<StaffPayrollLine>
{
    public void Configure(EntityTypeBuilder<StaffPayrollLine> builder)
    {
        builder.ToTable("staff_line");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();
        builder.Property(l => l.EmployeeNo).HasMaxLength(50).IsRequired();
        builder.Property(l => l.Name).HasMaxLength(300).IsRequired();
        builder.Property(l => l.DepartmentAr).HasMaxLength(200);
        builder.Property(l => l.DepartmentEn).HasMaxLength(200);
        builder.Property(l => l.JobTitleAr).HasMaxLength(200);
        builder.Property(l => l.JobTitleEn).HasMaxLength(200);
        builder.Property(l => l.GosiCategory).HasMaxLength(20).IsRequired();
        builder.Property(l => l.BankName).HasMaxLength(100);
        builder.Property(l => l.Iban).HasMaxLength(34);
        builder.Property(l => l.Notes).HasMaxLength(300).IsRequired();
        foreach (var p in typeof(StaffPayrollLine).GetProperties().Where(p => p.PropertyType == typeof(decimal)))
        {
            builder.Property(p.Name).HasPrecision(18, 2);
        }

        builder.HasMany(l => l.Items).WithOne().HasForeignKey(i => i.LineId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(l => l.Items).HasField("_items").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(l => new { l.RunId, l.EmployeeId }).IsUnique();
        builder.HasIndex(l => new { l.RunId, l.DepartmentId });
    }
}

internal sealed class StaffPayrollItemConfiguration : IEntityTypeConfiguration<StaffPayrollItem>
{
    public void Configure(EntityTypeBuilder<StaffPayrollItem> builder)
    {
        builder.ToTable("staff_item");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(i => i.Reference).HasMaxLength(60).IsRequired();
        builder.Property(i => i.Description).HasMaxLength(500).IsRequired();
        builder.Property(i => i.Period).HasMaxLength(7);
        builder.Property(i => i.Days).HasPrecision(9, 2);
        builder.Property(i => i.Due).HasPrecision(18, 2);
        builder.Property(i => i.Deducted).HasPrecision(18, 2);
        builder.HasIndex(i => i.RunId);
    }
}

internal sealed class StaffPayrollAdjustmentConfiguration : IEntityTypeConfiguration<StaffPayrollAdjustment>
{
    public void Configure(EntityTypeBuilder<StaffPayrollAdjustment> builder)
    {
        builder.ToTable("staff_adjustment");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(a => a.Amount).HasPrecision(18, 2);
        builder.Property(a => a.Reason).HasMaxLength(500).IsRequired();
        builder.Property(a => a.CreatedByName).HasMaxLength(200).IsRequired();
        builder.HasIndex(a => new { a.RunId, a.EmployeeId });
    }
}

internal sealed class StaffPaySettingConfiguration : IEntityTypeConfiguration<StaffPaySetting>
{
    public void Configure(EntityTypeBuilder<StaffPaySetting> builder)
    {
        builder.ToTable("staff_pay_setting");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.OvertimePremiumPercent).HasPrecision(6, 2);
        builder.Property(s => s.HoursPerDay).HasPrecision(5, 2);
        builder.Property(s => s.LateMode).HasConversion<string>().HasMaxLength(20);
        builder.HasIndex(s => s.TenantId).IsUnique();
    }
}

internal sealed class GosiRateConfiguration : IEntityTypeConfiguration<GosiRate>
{
    public void Configure(EntityTypeBuilder<GosiRate> builder)
    {
        builder.ToTable("gosi_rate");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Category).HasConversion<string>().HasMaxLength(20);
        builder.Property(r => r.EmployeePercent).HasPrecision(6, 3);
        builder.Property(r => r.EmployerPercent).HasPrecision(6, 3);
        builder.Property(r => r.MinBase).HasPrecision(18, 2);
        builder.Property(r => r.MaxBase).HasPrecision(18, 2);
        builder.HasIndex(r => new { r.TenantId, r.Category, r.EffectiveFrom }).IsUnique();
    }
}

internal sealed class GosiMemberConfiguration : IEntityTypeConfiguration<GosiMember>
{
    public void Configure(EntityTypeBuilder<GosiMember> builder)
    {
        builder.ToTable("gosi_member");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();
        builder.Property(m => m.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(m => m.RegisteredWage).HasPrecision(18, 2);
        builder.HasIndex(m => new { m.TenantId, m.Kind, m.PersonId }).IsUnique();
    }
}

internal sealed class GosiTaskConfiguration : IEntityTypeConfiguration<GosiTask>
{
    public void Configure(EntityTypeBuilder<GosiTask> builder)
    {
        builder.ToTable("gosi_task");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.EmployeeNo).HasMaxLength(50).IsRequired();
        builder.Property(t => t.Name).HasMaxLength(300).IsRequired();
        builder.Property(t => t.OldWage).HasPrecision(18, 2);
        builder.Property(t => t.NewWage).HasPrecision(18, 2);
        builder.Property(t => t.DoneByName).HasMaxLength(200);
        builder.Property(t => t.Reference).HasMaxLength(100);
        builder.HasIndex(t => new { t.TenantId, t.Status, t.Kind });
        builder.HasIndex(t => new { t.TenantId, t.EmployeeId });
    }
}

internal sealed class GosiInvoiceConfiguration : IEntityTypeConfiguration<GosiInvoice>
{
    public void Configure(EntityTypeBuilder<GosiInvoice> builder)
    {
        builder.ToTable("gosi_invoice");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Period).HasMaxLength(7).IsRequired();
        builder.Property(i => i.Amount).HasPrecision(18, 2);
        builder.Property(i => i.Note).HasMaxLength(500);
        builder.Property(i => i.EnteredByName).HasMaxLength(200).IsRequired();
        builder.HasIndex(i => new { i.TenantId, i.LegalEntityId, i.Period }).IsUnique();
    }
}

internal sealed class SaudizationSettingConfiguration : IEntityTypeConfiguration<SaudizationSetting>
{
    public void Configure(EntityTypeBuilder<SaudizationSetting> builder)
    {
        builder.ToTable("saudization_setting");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.FullWage).HasPrecision(18, 2);
        builder.HasIndex(s => s.TenantId).IsUnique();
    }
}

internal sealed class PayslipPrintConfiguration : IEntityTypeConfiguration<PayslipPrint>
{
    public void Configure(EntityTypeBuilder<PayslipPrint> builder)
    {
        builder.ToTable("payslip_print");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.RunKind).HasMaxLength(10).IsRequired();
        builder.Property(p => p.RunNo).HasMaxLength(30).IsRequired();
        builder.Property(p => p.PrintedByName).HasMaxLength(200).IsRequired();
        builder.HasIndex(p => new { p.TenantId, p.RunId });
    }
}

internal sealed class SaudizationTargetConfiguration : IEntityTypeConfiguration<SaudizationTarget>
{
    public void Configure(EntityTypeBuilder<SaudizationTarget> builder)
    {
        builder.ToTable("saudization_target");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.RequiredPercent).HasPrecision(6, 2);
        builder.HasIndex(t => new { t.TenantId, t.LegalEntityId }).IsUnique();
    }
}

internal static class Names
{
    public static string Snake(string name) =>
        string.Concat(name.Select((c, i) => i > 0 && char.IsUpper(c) ? "_" + char.ToLowerInvariant(c) : char.ToLowerInvariant(c).ToString()));
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
