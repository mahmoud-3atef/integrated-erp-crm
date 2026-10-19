using IntegratedErp.Modules.Billing.Contracts;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>The company workers' timesheet lines for the payroll (docs/02-target-architecture/09 §3).</summary>
internal sealed class TimesheetPayroll(BillingDbContext db) : ITimesheetPayroll
{
    public async Task<IReadOnlyList<PayrollTimesheetLine>> CompanyLinesAsync(DateOnly start, DateOnly end, CancellationToken cancellationToken) =>
        await (from l in db.TimesheetLines.AsNoTracking()
               join t in db.Timesheets.AsNoTracking() on l.TimesheetId equals t.Id
               where l.Source == WorkerSource.Company && l.LineTo >= start && l.LineTo <= end
               orderby l.WorkerNo, l.LineFrom
               select new PayrollTimesheetLine(
                   l.Id, t.Id, t.TimesheetNo, t.Status.ToString(), t.ApprovedAt, t.ProjectCrmId, t.ProjectName,
                   l.WorkerId, l.WorkerNo, l.Name, l.ProfessionCode, l.LineFrom, l.LineTo, l.WorkDays, l.DayDivisor,
                   l.PaySalary, l.BasicSalary, l.AbsenceDays, l.OvertimeHours, l.Overtime, l.ClientAdditions, l.ClientDeductions,
                   l.CustomerLoans, l.InternalAdditions, l.InternalDeductions, l.PayDueSalary, l.PayAbsence, l.WorkerNet))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
}
