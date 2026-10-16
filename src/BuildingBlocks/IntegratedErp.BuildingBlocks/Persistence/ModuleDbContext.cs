using System.Diagnostics;
using System.Linq.Expressions;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace IntegratedErp.BuildingBlocks.Persistence;

/// <summary>Services every module DbContext needs; resolved from DI.</summary>
public sealed record ModuleDbContextDependencies(ITenantContext Tenant, ICurrentUser User, IClock Clock);

/// <summary>
/// Base for every module's DbContext. Each module owns exactly one database schema
/// (docs/02-target-architecture/14 §2): its tables, its audit log and its migrations history live there.
/// Cross-cutting rules enforced here for every module:
/// <list type="bullet">
/// <item>Tenant isolation: queries on <see cref="ITenantOwned"/> entities see the current tenant only; inserts get the tenant stamped; cross-tenant writes are refused.</item>
/// <item>Audit: every insert/update/delete writes an <see cref="AuditEntry"/> in the same transaction.</item>
/// </list>
/// </summary>
public abstract class ModuleDbContext : DbContext
{
    private const string TenantIdProperty = nameof(ITenantOwned.TenantId);
    private readonly ModuleDbContextDependencies _dependencies;

    protected ModuleDbContext(DbContextOptions options, ModuleDbContextDependencies dependencies)
        : base(options)
    {
        _dependencies = dependencies ?? throw new ArgumentNullException(nameof(dependencies));
    }

    /// <summary>The module's schema, e.g. <c>organization</c>. Lower-case, stable, never shared.</summary>
    public abstract string Schema { get; }

    /// <summary>Read by the tenant query filter at query time (EF parameterizes it).</summary>
    public Guid? CurrentTenantId => _dependencies.Tenant.TenantId;

    /// <summary>System operations see every tenant (read by the query filter).</summary>
    public bool IsSystemContext => _dependencies.Tenant.IsSystem;

    public DbSet<AuditEntry> AuditLog => Set<AuditEntry>();

    public DbSet<OutboxMessage> Outbox => Set<OutboxMessage>();

    /// <summary>
    /// Queues an integration event in this module's outbox; it is saved with the next
    /// <c>SaveChanges</c>, in the same transaction as the business change.
    /// </summary>
    public void AddIntegrationEvent(IIntegrationEvent integrationEvent)
    {
        ArgumentNullException.ThrowIfNull(integrationEvent);

        Outbox.Add(new OutboxMessage(
            integrationEvent.EventId,
            _dependencies.Tenant.TenantId,
            integrationEvent.GetType().FullName!,
            JsonSerializer.Serialize(integrationEvent, integrationEvent.GetType()),
            integrationEvent.OccurredAt));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfiguration(new AuditEntryConfiguration());
        modelBuilder.ApplyConfiguration(new OutboxMessageConfiguration());
        modelBuilder.ApplyConfiguration(new NumberSequenceConfiguration());
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly, t => t.Namespace?.StartsWith(GetType().Namespace!, StringComparison.Ordinal) == true);
        ApplyTenantFilters(modelBuilder);
        base.OnModelCreating(modelBuilder);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        ArgumentNullException.ThrowIfNull(configurationBuilder);

        // Money and quantities: decimal(18,2) unless a property says otherwise.
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
        // Business dates are date-only (no time, no time zone) — see 14 §3.
        configurationBuilder.Properties<DateOnly>().HaveColumnType("date");
        base.ConfigureConventions(configurationBuilder);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        PrepareChanges();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        PrepareChanges();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    // e => IsSystemContext || (Guid?)e.TenantId == CurrentTenantId
    private void ApplyTenantFilters(ModelBuilder modelBuilder)
    {
        var context = Expression.Constant(this);
        foreach (var entityType in modelBuilder.Model.GetEntityTypes()
                     .Where(t => typeof(ITenantOwned).IsAssignableFrom(t.ClrType) && t.BaseType is null))
        {
            var entity = Expression.Parameter(entityType.ClrType, "e");
            var tenantOfRow = Expression.Convert(
                Expression.Call(typeof(EF), nameof(EF.Property), [typeof(Guid)], entity, Expression.Constant(TenantIdProperty)),
                typeof(Guid?));
            var body = Expression.OrElse(
                Expression.Property(context, nameof(IsSystemContext)),
                Expression.Equal(tenantOfRow, Expression.Property(context, nameof(CurrentTenantId))));

            modelBuilder.Entity(entityType.ClrType).HasQueryFilter(Expression.Lambda(body, entity));
            modelBuilder.Entity(entityType.ClrType).HasIndex(TenantIdProperty);
        }
    }

    private void PrepareChanges()
    {
        ChangeTracker.DetectChanges();
        var changed = ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
                && e.Entity is not (AuditEntry or OutboxMessage or NumberSequence))
            .ToList();

        foreach (var entry in changed)
        {
            if (entry.Entity is ITenantOwned)
            {
                EnforceTenant(entry);
            }
        }

        var now = _dependencies.Clock.UtcNow;
        var traceId = Activity.Current?.TraceId.ToString();
        foreach (var entry in changed)
        {
            AuditLog.Add(CreateAuditEntry(entry, now, traceId));
        }
    }

    private void EnforceTenant(EntityEntry entry)
    {
        var property = entry.Property(TenantIdProperty);
        var current = _dependencies.Tenant.TenantId;
        var isSystem = _dependencies.Tenant.IsSystem;

        if (entry.State == EntityState.Added)
        {
            var assigned = (Guid)property.CurrentValue!;
            if (assigned == Guid.Empty)
            {
                property.CurrentValue = current ?? throw new InvalidOperationException(
                    $"Cannot add {entry.Metadata.ClrType.Name}: no tenant is set for this operation.");
            }
            else if (!isSystem && assigned != current)
            {
                throw new InvalidOperationException($"Cannot add {entry.Metadata.ClrType.Name} for another tenant.");
            }

            return;
        }

        if (property.IsModified)
        {
            throw new InvalidOperationException($"The tenant of {entry.Metadata.ClrType.Name} cannot be changed.");
        }

        if (!isSystem && (Guid)property.OriginalValue! != current)
        {
            throw new InvalidOperationException($"Cannot change {entry.Metadata.ClrType.Name} of another tenant.");
        }
    }

    private AuditEntry CreateAuditEntry(EntityEntry entry, DateTimeOffset now, string? traceId)
    {
        var changes = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var property in entry.Properties)
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    changes[property.Metadata.Name] = new { @new = property.CurrentValue };
                    break;
                case EntityState.Deleted:
                    changes[property.Metadata.Name] = new { old = property.OriginalValue };
                    break;
                case EntityState.Modified when property.IsModified && !Equals(property.OriginalValue, property.CurrentValue):
                    changes[property.Metadata.Name] = new { old = property.OriginalValue, @new = property.CurrentValue };
                    break;
            }
        }

        var key = entry.Metadata.FindPrimaryKey()?.Properties
            .Select(p => Convert.ToString(entry.Property(p.Name).CurrentValue, System.Globalization.CultureInfo.InvariantCulture))
            ?? [];
        var tenantId = entry.Entity is ITenantOwned owned ? owned.TenantId : _dependencies.Tenant.TenantId;

        return new AuditEntry(
            tenantId == Guid.Empty ? _dependencies.Tenant.TenantId : tenantId,
            entry.Metadata.ClrType.Name,
            string.Join("|", key),
            entry.State.ToString(),
            JsonSerializer.Serialize(changes),
            _dependencies.User.UserId,
            _dependencies.User.DisplayName,
            now,
            traceId);
    }
}
