using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workforce.Application;
using IntegratedErp.Modules.Workforce.Domain;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Workforce;

[Collection(DatabaseTestGroup.Name)]
public sealed class WorkerEditTests(TestDatabase database)
{
    [SkippableFact]
    public async Task A_worker_s_data_and_salary_are_edited_here_and_a_salary_change_is_applied_once_approved()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"we-{Guid.NewGuid():N}"[..16], "شركة التعديل", "Edit Co", default)).Value.Id;
        }

        var crm = new FakeCrm();
        var philippines = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        crm.Add(CrmEntities.Country, new() { ["new_name"] = "الهند", ["new_nameenglish"] = "India" });
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = "WORKER BSS0700", ["new_empidnumber"] = "BSS0700", ["new_idnumber"] = "2070000000", ["statuscode"] = 100000000, ["new_employeetype"] = 2,
            ["new_nationalityid"] = philippines.ToString(), ["new_basicsalary"] = 1500m, ["new_totalsalary"] = 1500m,
        }, created: new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        await SyncAsync(tenantId, crm);
        var approver = await UserAsync(tenantId, "اعتماد الرواتب", "workforce.workers.view", "workforce.salary_changes.approve");
        var hr = await UserAsync(tenantId, "شؤون العمالة", "workforce.workers.view", "workforce.workers.edit", "workforce.workers.salary_edit", "workforce.salary_changes.request");

        Guid workerId;
        using (var scope = database.Scope(tenantId, user: hr.ToString()))
        {
            var edits = scope.ServiceProvider.GetRequiredService<WorkerEditService>();
            var queries = scope.ServiceProvider.GetRequiredService<WorkerQueries>();
            workerId = (await queries.ListAsync(new WorkerFilter(WorkerKind.Worker, "BSS0700", null, null, false, 1, 50), true, default)).Items.Single().Id;
            var options = await edits.OptionsAsync(default);
            var india = options.Nationalities.Single(n => n.NameEn == "India").Code;
            var labour = options.Professions.Single().Code;

            // The data: names, iqama, nationality, profession, contract and leave.
            var input = new WorkerDataInput(
                "WORKER RENAMED", "عامل", "2070000099", new DateOnly(2027, 1, 31), india, new DateOnly(2025, 5, 1), labour, labour, "Care-Pro - 05", "وكيل",
                new DateOnly(2025, 6, 1), 24, null, 30, 10, 5, 0, 25);
            Assert.True((await edits.EditAsync(workerId, input, default)).IsSuccess);
            Assert.Equal("validation.workforce_unknown_code", (await edits.EditAsync(workerId, input with { NationalityCode = "nope" }, default)).Error.Code);
            Assert.Equal("validation.workforce_contract", (await edits.EditAsync(workerId, input with { ContractMonths = 0 }, default)).Error.Code);

            var file = await queries.GetAsync(workerId, WorkerKind.Worker, true, default);
            Assert.Equal(("WORKER RENAMED", "2070000099", "India"), (file!.Summary.Name, file.Summary.Iqama, file.Summary.NationalityEn));
            Assert.Equal((new DateOnly(2027, 5, 31), 25m), (file.Contract.EndsOn!.Value, file.Leave.Remaining!.Value));

            // The salary directly: the total is the sum of the parts; none below zero.
            Assert.True((await edits.SetSalaryAsync(workerId, new SalaryInput(1600, 300, 200, 100, 0, 0, 0, 0), default)).IsSuccess);
            Assert.Equal("validation.workforce_salary", (await edits.SetSalaryAsync(workerId, new SalaryInput(-1, 0, 0, 0, 0, 0, 0, 0), default)).Error.Code);
            Assert.Equal(2200m, (await queries.GetAsync(workerId, WorkerKind.Worker, true, default))!.Summary.Salary!.Total);

            // A salary change goes to approval; a second one waits for it.
            var change = new SalaryChangeInput(new SalaryInput(1800, 300, 200, 100, 0, 0, 0, 0), new DateOnly(2026, 11, 1), "تقييم سنوي");
            var requested = await edits.RequestSalaryChangeAsync(workerId, change, default);
            Assert.True(requested.IsSuccess, requested.IsFailure ? requested.Error.Code : null);
            Assert.Equal("validation.workforce_salary_change_open", (await edits.RequestSalaryChangeAsync(workerId, change, default)).Error.Code);
            var pending = await edits.ChangeAsync(requested.Value, default);
            Assert.Equal(("InApproval", 2200m, 2400m), (pending!.Status, pending.OldSalary.Total, pending.NewSalary.Total));
            Assert.Equal(2200m, (await queries.GetAsync(workerId, WorkerKind.Worker, true, default))!.Summary.Salary!.Total);
        }

        await ApproveAsync(tenantId, approver);

        using (var scope = database.Scope(tenantId, user: "hr"))
        {
            var change = (await scope.ServiceProvider.GetRequiredService<WorkerEditService>().ChangesAsync(workerId, default)).Single();
            Assert.Equal("Applied", change.Status);
            Assert.Equal(2400m, (await scope.ServiceProvider.GetRequiredService<WorkerQueries>().GetAsync(workerId, WorkerKind.Worker, true, default))!.Summary.Salary!.Total);
        }
    }

    private async Task ApproveAsync(Guid tenantId, Guid approver)
    {
        using var scope = database.Scope(tenantId, user: approver.ToString());
        var workflow = scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Infrastructure.WorkflowDbContext>();
        var tasks = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(
            System.Linq.Queryable.Where(workflow.WorkItems, w => w.AssigneeUserId == approver && w.Status == IntegratedErp.Modules.Workflow.Domain.WorkItemStatus.Pending));
        Assert.Single(tasks);
        Assert.True((await scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Application.ApprovalEngine>().DecideAsync(tasks[0].Id, IntegratedErp.Modules.Workflow.Application.Decision.Approve, "معتمد", null, default)).IsSuccess);
    }

    private async Task<Guid> UserAsync(Guid tenantId, string name, params string[] permissions)
    {
        using var scope = database.Scope(tenantId, user: "setup");
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<PermissionCatalog>();
        var user = UserAccount.Create(name, null);
        identity.Users.Add(user);
        var membership = new Membership(user.Id, tenantId);
        identity.Memberships.Add(membership);
        var role = Role.Create($"r-{Guid.NewGuid():N}"[..20], "role", "role", permissions, catalog).Value;
        identity.Roles.Add(role);
        identity.RoleAssignments.Add(new RoleAssignment(membership.Id, role.Id, null, tenantId));
        await identity.SaveChangesAsync();
        return user.Id;
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
