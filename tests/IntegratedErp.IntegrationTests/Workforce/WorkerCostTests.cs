using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workforce.Application;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Workforce;

[Collection(DatabaseTestGroup.Name)]
public sealed class WorkerCostTests(TestDatabase database)
{
    [SkippableFact]
    public async Task A_suppliers_worker_costs_their_own_card_else_the_package_and_a_company_worker_is_not_a_suppliers()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"wc-{Guid.NewGuid():N}"[..16], "شركة التكلفة", "Cost Co", default)).Value.Id;
        }

        var crm = new FakeCrm();
        var country = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        void Worker(string no, int sponsor) => crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {no}", ["new_empidnumber"] = no, ["new_idnumber"] = $"2{no[3..]}00000", ["statuscode"] = 279640001, ["new_employeetype"] = 2,
            ["new_nationalityid"] = country.ToString(), ["new_totalsalary"] = 1500m, ["new_sponseredby"] = sponsor,
        }, created: new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        Worker("BSS0800", 100000002); // IRC - 02
        Worker("BSS0801", 100000002);
        Worker("BSS0802", 100000008); // Care-pro - 07: the company's
        using (var scope = database.Scope(tenantId, user: "crm-sync"))
        {
            var db = scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>();
            var sync = ActivatorUtilities.CreateInstance<CrmSyncService>(scope.ServiceProvider, (ICrmSource)crm, Options.Create(new CrmSyncOptions()));
            db.Runs.Add(new SyncRun(SyncMode.Incremental, "test", DateTimeOffset.UtcNow));
            await db.SaveChangesAsync();
            Assert.True(await sync.RunNextAsync(scope.ServiceProvider.GetRequiredService<ReferenceImportService>(), scope.ServiceProvider.GetServices<ICrmStagingConsumer>().ToList(), default));
        }

        using (var scope = database.Scope(tenantId, user: "finance"))
        {
            var ids = await scope.ServiceProvider.GetRequiredService<WorkforceDbContext>().Workers.ToDictionaryAsync(w => w.WorkerNo, w => w.Id);
            var costs = scope.ServiceProvider.GetRequiredService<WorkerCostService>();
            var from = new DateOnly(2026, 1, 1);

            Assert.True((await costs.SavePackageAsync(null, new CostInput("Care-Pro - 05", null, null, 3000, "MonthlyFixed", from, null), default)).IsFailure);
            Assert.True((await costs.SavePackageAsync(null, new CostInput("IRC - 02", null, null, 3000, "MonthlyFixed", from, null), default)).IsSuccess);
            Assert.True((await costs.AddCardAsync(ids["BSS0801"], new CostInput(null, null, null, 3200, "ByWorkingDays", from, "عقد خاص"), default)).IsSuccess);
            Assert.True((await costs.AddCardAsync(ids["BSS0802"], new CostInput(null, null, null, 3200, "MonthlyFixed", from, null), default)).IsFailure);

            var overview = await costs.OverviewAsync(default);
            Assert.Equal((2, 1, 1, 0), (overview.SupplierWorkers, overview.WithCard, overview.ByPackage, overview.Missing));

            var info = (await scope.ServiceProvider.GetRequiredService<IWorkerCosts>().CostsAsync(ids.Values.ToList(), new DateOnly(2026, 9, 1), default)).ToDictionary(c => c.WorkerId);
            Assert.Equal(("Supplier", 3000m, false), (info[ids["BSS0800"]].Source, info[ids["BSS0800"]].SupplierMonthlyCost!.Value, info[ids["BSS0800"]].ByWorkingDays!.Value));
            Assert.Equal((3200m, true), (info[ids["BSS0801"]].SupplierMonthlyCost!.Value, info[ids["BSS0801"]].ByWorkingDays!.Value));
            Assert.Equal(("Company", (decimal?)null), (info[ids["BSS0802"]].Source, info[ids["BSS0802"]].SupplierMonthlyCost));
        }
    }
}
