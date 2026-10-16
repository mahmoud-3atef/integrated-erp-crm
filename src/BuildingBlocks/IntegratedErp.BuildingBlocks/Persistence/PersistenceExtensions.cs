using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.BuildingBlocks.Persistence;

public static class PersistenceExtensions
{
    /// <summary>Connection string name shared by all modules (one database, one schema per module).</summary>
    public const string ConnectionStringName = "Erp";

    /// <summary>SQL Server 2022. Development may run on a newer engine; this keeps generated SQL 2022-compatible.</summary>
    public const int SqlCompatibilityLevel = 160;

    /// <summary>
    /// Registers a module DbContext against the shared database, with the module's own schema,
    /// its own migrations history table, snake_case names and SQL Server 2022 compatibility.
    /// </summary>
    public static IServiceCollection AddModuleDbContext<TContext>(
        this IServiceCollection services,
        IConfiguration configuration,
        string schema)
        where TContext : ModuleDbContext
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException($"Connection string '{ConnectionStringName}' is not configured.");

        services.AddDbContext<TContext>(options => Configure(options, connectionString, schema));
        services.AddScoped<IModuleDatabase, ModuleDatabase<TContext>>();

        return services;
    }

    /// <summary>Shared option setup — also used by design-time factories so migrations match runtime.</summary>
    public static DbContextOptionsBuilder Configure(DbContextOptionsBuilder options, string connectionString, string schema)
    {
        ArgumentNullException.ThrowIfNull(options);

        return options
            .UseSqlServer(connectionString, sql =>
            {
                sql.MigrationsHistoryTable("__ef_migrations_history", schema);
                sql.UseCompatibilityLevel(SqlCompatibilityLevel);
            })
            .UseSnakeCaseNamingConvention();
    }
}
