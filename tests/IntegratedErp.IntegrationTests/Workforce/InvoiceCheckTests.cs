using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workforce.Application;
using IntegratedErp.Modules.Workforce.Domain;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Workforce;

[Collection(DatabaseTestGroup.Name)]
public sealed class InvoiceCheckTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 1, 2, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task The_old_invoices_are_checked_line_by_line_against_the_period_ledger()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var hotel = Guid.NewGuid();
        var office = Guid.NewGuid();
        var resort = Guid.NewGuid();

        // On the hotel all month: the work start was entered twice that day, and only the earlier one has the price.
        var full = Worker(crm, "BSS7001");
        WorkStart(crm, full, hotel, "2026-08-01", 3000m, new DateTime(2026, 7, 30, 0, 0, 0, DateTimeKind.Utc));
        WorkStart(crm, full, hotel, "2026-08-01", null, new DateTime(2026, 7, 31, 0, 0, 0, DateTimeKind.Utc));
        var late = Worker(crm, "BSS7002");
        WorkStart(crm, late, hotel, "2026-09-11", 3000m);
        var wrong = Worker(crm, "BSS7003");
        WorkStart(crm, wrong, hotel, "2026-09-16", 2500m);
        var housed = Worker(crm, "BSS7004");
        Housing(crm, housed, "2026-08-15");
        var forgotten = Worker(crm, "BSS7005");
        WorkStart(crm, forgotten, hotel, "2026-07-01", 3000m);
        var internalWorker = Worker(crm, "BSS7006");
        WorkStart(crm, internalWorker, office, "2026-07-01", 2000m);
        var cycle = Worker(crm, "BSS7007");
        WorkStart(crm, cycle, resort, "2026-08-25", 4000m);

        // September: the hotel's invoice (an absent day is still a working day), a canceled one for the office, and the
        // resort invoiced from the 21st to the 20th. August is before the check.
        var september = Invoice(crm, hotel, "INV-1", "2026-09-01", "2026-09-30", 279640004);
        Line(crm, september, full, hotel, 30, 2, 3000m);
        Line(crm, september, late, hotel, 20, 0, 3000m);
        Line(crm, september, wrong, hotel, 30, 0, 3000m);
        Line(crm, september, housed, hotel, 30, 0, 3000m);
        Line(crm, Invoice(crm, office, "INV-2", "2026-09-01", "2026-09-30", 279640007), internalWorker, office, 30, 0, 2000m);
        Line(crm, Invoice(crm, resort, "INV-3", "2026-08-21", "2026-09-20", 279640008), cycle, resort, 27, 0, 4000m);
        Line(crm, Invoice(crm, hotel, "INV-0", "2026-08-01", "2026-08-31", 279640004), full, hotel, 30, 0, 3000m);

        await SyncAsync(tenantId, crm);

        using var scope = database.Scope(tenantId);
        var list = await scope.ServiceProvider.GetRequiredService<InvoiceCheckQueries>().ListAsync(null, null, null, 1, 50, default);
        Assert.Equal([new DateOnly(2026, 9, 1)], list.Months);
        var results = list.Items.ToDictionary(i => i.WorkerNo, i => (i.Result, i.LedgerDays, i.LedgerPrice));
        Assert.Equal((InvoiceCheckResults.Match, (decimal?)30m, (decimal?)3000m), results["BSS7001"]);
        Assert.Equal((InvoiceCheckResults.Match, (decimal?)20m, (decimal?)3000m), results["BSS7002"]);
        Assert.Equal((InvoiceCheckResults.DaysAndPriceDiff, (decimal?)15m, (decimal?)2500m), results["BSS7003"]);
        Assert.Equal(InvoiceCheckResults.NotInLedger, results["BSS7004"].Result);
        Assert.Equal((InvoiceCheckResults.NotInvoiced, (decimal?)30m, (decimal?)3000m), results["BSS7005"]);
        Assert.Equal(InvoiceCheckResults.ProjectNotInvoiced, results["BSS7006"].Result);
        Assert.Equal((InvoiceCheckResults.Match, (decimal?)27m, (decimal?)4000m), results["BSS7007"]);
        Assert.Equal(7, list.Total);

        // 3 of the 6 counted lines (the project without an invoice is left out), in 2 invoices.
        Assert.Equal((50m, 2), (list.MatchRate, list.Invoices));
        Assert.Equal(["BSS7003"], (await scope.ServiceProvider.GetRequiredService<InvoiceCheckQueries>()
            .ListAsync(new DateOnly(2026, 9, 15), InvoiceCheckResults.DaysAndPriceDiff, null, 1, 50, default)).Items.Select(i => i.WorkerNo));
    }

    private static Guid Worker(FakeCrm crm, string no) =>
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {no}", ["new_empidnumber"] = no, ["new_idnumber"] = $"2{no[3..]}00000",
            ["statuscode"] = 100000000, ["new_employeetype"] = 2, ["new_totalsalary"] = 1500m,
        }, created: Created2025);

    private static void WorkStart(FakeCrm crm, Guid worker, Guid project, string on, decimal? price, DateTime? created = null) =>
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = worker.ToString(), ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع",
            ["new_startdate"] = $"{on}T09:00:00Z", ["new_serviceprice"] = price, ["statecode"] = 0, ["new_number"] = $"SW{Guid.NewGuid():N}"[..8],
        }, created: created ?? Created2025);

    private static void Housing(FakeCrm crm, Guid worker, string on) =>
        crm.Add("mw_lodginorderdetails", new()
        {
            ["mw_empid"] = worker.ToString(), ["mw_arrivedate"] = $"{on}T09:00:00Z", ["statuscode"] = 100000009,
            ["new_entertype"] = 100000000, ["mw_name"] = $"H{Guid.NewGuid():N}"[..8],
        }, created: Created2025);

    /// <summary>An invoice for the days from/to (both included), stored at midnight Riyadh time as the CRM does.</summary>
    private static Guid Invoice(FakeCrm crm, Guid project, string no, string from, string to, int status) =>
        crm.Add("new_invoice", new()
        {
            ["new_invoicenumber"] = no, ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع", ["statecode"] = 0, ["statuscode"] = status,
            ["new_invoicetype"] = 100000000, ["new_monthdays"] = 30m,
            ["new_fromdate"] = DateTime.Parse(from, System.Globalization.CultureInfo.InvariantCulture).AddHours(-3).ToString("s") + "Z",
            ["new_todate"] = DateTime.Parse(to, System.Globalization.CultureInfo.InvariantCulture).AddHours(-3).ToString("s") + "Z",
        }, created: Created2025);

    private static void Line(FakeCrm crm, Guid invoice, Guid worker, Guid project, decimal workingDays, decimal absentDays, decimal price) =>
        crm.Add("new_invoicdetail", new()
        {
            ["new_invoiceid"] = invoice.ToString(), ["new_employeeid"] = worker.ToString(), ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع",
            ["statecode"] = 0, ["new_workingdays"] = workingDays, ["new_abscentdays"] = absentDays, ["new_salesprice"] = price,
            ["new_totalwithoutvat"] = price * workingDays / 30,
        }, created: Created2025);

    private async Task<Guid> CreateCompanyAsync()
    {
        using var scope = database.Scope(system: true);
        var code = $"ic-{Guid.NewGuid():N}"[..16];
        return (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(code, "شركة المطابقة", "Check Co", default)).Value.Id;
    }

    private async Task SyncAsync(Guid tenantId, FakeCrm crm)
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
