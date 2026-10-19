using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Attendance.Domain;
using IntegratedErp.Modules.Attendance.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Attendance.Application;

/// <summary>A day's correction: the times set by hand, a status over the calculated one, the note and the deduction.</summary>
public sealed record CorrectionInput(TimeOnly? In, TimeOnly? Out, string? Status, string? Note, decimal? Deduction);

/// <summary>HR's corrections of a day (kept when the file is imported again).</summary>
internal sealed class AttendanceService(AttendanceDbContext db, IStaffDirectory staff, ICurrentUser user, IClock clock)
{
    public async Task<Result> CorrectAsync(Guid employeeId, DateOnly date, CorrectionInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var member = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(m => m.Id == employeeId);
        if (member is null)
        {
            return Result.Failure(AttendanceErrors.EmployeeNotFound);
        }

        if (!AttendanceBook.Employed(member, date))
        {
            return Result.Failure(AttendanceErrors.Correction);
        }

        ManualStatus? status = null;
        if (!string.IsNullOrWhiteSpace(input.Status))
        {
            if (!Enum.TryParse<ManualStatus>(input.Status, out var s))
            {
                return Result.Failure(AttendanceErrors.Correction);
            }

            status = s;
        }

        var day = await db.Days.FirstOrDefaultAsync(d => d.EmployeeId == employeeId && d.Date == date, cancellationToken).ConfigureAwait(false);
        if (day is null)
        {
            day = AttendanceDay.For(employeeId, date);
            db.Days.Add(day);
        }

        var set = day.Correct(input.In, input.Out, status, input.Note, input.Deduction, user.DisplayName, clock.UtcNow);
        if (set.IsSuccess)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return set;
    }
}
