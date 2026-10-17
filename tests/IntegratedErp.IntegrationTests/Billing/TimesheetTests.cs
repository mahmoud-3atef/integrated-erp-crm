using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.Billing.Application;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workflow.Application;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Billing;

[Collection(DatabaseTestGroup.Name)]
public sealed class TimesheetTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task A_project_timesheet_is_generated_from_the_ledger_adjusted_approved_and_split_into_its_three_outputs()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"ts-{Guid.NewGuid():N}"[..16], "شركة التحضير", "Timesheet Co", default)).Value.Id;
        }

        var crm = new FakeCrm();
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var project = crm.Add("new_project", new() { ["new_name"] = "مشروع الرياض", ["new_code"] = "pro00900", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: Created2025);
        var company = Worker(crm, "BSS0701", 100000000); // Care-Pro: the company's payroll
        var supplier = Worker(crm, "BSS0702", 100000002); // IRC: an internal supplier
        var unknown = Worker(crm, "BSS0703", null); // no sponsor
        WorkStart(crm, company, project, "2026-08-01", 3000m);
        WorkStart(crm, supplier, project, "2026-09-11", 2800m);
        WorkStart(crm, unknown, project, "2026-09-21", 2500m);
        await SyncAsync(tenantId, crm);
        var (manager, approver) = await PeopleAsync(tenantId);

        var september = new DateOnly(2026, 9, 1);
        Guid id, projectId, companyId;
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var service = scope.ServiceProvider.GetRequiredService<TimesheetService>();
            var queries = scope.ServiceProvider.GetRequiredService<TimesheetQueries>();
            var month = await queries.MonthAsync(september, default);
            var row = month.Projects.Single();
            Assert.Equal(("مشروع الرياض", 3, (Guid?)null), (row.ProjectName, row.LedgerWorkers, row.TimesheetId));
            projectId = row.ProjectId!.Value;

            var generated = await service.GenerateAsync(new GenerateInput(projectId, september), default);
            Assert.True(generated.IsSuccess, generated.IsFailure ? generated.Error.Code : null);
            id = generated.Value;
            var sheet = (await queries.GetAsync(id, default))!;
            Assert.Equal((new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30), "Draft"), (sheet.From, sheet.To, sheet.Status));
            Assert.Equal([("BSS0701", 30m), ("BSS0702", 20m), ("BSS0703", 10m)], sheet.Lines.Select(l => (l.WorkerNo, l.WorkDays)));
            companyId = sheet.Lines.Single(l => l.WorkerNo == "BSS0701").WorkerId;

            // Absence and overtime, each with a reason; more absent days than work days are refused.
            Assert.Equal("validation.timesheet_reason", (await service.AdjustAsync(id, new AdjustmentInput(companyId, "Absence", 2, " "), default)).Error.Code);
            Assert.Equal("validation.timesheet_absence_over_days", (await service.AdjustAsync(id, new AdjustmentInput(companyId, "Absence", 31, "غياب"), default)).Error.Code);
            Assert.True((await service.AdjustAsync(id, new AdjustmentInput(companyId, "Absence", 2, "غياب بإفادة المشرف"), default)).IsSuccess);
            Assert.True((await service.AdjustAsync(id, new AdjustmentInput(companyId, "Overtime", 8, "عمل إضافي يوم الجمعة"), default)).IsSuccess);

            // Generated again (e.g. after a movement): the adjustments stay on the worker.
            Assert.True((await service.GenerateAsync(new GenerateInput(projectId, september), default)).IsSuccess);
            sheet = (await queries.GetAsync(id, default))!;
            var line = sheet.Lines.Single(l => l.WorkerNo == "BSS0701");
            Assert.Equal((2m, 8m, 1500m, 100m, 50m, 2950m), (line.AbsenceDays, line.OvertimeHours, line.DueSalary, line.AbsenceAmount, line.Overtime, line.InvoiceAmount));
            Assert.Equal(1450m, line.WorkerNet);
            Assert.Equal((1000m, 866.67m, 1866.67m), (sheet.Lines.Single(l => l.WorkerNo == "BSS0702").DueSalary, sheet.Lines.Single(l => l.WorkerNo == "BSS0702").DueFees, sheet.Lines.Single(l => l.WorkerNo == "BSS0702").InvoiceAmount));

            // The three outputs: the invoice, the company's payroll, the supplier's statement — and the worker with no sponsor.
            Assert.Equal(2950m + 1866.67m + 833.33m, sheet.Invoice.Amount);
            Assert.Equal(Math.Round(sheet.Invoice.Amount * 0.15m, 2), sheet.Invoice.Vat, 1);
            Assert.Equal(["BSS0701"], sheet.Payroll.Select(p => p.WorkerNo));
            Assert.Equal(("IRC - 02", 1, 20m), (sheet.Suppliers.Single().SupplierName, sheet.Suppliers.Single().Workers, sheet.Suppliers.Single().WorkDays));
            Assert.Equal(["BSS0703"], sheet.UnknownSource.Select(p => p.WorkerNo));

            Assert.True((await service.SubmitAsync(id, default)).IsSuccess);
        }

        using (var scope = database.Scope(tenantId, user: approver.ToString()))
        {
            var workflow = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
            var task = await workflow.WorkItems.SingleAsync(w => w.AssigneeUserId == approver && w.Status == WorkItemStatus.Pending);
            Assert.True((await scope.ServiceProvider.GetRequiredService<ApprovalEngine>().DecideAsync(task.Id, Decision.Approve, "معتمد", null, default)).IsSuccess);
        }

        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var sheet = (await scope.ServiceProvider.GetRequiredService<TimesheetQueries>().GetAsync(id, default))!;
            Assert.Equal(("Approved", false), (sheet.Status, sheet.CanEdit));

            // Approved: locked.
            var service = scope.ServiceProvider.GetRequiredService<TimesheetService>();
            Assert.Equal("conflict.timesheet_not_editable", (await service.AdjustAsync(id, new AdjustmentInput(companyId, "Absence", 1, "غياب"), default)).Error.Code);
            Assert.Equal("conflict.timesheet_not_editable", (await service.GenerateAsync(new GenerateInput(projectId, september), default)).Error.Code);
            Assert.Equal(1, (await scope.ServiceProvider.GetRequiredService<TimesheetQueries>().MonthAsync(september, default)).Totals.Approved);
        }
    }

    private async Task<(Guid Manager, Guid Approver)> PeopleAsync(Guid tenantId)
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
            var role = Role.Create($"r-{Guid.NewGuid():N}"[..20], name, name, ["billing.timesheets.view", .. permissions], catalog).Value;
            identity.Roles.Add(role);
            identity.RoleAssignments.Add(new RoleAssignment(membership.Id, role.Id, null, tenantId));
            await identity.SaveChangesAsync();
            return user.Id;
        }

        return (await PersonAsync("مشرف المشروع", "billing.timesheets.manage"), await PersonAsync("مدير العمليات", "billing.timesheets.approve"));
    }

    private static Guid Worker(FakeCrm crm, string number, int? sponsor) =>
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {number}", ["new_empidnumber"] = number, ["new_idnumber"] = $"2{number[3..]}00000", ["statuscode"] = 100000000, ["new_employeetype"] = 2,
            ["new_totalsalary"] = 1500m, ["new_basicsalary"] = 1000m, ["new_sponseredby"] = sponsor,
        }, created: Created2025);

    private static void WorkStart(FakeCrm crm, Guid worker, Guid project, string on, decimal price) =>
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = worker.ToString(), ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الرياض",
            ["new_startdate"] = $"{on}T09:00:00Z", ["new_serviceprice"] = price, ["statecode"] = 0, ["new_number"] = $"SW{Guid.NewGuid():N}"[..8],
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
