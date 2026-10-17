using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.CrmSync.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.CrmSync.Infrastructure;

internal sealed class CrmSyncDbContext(DbContextOptions<CrmSyncDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "crm_sync";

    public override string Schema => SchemaName;

    public DbSet<StagedRecord> Records => Set<StagedRecord>();

    public DbSet<SyncState> States => Set<SyncState>();

    public DbSet<SyncRun> Runs => Set<SyncRun>();

    public DbSet<ReferenceMapping> Mappings => Set<ReferenceMapping>();
}

internal sealed class StagedRecordConfiguration : IEntityTypeConfiguration<StagedRecord>
{
    public void Configure(EntityTypeBuilder<StagedRecord> builder)
    {
        builder.ToTable("staged_record");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Entity).HasMaxLength(64).IsRequired();
        builder.Property(r => r.ModifiedOn).HasColumnType("datetime2(3)");
        builder.Property(r => r.Payload).IsRequired();
        builder.Property(r => r.PayloadHash).HasMaxLength(64).IsRequired();
        builder.HasIndex(r => new { r.TenantId, r.Entity, r.CrmId }).IsUnique();
        builder.HasIndex(r => new { r.TenantId, r.Entity, r.LastSeenRunId });
    }
}

internal sealed class SyncStateConfiguration : IEntityTypeConfiguration<SyncState>
{
    public void Configure(EntityTypeBuilder<SyncState> builder)
    {
        builder.ToTable("sync_state");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.Entity).HasMaxLength(64).IsRequired();
        builder.Property(s => s.WatermarkModifiedOn).HasColumnType("datetime2(3)");
        builder.Property(s => s.LastError).HasMaxLength(1000);
        builder.HasIndex(s => new { s.TenantId, s.Entity }).IsUnique();
    }
}

internal sealed class SyncRunConfiguration : IEntityTypeConfiguration<SyncRun>
{
    public void Configure(EntityTypeBuilder<SyncRun> builder)
    {
        builder.ToTable("sync_run");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Mode).HasConversion<string>().HasMaxLength(20);
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(r => r.RequestedBy).HasMaxLength(200).IsRequired();
        builder.Property(r => r.Error).HasMaxLength(1000);
        builder.Ignore(r => r.IsActive);
        builder.HasIndex(r => new { r.TenantId, r.RequestedAt });
    }
}

internal sealed class ReferenceMappingConfiguration : IEntityTypeConfiguration<ReferenceMapping>
{
    public void Configure(EntityTypeBuilder<ReferenceMapping> builder)
    {
        builder.ToTable("reference_mapping");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();
        builder.Property(m => m.Entity).HasMaxLength(64).IsRequired();
        builder.Property(m => m.CrmName).HasMaxLength(500).IsRequired();
        builder.Property(m => m.CrmCode).HasMaxLength(100);
        builder.Property(m => m.ListCode).HasMaxLength(50).IsRequired();
        builder.Property(m => m.ItemCode).HasMaxLength(30);
        builder.Property(m => m.Rule).HasConversion<string>().HasMaxLength(20);
        builder.HasIndex(m => new { m.TenantId, m.Entity, m.CrmId }).IsUnique();
        builder.HasIndex(m => new { m.TenantId, m.ListCode, m.ItemCode });
    }
}

/// <summary>Used only by <c>dotnet ef migrations add</c>; no database connection is opened.</summary>
internal sealed class CrmSyncDesignTimeDbContextFactory : IDesignTimeDbContextFactory<CrmSyncDbContext>
{
    public CrmSyncDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<CrmSyncDbContext>();
        PersistenceExtensions.Configure(options, connectionString, CrmSyncDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new CrmSyncDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
