using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Leave.Application;
using IntegratedErp.Modules.Leave.Contracts;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Staff.Application;
using IntegratedErp.Modules.Staff.Domain;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Leave;

[Collection(DatabaseTestGroup.Name)]
public sealed class LeaveTests(TestDatabase database)
{
    [SkippableFact]
    public async Task A_leave_goes_to_the_direct_manager_then_HR_consumes_the_balance_and_the_attendance_counts_it_as_leave()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"lv-{Guid.NewGuid():N}"[..16], "شركة الإجازات", "Leave Co", default)).Value.Id;
        }

        var hr = await UserAsync(tenantId, "مسؤول الموارد البشرية", "staff.view", "staff.manage", "staff.structure.manage", "leave.view", "leave.manage", "leave.settings", "attendance.view");
        var approver = await UserAsync(tenantId, "اعتماد الموارد البشرية", "leave.view", "leave.approve");
        var managerUser = await UserAsync(tenantId, "المدير المباشر", "leave.view");

        using var scope2 = database.Scope(tenantId, user: hr.ToString());
        var staff = scope2.ServiceProvider.GetRequiredService<StaffService>();
        var structure = scope2.ServiceProvider.GetRequiredService<StructureService>();
        var requests = scope2.ServiceProvider.GetRequiredService<LeaveRequests>();
        var balances = scope2.ServiceProvider.GetRequiredService<LeaveBalances>();
        var queries = scope2.ServiceProvider.GetRequiredService<LeaveQueries>();
        var setup = scope2.ServiceProvider.GetRequiredService<LeaveSetup>();

        var salary = new SalaryValues(5000, 1250, 0, 500, 0, 0, 0);
        var mona = (await staff.HireAsync(new HireInput("منى العتيبي", "Mona", new DateOnly(2026, 1, 1), 90, null, null, null, salary), default)).Value;
        var khaled = (await staff.HireAsync(new HireInput("خالد الدوسري", "Khaled", new DateOnly(2018, 1, 1), 0, null, null, null, salary), default)).Value;
        var finance = (await structure.SaveDepartmentAsync(null, new DepartmentInput("المالية", "Finance", null, null, khaled, 1), default)).Value;
        Assert.True((await staff.SetJobAsync(mona, new JobInput(null, finance, null, new DateOnly(2026, 1, 1), null, "Active"), default)).IsSuccess);
        Assert.True((await staff.SetJobAsync(khaled, new JobInput(null, finance, null, new DateOnly(2018, 1, 1), null, "Active"), default)).IsSuccess);

        // The manager's account is linked from the users screen: one account, one employee.
        Assert.True((await staff.LinkUserAsync(managerUser, khaled, default)).IsSuccess);
        Assert.Equal("conflict.staff_user_taken", (await staff.LinkUserAsync(Guid.NewGuid(), khaled, default)).Error.Code);

        // The types come with the labour law's defaults, counted in calendar days.
        var types = (await setup.SetupAsync(default)).Types;
        var annual = types.Single(t => t.Code == LeaveSetup.Annual);
        var sick = types.Single(t => t.Code == LeaveSetup.Sick);
        Assert.Equal((21m, 30m, 5, "Calendar"), (annual.DaysPerYear!.Value, annual.SeniorDaysPerYear!.Value, annual.SeniorAfterYears!.Value, annual.DayCount));

        // The opening balance from the employee's screen, then the monthly accrual (once only).
        Assert.True((await balances.AddAsync(mona, Modules.Leave.Domain.EntryKind.Opening, new EntryInput(annual.Id, new DateOnly(2026, 1, 1), 5, "رصيد افتتاحي"), default)).IsSuccess);
        Assert.Equal("conflict.leave_opening_exists", (await balances.AddAsync(mona, Modules.Leave.Domain.EntryKind.Opening, new EntryInput(annual.Id, new DateOnly(2026, 1, 1), 5, "مكرر"), default)).Error.Code);
        var accrued = (await balances.AccrueAsync("2026-10", default)).Value;
        Assert.Equal(2, accrued.Employees);
        Assert.Equal(0, (await balances.AccrueAsync("2026-10", default)).Value.Employees);
        var monaLeave = (await queries.EmployeeAsync(mona, default))!;
        Assert.Equal(6.75m, monaLeave.Balances.Single(b => b.LeaveTypeId == annual.Id).Available);
        Assert.Equal(30m, (await queries.EmployeeAsync(khaled, default))!.Balances.Single(b => b.LeaveTypeId == annual.Id).PerYear);

        // The preview: calendar days, the balance before and after, the manager; too many days are refused.
        var input = new LeaveInput(mona, annual.Id, new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 7), "إجازة عائلية", null, false);
        var preview = (await requests.PreviewAsync(input, null, default)).Value;
        Assert.Equal((6m, 6.75m, 0.75m, true), (preview.Days, preview.Available!.Value, preview.After!.Value, preview.ManagerLinked));
        Assert.Equal("conflict.leave_balance", (await requests.RequestAsync(input with { To = new DateOnly(2026, 11, 12) }, default)).Error.Code);

        var id = (await requests.RequestAsync(input, default)).Value;
        Assert.Equal("conflict.leave_overlap", (await requests.RequestAsync(input with { LeaveTypeId = sick.Id }, default)).Error.Code);
        Assert.Equal(0.75m, (await queries.EmployeeAsync(mona, default))!.Balances.Single(b => b.LeaveTypeId == annual.Id).Available);

        // The direct manager first, then HR: approved, the balance consumed, the attendance shows leave.
        await ApproveAsync(tenantId, managerUser);
        await ApproveAsync(tenantId, approver);
        using var scope3 = database.Scope(tenantId, user: hr.ToString());
        var detail = (await scope3.ServiceProvider.GetRequiredService<LeaveQueries>().RequestAsync(id, default))!;
        Assert.Equal(("Approved", 0.75m), (detail.Request.Status, detail.Available!.Value));
        var leaves = await scope3.ServiceProvider.GetRequiredService<IApprovedLeaves>().InAsync(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30), mona, default);
        Assert.Equal(new DateOnly(2026, 11, 7), Assert.Single(leaves).To);
        var days = (await scope3.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Attendance.Application.AttendanceQueries>().EmployeeAsync("2026-11", mona, default))!;
        Assert.Equal("Leave", days.Days.Single(d => d.Date == new DateOnly(2026, 11, 3)).Status);

        // Running the accrual through October catches up January to September (October is not repeated).
        var balances3 = scope3.ServiceProvider.GetRequiredService<LeaveBalances>();
        Assert.True((await balances3.AccrueThroughAsync("2026-10", default)).IsSuccess);
        Assert.Equal(16.5m, (await scope3.ServiceProvider.GetRequiredService<LeaveQueries>().EmployeeAsync(mona, default))!.Balances.Single(b => b.LeaveTypeId == annual.Id).Available);

        // An opening balance entered after the accrual (as of October 1st) already includes January to September:
        // those accruals are taken back, so the balance is 30 + October's 2.5, not 30 + 25.
        Assert.True((await balances3.AddAsync(khaled, Modules.Leave.Domain.EntryKind.Opening, new EntryInput(annual.Id, new DateOnly(2026, 10, 1), 30, "رصيد افتتاحي متأخر"), default)).IsSuccess);
        var khaledLeave = (await scope3.ServiceProvider.GetRequiredService<LeaveQueries>().EmployeeAsync(khaled, default))!;
        Assert.Equal(32.5m, khaledLeave.Balances.Single(b => b.LeaveTypeId == annual.Id).Available);
        Assert.Equal(9, khaledLeave.Entries.Count(e => e.Kind == "AccrualReversal"));

        // Sick days by the year's tiers.
        Assert.Equal(new SickSplit(5, 5, 0), LeaveRequests.Split(25, 10));
        Assert.Equal(new SickSplit(0, 10, 5), LeaveRequests.Split(80, 15));
    }

    private async Task ApproveAsync(Guid tenantId, Guid approver)
    {
        using var scope = database.Scope(tenantId, user: approver.ToString());
        var workflow = scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Infrastructure.WorkflowDbContext>();
        var task = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.SingleAsync(workflow.WorkItems, w => w.AssigneeUserId == approver && w.Status == IntegratedErp.Modules.Workflow.Domain.WorkItemStatus.Pending);
        Assert.True((await scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Application.ApprovalEngine>().DecideAsync(task.Id, IntegratedErp.Modules.Workflow.Application.Decision.Approve, "معتمد", null, default)).IsSuccess);
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
}
