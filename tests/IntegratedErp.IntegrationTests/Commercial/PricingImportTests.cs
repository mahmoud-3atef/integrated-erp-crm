using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.Commercial.Application;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Commercial;

[Collection(DatabaseTestGroup.Name)]
public sealed class PricingImportTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);
    private int _workerNo;

    [SkippableFact]
    public async Task Packages_are_created_by_the_user_and_price_the_workers_on_them()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var philippines = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        var india = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الهند", ["new_nameenglish"] = "India" });
        var labour = crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var totalCost = crm.Add("new_project", new() { ["new_name"] = "مشروع التكلفة الإجمالية", ["new_code"] = "pro00300", ["new_contracttype"] = 2 }, created: Created2025);
        var costPlus = crm.Add("new_project", new() { ["new_name"] = "مشروع كوست بلس", ["new_code"] = "pro00301", ["new_contracttype"] = 1 }, created: Created2025);

        // Total Cost: three Filipinos at 3,000 (one had 2,500 on an older work start) and one at 3,500.
        var first = Worker(crm, totalCost, philippines, labour, 1500m);
        WorkStart(crm, first, totalCost, "2025-07-01T21:00:00Z", 2500m);
        WorkStart(crm, first, totalCost, "2026-01-01T21:00:00Z", 3000m);
        WorkStart(crm, Worker(crm, totalCost, philippines, labour, 1600m), totalCost, "2026-02-01T21:00:00Z", 3000m);
        WorkStart(crm, Worker(crm, totalCost, philippines, labour, 1500m), totalCost, "2026-02-01T21:00:00Z", 3000m);
        var special = Worker(crm, totalCost, philippines, labour, 1500m);
        var specialStart = WorkStart(crm, special, totalCost, "2026-03-01T21:00:00Z", 3500m);

        // Indians: one priced only on the worker (default service price), one with no price at all.
        WorkStart(crm, Worker(crm, totalCost, india, labour, 1400m, defaultPrice: 2800m), totalCost, "2026-03-01T21:00:00Z", 0m);
        Worker(crm, totalCost, india, labour, 1400m);

        // Cost Plus: different salaries, the same 800 above the salary.
        WorkStart(crm, Worker(crm, costPlus, philippines, labour, 1500m), costPlus, "2026-01-01T21:00:00Z", 2300m);
        WorkStart(crm, Worker(crm, costPlus, philippines, labour, 1800m), costPlus, "2026-01-01T21:00:00Z", 2600m);

        await SyncAndImportAsync(tenantId, crm);

        // Before any package: the current prices are suggested, and no worker is on a package.
        string labourCode, philippinesCode, indiaCode;
        Guid totalCostId, costPlusId;
        using (var scope = database.Scope(tenantId))
        {
            var queries = scope.ServiceProvider.GetRequiredService<PricingQueries>();
            var suggestions = await queries.SuggestionsAsync(new ListFilter(null, null, null, true, 1, 50), default);
            Assert.Equal(3, suggestions.Total);
            var filipinos = suggestions.Items.Single(r => r.ProjectName == "مشروع التكلفة الإجمالية" && r.NationalityEn == "Philippines");
            Assert.Equal((3000m, 1500m, 3, 1), (filipinos.TotalPrice, filipinos.Salary, filipinos.Workers, filipinos.OtherPrices));
            var plus = suggestions.Items.Single(r => r.ProjectName == "مشروع كوست بلس");
            Assert.Equal((800m, 2), (plus.FeeAboveSalary, plus.Workers));

            var none = await queries.PackagesAsync(new ListFilter(null, null, null, true, 1, 50), default);
            Assert.Equal((0, 0, 0, 7, 1), (none.Totals.Packages, none.Totals.OnPackage, none.Totals.Special, none.Totals.WithoutPackage, none.Totals.WithoutPrice));

            var options = await queries.OptionsAsync(null, default);
            labourCode = options.Professions.Single().Code;
            philippinesCode = options.Nationalities.Single(n => n.NameEn == "Philippines").Code;
            indiaCode = options.Nationalities.Single(n => n.NameEn == "India").Code;
            totalCostId = filipinos.ProjectId;
            costPlusId = plus.ProjectId;
        }

        // The user creates packages: the Total Cost project's Filipinos, the Cost Plus project's fee, and a
        // general package for any nationality.
        var from = new DateOnly(2026, 1, 1);
        using (var scope = database.Scope(tenantId))
        {
            var service = scope.ServiceProvider.GetRequiredService<PricingService>();
            Assert.True((await service.CreateAsync(new PackageInput(totalCostId, labourCode, philippinesCode, 1500m, 1300m, 200m, true, 0m, false, from, null, null), default)).IsSuccess);
            Assert.True((await service.CreateAsync(new PackageInput(costPlusId, labourCode, philippinesCode, 1500m, 800m, 0m, false, 0m, false, from, null, null), default)).IsSuccess);
            Assert.True((await service.CreateAsync(new PackageInput(null, labourCode, null, 1400m, 1400m, 0m, false, 0m, false, from, null, "عامة"), default)).IsSuccess);

            // Same project, profession and nationality over an overlapping period: refused.
            var overlap = await service.CreateAsync(new PackageInput(totalCostId, labourCode, philippinesCode, 1500m, 1500m, 0m, false, 0m, false, new DateOnly(2026, 6, 1), null, null), default);
            Assert.Equal("conflict.package_overlap", overlap.Error.Code);
            var negative = await service.CreateAsync(new PackageInput(null, labourCode, indiaCode, -1m, 100m, 0m, false, 0m, false, from, null, null), default);
            Assert.Equal("validation.package_negative", negative.Error.Code);

            // The delivery order lookup: the project's own package first, then the general one.
            var catalog = scope.ServiceProvider.GetRequiredService<IPriceCatalog>();
            var own = await catalog.FindAsync(totalCostId, labourCode, philippinesCode, new DateOnly(2026, 10, 1), default);
            Assert.Equal(("PKG-00001", 3000m, true), (own!.PackageNo, own.TotalPrice, own.HousingBillable));
            var general = await catalog.FindAsync(totalCostId, labourCode, indiaCode, new DateOnly(2026, 10, 1), default);
            Assert.Equal(("PKG-00003", 2800m, true), (general!.PackageNo, general.TotalPrice, general.AnyNationality));
            Assert.Null(await catalog.FindAsync(totalCostId, labourCode, philippinesCode, new DateOnly(2025, 12, 31), default));
        }

        using (var scope = database.Scope(tenantId))
        {
            var queries = scope.ServiceProvider.GetRequiredService<PricingQueries>();
            var list = await queries.PackagesAsync(new ListFilter(null, null, null, true, 1, 50), default);
            Assert.Equal((3, 6, 1, 0, 1), (list.Totals.Packages, list.Totals.OnPackage, list.Totals.Special, list.Totals.WithoutPackage, list.Totals.WithoutPrice));
            Assert.Equal(3, list.Items.Single(p => p.PackageNo == "PKG-00001").Workers);

            var specialRow = (await queries.WorkersAsync(new ListFilter(null, "special", null, true, 1, 50), default)).Items.Single();
            Assert.Equal((3500m, 3000m, 500m, "PKG-00001"), (specialRow.ServicePrice, specialRow.PackagePrice, specialRow.Difference, specialRow.PackageNo));

            // Cost Plus: each worker's own salary + the package's fee.
            var project = await queries.ProjectAsync(costPlusId, default);
            Assert.All(project!.Workers, w => Assert.Equal("Package", w.Status));
            Assert.Equal([2300m, 2600m], project.Workers.Select(w => w.PackagePrice!.Value).Order());
            Assert.Equal("PKG-00002", project.Suggestions.Single().CoveredByNo);
        }

        // The special price is corrected in the CRM: the next sync puts the worker on the package.
        crm.Touch(specialStart, "new_serviceprice", 3000m);
        await SyncAndImportAsync(tenantId, crm);
        using (var scope = database.Scope(tenantId))
        {
            var list = await scope.ServiceProvider.GetRequiredService<PricingQueries>().PackagesAsync(new ListFilter(null, null, null, true, 1, 50), default);
            Assert.Equal((7, 0, 1), (list.Totals.OnPackage, list.Totals.Special, list.Totals.WithoutPrice));
        }

        _ = special;
    }

    private Guid Worker(FakeCrm crm, Guid project, Guid nationality, Guid profession, decimal salary, decimal? defaultPrice = null)
    {
        _workerNo++;
        return crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {_workerNo}", ["new_empidnumber"] = $"BSS9{_workerNo:000}", ["new_idnumber"] = $"25000000{_workerNo:00}",
            ["statuscode"] = 100000000, ["new_employeetype"] = 2, ["new_projectid"] = project.ToString(),
            ["new_nationalityid"] = nationality.ToString(), ["new_professionid"] = profession.ToString(),
            ["new_totalsalary"] = salary, ["new_totalservices"] = defaultPrice,
        }, created: Created2025);
    }

    private static Guid WorkStart(FakeCrm crm, Guid worker, Guid project, string startedOn, decimal price, decimal housing = 0m) =>
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = worker.ToString(), ["new_projectid"] = project.ToString(), ["new_startdate"] = startedOn,
            ["new_serviceprice"] = price, ["new_housing"] = housing, ["new_transportation"] = 0m, ["statecode"] = 0,
            ["new_number"] = $"SW{Guid.NewGuid():N}"[..8],
        }, created: Created2025);

    private async Task<Guid> CreateCompanyAsync()
    {
        using var scope = database.Scope(system: true);
        var code = $"pr-{Guid.NewGuid():N}"[..16];
        return (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(code, "شركة الأسعار", "Pricing Co", default)).Value.Id;
    }

    private async Task SyncAndImportAsync(Guid tenantId, FakeCrm crm)
    {
        using var scope = database.Scope(tenantId, user: "crm-sync");
        var db = scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>();
        var sync = ActivatorUtilities.CreateInstance<CrmSyncService>(scope.ServiceProvider, (ICrmSource)crm, Options.Create(new CrmSyncOptions()));
        db.Runs.Add(new SyncRun(SyncMode.Incremental, "test", DateTimeOffset.UtcNow));
        await db.SaveChangesAsync();
        var consumers = scope.ServiceProvider.GetServices<ICrmStagingConsumer>().ToList();
        Assert.True(await sync.RunNextAsync(scope.ServiceProvider.GetRequiredService<ReferenceImportService>(), consumers, default));
    }
}
