using System.Collections.Concurrent;
using System.Data.Common;
using System.Threading.Channels;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace IntegratedErp.BuildingBlocks.Live;

/// <summary>
/// Tells open pages that data changed, so they refresh by themselves (the user's request, 2026-10-22: «اي تحديث
/// يسمع فيها»). Every saved change announces its module (the schema, e.g. «operations») to the pages of the same
/// company, once its transaction is committed. Only the module's name travels, never data: the page reads it again
/// through its own endpoints, with its own permissions. In process: one server today (on-prem); several servers
/// would need a backplane.
/// </summary>
public sealed class LiveChanges
{
    private readonly Lock _gate = new();
    private readonly List<LiveSubscription> _subscribers = [];
    private readonly ConcurrentDictionary<(Guid Tenant, string Area), long> _versions = new();

    /// <summary>Raised after every announced change, for work done in the background (e.g. preparing a report again).</summary>
    public event Action<Guid, string>? Published;

    public void Publish(Guid tenantId, string area)
    {
        _versions.AddOrUpdate((tenantId, area), 1, (_, v) => v + 1);
        Published?.Invoke(tenantId, area);
        lock (_gate)
        {
            foreach (var subscriber in _subscribers.Where(s => s.TenantId == tenantId))
            {
                subscriber.Offer(area);
            }
        }
    }

    /// <summary>
    /// How many changes these areas of a company have had since the server started: a cache keeps what it built for a
    /// version and builds it again only when the version moves (instead of every few minutes).
    /// </summary>
    public long Version(Guid tenantId, IEnumerable<string> areas) => areas.Sum(a => _versions.GetValueOrDefault((tenantId, a)));

    public LiveSubscription Subscribe(Guid tenantId)
    {
        var subscription = new LiveSubscription(this, tenantId);
        lock (_gate)
        {
            _subscribers.Add(subscription);
        }

        return subscription;
    }

    internal void Remove(LiveSubscription subscription)
    {
        lock (_gate)
        {
            _subscribers.Remove(subscription);
        }
    }
}

/// <summary>One open page's feed of changed modules; a slow page loses the oldest (it refreshes anyway).</summary>
public sealed class LiveSubscription : IDisposable
{
    private readonly LiveChanges _owner;
    private readonly Channel<string> _channel = Channel.CreateBounded<string>(new BoundedChannelOptions(64) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });

    internal LiveSubscription(LiveChanges owner, Guid tenantId)
    {
        _owner = owner;
        TenantId = tenantId;
    }

    public Guid TenantId { get; }

    public ChannelReader<string> Reader => _channel.Reader;

    internal void Offer(string area) => _channel.Writer.TryWrite(area);

    public void Dispose()
    {
        _owner.Remove(this);
        _channel.Writer.TryComplete();
    }
}

/// <summary>
/// An entity that names the area its changes are announced under, instead of its module's schema: a finer one (e.g.
/// «crm_sync.new_invoice», so a report on the old invoices is not rebuilt when a worker is copied), or none when the
/// save changed nothing anyone reads (a sync run's own log).
/// </summary>
public interface ILiveArea
{
    string? LiveArea { get; }
}

/// <summary>
/// Notes which company and module a save changed, and announces it when it is final: at once, or when its
/// transaction commits (never for a rolled back one).
/// </summary>
public sealed class LiveChangesInterceptor(LiveChanges live, ITenantContext tenant) : SaveChangesInterceptor, IDbTransactionInterceptor
{
    private readonly HashSet<(Guid Tenant, string Area)> _pending = [];

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Capture(eventData);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Capture(eventData);
        return ValueTask.FromResult(result);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        Saved(eventData);
        return result;
    }

    public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        Saved(eventData);
        return ValueTask.FromResult(result);
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData) => Failed(eventData);

    public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        Failed(eventData);
        return Task.CompletedTask;
    }

    public void TransactionCommitted(DbTransaction transaction, TransactionEndEventData eventData) => Flush();

    public Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        Flush();
        return Task.CompletedTask;
    }

    public void TransactionRolledBack(DbTransaction transaction, TransactionEndEventData eventData) => _pending.Clear();

    public Task TransactionRolledBackAsync(DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        _pending.Clear();
        return Task.CompletedTask;
    }

    private void Capture(DbContextEventData eventData)
    {
        if (eventData.Context is not ModuleDbContext context)
        {
            return;
        }

        foreach (var entry in context.ChangeTracker.Entries())
        {
            if (entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
                && entry.Entity is not (AuditEntry or OutboxMessage or NumberSequence)
                && (entry.Entity is ITenantOwned owned ? owned.TenantId : tenant.TenantId) is { } tenantId
                && (entry.Entity is ILiveArea own ? own.LiveArea : context.Schema) is { } area)
            {
                _pending.Add((tenantId, area));
            }
        }
    }

    private void Saved(DbContextEventData eventData)
    {
        // Inside a transaction the change is not final yet: it is announced when the transaction commits.
        if (eventData.Context?.Database.CurrentTransaction is null)
        {
            Flush();
        }
    }

    private void Failed(DbContextEventData eventData)
    {
        // Nothing was saved; inside a transaction its fate (commit or rollback) decides.
        if (eventData.Context?.Database.CurrentTransaction is null)
        {
            _pending.Clear();
        }
    }

    private void Flush()
    {
        foreach (var (tenantId, area) in _pending)
        {
            live.Publish(tenantId, area);
        }

        _pending.Clear();
    }
}
