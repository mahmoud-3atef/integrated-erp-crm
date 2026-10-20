using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Workforce.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Workforce.Infrastructure;

internal sealed class WorkforceDbContext(DbContextOptions<WorkforceDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "workforce";

    public override string Schema => SchemaName;

    public DbSet<Person> People => Set<Person>();

    public DbSet<PersonIdentifier> Identifiers => Set<PersonIdentifier>();

    public DbSet<Worker> Workers => Set<Worker>();

    public DbSet<WorkforceImport> Imports => Set<WorkforceImport>();

    public DbSet<WorkerPeriod> Periods => Set<WorkerPeriod>();

    public DbSet<HistoryPeriod> HistoryPeriods => Set<HistoryPeriod>();

    public DbSet<HistoryIssue> HistoryIssues => Set<HistoryIssue>();

    public DbSet<HistoryImport> HistoryImports => Set<HistoryImport>();

    public DbSet<InvoiceCheckLine> InvoiceCheckLines => Set<InvoiceCheckLine>();

    public DbSet<InvoiceCheckImport> InvoiceCheckImports => Set<InvoiceCheckImport>();

    public DbSet<WorkerProfile> WorkerProfiles => Set<WorkerProfile>();

    public DbSet<WorkerPhoto> WorkerPhotos => Set<WorkerPhoto>();
}

internal sealed class WorkerProfileConfiguration : IEntityTypeConfiguration<WorkerProfile>
{
    public void Configure(EntityTypeBuilder<WorkerProfile> builder)
    {
        builder.ToTable("worker_profile");
        builder.HasKey(p => p.WorkerId);
        builder.Property(p => p.WorkerId).ValueGeneratedNever();
        builder.Property(p => p.Specialty).HasMaxLength(30);
        builder.Property(p => p.Skills).HasMaxLength(WorkerProfile.CodesMaxLength).IsRequired();
        builder.Property(p => p.Languages).HasMaxLength(WorkerProfile.CodesMaxLength).IsRequired();
        builder.Property(p => p.Gender).HasMaxLength(1);
        builder.Property(p => p.Religion).HasMaxLength(20);
        builder.Property(p => p.Education).HasMaxLength(20);
        builder.Property(p => p.BioAr).HasMaxLength(WorkerProfile.BioMaxLength);
        builder.Property(p => p.BioEn).HasMaxLength(WorkerProfile.BioMaxLength);
        builder.Property(p => p.UpdatedBy).HasMaxLength(200).IsRequired();
        builder.HasIndex(p => new { p.TenantId, p.Specialty });
    }
}

internal sealed class WorkerPhotoConfiguration : IEntityTypeConfiguration<WorkerPhoto>
{
    public void Configure(EntityTypeBuilder<WorkerPhoto> builder)
    {
        builder.ToTable("worker_photo");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.ContentType).HasMaxLength(50).IsRequired();
        builder.Property(p => p.StorageKey).HasMaxLength(200).IsRequired();
        builder.Property(p => p.UploadedBy).HasMaxLength(200).IsRequired();
        builder.HasIndex(p => new { p.TenantId, p.WorkerId, p.SortOrder });
    }
}

internal sealed class InvoiceCheckLineConfiguration : IEntityTypeConfiguration<InvoiceCheckLine>
{
    public void Configure(EntityTypeBuilder<InvoiceCheckLine> builder)
    {
        builder.ToTable("invoice_check");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();
        builder.Property(l => l.WorkerNo).HasMaxLength(30).IsRequired();
        builder.Property(l => l.Name).HasMaxLength(200).IsRequired();
        builder.Property(l => l.ProjectName).HasMaxLength(300);
        builder.Property(l => l.InvoiceNo).HasMaxLength(50);
        builder.Property(l => l.MonthDays).HasPrecision(9, 2);
        builder.Property(l => l.WorkingDays).HasPrecision(9, 2);
        builder.Property(l => l.AbsentDays).HasPrecision(9, 2);
        builder.Property(l => l.LedgerDays).HasPrecision(9, 2);
        builder.Property(l => l.InvoicedPrice).HasPrecision(18, 2);
        builder.Property(l => l.Amount).HasPrecision(18, 2);
        builder.Property(l => l.LedgerPrice).HasPrecision(18, 2);
        builder.Property(l => l.LedgerSources).HasMaxLength(300);
        builder.Property(l => l.Result).HasMaxLength(30).IsRequired();
        builder.Property(l => l.Details).HasMaxLength(1000).IsRequired();
        builder.HasIndex(l => new { l.TenantId, l.Month, l.Result });
        builder.HasIndex(l => new { l.TenantId, l.WorkerId });
    }
}

internal sealed class InvoiceCheckImportConfiguration : IEntityTypeConfiguration<InvoiceCheckImport>
{
    public void Configure(EntityTypeBuilder<InvoiceCheckImport> builder)
    {
        builder.ToTable("invoice_check_import");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.LedgerSignature).HasMaxLength(100);
        builder.Property(i => i.Summary).HasMaxLength(500);
        builder.HasIndex(i => i.TenantId).IsUnique();
    }
}

internal sealed class HistoryPeriodConfiguration : IEntityTypeConfiguration<HistoryPeriod>
{
    public void Configure(EntityTypeBuilder<HistoryPeriod> builder)
    {
        builder.ToTable("history_period");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.Place).HasMaxLength(300);
        builder.Property(p => p.SourceType).HasMaxLength(30).IsRequired();
        builder.Property(p => p.SourceNo).HasMaxLength(50).IsRequired();
        builder.ComplexProperty(p => p.Rate, rate =>
        {
            rate.Property(r => r.PackageId).HasColumnName("rate_package_id");
            rate.Property(r => r.PackageNo).HasColumnName("rate_package_no").HasMaxLength(30);
            rate.Property(r => r.Salary).HasColumnName("rate_salary").HasPrecision(18, 2);
            rate.Property(r => r.ServiceFee).HasColumnName("rate_service_fee").HasPrecision(18, 2);
            rate.Property(r => r.Housing).HasColumnName("rate_housing").HasPrecision(18, 2);
            rate.Property(r => r.HousingBillable).HasColumnName("rate_housing_billable");
            rate.Property(r => r.Transport).HasColumnName("rate_transport").HasPrecision(18, 2);
            rate.Property(r => r.TransportBillable).HasColumnName("rate_transport_billable");
            rate.Property(r => r.TotalPrice).HasColumnName("rate_total_price").HasPrecision(18, 2);
            rate.Property(r => r.IsSpecialPrice).HasColumnName("rate_is_special_price");
        });
        builder.HasIndex(p => new { p.TenantId, p.WorkerId, p.StartsOn });
    }
}

internal sealed class HistoryIssueConfiguration : IEntityTypeConfiguration<HistoryIssue>
{
    public void Configure(EntityTypeBuilder<HistoryIssue> builder)
    {
        builder.ToTable("history_issue");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Code).HasMaxLength(30).IsRequired();
        builder.Property(i => i.Details).HasMaxLength(1000).IsRequired();
        builder.Property(i => i.SourceNo).HasMaxLength(50);
        builder.HasIndex(i => new { i.TenantId, i.Code });
        builder.HasIndex(i => new { i.TenantId, i.WorkerId });
    }
}

internal sealed class HistoryImportConfiguration : IEntityTypeConfiguration<HistoryImport>
{
    public void Configure(EntityTypeBuilder<HistoryImport> builder)
    {
        builder.ToTable("history_import");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Summary).HasMaxLength(500);
        builder.HasIndex(i => i.TenantId).IsUnique();
    }
}

internal sealed class WorkerPeriodConfiguration : IEntityTypeConfiguration<WorkerPeriod>
{
    public void Configure(EntityTypeBuilder<WorkerPeriod> builder)
    {
        builder.ToTable("worker_period");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.ProjectName).HasMaxLength(300);
        builder.Property(p => p.SourceType).HasMaxLength(50).IsRequired();
        builder.Property(p => p.SourceNo).HasMaxLength(50).IsRequired();
        builder.Property(p => p.ClosedByNo).HasMaxLength(50);
        builder.Ignore(p => p.IsOpen);
        builder.ComplexProperty(p => p.Rate, rate =>
        {
            rate.Property(r => r.PackageId).HasColumnName("rate_package_id");
            rate.Property(r => r.PackageNo).HasColumnName("rate_package_no").HasMaxLength(30);
            rate.Property(r => r.Salary).HasColumnName("rate_salary").HasPrecision(18, 2);
            rate.Property(r => r.ServiceFee).HasColumnName("rate_service_fee").HasPrecision(18, 2);
            rate.Property(r => r.Housing).HasColumnName("rate_housing").HasPrecision(18, 2);
            rate.Property(r => r.HousingBillable).HasColumnName("rate_housing_billable");
            rate.Property(r => r.Transport).HasColumnName("rate_transport").HasPrecision(18, 2);
            rate.Property(r => r.TransportBillable).HasColumnName("rate_transport_billable");
            rate.Property(r => r.TotalPrice).HasColumnName("rate_total_price").HasPrecision(18, 2);
            rate.Property(r => r.IsSpecialPrice).HasColumnName("rate_is_special_price");
        });
        builder.HasOne<Worker>().WithMany().HasForeignKey(p => p.WorkerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(p => new { p.TenantId, p.WorkerId, p.StartsOn });
        builder.HasIndex(p => new { p.TenantId, p.SourceLineId }).IsUnique().HasFilter("[source_line_id] IS NOT NULL");
        // L3: one open period per worker.
        builder.HasIndex(p => new { p.TenantId, p.WorkerId }).IsUnique().HasFilter("[ends_on] IS NULL").HasDatabaseName("ux_worker_period_open");
    }
}

internal sealed class PersonConfiguration : IEntityTypeConfiguration<Person>
{
    public void Configure(EntityTypeBuilder<Person> builder)
    {
        builder.ToTable("person");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.NameEn).HasMaxLength(Person.NameMaxLength).IsRequired();
        builder.Property(p => p.NameAr).HasMaxLength(Person.NameMaxLength);
        builder.Property(p => p.NationalityCode).HasMaxLength(30);
        builder.HasMany(p => p.Identifiers).WithOne().HasForeignKey(i => i.PersonId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(p => p.Identifiers).HasField("_identifiers").UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class PersonIdentifierConfiguration : IEntityTypeConfiguration<PersonIdentifier>
{
    public void Configure(EntityTypeBuilder<PersonIdentifier> builder)
    {
        builder.ToTable("person_identifier");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Type).HasConversion<string>().HasMaxLength(20);
        builder.Property(i => i.Number).HasMaxLength(PersonIdentifier.NumberMaxLength).IsRequired();
        // A current number of a type belongs to one person only (docs/02-target-architecture/04 §2).
        builder.HasIndex(i => new { i.TenantId, i.Type, i.Number })
            .IsUnique()
            .HasFilter("[is_current] = 1")
            .HasDatabaseName("ux_person_identifier_current_number");
        builder.HasIndex(i => new { i.TenantId, i.Number });
    }
}

internal sealed class WorkerConfiguration : IEntityTypeConfiguration<Worker>
{
    public void Configure(EntityTypeBuilder<Worker> builder)
    {
        builder.ToTable("worker");
        builder.HasKey(w => w.Id);
        builder.Property(w => w.Id).ValueGeneratedNever();
        builder.Property(w => w.WorkerNo).HasMaxLength(50).IsRequired();
        builder.Property(w => w.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(w => w.Placement).HasConversion<string>().HasMaxLength(20);
        builder.Property(w => w.Lifecycle).HasConversion<string>().HasMaxLength(20);
        builder.Property(w => w.ProfessionCode).HasMaxLength(30);
        builder.Property(w => w.IqamaProfessionCode).HasMaxLength(30);
        builder.Property(w => w.Sponsor).HasMaxLength(100);
        builder.Property(w => w.RecruitmentAgent).HasMaxLength(200);
        builder.Property(w => w.ProjectName).HasMaxLength(300);
        builder.HasOne<Person>().WithMany().HasForeignKey(w => w.PersonId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(w => new { w.TenantId, w.CrmId }).IsUnique();
        builder.HasIndex(w => new { w.TenantId, w.WorkerNo });
        builder.HasIndex(w => new { w.TenantId, w.Placement });

        builder.ComplexProperty(w => w.Salary, s =>
        {
            s.Property(x => x.Basic).HasColumnName("salary_basic");
            s.Property(x => x.Housing).HasColumnName("salary_housing");
            s.Property(x => x.Food).HasColumnName("salary_food");
            s.Property(x => x.Transport).HasColumnName("salary_transport");
            s.Property(x => x.Overtime).HasColumnName("salary_overtime");
            s.Property(x => x.Other).HasColumnName("salary_other");
            s.Property(x => x.Project).HasColumnName("salary_project");
            s.Property(x => x.Hardship).HasColumnName("salary_hardship");
            s.Property(x => x.Total).HasColumnName("salary_total");
        });
        builder.ComplexProperty(w => w.Contract, c =>
        {
            c.Property(x => x.StartsOn).HasColumnName("contract_starts_on");
            c.Property(x => x.Months).HasColumnName("contract_months");
            c.Property(x => x.EndsOn).HasColumnName("contract_ends_on");
        });
        builder.ComplexProperty(w => w.Leave, l =>
        {
            l.Property(x => x.AnnualDays).HasColumnName("leave_annual_days").HasPrecision(9, 2);
            l.Property(x => x.Balance).HasColumnName("leave_balance").HasPrecision(9, 2);
            l.Property(x => x.Consumed).HasColumnName("leave_consumed").HasPrecision(9, 2);
            l.Property(x => x.OldConsumed).HasColumnName("leave_old_consumed").HasPrecision(9, 2);
            l.Property(x => x.Remaining).HasColumnName("leave_remaining").HasPrecision(9, 2);
        });
    }
}

internal sealed class WorkforceImportConfiguration : IEntityTypeConfiguration<WorkforceImport>
{
    public void Configure(EntityTypeBuilder<WorkforceImport> builder)
    {
        builder.ToTable("crm_import");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Summary).HasMaxLength(2000);
        builder.HasIndex(i => i.TenantId).IsUnique();
    }
}

/// <summary>Used only by <c>dotnet ef migrations add</c>; no database connection is opened.</summary>
internal sealed class WorkforceDesignTimeDbContextFactory : IDesignTimeDbContextFactory<WorkforceDbContext>
{
    public WorkforceDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<WorkforceDbContext>();
        PersistenceExtensions.Configure(options, connectionString, WorkforceDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new WorkforceDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
