using IntegratedErp.BuildingBlocks;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.Modules.Organization;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests;

/// <summary>
/// A throw-away database built with the real migrator, then dropped.
/// Server: <c>ERP_TEST_SQLSERVER</c> (a connection string without a database), or LocalDB on Windows.
/// Without either, database tests are skipped.
/// </summary>
public sealed class TestDatabase : IAsyncLifetime
{
    private const string LocalDb = @"Server=(localdb)\MSSQLLocalDB;Integrated Security=true;TrustServerCertificate=true";

    private ServiceProvider? _services;

    public static string? ServerConnectionString =>
        Environment.GetEnvironmentVariable("ERP_TEST_SQLSERVER") is { Length: > 0 } configured
            ? configured
            : OperatingSystem.IsWindows() ? LocalDb : null;

    public static bool IsAvailable => ServerConnectionString is not null;

    public string ConnectionString { get; private set; } = string.Empty;

    public IServiceProvider Services => _services ?? throw new InvalidOperationException("Database is not available.");

    /// <summary>A DI scope acting as the given tenant/user — like one request.</summary>
    public IServiceScope Scope(Guid? tenantId = null, bool system = false, string user = "test-user")
    {
        var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ExecutionContextAccessor>();
        if (system)
        {
            context.RunAsSystem(user);
        }
        else
        {
            context.SetUser(user, user);
            if (tenantId is { } id)
            {
                context.SetTenant(id);
            }
        }

        return scope;
    }

    /// <summary>Opens a raw connection with the given tenant in SESSION_CONTEXT (as the app does).</summary>
    public async Task<SqlConnection> OpenAsTenantAsync(Guid? tenantId, bool system = false)
    {
        var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            EXEC sp_set_session_context @key = N'tenant_id', @value = @tenant_id;
            EXEC sp_set_session_context @key = N'is_system', @value = @is_system;
            """;
        command.Parameters.AddWithValue("@tenant_id", tenantId is { } id ? id : DBNull.Value);
        command.Parameters.AddWithValue("@is_system", system);
        await command.ExecuteNonQueryAsync();
        return connection;
    }

    public async Task InitializeAsync()
    {
        if (!IsAvailable)
        {
            return;
        }

        var builder = new SqlConnectionStringBuilder(ServerConnectionString)
        {
            InitialCatalog = $"IntegratedErp_Test_{Guid.NewGuid():N}",
        };
        ConnectionString = builder.ConnectionString;

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"ConnectionStrings:{PersistenceExtensions.ConnectionStringName}"] = ConnectionString,
            })
            .Build();

        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddLogging();
        services.AddPlatformCore();
        services.AddModules(configuration, new OrganizationModule());
        _services = services.BuildServiceProvider();

        await _services.GetRequiredService<DatabaseMigrator>().MigrateAsync(CancellationToken.None);
    }

    public async Task DisposeAsync()
    {
        if (_services is not null)
        {
            await _services.DisposeAsync();
        }

        if (!IsAvailable || string.IsNullOrEmpty(ConnectionString))
        {
            return;
        }

        var builder = new SqlConnectionStringBuilder(ConnectionString);
        var name = builder.InitialCatalog;
        builder.InitialCatalog = "master";

        SqlConnection.ClearAllPools();
        await using var connection = new SqlConnection(builder.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            DECLARE @quoted nvarchar(300) = QUOTENAME(@name);
            IF DB_ID(@name) IS NOT NULL
                EXEC(N'ALTER DATABASE ' + @quoted + N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ' + @quoted);
            """;
        command.Parameters.AddWithValue("@name", name);
        await command.ExecuteNonQueryAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class DatabaseTestGroup : ICollectionFixture<TestDatabase>
{
    public const string Name = "database";
}
