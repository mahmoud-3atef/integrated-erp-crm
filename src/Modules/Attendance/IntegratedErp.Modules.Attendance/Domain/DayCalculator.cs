namespace IntegratedErp.Modules.Attendance.Domain;

/// <summary>The status of a calculated day.</summary>
public enum DayStatus
{
    /// <summary>Before the hire date, after the end of service, or outside every imported file: not counted.</summary>
    NoData,

    Present,

    /// <summary>Only one of the entry and the exit: an exception to review.</summary>
    MissingPunch,

    Absent,

    Rest,

    Holiday,

    Leave,

    Mission,

    /// <summary>An absence excused by HR.</summary>
    Excused,

    /// <summary>Exempt from the fingerprint: counted present.</summary>
    Exempt,
}

/// <summary>The shift's hours on a given day (its Ramadan hours in Ramadan).</summary>
public sealed record ShiftDay(TimeOnly StartsAt, TimeOnly EndsAt, int BreakMinutes, int GraceMinutes, LateFrom LateFrom, bool IsRestDay);

/// <summary>Everything a day's calculation needs.</summary>
public sealed record DayFacts(
    DateOnly Date,
    bool Employed,
    bool Covered,
    bool Exempt,
    bool Holiday,
    ShiftDay Shift,
    TimeOnly? In,
    TimeOnly? Out,
    DeviceMark Mark,
    int PermissionMinutes,
    ManualStatus? Manual,
    decimal? Deduction,
    int? DeviceLate = null,
    int? DeviceEarly = null,
    bool ApprovedLeave = false);

public sealed record DayResult(DayStatus Status, int WorkedMinutes, int LateMinutes, int EarlyMinutes, decimal Deduction)
{
    public bool IsWorkingDay => Status is DayStatus.Present or DayStatus.MissingPunch or DayStatus.Absent or DayStatus.Excused or DayStatus.Mission or DayStatus.Exempt or DayStatus.Leave;
}

/// <summary>
/// One employee's day from the facts: the status, the minutes worked, late and early, and the deduction in days. Lateness
/// counts only past the grace period, from its end or from the shift's start as the shift says; a permission's minutes are
/// taken off the late and early minutes; when the fingerprint system's own late and early minutes are given, they are
/// taken instead; an unexcused absence is one day's deduction unless the reviewer set another.
/// </summary>
public static class DayCalculator
{
    public static DayResult Calculate(DayFacts f)
    {
        ArgumentNullException.ThrowIfNull(f);
        if (!f.Employed || !f.Covered)
        {
            return new(DayStatus.NoData, 0, 0, 0, 0);
        }

        var status = f.Manual switch
        {
            ManualStatus.Present => DayStatus.Present,
            ManualStatus.Excused => DayStatus.Excused,
            ManualStatus.Leave => DayStatus.Leave,
            ManualStatus.Mission => DayStatus.Mission,
            ManualStatus.Absent => DayStatus.Absent,
            _ => Automatic(f),
        };

        int worked = 0, late = 0, early = 0;
        if (status is DayStatus.Present or DayStatus.MissingPunch)
        {
            (worked, late, early) = Minutes(f);
            if (f.DeviceLate is not null || f.DeviceEarly is not null)
            {
                // The fingerprint system's own figures (its permissions already counted).
                return new(status, worked, f.DeviceLate ?? late, f.DeviceEarly ?? early, f.Deduction ?? 0m);
            }

            var waived = Math.Min(f.PermissionMinutes, late + early);
            var fromLate = Math.Min(waived, late);
            late -= fromLate;
            early -= waived - fromLate;
        }

        var deduction = f.Deduction ?? (status == DayStatus.Absent ? 1m : 0m);
        return new(status, worked, late, early, deduction);
    }

    private static DayStatus Automatic(DayFacts f)
    {
        if (f.Holiday)
        {
            return DayStatus.Holiday;
        }

        if (f.Shift.IsRestDay)
        {
            return DayStatus.Rest;
        }

        // An approved leave request: leave, whatever the punches say.
        if (f.ApprovedLeave)
        {
            return DayStatus.Leave;
        }

        if (f.Exempt)
        {
            return DayStatus.Exempt;
        }

        return f.Mark switch
        {
            DeviceMark.Leave when f.In is null || f.Out is null => DayStatus.Leave,
            DeviceMark.Mission => DayStatus.Mission,
            _ when f.In is null && f.Out is null => DayStatus.Absent,
            _ when f.In is null || f.Out is null => DayStatus.MissingPunch,
            _ => DayStatus.Present,
        };
    }

    /// <summary>The minutes, on a line of minutes from the shift day's midnight (an overnight shift's end is the next day).</summary>
    private static (int Worked, int Late, int Early) Minutes(DayFacts f)
    {
        var s = f.Shift;
        var start = Of(s.StartsAt);
        var end = Of(s.EndsAt);
        if (end <= start)
        {
            end += 1440;
        }

        int? Place(TimeOnly? t)
        {
            if (t is not { } v)
            {
                return null;
            }

            // A time well before the start of an overnight shift belongs to the next day.
            var m = Of(v);
            return end > 1440 && m < start - 240 ? m + 1440 : m;
        }

        var @in = Place(f.In);
        var @out = Place(f.Out);
        var late = 0;
        if (@in is { } i && i > start + s.GraceMinutes)
        {
            late = i - (s.LateFrom == LateFrom.GraceEnd ? start + s.GraceMinutes : start);
        }

        var early = @out is { } o && o < end ? end - o : 0;
        var worked = 0;
        if (@in is { } a && @out is { } b && b > a)
        {
            worked = b - a;
            if (worked > s.BreakMinutes + 60)
            {
                worked -= s.BreakMinutes;
            }
        }

        return (worked, late, early);
    }

    private static int Of(TimeOnly t) => (t.Hour * 60) + t.Minute;
}
