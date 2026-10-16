namespace IntegratedErp.SharedKernel;

/// <summary>
/// An event a module publishes for other modules (or external systems): defined in the publishing
/// module's <c>.Contracts</c>, saved to its outbox in the same transaction as the change, and
/// delivered afterwards — so it is never lost and never sent for a change that rolled back.
/// </summary>
public interface IIntegrationEvent
{
    Guid EventId { get; }

    DateTimeOffset OccurredAt { get; }
}

/// <summary>Convenience base for integration events.</summary>
public abstract record IntegrationEvent : IIntegrationEvent
{
    public Guid EventId { get; init; } = Guid.CreateVersion7();

    public DateTimeOffset OccurredAt { get; init; } = DateTimeOffset.UtcNow;
}
