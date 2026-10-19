using ClosedXML.Excel;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Attendance.Application;
using IntegratedErp.Modules.Attendance.Contracts;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Staff.Application;
using IntegratedErp.Modules.Staff.Domain;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Attendance;

[Collection(DatabaseTestGroup.Name)]
public sealed class AttendanceTests(TestDatabase database)
{
    [SkippableFact]
    public async Task The_fingerprint_file_becomes_days_that_HR_corrects_and_a_second_import_keeps_the_corrections()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"at-{Guid.NewGuid():N}"[..16], "شركة الحضور", "Attendance Co", default)).Value.Id;
        }

        var approver = await HrAsync(tenantId, "attendance.view", "attendance.month.review", "attendance.month.close", "attendance.overtime.approve");
        var hr = await HrAsync(tenantId, "staff.view", "staff.manage", "attendance.view", "attendance.manage", "attendance.settings");
        using var scope2 = database.Scope(tenantId, user: hr.ToString());
        var staff = scope2.ServiceProvider.GetRequiredService<StaffService>();
        var setup = scope2.ServiceProvider.GetRequiredService<AttendanceSetup>();
        var importer = scope2.ServiceProvider.GetRequiredService<AttendanceImporter>();
        var queries = scope2.ServiceProvider.GetRequiredService<AttendanceQueries>();
        var service = scope2.ServiceProvider.GetRequiredService<AttendanceService>();

        var salary = new SalaryValues(5000, 1250, 0, 500, 0, 0, 0);
        var mona = (await staff.HireAsync(new HireInput("منى العتيبي", "Mona", new DateOnly(2026, 8, 1), 90, null, null, null, salary), default)).Value;
        var raed = (await staff.HireAsync(new HireInput("رائد سعيد", "Raed", new DateOnly(2026, 8, 1), 90, null, null, null, salary), default)).Value;
        var other = (await staff.HireAsync(new HireInput("لا يبصم", "Not in file", new DateOnly(2026, 8, 1), 90, null, null, null, salary), default)).Value;
        Assert.True((await staff.SetPersonalAsync(mona, new PersonalInput("منى العتيبي", "Mona", "1021553142", null, null, null, null, null), default)).IsSuccess);
        Assert.True((await staff.SetPersonalAsync(raed, new PersonalInput("رائد سعيد", "Raed", "1033103688", null, null, null, null, null), default)).IsSuccess);

        // The default shift is made the first time: 09:00–17:00, 15 minutes of grace, Friday and Saturday off.
        var defaults = await setup.SetupAsync(2026, default);
        var regular = Assert.Single(defaults.Shifts);
        Assert.Equal((new TimeOnly(9, 0), new TimeOnly(17, 0), 15, true), (regular.StartsAt, regular.EndsAt, regular.GraceMinutes, regular.IsDefault));
        Assert.Equal([5, 6], regular.RestDays);
        Assert.True((await setup.SaveHolidayAsync(null, new HolidayInput("اليوم الوطني", "National Day", new DateOnly(2026, 9, 23), new DateOnly(2026, 9, 23), "Official"), default)).IsSuccess);

        // September 2026: Mona is late on the 1st, absent on the 2nd, one punch on the 3rd; Raed is on leave on the 1st; an unknown number.
        var preview = (await importer.PreviewAsync(File(), null, default)).Value;
        Assert.Equal(("IdNumber", 1, 1), (preview.MatchBy, preview.Rejected, preview.Unmatched.Count));
        Assert.Equal((new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30)), (preview.From!.Value, preview.To!.Value));
        Assert.Equal("unknown_employee", preview.Problems[0].Code);
        Assert.Empty(await queries.ImportsAsync(default));

        var applied = (await importer.ApplyAsync(File(), null, "sep.xlsx", default)).Value;
        Assert.NotNull(applied.ImportId);
        var month = (await queries.MonthAsync("2026-09", null, default))!;
        Assert.Equal((2, 1, 1, 1), (month.Kpis.Employees, month.Kpis.AbsenceDays, month.Kpis.MissingPunches, month.Kpis.LateEmployees));
        Assert.Equal(90, month.Kpis.LateMinutes);

        var rows = (await queries.EmployeesAsync("2026-09", new MonthQuery(null, null, null, null, null, "no", false, 1, 25), default))!;
        Assert.DoesNotContain(rows.Rows, r => r.EmployeeId == other);
        var monaRow = rows.Rows.Single(r => r.EmployeeId == mona);
        Assert.Equal((21, 1, 90, 1, 1m, "Exceptions"), (monaRow.WorkDays, monaRow.Absent, monaRow.LateMinutes, monaRow.MissingPunches, monaRow.Deduction, monaRow.State));
        Assert.Equal(1, rows.Rows.Single(r => r.EmployeeId == raed).Leave);
        var days = (await queries.EmployeeAsync("2026-09", mona, default))!;
        Assert.Equal("Holiday", days.Days.Single(d => d.Date == new DateOnly(2026, 9, 23)).Status);
        Assert.Equal("Rest", days.Days.Single(d => d.Date == new DateOnly(2026, 9, 4)).Status);

        // HR excuses the absence (a reason is needed) and completes the missing punch.
        Assert.Equal("validation.attendance_note", (await service.CorrectAsync(mona, new DateOnly(2026, 9, 2), new CorrectionInput(null, null, "Excused", null, null), default)).Error.Code);
        Assert.True((await service.CorrectAsync(mona, new DateOnly(2026, 9, 2), new CorrectionInput(null, null, "Excused", "مراجعة طبية", null), default)).IsSuccess);
        Assert.True((await service.CorrectAsync(mona, new DateOnly(2026, 9, 3), new CorrectionInput(null, new TimeOnly(17, 0), null, "نسيت البصمة", null), default)).IsSuccess);

        // The same file again: the corrections stay.
        Assert.True((await importer.ApplyAsync(File(), null, "sep.xlsx", default)).IsSuccess);
        monaRow = (await queries.EmployeesAsync("2026-09", new MonthQuery(null, "منى", null, null, null, null, false, 1, 25), default))!.Rows.Single();
        Assert.Equal((0, 0, 0m, "Complete"), (monaRow.Absent, monaRow.MissingPunches, monaRow.Deduction, monaRow.State));
        Assert.Empty((await queries.ExceptionsAsync("2026-09", null, default))!);

        // Two hours of overtime for Mona, approved: counted in the month.
        var overtime = scope2.ServiceProvider.GetRequiredService<OvertimeService>();
        Assert.Equal("validation.attendance_overtime_fields", (await overtime.RequestAsync(new OvertimeInput(mona, new DateOnly(2026, 9, 7), 120, " "), default)).Error.Code);
        Assert.True((await overtime.RequestAsync(new OvertimeInput(mona, new DateOnly(2026, 9, 7), 120, "إقفال الربع الثالث"), default)).IsSuccess);
        await ApproveAsync(tenantId, approver);

        // HR sends the month: its figures are frozen and its days can no longer change.
        var closing = scope2.ServiceProvider.GetRequiredService<MonthClosing>();
        Assert.True((await closing.SubmitAsync("2026-09", default)).IsSuccess);
        Assert.Equal("conflict.attendance_month_not_open", (await closing.SubmitAsync("2026-09", default)).Error.Code);
        Assert.Equal("conflict.attendance_month_locked", (await service.CorrectAsync(mona, new DateOnly(2026, 9, 8), new CorrectionInput(null, null, "Absent", null, null), default)).Error.Code);
        var locked = (await importer.PreviewAsync(File(), null, default)).Value;
        Assert.Equal(0, locked.Accepted);
        Assert.Contains(locked.Problems, x => x.Code == "month_closed");
        var frozen = (await queries.EmployeesAsync("2026-09", new MonthQuery(null, "منى", null, null, null, null, false, 1, 25), default))!.Rows.Single();
        Assert.Equal((120, 0m), (frozen.OvertimeMinutes, frozen.Deduction));

        // The review, then the HR closing: the staff payroll can take it.
        await ApproveAsync(tenantId, approver);
        await ApproveAsync(tenantId, approver);
        using (var scope3 = database.Scope(tenantId, user: hr.ToString()))
        {
            var closed = await scope3.ServiceProvider.GetRequiredService<IAttendanceMonths>().ClosedAsync("2026-09", default);
            Assert.NotNull(closed);
            var line = closed.Lines.Single(l => l.EmployeeId == mona);
            Assert.Equal((21, 0, 90, 0m, 120), (line.WorkDays, line.Absent, line.LateMinutes, line.DeductionDays, line.OvertimeMinutes));
            Assert.Equal("Closed", (await scope3.ServiceProvider.GetRequiredService<AttendanceQueries>().MonthAsync("2026-09", null, default))!.Status);
            Assert.True((await scope3.ServiceProvider.GetRequiredService<MonthClosing>().ReopenAsync("2026-09", new ReopenInput("تصحيح بصمة متأخر"), default)).IsSuccess);
            Assert.Null(await scope3.ServiceProvider.GetRequiredService<IAttendanceMonths>().ClosedAsync("2026-09", default));
        }

        // Matching by the fingerprint number instead: a number taken by another is refused.
        Assert.True((await setup.SaveEmployeeAsync(mona, new EmployeeSettingInput("1052", false), default)).IsSuccess);
        Assert.Equal("conflict.attendance_badge_taken", (await setup.SaveEmployeeAsync(raed, new EmployeeSettingInput("1052", false), default)).Error.Code);
        Assert.True((await setup.SaveSettingsAsync(new SettingsInput("BadgeNo", 21), default)).IsSuccess);
        Assert.Equal((new DateOnly(2026, 8, 21), new DateOnly(2026, 9, 20)), (await queries.PeriodAsync("2026-09", default))!.Value);
    }

    private static MemoryStream File()
    {
        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet("Sheet1");
        string[] headers = ["الرقم الوظيفي", "الإسم", "التاريخ", "اليوم", "حالة التحضير", "وقت الحضور", "وقت الانصراف", "المغادرات"];
        for (var c = 0; c < headers.Length; c++)
        {
            ws.Cell(1, c + 1).Value = headers[c];
        }

        var r = 2;
        void Row(string key, DateOnly date, string status, string @in, string @out)
        {
            ws.Cell(r, 1).Value = key;
            ws.Cell(r, 3).Value = date.ToDateTime(TimeOnly.MinValue);
            ws.Cell(r, 5).Value = status;
            ws.Cell(r, 6).Value = @in;
            ws.Cell(r, 7).Value = @out;
            ws.Cell(r, 8).Value = "00:00";
            r++;
        }

        for (var d = new DateOnly(2026, 9, 1); d <= new DateOnly(2026, 9, 30); d = d.AddDays(1))
        {
            var weekend = d.DayOfWeek is DayOfWeek.Friday or DayOfWeek.Saturday;
            var (status, i, o) = d.Day switch
            {
                _ when weekend => ("عطلة الأسبوع - ", "-", "-"),
                1 => ("مكتملة - ", "10:45", "17:04"),
                2 => ("غياب - ", "-", "-"),
                3 => ("غير مكتملة - ", "09:05", "-"),
                _ => ("مكتملة - ", "08:58", "17:02"),
            };
            Row("1021553142", d, status, i, o);
            Row("1033103688", d, d.Day == 1 ? "مغادرة - سنوية - اجازة" : weekend ? "عطلة الأسبوع - " : "مكتملة - ", d.Day == 1 || weekend ? "-" : "09:00", d.Day == 1 || weekend ? "-" : "17:00");
        }

        Row("9999999999", new DateOnly(2026, 9, 1), "مكتملة - ", "09:00", "17:00");
        var stream = new MemoryStream();
        wb.SaveAs(stream);
        stream.Position = 0;
        return stream;
    }

    private async Task ApproveAsync(Guid tenantId, Guid approver)
    {
        using var scope = database.Scope(tenantId, user: approver.ToString());
        var workflow = scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Infrastructure.WorkflowDbContext>();
        var task = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.SingleAsync(workflow.WorkItems, w => w.AssigneeUserId == approver && w.Status == IntegratedErp.Modules.Workflow.Domain.WorkItemStatus.Pending);
        Assert.True((await scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workflow.Application.ApprovalEngine>().DecideAsync(task.Id, IntegratedErp.Modules.Workflow.Application.Decision.Approve, "معتمد", null, default)).IsSuccess);
    }

    private async Task<Guid> HrAsync(Guid tenantId, params string[] permissions)
    {
        using var scope = database.Scope(tenantId, user: "setup");
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<PermissionCatalog>();
        var user = UserAccount.Create("مسؤول الحضور", null);
        identity.Users.Add(user);
        var membership = new Membership(user.Id, tenantId);
        identity.Memberships.Add(membership);
        var role = Role.Create($"r-{Guid.NewGuid():N}"[..20], "hr", "hr", permissions, catalog).Value;
        identity.Roles.Add(role);
        identity.RoleAssignments.Add(new RoleAssignment(membership.Id, role.Id, null, tenantId));
        await identity.SaveChangesAsync();
        return user.Id;
    }
}
