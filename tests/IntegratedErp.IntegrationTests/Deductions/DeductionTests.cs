using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Deductions.Application;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Staff.Application;
using IntegratedErp.Modules.Staff.Domain;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Deductions;

[Collection(DatabaseTestGroup.Name)]
public sealed class DeductionTests(TestDatabase database)
{
    [SkippableFact]
    public async Task An_advance_goes_through_the_manager_HR_and_finance_then_is_paid_postponed_and_settled_and_penalties_reach_the_payroll_month()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"dd-{Guid.NewGuid():N}"[..16], "شركة الخصومات", "Deductions Co", default)).Value.Id;
        }

        var hr = await UserAsync(tenantId, "مسؤول الموارد البشرية", "staff.view", "staff.manage", "staff.structure.manage", "staff.salaries.view", "deductions.view", "deductions.manage", "deductions.settings");
        var hrApprover = await UserAsync(tenantId, "اعتماد الموارد البشرية", "deductions.view", "deductions.approve.hr");
        var finance = await UserAsync(tenantId, "المالية", "deductions.view", "deductions.approve.finance", "deductions.disburse", "deductions.other.amend", "deductions.other.cancel_approved");
        var management = await UserAsync(tenantId, "الإدارة العليا", "deductions.view", "deductions.approve.management");
        var managerUser = await UserAsync(tenantId, "المدير المباشر", "deductions.view");

        using var scope2 = database.Scope(tenantId, user: hr.ToString());
        var staff = scope2.ServiceProvider.GetRequiredService<StaffService>();
        var structure = scope2.ServiceProvider.GetRequiredService<StructureService>();
        var setup = scope2.ServiceProvider.GetRequiredService<DeductionSetup>();
        var advances = scope2.ServiceProvider.GetRequiredService<AdvanceService>();

        var salary = new SalaryValues(5000, 1250, 0, 500, 0, 0, 0);
        var mona = (await staff.HireAsync(new HireInput("منى العتيبي", "Mona", new DateOnly(2026, 1, 1), 90, null, null, null, salary), default)).Value;
        var khaled = (await staff.HireAsync(new HireInput("خالد الدوسري", "Khaled", new DateOnly(2018, 1, 1), 0, null, null, null, salary), default)).Value;
        var dept = (await structure.SaveDepartmentAsync(null, new DepartmentInput("المالية", "Finance", null, null, khaled, 1), default)).Value;
        Assert.True((await staff.SetJobAsync(mona, new JobInput(null, dept, null, new DateOnly(2026, 1, 1), new DateOnly(2026, 12, 31), "Probation"), default)).IsSuccess);
        Assert.True((await staff.SetJobAsync(khaled, new JobInput(null, dept, null, new DateOnly(2018, 1, 1), null, "Active"), default)).IsSuccess);
        Assert.True((await staff.LinkUserAsync(managerUser, khaled, default)).IsSuccess);

        // The four penalty types of the labour law come first, and the settings with their defaults.
        var first = await setup.SetupAsync(default);
        Assert.Equal(["warning", "deduct_days", "deduct_amount", "suspension"], first.PenaltyTypes.Select(t => t.Code));
        Assert.Equal((50m, 3, true, 50m), (first.Settings.AdvanceCapPercent, first.Settings.AdvanceMaxMonths, first.Settings.AdvanceAfterProbation, first.Settings.MonthlyCapPercent));

        // On probation: refused, until the setting is turned off.
        var input = new AdvanceInput(mona, 4000.10m, 3, "2026-11", "ظرف عائلي", false);
        Assert.Equal("conflict.deduction_on_probation", (await advances.RequestAsync(input, default)).Error.Code);
        Assert.True((await setup.SaveSettingsAsync(first.Settings with { AdvanceAfterProbation = false }, default)).IsSuccess);

        // Above the cap (50% of 6,750): only when the request says so, for the approvers to decide; too many months refused.
        var preview = (await advances.PreviewAsync(input, null, default)).Value;
        Assert.Equal((6750m, 3375m, 1333.37m, true), (preview.Salary!.Value, preview.Cap!.Value, preview.Installment, preview.ManagerLinked));
        Assert.Equal(["advance_cap"], preview.NeedsAboveCap);
        using (var other = database.Scope(tenantId, user: hrApprover.ToString()))
        {
            // Without the salaries permission the preview gives no salary nor caps in money, but the same checks.
            var blind = (await other.ServiceProvider.GetRequiredService<AdvanceService>().PreviewAsync(input, null, default)).Value;
            Assert.Equal((null, null, null), (blind.Salary, blind.Cap, blind.MonthCap));
            Assert.Equal(["advance_cap"], blind.NeedsAboveCap);
        }

        Assert.Contains("too_many_months", (await advances.PreviewAsync(input with { Months = 4 }, null, default)).Value.Problems);
        Assert.Equal("conflict.deduction_above_cap", (await advances.RequestAsync(input, default)).Error.Code);
        var id = (await advances.RequestAsync(input with { AboveCap = true }, default)).Value;
        Assert.Equal("conflict.deduction_open_advance", (await advances.RequestAsync(input with { Amount = 500, AboveCap = false }, default)).Error.Code);

        // The direct manager, HR, then finance: approved with its schedule (the cents on the last installment).
        await ApproveAsync(tenantId, managerUser);
        await ApproveAsync(tenantId, hrApprover);
        await ApproveAsync(tenantId, finance);
        using (var scope3 = database.Scope(tenantId, user: finance.ToString()))
        {
            // Changed after its approval, before it is paid: over two months, then back to three (its schedule made again).
            var change = new AdvanceAmendInput(input.Amount, 2, input.FirstPeriod, input.Reason, true, " ");
            var amending = scope3.ServiceProvider.GetRequiredService<AdvanceService>();
            Assert.Equal("validation.deduction_amend_reason", (await amending.AmendAsync(id, change, default)).Error.Code);
            Assert.True((await amending.AmendAsync(id, change with { AmendReason = "طلب الموظف شهرين" }, default)).IsSuccess);
            Assert.Equal(2, (await scope3.ServiceProvider.GetRequiredService<DeductionQueries>().AdvanceAsync(id, default))!.Installments.Count);
            Assert.True((await amending.AmendAsync(id, change with { Months = 3, AmendReason = "عاد إلى ثلاثة أشهر" }, default)).IsSuccess);

            var detail = (await scope3.ServiceProvider.GetRequiredService<DeductionQueries>().AdvanceAsync(id, default))!;
            Assert.Equal("عاد إلى ثلاثة أشهر", detail.AmendNote);
            Assert.Equal(("Approved", true), (detail.Advance.Status, detail.Advance.AboveCap));
            Assert.Equal([("2026-11", 1333.36m), ("2026-12", 1333.36m), ("2027-01", 1333.38m)], detail.Installments.Select(i => (i.Period, i.Amount)));

            // Finance pays it; then it is open in the cards.
            var service = scope3.ServiceProvider.GetRequiredService<AdvanceService>();
            Assert.Equal("conflict.deduction_not_open", (await service.SettleAsync(id, new NoteInput("سداد"), default)).Error.Code);
            Assert.True((await service.DisburseAsync(id, new DisburseInput(new DateOnly(2026, 10, 20), "Transfer", "TR-1001"), default)).IsSuccess);
            Assert.Equal("conflict.deduction_not_amendable", (await service.CancelApprovedAsync(id, "بعد الصرف", default)).Error.Code);
            var kpis = await scope3.ServiceProvider.GetRequiredService<DeductionQueries>().AdvanceKpisAsync(default);
            Assert.Equal((4000.10m, 1, 0), (kpis.OpenBalance, kpis.OpenEmployees, kpis.ToDisburse));

            // November's installment is postponed to the month after the last one.
            Assert.Equal("conflict.deduction_not_postponable", (await service.PostponeAsync(id, detail.Installments[0].Id, new NoteInput(" "), default)).Error.Code);
            Assert.True((await service.PostponeAsync(id, detail.Installments[0].Id, new NoteInput("ظرف طارئ"), default)).IsSuccess);
        }

        using (var scope4 = database.Scope(tenantId, user: hr.ToString()))
        {
            var detail = (await scope4.ServiceProvider.GetRequiredService<DeductionQueries>().AdvanceAsync(id, default))!;
            Assert.Equal("2027-02", detail.Installments[^1].Period);
            Assert.Equal(4000.10m, detail.Advance.Remaining);
            var month = scope4.ServiceProvider.GetRequiredService<IStaffDeductions>();
            Assert.DoesNotContain(await month.MonthAsync("2026-11", default), m => m.EmployeeId == mona);

            // Penalties: above the days for one violation, then within; HR then senior management.
            var types = (await scope4.ServiceProvider.GetRequiredService<DeductionSetup>().SetupAsync(default)).PenaltyTypes;
            var days = types.Single(t => t.Code == "deduct_days").Id;
            var penalties = scope4.ServiceProvider.GetRequiredService<PenaltyService>();
            var penalty = new PenaltyInput(mona, "Penalty", days, new DateOnly(2026, 10, 12), "غياب بدون إذن", "أقرت بالغياب", 6, null, "2026-12", false);
            Assert.Equal("conflict.deduction_per_violation", (await penalties.RequestAsync(penalty, default)).Error.Code);
            Assert.True((await penalties.RequestAsync(penalty with { Days = 3 }, default)).IsSuccess);
            Assert.Equal("conflict.deduction_per_month", (await penalties.RequestAsync(penalty with { Days = 3, ViolationDate = new DateOnly(2026, 10, 14) }, default)).Error.Code);

            // Another deduction (damage): HR then finance.
            Assert.True((await penalties.RequestAsync(new PenaltyInput(mona, "Other", null, new DateOnly(2026, 10, 15), "تلف جهاز", null, null, 500, "2026-12", false), default)).IsSuccess);

            // A type of the company's own.
            var custom = (await scope4.ServiceProvider.GetRequiredService<DeductionSetup>().SaveTypeAsync(null, new PenaltyTypeInput("تأخر متكرر", "Repeated lateness", "DeductAmount", true, 5), default)).Value;
            Assert.Contains((await scope4.ServiceProvider.GetRequiredService<DeductionSetup>().SetupAsync(default)).PenaltyTypes, t => t.Id == custom && t.Effect == "DeductAmount");
        }

        await ApproveAsync(tenantId, hrApprover, 2);
        await ApproveAsync(tenantId, management);
        await ApproveAsync(tenantId, finance);

        using (var scope5 = database.Scope(tenantId, user: finance.ToString()))
        {
            var december = Assert.Single(await scope5.ServiceProvider.GetRequiredService<IStaffDeductions>().MonthAsync("2026-12", default), m => m.EmployeeId == mona);
            Assert.Equal((1333.36m, 3m, 500m, true), (december.AdvanceDue, december.PenaltyDays, december.OtherAmount, december.AboveCapAllowed));
            var employee = await scope5.ServiceProvider.GetRequiredService<DeductionQueries>().EmployeeAsync(mona, default);
            Assert.Equal((4000.10m, 3m), (employee.OpenAdvances, employee.PenaltyDaysThisYear));

            // Paid back at once: nothing is due any more.
            Assert.True((await scope5.ServiceProvider.GetRequiredService<AdvanceService>().SettleAsync(id, new NoteInput("سداد نقدي"), default)).IsSuccess);
        }

        using (var scope6 = database.Scope(tenantId, user: hr.ToString()))
        {
            var detail = (await scope6.ServiceProvider.GetRequiredService<DeductionQueries>().AdvanceAsync(id, default))!;
            Assert.Equal(("Settled", 0m), (detail.Advance.Status, detail.Advance.Remaining));
            var december = Assert.Single(await scope6.ServiceProvider.GetRequiredService<IStaffDeductions>().MonthAsync("2026-12", default), m => m.EmployeeId == mona);
            Assert.Equal(0m, december.AdvanceDue);

            // HR has no permission to cancel an applied deduction.
            var other = (await scope6.ServiceProvider.GetRequiredService<DeductionQueries>().PenaltiesAsync(null, mona, null, default)).Single(p => p.Category == "Other").Id;
            Assert.Equal("forbidden.deduction_category", (await scope6.ServiceProvider.GetRequiredService<PenaltyService>().CancelApprovedAsync(other, "خطأ", default)).Error.Code);
        }

        using (var scope7 = database.Scope(tenantId, user: finance.ToString()))
        {
            // Finance may change and cancel other deductions (not penalties) before they are deducted.
            var service = scope7.ServiceProvider.GetRequiredService<PenaltyService>();
            var rows = await scope7.ServiceProvider.GetRequiredService<DeductionQueries>().PenaltiesAsync(null, mona, null, default);
            var (other, penalty) = (rows.Single(p => p.Category == "Other").Id, rows.Single(p => p.Category == "Penalty" && p.Status == "Applied").Id);
            Assert.Equal("forbidden.deduction_category", (await service.CancelApprovedAsync(penalty, "خطأ", default)).Error.Code);
            Assert.True((await service.AmendAsync(other, new PenaltyAmendInput(null, new DateOnly(2026, 10, 15), "تلف جهاز", null, null, 400, "2026-12", false, "قيمة الإصلاح الفعلية"), default)).IsSuccess);
            var month = scope7.ServiceProvider.GetRequiredService<IStaffDeductions>();
            Assert.Equal(400m, Assert.Single(await month.MonthAsync("2026-12", default), m => m.EmployeeId == mona).OtherAmount);
            Assert.True((await service.CancelApprovedAsync(other, "أصلحه الموظف على حسابه", default)).IsSuccess);
            Assert.Equal(0m, Assert.Single(await month.MonthAsync("2026-12", default), m => m.EmployeeId == mona).OtherAmount);
        }
    }

    private async Task ApproveAsync(Guid tenantId, Guid approver, int count = 1)
    {
        using var scope = database.Scope(tenantId, user: approver.ToString());
        var workflow = scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Infrastructure.WorkflowDbContext>();
        var tasks = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(
            System.Linq.Queryable.Where(workflow.WorkItems, w => w.AssigneeUserId == approver && w.Status == IntegratedErp.Modules.Workflow.Domain.WorkItemStatus.Pending));
        Assert.Equal(count, tasks.Count);
        foreach (var task in tasks)
        {
            Assert.True((await scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Application.ApprovalEngine>().DecideAsync(task.Id, IntegratedErp.Modules.Workflow.Application.Decision.Approve, "معتمد", null, default)).IsSuccess);
        }
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
