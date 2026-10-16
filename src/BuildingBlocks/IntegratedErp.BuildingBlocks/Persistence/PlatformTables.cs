using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.BuildingBlocks.Persistence;

/// <summary>Integration event waiting to be delivered (transactional outbox), one table per module schema.</summary>
public sealed class OutboxMessage
{
    private OutboxMessage()
    {
        Type = string.Empty;
        Payload = string.Empty;
    }

    internal OutboxMessage(Guid id, Guid? tenantId, string type, string payload, DateTimeOffset occurredAt)
    {
        Id = id;
        TenantId = tenantId;
        Type = type;
        Payload = payload;
        OccurredAt = occurredAt;
    }

    public Guid Id { get; private set; }

    public Guid? TenantId { get; private set; }

    /// <summary>CLR type name of the event (stable contract name).</summary>
    public string Type { get; private set; }

    public string Payload { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    public DateTimeOffset? ProcessedAt { get; private set; }

    public int Attempts { get; private set; }

    public string? LastError { get; private set; }

    public void MarkProcessed(DateTimeOffset at)
    {
        ProcessedAt = at;
        LastError = null;
    }

    public void MarkFailed(string error)
    {
        Attempts++;
        LastError = error.Length > 2000 ? error[..2000] : error;
    }
}

/// <summary>Counter row of a gap-free number sequence (see <c>Numbering.NumberSequenceService</c>).</summary>
public sealed class NumberSequence
{
    private NumberSequence()
    {
        SequenceKey = string.Empty;
        ScopeKey = string.Empty;
    }

    public Guid TenantId { get; private set; }

    /// <summary>Document type, e.g. <c>invoice</c>, <c>delivery_order</c>.</summary>
    public string SequenceKey { get; private set; }

    /// <summary>Numbering scope inside the tenant, e.g. the legal entity code; empty for tenant-wide.</summary>
    public string ScopeKey { get; private set; }

    /// <summary>Reset period, e.g. the year; 0 when the sequence never resets.</summary>
    public int Period { get; private set; }

    /// <summary>The next number to hand out.</summary>
    public long NextValue { get; private set; }
}

internal sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("outbox_message");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();
        builder.Property(m => m.Type).HasMaxLength(300).IsRequired();
        builder.Property(m => m.Payload).IsRequired();
        builder.Property(m => m.LastError).HasMaxLength(2000);
        // The dispatcher reads unprocessed messages in order.
        builder.HasIndex(m => new { m.ProcessedAt, m.OccurredAt });
    }
}

internal sealed class NumberSequenceConfiguration : IEntityTypeConfiguration<NumberSequence>
{
    public void Configure(EntityTypeBuilder<NumberSequence> builder)
    {
        builder.ToTable("number_sequence", t => t.HasCheckConstraint("ck_number_sequence_next_value", "next_value >= 1"));
        builder.HasKey(s => new { s.TenantId, s.SequenceKey, s.ScopeKey, s.Period });
        builder.Property(s => s.SequenceKey).HasMaxLength(100);
        builder.Property(s => s.ScopeKey).HasMaxLength(100);
    }
}
