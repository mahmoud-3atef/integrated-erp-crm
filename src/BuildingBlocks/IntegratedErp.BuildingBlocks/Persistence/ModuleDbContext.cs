using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.BuildingBlocks.Persistence;

/// <summary>
/// Base for every module's DbContext. Each module owns exactly one database schema
/// (docs/02-target-architecture/14 §2): its tables, and its own migrations history table, live there.
/// </summary>
public abstract class ModuleDbContext : DbContext
{
    protected ModuleDbContext(DbContextOptions options)
        : base(options)
    {
    }

    /// <summary>The module's schema, e.g. <c>organization</c>. Lower-case, stable, never shared.</summary>
    public abstract string Schema { get; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly, t => t.Namespace?.StartsWith(GetType().Namespace!, StringComparison.Ordinal) == true);
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
}
