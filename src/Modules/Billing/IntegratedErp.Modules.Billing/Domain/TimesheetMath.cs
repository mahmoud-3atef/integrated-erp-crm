namespace IntegratedErp.Modules.Billing.Domain;

/// <summary>How a month's days count: always 30 (the default), or the cycle's real days (a customer's setting).</summary>
public enum DayBasis
{
    Thirty,
    ActualDays,
}

/// <summary>What a timesheet line is billed and paid from: its days, its price, the worker's pay, and the month's adjustments.</summary>
public sealed record LineInputs(
    decimal WorkDays,
    decimal DayDivisor,
    decimal BillSalary,
    decimal TotalPrice,
    decimal Housing,
    decimal Transport,
    decimal PaySalary,
    decimal BasicSalary,
    decimal AbsenceDays,
    decimal OvertimeHours,
    decimal ClientAdditions,
    decimal ClientDeductions,
    decimal CustomerLoans,
    decimal FeeDaysAdjust,
    decimal OtherCosts,
    decimal InternalAdditions = 0,
    decimal InternalDeductions = 0);

/// <summary>The project's billing rules for overtime, GOSI and VAT.</summary>
public sealed record BillingRules(decimal OvertimeMultiplier, decimal MonthlyHours, decimal? OvertimeHourlyRate, decimal GosiRate, decimal VatRate, bool CostPlus);

/// <summary>A line's amounts: what the customer is invoiced (before and after VAT), and what the worker earns from the month.</summary>
public sealed record LineAmounts(
    decimal FeeDays,
    decimal DueSalary,
    decimal AbsenceAmount,
    decimal DueFees,
    decimal DueHousing,
    decimal DueTransport,
    decimal Overtime,
    decimal Gosi,
    decimal InvoiceAmount,
    decimal Vat,
    decimal InvoiceTotal,
    decimal PayDueSalary,
    decimal PayAbsence,
    decimal WorkerNet);

/// <summary>
/// The billing formulas of the old system's timesheet template (docs/02-target-architecture/03 §3, checked on 6,610
/// real invoice lines), per timesheet line:
/// <code>
/// due salary   = R / Q × salary                 absence = salary / Q × absent days   (the salary part only)
/// due fees     = S / Q × (price − salary)        of which housing = S / Q × housing, transport = S / Q × transport
/// overtime     = basic / monthly hours × hours × multiplier   (or a fixed hourly rate of the project)
/// GOSI         = salary × rate                   (Cost Plus only)
/// invoice      = due salary − absence + overtime + customer additions − customer deductions − customer loans
///                + due fees + other costs + GOSI;   VAT on it
/// worker's net = the same from the worker's own salary: due − absence + overtime + additions − deductions − loans
///                + the company's internal additions − its internal deductions   (the pay only, never the invoice)
/// </code>
/// R: the line's work days, Q: 30 (or the cycle's days), S: R ± an approved fee-days adjustment.
/// </summary>
public static class TimesheetMath
{
    public static LineAmounts Calculate(LineInputs i, BillingRules rules)
    {
        ArgumentNullException.ThrowIfNull(i);
        ArgumentNullException.ThrowIfNull(rules);
        var q = i.DayDivisor <= 0 ? 30 : i.DayDivisor;
        var r = i.WorkDays;
        var s = Math.Max(0, r + i.FeeDaysAdjust);
        var dueSalary = Round(r / q * i.BillSalary);
        var absence = Round(i.BillSalary / q * i.AbsenceDays);
        var dueFees = Round(Math.Abs(s / q * (i.TotalPrice - i.BillSalary)));
        var dueHousing = Round(s / q * i.Housing);
        var dueTransport = Round(s / q * i.Transport);
        var overtime = i.OvertimeHours <= 0
            ? 0
            : rules.OvertimeHourlyRate is { } rate
                ? Round(rate * i.OvertimeHours)
                : Round((i.BasicSalary > 0 ? i.BasicSalary : i.PaySalary) / (rules.MonthlyHours <= 0 ? 240 : rules.MonthlyHours) * i.OvertimeHours * rules.OvertimeMultiplier);
        var gosi = rules.CostPlus && r > 0 ? Round(i.BillSalary * rules.GosiRate) : 0;
        var invoice = dueSalary - absence + overtime + i.ClientAdditions - i.ClientDeductions - i.CustomerLoans + dueFees + i.OtherCosts + gosi;
        var vat = Round(invoice * rules.VatRate);
        var payDue = Round(r / q * i.PaySalary);
        var payAbsence = Round(i.PaySalary / q * i.AbsenceDays);
        var net = payDue - payAbsence + overtime + i.ClientAdditions - i.ClientDeductions - i.CustomerLoans + i.InternalAdditions - i.InternalDeductions;
        return new LineAmounts(s, dueSalary, absence, dueFees, dueHousing, dueTransport, overtime, gosi, invoice, vat, invoice + vat, payDue, payAbsence, net);
    }

    /// <summary>
    /// A billing cycle for a month: from the project's start day of the previous month to the day before it in this
    /// month (start day 1: the calendar month). The month is the one the cycle ends in.
    /// </summary>
    public static (DateOnly From, DateOnly To) Cycle(DateOnly month, int startDay)
    {
        var first = new DateOnly(month.Year, month.Month, 1);
        if (startDay <= 1)
        {
            return (first, first.AddMonths(1).AddDays(-1));
        }

        var day = Math.Min(startDay, 28);
        return (first.AddMonths(-1).AddDays(day - 1), first.AddDays(day - 2));
    }

    /// <summary>
    /// The work days of one worker's periods in a cycle ("a month is 30 days", docs/02-target-architecture/06 §9):
    /// with <see cref="DayBasis.Thirty"/> only the cycle's first 30 days count, and a worker present the whole cycle
    /// has 30 days even in a 28-day month (the extra days go to the line holding the cycle's end). With
    /// <see cref="DayBasis.ActualDays"/> the days present. One value per period, in the order given.
    /// </summary>
    public static decimal[] WorkDays(IReadOnlyList<(DateOnly StartsOn, DateOnly? EndsOn)> periods, DateOnly from, DateOnly to, DayBasis basis)
    {
        ArgumentNullException.ThrowIfNull(periods);
        var length = to.DayNumber - from.DayNumber + 1;
        var counted = basis == DayBasis.Thirty && length > 30 ? from.AddDays(29) : to;
        var days = periods.Select(p => (decimal)Overlap(p.StartsOn, p.EndsOn, from, counted)).ToArray();
        if (basis == DayBasis.Thirty && length < 30 && periods.Sum(p => Overlap(p.StartsOn, p.EndsOn, from, to)) >= length)
        {
            var last = periods.Select((p, n) => (p, n)).LastOrDefault(x => Overlap(x.p.StartsOn, x.p.EndsOn, to, to) > 0).n;
            days[last] += 30 - length;
        }

        return days;
    }

    /// <summary>Days of a period (end exclusive) within the days from–to (both included).</summary>
    public static int Overlap(DateOnly startsOn, DateOnly? endsOn, DateOnly from, DateOnly to)
    {
        var start = startsOn > from ? startsOn : from;
        var after = to.AddDays(1);
        var end = endsOn is { } e && e < after ? e : after;
        return Math.Max(0, end.DayNumber - start.DayNumber);
    }

    private static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}
