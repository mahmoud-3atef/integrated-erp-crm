using IntegratedErp.Modules.Organization.Application.Settings;
using IntegratedErp.Modules.Organization.Domain.Settings;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Organization;

[Collection(DatabaseTestGroup.Name)]
public sealed class SettingsPersistenceTests(TestDatabase database)
{
    private static DateOnly D(int year, int month, int day) => new(year, month, day);

    private async Task<T> WithServiceAsync<T>(Func<SettingsService, Task<T>> action)
    {
        using var scope = database.Services.CreateScope();
        return await action(scope.ServiceProvider.GetRequiredService<SettingsService>());
    }

    [SkippableFact]
    public async Task Migrator_creates_the_module_schema_with_sql_2022_compatibility()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");

        await using var connection = new SqlConnection(database.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                (SELECT compatibility_level FROM sys.databases WHERE name = DB_NAME()),
                (SELECT COUNT(*) FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
                  WHERE s.name = 'organization' AND t.name IN ('setting', '__ef_migrations_history'))
            """;
        await using var reader = await command.ExecuteReaderAsync();
        await reader.ReadAsync();

        Assert.Equal(160, reader.GetByte(0));
        Assert.Equal(2, reader.GetInt32(1));
    }

    [SkippableFact]
    public async Task Effective_dated_values_round_trip_through_the_database()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");

        var tenant = Guid.NewGuid();
        var customer = Guid.NewGuid();
        const string key = "billing.min_service_price";

        Assert.True((await WithServiceAsync(s => s.SetValueAsync(key, SettingScope.System, "1000", D(2026, 1, 1), default))).IsSuccess);
        Assert.True((await WithServiceAsync(s => s.SetValueAsync(key, SettingScope.ForTenant(tenant), "1200", D(2026, 1, 1), default))).IsSuccess);
        Assert.True((await WithServiceAsync(s => s.SetValueAsync(key, SettingScope.ForTenant(tenant), "1300", D(2026, 9, 1), default))).IsSuccess);
        Assert.True((await WithServiceAsync(s => s.SetValueAsync(key, SettingScope.For(SettingScopeType.Customer, tenant, customer), "900", D(2026, 1, 1), default))).IsSuccess);

        var tenantAugust = await WithServiceAsync(s => s.GetEffectiveAsync<decimal>(key, new SettingContext(tenant), D(2026, 8, 31), default));
        var tenantSeptember = await WithServiceAsync(s => s.GetEffectiveAsync<decimal>(key, new SettingContext(tenant), D(2026, 9, 1), default));
        var customerSeptember = await WithServiceAsync(s => s.GetEffectiveAsync<decimal>(key, new SettingContext(tenant, CustomerId: customer), D(2026, 9, 1), default));
        var otherTenant = await WithServiceAsync(s => s.GetEffectiveAsync<decimal>(key, new SettingContext(Guid.NewGuid()), D(2026, 9, 1), default));

        Assert.Equal(1200m, tenantAugust);
        Assert.Equal(1300m, tenantSeptember);
        Assert.Equal(900m, customerSeptember);
        Assert.Equal(1000m, otherTenant);
    }

    [SkippableFact]
    public async Task Invalid_json_is_rejected()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");

        var result = await WithServiceAsync(s => s.SetValueAsync("x.y", SettingScope.System, "not json", D(2026, 1, 1), default));

        Assert.True(result.IsFailure);
        Assert.Equal("validation.setting_value_not_json", result.Error.Code);
    }

    [SkippableFact]
    public async Task Database_rejects_a_system_row_with_a_tenant()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");

        await using var connection = new SqlConnection(database.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO organization.setting (id, [key], scope_type, tenant_id, scope_id, value, effective_from)
            VALUES (NEWID(), 'bad.row', 'System', NEWID(), NULL, '1', '2026-01-01')
            """;

        var error = await Assert.ThrowsAsync<SqlException>(() => command.ExecuteNonQueryAsync());
        Assert.Contains("ck_setting_scope_shape", error.Message, StringComparison.Ordinal);
    }
}
