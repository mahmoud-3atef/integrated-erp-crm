using IntegratedErp.Modules.Billing.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Workforce.Contracts;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>
/// A company worker's pay in a run, from their approved timesheet lines of the period (docs/02-target-architecture/09 §3):
/// <code>
/// salary paid   = Σ (the line's days' salary − its absence)          the timesheet's PayDueSalary − PayAbsence
/// split         = basic, housing, food, transport by the worker's salary, the rest to "other allowances"
/// allowances    = housing + food + transport + other + overtime + customer additions + internal additions
/// deductions    = customer deductions + customer loans + internal deductions
/// net           = basic + allowances − deductions  = Σ the timesheet's own net (checked)
/// paid days     = Σ (work days − absent days)
/// </code>
/// The absence is in the paid days and in the salary paid; it is not counted again as a deduction.
/// </summary>
internal static class PayrollCalculator
{
    public static (PayrollLineValues Values, IReadOnlyList<PayrollLineSource> Sources) Worker(
        IReadOnlyList<PayrollTimesheetLine> lines, WorkerSalary? salary, WorkerCard? card, DateOnly from, DateOnly to)
    {
        ArgumentNullException.ThrowIfNull(lines);
        if (lines.Count == 0)
        {
            throw new ArgumentException("A worker's pay needs at least one timesheet line.", nameof(lines));
        }

        var first = lines[0];
        var sources = lines.Select(l => PayrollLineSource.Create(
                l.LineId, l.TimesheetId, l.TimesheetNo, l.ProjectCrmId, l.ProjectName, l.LineFrom, l.LineTo, l.WorkDays, l.DayDivisor, l.AbsenceDays,
                l.PaySalary, l.PayDueSalary - l.PayAbsence, l.Overtime, l.OvertimeHours, l.ClientAdditions, l.ClientDeductions, l.CustomerLoans,
                l.InternalAdditions, l.InternalDeductions, l.WorkerNet))
            .ToList();

        var salaryPaid = sources.Sum(s => s.SalaryPart);
        var monthly = lines.Max(l => l.PaySalary);
        var notes = new List<string>();

        // The split by the worker's salary elements; what does not divide evenly goes to "other allowances".
        decimal basic, housing, food, transport;
        var elements = salary is null ? 0 : salary.Basic + salary.Housing + salary.Food + salary.Transport + salary.Other;
        if (salary is null || elements <= 0 || salary.Basic <= 0)
        {
            (basic, housing, food, transport) = (salaryPaid, 0, 0, 0);
            if (salaryPaid != 0)
            {
                notes.Add("salary_split");
            }
        }
        else
        {
            basic = Round(salaryPaid * salary.Basic / elements);
            housing = Round(salaryPaid * salary.Housing / elements);
            food = Round(salaryPaid * salary.Food / elements);
            transport = Round(salaryPaid * salary.Transport / elements);
            if (Math.Abs(elements - monthly) > 0.01m)
            {
                notes.Add("salary_split");
            }
        }

        var other = salaryPaid - basic - housing - food - transport;
        var overtime = lines.Sum(l => l.Overtime);
        var clientAdditions = lines.Sum(l => l.ClientAdditions);
        var internalAdditions = lines.Sum(l => l.InternalAdditions);
        var clientDeductions = lines.Sum(l => l.ClientDeductions);
        var loans = lines.Sum(l => l.CustomerLoans);
        var internalDeductions = lines.Sum(l => l.InternalDeductions);
        var net = lines.Sum(l => l.WorkerNet);

        var absence = lines.Sum(l => l.AbsenceDays);
        if (absence > 0)
        {
            notes.Add("absence");
        }

        if (lines.Min(l => l.LineFrom) > from)
        {
            notes.Add("joined");
        }

        if (lines.Max(l => l.LineTo) < to)
        {
            notes.Add("left");
        }

        var byProject = lines.GroupBy(l => (l.ProjectCrmId, l.ProjectName)).Select(g => (g.Key, Days: g.Sum(l => l.WorkDays))).OrderByDescending(g => g.Days).ToList();
        if (byProject.Count > 1)
        {
            notes.Add("multi_project");
        }

        if (net <= 0)
        {
            notes.Add("net_not_positive");
        }

        var values = new PayrollLineValues(
            first.WorkerId, first.WorkerNo, card?.Name ?? first.Name, card?.ProfessionCode ?? first.ProfessionCode, card?.StatusAr, card?.StatusEn,
            byProject[0].Key.ProjectCrmId, byProject[0].Key.ProjectName, byProject.Count, monthly,
            lines.Sum(l => l.WorkDays - l.AbsenceDays), absence, basic, housing, food, transport, other, overtime,
            clientAdditions, internalAdditions, clientDeductions, loans, internalDeductions, net, notes);
        return (values, sources);
    }

    /// <summary>The net the split adds up to; it equals the timesheet's net unless the timesheet's own sums differ.</summary>
    public static decimal NetOf(PayrollLineValues v) =>
        v.Base + v.Housing + v.Food + v.Transport + v.OtherAllowances + v.Overtime + v.ClientAdditions + v.InternalAdditions
        - v.ClientDeductions - v.CustomerLoans - v.InternalDeductions;

    private static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}
