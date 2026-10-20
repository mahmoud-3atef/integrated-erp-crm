using ClosedXML.Excel;
using IntegratedErp.Modules.Attendance.Application;
using IntegratedErp.Modules.Attendance.Domain;

namespace IntegratedErp.UnitTests.Attendance;

public sealed class DayCalculatorTests
{
    // The regular shift: 09:00–17:00, 15 minutes of grace, lateness from the end of the grace (as the fingerprint system counts it).
    private static readonly ShiftDay Regular = new(new TimeOnly(9, 0), new TimeOnly(17, 0), 0, 15, LateFrom.GraceEnd, false);

    [Fact]
    public void Arriving_within_the_grace_is_not_late_and_past_it_counts_from_its_end()
    {
        Assert.Equal(0, Day(Regular, T(9, 14), T(17, 0)).LateMinutes);
        var late = Day(Regular, T(10, 45), T(17, 4));
        Assert.Equal((DayStatus.Present, 90, 0), (late.Status, late.LateMinutes, late.EarlyMinutes));
        Assert.Equal(105, Day(Regular with { LateFrom = LateFrom.ShiftStart }, T(10, 45), T(17, 4)).LateMinutes);
    }

    [Fact]
    public void Leaving_before_the_end_is_early_and_a_permission_takes_its_minutes_off()
    {
        var early = Day(Regular, T(9, 0), T(16, 33));
        Assert.Equal((27, 453), (early.EarlyMinutes, early.WorkedMinutes));

        var excused = DayCalculator.Calculate(Facts(Regular, T(9, 36), T(15, 26)) with { Mark = DeviceMark.Permission, PermissionMinutes = 90 });
        Assert.Equal((0, 25), (excused.LateMinutes, excused.EarlyMinutes));
    }

    [Fact]
    public void No_punches_on_a_working_day_is_an_absence_of_one_day_unless_excused_or_set()
    {
        Assert.Equal((DayStatus.Absent, 1m), Pair(Day(Regular, null, null)));
        Assert.Equal((DayStatus.Excused, 0m), Pair(DayCalculator.Calculate(Facts(Regular, null, null) with { Manual = ManualStatus.Excused })));
        Assert.Equal((DayStatus.Absent, 0.5m), Pair(DayCalculator.Calculate(Facts(Regular, null, null) with { Deduction = 0.5m })));
    }

    [Fact]
    public void One_punch_is_a_missing_punch_and_rest_days_holidays_and_leave_are_not_absences()
    {
        Assert.Equal(DayStatus.MissingPunch, Day(Regular, T(9, 46), null).Status);
        Assert.Equal((DayStatus.Rest, 0m), Pair(Day(Regular with { IsRestDay = true }, null, null)));
        Assert.Equal(DayStatus.Holiday, DayCalculator.Calculate(Facts(Regular, null, null) with { Holiday = true }).Status);
        Assert.Equal(DayStatus.Leave, DayCalculator.Calculate(Facts(Regular, null, null) with { Mark = DeviceMark.Leave }).Status);
        Assert.Equal(DayStatus.Mission, DayCalculator.Calculate(Facts(Regular, T(9, 0), null) with { Mark = DeviceMark.Mission }).Status);
        Assert.Equal(DayStatus.Exempt, DayCalculator.Calculate(Facts(Regular, null, null) with { Exempt = true }).Status);
    }

    [Fact]
    public void Outside_the_employment_or_the_file_the_day_does_not_count()
    {
        Assert.Equal(DayStatus.NoData, DayCalculator.Calculate(Facts(Regular, null, null) with { Employed = false }).Status);
        Assert.Equal(DayStatus.NoData, DayCalculator.Calculate(Facts(Regular, null, null) with { Covered = false }).Status);
    }

    [Fact]
    public void The_fingerprint_systems_own_minutes_are_taken_when_given()
    {
        // The device knows a later schedule for this employee: 10:16 is not late for it.
        var day = DayCalculator.Calculate(Facts(Regular, T(10, 16), T(16, 52)) with { DeviceLate = 0, DeviceEarly = 4 });
        Assert.Equal((DayStatus.Present, 0, 4, 0m), (day.Status, day.LateMinutes, day.EarlyMinutes, day.Deduction));
    }

    [Fact]
    public void An_approved_permission_waives_late_minutes_even_on_the_devices_figures()
    {
        var day = DayCalculator.Calculate(Facts(Regular, T(10, 45), T(17, 0)) with { DeviceLate = 90, DeviceEarly = 0, ApprovedPermissionMinutes = 60 });
        Assert.Equal((30, 0), (day.LateMinutes, day.EarlyMinutes));
        var shift = DayCalculator.Calculate(Facts(Regular, T(10, 45), T(16, 0)) with { ApprovedPermissionMinutes = 120 });
        Assert.Equal((0, 30), (shift.LateMinutes, shift.EarlyMinutes));
    }

    [Fact]
    public void An_overnight_shift_ends_the_next_day()
    {
        var night = new ShiftDay(new TimeOnly(20, 0), new TimeOnly(4, 0), 60, 15, LateFrom.GraceEnd, false);
        var day = Day(night, T(20, 30), T(3, 30));
        Assert.Equal((15, 30, 360), (day.LateMinutes, day.EarlyMinutes, day.WorkedMinutes));
    }

    [Fact]
    public void The_file_is_read_by_its_arabic_headers_and_rows_without_data_are_marked()
    {
        using var stream = Workbook(
            ["الرقم الوظيفي", "الإسم", "التاريخ", "اليوم", "حالة التحضير", "ساعات الدوام", "وقت الحضور", "وقت الانصراف", "المغادرات"],
            ["1021553142", "شروق", 46163, "الخميس", "مكتملة - ", "08:00", "08:50", "17:22", "00:00"],
            ["1021553142", "شروق", 46187, "الأحد", "مغادرة - طارئ  - استئذان", "08:00", "09:19", "17:00", "00:19"],
            ["1021553142", "شروق", 46168, "الثلاثاء", "غياب - ", "08:00", "-", "-", "00:00"],
            ["2610771160", "x", 46163, "الخميس", "_ - ", "_", "-", "-", "_"],
            ["المجموع", null, null, null, null, "168:00", null, null, null]);
        var file = AttendanceFile.Read(stream, null);

        Assert.Equal(4, file.Rows.Count);
        Assert.Equal("وقت الحضور", file.Mapping[FileField.In]);
        var first = file.Rows[0];
        Assert.Equal((new DateOnly(2026, 5, 21), T(8, 50), T(17, 22)), (first.Date, first.In, first.Out));
        Assert.Equal((DeviceMark.Permission, 19), (AttendanceFile.Mark(file.Rows[1].Status), file.Rows[1].PermissionMinutes));
        Assert.Equal((null, null, false), (file.Rows[2].In, file.Rows[2].Out, file.Rows[2].NoData));
        Assert.True(file.Rows[3].NoData);
        Assert.Equal(DeviceMark.Leave, AttendanceFile.Mark("مغادرة - سنوية - اجازة"));
        Assert.Equal(DeviceMark.Mission, AttendanceFile.Mark("مكتملة - رسمية  - مهمة عمل "));
    }

    [Fact]
    public void A_cycle_from_the_21st_runs_from_the_month_before()
    {
        var setting = AttendanceSetting.Default();
        Assert.Equal((new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30)), setting.Period(2026, 9));
        setting.Set(MatchBy.IdNumber, 21);
        Assert.Equal((new DateOnly(2026, 8, 21), new DateOnly(2026, 9, 20)), setting.Period(2026, 9));
    }

    private static TimeOnly T(int h, int m) => new(h, m);

    private static (DayStatus, decimal) Pair(DayResult r) => (r.Status, r.Deduction);

    private static DayFacts Facts(ShiftDay shift, TimeOnly? @in, TimeOnly? @out) =>
        new(new DateOnly(2026, 9, 7), true, true, false, false, shift, @in, @out, DeviceMark.None, 0, null, null);

    private static DayResult Day(ShiftDay shift, TimeOnly? @in, TimeOnly? @out) => DayCalculator.Calculate(Facts(shift, @in, @out));

    private static MemoryStream Workbook(string[] headers, params object?[][] rows)
    {
        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet("Sheet1");
        ws.Cell(2, 7).Value = "الحضور والانصراف لموظفين من: 2026/05/21 الى 2026/06/18";
        for (var c = 0; c < headers.Length; c++)
        {
            ws.Cell(4, c + 1).Value = headers[c];
        }

        for (var r = 0; r < rows.Length; r++)
        {
            for (var c = 0; c < rows[r].Length; c++)
            {
                ws.Cell(5 + r, c + 1).Value = rows[r][c] switch
                {
                    null => Blank.Value,
                    int n => n,
                    var v => v.ToString(),
                };
            }
        }

        var stream = new MemoryStream();
        wb.SaveAs(stream);
        stream.Position = 0;
        return stream;
    }
}
