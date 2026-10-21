using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.Billing.Application;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Organization.Application.Settings;
using IntegratedErp.Modules.Payroll.Application;
using IntegratedErp.Modules.Workforce.Infrastructure;
using IntegratedErp.Modules.Workflow.Application;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Payroll;

[Collection(DatabaseTestGroup.Name)]
public sealed class PayrollTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task A_registrations_payroll_pays_its_workers_approved_timesheet_lines_once_and_matches_the_timesheet_net()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId, care05, care07;
        using (var scope = database.Scope(system: true))
        {
            var organization = scope.ServiceProvider.GetRequiredService<OrganizationService>();
            tenantId = (await organization.CreateTenantAsync($"pr-{Guid.NewGuid():N}"[..16], "شركة الرواتب", "Payroll Co", default)).Value.Id;
        }

        using (var scope = database.Scope(tenantId, user: "setup"))
        {
            var organization = scope.ServiceProvider.GetRequiredService<OrganizationService>();
            care05 = (await organization.CreateLegalEntityAsync("CP05", "كير برو 05", "Care-Pro 05", "1010000005", null, default)).Value.Id;
            care07 = (await organization.CreateLegalEntityAsync("CP07", "كير برو 07", "Care-Pro 07", "1010000007", null, default)).Value.Id;
        }

        var crm = new FakeCrm();
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var riyadh = crm.Add("new_project", new() { ["new_name"] = "مشروع الرياض", ["new_code"] = "pro00901", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: Created2025);
        var jeddah = crm.Add("new_project", new() { ["new_name"] = "مشروع جدة", ["new_code"] = "pro00902", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: Created2025);
        var w1 = Worker(crm, "BSS0801", 100000000); // Care-Pro - 05
        var w2 = Worker(crm, "BSS0802", 100000008); // Care-pro - 07
        var w3 = Worker(crm, "BSS0803", 100000002); // IRC: an internal supplier, never in the company's payroll
        var w4 = Worker(crm, "BSS0804", 100000000); // Care-Pro - 05, on a timesheet not approved yet
        WorkStart(crm, w1, riyadh, "مشروع الرياض", "2026-08-01");
        WorkStart(crm, w2, riyadh, "مشروع الرياض", "2026-09-11");
        WorkStart(crm, w3, riyadh, "مشروع الرياض", "2026-08-01");
        WorkStart(crm, w4, jeddah, "مشروع جدة", "2026-08-01");
        await SyncAsync(tenantId, crm);
        var (manager, approver) = await PeopleAsync(tenantId);

        // September's timesheets: Riyadh approved (an absence and an internal addition), Jeddah still a draft.
        var september = new DateOnly(2026, 9, 1);
        decimal timesheetNet;
        Guid jeddahSheet;
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var service = scope.ServiceProvider.GetRequiredService<TimesheetService>();
            var queries = scope.ServiceProvider.GetRequiredService<TimesheetQueries>();
            var month = await queries.MonthAsync(september, default);
            var riyadhId = month.Projects.Single(p => p.ProjectName == "مشروع الرياض").ProjectId!.Value;
            var jeddahId = month.Projects.Single(p => p.ProjectName == "مشروع جدة").ProjectId!.Value;
            var sheet = (await service.GenerateAsync(new GenerateInput(riyadhId, september), default)).Value;
            var line = (await queries.GetAsync(sheet, default))!.Lines.Single(l => l.WorkerNo == "BSS0801");
            Assert.True((await service.AdjustAsync(sheet, new AdjustmentInput(line.WorkerId, "Absence", 2, "غياب بإفادة المشرف"), default)).IsSuccess);
            Assert.True((await service.AdjustAsync(sheet, new AdjustmentInput(line.WorkerId, "InternalAddition", 200, "مكافأة"), default)).IsSuccess);
            timesheetNet = (await queries.GetAsync(sheet, default))!.Lines.Single(l => l.WorkerNo == "BSS0801").WorkerNet;
            Assert.True((await service.SubmitAsync(sheet, default)).IsSuccess);
            jeddahSheet = (await service.GenerateAsync(new GenerateInput(jeddahId, september), default)).Value;
        }

        await ApproveNextAsync(tenantId, approver);

        Guid run05;
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var service = scope.ServiceProvider.GetRequiredService<PayrollService>();
            var queries = scope.ServiceProvider.GetRequiredService<PayrollQueries>();

            // No sponsor linked to the registration yet: nothing to pay.
            Assert.Equal("validation.payroll_no_sponsors", (await service.CreateAsync(new CreateRunInput(care05, september, new DateOnly(2026, 9, 30)), default)).Error.Code);
            Assert.Contains(await queries.SponsorsAsync(default), s => s.Sponsor == "Care-Pro - 05" && s.LegalEntityId == null);
            Assert.True((await service.LinkSponsorsAsync([new("Care-Pro - 05", care05), new("Care-pro - 07", care07)], default)).IsSuccess);

            Assert.Equal("validation.payroll_period", (await service.CreateAsync(new CreateRunInput(care05, september, new DateOnly(2026, 8, 31)), default)).Error.Code);
            var created = await service.CreateAsync(new CreateRunInput(care05, september, new DateOnly(2026, 9, 30)), default);
            Assert.True(created.IsSuccess, created.IsFailure ? created.Error.Code : null);
            run05 = created.Value;

            // Only the registration's worker with an approved timesheet; the one on the draft timesheet waits.
            var run = (await queries.GetAsync(run05, default))!;
            Assert.Equal(("PR-2026-00001", "Draft", 1, 1), (run.RunNo, run.Status, run.Totals.Workers, run.Totals.Excluded));
            Assert.Equal((2, 1, 1), (run.Coverage.Eligible, run.Coverage.Paid, run.Coverage.TimesheetNotApproved));
            Assert.Null(run.Previous);
            Assert.Equal([("TimesheetNotApproved", "BSS0804")], (await queries.ExclusionsAsync(run05, default))!.Select(e => (e.Kind, e.WorkerNo)));

            // The split: the salary paid (1,500 for 30 days less 2 absent days) by the worker's elements, the net as the timesheet's.
            var page = (await queries.LinesAsync(run05, new LineQuery(null, null, null, null, false, 1, 25), default))!;
            var pay = page.Items.Single();
            Assert.Equal(("BSS0801", 28m, 2m), (pay.WorkerNo, pay.PaidDays, pay.AbsenceDays));
            Assert.Equal((933.33m, 280m, 93.33m, 93.33m, 0.01m), (pay.Base, pay.Housing, pay.Food, pay.Transport, pay.OtherAllowances));
            Assert.Equal((200m, 666.67m, 0m), (pay.Additions, pay.Allowances, pay.Deductions));
            Assert.Equal((timesheetNet, 1600m), (pay.Net, pay.Base + pay.Allowances - pay.Deductions));
            Assert.Contains("absence", pay.Notes);
            Assert.Equal((1, 1600m), (page.Sums.Workers, page.Sums.Net));
            Assert.Equal(0, (await queries.LinesAsync(run05, new LineQuery("لا أحد", null, null, null, false, 1, 25), default))!.Total);

            var detail = (await queries.LineAsync(run05, pay.Id, default))!;
            Assert.Equal((1400m, 200m), (detail.Sources.Single().SalaryPart, detail.InternalAdditions));

            // Another run of the registration over part of the period is refused; the other registration has its own.
            Assert.Equal("conflict.payroll_overlap", (await service.CreateAsync(new CreateRunInput(care05, new DateOnly(2026, 9, 15), new DateOnly(2026, 10, 14)), default)).Error.Code);
            var run07 = (await service.CreateAsync(new CreateRunInput(care07, september, new DateOnly(2026, 9, 30)), default)).Value;
            Assert.Equal([("BSS0802", 20m)], (await queries.LinesAsync(run07, new LineQuery(null, null, null, null, false, 1, 25), default))!.Items.Select(l => (l.WorkerNo, l.PaidDays)));
            Assert.True((await service.DeleteAsync(run07, default)).IsSuccess); // BSS0802's September is settled below (4.11ب)

            var file = await queries.ScopeAsync(run05, new LineQuery(null, null, null, null, false, 1, int.MaxValue), default);
            Assert.NotEmpty(PayrollWorkbook.Build(file!.Value.Run, file.Value.Lines, filtered: false));

            var submitted = await service.SubmitAsync(run05, default);
            Assert.True(submitted.IsSuccess, submitted.IsFailure ? submitted.Error.Code + " " + submitted.Error.Message : null);
        }

        // HR, finance and management approve.
        await ApproveNextAsync(tenantId, approver);
        await ApproveNextAsync(tenantId, approver);
        await ApproveNextAsync(tenantId, approver);

        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var service = scope.ServiceProvider.GetRequiredService<PayrollService>();
            var queries = scope.ServiceProvider.GetRequiredService<PayrollQueries>();
            Assert.Equal(("Approved", false), ((await queries.GetAsync(run05, default))!.Status, (await queries.GetAsync(run05, default))!.CanEdit));
            Assert.Equal("conflict.payroll_not_editable", (await service.RecalculateAsync(run05, default)).Error.Code);

            // October: the period starts the day after September's run, which is the comparison; the worker has no October timesheet.
            var next = await service.NextPeriodAsync(care05, default);
            Assert.Equal((new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31)), next);
            var october = (await service.CreateAsync(new CreateRunInput(care05, next.From, next.To), default)).Value;
            var run = (await queries.GetAsync(october, default))!;
            Assert.Equal(("PR-2026-00003", 0, 1600m), (run.RunNo, run.Totals.Workers, run.Previous!.Totals.Net));
            Assert.Contains((await queries.ExclusionsAsync(october, default))!, e => e is { Kind: "NoTimesheet", WorkerNo: "BSS0801" });
            Assert.True((await scope.ServiceProvider.GetRequiredService<TimesheetService>().SubmitAsync(jeddahSheet, default)).IsSuccess);
        }

        // Jeddah's September timesheet approved after September's run: its worker is paid in October's, marked late.
        await ApproveNextAsync(tenantId, approver);
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var october = (await scope.ServiceProvider.GetRequiredService<PayrollQueries>().ListAsync(care05, default))[0].Id;
            Assert.True((await scope.ServiceProvider.GetRequiredService<PayrollService>().RecalculateAsync(october, default)).IsSuccess);
            var late = (await scope.ServiceProvider.GetRequiredService<PayrollQueries>().LinesAsync(october, new LineQuery(null, "late", null, null, false, 1, 25), default))!;
            Assert.Equal([("BSS0804", 30m)], late.Items.Select(l => (l.WorkerNo, l.PaidDays)));
        }

        // 4.11ب: BSS0802 (Care-pro - 07, from 1 October 2024) ends the contract on 15 October 2026: September's approved line no
        // run paid, the 15 days on the job in October, the full award and the 10 days of leave left in the file.
        Guid settlementId;
        string settlementNo;
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var workers = scope.ServiceProvider.GetRequiredService<WorkforceDbContext>().Workers.AsNoTracking();
            var w2Id = await workers.Where(w => w.WorkerNo == "BSS0802").Select(w => w.Id).SingleAsync();
            var w3Id = await workers.Where(w => w.WorkerNo == "BSS0803").Select(w => w.Id).SingleAsync();
            var settlements = scope.ServiceProvider.GetRequiredService<SettlementService>();
            Assert.Equal([w2Id], (await settlements.WorkersAsync("BSS080", default)).Where(w => w.WorkerNo is "BSS0802" or "BSS0803").Select(w => w.Id));
            Assert.Equal("validation.settlement_not_sponsored", (await settlements.CreateAsync(new CreateSettlementInput("EndOfService", null, w3Id, "ContractEnd", new DateOnly(2026, 10, 15), null, null, "Worker"), default)).Error.Code);
            settlementId = (await settlements.CreateAsync(new CreateSettlementInput("EndOfService", null, w2Id, "ContractEnd", new DateOnly(2026, 10, 15), null, null, "Worker"), default)).Value;

            var s = (await scope.ServiceProvider.GetRequiredService<SettlementQueries>().GetAsync(settlementId, default))!;
            settlementNo = s.SettlementNo;
            decimal Line(string code) => s.Lines.Where(l => l.Code == code).Sum(l => l.Amount);
            Assert.Equal(("Worker", 1500m, 745m, 15m, 10m), (s.Party, s.Wage, s.ServiceDays, s.UnpaidDays, s.LeaveDays));
            Assert.Equal((20m, 1000m), (s.Lines.Single(l => l.Code == "timesheet_pay").Days, Line("timesheet_pay")));
            Assert.Equal((750m, 1530.82m, 500m), (Line("unpaid_salary"), Line("end_of_service"), Line("leave_balance")));
            Assert.True((await settlements.SubmitAsync(settlementId, default)).IsSuccess);
        }

        // Operations, payroll and finance approve.
        await ApproveNextAsync(tenantId, approver);
        await ApproveNextAsync(tenantId, approver);
        await ApproveNextAsync(tenantId, approver);
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            Assert.Equal("Approved", (await scope.ServiceProvider.GetRequiredService<SettlementQueries>().GetAsync(settlementId, default))!.Status);

            // September's run of the registration no longer pays the line the settlement paid.
            var run07 = (await scope.ServiceProvider.GetRequiredService<PayrollService>().CreateAsync(new CreateRunInput(care07, september, new DateOnly(2026, 9, 30)), default)).Value;
            var queries = scope.ServiceProvider.GetRequiredService<PayrollQueries>();
            Assert.Equal(0, (await queries.GetAsync(run07, default))!.Totals.Workers);
            Assert.Contains((await queries.ExclusionsAsync(run07, default))!, e => e is { Kind: "PaidElsewhere", WorkerNo: "BSS0802" } && e.Reference == settlementNo);
        }
    }

    /// <summary>The approver takes their one open task and approves it.</summary>
    private async Task ApproveNextAsync(Guid tenantId, Guid approver)
    {
        using var scope = database.Scope(tenantId, user: approver.ToString());
        var workflow = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
        var task = await workflow.WorkItems.SingleAsync(w => w.AssigneeUserId == approver && w.Status == WorkItemStatus.Pending);
        Assert.True((await scope.ServiceProvider.GetRequiredService<ApprovalEngine>().DecideAsync(task.Id, Decision.Approve, "معتمد", null, default)).IsSuccess);
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
            var role = Role.Create($"r-{Guid.NewGuid():N}"[..20], name, name, ["billing.timesheets.view", "payroll.workers.view", .. permissions], catalog).Value;
            identity.Roles.Add(role);
            identity.RoleAssignments.Add(new RoleAssignment(membership.Id, role.Id, null, tenantId));
            await identity.SaveChangesAsync();
            return user.Id;
        }

        return (
            await PersonAsync("مسؤول الرواتب", "billing.timesheets.manage", "payroll.workers.manage", "payroll.settings.manage", "payroll.settlements.view", "payroll.settlements.manage"),
            await PersonAsync("المعتمد", "billing.timesheets.approve", "payroll.workers.review", "payroll.workers.finance", "payroll.workers.approve",
                "payroll.settlements.view", "payroll.settlements.approve.operations", "payroll.settlements.approve.payroll", "payroll.settlements.approve.finance"));
    }

    private static Guid Worker(FakeCrm crm, string number, int? sponsor) =>
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {number}", ["new_empidnumber"] = number, ["new_idnumber"] = $"2{number[3..]}00000", ["statuscode"] = 100000000, ["new_employeetype"] = 2,
            ["new_totalsalary"] = 1500m, ["new_basicsalary"] = 1000m, ["new_housingallowance"] = 300m, ["new_foodallowance"] = 100m, ["new_trasnallowance"] = 100m,
            ["new_sponseredby"] = sponsor, ["new_contractstartdate"] = "2024-10-01T00:00:00Z", ["new_remainingbalance"] = 10m,
        }, created: Created2025);

    private static void WorkStart(FakeCrm crm, Guid worker, Guid project, string projectName, string on) =>
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = worker.ToString(), ["new_projectid"] = project.ToString(), ["new_projectidname"] = projectName,
            ["new_startdate"] = $"{on}T09:00:00Z", ["new_serviceprice"] = 3000m, ["statecode"] = 0, ["new_number"] = $"SW{Guid.NewGuid():N}"[..8],
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
