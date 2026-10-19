using IntegratedErp.Modules.Attendance.Domain;
using IntegratedErp.Modules.Attendance.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Attendance.Application;

/// <summary>
/// What a period's days are calculated from, loaded once: the staff, their settings, the shifts and who has which, the
/// holidays, the dates the imported files cover, and the stored days.
/// </summary>
internal sealed class AttendanceBook
{
    private readonly Dictionary<Guid, Shift> shifts;
    private readonly List<ShiftAssignment> assignments;
    private readonly List<Holiday> holidays;
    private readonly Dictionary<Guid, Guid?> parents;
    private readonly HashSet<DateOnly> covered;
    private readonly Dictionary<Guid, (DateOnly From, DateOnly To)> imports;
    private readonly Dictionary<Guid, List<Guid>> importsOf;
    private readonly Dictionary<(Guid, DateOnly), AttendanceDay> days;

    private AttendanceBook(
        DateOnly from,
        DateOnly to,
        IReadOnlyList<StaffMember> members,
        Dictionary<Guid, EmployeeSetting> settings,
        List<Shift> shifts,
        List<ShiftAssignment> assignments,
        List<Holiday> holidays,
        IReadOnlyList<StaffDepartment> departments,
        HashSet<DateOnly> covered,
        Dictionary<Guid, (DateOnly From, DateOnly To)> imports,
        List<AttendanceDay> days)
    {
        From = from;
        To = to;
        Members = members;
        Settings = settings;
        this.shifts = shifts.ToDictionary(s => s.Id);
        DefaultShift = shifts.FirstOrDefault(s => s.IsDefault) ?? shifts.FirstOrDefault();
        this.assignments = assignments;
        this.holidays = holidays;
        parents = departments.ToDictionary(d => d.Id, d => d.ParentId);
        this.covered = covered;
        this.imports = imports;
        importsOf = days.Where(d => d.ImportId is not null).GroupBy(d => d.EmployeeId).ToDictionary(g => g.Key, g => g.Select(d => d.ImportId!.Value).Distinct().ToList());
        this.days = days.ToDictionary(d => (d.EmployeeId, d.Date));
    }

    public DateOnly From { get; }

    public DateOnly To { get; }

    public IReadOnlyList<StaffMember> Members { get; }

    public Dictionary<Guid, EmployeeSetting> Settings { get; }

    public Shift? DefaultShift { get; }

    public static async Task<AttendanceBook> LoadAsync(AttendanceDbContext db, IStaffDirectory staff, DateOnly from, DateOnly to, Guid? employeeId, CancellationToken cancellationToken)
    {
        var members = await staff.MembersAsync(cancellationToken).ConfigureAwait(false);
        if (employeeId is { } only)
        {
            members = members.Where(m => m.Id == only).ToList();
        }

        var departments = await staff.DepartmentsAsync(cancellationToken).ConfigureAwait(false);
        var settings = await db.EmployeeSettings.AsNoTracking().ToDictionaryAsync(s => s.EmployeeId, cancellationToken).ConfigureAwait(false);
        var shifts = await db.Shifts.AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false);
        var assignments = await db.Assignments.AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false);
        var holidays = await db.Holidays.AsNoTracking().Where(h => h.From <= to && h.To >= from).ToListAsync(cancellationToken).ConfigureAwait(false);
        var imports = await db.Imports.AsNoTracking().Where(i => i.From <= to && i.To >= from).Select(i => new { i.Id, i.From, i.To }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var covered = new HashSet<DateOnly>();
        foreach (var i in imports)
        {
            for (var d = i.From < from ? from : i.From; d <= i.To && d <= to; d = d.AddDays(1))
            {
                covered.Add(d);
            }
        }

        var query = db.Days.AsNoTracking().Where(d => d.Date >= from && d.Date <= to);
        if (employeeId is { } e)
        {
            query = query.Where(d => d.EmployeeId == e);
        }

        var days = await query.ToListAsync(cancellationToken).ConfigureAwait(false);
        var useDevice = await db.Settings.AsNoTracking().Select(s => (bool?)s.UseDeviceMinutes).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false) ?? true;
        return new AttendanceBook(from, to, members, settings, shifts, assignments, holidays, departments, covered, imports.ToDictionary(i => i.Id, i => (i.From, i.To)), days) { UseDeviceMinutes = useDevice };
    }

    public IEnumerable<DateOnly> Dates()
    {
        for (var d = From; d <= To; d = d.AddDays(1))
        {
            yield return d;
        }
    }

    public AttendanceDay? Stored(Guid employeeId, DateOnly date) => days.GetValueOrDefault((employeeId, date));

    /// <summary>
    /// Whether a date counts for the employee: a file covering it carried them (one who is not in the file is not absent;
    /// the exempt count on every date a file covers).
    /// </summary>
    public bool Covered(Guid employeeId, DateOnly date, bool exempt) =>
        exempt ? covered.Contains(date)
            : importsOf.TryGetValue(employeeId, out var ids) && ids.Any(id => imports.TryGetValue(id, out var r) && r.From <= date && date <= r.To);

    public Holiday? HolidayOn(DateOnly date) => holidays.FirstOrDefault(h => h.Kind == HolidayKind.Official && h.Covers(date));

    public bool IsRamadan(DateOnly date) => holidays.Any(h => h.Kind == HolidayKind.Ramadan && h.Covers(date));

    public static bool Employed(StaffMember m, DateOnly date) =>
        (m.HireDate is null || date >= m.HireDate) && (m.EndedOn is { } end ? date <= end : m.Status != "Left");

    public bool EmployedIn(StaffMember m) => Dates().Any(d => Employed(m, d)) || days.Keys.Any(k => k.Item1 == m.Id);

    /// <summary>The employee's shift on a date: their own assignment, then their department's (or a parent's), then the default.</summary>
    public Shift? ShiftFor(StaffMember m, DateOnly date)
    {
        var own = assignments.Where(a => a.EmployeeId == m.Id && a.Covers(date)).OrderByDescending(a => a.From).FirstOrDefault();
        if (own is not null && shifts.TryGetValue(own.ShiftId, out var s))
        {
            return s;
        }

        var seen = new HashSet<Guid>();
        for (var dep = m.DepartmentId; dep is { } d && seen.Add(d); dep = parents.GetValueOrDefault(d))
        {
            var a = assignments.Where(x => x.DepartmentId == d && x.Covers(date)).OrderByDescending(x => x.From).FirstOrDefault();
            if (a is not null && shifts.TryGetValue(a.ShiftId, out var ds))
            {
                return ds;
            }
        }

        return DefaultShift;
    }

    public static ShiftDay Hours(Shift? s, DayOfWeek day, bool ramadan) => s is null
        ? new ShiftDay(new TimeOnly(9, 0), new TimeOnly(17, 0), 0, 15, LateFrom.GraceEnd, day is DayOfWeek.Friday or DayOfWeek.Saturday)
        : ramadan && s.RamadanStartsAt is { } rs && s.RamadanEndsAt is { } re
            ? new ShiftDay(rs, re, 0, s.GraceMinutes, s.LateFrom, s.IsRestDay(day))
            : new ShiftDay(s.StartsAt, s.EndsAt, s.BreakMinutes, s.GraceMinutes, s.LateFrom, s.IsRestDay(day));

    /// <summary>Whether the device's late and early minutes are taken (the setting) — not once HR corrected the times.</summary>
    public bool UseDeviceMinutes { get; init; } = true;

    public DayFacts Facts(StaffMember m, DateOnly date)
    {
        var stored = Stored(m.Id, date);
        var device = UseDeviceMinutes && stored is not null && stored.ManualIn is null && stored.ManualOut is null;
        var setting = Settings.GetValueOrDefault(m.Id);
        return new DayFacts(
            date,
            Employed(m, date),
            Covered(m.Id, date, setting?.Exempt ?? false) || stored is not null,
            setting?.Exempt ?? false,
            HolidayOn(date) is not null,
            Hours(ShiftFor(m, date), date.DayOfWeek, IsRamadan(date)),
            stored?.In,
            stored?.Out,
            stored?.DeviceMark ?? DeviceMark.None,
            stored?.DevicePermissionMinutes ?? 0,
            stored?.ManualStatus,
            stored?.Deduction,
            device ? stored!.DeviceLateMinutes : null,
            device ? stored!.DeviceEarlyMinutes : null);
    }

    public DayResult Calculate(StaffMember m, DateOnly date) => DayCalculator.Calculate(Facts(m, date));
}
