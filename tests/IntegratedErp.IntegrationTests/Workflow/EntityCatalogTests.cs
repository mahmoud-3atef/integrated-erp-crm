using IntegratedErp.Modules.Workflow.Application;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Workflow;

[Collection(DatabaseTestGroup.Name)]
public sealed class EntityCatalogTests(TestDatabase database)
{
    [SkippableFact]
    public void Every_screen_has_its_table_in_the_catalog_and_every_lookup_reaches_a_known_table()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        using var scope = database.Scope(system: true);
        var catalog = scope.ServiceProvider.GetRequiredService<EntityCatalog>();
        var engine = scope.ServiceProvider.GetRequiredService<ApprovalEngine>();

        // Every table of every module describes itself from its EF Core model, and links only to tables that exist.
        var all = catalog.All;
        Assert.NotEmpty(all);
        var keys = all.Select(e => e.Key).ToHashSet(StringComparer.Ordinal);
        Assert.All(all, e => Assert.All(e.Lookups, l => Assert.Contains(l.Target, keys)));
        Assert.All(all, e => Assert.Equal(e.Fields.Count, e.Fields.Select(f => f.Key).Distinct(StringComparer.Ordinal).Count()));

        // Every approval screen is a table of the catalog, so its processes see all its fields and related tables.
        Assert.All(engine.Screens, s => Assert.Contains(s.Code, keys));

        // Three levels at most: a leave request reaches its employee's department's manager.
        var leave = engine.Screens.Single(s => s.Code == "leave.request");
        Assert.Contains(leave.RelatedTables, r => r.Key == "employee_id/department_id/manager_id");
        Assert.Contains(leave.RelatedTables.Single(r => r.Key == "employee_id/department_id/manager_id").Fields, f => f.Key == "user_id" && f.Type == RecordFieldType.User);
        Assert.DoesNotContain(leave.RelatedTables, r => r.Key.Split(EntityCatalog.PathSeparator).Length > EntityCatalog.MaxDepth);
    }

    [SkippableFact]
    public async Task A_text_field_lists_its_values_and_a_relation_path_finds_its_table()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        using var scope = database.Scope(system: true);
        var catalog = scope.ServiceProvider.GetRequiredService<EntityCatalog>();

        // The table at the end of a path, and none for an unknown one.
        Assert.Equal("staff.employee", catalog.TableAt("leave.request", "employee_id/department_id/manager_id")?.Key);
        Assert.Null(catalog.TableAt("leave.request", "no_such_field"));

        // A field's values are distinct and sorted; a hidden or unknown field lists nothing.
        var values = await catalog.ValuesAsync("staff.employee", "nationality_en", CancellationToken.None);
        Assert.Equal(values.Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal), values);
        Assert.Empty(await catalog.ValuesAsync("staff.employee", "id_number", CancellationToken.None));
        Assert.Empty(await catalog.ValuesAsync("staff.employee", "no_such_field", CancellationToken.None));
    }
}
