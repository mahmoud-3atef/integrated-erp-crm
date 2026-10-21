using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Deductions.Application;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Payroll.Application;
using IntegratedErp.Modules.Staff.Application;
using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Payroll;

[Collection(DatabaseTestGroup.Name)]
public sealed class SettlementTests(TestDatabase database)
{
    [SkippableFact]
    public async Task An_end_of_service_settlement_pays_the_last_days_and_the_award_takes_the_advance_and_closes_the_file()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"st-{Guid.NewGuid():N}"[..16], "شركة المخالصات", "Settlement Co", default)).Value.Id;
        }

        var hr = await UserAsync(tenantId, "مسؤول المخالصات",
            "staff.view", "staff.manage", "staff.salaries.view", "deductions.view", "deductions.manage", "deductions.disburse",
            "payroll.settlements.view", "payroll.settlements.manage", "payroll.settlements.pay");
        var deductionApprover = await UserAsync(tenantId, "اعتماد الخصومات", "deductions.view", "deductions.approve.hr", "deductions.approve.finance", "deductions.approve.management");
        var approver = await UserAsync(tenantId, "اعتماد المخالصات", "payroll.settlements.view", "payroll.settlements.approve.hr", "payroll.settlements.approve.payroll", "payroll.settlements.approve.finance");

        Guid sara, advanceId;
        using (var scope = database.Scope(tenantId, user: hr.ToString()))
        {
            // 7,500 a month in all since 1 July 2023; an advance of 2,000 in two installments from November.
            sara = (await scope.ServiceProvider.GetRequiredService<StaffService>().HireAsync(
                new HireInput("سارة العتيبي", "Sara", new DateOnly(2023, 7, 1), 0, null, null, null, new SalaryValues(5000, 1750, 0, 750, 0, 0, 0)), default)).Value;
            advanceId = (await scope.ServiceProvider.GetRequiredService<AdvanceService>().RequestAsync(new AdvanceInput(sara, 2000, 2, "2026-11", "ظرف عائلي", false), default)).Value;
        }

        await ApproveAllAsync(tenantId, deductionApprover, 2);
        Guid id;
        using (var scope = database.Scope(tenantId, user: hr.ToString()))
        {
            Assert.True((await scope.ServiceProvider.GetRequiredService<AdvanceService>().DisburseAsync(advanceId, new DisburseInput(new DateOnly(2026, 10, 20), "Transfer", null), default)).IsSuccess);

            var service = scope.ServiceProvider.GetRequiredService<SettlementService>();
            Assert.Equal("validation.settlement_end", (await service.CreateAsync(new CreateSettlementInput("EndOfService", null, sara, null, null, null, null), default)).Error.Code);
            id = (await service.CreateAsync(new CreateSettlementInput("EndOfService", null, sara, "Resignation", new DateOnly(2026, 11, 15), "Indefinite", null), default)).Value;
            Assert.Equal("conflict.settlement_exists", (await service.CreateAsync(new CreateSettlementInput("EndOfService", null, sara, "Resignation", new DateOnly(2026, 11, 15), null, null), default)).Error.Code);

            // The custody entered before sending: recalculated with it.
            Assert.True((await service.UpdateAsync(id, new SettlementEditInput("Resignation", new DateOnly(2026, 11, 15), "Indefinite", null, 0, 1200, 0, true, "تسليم العهدة"), default)).IsSuccess);

            var s = (await scope.ServiceProvider.GetRequiredService<SettlementQueries>().GetAsync(id, default))!;
            Assert.StartsWith("ST-", s.SettlementNo, StringComparison.Ordinal);
            Assert.Equal((7500m, 1234m, 15m), (s.Wage, s.ServiceDays, s.UnpaidDays)); // no approved run: the month's own days
            decimal Line(string code) => s.Lines.Where(l => l.Code == code).Sum(l => l.Amount);
            Assert.Equal((3750m, 4226.03m, 2000m, 1200m), (Line("unpaid_salary"), Line("end_of_service"), Line("installment"), Line("custody")));
            Assert.Equal(s.TotalAdditions - s.TotalDeductions, s.Net);
            Assert.True(s.CanEdit);
            Assert.True((await service.SubmitAsync(id, default)).IsSuccess);
            Assert.Equal("conflict.settlement_not_editable", (await service.UpdateAsync(id, new SettlementEditInput("Resignation", new DateOnly(2026, 11, 15), null, null, 0, 0, 0, true, null), default)).Error.Code);
        }

        await ApproveAllAsync(tenantId, approver, 3);
        using (var scope = database.Scope(tenantId, user: hr.ToString()))
        {
            var s = (await scope.ServiceProvider.GetRequiredService<SettlementQueries>().GetAsync(id, default))!;
            Assert.Equal(("Approved", true), (s.Status, s.CanPay));

            // The advance's two installments are taken (it is settled), and the employee has left on the last day.
            Assert.Empty(await scope.ServiceProvider.GetRequiredService<IStaffDeductions>().OpenInstallmentsAsync(sara, default));
            Assert.Equal("Settled", (await scope.ServiceProvider.GetRequiredService<DeductionQueries>().AdvanceAsync(advanceId, default))!.Advance.Status);
            var file = await scope.ServiceProvider.GetRequiredService<StaffDbContext>().Employees.AsNoTracking().SingleAsync(e => e.Id == sara);
            Assert.Equal(("Left", (DateOnly?)new DateOnly(2026, 11, 15)), (file.Status.ToString(), file.EndedOn));

            var service = scope.ServiceProvider.GetRequiredService<SettlementService>();
            Assert.Equal("validation.settlement_payment", (await service.PayAsync(id, new SettlementPaymentInput(new DateOnly(2026, 11, 20), " ", null), default)).Error.Code);
            Assert.True((await service.PayAsync(id, new SettlementPaymentInput(new DateOnly(2026, 11, 20), "Transfer", "TRX-1"), default)).IsSuccess);

            var list = await scope.ServiceProvider.GetRequiredService<SettlementQueries>().ListAsync(new SettlementQuery("Staff", null, null, "سارة", null, true, 1, 25), default);
            Assert.Equal(("Paid", 1), (Assert.Single(list.Items).Status, list.Counts.Staff));
        }
    }

    /// <summary>Approves the approver's pending tasks, round after round (each approval may open the next stage to them).</summary>
    private async Task ApproveAllAsync(Guid tenantId, Guid approver, int rounds)
    {
        for (var round = 0; round < rounds; round++)
        {
            using var scope = database.Scope(tenantId, user: approver.ToString());
            var workflow = scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Infrastructure.WorkflowDbContext>();
            var tasks = await workflow.WorkItems.Where(w => w.AssigneeUserId == approver && w.Status == IntegratedErp.Modules.Workflow.Domain.WorkItemStatus.Pending).ToListAsync();
            Assert.NotEmpty(tasks);
            foreach (var task in tasks)
            {
                Assert.True((await scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Application.ApprovalEngine>().DecideAsync(task.Id, IntegratedErp.Modules.Workflow.Application.Decision.Approve, "معتمد", null, default)).IsSuccess);
            }
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
