using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Attendance.Domain;
using IntegratedErp.Modules.Attendance.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Attendance.Application;

public sealed record ShiftInput(
    string NameAr,
    string? NameEn,
    TimeOnly StartsAt,
    TimeOnly EndsAt,
    int BreakMinutes,
    int GraceMinutes,
    string LateFrom,
    IReadOnlyList<int> RestDays,
    TimeOnly? RamadanStartsAt,
    TimeOnly? RamadanEndsAt,
    bool IsActive,
    bool IsDefault);

public sealed record ShiftDto(
    Guid Id,
    string NameAr,
    string NameEn,
    TimeOnly StartsAt,
    TimeOnly EndsAt,
    int BreakMinutes,
    int GraceMinutes,
    string LateFrom,
    IReadOnlyList<int> RestDays,
    TimeOnly? RamadanStartsAt,
    TimeOnly? RamadanEndsAt,
    bool IsActive,
    bool IsDefault,
    int Employees,
    IReadOnlyList<AssignmentDto> Assignments);

public sealed record AssignmentInput(Guid ShiftId, Guid? DepartmentId, Guid? EmployeeId, DateOnly From, DateOnly? To);

public sealed record AssignmentDto(Guid Id, Guid ShiftId, Guid? DepartmentId, Guid? EmployeeId, string? NameAr, string? NameEn, DateOnly From, DateOnly? To);

public sealed record HolidayInput(string NameAr, string? NameEn, DateOnly From, DateOnly To, string Kind);

public sealed record HolidayDto(Guid Id, string NameAr, string NameEn, DateOnly From, DateOnly To, string Kind, int Days);

public sealed record SettingsInput(string MatchBy, int CycleStartDay, bool UseDeviceMinutes = true);

public sealed record SettingsDto(string MatchBy, int CycleStartDay, bool UseDeviceMinutes);

public sealed record EmployeeSettingInput(string? BadgeNo, bool Exempt);

public sealed record SetupDto(SettingsDto Settings, IReadOnlyList<ShiftDto> Shifts, IReadOnlyList<HolidayDto> Holidays);

/// <summary>The shifts and who has them, the holidays and Ramadan, the company's settings and an employee's fingerprint number.</summary>
internal sealed class AttendanceSetup(AttendanceDbContext db, IStaffDirectory staff, IClock clock)
{
    /// <summary>The settings, and the default shift (09:00–17:00 with 15 minutes of grace, Friday and Saturday off) the first time.</summary>
    public async Task<AttendanceSetting> SettingAsync(CancellationToken cancellationToken)
    {
        var setting = await db.Settings.FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (setting is not null)
        {
            return setting;
        }

        setting = AttendanceSetting.Default();
        db.Settings.Add(setting);
        if (!await db.Shifts.AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            var shift = Shift.Create(new ShiftValues("الدوام الرسمي", "Regular hours", new TimeOnly(9, 0), new TimeOnly(17, 0), 0, 15, LateFrom.GraceEnd, Shift.Days(DayOfWeek.Friday, DayOfWeek.Saturday), null, null, true)).Value;
            shift.MakeDefault(true);
            db.Shifts.Add(shift);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return setting;
    }

    public async Task<SetupDto> SetupAsync(int year, CancellationToken cancellationToken)
    {
        var setting = await SettingAsync(cancellationToken).ConfigureAwait(false);
        var members = await staff.MembersAsync(cancellationToken).ConfigureAwait(false);
        var departments = (await staff.DepartmentsAsync(cancellationToken).ConfigureAwait(false)).ToDictionary(d => d.Id);
        var names = members.ToDictionary(m => m.Id);
        var assignments = await db.Assignments.AsNoTracking().OrderBy(a => a.From).ToListAsync(cancellationToken).ConfigureAwait(false);
        var shifts = await db.Shifts.AsNoTracking().OrderByDescending(s => s.IsDefault).ThenBy(s => s.NameAr).ToListAsync(cancellationToken).ConfigureAwait(false);

        // Who has which shift today, counted the way the days are calculated.
        var today = clock.Today;
        var book = await AttendanceBook.LoadAsync(db, staff, today, today, Guid.Empty, cancellationToken).ConfigureAwait(false);
        var counts = members.Where(m => AttendanceBook.Employed(m, today)).GroupBy(m => book.ShiftFor(m, today)?.Id).ToDictionary(g => g.Key ?? Guid.Empty, g => g.Count());

        var holidays = await db.Holidays.AsNoTracking().Where(h => h.From.Year == year || h.To.Year == year).OrderBy(h => h.From).ToListAsync(cancellationToken).ConfigureAwait(false);
        return new SetupDto(
            new SettingsDto(setting.MatchBy.ToString(), setting.CycleStartDay, setting.UseDeviceMinutes),
            shifts.Select(s => new ShiftDto(
                s.Id, s.NameAr, s.NameEn, s.StartsAt, s.EndsAt, s.BreakMinutes, s.GraceMinutes, s.LateFrom.ToString(),
                Enumerable.Range(0, 7).Where(d => s.IsRestDay((DayOfWeek)d)).ToList(), s.RamadanStartsAt, s.RamadanEndsAt, s.IsActive, s.IsDefault,
                counts.GetValueOrDefault(s.Id),
                assignments.Where(a => a.ShiftId == s.Id).Select(a =>
                {
                    var d = a.DepartmentId is { } did ? departments.GetValueOrDefault(did) : null;
                    var m = a.EmployeeId is { } eid ? names.GetValueOrDefault(eid) : null;
                    return new AssignmentDto(a.Id, a.ShiftId, a.DepartmentId, a.EmployeeId, d?.NameAr ?? m?.NameAr ?? m?.NameEn, d?.NameEn ?? m?.NameEn, a.From, a.To);
                }).ToList())).ToList(),
            holidays.Select(h => new HolidayDto(h.Id, h.NameAr, h.NameEn, h.From, h.To, h.Kind.ToString(), h.To.DayNumber - h.From.DayNumber + 1)).ToList());
    }

    public async Task<Result> SaveSettingsAsync(SettingsInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var setting = await SettingAsync(cancellationToken).ConfigureAwait(false);
        if (!Enum.TryParse<MatchBy>(input.MatchBy, out var matchBy))
        {
            return Result.Failure(AttendanceErrors.Cycle);
        }

        var set = setting.Set(matchBy, input.CycleStartDay, input.UseDeviceMinutes);
        if (set.IsSuccess)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return set;
    }

    public async Task<Result<Guid>> SaveShiftAsync(Guid? id, ShiftInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        await SettingAsync(cancellationToken).ConfigureAwait(false);
        var values = new ShiftValues(
            input.NameAr, input.NameEn, input.StartsAt, input.EndsAt, input.BreakMinutes, input.GraceMinutes,
            Enum.TryParse<LateFrom>(input.LateFrom, out var lateFrom) ? lateFrom : LateFrom.GraceEnd,
            Shift.Days([.. (input.RestDays ?? []).Where(d => d is >= 0 and <= 6).Select(d => (DayOfWeek)d)]),
            input.RamadanStartsAt, input.RamadanEndsAt, input.IsActive || input.IsDefault);
        Shift shift;
        if (id is { } existing)
        {
            if (await db.Shifts.FirstOrDefaultAsync(s => s.Id == existing, cancellationToken).ConfigureAwait(false) is not { } found)
            {
                return Result.Failure<Guid>(AttendanceErrors.ShiftNotFound);
            }

            shift = found;
            var set = shift.Set(values);
            if (set.IsFailure)
            {
                return Result.Failure<Guid>(set.Error);
            }
        }
        else
        {
            var created = Shift.Create(values);
            if (created.IsFailure)
            {
                return Result.Failure<Guid>(created.Error);
            }

            shift = created.Value;
            db.Shifts.Add(shift);
        }

        if (input.IsDefault && !shift.IsDefault)
        {
            foreach (var other in await db.Shifts.Where(s => s.IsDefault).ToListAsync(cancellationToken).ConfigureAwait(false))
            {
                other.MakeDefault(false);
            }

            shift.MakeDefault(true);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(shift.Id);
    }

    public async Task<Result> DeleteShiftAsync(Guid id, CancellationToken cancellationToken)
    {
        if (await db.Shifts.FirstOrDefaultAsync(s => s.Id == id, cancellationToken).ConfigureAwait(false) is not { } shift)
        {
            return Result.Failure(AttendanceErrors.ShiftNotFound);
        }

        if (shift.IsDefault || await db.Assignments.AnyAsync(a => a.ShiftId == id, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(AttendanceErrors.ShiftInUse);
        }

        db.Shifts.Remove(shift);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result<Guid>> AssignAsync(AssignmentInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!await db.Shifts.AnyAsync(s => s.Id == input.ShiftId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(AttendanceErrors.ShiftNotFound);
        }

        var created = ShiftAssignment.Create(input.ShiftId, input.DepartmentId, input.EmployeeId, input.From, input.To);
        if (created.IsFailure)
        {
            return Result.Failure<Guid>(created.Error);
        }

        db.Assignments.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(created.Value.Id);
    }

    public async Task<Result> UnassignAsync(Guid id, CancellationToken cancellationToken)
    {
        if (await db.Assignments.FirstOrDefaultAsync(a => a.Id == id, cancellationToken).ConfigureAwait(false) is not { } a)
        {
            return Result.Failure(AttendanceErrors.AssignmentNotFound);
        }

        db.Assignments.Remove(a);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result<Guid>> SaveHolidayAsync(Guid? id, HolidayInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var kind = Enum.TryParse<HolidayKind>(input.Kind, out var k) ? k : HolidayKind.Official;
        if (id is { } existing)
        {
            if (await db.Holidays.FirstOrDefaultAsync(h => h.Id == existing, cancellationToken).ConfigureAwait(false) is not { } found)
            {
                return Result.Failure<Guid>(AttendanceErrors.HolidayNotFound);
            }

            var set = found.Set(input.NameAr, input.NameEn, input.From, input.To, kind);
            if (set.IsFailure)
            {
                return Result.Failure<Guid>(set.Error);
            }

            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Success(found.Id);
        }

        var created = Holiday.Create(input.NameAr, input.NameEn, input.From, input.To, kind);
        if (created.IsFailure)
        {
            return Result.Failure<Guid>(created.Error);
        }

        db.Holidays.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(created.Value.Id);
    }

    public async Task<Result> DeleteHolidayAsync(Guid id, CancellationToken cancellationToken)
    {
        if (await db.Holidays.FirstOrDefaultAsync(h => h.Id == id, cancellationToken).ConfigureAwait(false) is not { } h)
        {
            return Result.Failure(AttendanceErrors.HolidayNotFound);
        }

        db.Holidays.Remove(h);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> SaveEmployeeAsync(Guid employeeId, EmployeeSettingInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if ((await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).All(m => m.Id != employeeId))
        {
            return Result.Failure(AttendanceErrors.EmployeeNotFound);
        }

        var badge = string.IsNullOrWhiteSpace(input.BadgeNo) ? null : input.BadgeNo.Trim();
        if (badge is not null && await db.EmployeeSettings.AnyAsync(s => s.BadgeNo == badge && s.EmployeeId != employeeId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(AttendanceErrors.BadgeTaken);
        }

        var setting = await db.EmployeeSettings.FirstOrDefaultAsync(s => s.EmployeeId == employeeId, cancellationToken).ConfigureAwait(false);
        if (setting is null)
        {
            setting = EmployeeSetting.For(employeeId);
            db.EmployeeSettings.Add(setting);
        }

        var set = setting.Set(badge, input.Exempt);
        if (set.IsSuccess)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return set;
    }
}
