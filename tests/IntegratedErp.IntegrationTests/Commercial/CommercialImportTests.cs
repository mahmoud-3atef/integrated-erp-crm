using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.Commercial.Application;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Commercial;

[Collection(DatabaseTestGroup.Name)]
public sealed class CommercialImportTests(TestDatabase database)
{
    private static readonly DateTime From2025 = new(2025, 1, 1);

    [SkippableFact]
    public async Task Customers_contracts_and_projects_are_built_from_the_crm_copy_from_2025_only()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var created2025 = new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        var oldCustomer = crm.Add("account", new() { ["name"] = "عميل قديم" }, created: new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var customer = crm.Add("account", new() { ["name"] = "شركة الرعاية", ["accountnumber"] = "C-001", ["new_vatnumber"] = "300000000000003" }, created: created2025);
        crm.Add("new_project", new() { ["new_name"] = "HeadOffice", ["new_code"] = "HeadOffice" }, created: new DateTime(2016, 11, 16, 0, 0, 0, DateTimeKind.Utc));
        var project = crm.Add("new_project", new()
        {
            ["new_name"] = "مشروع الرياض", ["new_code"] = "pro00200", ["new_customerid"] = customer.ToString(), ["owneridname"] = "مدير المشروع",
            ["new_contracttype"] = 2, ["new_contractstatus"] = 1, ["new_startdate"] = "2025-12-31T21:00:00Z",
            ["new_enddate"] = DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-ddT21:00:00Z", System.Globalization.CultureInfo.InvariantCulture),
        }, created: created2025);
        crm.Add("new_project", new() { ["new_name"] = "بلا عميل", ["new_code"] = "pro00201" }, created: created2025);
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = "WORKER ONE", ["new_empidnumber"] = "BSS1", ["new_idnumber"] = "2000000001", ["statuscode"] = 100000000,
            ["new_employeetype"] = 2, ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الرياض",
        }, created: created2025);

        await SyncAndImportAsync(tenantId, crm);

        using (var scope = database.Scope(tenantId))
        {
            var queries = scope.ServiceProvider.GetRequiredService<CommercialQueries>();
            var projects = await queries.ProjectsAsync(new ListFilter(null, null, "name", false, 1, 50), default);
            Assert.Equal(["بلا عميل", "مشروع الرياض"], projects.Items.Select(p => p.Name).Order());
            Assert.Equal((2, 1, 1, 1), (projects.Totals.Projects, projects.Totals.Workers, projects.Totals.EndingSoon, projects.Totals.WithoutCustomer));

            var riyadh = projects.Items.Single(p => p.Code == "pro00200");
            Assert.Equal(("شركة الرعاية", "TotalCost", "Valid", 1), (riyadh.CustomerName, riyadh.ContractType, riyadh.ContractStatus, riyadh.Workers));
            Assert.Equal(new DateOnly(2026, 1, 1), riyadh.StartsOn);

            var detail = await queries.ProjectAsync(riyadh.Id, default);
            Assert.Equal("WORKER ONE", detail!.Workers.Single().Name);

            var customers = await queries.CustomersAsync(new ListFilter(null, null, null, false, 1, 50), default);
            var only = customers.Items.Single();
            Assert.Equal(("شركة الرعاية", 1, 1), (only.Name, only.Projects, only.Workers));
            Assert.DoesNotContain(customers.Items, c => c.Name == "عميل قديم");
        }

        // A project that arrives before its customer is linked when the customer comes.
        var late = crm.Add("account", new() { ["name"] = "عميل متأخر" }, created: created2025);
        crm.Add("new_project", new() { ["new_name"] = "مشروع جديد", ["new_code"] = "pro00202", ["new_customerid"] = Guid.NewGuid().ToString() }, created: created2025);
        var linkedLater = crm.Add("new_project", new() { ["new_name"] = "مرتبط لاحقًا", ["new_code"] = "pro00203", ["new_customerid"] = late.ToString() }, created: created2025);
        await SyncAndImportAsync(tenantId, crm);
        using (var scope = database.Scope(tenantId))
        {
            var projects = await scope.ServiceProvider.GetRequiredService<CommercialQueries>().ProjectsAsync(new ListFilter("مرتبط", null, null, false, 1, 50), default);
            Assert.Equal("عميل متأخر", projects.Items.Single().CustomerName);
        }

        _ = oldCustomer;
        _ = linkedLater;
    }

    private async Task<Guid> CreateCompanyAsync()
    {
        using var scope = database.Scope(system: true);
        var code = $"cm-{Guid.NewGuid():N}"[..16];
        return (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(code, "شركة العملاء", "Commercial Co", default)).Value.Id;
    }

    private async Task SyncAndImportAsync(Guid tenantId, FakeCrm crm)
    {
        using var scope = database.Scope(tenantId, user: "crm-sync");
        var db = scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>();
        var options = new CrmSyncOptions { CreatedFrom = { ["account"] = From2025, ["new_project"] = From2025 } };
        var sync = ActivatorUtilities.CreateInstance<CrmSyncService>(scope.ServiceProvider, (ICrmSource)crm, Options.Create(options));
        db.Runs.Add(new SyncRun(SyncMode.Incremental, "test", DateTimeOffset.UtcNow));
        await db.SaveChangesAsync();
        var consumers = scope.ServiceProvider.GetServices<ICrmStagingConsumer>().ToList();
        Assert.True(await sync.RunNextAsync(scope.ServiceProvider.GetRequiredService<ReferenceImportService>(), consumers, default));
    }
}
