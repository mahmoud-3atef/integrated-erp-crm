using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.BuildingBlocks.Persistence;

/// <summary>
/// One recorded change: who did what to which record, when, with the values before/after.
/// Every module writes these in its own schema (<c>{schema}.audit_log</c>) inside the same
/// transaction as the change, so a change without its audit row cannot happen.
/// </summary>
public sealed class AuditEntry
{
    private AuditEntry()
    {
        EntityType = string.Empty;
        EntityId = string.Empty;
        Action = string.Empty;
        Changes = string.Empty;
        UserName = string.Empty;
    }

    internal AuditEntry(Guid? tenantId, string entityType, string entityId, string action, string changes, string? userId, string userName, DateTimeOffset occurredAt, string? traceId)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        EntityType = entityType;
        EntityId = entityId;
        Action = action;
        Changes = changes;
        UserId = userId;
        UserName = userName;
        OccurredAt = occurredAt;
        TraceId = traceId;
    }

    public Guid Id { get; private set; }

    public Guid? TenantId { get; private set; }

    public string EntityType { get; private set; }

    public string EntityId { get; private set; }

    /// <summary><c>Added</c>, <c>Modified</c> or <c>Deleted</c>.</summary>
    public string Action { get; private set; }

    /// <summary>JSON: <c>{ "Property": { "old": ..., "new": ... } }</c>.</summary>
    public string Changes { get; private set; }

    public string? UserId { get; private set; }

    public string UserName { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    public string? TraceId { get; private set; }
}

internal sealed class AuditEntryConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> builder)
    {
        builder.ToTable("audit_log");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.EntityType).HasMaxLength(200).IsRequired();
        builder.Property(a => a.EntityId).HasMaxLength(200).IsRequired();
        builder.Property(a => a.Action).HasMaxLength(20).IsRequired();
        builder.Property(a => a.Changes).IsRequired();
        builder.Property(a => a.UserId).HasMaxLength(200);
        builder.Property(a => a.UserName).HasMaxLength(200).IsRequired();
        builder.Property(a => a.TraceId).HasMaxLength(100);
        builder.HasIndex(a => new { a.EntityType, a.EntityId, a.OccurredAt });
        builder.HasIndex(a => new { a.TenantId, a.OccurredAt });
    }
}
