using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Reports.Application;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Reports;

[Collection(DatabaseTestGroup.Name)]
public sealed class MovementReportTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task The_movement_counts_the_starts_the_new_workers_and_who_waits_in_housing()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"mv-{Guid.NewGuid():N}"[..16], "شركة الحركة", "Movement Co", default)).Value.Id;
        }

        var crm = new FakeCrm();
        var country = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var project = Guid.NewGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
        var month = new DateOnly(today.Year, today.Month, 1);
        Guid Worker(string number, int status, Guid? onProject, string projectName = "مشروع الرياض", bool arrived = true) => crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {number}", ["new_empidnumber"] = number, ["new_idnumber"] = $"2{number[3..]}00000",
            ["statuscode"] = status, ["new_employeetype"] = 2, ["new_nationalityid"] = country.ToString(), ["new_totalsalary"] = 1500m,
            ["new_projectid"] = onProject?.ToString(), ["new_projectidname"] = onProject is null ? null : projectName,
            ["new_dateofjoining"] = arrived ? $"{month:yyyy-MM-dd}T09:00:00Z" : null,
        }, created: Created2025);

        // Two new workers delivered to the project this month, and one still in housing.
        for (var i = 0; i < 2; i++)
        {
            var worker = Worker($"BSS06{i:00}", 100000000, project);
            crm.Add("new_empwork", new()
            {
                ["new_employeeid"] = worker.ToString(), ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الرياض",
                ["new_startdate"] = $"{month:yyyy-MM-dd}T09:00:00Z", ["new_serviceprice"] = 3000m, ["statecode"] = 0, ["new_number"] = $"SW06{i:00}",
            }, created: Created2025);
        }

        Worker("BSS0610", 279640001, null);

        // A worker who started this month and was parked on the inactive workers' project afterwards: the start counts.
        var inactiveProject = Guid.NewGuid();
        var parked = Worker("BSS0620", 100000000, inactiveProject, "InActive Employee", arrived: false);
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = parked.ToString(), ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الرياض",
            ["new_startdate"] = $"{month:yyyy-MM-dd}T09:00:00Z", ["new_enddate"] = $"{month.AddDays(1):yyyy-MM-dd}T09:00:00Z", ["new_serviceprice"] = 3000m, ["statecode"] = 1, ["new_number"] = "SW0620",
        }, created: Created2025);
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = parked.ToString(), ["new_projectid"] = inactiveProject.ToString(), ["new_projectidname"] = "InActive Employee",
            ["new_startdate"] = $"{month.AddDays(1):yyyy-MM-dd}T09:00:00Z", ["new_serviceprice"] = 0m, ["statecode"] = 0, ["new_number"] = "SW0621",
        }, created: Created2025);
        using (var scope = database.Scope(tenantId, user: "crm-sync"))
        {
            var db = scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>();
            var sync = ActivatorUtilities.CreateInstance<CrmSyncService>(scope.ServiceProvider, (ICrmSource)crm, Options.Create(new CrmSyncOptions()));
            db.Runs.Add(new SyncRun(SyncMode.Incremental, "test", DateTimeOffset.UtcNow));
            await db.SaveChangesAsync();
            Assert.True(await sync.RunNextAsync(scope.ServiceProvider.GetRequiredService<ReferenceImportService>(), scope.ServiceProvider.GetServices<ICrmStagingConsumer>().ToList(), default));
        }

        using (var scope = database.Scope(tenantId, user: "manager"))
        {
            var report = scope.ServiceProvider.GetRequiredService<MovementReport>();
            var movement = await report.OverviewAsync(month, month.AddMonths(1).AddDays(-1), default);
            Assert.Equal((3m, 0m, 3m), (movement.Starts.Value!.Value, movement.Returns.Value!.Value, movement.Net.Value!.Value));
            Assert.Equal((3m, 2), (movement.Arrivals.Value!.Value, movement.ArrivalsDelivered));
            Assert.Equal(3, movement.NewWorkersTotal);
            Assert.Equal(("مشروع الرياض", 3), (movement.StartsByProject.Single().Name, movement.StartsByProject.Single().Count));
            Assert.Null(movement.AverageStint.Value);
            Assert.Equal(1, movement.Waiting);

            var waiting = await report.ArrivalsAsync(month, month.AddMonths(1).AddDays(-1), null, delivered: false, default);
            Assert.Equal("BSS0610", Assert.Single(waiting).WorkerNo);
            Assert.Equal("BSS0610", Assert.Single(await report.WaitingAsync(default)).WorkerNo);
        }
    }
}
