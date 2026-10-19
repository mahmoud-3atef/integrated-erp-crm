using IntegratedErp.Modules.Attendance.Domain;
using IntegratedErp.Modules.Attendance.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Staff.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Attendance.Application;

public sealed record NamedRef(Guid Id, string NameAr, string NameEn);

public sealed record ImportInfo(Guid Id, string FileName, DateOnly From, DateOnly To, int Rows, int Accepted, int Rejected, int Employees, string CreatedByName, DateTimeOffset CreatedAt);

public sealed record MonthKpis(
    int Employees,
    int WithFullPunches,
    int WithoutPunches,
    int OnLeaveAllMonth,
    int AbsenceDays,
    decimal DeductionDays,
    int ExcusedDays,
    int LateMinutes,
    int LateEmployees,
    int EarlyMinutes,
    int MissingPunches,
    int OpenExceptions);

public sealed record MonthDto(
    string Period,
    DateOnly From,
    DateOnly To,
    int CycleStartDay,
    bool HasData,
    ImportInfo? LastImport,
    MonthKpis Kpis,
    IReadOnlyList<NamedRef> Shifts,
    IReadOnlyList<NamedRef> Departments,
    IReadOnlyList<NamedRef> LegalEntities);

public sealed record MonthRowDto(
    Guid EmployeeId,
    string EmployeeNo,
    string? NameAr,
    string NameEn,
    string? DepartmentAr,
    string? DepartmentEn,
    string? ShiftAr,
    string? ShiftEn,
    int WorkDays,
    int Present,
    int Absent,
    int Leave,
    int LateMinutes,
    int EarlyMinutes,
    int MissingPunches,
    decimal Deduction,
    string State);

public sealed record MonthTotals(int Employees, int WorkDays, int Present, int Absent, int Leave, int LateMinutes, int EarlyMinutes, int MissingPunches, decimal Deduction);

public sealed record MonthPageDto(IReadOnlyList<MonthRowDto> Rows, int Total, MonthTotals Totals);

public sealed record MonthQuery(Guid? LegalEntityId, string? Search, Guid? DepartmentId, Guid? ShiftId, string? State, string? Sort, bool Desc, int Page, int PageSize);

public sealed record DayDto(
    DateOnly Date,
    string Status,
    bool IsWorkingDay,
    string? HolidayAr,
    string? HolidayEn,
    bool Ramadan,
    TimeOnly ShiftStartsAt,
    TimeOnly ShiftEndsAt,
    TimeOnly? In,
    TimeOnly? Out,
    TimeOnly? DeviceIn,
    TimeOnly? DeviceOut,
    string? DeviceStatus,
    int PermissionMinutes,
    int? DeviceLateMinutes,
    int? DeviceEarlyMinutes,
    string? ManualStatus,
    string? Note,
    decimal? DeductionSet,
    int WorkedMinutes,
    int LateMinutes,
    int EarlyMinutes,
    decimal Deduction,
    string? EditedByName,
    DateTimeOffset? EditedAt);

public sealed record EmployeeMonthDto(
    Guid EmployeeId,
    string EmployeeNo,
    string? NameAr,
    string NameEn,
    string? IdNumber,
    string? DepartmentAr,
    string? DepartmentEn,
    string? ShiftAr,
    string? ShiftEn,
    TimeOnly? ShiftStartsAt,
    TimeOnly? ShiftEndsAt,
    int? GraceMinutes,
    string? BadgeNo,
    bool Exempt,
    MonthRowDto Summary,
    IReadOnlyList<DayDto> Days);

public sealed record ExceptionDto(Guid EmployeeId, string EmployeeNo, string? NameAr, string NameEn, string? DepartmentAr, string? DepartmentEn, DateOnly Date, string Status, TimeOnly? In, TimeOnly? Out, string? DeviceStatus);

/// <summary>The attendance month (per commercial registration or all), its employees, an employee's days, and the exceptions.</summary>
internal sealed class AttendanceQueries(AttendanceDbContext db, IStaffDirectory staff, ILegalEntityDirectory legalEntities, AttendanceSetup setup)
{
    public async Task<(DateOnly From, DateOnly To)?> PeriodAsync(string period, CancellationToken cancellationToken)
    {
        if (!TryParse(period, out var year, out var month))
        {
            return null;
        }

        var setting = await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        return setting.Period(year, month);
    }

    public async Task<MonthDto?> MonthAsync(string period, Guid? legalEntityId, CancellationToken cancellationToken)
    {
        if (await PeriodAsync(period, cancellationToken).ConfigureAwait(false) is not { } p)
        {
            return null;
        }

        var setting = await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        var book = await AttendanceBook.LoadAsync(db, staff, p.From, p.To, null, cancellationToken).ConfigureAwait(false);
        var rows = Rows(book, legalEntityId).ToList();
        int absence = 0, excused = 0, late = 0, early = 0, missing = 0, open = 0, lateEmployees = 0, full = 0, none = 0, allLeave = 0;
        decimal deduction = 0;
        foreach (var (m, results) in rows)
        {
            var working = results.Where(r => r.Result.IsWorkingDay).ToList();
            absence += working.Count(r => r.Result.Status == DayStatus.Absent);
            excused += working.Count(r => r.Result.Status == DayStatus.Excused);
            missing += working.Count(r => r.Result.Status == DayStatus.MissingPunch);
            open += working.Count(r => r.Result.Status == DayStatus.MissingPunch || (r.Result.Status == DayStatus.Absent && r.Stored?.ManualStatus is null && r.Stored?.Deduction is null));
            var l = working.Sum(r => r.Result.LateMinutes);
            late += l;
            lateEmployees += l > 0 ? 1 : 0;
            early += working.Sum(r => r.Result.EarlyMinutes);
            deduction += working.Sum(r => r.Result.Deduction);
            if (working.Count > 0 && working.All(r => r.Result.Status == DayStatus.Leave))
            {
                allLeave++;
            }
            else if (working.Count > 0 && working.All(r => r.Result.Status is DayStatus.Absent))
            {
                none++;
            }
            else if (working.Count > 0 && working.All(r => r.Result.Status is DayStatus.Present or DayStatus.Mission or DayStatus.Leave or DayStatus.Exempt or DayStatus.Excused))
            {
                full++;
            }
        }

        var entities = await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false);
        var departments = await staff.DepartmentsAsync(cancellationToken).ConfigureAwait(false);
        var last = await db.Imports.AsNoTracking().Where(i => i.From <= p.To && i.To >= p.From).OrderByDescending(i => i.CreatedAt)
            .Select(i => new ImportInfo(i.Id, i.FileName, i.From, i.To, i.Rows, i.Accepted, i.Rejected, i.Employees, i.CreatedByName, i.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        var shifts = await db.Shifts.AsNoTracking().OrderByDescending(s => s.IsDefault).ThenBy(s => s.NameAr).Select(s => new NamedRef(s.Id, s.NameAr, s.NameEn)).ToListAsync(cancellationToken).ConfigureAwait(false);
        return new MonthDto(
            period, p.From, p.To, setting.CycleStartDay, last is not null,
            last,
            new MonthKpis(rows.Count, full, none, allLeave, absence, deduction, excused, late, lateEmployees, early, missing, open),
            shifts,
            departments.Select(d => new NamedRef(d.Id, d.NameAr, d.NameEn)).ToList(),
            entities.Select(e => new NamedRef(e.Id, e.NameAr, e.NameEn)).ToList());
    }

    public async Task<MonthPageDto?> EmployeesAsync(string period, MonthQuery q, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(q);
        if (await PeriodAsync(period, cancellationToken).ConfigureAwait(false) is not { } p)
        {
            return null;
        }

        var book = await AttendanceBook.LoadAsync(db, staff, p.From, p.To, null, cancellationToken).ConfigureAwait(false);
        var rows = Rows(book, q.LegalEntityId).Select(x => Summary(book, x.Member, x.Days)).ToList();
        IEnumerable<MonthRowDto> shown = rows;
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            shown = shown.Where(r => r.EmployeeNo.Contains(s, StringComparison.OrdinalIgnoreCase) || (r.NameAr?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false) || r.NameEn.Contains(s, StringComparison.OrdinalIgnoreCase));
        }

        if (q.DepartmentId is { } dep)
        {
            var ids = book.Members.Where(m => m.DepartmentId == dep).Select(m => m.Id).ToHashSet();
            shown = shown.Where(r => ids.Contains(r.EmployeeId));
        }

        if (q.ShiftId is { } shiftId)
        {
            var ids = book.Members.Where(m => book.ShiftFor(m, book.To)?.Id == shiftId).Select(m => m.Id).ToHashSet();
            shown = shown.Where(r => ids.Contains(r.EmployeeId));
        }

        if (!string.IsNullOrWhiteSpace(q.State))
        {
            shown = shown.Where(r => r.State == q.State);
        }

        Func<MonthRowDto, object?> key = q.Sort switch
        {
            "no" => r => r.EmployeeNo,
            "absent" => r => r.Absent,
            "late" => r => r.LateMinutes,
            "early" => r => r.EarlyMinutes,
            "missing" => r => r.MissingPunches,
            "deduction" => r => r.Deduction,
            "present" => r => r.Present,
            _ => r => r.NameAr ?? r.NameEn,
        };
        var list = (q.Desc ? shown.OrderByDescending(key) : shown.OrderBy(key)).ToList();
        var totals = new MonthTotals(
            list.Count, list.Sum(r => r.WorkDays), list.Sum(r => r.Present), list.Sum(r => r.Absent), list.Sum(r => r.Leave),
            list.Sum(r => r.LateMinutes), list.Sum(r => r.EarlyMinutes), list.Sum(r => r.MissingPunches), list.Sum(r => r.Deduction));
        var size = Math.Clamp(q.PageSize, 10, 200);
        var page = Math.Max(1, q.Page);
        return new MonthPageDto(list.Skip((page - 1) * size).Take(size).ToList(), list.Count, totals);
    }

    public async Task<EmployeeMonthDto?> EmployeeAsync(string period, Guid employeeId, CancellationToken cancellationToken)
    {
        if (await PeriodAsync(period, cancellationToken).ConfigureAwait(false) is not { } p)
        {
            return null;
        }

        var book = await AttendanceBook.LoadAsync(db, staff, p.From, p.To, employeeId, cancellationToken).ConfigureAwait(false);
        if (book.Members.Count == 0 || book.Members[0] is not { } m)
        {
            return null;
        }

        var results = Days(book, m);
        var shift = book.ShiftFor(m, book.To);
        var setting = book.Settings.GetValueOrDefault(m.Id);
        var days = results.Select(x =>
        {
            var holiday = book.HolidayOn(x.Date);
            var ramadan = book.IsRamadan(x.Date);
            var hours = AttendanceBook.Hours(book.ShiftFor(m, x.Date), x.Date.DayOfWeek, ramadan);
            var s = x.Stored;
            return new DayDto(
                x.Date, x.Result.Status.ToString(), x.Result.IsWorkingDay, holiday?.NameAr, holiday?.NameEn, ramadan, hours.StartsAt, hours.EndsAt,
                s?.In, s?.Out, s?.DeviceIn, s?.DeviceOut, s?.DeviceStatus, s?.DevicePermissionMinutes ?? 0, s?.DeviceLateMinutes, s?.DeviceEarlyMinutes, s?.ManualStatus?.ToString(), s?.Note, s?.Deduction,
                x.Result.WorkedMinutes, x.Result.LateMinutes, x.Result.EarlyMinutes, x.Result.Deduction, s?.EditedByName, s?.EditedAt);
        }).ToList();
        return new EmployeeMonthDto(
            m.Id, m.EmployeeNo, m.NameAr, m.NameEn, m.IdNumber, m.DepartmentAr, m.DepartmentEn, shift?.NameAr, shift?.NameEn, shift?.StartsAt, shift?.EndsAt, shift?.GraceMinutes,
            setting?.BadgeNo, setting?.Exempt ?? false, Summary(book, m, results), days);
    }

    public async Task<IReadOnlyList<ExceptionDto>?> ExceptionsAsync(string period, Guid? legalEntityId, CancellationToken cancellationToken)
    {
        if (await PeriodAsync(period, cancellationToken).ConfigureAwait(false) is not { } p)
        {
            return null;
        }

        var book = await AttendanceBook.LoadAsync(db, staff, p.From, p.To, null, cancellationToken).ConfigureAwait(false);
        return Rows(book, legalEntityId)
            .SelectMany(x => x.Days
                .Where(d => d.Result.Status == DayStatus.MissingPunch || (d.Result.Status == DayStatus.Absent && d.Stored?.ManualStatus is null && d.Stored?.Deduction is null))
                .Select(d => new ExceptionDto(x.Member.Id, x.Member.EmployeeNo, x.Member.NameAr, x.Member.NameEn, x.Member.DepartmentAr, x.Member.DepartmentEn, d.Date, d.Result.Status.ToString(), d.Stored?.In, d.Stored?.Out, d.Stored?.DeviceStatus)))
            .OrderBy(e => e.Date).ThenBy(e => e.NameAr ?? e.NameEn)
            .Take(1000)
            .ToList();
    }

    public async Task<IReadOnlyList<ImportInfo>> ImportsAsync(CancellationToken cancellationToken) =>
        await db.Imports.AsNoTracking().OrderByDescending(i => i.CreatedAt).Take(50)
            .Select(i => new ImportInfo(i.Id, i.FileName, i.From, i.To, i.Rows, i.Accepted, i.Rejected, i.Employees, i.CreatedByName, i.CreatedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    internal sealed record CalculatedDay(DateOnly Date, AttendanceDay? Stored, DayResult Result);

    private static List<CalculatedDay> Days(AttendanceBook book, StaffMember m) =>
        book.Dates().Select(d => new CalculatedDay(d, book.Stored(m.Id, d), book.Calculate(m, d))).ToList();

    private static IEnumerable<(StaffMember Member, List<CalculatedDay> Days)> Rows(AttendanceBook book, Guid? legalEntityId) =>
        book.Members
            .Where(m => (legalEntityId is null || m.LegalEntityId == legalEntityId) && book.EmployedIn(m))
            .Select(m => (m, Days(book, m)))
            .Where(x => x.Item2.Any(d => d.Result.Status != DayStatus.NoData));

    private static MonthRowDto Summary(AttendanceBook book, StaffMember m, List<CalculatedDay> days)
    {
        var working = days.Where(d => d.Result.IsWorkingDay).ToList();
        var shift = book.ShiftFor(m, book.To);
        var absent = working.Count(d => d.Result.Status == DayStatus.Absent);
        var missing = working.Count(d => d.Result.Status == DayStatus.MissingPunch);
        var open = missing + working.Count(d => d.Result.Status == DayStatus.Absent && d.Stored?.ManualStatus is null && d.Stored?.Deduction is null);
        var punched = working.Any(d => d.Stored?.In is not null || d.Stored?.Out is not null);
        var exempt = book.Settings.GetValueOrDefault(m.Id)?.Exempt ?? false;
        var state = working.Count == 0 ? "NoWorkDays"
            : !punched && !exempt && working.All(d => d.Result.Status == DayStatus.Absent) ? "NoPunches"
            : open > 0 ? "Exceptions"
            : "Complete";
        return new MonthRowDto(
            m.Id, m.EmployeeNo, m.NameAr, m.NameEn, m.DepartmentAr, m.DepartmentEn, shift?.NameAr, shift?.NameEn,
            working.Count,
            working.Count(d => d.Result.Status is DayStatus.Present or DayStatus.MissingPunch or DayStatus.Mission or DayStatus.Exempt),
            absent,
            working.Count(d => d.Result.Status == DayStatus.Leave),
            working.Sum(d => d.Result.LateMinutes),
            working.Sum(d => d.Result.EarlyMinutes),
            missing,
            working.Sum(d => d.Result.Deduction),
            state);
    }

    internal static bool TryParse(string period, out int year, out int month)
    {
        year = month = 0;
        var parts = (period ?? string.Empty).Split('-');
        return parts.Length == 2 && int.TryParse(parts[0], out year) && int.TryParse(parts[1], out month) && year is >= 2025 and <= 2100 && month is >= 1 and <= 12;
    }
}
