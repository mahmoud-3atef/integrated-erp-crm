using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Operations.Infrastructure;

internal sealed class OperationsDbContext(DbContextOptions<OperationsDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "operations";

    public override string Schema => SchemaName;

    public DbSet<DeliveryOrder> DeliveryOrders => Set<DeliveryOrder>();

    public DbSet<DeliveryLine> DeliveryLines => Set<DeliveryLine>();

    public DbSet<OperationsImport> Imports => Set<OperationsImport>();
}

/// <summary>How far the copy of the old system's delivery orders has read.</summary>
public sealed class OperationsImport : ITenantOwned
{
    public Guid Id { get; private set; } = Guid.CreateVersion7();

    public Guid TenantId { get; private set; }

    public DateTimeOffset? OrdersWatermark { get; private set; }

    public DateTimeOffset? WorkStartsWatermark { get; private set; }

    public void Advance(DateTimeOffset? orders, DateTimeOffset? workStarts)
    {
        OrdersWatermark = orders ?? OrdersWatermark;
        WorkStartsWatermark = workStarts ?? WorkStartsWatermark;
    }
}

internal sealed class DeliveryOrderConfiguration : IEntityTypeConfiguration<DeliveryOrder>
{
    public void Configure(EntityTypeBuilder<DeliveryOrder> builder)
    {
        builder.ToTable("delivery_order");
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id).ValueGeneratedNever();
        builder.Property(o => o.OrderNo).HasMaxLength(30).IsRequired();
        builder.Property(o => o.Source).HasConversion<string>().HasMaxLength(10);
        builder.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(o => o.ProjectCode).HasMaxLength(100).IsRequired();
        builder.Property(o => o.ProjectName).HasMaxLength(300).IsRequired();
        builder.Property(o => o.CustomerName).HasMaxLength(300);
        builder.Property(o => o.ProjectManager).HasMaxLength(200);
        builder.Property(o => o.ContractType).HasMaxLength(30);
        builder.Property(o => o.ReceiverName).HasMaxLength(200).IsRequired();
        builder.Property(o => o.ReceiverTitle).HasMaxLength(200);
        builder.Property(o => o.DelayReason).HasMaxLength(500);
        builder.Property(o => o.Notes).HasMaxLength(2000);
        builder.Property(o => o.CreatedByName).HasMaxLength(200).IsRequired();
        builder.Property(o => o.DeliveredByName).HasMaxLength(200);
        builder.Property(o => o.LastComment).HasMaxLength(2000);
        builder.HasMany(o => o.Lines).WithOne().HasForeignKey(l => l.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(o => o.Lines).HasField("_lines").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(o => new { o.TenantId, o.OrderNo }).IsUnique();
        builder.HasIndex(o => new { o.TenantId, o.CrmId }).IsUnique().HasFilter("[crm_id] IS NOT NULL");
        builder.HasIndex(o => new { o.TenantId, o.Status });
    }
}

internal sealed class DeliveryLineConfiguration : IEntityTypeConfiguration<DeliveryLine>
{
    public void Configure(EntityTypeBuilder<DeliveryLine> builder)
    {
        builder.ToTable("delivery_line");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();
        builder.Property(l => l.WorkerNo).HasMaxLength(50).IsRequired();
        builder.Property(l => l.Name).HasMaxLength(300).IsRequired();
        builder.Property(l => l.ProfessionCode).HasMaxLength(50);
        builder.Property(l => l.NationalityCode).HasMaxLength(50);
        builder.Property(l => l.IqamaNo).HasMaxLength(50);
        builder.Property(l => l.PackageNo).HasMaxLength(30);
        builder.Property(l => l.Salary).HasPrecision(18, 2);
        builder.Property(l => l.ServiceFee).HasPrecision(18, 2);
        builder.Property(l => l.Housing).HasPrecision(18, 2);
        builder.Property(l => l.Transport).HasPrecision(18, 2);
        builder.Property(l => l.TotalPrice).HasPrecision(18, 2);
        builder.Property(l => l.SpecialReason).HasMaxLength(500);
        builder.Property(l => l.WorkStartNo).HasMaxLength(100);
        builder.HasIndex(l => new { l.TenantId, l.WorkerId });
    }
}

internal sealed class OperationsImportConfiguration : IEntityTypeConfiguration<OperationsImport>
{
    public void Configure(EntityTypeBuilder<OperationsImport> builder)
    {
        builder.ToTable("crm_import");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.HasIndex(i => i.TenantId).IsUnique();
    }
}

/// <summary>Used only by <c>dotnet ef migrations add</c>; no database connection is opened.</summary>
internal sealed class OperationsDesignTimeDbContextFactory : IDesignTimeDbContextFactory<OperationsDbContext>
{
    public OperationsDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<OperationsDbContext>();
        PersistenceExtensions.Configure(options, connectionString, OperationsDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new OperationsDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
