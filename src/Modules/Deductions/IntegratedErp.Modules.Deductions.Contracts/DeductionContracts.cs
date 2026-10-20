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

    /// <summary>
    /// What is due in a payroll month and not deducted yet: the installments of paid advances, and the applied penalties
    /// and other deductions, of that month or deferred from an earlier one.
    /// </summary>
    Task<IReadOnlyList<DueDeduction>> DueAsync(string period, CancellationToken cancellationToken);

    /// <summary>The approved staff payroll's result: what it deducted of each item, and what it deferred to the next month.</summary>
    Task RecordAsync(string runNo, IReadOnlyList<DeductionSettlement> settlements, CancellationToken cancellationToken);

    /// <summary>Each paid advance still being deducted: what is left of it and in how many installments (for the payslip).</summary>
    Task<IReadOnlyList<AdvanceBalance>> OutstandingAsync(CancellationToken cancellationToken);
}

public sealed record AdvanceBalance(Guid EmployeeId, string AdvanceNo, decimal Remaining, int Installments);

public enum DeductionItemKind
{
    Installment,
    PenaltyDays,
    PenaltyAmount,
    Suspension,
    Other,
}

/// <param name="Amount">The amount still due (installments, amount penalties, other deductions).</param>
/// <param name="Days">The days (day penalties and suspensions).</param>
/// <param name="AboveCap">An approved request allowed going above the month's cap: never deferred.</param>
public sealed record DueDeduction(Guid Id, DeductionItemKind Kind, Guid EmployeeId, string Reference, string Period, decimal Days, decimal Amount, bool AboveCap, string Description);

/// <param name="Deducted">The amount the payroll deducted (for a day penalty or a suspension: its money value).</param>
/// <param name="Deferred">Left, in all or part, for the next payroll month.</param>
public sealed record DeductionSettlement(Guid Id, DeductionItemKind Kind, decimal Deducted, bool Deferred);
