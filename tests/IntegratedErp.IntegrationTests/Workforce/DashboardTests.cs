using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Operations.Application;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workforce.Application;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Workforce;

[Collection(DatabaseTestGroup.Name)]
public sealed class DashboardTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task The_dashboard_counts_where_the_workers_are_and_how_they_moved()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var philippines = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var project = Guid.NewGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
        var thisMonth = new DateOnly(today.Year, today.Month, 1);
        for (var i = 0; i < 3; i++)
        {
            var worker = Worker(crm, $"BSS05{i:00}", 100000000, philippines, project);
            crm.Add("new_empwork", new()
            {
                ["new_employeeid"] = worker.ToString(), ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الرياض",
                ["new_startdate"] = $"{thisMonth:yyyy-MM-dd}T09:00:00Z", ["new_serviceprice"] = 3000m, ["statecode"] = 0, ["new_number"] = $"SW05{i:00}",
            }, created: Created2025);
        }

        Worker(crm, "BSS0510", 279640001, philippines, null); // in housing
        Worker(crm, "BSS0511", 279640007, philippines, null); // final exit

        // On the job in the old system, but on the pseudo-project of inactive workers: out of every count.
        var inactiveProject = Guid.NewGuid();
        var parked = crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = "WORKER BSS0520", ["new_empidnumber"] = "BSS0520", ["new_idnumber"] = "2052000000", ["statuscode"] = 100000000, ["new_employeetype"] = 2,
            ["new_nationalityid"] = philippines.ToString(), ["new_projectid"] = inactiveProject.ToString(), ["new_projectidname"] = "InActive Employee",
        }, created: Created2025);
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = parked.ToString(), ["new_projectid"] = inactiveProject.ToString(), ["new_projectidname"] = "InActive Employee",
            ["new_startdate"] = $"{thisMonth:yyyy-MM-dd}T09:00:00Z", ["new_serviceprice"] = 3000m, ["statecode"] = 0, ["new_number"] = "SW0520",
        }, created: Created2025);
        await SyncAsync(tenantId, crm);

        using var scope = database.Scope(tenantId);
        var workforce = await scope.ServiceProvider.GetRequiredService<WorkforceDashboard>().GetAsync(default);
        Assert.Equal(4, workforce.Active);
        Assert.Equal((3, 1, 1), (workforce.Placements["Working"], workforce.Placements["Housing"], workforce.Placements["Exited"]));
        Assert.Equal(("مشروع الرياض", 3, 1), (workforce.Projects.Single().NameAr, workforce.Projects.Single().Count, workforce.ProjectsWithWorkers));
        Assert.Equal(("Philippines", 4), (workforce.Nationalities.Single().NameEn, workforce.Nationalities.Single().Count));
        Assert.Equal(12, workforce.Moves.Count);
        Assert.Equal((thisMonth, 3), (workforce.Moves[^1].Month, workforce.Moves[^1].WorkStarts));
        Assert.Equal(0, workforce.IqamaWithExpiry);
        Assert.False(workforce.Placements.ContainsKey("Inactive"));

        // The workers list leaves them out of its total, and shows them on their own filter or a search.
        var queries = scope.ServiceProvider.GetRequiredService<WorkerQueries>();
        var list = await queries.ListAsync(new WorkerFilter(IntegratedErp.Modules.Workforce.Domain.WorkerKind.Worker, null, null, null, false, 1, 50), false, default);
        Assert.Equal((5, 1), (list.Total, list.Counts["Inactive"]));
        Assert.Equal(1, (await queries.ListAsync(new WorkerFilter(IntegratedErp.Modules.Workforce.Domain.WorkerKind.Worker, null, "Inactive", null, false, 1, 50), false, default)).Total);
        Assert.Equal(1, (await queries.ListAsync(new WorkerFilter(IntegratedErp.Modules.Workforce.Domain.WorkerKind.Worker, "BSS0520", null, null, false, 1, 50), false, default)).Total);

        var operations = await scope.ServiceProvider.GetRequiredService<OperationsDashboard>().GetAsync(default);
        Assert.Equal((0, 0, 0), (operations.Deliveries.Preparing, operations.Returns.InApproval, operations.TransferredThisMonth));
        Assert.Empty(operations.Recent);
    }

    private static Guid Worker(FakeCrm crm, string number, int status, Guid nationality, Guid? project) =>
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {number}", ["new_empidnumber"] = number, ["new_idnumber"] = $"2{number[3..]}00000",
            ["statuscode"] = status, ["new_employeetype"] = 2, ["new_nationalityid"] = nationality.ToString(), ["new_totalsalary"] = 1500m,
            ["new_projectid"] = project?.ToString(), ["new_projectidname"] = project is null ? null : "مشروع الرياض",
        }, created: Created2025);

    private async Task<Guid> CreateCompanyAsync()
    {
        using var scope = database.Scope(system: true);
        var code = $"db-{Guid.NewGuid():N}"[..16];
        return (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(code, "شركة المؤشرات", "Dashboard Co", default)).Value.Id;
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
