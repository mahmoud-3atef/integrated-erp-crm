namespace IntegratedErp.Modules.Leave.Contracts;

/// <summary>
/// Public surface of the Leave module (docs/03-migration-plan/09): the staff's leave types, balances and requests.
/// </summary>
public static class LeaveContracts
{
    public const string ModuleName = "Leave";
}

/// <summary>An approved leave: the attendance counts its days as leave, not absence.</summary>
/// <param name="TypeCode">The leave type's code ("annual" for the annual leave).</param>
/// <param name="Days">The days the request counts (its type's day count).</param>
public sealed record ApprovedLeave(Guid RequestId, string RequestNo, Guid EmployeeId, DateOnly From, DateOnly To, string TypeAr, string TypeEn, string Pay, string? TypeCode = null, decimal Days = 0);

public interface IApprovedLeaves
{
    /// <summary>The approved leaves overlapping a period (one employee's, or everyone's).</summary>
    Task<IReadOnlyList<ApprovedLeave>> InAsync(DateOnly from, DateOnly to, Guid? employeeId, CancellationToken cancellationToken);
}

/// <summary>
/// An approved permission's minutes on a day that the attendance does not count as late or early: within the monthly
/// allowance (in date order), a work mission whatever the allowance.
/// </summary>
public sealed record ApprovedTimeOff(Guid EmployeeId, DateOnly Date, int Minutes, int Waived, string Kind, string RequestNo);

public interface IApprovedTimeOff
{
    Task<IReadOnlyList<ApprovedTimeOff>> InAsync(DateOnly from, DateOnly to, Guid? employeeId, CancellationToken cancellationToken);
}

/// <summary>An employee's leave days in a period, by how they are paid (the sick tiers counted over the year).</summary>
public sealed record LeavePayDays(Guid EmployeeId, decimal FullPay, decimal ThreeQuarters, decimal Unpaid);

public interface ILeavePayroll
{
    Task<IReadOnlyList<LeavePayDays>> DaysAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);

    /// <summary>The annual leave balance on a day (its entries up to that day) and the days taken that year (for the payslip).</summary>
    Task<IReadOnlyList<AnnualLeaveBalance>> AnnualAsync(DateOnly on, CancellationToken cancellationToken);
}

public sealed record AnnualLeaveBalance(Guid EmployeeId, decimal Balance, decimal TakenThisYear);


/// <summary>
/// Documents of other modules made from an approved leave (a vacation settlement): the leave cannot be changed or
/// cancelled after its approval while one of them stands.
/// </summary>
public interface ILeaveUsage
{
    /// <summary>The number of the document made from the leave request, if any (not cancelled).</summary>
    Task<string?> UsedByAsync(Guid leaveRequestId, CancellationToken cancellationToken);
}
