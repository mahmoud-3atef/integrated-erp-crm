using IntegratedErp.BuildingBlocks.Security;
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
public sealed class GosiTests(TestDatabase database)
{
    [SkippableFact]
    public async Task GOSI_tasks_open_from_the_files_close_with_the_transaction_and_Saudization_counts_by_registration()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"gs-{Guid.NewGuid():N}"[..16], "شركة التأمينات", "GOSI Co", default)).Value.Id;
        }

        Guid entityId;
        using (var scope = database.Scope(tenantId, user: "setup"))
        {
            entityId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateLegalEntityAsync("CP05", "كير برو 05", "Care-Pro 05", "1010101011", null, default)).Value.Id;
        }

        var hr = await UserAsync(tenantId, "staff.view", "staff.manage", "staff.salaries.view", "staff.salaries.manage", "payroll.gosi.view", "payroll.gosi.manage", "payroll.gosi.invoice", "payroll.settings.manage");
        Guid sara, omar, ali;
        using (var scope = database.Scope(tenantId, user: hr.ToString()))
        {
            var staff = scope.ServiceProvider.GetRequiredService<StaffService>();
            var salary = new SalaryValues(6400, 1600, 0, 700, 0, 0, 0);
            sara = (await staff.HireAsync(new HireInput("سارة", "Sara", new DateOnly(2023, 1, 1), 0, entityId, null, null, salary), default)).Value;
            omar = (await staff.HireAsync(new HireInput("عمر", "Omar", new DateOnly(2026, 9, 1), 0, entityId, null, null, new SalaryValues(3000, 500, 0, 0, 0, 0, 0)), default)).Value;
            ali = (await staff.HireAsync(new HireInput("علي", "Ali", new DateOnly(2024, 1, 1), 0, entityId, null, null, salary), default)).Value;

            // Sara (Saudi, GOSI number), Omar (Saudi, a new hire without one), Ali (not Saudi).
            var db = scope.ServiceProvider.GetRequiredService<StaffDbContext>();
            foreach (var (id, nationality, gosiNo) in new[] { (sara, "SAU", "GOSI-1"), (omar, "SAU", (string?)null), (ali, "PAK", "GOSI-3") })
            {
                var e = await db.Employees.SingleAsync(x => x.Id == id);
                e.SetPersonal(e.NameAr, e.NameEn, null, nationality, null, null, null, null, null, gosiNo);
            }

            await db.SaveChangesAsync();

            // The first look: Omar's registration to do; Sara's and Ali's wages taken as registered.
            var gosi = scope.ServiceProvider.GetRequiredService<GosiService>();
            var tasks = await gosi.TasksAsync(null, default);
            var register = Assert.Single(tasks);
            Assert.Equal(("Register", omar, 3500m), (register.Kind, register.EmployeeId, register.NewWage!.Value));

            // Sara's raise changes her contributory wage: a task to update it with GOSI.
            Assert.True((await staff.ChangeSalaryAsync(sara, new SalaryChangeInput(new DateOnly(2026, 10, 1), new SalaryValues(7200, 1800, 0, 700, 0, 0, 0), "ترقية"), default)).IsSuccess);
        }

        using (var scope = database.Scope(tenantId, user: hr.ToString()))
        {
            var gosi = scope.ServiceProvider.GetRequiredService<GosiService>();
            var tasks = await gosi.TasksAsync(null, default);
            var update = Assert.Single(tasks, t => t.Kind == "WageUpdate");
            Assert.Equal((sara, 8000m, 9000m), (update.EmployeeId, update.OldWage!.Value, update.NewWage!.Value));

            // Closing them: Omar's number is recorded on his file; Sara's new wage is registered.
            var register = tasks.Single(t => t.Kind == "Register");
            Assert.Equal("validation.payroll_gosi_wage", (await gosi.CloseTaskAsync(register.Id, new GosiTaskCloseInput(new DateOnly(2026, 10, 5), null, null, null, null), default)).Error.Code);
            Assert.True((await gosi.CloseTaskAsync(register.Id, new GosiTaskCloseInput(new DateOnly(2026, 10, 5), null, "GOSI-2", null, "طلب 77"), default)).IsSuccess);
            Assert.True((await gosi.CloseTaskAsync(update.Id, new GosiTaskCloseInput(new DateOnly(2026, 10, 6), null, null, null, "طلب 78"), default)).IsSuccess);
            Assert.Empty(await gosi.TasksAsync(null, default));
            Assert.Equal(2, (await gosi.TasksAsync("done", default)).Count);
            Assert.Equal("GOSI-2", (await scope.ServiceProvider.GetRequiredService<StaffDbContext>().Employees.SingleAsync(e => e.Id == omar)).GosiNo);

            // Saudization: two Saudis of three; Omar's wage (3,500) under the full wage counts as half: 1.5 of 3 = 50%.
            Assert.True((await gosi.SaveSaudizationSettingsAsync(new SaudizationSettingsDto(4000, [new SaudizationTargetDto(entityId, null, null, 60)]), default)).IsSuccess);
            var row = Assert.Single(await gosi.SaudizationAsync(default), r => r.LegalEntityId == entityId);
            Assert.Equal((3, 2, 1, 1.5m, 50m, true), (row.Total, row.Saudis, row.HalfCounted, row.Counted, row.Percent, row.Below));
            Assert.Equal(1, row.Needed); // (60% × 3 − 1.5) ÷ (1 − 60%) = 0.75 → 1: one more full-wage Saudi makes 2.5 of 4 = 62.5%.
        }

        using (var scope = database.Scope(tenantId, user: hr.ToString()))
        {
            // The invoice against an empty month: the difference is the invoice itself.
            var gosi = scope.ServiceProvider.GetRequiredService<GosiService>();
            Assert.True((await gosi.SaveInvoiceAsync(new GosiInvoiceInput(entityId, "2026-10", 1250, "فاتورة أكتوبر"), default)).IsSuccess);
            var statement = await gosi.StatementAsync(entityId, "2026-10", null, null, 1, 25, default);
            Assert.Equal((0, 1250m, 1250m), (statement.Members, statement.Invoice!.Value, statement.Difference!.Value));
        }
    }

    private async Task<Guid> UserAsync(Guid tenantId, params string[] permissions)
    {
        using var scope = database.Scope(tenantId, user: "setup");
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<PermissionCatalog>();
        var user = UserAccount.Create("الموارد البشرية", null);
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
