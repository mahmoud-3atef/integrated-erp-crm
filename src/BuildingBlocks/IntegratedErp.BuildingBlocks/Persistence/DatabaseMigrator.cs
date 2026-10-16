using IntegratedErp.BuildingBlocks.Context;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace IntegratedErp.BuildingBlocks.Persistence;

/// <summary>
/// Builds or upgrades the whole database in one step: creates it if missing, pins the
/// SQL Server 2022 compatibility level, then applies every enabled module's migrations.
/// Run with: <c>IntegratedErp.Api migrate</c>.
/// </summary>
public sealed partial class DatabaseMigrator(IServiceProvider services, IConfiguration configuration, ILogger<DatabaseMigrator> logger)
{
    public async Task MigrateAsync(CancellationToken cancellationToken)
    {
        var connectionString = configuration.GetConnectionString(PersistenceExtensions.ConnectionStringName)
            ?? throw new InvalidOperationException($"Connection string '{PersistenceExtensions.ConnectionStringName}' is not configured.");

        await EnsureDatabaseAsync(connectionString, cancellationToken).ConfigureAwait(false);
        await EnsurePlatformObjectsAsync(connectionString, cancellationToken).ConfigureAwait(false);

        using var scope = services.CreateScope();
        // Migrations (and any data they seed) run as a trusted system operation.
        scope.ServiceProvider.GetRequiredService<ExecutionContextAccessor>().RunAsSystem("migrator");
        foreach (var database in scope.ServiceProvider.GetServices<IModuleDatabase>())
        {
            var pending = await database.GetPendingMigrationsAsync(cancellationToken).ConfigureAwait(false);
            var pendingNames = string.Join(", ", pending);
            LogPending(logger, database.Schema, pending.Count, pendingNames);
            await database.MigrateAsync(cancellationToken).ConfigureAwait(false);
        }

        LogUpToDate(logger);
    }

    private async Task EnsureDatabaseAsync(string connectionString, CancellationToken cancellationToken)
    {
        var builder = new SqlConnectionStringBuilder(connectionString);
        var databaseName = builder.InitialCatalog;
        if (string.IsNullOrWhiteSpace(databaseName))
        {
            throw new InvalidOperationException("The connection string must name a database (Initial Catalog / Database).");
        }

        builder.InitialCatalog = "master";
        var connection = new SqlConnection(builder.ConnectionString);
        await using (connection.ConfigureAwait(false))
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

            // Database name goes through QUOTENAME on the server side; nothing is concatenated client-side.
            const string sql = """
                DECLARE @name sysname = @databaseName;
                DECLARE @quoted nvarchar(300) = QUOTENAME(@name);
                IF DB_ID(@name) IS NULL
                    EXEC(N'CREATE DATABASE ' + @quoted);
                IF (SELECT compatibility_level FROM sys.databases WHERE name = @name) <> @level
                    EXEC(N'ALTER DATABASE ' + @quoted + N' SET COMPATIBILITY_LEVEL = ' + @levelText);
                """;

            var command = connection.CreateCommand();
            await using (command.ConfigureAwait(false))
            {
                command.CommandText = sql;
                command.Parameters.AddWithValue("@databaseName", databaseName);
                command.Parameters.AddWithValue("@level", PersistenceExtensions.SqlCompatibilityLevel);
                command.Parameters.AddWithValue("@levelText", PersistenceExtensions.SqlCompatibilityLevel.ToString(System.Globalization.CultureInfo.InvariantCulture));
                await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            }
        }

        LogDatabaseReady(logger, databaseName, PersistenceExtensions.SqlCompatibilityLevel);
    }

    // Shared database objects that module migrations rely on (row-level security predicate).
    private static async Task EnsurePlatformObjectsAsync(string connectionString, CancellationToken cancellationToken)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection.ConfigureAwait(false))
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            var command = connection.CreateCommand();
            await using (command.ConfigureAwait(false))
            {
                command.CommandText = TenantRowLevelSecurity.CreatePredicateSql;
                await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Schema {Schema}: {Count} pending migration(s) [{Migrations}]")]
    private static partial void LogPending(ILogger logger, string schema, int count, string migrations);

    [LoggerMessage(Level = LogLevel.Information, Message = "Database is up to date.")]
    private static partial void LogUpToDate(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "Database {Database} exists with compatibility level {Level}.")]
    private static partial void LogDatabaseReady(ILogger logger, string database, int level);
}
