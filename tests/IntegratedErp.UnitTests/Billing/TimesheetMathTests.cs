using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.Modules.Billing.Domain;

namespace IntegratedErp.UnitTests.Billing;

/// <summary>The example of docs/02-target-architecture/06 §7 (project "A", October, 30-day basis) and the cycle rules.</summary>
public sealed class TimesheetMathTests
{
    private static readonly BillingRules TotalCost = new(1.5m, 240, null, 0.02m, 0.15m, CostPlus: false);

    private static LineInputs Line(decimal days, decimal salary, decimal fee, decimal housing = 0, decimal absence = 0, decimal overtime = 0, decimal basic = 0) =>
        new(days, 30, salary, salary + fee + housing, housing, 0, salary, basic, absence, overtime, 0, 0, 0, 0, 0);

    [Fact]
    public void A_full_month_with_an_absent_day_takes_the_day_off_the_salary_only()
    {
        var a = TimesheetMath.Calculate(Line(30, 1000, 1500, absence: 1), TotalCost);
        Assert.Equal((1000m, 33.33m, 1500m, 2466.67m), (a.DueSalary, a.AbsenceAmount, a.DueFees, a.InvoiceAmount));
        Assert.Equal((370.00m, 2836.67m), (a.Vat, a.InvoiceTotal));
        Assert.Equal(966.67m, a.WorkerNet);
    }

    [Fact]
    public void Two_prices_in_a_month_make_two_lines()
    {
        Assert.Equal(1260.00m, TimesheetMath.Calculate(Line(14, 1200, 1300, housing: 200), TotalCost).InvoiceAmount);
        var second = TimesheetMath.Calculate(Line(16, 1200, 1500, housing: 200, overtime: 10, basic: 900), TotalCost);
        Assert.Equal((640m, 906.67m, 106.67m, 56.25m, 1602.92m), (second.DueSalary, second.DueFees, second.DueHousing, second.Overtime, second.InvoiceAmount));
    }

    /// <summary>
    /// The old system's Excel template (ProjectAttendance, September 2026, pro00032), its formulas cell by cell: salary
    /// 2,000 (basic 1,700), price 5,150, 30 days; 2 absent days, 10 overtime hours, a 300 company loan installment
    /// (AL: off the pay, back on the invoice), 150 paid by the customer (AO) and 50 deducted by them (AJ).
    /// </summary>
    [Fact]
    public void The_old_excel_template_and_the_system_give_the_same_pay_and_invoice()
    {
        static decimal R(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);
        decimal q = 30, r = 30, s = 30, basic = 1700, y = 2000, ac = 5150, ah = 2, aj = 50, al = 300, ao = 150, ap = 10;
        var ad = R(r / q * y);
        var ag = R(Math.Abs(s / q * (ac - y)));
        var ai = R(y / q * ah);
        var aq = R(basic / (30 * 8) * ap * 1.5m);
        var ar = ad + ao + aq - (aj + 0 + ai + al) - 0 + 0;
        var av = ar + ag + 0 + al + 0 + 0 - 0;

        var a = TimesheetMath.Calculate(
            new LineInputs(30, 30, 2000, 5150, 300, 300, 2000, 1700, ah, ap, ao, aj, 0, 0, 0, InternalDeductions: al), TotalCost);
        Assert.Equal((ar, av, R(av * 0.15m)), (a.WorkerNet, a.InvoiceAmount, a.Vat));
    }

    [Fact]
    public void An_overtime_amount_counts_with_the_hours_and_other_deductions_lower_the_invoice_only()
    {
        var plain = TimesheetMath.Calculate(Line(30, 1000, 1500, overtime: 10, basic: 900), TotalCost);
        var a = TimesheetMath.Calculate(Line(30, 1000, 1500, overtime: 10, basic: 900) with { OvertimeAmount = 200, OtherDeductions = 75 }, TotalCost);
        Assert.Equal(plain.Overtime + 200, a.Overtime);
        Assert.Equal(plain.WorkerNet + 200, a.WorkerNet);
        Assert.Equal(plain.InvoiceAmount + 200 - 75, a.InvoiceAmount);
    }

    [Fact]
    public void Internal_additions_and_deductions_change_the_pay_and_never_the_invoice()
    {
        var plain = TimesheetMath.Calculate(Line(30, 1000, 1500), TotalCost);
        var a = TimesheetMath.Calculate(Line(30, 1000, 1500) with { InternalAdditions = 300, InternalDeductions = 120 }, TotalCost);
        Assert.Equal((plain.InvoiceAmount, plain.Vat, plain.InvoiceTotal), (a.InvoiceAmount, a.Vat, a.InvoiceTotal));
        Assert.Equal(plain.WorkerNet + 180, a.WorkerNet);
    }

    [Fact]
    public void Cost_plus_adds_gosi_on_the_salary()
    {
        var a = TimesheetMath.Calculate(Line(30, 1500, 800), TotalCost with { CostPlus = true });
        Assert.Equal((30m, 2330m), (a.Gosi, a.InvoiceAmount));
    }

    [Fact]
    public void A_fixed_overtime_rate_replaces_the_basic_salary_rule() =>
        Assert.Equal(250m, TimesheetMath.Calculate(Line(30, 1000, 1500, overtime: 10, basic: 900), TotalCost with { OvertimeHourlyRate = 25 }).Overtime);

    [Fact]
    public void A_month_is_30_days()
    {
        var october = (new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31));

        // Two prices in October: 14 + 16 (the 31st does not count); a start on the 20th: 11 days.
        Assert.Equal([14m, 16m], TimesheetMath.WorkDays([(new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 15)), (new DateOnly(2026, 10, 15), null)], october.Item1, october.Item2, DayBasis.Thirty));
        Assert.Equal([11m], TimesheetMath.WorkDays([(new DateOnly(2026, 10, 20), null)], october.Item1, october.Item2, DayBasis.Thirty));

        // February: the whole month is 30 days; part of it, the days present.
        var february = (new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28));
        Assert.Equal([30m], TimesheetMath.WorkDays([(new DateOnly(2026, 1, 1), null)], february.Item1, february.Item2, DayBasis.Thirty));
        Assert.Equal([10m], TimesheetMath.WorkDays([(new DateOnly(2026, 2, 19), null)], february.Item1, february.Item2, DayBasis.Thirty));

        // The actual days of the cycle, for a customer who bills that way.
        Assert.Equal([31m], TimesheetMath.WorkDays([(new DateOnly(2026, 9, 1), null)], october.Item1, october.Item2, DayBasis.ActualDays));
    }

    [Theory]
    [InlineData(1, "2026-10-01", "2026-10-31")]
    [InlineData(21, "2026-09-21", "2026-10-20")]
    [InlineData(26, "2026-09-26", "2026-10-25")]
    public void A_cycle_ends_in_its_month(int startDay, string from, string to) =>
        Assert.Equal((DateOnly.Parse(from, System.Globalization.CultureInfo.InvariantCulture), DateOnly.Parse(to, System.Globalization.CultureInfo.InvariantCulture)), TimesheetMath.Cycle(new DateOnly(2026, 10, 1), startDay));

    [Fact]
    public void Yearly_numbers_need_the_year() =>
        Assert.Equal("numbering_pattern_year", NumberingExtensions.Validate("TS-{N:5}", NumberReset.Yearly));
}
