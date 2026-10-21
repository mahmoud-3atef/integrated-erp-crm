using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Organization.Application.Settings;
using IntegratedErp.Modules.Staff.Application;
using IntegratedErp.Modules.Staff.Domain;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Staff;

[Collection(DatabaseTestGroup.Name)]
public sealed class StaffTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task The_old_systems_staff_become_employee_files_HR_places_in_the_organisation_and_their_salary_changes_keep_the_history()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"st-{Guid.NewGuid():N}"[..16], "شركة الموظفين", "Staff Co", default)).Value.Id;
        }

        var crm = new FakeCrm();
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = "MANZOOR AHMAD MALIK", ["new_empidnumber"] = "HM00054", ["new_idnumber"] = "2570418463", ["statuscode"] = 100000000, ["new_employeetype"] = 1,
            ["new_totalsalary"] = 2593m, ["new_basicsalary"] = 2593m, ["new_contractstartdate"] = "2024-01-01T00:00:00Z", ["new_pirodcontract"] = 24,
            ["new_annualleave"] = 21m, ["new_vacationbalance"] = 21m, ["new_consumedblalnce"] = 6m,
        }, created: Created2025);
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = "SECOND STAFF", ["new_empidnumber"] = "HO00001", ["new_idnumber"] = "2570418464", ["statuscode"] = 100000000, ["new_employeetype"] = 1,
            ["new_totalsalary"] = 4000m, ["new_basicsalary"] = 3000m, ["new_housingallowance"] = 1000m,
        }, created: Created2025);
        crm.Add(CrmEntities.Employee, new() // a worker, not staff
        {
            ["new_name"] = "A WORKER", ["new_empidnumber"] = "BSS0999", ["new_idnumber"] = "2570418465", ["statuscode"] = 100000000, ["new_employeetype"] = 2, ["new_totalsalary"] = 1500m,
        }, created: Created2025);
        await SyncAsync(tenantId, crm);
        var hr = await HrAsync(tenantId, "مسؤول الموارد البشرية", "staff.view", "staff.manage", "staff.structure.manage", "staff.salaries.view", "staff.salaries.manage",
            "staff.actions.renew_contract.amend", "staff.actions.renew_contract.cancel_approved", "staff.actions.promotion.cancel_approved");
        var approver = await HrAsync(tenantId, "المعتمد", "staff.view", "staff.actions.review", "staff.actions.approve");

        using var scope2 = database.Scope(tenantId, user: hr.ToString());
        var service = scope2.ServiceProvider.GetRequiredService<StaffService>();
        var structure = scope2.ServiceProvider.GetRequiredService<StructureService>();
        var queries = scope2.ServiceProvider.GetRequiredService<StaffQueries>();

        // The import: staff only, their old numbers, salary and contract dates; again changes nothing.
        Assert.Equal(new ImportResult(2, 0, 0), await service.ImportAsync(default));
        Assert.Equal(new ImportResult(0, 2, 0), await service.ImportAsync(default));
        var page = await queries.DirectoryAsync(new StaffQuery(null, null, null, null, null, false, 1, 25), default);
        Assert.Equal(["HM00054", "HO00001"], page.Items.Select(i => i.EmployeeNo));
        var manzoor = page.Items[0].Id;
        var profile = (await queries.ProfileAsync(manzoor, default))!;
        Assert.Equal((2593m, "OldSystem", new DateOnly(2025, 12, 31)), (profile.Salary!.Total, profile.Salary.Source, profile.ContractEndsOn!.Value));
        Assert.Contains("department", profile.Missing);
        var kpis = await queries.KpisAsync(default);
        Assert.Equal((2, 2), (kpis.Employees, kpis.Incomplete));

        // HR builds the organisation and places the employee: the department's manager is his direct manager.
        var finance = (await structure.SaveDepartmentAsync(null, new DepartmentInput("المالية", "Finance", null, "CC-200", null, 1), default)).Value;
        var accountant = (await structure.SaveJobTitleAsync(null, new JobTitleInput("محاسب", "Accountant", null), default)).Value;
        var g5 = (await structure.SaveGradeAsync(null, new GradeInput("5", "الدرجة الخامسة", 2000, 6000), default)).Value;
        var seat = (await structure.SavePositionAsync(null, new PositionInput(finance, accountant, g5, null, 1), default)).Value;
        var second = page.Items[1].Id;
        Assert.True((await structure.SaveDepartmentAsync(finance, new DepartmentInput("المالية", "Finance", null, "CC-200", second, 1), default)).IsSuccess);
        Assert.Equal("validation.staff_parent_loop", (await structure.SaveDepartmentAsync(finance, new DepartmentInput("المالية", "Finance", finance, null, null, 1), default)).Error.Code);

        Assert.True((await service.SetJobAsync(manzoor, new JobInput(null, finance, seat, new DateOnly(2024, 1, 1), null, "Active"), default)).IsSuccess);
        Assert.Equal("conflict.staff_position_full", (await service.SetJobAsync(second, new JobInput(null, finance, seat, null, null, "Active"), default)).Error.Code);
        profile = (await queries.ProfileAsync(manzoor, default))!;
        Assert.Equal(("المالية", "محاسب", "SECOND STAFF"), (profile.Department!.NameAr, profile.JobTitle!.NameAr, profile.Manager!.NameAr));
        Assert.Equal("conflict.staff_in_use", (await structure.DeletePositionAsync(seat, default)).Error.Code);

        // A salary change from a later date needs a reason; the old system's salary stays as history and the import no longer follows it.
        var raise = new SalaryValues(3000, 750, 0, 300, 0, 0, 0);
        Assert.Equal("validation.staff_reason", (await service.ChangeSalaryAsync(manzoor, new SalaryChangeInput(new DateOnly(2026, 10, 1), raise, " "), default)).Error.Code);
        Assert.Equal("validation.staff_salary_date", (await service.ChangeSalaryAsync(manzoor, new SalaryChangeInput(new DateOnly(2020, 1, 1), raise, "زيادة"), default)).Error.Code);
        Assert.True((await service.ChangeSalaryAsync(manzoor, new SalaryChangeInput(new DateOnly(2026, 10, 1), raise, "زيادة سنوية"), default)).IsSuccess);
        await service.ImportAsync(default);
        profile = (await queries.ProfileAsync(manzoor, default))!;
        Assert.Equal((4050m, "Change", 1), (profile.Salary!.Total, profile.Salary.Source, profile.SalaryChanges));
        Assert.Contains((await queries.HistoryAsync(manzoor, default))!, h => h.Kind == "Salary" && h.Salary!.Reason == "زيادة سنوية");

        // A new hire gets the next staff number not held by an old file, and starts on probation.
        var hired = await service.HireAsync(new HireInput("منى العتيبي", "Muna Alotaibi", new DateOnly(2026, 8, 1), 90, null, finance, null, new SalaryValues(6500, 1625, 0, 650, 200, 0, 525)), default);
        Assert.True(hired.IsSuccess, hired.IsFailure ? hired.Error.Code : null);
        profile = (await queries.ProfileAsync(hired.Value, default))!;
        Assert.Equal(("HO00002", "Probation", new DateOnly(2026, 10, 30), 9500m), (profile.EmployeeNo, profile.Status, profile.ProbationEndsOn!.Value, profile.Salary!.Total));
        var org = await queries.StructureAsync(default);
        Assert.Equal((0, 2), (org.Vacancies, org.Departments.Single().Employees));

        // Employment actions go through HR then management, and change the file only when approved.
        var actions = scope2.ServiceProvider.GetRequiredService<StaffActionService>();
        var actionQueries = scope2.ServiceProvider.GetRequiredService<StaffActionQueries>();
        var senior = (await structure.SaveJobTitleAsync(null, new JobTitleInput("محاسب أول", "Senior accountant", null), default)).Value;
        var seniorSeat = (await structure.SavePositionAsync(null, new PositionInput(finance, senior, g5, null, 1), default)).Value;
        var promotion = await actions.RequestAsync(manzoor, new ActionInput("Promotion", new DateOnly(2026, 11, 1), "ترقية سنوية", null, null, seniorSeat,
            new SalaryValues(3500, 875, 0, 350, 0, 0, 0), null, null, null, null, null, null), default);
        Assert.True(promotion.IsSuccess, promotion.IsFailure ? promotion.Error.Code : null);
        Assert.Equal("conflict.staff_action_open", (await actions.RequestAsync(manzoor, new ActionInput("SalaryChange", new DateOnly(2026, 12, 1), "زيادة", null, null, null, raise, null, null, null, null, null, null), default)).Error.Code);
        Assert.Equal("محاسب", (await queries.ProfileAsync(manzoor, default))!.JobTitle!.NameAr);
        await ApproveAsync(tenantId, approver);
        await ApproveAsync(tenantId, approver);
        var applied = (await actionQueries.GetAsync(promotion.Value, default))!;
        Assert.Equal(("Applied", "محاسب", "محاسب أول", 4050m, 4725m), (applied.Status, applied.Before.JobTitle!.NameAr, applied.After.JobTitle!.NameAr, applied.OldSalaryTotal, applied.NewSalaryTotal));
        profile = (await queries.ProfileAsync(manzoor, default))!;
        Assert.Equal("محاسب أول", profile.JobTitle!.NameAr);

        // The probation of the new hire is confirmed; the old contract is renewed for 12 months from the day after it ends.
        var confirm = (await actions.RequestAsync(hired.Value, new ActionInput("ConfirmProbation", new DateOnly(2026, 10, 30), "أداء جيد", null, null, null, null, null, null, null, null, null, null), default)).Value;
        await ApproveAsync(tenantId, approver);
        await ApproveAsync(tenantId, approver);
        Assert.Equal("Active", (await queries.ProfileAsync(hired.Value, default))!.Status);
        Assert.True((await service.SetContractAsync(second, new ContractInput(new DateOnly(2025, 1, 1), 24, null), default)).IsSuccess);
        var renew = (await actions.RequestAsync(second, new ActionInput("RenewContract", new DateOnly(2026, 12, 31), "تجديد", null, null, null, null, null, null, null, "Fixed", 12, null), default)).Value;
        await ApproveAsync(tenantId, approver);
        await ApproveAsync(tenantId, approver);
        var contracts = await actionQueries.ContractsAsync(second, default);
        Assert.Equal([("Active", new DateOnly(2027, 1, 1), (DateOnly?)new DateOnly(2027, 12, 31)), ("Renewed", new DateOnly(2025, 1, 1), new DateOnly(2026, 12, 31))],
            contracts.Select(c => (c.Status, c.StartsOn, c.EndsOn)));
        Assert.Equal(new DateOnly(2027, 12, 31), (await queries.ProfileAsync(second, default))!.ContractEndsOn);
        Assert.Equal(["ConfirmProbation", "Promotion", "RenewContract"], (await actionQueries.ListAsync(null, "Applied", default)).Select(a => a.Kind).Order());

        // A fresh scope: the one above still holds the actions as they were before their approval.
        using var scope3 = database.Scope(tenantId, user: hr.ToString());
        actions = scope3.ServiceProvider.GetRequiredService<StaffActionService>();
        actionQueries = scope3.ServiceProvider.GetRequiredService<StaffActionQueries>();
        queries = scope3.ServiceProvider.GetRequiredService<StaffQueries>();

        // Each kind has its own permissions: HR may not cancel a confirmation.
        Assert.Equal("forbidden.staff_action_kind", (await actions.CancelApprovedAsync(confirm, "خطأ", default)).Error.Code);

        // The renewal changed after its approval (six months, not twelve): taken back and applied again.
        var change = new ActionAmendInput(new DateOnly(2026, 12, 31), null, null, null, null, 6, null, " ");
        Assert.Equal("validation.staff_action_amend_reason", (await actions.AmendAsync(renew, change, default)).Error.Code);
        Assert.True((await actions.AmendAsync(renew, change with { AmendReason = "اتفاق على ستة أشهر" }, default)).IsSuccess);
        contracts = await actionQueries.ContractsAsync(second, default);
        Assert.Equal([("Active", new DateOnly(2027, 1, 1), (DateOnly?)new DateOnly(2027, 6, 30)), ("Renewed", new DateOnly(2025, 1, 1), new DateOnly(2026, 12, 31))],
            contracts.Select(c => (c.Status, c.StartsOn, c.EndsOn)));

        // Then cancelled: the old contract is active again and the file ends where it did.
        Assert.True((await actions.CancelApprovedAsync(renew, "لم يُوقَّع العقد", default)).IsSuccess);
        Assert.Equal([("Active", new DateOnly(2025, 1, 1), (DateOnly?)new DateOnly(2026, 12, 31))], (await actionQueries.ContractsAsync(second, default)).Select(c => (c.Status, c.StartsOn, c.EndsOn)));
        Assert.Equal(new DateOnly(2026, 12, 31), (await queries.ProfileAsync(second, default))!.ContractEndsOn);

        // The promotion cancelled: the job and the salary are back as before it.
        Assert.True((await actions.CancelApprovedAsync(promotion.Value, "أُلغيت الترقية", default)).IsSuccess);
        profile = (await queries.ProfileAsync(manzoor, default))!;
        Assert.Equal(("محاسب", 4050m), (profile.JobTitle!.NameAr, profile.Salary!.Total));
        Assert.Equal("Cancelled", (await actionQueries.GetAsync(promotion.Value, default))!.Status);
    }

    /// <summary>The HR user (who holds both review and approve here) takes their open task and approves it.</summary>
    private async Task ApproveAsync(Guid tenantId, Guid approver)
    {
        using var scope = database.Scope(tenantId, user: approver.ToString());
        var workflow = scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Infrastructure.WorkflowDbContext>();
        var task = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.SingleAsync(workflow.WorkItems, w => w.AssigneeUserId == approver && w.Status == IntegratedErp.Modules.Workflow.Domain.WorkItemStatus.Pending);
        Assert.True((await scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Application.ApprovalEngine>().DecideAsync(task.Id, IntegratedErp.Modules.Workflow.Application.Decision.Approve, "معتمد", null, default)).IsSuccess);
    }

    private async Task<Guid> HrAsync(Guid tenantId, string name, params string[] permissions)
    {
        using var scope = database.Scope(tenantId, user: "setup");
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<PermissionCatalog>();
        var user = UserAccount.Create(name, null);
        identity.Users.Add(user);
        var membership = new Membership(user.Id, tenantId);
        identity.Memberships.Add(membership);
        var role = Role.Create($"r-{Guid.NewGuid():N}"[..20], "hr", "hr", permissions, catalog).Value;
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
