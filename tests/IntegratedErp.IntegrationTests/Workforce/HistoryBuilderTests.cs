using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workforce.Application;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Workforce;

[Collection(DatabaseTestGroup.Name)]
public sealed class HistoryBuilderTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 1, 2, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task The_history_is_built_from_the_old_system_and_its_issues_are_listed()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var project = Guid.NewGuid();

        // A: in housing; a work start before 2025 (the seed), back to housing, a work start without a price (the
        // worker's default price is used) entered twice on the same day, then housing again.
        var a = Worker(crm, "BSS8001", 279640001, defaultPrice: 2800m);
        WorkStart(crm, a, project, "2024-05-01", 2500m);
        WorkStart(crm, a, project, "2024-10-01", 3000m);
        Housing(crm, a, "2025-03-10", isReturn: true);
        WorkStart(crm, a, project, "2025-04-01", null, created: new DateTime(2025, 3, 30, 0, 0, 0, DateTimeKind.Utc));
        WorkStart(crm, a, project, "2025-04-01", null, created: new DateTime(2025, 3, 31, 0, 0, 0, DateTimeKind.Utc));
        Housing(crm, a, "2025-08-01", isReturn: true);
        Housing(crm, a, "2025-09-15", isReturn: false, approved: false);

        // B: on the job in the old system, but the history ends in housing; the work start ended days before it, and
        // has no price at all.
        var b = Worker(crm, "BSS8002", 100000000);
        WorkStart(crm, b, project, "2025-02-01", null, endsOn: "2025-02-27");
        Housing(crm, b, "2025-03-05", isReturn: false);

        // C: on the job without any work start.
        Worker(crm, "BSS8003", 100000000);

        await SyncAsync(tenantId, crm);

        Guid aId;
        using (var scope = database.Scope(tenantId))
        {
            var db = scope.ServiceProvider.GetRequiredService<WorkforceDbContext>();
            aId = await db.Workers.Where(w => w.WorkerNo == "BSS8001").Select(w => w.Id).SingleAsync();
            var periods = await db.HistoryPeriods.Where(p => p.WorkerId == aId).OrderBy(p => p.StartsOn).ToListAsync();
            Assert.Equal(
                [
                    (PeriodKind.Work, new DateOnly(2024, 10, 1), (DateOnly?)new DateOnly(2025, 3, 10), 3000m),
                    (PeriodKind.Housing, new DateOnly(2025, 3, 10), new DateOnly(2025, 4, 1), 0m),
                    (PeriodKind.Work, new DateOnly(2025, 4, 1), new DateOnly(2025, 8, 1), 2800m),
                    (PeriodKind.Housing, new DateOnly(2025, 8, 1), null, 0m),
                ],
                periods.Select(p => (p.Kind, p.StartsOn, p.EndsOn, p.Rate.TotalPrice)));

            var queries = scope.ServiceProvider.GetRequiredService<HistoryQueries>();
            var all = await queries.IssuesAsync(null, null, null, 1, 50, default);
            Assert.Equal(
                new Dictionary<string, int>
                {
                    [HistoryIssues.SameDay] = 1, [HistoryIssues.Gap] = 1, [HistoryIssues.WorkWithoutPrice] = 1,
                    [HistoryIssues.StatusMismatch] = 1, [HistoryIssues.OnJobWithoutWorkStart] = 1,
                },
                all.Counts.OrderBy(c => c.Key).ToDictionary());
            Assert.Equal(3, all.Workers);
            Assert.Equal(["BSS8001"], (await queries.IssuesAsync(HistoryIssues.SameDay, null, null, 1, 50, default)).Items.Select(i => i.WorkerNo));
            Assert.Equal(3, (await queries.IssuesAsync(null, "BSS8002", null, 1, 50, default)).Total);
            Assert.Equal(new DateOnly(2025, 2, 28), (await queries.IssuesAsync(HistoryIssues.Gap, null, null, 1, 50, default)).Items.Single().On);
        }

        // A starts work in this system: the timeline shows the history up to that day, then the recorded period.
        using (var scope = database.Scope(tenantId))
        {
            var ledger = scope.ServiceProvider.GetRequiredService<IPeriodLedger>();
            var start = new WorkStartRequest(aId, Guid.NewGuid(), project, "مشروع", new DateOnly(2025, 10, 1), "delivery_order", Guid.NewGuid(), Guid.NewGuid(), "DO-1",
                null, null, 1500m, 1300m, 0m, false, 0m, false, 2800m, false);
            Assert.True((await ledger.StartWorkAsync([start], default)).IsSuccess);
        }

        using (var scope = database.Scope(tenantId))
        {
            var timeline = await scope.ServiceProvider.GetRequiredService<IPeriodLedger>().PeriodsAsync(aId, default);
            Assert.Equal(5, timeline.Count);
            Assert.False(timeline[0].FromOldSystem);
            Assert.Equal((new DateOnly(2025, 8, 1), (DateOnly?)new DateOnly(2025, 10, 1), true), (timeline[1].StartsOn, timeline[1].EndsOn, timeline[1].FromOldSystem));
        }
    }

    private static Guid Worker(FakeCrm crm, string no, int status, decimal? defaultPrice = null) =>
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {no}", ["new_empidnumber"] = no, ["new_idnumber"] = $"2{no[3..]}00000",
            ["statuscode"] = status, ["new_employeetype"] = 2, ["new_totalsalary"] = 1500m, ["new_totalservices"] = defaultPrice,
        }, created: Created2025);

    private static void WorkStart(FakeCrm crm, Guid worker, Guid project, string on, decimal? price, string? endsOn = null, DateTime? created = null) =>
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = worker.ToString(), ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الرياض",
            ["new_startdate"] = $"{on}T09:00:00Z", ["new_enddate"] = endsOn is null ? null : $"{endsOn}T09:00:00Z",
            ["new_serviceprice"] = price, ["statecode"] = 0, ["new_number"] = $"SW{Guid.NewGuid():N}"[..8],
        }, created: created ?? Created2025);

    private static void Housing(FakeCrm crm, Guid worker, string on, bool isReturn, bool approved = true) =>
        crm.Add("mw_lodginorderdetails", new()
        {
            ["mw_empid"] = worker.ToString(), ["mw_arrivedate"] = $"{on}T09:00:00Z", ["statuscode"] = approved ? 100000009 : 1,
            ["new_entertype"] = isReturn ? 100000001 : 100000000, ["mw_housingname"] = "سكن الرجال", ["mw_name"] = $"H{Guid.NewGuid():N}"[..8],
        }, created: Created2025);

    private async Task<Guid> CreateCompanyAsync()
    {
        using var scope = database.Scope(system: true);
        var code = $"hi-{Guid.NewGuid():N}"[..16];
        return (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(code, "شركة السجل", "History Co", default)).Value.Id;
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
