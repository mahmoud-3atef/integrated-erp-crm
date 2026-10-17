using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Commercial.Infrastructure;

internal sealed class CommercialDbContext(DbContextOptions<CommercialDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "commercial";

    public override string Schema => SchemaName;

    public DbSet<Customer> Customers => Set<Customer>();

    public DbSet<Contract> Contracts => Set<Contract>();

    public DbSet<Project> Projects => Set<Project>();

    public DbSet<CommercialImport> Imports => Set<CommercialImport>();

    public DbSet<PricePackage> PricePackages => Set<PricePackage>();

    public DbSet<WorkerPrice> WorkerPrices => Set<WorkerPrice>();

    public DbSet<PricingImport> PricingImports => Set<PricingImport>();
}

internal sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("customer");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.CustomerNo).HasMaxLength(50);
        builder.Property(c => c.Name).HasMaxLength(300).IsRequired();
        builder.Property(c => c.NameEn).HasMaxLength(300);
        builder.Property(c => c.CommercialRegistration).HasMaxLength(50);
        builder.Property(c => c.VatNumber).HasMaxLength(50);
        builder.Property(c => c.Mobile).HasMaxLength(50);
        builder.Property(c => c.Email).HasMaxLength(200);
        builder.Property(c => c.City).HasMaxLength(100);
        builder.Property(c => c.ContactName).HasMaxLength(200);
        builder.Property(c => c.LaborOfficeNo).HasMaxLength(50);
        builder.HasIndex(c => new { c.TenantId, c.CrmId }).IsUnique();
    }
}

internal sealed class ContractConfiguration : IEntityTypeConfiguration<Contract>
{
    public void Configure(EntityTypeBuilder<Contract> builder)
    {
        builder.ToTable("contract");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.ContractNo).HasMaxLength(100).IsRequired();
        builder.Property(c => c.Type).HasConversion<string>().HasMaxLength(30);
        builder.Property(c => c.Status).HasConversion<string>().HasMaxLength(20);
        builder.HasOne<Customer>().WithMany().HasForeignKey(c => c.CustomerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(c => new { c.TenantId, c.ProjectCrmId }).IsUnique();
        builder.HasIndex(c => new { c.TenantId, c.EndsOn });
    }
}

internal sealed class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.ToTable("project");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Code).HasMaxLength(100).IsRequired();
        builder.Property(p => p.Name).HasMaxLength(300).IsRequired();
        builder.Property(p => p.NameAr).HasMaxLength(300);
        builder.Property(p => p.NameEn).HasMaxLength(300);
        builder.Property(p => p.Manager).HasMaxLength(200);
        builder.Property(p => p.CommercialRegistration).HasMaxLength(50);
        builder.Property(p => p.City).HasMaxLength(100);
        builder.Property(p => p.Sector).HasMaxLength(200);
        builder.Property(p => p.ContactName).HasMaxLength(200);
        builder.Property(p => p.ContactMobile).HasMaxLength(50);
        builder.Property(p => p.ContactEmails).HasMaxLength(500);
        builder.HasOne<Contract>().WithMany().HasForeignKey(p => p.ContractId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Customer>().WithMany().HasForeignKey(p => p.CustomerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(p => new { p.TenantId, p.CrmId }).IsUnique();
        builder.HasIndex(p => new { p.TenantId, p.Code });
    }
}

internal sealed class CommercialImportConfiguration : IEntityTypeConfiguration<CommercialImport>
{
    public void Configure(EntityTypeBuilder<CommercialImport> builder)
    {
        builder.ToTable("crm_import");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.HasIndex(i => i.TenantId).IsUnique();
    }
}

internal sealed class PricePackageConfiguration : IEntityTypeConfiguration<PricePackage>
{
    public void Configure(EntityTypeBuilder<PricePackage> builder)
    {
        builder.ToTable("price_package");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.ProfessionCode).HasMaxLength(50);
        builder.Property(p => p.NationalityCode).HasMaxLength(50);
        builder.Property(p => p.Basis).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.TotalPrice).HasPrecision(18, 2);
        builder.Property(p => p.ServiceFee).HasPrecision(18, 2);
        builder.Property(p => p.Housing).HasPrecision(18, 2);
        builder.Property(p => p.Transport).HasPrecision(18, 2);
        builder.HasOne<Project>().WithMany().HasForeignKey(p => p.ProjectId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Contract>().WithMany().HasForeignKey(p => p.ContractId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(p => new { p.TenantId, p.ProjectId, p.ProfessionCode, p.NationalityCode }).IsUnique().HasFilter(null);
    }
}

internal sealed class WorkerPriceConfiguration : IEntityTypeConfiguration<WorkerPrice>
{
    public void Configure(EntityTypeBuilder<WorkerPrice> builder)
    {
        builder.ToTable("worker_price");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.WorkerNo).HasMaxLength(50).IsRequired();
        builder.Property(p => p.Name).HasMaxLength(300).IsRequired();
        builder.Property(p => p.ProfessionCode).HasMaxLength(50);
        builder.Property(p => p.NationalityCode).HasMaxLength(50);
        builder.Property(p => p.Salary).HasPrecision(18, 2);
        builder.Property(p => p.ServicePrice).HasPrecision(18, 2);
        builder.Property(p => p.Housing).HasPrecision(18, 2);
        builder.Property(p => p.Transport).HasPrecision(18, 2);
        builder.Property(p => p.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.WorkStartNo).HasMaxLength(100);
        builder.HasOne<Project>().WithMany().HasForeignKey(p => p.ProjectId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PricePackage>().WithMany().HasForeignKey(p => p.PackageId).OnDelete(DeleteBehavior.SetNull);
        builder.HasIndex(p => new { p.TenantId, p.WorkerCrmId }).IsUnique();
        builder.HasIndex(p => new { p.TenantId, p.ProjectId });
    }
}

internal sealed class PricingImportConfiguration : IEntityTypeConfiguration<PricingImport>
{
    public void Configure(EntityTypeBuilder<PricingImport> builder)
    {
        builder.ToTable("pricing_import");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Summary).HasMaxLength(500);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.HasIndex(i => i.TenantId).IsUnique();
    }
}

/// <summary>Used only by <c>dotnet ef migrations add</c>; no database connection is opened.</summary>
internal sealed class CommercialDesignTimeDbContextFactory : IDesignTimeDbContextFactory<CommercialDbContext>
{
    public CommercialDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<CommercialDbContext>();
        PersistenceExtensions.Configure(options, connectionString, CommercialDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new CommercialDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
