using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Organization.Domain.LegalEntities;
using IntegratedErp.Modules.Organization.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Organization;

[Collection(DatabaseTestGroup.Name)]
public sealed class TenantIsolationTests(TestDatabase database)
{
    private async Task<(Guid A, Guid B)> CreateTwoTenantsWithLegalEntitiesAsync()
    {
        Guid a, b;
        using (var scope = database.Scope(system: true))
        {
            var service = scope.ServiceProvider.GetRequiredService<OrganizationService>();
            a = (await service.CreateTenantAsync($"a-{Guid.NewGuid():N}"[..20], "شركة أ", "Company A", default)).Value.Id;
            b = (await service.CreateTenantAsync($"b-{Guid.NewGuid():N}"[..20], "شركة ب", "Company B", default)).Value.Id;
        }

        using (var scope = database.Scope(a))
        {
            var created = await scope.ServiceProvider.GetRequiredService<OrganizationService>()
                .CreateLegalEntityAsync("CP05", "كير برو 05", "Care-Pro 05", "1010101010", "300000000000003", default);
            Assert.True(created.IsSuccess);
        }

        using (var scope = database.Scope(b))
        {
            // Same code is fine in another tenant.
            var created = await scope.ServiceProvider.GetRequiredService<OrganizationService>()
                .CreateLegalEntityAsync("CP05", "شركة ب 05", "B 05", "2020202020", null, default);
            Assert.True(created.IsSuccess);
        }

        return (a, b);
    }

    private static async Task<int> CountLegalEntitiesAsync(SqlConnection connection, Guid tenantId)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM organization.legal_entity WHERE tenant_id = @t";
        command.Parameters.AddWithValue("@t", tenantId);
        return (int)(await command.ExecuteScalarAsync())!;
    }

    [SkippableFact]
    public async Task A_tenant_sees_only_its_own_legal_entities()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var (a, b) = await CreateTwoTenantsWithLegalEntitiesAsync();

        using var scope = database.Scope(a);
        var listed = await scope.ServiceProvider.GetRequiredService<OrganizationService>().ListLegalEntitiesAsync(default);

        var only = Assert.Single(listed);
        Assert.Equal("Care-Pro 05", only.NameEn);

        // Even with the EF filter switched off, row-level security in SQL Server still hides tenant B.
        var db = scope.ServiceProvider.GetRequiredService<OrganizationDbContext>();
        var unfiltered = await db.LegalEntities.IgnoreQueryFilters().Where(e => e.TenantId == a || e.TenantId == b).ToListAsync();
        Assert.All(unfiltered, e => Assert.Equal(a, e.TenantId));
    }

    [SkippableFact]
    public async Task Row_level_security_hides_and_blocks_other_tenants_in_raw_sql()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var (a, b) = await CreateTwoTenantsWithLegalEntitiesAsync();

        await using (var asA = await database.OpenAsTenantAsync(a))
        {
            Assert.Equal(1, await CountLegalEntitiesAsync(asA, a));
            Assert.Equal(0, await CountLegalEntitiesAsync(asA, b));

            await using var insert = asA.CreateCommand();
            insert.CommandText = """
                INSERT INTO organization.legal_entity (id, tenant_id, code, name_ar, name_en, commercial_registration_no, is_active)
                VALUES (NEWID(), @b, 'HACK', N'x', 'x', '9999999999', 1)
                """;
            insert.Parameters.AddWithValue("@b", b);
            var error = await Assert.ThrowsAsync<SqlException>(() => insert.ExecuteNonQueryAsync());
            Assert.Contains("block predicate", error.Message, StringComparison.OrdinalIgnoreCase);
        }

        await using var asNobody = await database.OpenAsTenantAsync(null);
        Assert.Equal(0, await CountLegalEntitiesAsync(asNobody, a));

        await using var asSystem = await database.OpenAsTenantAsync(null, system: true);
        Assert.Equal(1, await CountLegalEntitiesAsync(asSystem, a));
        Assert.Equal(1, await CountLegalEntitiesAsync(asSystem, b));
    }

    [SkippableFact]
    public async Task Writing_another_tenants_row_is_refused_by_the_application()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var (a, b) = await CreateTwoTenantsWithLegalEntitiesAsync();

        using var scope = database.Scope(a);
        var db = scope.ServiceProvider.GetRequiredService<OrganizationDbContext>();
        var foreign = LegalEntity.Create("X1", "س", "X", "1234567890", null).Value;
        db.Entry(foreign).Property(nameof(LegalEntity.TenantId)).CurrentValue = b;
        db.LegalEntities.Add(foreign);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
        Assert.Contains("another tenant", error.Message, StringComparison.Ordinal);
    }

    [SkippableFact]
    public async Task Adding_tenant_data_without_a_tenant_is_refused()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");

        using var scope = database.Scope();
        var result = scope.ServiceProvider.GetRequiredService<OrganizationService>()
            .CreateLegalEntityAsync("NOT", "لا", "No", "1234567890", null, default);

        await Assert.ThrowsAsync<InvalidOperationException>(() => result);
    }

    [SkippableFact]
    public async Task Every_tenant_table_has_a_row_level_security_policy()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");

        await using var connection = await database.OpenAsTenantAsync(null, system: true);
        await using var command = connection.CreateCommand();
        // Tables with a NOT NULL tenant_id are tenant-owned; each needs an enabled security policy.
        command.CommandText = """
            SELECT s.name + '.' + t.name
            FROM sys.tables t
            JOIN sys.schemas s ON s.schema_id = t.schema_id
            JOIN sys.columns c ON c.object_id = t.object_id AND c.name = 'tenant_id' AND c.is_nullable = 0
            WHERE NOT EXISTS (
                SELECT 1 FROM sys.security_predicates p
                JOIN sys.security_policies sp ON sp.object_id = p.object_id AND sp.is_enabled = 1
                WHERE p.target_object_id = t.object_id AND p.predicate_type = 0)
            """;
        var missing = new List<string>();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            missing.Add(reader.GetString(0));
        }

        Assert.True(missing.Count == 0, "Tables without row-level security: " + string.Join(", ", missing));
    }
}
