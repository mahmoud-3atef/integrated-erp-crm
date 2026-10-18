using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Documents.Infrastructure;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Operations.Application;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workflow.Application;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Workflow;

[Collection(DatabaseTestGroup.Name)]
public sealed class AlertTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task The_alerts_center_shows_each_user_their_alerts_and_the_morning_digest_tells_new_ones_once()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
        var crm = new FakeCrm();
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var riyadh = crm.Add("new_project", new() { ["new_name"] = "مشروع الرياض", ["new_code"] = "pro00900", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: Created2025);
        var away = Worker(crm, "BSS0501", 100000000, riyadh, null);
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = away.ToString(), ["new_projectid"] = riyadh.ToString(), ["new_projectidname"] = "مشروع الرياض",
            ["new_startdate"] = "2026-08-01T09:00:00Z", ["new_serviceprice"] = 3000m, ["statecode"] = 0, ["new_number"] = "SW-0501",
        }, created: Created2025);
        Worker(crm, "BSS0502", 279640001, null, today.AddDays(20)); // in housing, iqama expiring
        Worker(crm, "BSS0503", 279640001, null, today.AddDays(-3)); // in housing, iqama expired
        await SyncAsync(tenantId, crm);

        var (coordinator, manager, outsider) = await PeopleAsync(tenantId);

        // The worker left on vacation 20 days ago and was expected back 10 days ago.
        using (var scope = database.Scope(tenantId, user: coordinator.ToString()))
        {
            var workerId = (await scope.ServiceProvider.GetRequiredService<IWorkforceDirectory>().SearchAsync("BSS0501", 5, default)).Single().Id;
            var saved = await scope.ServiceProvider.GetRequiredService<MovementService>().CreateAsync(
                new MovementInput("VacationDeparture", workerId, today.AddDays(-20), today.AddDays(-10), "Regular", null, null, null, null, false, null, null, null, "سُجّلت متأخرة", null), default);
            Assert.True(saved.IsSuccess, saved.IsFailure ? saved.Error.Code : null);
        }

        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var workflow = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
            var task = await workflow.WorkItems.SingleAsync(w => w.AssigneeUserId == manager && w.Status == WorkItemStatus.Pending);
            Assert.True((await scope.ServiceProvider.GetRequiredService<ApprovalEngine>().DecideAsync(task.Id, Decision.Approve, null, null, default)).IsSuccess);

            // Last month's timesheet is due from the first of this month (so the test does not depend on the day).
            Assert.True((await scope.ServiceProvider.GetRequiredService<AlertCenter>().SaveSettingAsync("billing.no_timesheet", new AlertSettingInput(true, 0), default)).IsSuccess);
        }

        using (var scope = database.Scope(tenantId, user: coordinator.ToString()))
        {
            var center = scope.ServiceProvider.GetRequiredService<AlertCenter>();
            var list = await center.ListAsync(null, default);
            var vacation = list.Items.Single(a => a.Code == "operations.vacation_overdue");
            Assert.Equal(("Warning", 10), (vacation.Severity, vacation.Days));
            Assert.Contains("BSS0501", vacation.TitleAr, StringComparison.Ordinal);
            var iqamas = list.Items.Where(a => a.Code == "workforce.iqama_expiring").OrderBy(a => a.Since).ToList();
            Assert.Equal(["Critical", "Info"], iqamas.Select(a => a.Severity));
            Assert.Contains(list.Items, a => a.Code == "billing.no_timesheet" && a.TitleAr.StartsWith("مشروع الرياض", StringComparison.Ordinal));
            Assert.Equal(1, list.Counts.Critical);

            // Hidden for a week: out of the list (and counted as hidden), until shown again.
            Assert.True((await center.DismissAsync(new DismissInput(vacation.Code, vacation.Key, 7), default)).IsSuccess);
            var after = await center.ListAsync(null, default);
            Assert.DoesNotContain(after.Items, a => a.Code == "operations.vacation_overdue");
            Assert.Equal(1, after.Counts.Hidden);
            Assert.True((await center.RestoreAsync(default)).IsSuccess);
            Assert.Contains((await center.ListAsync(null, default)).Items, a => a.Code == "operations.vacation_overdue");
        }

        // Someone without the permissions sees none of them.
        using (var scope = database.Scope(tenantId, user: outsider.ToString()))
        {
            Assert.Empty((await scope.ServiceProvider.GetRequiredService<AlertCenter>().ListAsync(null, default)).Items);
        }

        // The morning digest tells the new alerts to the people responsible, once.
        using (var scope = database.Scope(tenantId, user: "alerts"))
        {
            var center = scope.ServiceProvider.GetRequiredService<AlertCenter>();
            Assert.Equal(4, await center.DigestAsync(force: false, default));
            Assert.Equal(0, await center.DigestAsync(force: false, default)); // already ran today
            Assert.Equal(0, await center.DigestAsync(force: true, default)); // nothing new
        }

        using (var scope = database.Scope(tenantId, user: coordinator.ToString()))
        {
            var kinds = await scope.ServiceProvider.GetRequiredService<DocumentsDbContext>().Notifications.Where(n => n.RecipientUserId == coordinator).Select(n => n.Kind).ToListAsync();
            Assert.Contains("alerts.operations.vacation_overdue", kinds);
            Assert.Contains("alerts.workforce.iqama_expiring", kinds);

            // An alert turned off is gone.
            var center = scope.ServiceProvider.GetRequiredService<AlertCenter>();
            Assert.True((await center.SaveSettingAsync("workforce.iqama_expiring", new AlertSettingInput(false, 60), default)).IsSuccess);
            Assert.DoesNotContain((await center.ListAsync(null, default)).Items, a => a.Code == "workforce.iqama_expiring");
        }
    }

    private async Task<(Guid Coordinator, Guid Manager, Guid Outsider)> PeopleAsync(Guid tenantId)
    {
        using var scope = database.Scope(tenantId, user: "setup");
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<PermissionCatalog>();
        async Task<Guid> PersonAsync(string name, params string[] permissions)
        {
            var user = UserAccount.Create(name, null);
            identity.Users.Add(user);
            var membership = new Membership(user.Id, tenantId);
            identity.Memberships.Add(membership);
            var role = Role.Create($"r-{Guid.NewGuid():N}"[..20], name, name, permissions, catalog).Value;
            identity.Roles.Add(role);
            identity.RoleAssignments.Add(new RoleAssignment(membership.Id, role.Id, null, tenantId));
            await identity.SaveChangesAsync();
            return user.Id;
        }

        return (
            await PersonAsync("منسق العمليات", "operations.movements.view", "operations.movements.manage", "workforce.workers.view", "billing.timesheets.view", "billing.timesheets.manage", "workflow.alerts.manage"),
            await PersonAsync("مدير العمليات", "operations.movements.view", "operations.movements.approve", "workflow.alerts.manage"),
            await PersonAsync("موظف آخر", "workflow.requests.create"));
    }

    private static Guid Worker(FakeCrm crm, string number, int status, Guid? project, DateOnly? iqamaExpires) =>
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {number}", ["new_empidnumber"] = number, ["new_idnumber"] = $"2{number[3..]}00000",
            ["new_expirydateg"] = iqamaExpires is { } e ? $"{e:yyyy-MM-dd}T09:00:00Z" : null,
            ["statuscode"] = status, ["new_employeetype"] = 2, ["new_projectid"] = project?.ToString(), ["new_projectidname"] = project is null ? null : "مشروع الرياض",
            ["new_projectjoingdate"] = project is null ? null : "2026-07-31T21:00:00Z", ["new_totalsalary"] = 1500m,
        }, created: Created2025);

    private async Task<Guid> CreateCompanyAsync()
    {
        using var scope = database.Scope(system: true);
        var code = $"al-{Guid.NewGuid():N}"[..16];
        return (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(code, "شركة التنبيهات", "Alerts Co", default)).Value.Id;
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
