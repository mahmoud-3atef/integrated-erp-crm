using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Workflow.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Workflow.Infrastructure;

internal sealed class WorkflowDbContext(DbContextOptions<WorkflowDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "workflow";

    public override string Schema => SchemaName;

    public DbSet<ApprovalRoute> Routes => Set<ApprovalRoute>();

    public DbSet<ApprovalRouteVersion> RouteVersions => Set<ApprovalRouteVersion>();

    public DbSet<ApprovalInstance> Instances => Set<ApprovalInstance>();

    public DbSet<ApprovalTask> Tasks => Set<ApprovalTask>();

    public DbSet<InternalRequest> InternalRequests => Set<InternalRequest>();
}

internal sealed class ApprovalRouteConfiguration : IEntityTypeConfiguration<ApprovalRoute>
{
    public void Configure(EntityTypeBuilder<ApprovalRoute> builder)
    {
        builder.ToTable("approval_route");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.DocumentType).HasMaxLength(100).IsRequired();
        builder.Ignore(r => r.Current);
        builder.HasIndex(r => new { r.TenantId, r.DocumentType }).IsUnique();
        builder.HasMany(r => r.Versions).WithOne().HasForeignKey(v => v.RouteId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(r => r.Versions).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class ApprovalRouteVersionConfiguration : IEntityTypeConfiguration<ApprovalRouteVersion>
{
    public void Configure(EntityTypeBuilder<ApprovalRouteVersion> builder)
    {
        builder.ToTable("approval_route_version");
        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).ValueGeneratedNever();
        builder.Property(v => v.PublishedBy).HasMaxLength(200).IsRequired();
        builder.HasIndex(v => new { v.RouteId, v.Version }).IsUnique();
        builder.HasMany(v => v.Stages).WithOne().HasForeignKey(s => s.VersionId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(v => v.Stages).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class ApprovalStageConfiguration : IEntityTypeConfiguration<ApprovalStage>
{
    public void Configure(EntityTypeBuilder<ApprovalStage> builder)
    {
        builder.ToTable("approval_stage");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.NameAr).HasMaxLength(200).IsRequired();
        builder.Property(s => s.NameEn).HasMaxLength(200).IsRequired();
        builder.Property(s => s.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.DynamicKey).HasMaxLength(50);
        builder.HasIndex(s => new { s.VersionId, s.Order }).IsUnique();
    }
}

internal sealed class ApprovalInstanceConfiguration : IEntityTypeConfiguration<ApprovalInstance>
{
    public void Configure(EntityTypeBuilder<ApprovalInstance> builder)
    {
        builder.ToTable("approval_instance");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.DocumentType).HasMaxLength(100).IsRequired();
        builder.Property(i => i.Title).HasMaxLength(300).IsRequired();
        builder.Property(i => i.DynamicApprovers).HasMaxLength(2000).IsRequired();
        builder.Property(i => i.SubmittedByName).HasMaxLength(200).IsRequired();
        builder.Property(i => i.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(i => i.RowVersion).IsRowVersion();
        builder.HasOne<ApprovalRouteVersion>().WithMany().HasForeignKey(i => i.RouteVersionId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(i => new { i.TenantId, i.DocumentType, i.DocumentId });
        builder.HasMany(i => i.Tasks).WithOne().HasForeignKey(t => t.InstanceId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(i => i.Tasks).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class ApprovalTaskConfiguration : IEntityTypeConfiguration<ApprovalTask>
{
    public void Configure(EntityTypeBuilder<ApprovalTask> builder)
    {
        builder.ToTable("approval_task");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.StageNameAr).HasMaxLength(200).IsRequired();
        builder.Property(t => t.StageNameEn).HasMaxLength(200).IsRequired();
        builder.Property(t => t.AssigneeName).HasMaxLength(200).IsRequired();
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.Comment).HasMaxLength(1000);
        builder.HasIndex(t => new { t.TenantId, t.AssigneeUserId, t.Status });
    }
}

internal sealed class InternalRequestConfiguration : IEntityTypeConfiguration<InternalRequest>
{
    public void Configure(EntityTypeBuilder<InternalRequest> builder)
    {
        builder.ToTable("internal_request");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Number).HasMaxLength(30).IsRequired();
        builder.Property(r => r.Subject).HasMaxLength(InternalRequest.SubjectMaxLength).IsRequired();
        builder.Property(r => r.Details).HasMaxLength(InternalRequest.DetailsMaxLength).IsRequired();
        builder.Property(r => r.Amount).HasPrecision(18, 2);
        builder.Property(r => r.CreatedByName).HasMaxLength(200).IsRequired();
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(r => r.LastComment).HasMaxLength(1000);
        builder.Ignore(r => r.CanEdit);
        builder.HasIndex(r => new { r.TenantId, r.Number }).IsUnique();
        builder.HasIndex(r => new { r.TenantId, r.CreatedBy });
    }
}

/// <summary>Used only by <c>dotnet ef migrations add</c>; no database connection is opened.</summary>
internal sealed class WorkflowDesignTimeDbContextFactory : IDesignTimeDbContextFactory<WorkflowDbContext>
{
    public WorkflowDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<WorkflowDbContext>();
        PersistenceExtensions.Configure(options, connectionString, WorkflowDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new WorkflowDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
