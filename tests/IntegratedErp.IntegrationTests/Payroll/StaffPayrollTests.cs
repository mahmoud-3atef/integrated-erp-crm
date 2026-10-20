using ClosedXML.Excel;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Attendance.Application;
using IntegratedErp.Modules.Deductions.Application;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Payroll.Application;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Staff.Application;
using IntegratedErp.Modules.Staff.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Payroll;

[Collection(DatabaseTestGroup.Name)]
public sealed class StaffPayrollTests(TestDatabase database)
{
    [SkippableFact]
    public async Task A_staff_run_pays_the_closed_month_with_the_advance_and_penalty_and_records_them_once_approved()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"sp-{Guid.NewGuid():N}"[..16], "شركة الرواتب", "Payroll Co", default)).Value.Id;
        }

        Guid entityId;
        using (var scope = database.Scope(tenantId, user: "setup"))
        {
            entityId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateLegalEntityAsync("CP05", "كير برو 05", "Care-Pro 05", "1010101010", null, default)).Value.Id;
        }

        var hr = await UserAsync(tenantId, "مسؤول الرواتب",
            "staff.view", "staff.manage", "staff.salaries.view", "staff.bank.manage", "staff.bulk_update", "attendance.view", "attendance.manage", "attendance.settings",
            "deductions.view", "deductions.manage", "deductions.disburse", "payroll.staff.view", "payroll.staff.manage", "payroll.settings.manage");
        var attendanceApprover = await UserAsync(tenantId, "اعتماد الحضور", "attendance.view", "attendance.month.review", "attendance.month.close");
        var deductionApprover = await UserAsync(tenantId, "اعتماد الخصومات", "deductions.view", "deductions.approve.hr", "deductions.approve.finance", "deductions.approve.management");
        var payrollApprover = await UserAsync(tenantId, "اعتماد المسير", "payroll.staff.view", "payroll.staff.approve.hr", "payroll.staff.approve.finance", "payroll.staff.approve.management");

        Guid sara, omar, advanceId, penaltyId;
        using (var scope = database.Scope(tenantId, user: hr.ToString()))
        {
            var staff = scope.ServiceProvider.GetRequiredService<StaffService>();
            var salary = new SalaryValues(6400, 1600, 0, 700, 0, 0, 0);
            sara = (await staff.HireAsync(new HireInput("سارة العتيبي", "Sara", new DateOnly(2025, 1, 1), 0, null, null, null, salary), default)).Value;
            omar = (await staff.HireAsync(new HireInput("عمر الحربي", "Omar", new DateOnly(2025, 1, 1), 0, null, null, null, salary), default)).Value;
            Assert.True((await staff.SetPersonalAsync(sara, new PersonalInput("سارة العتيبي", "Sara", "1021553142", null, null, null, null, null), default)).IsSuccess);
            Assert.True((await staff.SetPersonalAsync(omar, new PersonalInput("عمر الحربي", "Omar", "1033103688", null, null, null, null, null), default)).IsSuccess);

            // The registration and Sara's IBAN from the Excel sheet: an empty cell changes nothing, a bad IBAN rejects its row.
            var bulk = scope.ServiceProvider.GetRequiredService<StaffBulkUpdate>();
            var sheet = await SheetAsync(bulk, (1, "كير برو 05", "SA0380000000608010167519"), (2, "كير برو 05", "SA0480000000608010167519"));
            var preview = await bulk.RunAsync(sheet, apply: false, default);
            Assert.Equal((2, 1, 1, false), (preview.Rows, preview.Employees, preview.Rejected, preview.Applied));
            Assert.Equal("bad_iban", Assert.Single(preview.Problems).Problem);
            Assert.Equal(["iban", "legal_entity"], preview.Items.Select(c => c.Field).Order());
            Assert.True((await bulk.RunAsync(await SheetAsync(bulk, (1, "كير برو 05", "SA0380000000608010167519"), (2, "كير برو 05", "")), apply: true, default)).Applied);
        }

        using (var scope = database.Scope(tenantId, user: hr.ToString()))
        {
            // Sara's advance of 1,000 in October and Omar's day of penalty, both approved; the advance paid.
            var advances = scope.ServiceProvider.GetRequiredService<AdvanceService>();
            advanceId = (await advances.RequestAsync(new AdvanceInput(sara, 1000, 1, "2026-10", "ظرف عائلي", false), default)).Value;
            var days = (await scope.ServiceProvider.GetRequiredService<DeductionSetup>().SetupAsync(default)).PenaltyTypes.Single(t => t.Code == "deduct_days").Id;
            penaltyId = (await scope.ServiceProvider.GetRequiredService<PenaltyService>().RequestAsync(
                new PenaltyInput(omar, "Penalty", days, new DateOnly(2026, 10, 8), "تأخر متكرر", null, 1, null, "2026-10", false), default)).Value;
        }

        await ApproveAllAsync(tenantId, deductionApprover, 2);
        using (var scope = database.Scope(tenantId, user: hr.ToString()))
        {
            Assert.True((await scope.ServiceProvider.GetRequiredService<AdvanceService>().DisburseAsync(advanceId, new DisburseInput(new DateOnly(2026, 10, 2), "Transfer", null), default)).IsSuccess);

            // October's fingerprints: Omar absent on the 5th; the month sent and closed.
            await scope.ServiceProvider.GetRequiredService<AttendanceSetup>().SetupAsync(2026, default);
            Assert.True((await scope.ServiceProvider.GetRequiredService<AttendanceImporter>().ApplyAsync(OctoberFile(), null, "oct.xlsx", default)).IsSuccess);
            Assert.True((await scope.ServiceProvider.GetRequiredService<MonthClosing>().SubmitAsync("2026-10", default)).IsSuccess);
        }

        await ApproveAllAsync(tenantId, attendanceApprover, 2);
        Guid runId;
        using (var scope = database.Scope(tenantId, user: hr.ToString()))
        {
            var service = scope.ServiceProvider.GetRequiredService<StaffPayrollService>();
            var checks = await service.ChecksAsync(entityId, "2026-10", default);
            Assert.Equal((true, 2, 0, 1), (checks.AttendanceClosed, checks.Employees, checks.NoSalary, checks.WithoutIban));
            runId = (await service.CreateAsync(new CreateStaffRunInput(entityId, "2026-10"), default)).Value;
            Assert.Equal("conflict.payroll_period_taken", (await service.CreateAsync(new CreateStaffRunInput(entityId, "2026-10"), default)).Error.Code);

            var queries = scope.ServiceProvider.GetRequiredService<StaffPayrollQueries>();
            var page = (await queries.LinesAsync(runId, new StaffLineQuery(null, null, null, null, false, 1, 25), default))!;
            var saraLine = page.Items.Single(l => l.EmployeeId == sara);
            var omarLine = page.Items.Single(l => l.EmployeeId == omar);
            // Not Saudi in this company's files: GOSI is the company's 2% only.
            Assert.Equal((30m, 1000m, 0m, 7700m), (saraLine.PaidDays, saraLine.Advances, saraLine.GosiEmployee, saraLine.Net));
            Assert.Equal((29m, 290m, 290m, 8120m), (omarLine.PaidDays, omarLine.Absence, omarLine.Penalties, omarLine.Net));
            Assert.Contains("no_iban", omarLine.Notes);
            Assert.Equal(7700m + 8120m, page.Sums.Net);

            // A bonus for Omar with its reason: the run is recalculated with it.
            Assert.True((await service.AddAdjustmentAsync(runId, new StaffAdjustmentRequest(omar, "Addition", 500, "مكافأة إنجاز"), default)).IsSuccess);
            var detail = (await queries.LineAsync(runId, (await queries.LinesAsync(runId, new StaffLineQuery("عمر", null, null, null, false, 1, 25), default))!.Items.Single().Id, default))!;
            Assert.Equal((8620m, 160m), (detail.Line.Net, detail.GosiEmployer));
            Assert.Single(detail.Adjustments);

            // The payslips (4.12) before approval: drafts, each adding up to its line.
            var payslips = scope.ServiceProvider.GetRequiredService<PayslipService>();
            var draft = (await payslips.StaffAsync(runId, new PayslipQuery(null, null, null, null), default))!;
            Assert.Equal((true, 2, 2), (draft.Draft, draft.Total, draft.Items.Count));
            foreach (var slip in draft.Items)
            {
                Assert.Equal(slip.TotalEarnings, slip.Earnings.Sum(e => e.Amount));
                Assert.Equal(slip.TotalDeductions, slip.Deductions.Sum(d => d.Amount));
                Assert.Equal(slip.Net, slip.TotalEarnings - slip.TotalDeductions);
            }

            var omarSlip = draft.Items.Single(x => x.PersonId == omar);
            Assert.Contains(omarSlip.Earnings, e => e.Code == "addition" && e.Amount == 500 && e.Note == "مكافأة إنجاز");
            Assert.Equal(8620m, omarSlip.Net);
            Assert.Contains(draft.Items.Single(x => x.PersonId == sara).Deductions, d => d.Code == "installment" && d.Amount == 1000);
            Assert.True((await service.SubmitAsync(runId, default)).IsSuccess);
        }

        await ApproveAllAsync(tenantId, payrollApprover, 3);
        using (var scope = database.Scope(tenantId, user: hr.ToString()))
        {
            var run = (await scope.ServiceProvider.GetRequiredService<StaffPayrollQueries>().GetAsync(runId, default))!;
            Assert.Equal(("Approved", 2, 16320m), (run.Status, run.Totals.Employees, run.Totals.Net));

            // The approved run took the installment and the penalty: nothing is due any more, and the advance is settled.
            Assert.Empty(await scope.ServiceProvider.GetRequiredService<IStaffDeductions>().DueAsync("2026-11", default));
            Assert.Equal("Settled", (await scope.ServiceProvider.GetRequiredService<DeductionQueries>().AdvanceAsync(advanceId, default))!.Advance.Status);
            Assert.Equal("conflict.payroll_not_editable", (await scope.ServiceProvider.GetRequiredService<StaffPayrollService>().RecalculateAsync(runId, default)).Error.Code);

            // One employee's official payslip, and each printing recorded (without amounts).
            var omarLine = (await scope.ServiceProvider.GetRequiredService<StaffPayrollQueries>().LinesAsync(runId, new StaffLineQuery("عمر", null, null, null, false, 1, 25), default))!.Items.Single();
            var official = (await scope.ServiceProvider.GetRequiredService<PayslipService>().StaffAsync(runId, new PayslipQuery(omarLine.Id, null, null, null), default))!;
            Assert.Equal((false, 1, omar), (official.Draft, official.Total, official.Items.Single().PersonId));
            var prints = await scope.ServiceProvider.GetRequiredService<PayrollDbContext>().PayslipPrints.OrderBy(x => x.PrintedAt).ToListAsync();
            Assert.Equal((2, 1, (Guid?)omar, false), (prints.Count, prints[^1].Count, prints[^1].PersonId, prints[^1].Draft));
        }
    }

    /// <summary>The bulk-update template with the registration and IBAN of rows filled in (an empty string leaves the cell empty).</summary>
    private static async Task<MemoryStream> SheetAsync(StaffBulkUpdate bulk, params (int Row, string LegalEntity, string Iban)[] rows)
    {
        using var template = new MemoryStream(await bulk.TemplateAsync(true, default));
        using var book = new XLWorkbook(template);
        var ws = book.Worksheets.First();
        int Col(string title) => ws.Row(1).CellsUsed().First(c => c.GetString() == title).Address.ColumnNumber;
        foreach (var (row, entity, iban) in rows)
        {
            ws.Cell(row + 1, Col("السجل التجاري")).Value = entity;
            ws.Cell(row + 1, Col("الآيبان")).Value = iban;
        }

        var stream = new MemoryStream();
        book.SaveAs(stream);
        stream.Position = 0;
        return stream;
    }

    private static MemoryStream OctoberFile()
    {
        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet("Sheet1");
        string[] headers = ["الرقم الوظيفي", "الإسم", "التاريخ", "اليوم", "حالة التحضير", "وقت الحضور", "وقت الانصراف", "المغادرات"];
        for (var c = 0; c < headers.Length; c++)
        {
            ws.Cell(1, c + 1).Value = headers[c];
        }

        var r = 2;
        for (var d = new DateOnly(2026, 10, 1); d <= new DateOnly(2026, 10, 31); d = d.AddDays(1))
        {
            var weekend = d.DayOfWeek is DayOfWeek.Friday or DayOfWeek.Saturday;
            foreach (var key in new[] { "1021553142", "1033103688" })
            {
                var absent = key == "1033103688" && d.Day == 5;
                ws.Cell(r, 1).Value = key;
                ws.Cell(r, 3).Value = d.ToDateTime(TimeOnly.MinValue);
                ws.Cell(r, 5).Value = weekend ? "عطلة الأسبوع - " : absent ? "غياب - " : "مكتملة - ";
                ws.Cell(r, 6).Value = weekend || absent ? "-" : "08:58";
                ws.Cell(r, 7).Value = weekend || absent ? "-" : "17:02";
                ws.Cell(r, 8).Value = "00:00";
                r++;
            }
        }

        var stream = new MemoryStream();
        wb.SaveAs(stream);
        stream.Position = 0;
        return stream;
    }

    /// <summary>Approves the approver's pending tasks, round after round (each approval may open the next stage to them).</summary>
    private async Task ApproveAllAsync(Guid tenantId, Guid approver, int rounds)
    {
        for (var round = 0; round < rounds; round++)
        {
            using var scope = database.Scope(tenantId, user: approver.ToString());
            var workflow = scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Infrastructure.WorkflowDbContext>();
            var tasks = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(
                System.Linq.Queryable.Where(workflow.WorkItems, w => w.AssigneeUserId == approver && w.Status == IntegratedErp.Modules.Workflow.Domain.WorkItemStatus.Pending));
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
