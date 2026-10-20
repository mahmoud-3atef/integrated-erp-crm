using IntegratedErp.Modules.Attendance.Contracts;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Payroll.Application;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Staff.Contracts;

namespace IntegratedErp.UnitTests.Payroll;

public sealed class StaffPayCalculatorTests
{
    private static readonly DateOnly From = new(2026, 9, 21);
    private static readonly DateOnly To = new(2026, 10, 20);
    private static readonly StaffPayRules Rules = new(50, 8, LateDeductionMode.None, 50);
    private static readonly StaffGosi Legacy = new(GosiCategory.SaudiLegacy, 9.75m, 11.75m, 1500, 45000);

    private static StaffPayInfo Employee(StaffSalaryInfo salary, DateOnly? hired = null, string nationality = "SAU", string? iban = "SA0380000000608010167519") =>
        new(Guid.NewGuid(), "HO00118", "شروق", Guid.NewGuid(), null, null, null, null, null, "Active", hired ?? new DateOnly(2020, 1, 1), null, nationality, null, "الراجحي", iban, salary, false, 0);

    private static ClosedAttendanceLine Attendance(decimal deductionDays = 0, int late = 0, int early = 0, int overtime = 0, decimal sickPart = 0, decimal unpaid = 0) =>
        new(Guid.NewGuid(), "HO00118", null, 22, 22, 0, 0, late, early, deductionDays, overtime, 0, sickPart, unpaid);

    private static DueDeduction Due(DeductionItemKind kind, decimal amount, decimal days = 0, bool aboveCap = false, string period = "2026-10") =>
        new(Guid.NewGuid(), kind, Guid.Empty, kind.ToString(), period, days, amount, aboveCap, "—");

    [Fact]
    public void A_full_month_pays_every_element_with_overtime_by_article_107_and_the_GOSI_share()
    {
        var salary = new StaffSalaryInfo(6400, 1600, 0, 700, 0, 0, 0, 8700);
        var (v, items) = StaffPayCalculator.Line(Employee(salary), salary, Attendance(overtime: 180), [Due(DeductionItemKind.Installment, 776)], [], Legacy, Rules, From, To);

        Assert.Equal((30m, 30m), (v.ServiceDays, v.PaidDays));
        Assert.Equal((6400m, 1600m, 700m), (v.Basic, v.Housing, v.OtherAllowances));
        Assert.Equal(148.75m, v.Overtime); // 3 × (8,700 ÷ 240 + 50% × 6,400 ÷ 240)
        Assert.Equal((8000m, 780m, 940m), (v.GosiBase, v.GosiEmployee, v.GosiEmployer));
        Assert.Equal(776m, v.Advances);
        Assert.Equal(8700m + 148.75m - 776m - 780m, v.Net);
        Assert.Single(items, i => i.Kind == StaffItemKind.Installment && i.Deducted == 776 && !i.Deferred);
        Assert.DoesNotContain("deferred", v.Notes);
    }

    [Fact]
    public void Absence_lateness_by_the_minute_and_the_sick_part_are_at_the_day_wage()
    {
        var salary = new StaffSalaryInfo(2400, 600, 0, 0, 0, 0, 0, 3000);
        var (v, _) = StaffPayCalculator.Line(Employee(salary), salary, Attendance(deductionDays: 2, unpaid: 1, late: 45, early: 15, sickPart: 2), [], [], Legacy, Rules with { LateMode = LateDeductionMode.PerMinute }, From, To);

        Assert.Equal((27m, 3m), (v.PaidDays, v.UnpaidDays));
        Assert.Equal(300m, v.Absence); // 3 × 3,000 ÷ 30
        Assert.Equal(12.5m, v.Late); // 60 minutes × 3,000 ÷ 240 ÷ 60
        Assert.Equal(50m, v.SickPart); // 2 × 100 × 25%
        Assert.Equal(3000m - 300m - 12.5m - 50m - 292.5m, v.Net);
    }

    [Fact]
    public void Lateness_is_not_deducted_when_the_setting_says_so()
    {
        var salary = new StaffSalaryInfo(2400, 600, 0, 0, 0, 0, 0, 3000);
        var (v, _) = StaffPayCalculator.Line(Employee(salary), salary, Attendance(late: 120), [], [], Legacy, Rules, From, To);
        Assert.Equal((0m, 120m), (v.Late, v.LateMinutes));
    }

    [Fact]
    public void Above_the_months_cap_installments_are_deferred_first_then_other_deductions_then_penalties()
    {
        var salary = new StaffSalaryInfo(3000, 0, 0, 0, 0, 0, 0, 3000);
        var due = new[] { Due(DeductionItemKind.Installment, 1200), Due(DeductionItemKind.Other, 400), Due(DeductionItemKind.PenaltyDays, 0, days: 2) };
        var (v, items) = StaffPayCalculator.Line(Employee(salary, nationality: "PHL"), salary, Attendance(), due, [], null, Rules, From, To);

        Assert.Equal(1500m, v.CapLimit);
        Assert.Equal((200m, 400m, 900m, 300m), (v.Penalties, v.OtherDeductions, v.Advances, v.Deferred));
        var installment = Assert.Single(items, i => i.Kind == StaffItemKind.Installment);
        Assert.Equal((1200m, 900m, true), (installment.Due, installment.Deducted, installment.Deferred));
        Assert.Contains("deferred", v.Notes);
        Assert.Contains("no_gosi_rate", v.Notes);
    }

    [Fact]
    public void A_deduction_approved_above_the_cap_is_taken_whole()
    {
        var salary = new StaffSalaryInfo(3000, 0, 0, 0, 0, 0, 0, 3000);
        var (v, _) = StaffPayCalculator.Line(Employee(salary), salary, Attendance(), [Due(DeductionItemKind.Installment, 2000, aboveCap: true)], [], Legacy, Rules, From, To);
        Assert.Equal((2000m, 0m), (v.Advances, v.Deferred));
        Assert.Contains("above_cap", v.Notes);
    }

    [Fact]
    public void A_joiner_is_paid_the_days_in_service_and_an_adjustment_adds_to_the_net()
    {
        var salary = new StaffSalaryInfo(3000, 0, 0, 0, 0, 0, 0, 3000);
        var adjustment = new StaffAdjustmentInput(Guid.NewGuid(), AdjustmentKind.Addition, 250, "مكافأة");
        var (v, _) = StaffPayCalculator.Line(Employee(salary, hired: new DateOnly(2026, 10, 1)), salary, null, [], [adjustment], Legacy, Rules, From, To);

        Assert.Equal((20m, 2000m, 250m), (v.ServiceDays, v.Basic, v.Additions));
        Assert.Contains("joined", v.Notes);
        Assert.Contains("no_attendance", v.Notes);
        Assert.Equal(2000m + 250m - 195m, v.Net); // GOSI 9.75% of 3,000 × 20 ÷ 30
    }

    [Theory]
    [InlineData("2026-09-21", "2026-10-20", null, null, 30)]
    [InlineData("2026-01-01", "2026-01-31", null, null, 30)]
    [InlineData("2026-01-01", "2026-01-31", "2026-01-11", null, 21)]
    [InlineData("2026-01-01", "2026-01-31", null, "2026-01-10", 10)]
    [InlineData("2026-01-01", "2026-01-31", "2026-02-01", null, 0)]
    public void The_service_days_follow_the_30_day_rule(string from, string to, string? hired, string? ended, int days) =>
        Assert.Equal(days, StaffPayCalculator.ServiceDays(Day(from), Day(to), hired is null ? null : Day(hired), ended is null ? null : Day(ended)));

    private static DateOnly Day(string text) => DateOnly.Parse(text, System.Globalization.CultureInfo.InvariantCulture);

    [Fact]
    public void GOSI_categories_follow_the_nationality_and_the_date_of_joining()
    {
        var salary = new StaffSalaryInfo(3000, 0, 0, 0, 0, 0, 0, 3000);
        Assert.Equal(GosiCategory.SaudiLegacy, StaffPayCalculator.CategoryOf(Employee(salary, hired: new DateOnly(2024, 7, 2)), From));
        Assert.Equal(GosiCategory.SaudiNew, StaffPayCalculator.CategoryOf(Employee(salary, hired: new DateOnly(2024, 7, 3)), From));
        Assert.Equal(GosiCategory.NonSaudi, StaffPayCalculator.CategoryOf(Employee(salary, nationality: "PAK"), From));
    }
}
