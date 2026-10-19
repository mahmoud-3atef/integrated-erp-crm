namespace IntegratedErp.Modules.Attendance.Contracts;

/// <summary>
/// Public surface of the Attendance module (docs/03-migration-plan/08): the staff's attendance — shifts, the holiday
/// calendar, the fingerprint files and the days calculated from them.
/// </summary>
public static class AttendanceContracts
{
    public const string ModuleName = "Attendance";
}

/// <summary>An employee's closed attendance month: what the staff payroll (4.8) takes.</summary>
public sealed record ClosedAttendanceLine(
    Guid EmployeeId,
    string EmployeeNo,
    Guid? LegalEntityId,
    int WorkDays,
    int Present,
    int Absent,
    int Leave,
    int LateMinutes,
    int EarlyMinutes,
    decimal DeductionDays,
    int OvertimeMinutes);

public sealed record ClosedAttendanceMonth(string Period, DateOnly From, DateOnly To, DateTimeOffset ClosedAt, IReadOnlyList<ClosedAttendanceLine> Lines);

/// <summary>The closed attendance months, read-only.</summary>
public interface IAttendanceMonths
{
    /// <summary>The month's frozen figures once it is closed; null while it is open or in approval.</summary>
    Task<ClosedAttendanceMonth?> ClosedAsync(string period, CancellationToken cancellationToken);
}
