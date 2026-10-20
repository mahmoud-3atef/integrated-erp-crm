namespace IntegratedErp.Modules.Deductions.Contracts;

/// <summary>
/// Public surface of the Deductions module (docs/03-migration-plan/10): salary advances, penalties and other deductions
/// of the company's staff.
/// </summary>
public static class DeductionContracts
{
    public const string ModuleName = "Deductions";
}

/// <summary>
/// An employee's deductions due in a payroll month: advance installments, penalty days and amounts, suspension days and
/// other deductions — and whether an approved request allowed going above the month's cap.
/// </summary>
public sealed record MonthDeductions(
    Guid EmployeeId,
    decimal AdvanceDue,
    decimal PenaltyDays,
    decimal PenaltyAmount,
    decimal SuspensionDays,
    decimal OtherAmount,
    bool AboveCapAllowed);

public sealed record DeductionRules(decimal MonthlyCapPercent);

public interface IStaffDeductions
{
    Task<IReadOnlyList<MonthDeductions>> MonthAsync(string period, CancellationToken cancellationToken);

    Task<DeductionRules> RulesAsync(CancellationToken cancellationToken);
}
