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

    public DbSet<ApprovalProcess> Processes => Set<ApprovalProcess>();

    public DbSet<ApprovalProcessVersion> ProcessVersions => Set<ApprovalProcessVersion>();

    public DbSet<ApprovalInstance> Instances => Set<ApprovalInstance>();

    public DbSet<ApprovalWorkItem> WorkItems => Set<ApprovalWorkItem>();

    public DbSet<ApprovalHistoryEntry> History => Set<ApprovalHistoryEntry>();

    public DbSet<InternalRequest> InternalRequests => Set<InternalRequest>();

    public DbSet<AlertSetting> AlertSettings => Set<AlertSetting>();

    public DbSet<AlertDismissal> AlertDismissals => Set<AlertDismissal>();

    public DbSet<AlertNotice> AlertNotices => Set<AlertNotice>();

    public DbSet<AlertDigestRun> AlertDigestRuns => Set<AlertDigestRun>();
}

internal sealed class AlertSettingConfiguration : IEntityTypeConfiguration<AlertSetting>
{
    public void Configure(EntityTypeBuilder<AlertSetting> builder)
    {
        builder.ToTable("alert_setting");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.Code).HasMaxLength(100).IsRequired();
        builder.Property(s => s.UpdatedByName).HasMaxLength(200);
        builder.HasIndex(s => new { s.TenantId, s.Code }).IsUnique();
    }
}

internal sealed class AlertDismissalConfiguration : IEntityTypeConfiguration<AlertDismissal>
{
    public void Configure(EntityTypeBuilder<AlertDismissal> builder)
    {
        builder.ToTable("alert_dismissal");
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).ValueGeneratedNever();
        builder.Property(d => d.Code).HasMaxLength(100).IsRequired();
        builder.Property(d => d.Key).HasMaxLength(200).IsRequired();
        builder.HasIndex(d => new { d.TenantId, d.UserId, d.Code, d.Key }).IsUnique();
    }
}

internal sealed class AlertNoticeConfiguration : IEntityTypeConfiguration<AlertNotice>
{
    public void Configure(EntityTypeBuilder<AlertNotice> builder)
    {
        builder.ToTable("alert_notice");
        builder.HasKey(n => n.Id);
        builder.Property(n => n.Id).ValueGeneratedNever();
        builder.Property(n => n.Code).HasMaxLength(100).IsRequired();
        builder.Property(n => n.Key).HasMaxLength(200).IsRequired();
        builder.HasIndex(n => new { n.TenantId, n.Code, n.Key }).IsUnique();
    }
}

internal sealed class AlertDigestRunConfiguration : IEntityTypeConfiguration<AlertDigestRun>
{
    public void Configure(EntityTypeBuilder<AlertDigestRun> builder)
    {
        builder.ToTable("alert_digest_run");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.HasIndex(r => new { r.TenantId, r.Day }).IsUnique();
    }
}

internal sealed class ApprovalProcessConfiguration : IEntityTypeConfiguration<ApprovalProcess>
{
    public void Configure(EntityTypeBuilder<ApprovalProcess> builder)
    {
        builder.ToTable("approval_process");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Screen).HasMaxLength(100).IsRequired();
        builder.Property(p => p.NameAr).HasMaxLength(200).IsRequired();
        builder.Property(p => p.NameEn).HasMaxLength(200).IsRequired();
        builder.Property(p => p.Draft).IsRequired();
        builder.Ignore(p => p.Current);
        builder.HasIndex(p => new { p.TenantId, p.Screen, p.Priority });
        builder.HasMany(p => p.Versions).WithOne().HasForeignKey(v => v.ProcessId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(p => p.Versions).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class ApprovalProcessVersionConfiguration : IEntityTypeConfiguration<ApprovalProcessVersion>
{
    public void Configure(EntityTypeBuilder<ApprovalProcessVersion> builder)
    {
        builder.ToTable("approval_process_version");
        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).ValueGeneratedNever();
        builder.Property(v => v.Definition).IsRequired();
        builder.Property(v => v.PublishedBy).HasMaxLength(200).IsRequired();
        builder.HasIndex(v => new { v.ProcessId, v.Version }).IsUnique();
    }
}

internal sealed class ApprovalInstanceConfiguration : IEntityTypeConfiguration<ApprovalInstance>
{
    public void Configure(EntityTypeBuilder<ApprovalInstance> builder)
    {
        builder.ToTable("approval_instance");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.ProcessNameAr).HasMaxLength(200).IsRequired();
        builder.Property(i => i.ProcessNameEn).HasMaxLength(200).IsRequired();
        builder.Property(i => i.Screen).HasMaxLength(100).IsRequired();
        builder.Property(i => i.Title).HasMaxLength(300).IsRequired();
        builder.Property(i => i.Snapshot).IsRequired();
        builder.Property(i => i.SubmittedByName).HasMaxLength(200).IsRequired();
        builder.Property(i => i.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(i => i.Cursor).HasMaxLength(4000).IsRequired();
        builder.Property(i => i.WaitingStepId).HasMaxLength(40);
        builder.Property(i => i.WaitingStepAr).HasMaxLength(200);
        builder.Property(i => i.WaitingStepEn).HasMaxLength(200);
        builder.Property(i => i.Error).HasMaxLength(1000);
        builder.Property(i => i.RowVersion).IsRowVersion();
        builder.HasOne<ApprovalProcessVersion>().WithMany().HasForeignKey(i => i.VersionId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(i => new { i.TenantId, i.Screen, i.RecordId }, "ix_approval_instance_record");
        builder.HasIndex(i => new { i.TenantId, i.SubmittedBy, i.SubmittedAt });
        // At most one running approval per record: a duplicate submission fails on this index.
        builder.HasIndex(i => new { i.TenantId, i.Screen, i.RecordId }, "ux_approval_instance_running_record")
            .IsUnique()
            .HasFilter("[status] IN ('InProgress', 'Failed')");
    }
}

internal sealed class ApprovalWorkItemConfiguration : IEntityTypeConfiguration<ApprovalWorkItem>
{
    public void Configure(EntityTypeBuilder<ApprovalWorkItem> builder)
    {
        builder.ToTable("approval_work_item");
        builder.HasKey(w => w.Id);
        builder.Property(w => w.Id).ValueGeneratedNever();
        builder.Property(w => w.StepId).HasMaxLength(40).IsRequired();
        builder.Property(w => w.StepNameAr).HasMaxLength(200).IsRequired();
        builder.Property(w => w.StepNameEn).HasMaxLength(200).IsRequired();
        builder.Property(w => w.AssigneeName).HasMaxLength(200).IsRequired();
        builder.Property(w => w.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(w => w.Comment).HasMaxLength(1000);
        builder.Property(w => w.DecisionKey).HasMaxLength(64);
        builder.Ignore(w => w.IsOpen);
        builder.HasOne<ApprovalInstance>().WithMany().HasForeignKey(w => w.InstanceId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(w => new { w.TenantId, w.AssigneeUserId, w.Status });
        builder.HasIndex(w => new { w.InstanceId, w.StepId, w.Round });
    }
}

internal sealed class ApprovalHistoryConfiguration : IEntityTypeConfiguration<ApprovalHistoryEntry>
{
    public void Configure(EntityTypeBuilder<ApprovalHistoryEntry> builder)
    {
        builder.ToTable("approval_history");
        builder.HasKey(h => h.Id);
        builder.Property(h => h.Id).ValueGeneratedNever();
        builder.Property(h => h.Kind).HasMaxLength(30).IsRequired();
        builder.Property(h => h.StepId).HasMaxLength(40);
        builder.Property(h => h.StepNameAr).HasMaxLength(200);
        builder.Property(h => h.StepNameEn).HasMaxLength(200);
        builder.Property(h => h.ActorName).HasMaxLength(200);
        builder.Property(h => h.OnBehalfOf).HasMaxLength(200);
        builder.Property(h => h.Outcome).HasMaxLength(30);
        builder.Property(h => h.Comment).HasMaxLength(1000);
        builder.Property(h => h.StatusBefore).HasMaxLength(20);
        builder.Property(h => h.StatusAfter).HasMaxLength(20);
        builder.HasOne<ApprovalInstance>().WithMany().HasForeignKey(h => h.InstanceId).OnDelete(DeleteBehavior.Cascade);
        // Gap-free order within each approval.
        builder.HasIndex(h => new { h.InstanceId, h.Sequence }).IsUnique();
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
