using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.Modules.Organization;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

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
        services.AddModules(configuration, new OrganizationModule());
        services.AddTransient<DatabaseMigrator>();
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
