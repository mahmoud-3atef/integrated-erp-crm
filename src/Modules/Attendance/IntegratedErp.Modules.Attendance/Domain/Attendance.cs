using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Attendance.Domain;

// Attendance of the company's staff (docs/02-target-architecture/08 §6, docs/03-migration-plan/08): shifts and their
// Ramadan hours, assigned to departments or employees by date, the official holidays, and one record per employee and
// day holding what the fingerprint file said and what HR corrected. The day's status and minutes are not stored: they
// are calculated from these facts whenever they are read, so a changed shift or holiday applies at once (until the
// month is closed).

/// <summary>Where lateness is counted from once the grace period is passed.</summary>
public enum LateFrom
{
    /// <summary>From the end of the grace period (arriving 10:45 on a 09:00 shift with 15 minutes of grace is 90 minutes late), as the fingerprint system counts it.</summary>
    GraceEnd,

    /// <summary>From the start of the shift (the same arrival is 105 minutes late).</summary>
    ShiftStart,
}

/// <summary>Where a shift's late and early minutes come from.</summary>
public enum MinutesSource
{
    /// <summary>As the company's setting says.</summary>
    Company,

    /// <summary>The fingerprint system's report (its own schedules), when the file carries the minutes.</summary>
    Device,

    /// <summary>Calculated from this shift's hours, whatever the file says.</summary>
    Shift,
}

/// <summary>A working shift: its hours, break, grace, rest days and Ramadan hours.</summary>
public sealed class Shift : ITenantOwned
{
    private Shift()
    {
        NameAr = string.Empty;
        NameEn = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    public TimeOnly StartsAt { get; private set; }

    /// <summary>The end of the shift; at or before the start, the shift ends the next day.</summary>
    public TimeOnly EndsAt { get; private set; }

    public int BreakMinutes { get; private set; }

    public int GraceMinutes { get; private set; }

    public LateFrom LateFrom { get; private set; }

    public MinutesSource MinutesSource { get; private set; }

    /// <summary>The rest days as a bit set of <see cref="DayOfWeek"/> (Friday and Saturday by default).</summary>
    public int RestDays { get; private set; }

    public TimeOnly? RamadanStartsAt { get; private set; }

    public TimeOnly? RamadanEndsAt { get; private set; }

    /// <summary>The shift of those with no assignment.</summary>
    public bool IsDefault { get; private set; }

    public bool IsActive { get; private set; } = true;

    public static int Days(params DayOfWeek[] days) => days.Aggregate(0, (bits, d) => bits | (1 << (int)d));

    public bool IsRestDay(DayOfWeek day) => (RestDays & (1 << (int)day)) != 0;

    public static Result<Shift> Create(ShiftValues values)
    {
        var shift = new Shift { Id = Guid.CreateVersion7() };
        var set = shift.Set(values);
        return set.IsFailure ? Result.Failure<Shift>(set.Error) : Result.Success(shift);
    }

    public Result Set(ShiftValues v)
    {
        ArgumentNullException.ThrowIfNull(v);
        if (string.IsNullOrWhiteSpace(v.NameAr) || v.NameAr.Trim().Length > 100 || (v.NameEn?.Trim().Length ?? 0) > 100)
        {
            return Result.Failure(AttendanceErrors.Name);
        }

        if (v.StartsAt == v.EndsAt || v.BreakMinutes is < 0 or > 240 || v.GraceMinutes is < 0 or > 120 || v.RestDays is < 0 or > 127
            || (v.RamadanStartsAt is null) != (v.RamadanEndsAt is null) || (v.RamadanStartsAt is { } rs && rs == v.RamadanEndsAt))
        {
            return Result.Failure(AttendanceErrors.ShiftHours);
        }

        NameAr = v.NameAr.Trim();
        NameEn = string.IsNullOrWhiteSpace(v.NameEn) ? NameAr : v.NameEn.Trim();
        StartsAt = v.StartsAt;
        EndsAt = v.EndsAt;
        BreakMinutes = v.BreakMinutes;
        GraceMinutes = v.GraceMinutes;
        LateFrom = v.LateFrom;
        MinutesSource = v.MinutesSource;
        RestDays = v.RestDays;
        RamadanStartsAt = v.RamadanStartsAt;
        RamadanEndsAt = v.RamadanEndsAt;
        IsActive = v.IsActive;
        return Result.Success();
    }

    public void MakeDefault(bool isDefault) => IsDefault = isDefault;
}

public sealed record ShiftValues(
    string NameAr,
    string? NameEn,
    TimeOnly StartsAt,
    TimeOnly EndsAt,
    int BreakMinutes,
    int GraceMinutes,
    LateFrom LateFrom,
    int RestDays,
    TimeOnly? RamadanStartsAt,
    TimeOnly? RamadanEndsAt,
    bool IsActive,
    MinutesSource MinutesSource = MinutesSource.Company);

/// <summary>A shift given to a department (and the departments under it) or to one employee, from a date.</summary>
public sealed class ShiftAssignment : ITenantOwned
{
    private ShiftAssignment()
    {
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid ShiftId { get; private set; }

    public Guid? DepartmentId { get; private set; }

    public Guid? EmployeeId { get; private set; }

    public DateOnly From { get; private set; }

    public DateOnly? To { get; private set; }

    public static Result<ShiftAssignment> Create(Guid shiftId, Guid? departmentId, Guid? employeeId, DateOnly from, DateOnly? to)
    {
        if ((departmentId is null) == (employeeId is null) || (to is { } t && t < from))
        {
            return Result.Failure<ShiftAssignment>(AttendanceErrors.Assignment);
        }

        return Result.Success(new ShiftAssignment { Id = Guid.CreateVersion7(), ShiftId = shiftId, DepartmentId = departmentId, EmployeeId = employeeId, From = from, To = to });
    }

    public bool Covers(DateOnly day) => From <= day && (To is null || day <= To);
}

public enum HolidayKind
{
    /// <summary>An official holiday: no one is absent on it.</summary>
    Official,

    /// <summary>The month of Ramadan: the shifts' Ramadan hours apply.</summary>
    Ramadan,
}

/// <summary>An official holiday or the dates of Ramadan.</summary>
public sealed class Holiday : ITenantOwned
{
    private Holiday()
    {
        NameAr = string.Empty;
        NameEn = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    public DateOnly From { get; private set; }

    public DateOnly To { get; private set; }

    public HolidayKind Kind { get; private set; }

    public static Result<Holiday> Create(string nameAr, string? nameEn, DateOnly from, DateOnly to, HolidayKind kind)
    {
        var holiday = new Holiday { Id = Guid.CreateVersion7() };
        var set = holiday.Set(nameAr, nameEn, from, to, kind);
        return set.IsFailure ? Result.Failure<Holiday>(set.Error) : Result.Success(holiday);
    }

    public Result Set(string nameAr, string? nameEn, DateOnly from, DateOnly to, HolidayKind kind)
    {
        if (string.IsNullOrWhiteSpace(nameAr) || nameAr.Trim().Length > 100 || (nameEn?.Trim().Length ?? 0) > 100)
        {
            return Result.Failure(AttendanceErrors.Name);
        }

        if (to < from || to.DayNumber - from.DayNumber > 60)
        {
            return Result.Failure(AttendanceErrors.Dates);
        }

        NameAr = nameAr.Trim();
        NameEn = string.IsNullOrWhiteSpace(nameEn) ? NameAr : nameEn.Trim();
        From = from;
        To = to;
        Kind = kind;
        return Result.Success();
    }

    public bool Covers(DateOnly day) => From <= day && day <= To;
}

/// <summary>An employee's attendance settings: their number on the fingerprint device, and whether they are exempt.</summary>
public sealed class EmployeeSetting : ITenantOwned
{
    private EmployeeSetting()
    {
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public string? BadgeNo { get; private set; }

    /// <summary>Exempt from the fingerprint (general manager, some field staff): counted present on working days.</summary>
    public bool Exempt { get; private set; }

    public static EmployeeSetting For(Guid employeeId) => new() { Id = Guid.CreateVersion7(), EmployeeId = employeeId };

    public Result Set(string? badgeNo, bool exempt)
    {
        if ((badgeNo?.Trim().Length ?? 0) > 30)
        {
            return Result.Failure(AttendanceErrors.Badge);
        }

        BadgeNo = string.IsNullOrWhiteSpace(badgeNo) ? null : badgeNo.Trim();
        Exempt = exempt;
        return Result.Success();
    }
}

/// <summary>Which employee number the fingerprint file carries.</summary>
public enum MatchBy
{
    IdNumber,
    EmployeeNo,
    BadgeNo,
}

/// <summary>The company's attendance settings: how the file names employees, its saved columns, and the cycle.</summary>
public sealed class AttendanceSetting : ITenantOwned
{
    private AttendanceSetting()
    {
        Columns = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public MatchBy MatchBy { get; private set; }

    /// <summary>The file's header for each field, as JSON (field → header), from the last import.</summary>
    public string Columns { get; private set; }

    /// <summary>The day the attendance month starts (1 for calendar months; 21 for 21st-to-20th).</summary>
    public int CycleStartDay { get; private set; } = 1;

    /// <summary>
    /// Take the late and early minutes the fingerprint system calculated (it knows each employee's own schedule), when
    /// the file carries them; otherwise they are calculated from the shift.
    /// </summary>
    public bool UseDeviceMinutes { get; private set; } = true;

    public static AttendanceSetting Default() => new() { Id = Guid.CreateVersion7(), MatchBy = MatchBy.IdNumber, Columns = "{}", CycleStartDay = 1, UseDeviceMinutes = true };

    public Result Set(MatchBy matchBy, int cycleStartDay, bool useDeviceMinutes = true)
    {
        if (cycleStartDay is < 1 or > 28)
        {
            return Result.Failure(AttendanceErrors.Cycle);
        }

        MatchBy = matchBy;
        CycleStartDay = cycleStartDay;
        UseDeviceMinutes = useDeviceMinutes;
        return Result.Success();
    }

    public void RememberColumns(string columns) => Columns = columns;

    /// <summary>The month's period: a calendar month, or from the start day of the month before.</summary>
    public (DateOnly From, DateOnly To) Period(int year, int month)
    {
        if (CycleStartDay == 1)
        {
            var first = new DateOnly(year, month, 1);
            return (first, first.AddMonths(1).AddDays(-1));
        }

        var to = new DateOnly(year, month, CycleStartDay - 1);
        return (to.AddMonths(-1).AddDays(1), to);
    }
}

/// <summary>What the fingerprint system said about a day besides the times (its own status words).</summary>
public enum DeviceMark
{
    None,

    /// <summary>A leave recorded in the fingerprint system (annual, sick…).</summary>
    Leave,

    /// <summary>A permission (استئذان): its minutes do not count as late or early.</summary>
    Permission,

    /// <summary>A work mission or secondment: counted present.</summary>
    Mission,
}

/// <summary>A status set by hand for a day, over what was calculated.</summary>
public enum ManualStatus
{
    Present,

    /// <summary>Absence excused by HR: not deducted.</summary>
    Excused,

    /// <summary>A day of leave (until leave requests come in 4.6).</summary>
    Leave,

    Mission,

    Absent,
}

/// <summary>One employee's day: what the file brought and what HR set.</summary>
public sealed class AttendanceDay : ITenantOwned
{
    private AttendanceDay()
    {
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public DateOnly Date { get; private set; }

    public TimeOnly? DeviceIn { get; private set; }

    public TimeOnly? DeviceOut { get; private set; }

    /// <summary>The fingerprint system's status words, kept as they came (for the reviewer).</summary>
    public string? DeviceStatus { get; private set; }

    public DeviceMark DeviceMark { get; private set; }

    public int DevicePermissionMinutes { get; private set; }

    /// <summary>The late minutes the fingerprint system calculated, when the file carries them.</summary>
    public int? DeviceLateMinutes { get; private set; }

    public int? DeviceEarlyMinutes { get; private set; }

    public Guid? ImportId { get; private set; }

    public TimeOnly? ManualIn { get; private set; }

    public TimeOnly? ManualOut { get; private set; }

    public ManualStatus? ManualStatus { get; private set; }

    public string? Note { get; private set; }

    /// <summary>The deduction set by the reviewer, in days; null takes the calculated one (1 for an unexcused absence).</summary>
    public decimal? Deduction { get; private set; }

    public string? EditedByName { get; private set; }

    public DateTimeOffset? EditedAt { get; private set; }

    public TimeOnly? In => ManualIn ?? DeviceIn;

    public TimeOnly? Out => ManualOut ?? DeviceOut;

    public static AttendanceDay For(Guid employeeId, DateOnly date) => new() { Id = Guid.CreateVersion7(), EmployeeId = employeeId, Date = date };

    /// <summary>The file's facts; what HR set stays.</summary>
    public void FromDevice(TimeOnly? @in, TimeOnly? @out, string? status, DeviceMark mark, int permissionMinutes, int? lateMinutes, int? earlyMinutes, Guid importId)
    {
        DeviceLateMinutes = lateMinutes;
        DeviceEarlyMinutes = earlyMinutes;
        DeviceIn = @in;
        DeviceOut = @out;
        // "غياب - " → "غياب": the system's status words without the trailing separator.
        var words = (status ?? string.Empty).Trim().TrimEnd('-', ' ', '_');
        DeviceStatus = words.Length == 0 ? null : words[..Math.Min(words.Length, 200)];
        DeviceMark = mark;
        DevicePermissionMinutes = Math.Max(0, permissionMinutes);
        ImportId = importId;
    }

    public Result Correct(TimeOnly? manualIn, TimeOnly? manualOut, ManualStatus? status, string? note, decimal? deduction, string by, DateTimeOffset at)
    {
        if (deduction is < 0 or > 3 || (note?.Length ?? 0) > 500)
        {
            return Result.Failure(AttendanceErrors.Correction);
        }

        // Excusing an absence needs its reason.
        if (status == Domain.ManualStatus.Excused && string.IsNullOrWhiteSpace(note))
        {
            return Result.Failure(AttendanceErrors.Note);
        }

        ManualIn = manualIn;
        ManualOut = manualOut;
        ManualStatus = status;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        Deduction = deduction;
        EditedByName = by;
        EditedAt = at;
        return Result.Success();
    }
}

/// <summary>An imported fingerprint file: its period and counts (the rows themselves become days).</summary>
public sealed class AttendanceImport : ITenantOwned
{
    private AttendanceImport()
    {
        FileName = string.Empty;
        CreatedByName = string.Empty;
        Problems = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string FileName { get; private set; }

    /// <summary>The first and last dates in the file: within them, a working day with no row is an absence.</summary>
    public DateOnly From { get; private set; }

    public DateOnly To { get; private set; }

    public int Rows { get; private set; }

    public int Accepted { get; private set; }

    public int Rejected { get; private set; }

    public int Employees { get; private set; }

    /// <summary>The rejected rows and warnings, as JSON, for the error report.</summary>
    public string Problems { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static AttendanceImport Create(string fileName, DateOnly from, DateOnly to, int rows, int accepted, int rejected, int employees, string problems, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        FileName = fileName.Length > 200 ? fileName[..200] : fileName,
        From = from,
        To = to,
        Rows = rows,
        Accepted = accepted,
        Rejected = rejected,
        Employees = employees,
        Problems = problems,
        CreatedByName = by,
        CreatedAt = at,
    };
}

public static class AttendanceErrors
{
    public static readonly Error ShiftNotFound = Error.NotFound("attendance_shift", "Shift not found.");
    public static readonly Error HolidayNotFound = Error.NotFound("attendance_holiday", "Holiday not found.");
    public static readonly Error AssignmentNotFound = Error.NotFound("attendance_assignment", "Assignment not found.");
    public static readonly Error EmployeeNotFound = Error.NotFound("attendance_employee", "Employee not found.");
    public static readonly Error Name = Error.Validation("attendance_name", "Enter the name (Arabic required, 100 characters at most).");
    public static readonly Error ShiftHours = Error.Validation("attendance_shift_hours", "The shift's hours, break, grace or Ramadan hours are not valid.");
    public static readonly Error Assignment = Error.Validation("attendance_assignment", "Assign the shift to a department or to an employee, with an end on or after the start.");
    public static readonly Error Dates = Error.Validation("attendance_dates", "The end is before the start, or the period is longer than 60 days.");
    public static readonly Error Badge = Error.Validation("attendance_badge", "The fingerprint number is 30 characters at most.");
    public static readonly Error BadgeTaken = Error.Conflict("attendance_badge_taken", "Another employee has this fingerprint number.");
    public static readonly Error Cycle = Error.Validation("attendance_cycle", "The month starts on a day from 1 to 28.");
    public static readonly Error Correction = Error.Validation("attendance_correction", "The deduction is 0 to 3 days and the note 500 characters at most.");
    public static readonly Error Note = Error.Validation("attendance_note", "Excusing an absence needs its reason.");
    public static readonly Error File = Error.Validation("attendance_file", "The file has no rows we can read: a column of employee numbers and a column of dates are needed.");
    public static readonly Error ShiftInUse = Error.Conflict("attendance_shift_in_use", "The shift is assigned, or it is the default shift.");
    public static readonly Error MonthNotFound = Error.NotFound("attendance_month", "Attendance month not found.");
    public static readonly Error OvertimeNotFound = Error.NotFound("attendance_overtime", "Overtime request not found.");
    public static readonly Error MonthNotOpen = Error.Conflict("attendance_month_not_open", "The month is in approval or closed.");
    public static readonly Error MonthNotClosed = Error.Conflict("attendance_month_not_closed", "Only a closed month can be reopened.");
    public static readonly Error MonthLocked = Error.Conflict("attendance_month_locked", "The day's month is in approval or closed: its days cannot change.");
    public static readonly Error MonthEmpty = Error.Validation("attendance_month_empty", "The month has no attendance to close.");
    public static readonly Error Reason = Error.Validation("attendance_reason", "Give the reason (500 characters at most).");
    public static readonly Error Overtime = Error.Validation("attendance_overtime_fields", "Overtime is 15 minutes to 12 hours, with its reason.");
    public static readonly Error OvertimeNotAmendable = Error.Conflict("attendance_overtime_not_amendable", "Only an approved overtime request can be changed or cancelled after its approval.");
    public static readonly Error AmendReason = Error.Validation("attendance_amend_reason", "Give the reason (500 characters at most).");
    public static readonly Error OvertimeNotReturned = Error.Conflict("attendance_overtime_not_returned", "Only a returned request can be sent again.");
}
