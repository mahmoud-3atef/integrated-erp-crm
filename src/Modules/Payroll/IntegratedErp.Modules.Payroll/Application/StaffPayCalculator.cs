using IntegratedErp.Modules.Attendance.Contracts;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Staff.Contracts;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>The rules a staff line is calculated with (from the settings, the deductions' cap, and GOSI's rates).</summary>
public sealed record StaffPayRules(decimal OvertimePremiumPercent, decimal HoursPerDay, LateDeductionMode LateMode, decimal MonthlyCapPercent);

public sealed record StaffGosi(GosiCategory Category, decimal EmployeePercent, decimal EmployerPercent, decimal MinBase, decimal MaxBase);

public sealed record StaffAdjustmentInput(Guid Id, AdjustmentKind Kind, decimal Amount, string Reason);

/// <summary>
/// One employee's line (docs/03-migration-plan/11 §4): the elements by the days in service (30-day rule); the absence,
/// unpaid leave and suspension at the day's wage (the monthly salary ÷ 30); lateness at the minute's wage when the
/// setting says so; a quarter of the day's wage for each sick day at three quarters; overtime by article 107; then the
/// penalties, other deductions and advance installments within the month's cap (the excess deferred: installments
/// first, then other deductions, then penalties), the adjustments, and the employee's GOSI share.
/// </summary>
public static class StaffPayCalculator
{
    public static readonly DateOnly GosiNewFrom = new(2024, 7, 3);

    public static GosiCategory CategoryOf(StaffPayInfo e, DateOnly from)
    {
        ArgumentNullException.ThrowIfNull(e);
        return GosiRules.CategoryOf(e.NationalityCode, e.GosiSince ?? e.HireDate ?? from);
    }

    /// <summary>The days in service in the period by the 30-day rule: the whole period is 30; part of it is its days, 30 at most.</summary>
    public static decimal ServiceDays(DateOnly from, DateOnly to, DateOnly? hired, DateOnly? ended)
    {
        var start = hired is { } h && h > from ? h : from;
        var end = ended is { } e && e < to ? e : to;
        if (end < start)
        {
            return 0;
        }

        return start == from && end == to ? 30 : Math.Min(30, end.DayNumber - start.DayNumber + 1);
    }

    public static (StaffLineValues Values, IReadOnlyList<StaffPayrollItem> Items) Line(
        StaffPayInfo e,
        StaffSalaryInfo salary,
        ClosedAttendanceLine? attendance,
        IReadOnlyList<DueDeduction> due,
        IReadOnlyList<StaffAdjustmentInput> adjustments,
        StaffGosi? gosi,
        StaffPayRules rules,
        DateOnly from,
        DateOnly to,
        decimal? registeredWage = null)
    {
        ArgumentNullException.ThrowIfNull(e);
        ArgumentNullException.ThrowIfNull(salary);
        ArgumentNullException.ThrowIfNull(due);
        ArgumentNullException.ThrowIfNull(adjustments);
        ArgumentNullException.ThrowIfNull(rules);
        var notes = new List<string>();
        var items = new List<StaffPayrollItem>();

        var service = ServiceDays(from, to, e.HireDate, e.EndedOn);
        if (e.HireDate is { } hired && hired > from)
        {
            notes.Add("joined");
        }

        if (e.EndedOn is { } ended && ended < to)
        {
            notes.Add("left");
        }

        if (attendance is null)
        {
            notes.Add("no_attendance");
        }

        if (e.SalaryChangedInPeriod)
        {
            notes.Add("salary_changed");
        }

        if (e.Iban is null)
        {
            notes.Add("no_iban");
        }

        var monthly = salary.Total;
        var day = monthly / 30m;
        var hour = monthly / (30m * rules.HoursPerDay);
        var basicHour = salary.Basic / (30m * rules.HoursPerDay);
        decimal Share(decimal monthlyValue) => Money(monthlyValue * service / 30m);

        // The earnings of the days in service.
        var basic = Share(salary.Basic);
        var housing = Share(salary.Housing);
        var other = Share(salary.Food + salary.Transport + salary.Mobile + salary.Project + salary.Other + e.ActingAllowance);
        var overtimeHours = attendance is null ? 0 : decimal.Round(attendance.OvertimeMinutes / 60m, 2);
        var overtime = Money(overtimeHours * (hour + (rules.OvertimePremiumPercent / 100m * basicHour)));
        var additions = 0m;
        var adjustedDeductions = 0m;
        foreach (var a in adjustments)
        {
            if (a.Kind == AdjustmentKind.Addition)
            {
                additions += a.Amount;
                items.Add(StaffPayrollItem.Create(StaffItemKind.Addition, a.Id, "adjustment", a.Reason, null, 0, a.Amount, a.Amount, false, false));
            }
            else
            {
                adjustedDeductions += a.Amount;
                items.Add(StaffPayrollItem.Create(StaffItemKind.Deduction, a.Id, "adjustment", a.Reason, null, 0, a.Amount, a.Amount, false, false));
            }
        }

        var gross = basic + housing + other + overtime + additions;

        // Days without pay: absence and the reviewer's deduction days, unpaid leave, and suspensions.
        var suspensions = due.Where(d => d.Kind == DeductionItemKind.Suspension).ToList();
        var suspensionDays = suspensions.Sum(s => s.Days);
        var unpaid = Math.Min(service, (attendance?.DeductionDays ?? 0) + (attendance?.UnpaidLeaveDays ?? 0) + suspensionDays);
        var absence = Money(unpaid * day);
        foreach (var s in suspensions)
        {
            items.Add(StaffPayrollItem.Create(StaffItemKind.Suspension, s.Id, s.Reference, s.Description, s.Period, s.Days, Money(s.Days * day), Money(s.Days * day), false, s.AboveCap));
        }

        var lateMinutes = attendance is null ? 0 : attendance.LateMinutes + attendance.EarlyMinutes;
        var late = rules.LateMode == LateDeductionMode.PerMinute ? Money(lateMinutes * hour / 60m) : 0;
        var sickDays = attendance?.SickPartDays ?? 0;
        var sick = Money(sickDays * day * 0.25m);

        // Within the month's cap of the wage earned (above-the-cap items first, as approved; the excess deferred).
        var earned = Math.Max(0, gross - absence - late - sick);
        var cap = Money(earned * rules.MonthlyCapPercent / 100m);
        var used = 0m;
        decimal penalties = 0, others = 0, advances = 0, deferred = 0;
        var capped = due.Where(d => d.Kind != DeductionItemKind.Suspension)
            .Select(d => (Item: d, Amount: d.Kind == DeductionItemKind.PenaltyDays ? Money(d.Days * day) : d.Amount))
            .OrderByDescending(x => x.Item.AboveCap)
            .ThenBy(x => x.Item.Kind switch { DeductionItemKind.PenaltyDays or DeductionItemKind.PenaltyAmount => 0, DeductionItemKind.Other => 1, _ => 2 })
            .ThenBy(x => x.Item.Period, StringComparer.Ordinal)
            .ToList();
        foreach (var (d, amount) in capped)
        {
            var room = Math.Max(0, cap - used);
            var take = d.AboveCap ? amount : d.Kind == DeductionItemKind.Installment ? Math.Min(amount, room) : amount <= room ? amount : 0;
            used += take;
            deferred += amount - take;
            switch (d.Kind)
            {
                case DeductionItemKind.Installment:
                    advances += take;
                    break;
                case DeductionItemKind.Other:
                    others += take;
                    break;
                default:
                    penalties += take;
                    break;
            }

            var kind = d.Kind switch
            {
                DeductionItemKind.Installment => StaffItemKind.Installment,
                DeductionItemKind.PenaltyDays => StaffItemKind.PenaltyDays,
                DeductionItemKind.PenaltyAmount => StaffItemKind.PenaltyAmount,
                _ => StaffItemKind.Other,
            };
            items.Add(StaffPayrollItem.Create(kind, d.Id, d.Reference, d.Description, d.Period, d.Days, amount, take, take < amount, d.AboveCap));
        }

        if (deferred > 0)
        {
            notes.Add("deferred");
        }

        if (capped.Any(x => x.Item.AboveCap))
        {
            notes.Add("above_cap");
        }

        // GOSI on the wage registered with GOSI (else the basic and housing) within the floor and ceiling, for the days in service.
        decimal gosiBase = 0, gosiEmployee = 0, gosiEmployer = 0;
        if (gosi is null)
        {
            notes.Add("no_gosi_rate");
        }
        else
        {
            (gosiBase, gosiEmployee, gosiEmployer) = GosiRules.Contribution(gosi, registeredWage ?? salary.Basic + salary.Housing, service);
        }

        var net = gross - absence - late - sick - penalties - others - adjustedDeductions - advances - gosiEmployee;
        if (net <= 0)
        {
            notes.Add("net_not_positive");
        }

        return (new StaffLineValues(
            e.EmployeeId, e.EmployeeNo, e.Name, e.DepartmentId, e.DepartmentAr, e.DepartmentEn, e.JobTitleAr, e.JobTitleEn,
            monthly, salary.Basic, service, service - unpaid, unpaid, lateMinutes, sickDays, overtimeHours,
            basic, housing, other, overtime, additions, absence, late, sick, penalties, advances, others + adjustedDeductions,
            (gosi?.Category ?? CategoryOf(e, from)).ToString(), gosiBase, gosiEmployee, gosiEmployer, deferred, cap, net,
            e.BankName, e.Iban, notes), items);
    }

    private static decimal Money(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
