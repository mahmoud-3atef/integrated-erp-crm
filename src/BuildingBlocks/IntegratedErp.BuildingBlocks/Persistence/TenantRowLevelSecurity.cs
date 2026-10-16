using System.Data.Common;
using IntegratedErp.BuildingBlocks.Context;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Migrations;

namespace IntegratedErp.BuildingBlocks.Persistence;

/// <summary>
/// Second line of tenant isolation inside SQL Server (Row-Level Security). Every connection carries
/// the current tenant in <c>SESSION_CONTEXT</c>; a security policy on each tenant table hides other
/// tenants' rows and blocks writing them — even if application code forgets a filter.
/// </summary>
public static class TenantRowLevelSecurity
{
    public const string PlatformSchema = "platform";
    public const string PredicateFunction = "platform.fn_tenant_access";

    /// <summary>Created once per database by the migrator, before module migrations run.</summary>
    internal const string CreatePredicateSql = """
        IF SCHEMA_ID(N'platform') IS NULL EXEC(N'CREATE SCHEMA platform');
        IF OBJECT_ID(N'platform.fn_tenant_access', N'IF') IS NULL
            EXEC(N'CREATE FUNCTION platform.fn_tenant_access(@tenant_id uniqueidentifier)
                RETURNS TABLE WITH SCHEMABINDING
                AS RETURN
                    SELECT 1 AS allowed
                    WHERE CAST(SESSION_CONTEXT(N''is_system'') AS bit) = 1
                       OR @tenant_id = CAST(SESSION_CONTEXT(N''tenant_id'') AS uniqueidentifier)');
        """;

    /// <summary>Use in a module migration right after creating a tenant-owned table.</summary>
    public static void AddTenantSecurityPolicy(this MigrationBuilder migrationBuilder, string schema, string table)
    {
        ArgumentNullException.ThrowIfNull(migrationBuilder);
        var policy = PolicyName(schema, table);
        migrationBuilder.Sql($"""
            CREATE SECURITY POLICY {policy}
                ADD FILTER PREDICATE {PredicateFunction}(tenant_id) ON {schema}.{table},
                ADD BLOCK PREDICATE {PredicateFunction}(tenant_id) ON {schema}.{table} AFTER INSERT,
                ADD BLOCK PREDICATE {PredicateFunction}(tenant_id) ON {schema}.{table} AFTER UPDATE
                WITH (STATE = ON);
            """);
    }

    public static void DropTenantSecurityPolicy(this MigrationBuilder migrationBuilder, string schema, string table)
    {
        ArgumentNullException.ThrowIfNull(migrationBuilder);
        migrationBuilder.Sql($"DROP SECURITY POLICY IF EXISTS {PolicyName(schema, table)};");
    }

    public static string PolicyName(string schema, string table) => $"{schema}.rls_{table}";
}

/// <summary>Stamps the current tenant (or system flag) on every opened connection.</summary>
public sealed class TenantSessionContextInterceptor(ITenantContext tenant) : DbConnectionInterceptor
{
    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        ArgumentNullException.ThrowIfNull(connection);
        using var command = CreateCommand(connection);
        command.ExecuteNonQuery();
    }

    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(connection);
        var command = CreateCommand(connection);
        await using (command.ConfigureAwait(false))
        {
            await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private DbCommand CreateCommand(DbConnection connection)
    {
        var command = connection.CreateCommand();
        command.CommandText = """
            EXEC sp_set_session_context @key = N'tenant_id', @value = @tenant_id;
            EXEC sp_set_session_context @key = N'is_system', @value = @is_system;
            """;
        AddParameter(command, "@tenant_id", tenant.TenantId is { } id ? id : DBNull.Value);
        AddParameter(command, "@is_system", tenant.IsSystem);
        return command;
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }
}
