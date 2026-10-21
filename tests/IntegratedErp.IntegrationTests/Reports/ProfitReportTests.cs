using System.Text.Json;
using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Expenses.Application;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Reports.Application;
using IntegratedErp.Modules.Workforce.Application;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Reports;

[Collection(DatabaseTestGroup.Name)]
public sealed class ProfitReportTests(TestDatabase database)
{
    [SkippableFact]
    public async Task A_months_profit_counts_the_invoice_lines_against_the_salary_the_suppliers_cost_and_the_projects_expenses()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"pr-{Guid.NewGuid():N}"[..16], "شركة الربحية", "Profit Co", default)).Value.Id;
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
        var month = new DateOnly(today.Year, today.Month, 1).AddMonths(-1);
        var monthEnd = month.AddMonths(1).AddDays(-1);
        var days = monthEnd.Day;
        var crm = new FakeCrm();
        var project = crm.Add("new_project", new() { ["new_name"] = "مشروع الربحية", ["new_code"] = "pro00950", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        var country = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        Guid Worker(string no, int sponsor)
        {
            var id = crm.Add(CrmEntities.Employee, new()
            {
                ["new_name"] = $"WORKER {no}", ["new_empidnumber"] = no, ["new_idnumber"] = $"2{no[3..]}00000", ["statuscode"] = 100000000, ["new_employeetype"] = 2,
                ["new_nationalityid"] = country.ToString(), ["new_totalsalary"] = 1500m, ["new_sponseredby"] = sponsor,
                ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الربحية",
            }, created: new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc));
            crm.Add("new_empwork", new()
            {
                ["new_employeeid"] = id.ToString(), ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الربحية",
                ["new_startdate"] = $"{month.AddDays(-1):yyyy-MM-dd}T21:00:00Z", ["new_serviceprice"] = 3500m, ["statecode"] = 0, ["new_number"] = $"SW{no[3..]}",
            }, created: new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc));
            return id;
        }

        var supplierWorker = Worker("BSS0900", 100000002); // IRC - 02
        var companyWorker = Worker("BSS0901", 100000008); // Care-pro - 07
        using (var scope = database.Scope(tenantId, user: "crm-sync"))
        {
            var db = scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>();
            var sync = ActivatorUtilities.CreateInstance<CrmSyncService>(scope.ServiceProvider, (ICrmSource)crm, Options.Create(new CrmSyncOptions()));
            db.Runs.Add(new SyncRun(SyncMode.Incremental, "test", DateTimeOffset.UtcNow));
            await db.SaveChangesAsync();
            Assert.True(await sync.RunNextAsync(scope.ServiceProvider.GetRequiredService<ReferenceImportService>(), scope.ServiceProvider.GetServices<ICrmStagingConsumer>().ToList(), default));

            // The month's project invoice with a line for each worker (CRM dates are UTC: the Riyadh day at 21:00 before).
            var run = Guid.NewGuid();
            var invoice = Guid.NewGuid();
            var end = $"{monthEnd.AddDays(-1):yyyy-MM-dd}T21:00:00Z";
            db.Records.Add(new StagedRecord("new_invoice", invoice, null, null, 0, JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["new_invoicenumber"] = "INV-P1", ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الربحية", ["new_todate"] = end, ["createdon"] = end,
                ["new_totalamount"] = 7000m, ["new_totalvatamount"] = 1050m, ["new_netsalarywithvat"] = 8050m, ["new_totalpaidamount"] = 0m, ["new_labornumber"] = 2, ["statuscode"] = 279640008, ["new_invoicetype"] = 100000000,
            }), "INV-P1", run, DateTimeOffset.UtcNow));
            // The company worker was absent 10 days: 600 deducted, a 1,200 net salary (the cost).
            foreach (var (worker, due, net, absence) in new[] { (supplierWorker, 1500m, 1500m, 0m), (companyWorker, 1800m, 1200m, 600m) })
            {
                db.Records.Add(new StagedRecord("new_invoicdetail", Guid.NewGuid(), null, null, 0, JsonSerializer.Serialize(new Dictionary<string, object?>
                {
                    ["new_invoiceid"] = invoice.ToString(), ["new_employeeid"] = worker.ToString(), ["new_totalwithoutvat"] = 3500m, ["new_workingdays"] = (decimal)days, ["new_duesalary"] = due, ["new_nettoemployee"] = net, ["new_absencedeductions"] = absence, ["new_abscentdays"] = absence / 60m,
                }), "line", run, DateTimeOffset.UtcNow));
            }

            await db.SaveChangesAsync();
        }

        using (var scope = database.Scope(tenantId, user: "finance"))
        {
            var report = scope.ServiceProvider.GetRequiredService<ProfitReport>();

            // Without the supplier's cost the worker's revenue stays out of the profit.
            var before = await report.MonthAsync(month, default);
            Assert.Equal((7000m, 3500m, 1), (before.Revenue, before.UncostedRevenue, before.UncostedWorkers));
            Assert.Equal(1200m, before.CompanySalaries);
            Assert.Equal(3500m - 1200m, before.Profit);
        }

        using (var scope = database.Scope(tenantId, user: "finance2"))
        {
            var ids = await scope.ServiceProvider.GetRequiredService<WorkforceDbContext>().Workers.ToDictionaryAsync(w => w.WorkerNo, w => w.Id);
            Assert.True((await scope.ServiceProvider.GetRequiredService<WorkerCostService>().AddCardAsync(ids["BSS0900"], new CostInput(null, null, null, 3000, "MonthlyFixed", month, null), default)).IsSuccess);
            Assert.True((await scope.ServiceProvider.GetRequiredService<ExpenseService>().CreateAsync(new ExpenseInput(month.AddDays(2), "TRAVEL_TICKET", ids["BSS0900"], project, 200, 0, 1, null, null, null), default)).IsSuccess);
            scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>().Remove($"reports.profit.{tenantId}.{month:yyyyMM}");

            var report = scope.ServiceProvider.GetRequiredService<ProfitReport>();
            var m = await report.MonthAsync(month, default);
            Assert.Equal((0m, 0), (m.UncostedRevenue, m.UncostedWorkers));
            Assert.Equal((3000m, 1200m, 200m), (m.SupplierCosts, m.CompanySalaries, m.ProjectExpenses));
            Assert.Equal(7000m - 3000m - 1200m - 200m, m.Profit);
            var company = m.Workers.Single(w => w.WorkerNo == "BSS0901");
            Assert.Equal((1800m, 600m, 1200m), (company.Parts.DueSalary, company.Parts.AbsenceDeduction, company.Parts.BilledSalary));

            var p = Assert.Single(m.Projects);
            Assert.Equal((2, 7000m, 4200m, 200m, 2600m), (p.Workers, p.Revenue, p.WorkerCost, p.Expenses, p.Profit));
            var supplier = m.Workers.Single(w => w.WorkerNo == "BSS0900");
            Assert.Equal(("Supplier", 3500m, 3000m, 500m), (supplier.Source, supplier.Revenue, supplier.Cost, supplier.Profit));
        }
    }
}
