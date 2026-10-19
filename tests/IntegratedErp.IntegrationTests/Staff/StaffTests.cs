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
            ["new_name"] = "SECOND STAFF", ["new_empidnumber"] = "HM00055", ["new_idnumber"] = "2570418464", ["statuscode"] = 100000000, ["new_employeetype"] = 1,
            ["new_totalsalary"] = 4000m, ["new_basicsalary"] = 3000m, ["new_housingallowance"] = 1000m,
        }, created: Created2025);
        crm.Add(CrmEntities.Employee, new() // a worker, not staff
        {
            ["new_name"] = "A WORKER", ["new_empidnumber"] = "BSS0999", ["new_idnumber"] = "2570418465", ["statuscode"] = 100000000, ["new_employeetype"] = 2, ["new_totalsalary"] = 1500m,
        }, created: Created2025);
        await SyncAsync(tenantId, crm);
        var hr = await HrAsync(tenantId);

        using var scope2 = database.Scope(tenantId, user: hr.ToString());
        var service = scope2.ServiceProvider.GetRequiredService<StaffService>();
        var structure = scope2.ServiceProvider.GetRequiredService<StructureService>();
        var queries = scope2.ServiceProvider.GetRequiredService<StaffQueries>();

        // The import: staff only, their old numbers, salary and contract dates; again changes nothing.
        Assert.Equal(new ImportResult(2, 0, 0), await service.ImportAsync(default));
        Assert.Equal(new ImportResult(0, 2, 0), await service.ImportAsync(default));
        var page = await queries.DirectoryAsync(new StaffQuery(null, null, null, null, null, false, 1, 25), default);
        Assert.Equal(["HM00054", "HM00055"], page.Items.Select(i => i.EmployeeNo));
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

        // A new hire gets the next staff number and starts on probation.
        var hired = await service.HireAsync(new HireInput("منى العتيبي", "Muna Alotaibi", new DateOnly(2026, 8, 1), 90, null, finance, null, new SalaryValues(6500, 1625, 0, 650, 200, 0, 525)), default);
        Assert.True(hired.IsSuccess, hired.IsFailure ? hired.Error.Code : null);
        profile = (await queries.ProfileAsync(hired.Value, default))!;
        Assert.Equal(("HO00001", "Probation", new DateOnly(2026, 10, 30), 9500m), (profile.EmployeeNo, profile.Status, profile.ProbationEndsOn!.Value, profile.Salary!.Total));
        var org = await queries.StructureAsync(default);
        Assert.Equal((0, 2), (org.Vacancies, org.Departments.Single().Employees));
    }

    private async Task<Guid> HrAsync(Guid tenantId)
    {
        using var scope = database.Scope(tenantId, user: "setup");
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<PermissionCatalog>();
        var user = UserAccount.Create("مسؤول الموارد البشرية", null);
        identity.Users.Add(user);
        var membership = new Membership(user.Id, tenantId);
        identity.Memberships.Add(membership);
        var role = Role.Create($"r-{Guid.NewGuid():N}"[..20], "hr", "hr", ["staff.view", "staff.manage", "staff.structure.manage", "staff.salaries.view", "staff.salaries.manage"], catalog).Value;
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
