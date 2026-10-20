using IntegratedErp.Modules.Attendance.Contracts;
using IntegratedErp.Modules.Attendance.Domain;
using IntegratedErp.Modules.Attendance.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;

namespace IntegratedErp.Modules.Attendance.Application;

/// <summary>Working days on the employee's shifts and the holidays, and the locked months (for leave requests).</summary>
internal sealed class AttendanceCalendar(AttendanceDbContext db, IStaffDirectory staff) : IAttendanceCalendar
{
    public async Task<int> WorkingDaysAsync(Guid employeeId, DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        if (to < from)
        {
            return 0;
        }

        var book = await AttendanceBook.LoadAsync(db, staff, from, to, employeeId, cancellationToken).ConfigureAwait(false);
        var m = book.Members.Count > 0 ? book.Members[0] : null;
        return book.Dates().Count(d => book.HolidayOn(d) is null && !AttendanceBook.Hours(m is null ? book.DefaultShift : book.ShiftFor(m, d), d.DayOfWeek, false).IsRestDay);
    }

    public async Task<DateOnly> NextWorkingDayAsync(Guid employeeId, DateOnly after, CancellationToken cancellationToken)
    {
        var book = await AttendanceBook.LoadAsync(db, staff, after.AddDays(1), after.AddDays(31), employeeId, cancellationToken).ConfigureAwait(false);
        var m = book.Members.Count > 0 ? book.Members[0] : null;
        foreach (var d in book.Dates())
        {
            if (book.HolidayOn(d) is null && !AttendanceBook.Hours(m is null ? book.DefaultShift : book.ShiftFor(m, d), d.DayOfWeek, false).IsRestDay)
            {
                return d;
            }
        }

        return after.AddDays(1);
    }

    public async Task<bool> LockedAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken) =>
        (await MonthLock.LockedRangesAsync(db, from, to, cancellationToken).ConfigureAwait(false)).Count > 0;
}
