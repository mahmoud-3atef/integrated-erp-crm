namespace IntegratedErp.Modules.Billing.Contracts;

/// <summary>
/// Public surface of the Billing module: the monthly project timesheets (docs/02-target-architecture/06) and, later,
/// the invoices made from them. An approved timesheet feeds the customer invoice, the payroll of the company's workers
/// and the statement of each internal supplier.
/// </summary>
public static class BillingContracts
{
    public const string ModuleName = "Billing";
}

/// <summary>
/// A timesheet line of a worker on the company's sponsorship, as the payroll takes it: the days, the salary the line
/// pays and what the month changed. <paramref name="WorkerNet"/> is the timesheet's own result and the payroll must
/// match it. <paramref name="TimesheetStatus"/>: Draft, InApproval, Returned or Approved (only approved lines are paid).
/// </summary>
public sealed record PayrollTimesheetLine(
    Guid LineId,
    Guid TimesheetId,
    string TimesheetNo,
    string TimesheetStatus,
    DateTimeOffset? ApprovedAt,
    Guid ProjectCrmId,
    string ProjectName,
    Guid WorkerId,
    string WorkerNo,
    string Name,
    string? ProfessionCode,
    DateOnly LineFrom,
    DateOnly LineTo,
    decimal WorkDays,
    decimal DayDivisor,
    decimal PaySalary,
    decimal BasicSalary,
    decimal AbsenceDays,
    decimal OvertimeHours,
    decimal Overtime,
    decimal ClientAdditions,
    decimal ClientDeductions,
    decimal CustomerLoans,
    decimal InternalAdditions,
    decimal InternalDeductions,
    decimal PayDueSalary,
    decimal PayAbsence,
    decimal WorkerNet);

/// <summary>The timesheets as the payroll of the company's workers reads them.</summary>
public interface ITimesheetPayroll
{
    /// <summary>
    /// The lines of workers on the company's sponsorship whose period ends from <paramref name="start"/> to
    /// <paramref name="end"/>, in every timesheet whatever its state.
    /// </summary>
    Task<IReadOnlyList<PayrollTimesheetLine>> CompanyLinesAsync(DateOnly start, DateOnly end, CancellationToken cancellationToken);
}
