namespace IntegratedErp.Modules.Leave.Contracts;

/// <summary>
/// Public surface of the Leave module (docs/03-migration-plan/09): the staff's leave types, balances and requests.
/// </summary>
public static class LeaveContracts
{
    public const string ModuleName = "Leave";
}

/// <summary>An approved leave: the attendance counts its days as leave, not absence.</summary>
public sealed record ApprovedLeave(Guid RequestId, string RequestNo, Guid EmployeeId, DateOnly From, DateOnly To, string TypeAr, string TypeEn, string Pay);

public interface IApprovedLeaves
{
    /// <summary>The approved leaves overlapping a period (one employee's, or everyone's).</summary>
    Task<IReadOnlyList<ApprovedLeave>> InAsync(DateOnly from, DateOnly to, Guid? employeeId, CancellationToken cancellationToken);
}
