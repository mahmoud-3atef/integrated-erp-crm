using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Billing.Infrastructure;

internal sealed class BillingDbContext(DbContextOptions<BillingDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "billing";

    public override string Schema => SchemaName;

    public DbSet<Timesheet> Timesheets => Set<Timesheet>();

    public DbSet<TimesheetLine> TimesheetLines => Set<TimesheetLine>();

    public DbSet<TimesheetAdjustment> TimesheetAdjustments => Set<TimesheetAdjustment>();

    public DbSet<ProjectBillingSetting> ProjectSettings => Set<ProjectBillingSetting>();

    public DbSet<Invoice> Invoices => Set<Invoice>();

    public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();

    public DbSet<InvoiceWorkerLine> InvoiceWorkers => Set<InvoiceWorkerLine>();
}

internal sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.ToTable("invoice");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Kind).HasConversion<string>().HasMaxLength(15);
        builder.Property(i => i.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(i => i.InvoiceNo).HasMaxLength(40);
        builder.Property(i => i.TimesheetNo).HasMaxLength(40);
        builder.Property(i => i.OriginalInvoiceNo).HasMaxLength(40);
        builder.Property(i => i.ProjectCode).HasMaxLength(100).IsRequired();
        builder.Property(i => i.ProjectName).HasMaxLength(300).IsRequired();
        builder.Property(i => i.ContractType).HasMaxLength(30);
        builder.Property(i => i.CustomerName).HasMaxLength(300).IsRequired();
        builder.Property(i => i.CustomerNameEn).HasMaxLength(300);
        builder.Property(i => i.CustomerVatNumber).HasMaxLength(50);
        builder.Property(i => i.CustomerRegistration).HasMaxLength(50);
        builder.Property(i => i.CustomerCity).HasMaxLength(100);
        builder.Property(i => i.VatRate).HasPrecision(9, 4);
        builder.Property(i => i.Amount).HasPrecision(18, 2);
        builder.Property(i => i.Vat).HasPrecision(18, 2);
        builder.Property(i => i.Total).HasPrecision(18, 2);
        builder.Property(i => i.Reason).HasMaxLength(1000);
        builder.Property(i => i.Remarks).HasMaxLength(1000);
        builder.Property(i => i.CreatedByName).HasMaxLength(200).IsRequired();
        builder.Property(i => i.IssuedByName).HasMaxLength(200);
        builder.Property(i => i.LastComment).HasMaxLength(2000);
        builder.Property(i => i.SellerName).HasMaxLength(200);
        builder.Property(i => i.SellerNameEn).HasMaxLength(200);
        builder.Property(i => i.SellerVatNumber).HasMaxLength(50);
        builder.Property(i => i.SellerRegistration).HasMaxLength(50);
        builder.HasMany(i => i.Items).WithOne().HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(i => i.Items).HasField("_items").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasMany(i => i.Workers).WithOne().HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(i => i.Workers).HasField("_workers").UsePropertyAccessMode(PropertyAccessMode.Field);

        // Issued numbers never repeat; one monthly invoice per timesheet (notes have none).
        builder.HasIndex(i => new { i.TenantId, i.InvoiceNo }).IsUnique().HasFilter("[invoice_no] IS NOT NULL");
        builder.HasIndex(i => new { i.TenantId, i.TimesheetId }).IsUnique().HasFilter("[timesheet_id] IS NOT NULL");
        builder.HasIndex(i => new { i.TenantId, i.OriginalInvoiceId });
        builder.HasIndex(i => new { i.TenantId, i.Month });
    }
}

internal sealed class InvoiceItemConfiguration : IEntityTypeConfiguration<InvoiceItem>
{
    public void Configure(EntityTypeBuilder<InvoiceItem> builder)
    {
        builder.ToTable("invoice_item");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Component).HasConversion<string>().HasMaxLength(20);
        builder.Property(i => i.Description).HasMaxLength(300);
        builder.Property(i => i.Amount).HasPrecision(18, 2);
    }
}

internal sealed class InvoiceWorkerLineConfiguration : IEntityTypeConfiguration<InvoiceWorkerLine>
{
    public void Configure(EntityTypeBuilder<InvoiceWorkerLine> builder)
    {
        builder.ToTable("invoice_worker");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();
        builder.Property(l => l.PeriodKey).HasMaxLength(40);
        builder.Property(l => l.WorkerNo).HasMaxLength(50).IsRequired();
        builder.Property(l => l.Name).HasMaxLength(300).IsRequired();
        builder.Property(l => l.IqamaNo).HasMaxLength(50);
        builder.Property(l => l.ProfessionCode).HasMaxLength(50);
        builder.Property(l => l.NationalityCode).HasMaxLength(50);
        foreach (var name in new[]
                 {
                     nameof(InvoiceWorkerLine.WorkDays), nameof(InvoiceWorkerLine.MonthlyPrice), nameof(InvoiceWorkerLine.DueSalary), nameof(InvoiceWorkerLine.AbsenceDays),
                     nameof(InvoiceWorkerLine.AbsenceAmount), nameof(InvoiceWorkerLine.DueFees), nameof(InvoiceWorkerLine.DueHousing), nameof(InvoiceWorkerLine.DueTransport),
                     nameof(InvoiceWorkerLine.OvertimeHours), nameof(InvoiceWorkerLine.Overtime), nameof(InvoiceWorkerLine.ClientAdditions), nameof(InvoiceWorkerLine.ClientDeductions),
                     nameof(InvoiceWorkerLine.CustomerLoans), nameof(InvoiceWorkerLine.OtherCosts), nameof(InvoiceWorkerLine.Gosi), nameof(InvoiceWorkerLine.Amount),
                     nameof(InvoiceWorkerLine.Vat), nameof(InvoiceWorkerLine.Total),
                 })
        {
            builder.Property<decimal>(name).HasPrecision(18, 2);
        }

        builder.HasIndex(l => new { l.TenantId, l.WorkerId });
    }
}

internal sealed class TimesheetConfiguration : IEntityTypeConfiguration<Timesheet>
{
    public void Configure(EntityTypeBuilder<Timesheet> builder)
    {
        builder.ToTable("timesheet");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.TimesheetNo).HasMaxLength(40).IsRequired();
        builder.Property(t => t.ProjectCode).HasMaxLength(100).IsRequired();
        builder.Property(t => t.ProjectName).HasMaxLength(300).IsRequired();
        builder.Property(t => t.CustomerName).HasMaxLength(300);
        builder.Property(t => t.ContractType).HasMaxLength(30);
        builder.Property(t => t.DayBasis).HasConversion<string>().HasMaxLength(15);
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.GeneratedByName).HasMaxLength(200).IsRequired();
        builder.Property(t => t.ApprovedByName).HasMaxLength(200);
        builder.Property(t => t.LastComment).HasMaxLength(2000);
        builder.HasMany(t => t.Lines).WithOne().HasForeignKey(l => l.TimesheetId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(t => t.Lines).HasField("_lines").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasMany(t => t.Adjustments).WithOne().HasForeignKey(a => a.TimesheetId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(t => t.Adjustments).HasField("_adjustments").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(t => new { t.TenantId, t.TimesheetNo }).IsUnique();

        // One timesheet per project and month.
        builder.HasIndex(t => new { t.TenantId, t.ProjectId, t.Month }).IsUnique();
    }
}

internal sealed class TimesheetLineConfiguration : IEntityTypeConfiguration<TimesheetLine>
{
    public void Configure(EntityTypeBuilder<TimesheetLine> builder)
    {
        builder.ToTable("timesheet_line");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();
        builder.Property(l => l.PeriodKey).HasMaxLength(40).IsRequired();
        builder.Property(l => l.WorkerNo).HasMaxLength(50).IsRequired();
        builder.Property(l => l.Name).HasMaxLength(300).IsRequired();
        builder.Property(l => l.IqamaNo).HasMaxLength(50);
        builder.Property(l => l.ProfessionCode).HasMaxLength(50);
        builder.Property(l => l.NationalityCode).HasMaxLength(50);
        builder.Property(l => l.Source).HasConversion<string>().HasMaxLength(10);
        builder.Property(l => l.SupplierName).HasMaxLength(100);
        builder.Property(l => l.PackageNo).HasMaxLength(30);
        builder.Property(l => l.SourceType).HasMaxLength(30);
        builder.Property(l => l.SourceNo).HasMaxLength(50).IsRequired();
        foreach (var name in new[]
                 {
                     nameof(TimesheetLine.WorkDays), nameof(TimesheetLine.DayDivisor), nameof(TimesheetLine.BillSalary), nameof(TimesheetLine.TotalPrice),
                     nameof(TimesheetLine.Housing), nameof(TimesheetLine.Transport), nameof(TimesheetLine.PaySalary), nameof(TimesheetLine.BasicSalary),
                     nameof(TimesheetLine.AbsenceDays), nameof(TimesheetLine.OvertimeHours), nameof(TimesheetLine.ClientAdditions),
                     nameof(TimesheetLine.ClientDeductions), nameof(TimesheetLine.CustomerLoans), nameof(TimesheetLine.FeeDaysAdjust),
                     nameof(TimesheetLine.OtherCosts), nameof(TimesheetLine.InternalAdditions), nameof(TimesheetLine.InternalDeductions), nameof(TimesheetLine.FeeDays), nameof(TimesheetLine.DueSalary), nameof(TimesheetLine.AbsenceAmount),
                     nameof(TimesheetLine.DueFees), nameof(TimesheetLine.DueHousing), nameof(TimesheetLine.DueTransport), nameof(TimesheetLine.Overtime),
                     nameof(TimesheetLine.Gosi), nameof(TimesheetLine.InvoiceAmount), nameof(TimesheetLine.Vat), nameof(TimesheetLine.InvoiceTotal),
                     nameof(TimesheetLine.PayDueSalary), nameof(TimesheetLine.PayAbsence), nameof(TimesheetLine.WorkerNet),
                 })
        {
            builder.Property<decimal>(name).HasPrecision(18, 2);
        }

        builder.HasIndex(l => new { l.TenantId, l.WorkerId });
    }
}

internal sealed class TimesheetAdjustmentConfiguration : IEntityTypeConfiguration<TimesheetAdjustment>
{
    public void Configure(EntityTypeBuilder<TimesheetAdjustment> builder)
    {
        builder.ToTable("timesheet_adjustment");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.Type).HasConversion<string>().HasMaxLength(20);
        builder.Property(a => a.Value).HasPrecision(18, 2);
        builder.Property(a => a.Reason).HasMaxLength(500).IsRequired();
        builder.Property(a => a.CreatedByName).HasMaxLength(200).IsRequired();
        builder.HasIndex(a => new { a.TenantId, a.TimesheetId, a.WorkerId });
    }
}

internal sealed class ProjectBillingSettingConfiguration : IEntityTypeConfiguration<ProjectBillingSetting>
{
    public void Configure(EntityTypeBuilder<ProjectBillingSetting> builder)
    {
        builder.ToTable("project_setting");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.DayBasis).HasConversion<string>().HasMaxLength(15);
        builder.Property(s => s.OvertimeMultiplier).HasPrecision(9, 4);
        builder.Property(s => s.MonthlyHours).HasPrecision(9, 2);
        builder.Property(s => s.OvertimeHourlyRate).HasPrecision(18, 2);
        builder.Property(s => s.MaxOvertimeHours).HasPrecision(9, 2);
        builder.Property(s => s.GosiRate).HasPrecision(9, 4);
        builder.Property(s => s.VatRate).HasPrecision(9, 4);
        builder.HasIndex(s => new { s.TenantId, s.ProjectId }).IsUnique();
    }
}

/// <summary>Used only by <c>dotnet ef migrations add</c>; no database connection is opened.</summary>
internal sealed class BillingDesignTimeDbContextFactory : IDesignTimeDbContextFactory<BillingDbContext>
{
    public BillingDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<BillingDbContext>();
        PersistenceExtensions.Configure(options, connectionString, BillingDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new BillingDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
