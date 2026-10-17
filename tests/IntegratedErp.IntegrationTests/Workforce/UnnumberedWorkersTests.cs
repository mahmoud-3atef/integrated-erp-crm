using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Workforce;

[Collection(DatabaseTestGroup.Name)]
public sealed class UnnumberedWorkersTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task A_worker_without_a_worker_number_in_the_old_system_is_never_brought_over()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"un-{Guid.NewGuid():N}"[..16], "بلا رقم", "Unnumbered", default)).Value.Id;
        }

        var crm = new FakeCrm();
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        Worker(crm, "BSS0601");
        Worker(crm, null);
        Worker(crm, "  ");
        var later = Worker(crm, "BSS0602");
        await SyncAsync(tenantId, crm);
        Assert.Equal(["BSS0601", "BSS0602"], await NumbersAsync(tenantId));

        // The old system clears a worker's number: the worker goes with the next sync.
        crm.Touch(later, "new_empidnumber", null);
        await SyncAsync(tenantId, crm);
        Assert.Equal(["BSS0601"], await NumbersAsync(tenantId));
    }

    private async Task<List<string>> NumbersAsync(Guid tenantId)
    {
        using var scope = database.Scope(tenantId);
        return await scope.ServiceProvider.GetRequiredService<WorkforceDbContext>().Workers.Select(w => w.WorkerNo).OrderBy(n => n).ToListAsync();
    }

    private static Guid Worker(FakeCrm crm, string? number) =>
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {number ?? Guid.NewGuid().ToString("N")[..4]}", ["new_empidnumber"] = number, ["statuscode"] = 1, ["new_employeetype"] = 2, ["new_totalsalary"] = 1500m,
        }, created: Created2025);

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
