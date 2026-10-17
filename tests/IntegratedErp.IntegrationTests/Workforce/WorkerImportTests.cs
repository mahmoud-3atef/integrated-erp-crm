using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workforce.Application;
using IntegratedErp.Modules.Workforce.Domain;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Workforce;

[Collection(DatabaseTestGroup.Name)]
public sealed class WorkerImportTests(TestDatabase database)
{
    [SkippableFact]
    public async Task Workers_are_built_from_the_crm_copy_with_unique_identity_numbers_and_follow_merges()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var philippines = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        var labour = crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var worker = crm.Add(CrmEntities.Profession, new() { ["new_name"] = "worker", ["new_code"] = "worker" });
        var eron = crm.Add(CrmEntities.Employee, Employee("ERON CAPAORAN", "BSS000196", "2593574755", "P1074379B", philippines, worker, 100000000, 1700m, 2000m));
        crm.Add(CrmEntities.Employee, Employee("SAME PASSPORT", "BSS000197", "2593574756", "P1074379B", philippines, labour, 279640001, 1500m, 1500m));
        var staff = Employee("OFFICE CLERK", "EMP0001", "1012345678", null, philippines, labour, 100000000, 5000m, 6500m);
        staff["new_employeetype"] = 1;
        crm.Add(CrmEntities.Employee, staff);

        await SyncAndImportAsync(tenantId, crm, SyncMode.Full);

        using (var scope = database.Scope(tenantId))
        {
            var queries = scope.ServiceProvider.GetRequiredService<WorkerQueries>();
            var list = await queries.ListAsync(new WorkerFilter(WorkerKind.Worker, null, null, "name", false, 1, 50), withSalary: true, default);
            Assert.Equal(2, list.Total);
            Assert.Equal(1, list.Counts["Working"]);
            Assert.Equal(1, list.Counts["Housing"]);

            var row = list.Items.Single(i => i.WorkerNo == "BSS000196");
            Assert.Equal(("ERON CAPAORAN", "Working", "على رأس العمل", "الفلبين", "2593574755"), (row.Name, row.Placement, row.StatusAr, row.NationalityAr, row.Iqama));
            Assert.Equal(2000m, row.Salary!.Total);

            // Staff are a separate list, and a staff file does not open as a worker (nor the other way round).
            var staffList = await queries.ListAsync(new WorkerFilter(WorkerKind.Staff, null, null, null, false, 1, 50), withSalary: false, default);
            var clerk = staffList.Items.Single();
            Assert.Equal(("EMP0001", "Staff"), (clerk.WorkerNo, clerk.Kind));
            Assert.Null(await queries.GetAsync(clerk.Id, WorkerKind.Worker, false, default));
            Assert.NotNull(await queries.GetAsync(clerk.Id, WorkerKind.Staff, false, default));

            // The second worker's passport is already the first one's: kept, but not as a current number.
            var second = await queries.GetAsync(list.Items.Single(i => i.WorkerNo == "BSS000197").Id, WorkerKind.Worker, withSalary: false, default);
            var passport = second!.Identifiers.Single(i => i.Type == "Passport");
            Assert.False(passport.IsCurrent);
            Assert.Null(second.Summary.Salary);

            // Search by any identity number.
            Assert.Equal("BSS000196", (await queries.ListAsync(new WorkerFilter(WorkerKind.Worker, "p1074379b", null, null, false, 1, 50), false, default)).Items.Single(i => i.Iqama == "2593574755").WorkerNo);
            Assert.Equal(1, (await queries.ListAsync(new WorkerFilter(WorkerKind.Worker, null, "Working", null, false, 1, 50), false, default)).Total);
        }

        // "worker" merged into "عامل" on the sync screen: the next import follows it without any CRM change.
        using (var scope = database.Scope(tenantId))
        {
            Assert.True((await scope.ServiceProvider.GetRequiredService<ReferenceImportService>().MergeAsync(ReferenceListCodes.Professions, "WORKER", "6132115", default)).IsSuccess);
        }

        using (var scope = database.Scope(tenantId))
        {
            var summary = await scope.ServiceProvider.GetRequiredService<WorkerImportService>().ApplyAsync(default);
            Assert.Contains("1 nationalities or professions updated", summary, StringComparison.Ordinal);
            var detail = await scope.ServiceProvider.GetRequiredService<WorkerQueries>().ListAsync(new WorkerFilter(WorkerKind.Worker, "BSS000196", null, null, false, 1, 50), false, default);
            Assert.Equal("عامل", detail.Items.Single().ProfessionAr);
        }

        // A change in the CRM reaches the worker file on the next sync.
        crm.Touch(eron, "statuscode", 100000001);
        await SyncAndImportAsync(tenantId, crm, SyncMode.Incremental);
        using (var scope = database.Scope(tenantId))
        {
            var row = (await scope.ServiceProvider.GetRequiredService<WorkerQueries>().ListAsync(new WorkerFilter(WorkerKind.Worker, "BSS000196", null, null, false, 1, 50), false, default)).Items.Single();
            Assert.Equal(("Vacation", "إجازة"), (row.Placement, row.StatusAr));
        }
    }

    private static Dictionary<string, object?> Employee(string name, string no, string iqama, string? passport, Guid nationality, Guid profession, int status, decimal basic, decimal total) => new()
    {
        ["new_name"] = name,
        ["new_empidnumber"] = no,
        ["new_idnumber"] = iqama,
        ["new_passportnumber"] = passport,
        ["new_nationalityid"] = nationality.ToString(),
        ["new_professionid"] = profession.ToString(),
        ["statuscode"] = status,
        ["new_employeetype"] = 2,
        ["new_basicsalary"] = basic,
        ["new_totalsalary"] = total,
        ["new_projectidname"] = "مشروع الاختبار",
        ["new_projectjoingdate"] = "2026-10-07T21:00:00Z",
        ["new_sponseredby"] = 100000008,
    };

    private async Task<Guid> CreateCompanyAsync()
    {
        using var scope = database.Scope(system: true);
        var code = $"wf-{Guid.NewGuid():N}"[..16];
        return (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(code, "شركة العمالة", "Workforce Co", default)).Value.Id;
    }

    /// <summary>Same as the worker does after a sync: copy, then reference lists, then the modules built from the copy.</summary>
    private async Task SyncAndImportAsync(Guid tenantId, FakeCrm crm, SyncMode mode)
    {
        using var scope = database.Scope(tenantId, user: "crm-sync");
        var db = scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>();
        var sync = ActivatorUtilities.CreateInstance<CrmSyncService>(scope.ServiceProvider, (ICrmSource)crm, Options.Create(new CrmSyncOptions()));
        db.Runs.Add(new SyncRun(mode, "test", DateTimeOffset.UtcNow));
        await db.SaveChangesAsync();
        var consumers = scope.ServiceProvider.GetServices<IntegratedErp.Modules.CrmSync.Contracts.ICrmStagingConsumer>().ToList();
        Assert.True(await sync.RunNextAsync(scope.ServiceProvider.GetRequiredService<ReferenceImportService>(), consumers, default));
    }
}
