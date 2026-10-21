using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Payroll.Application;
using IntegratedErp.Modules.Payroll.Domain;

namespace IntegratedErp.UnitTests.Payroll;

public sealed class SettlementCalculatorTests
{
    private static SettlementCalculation End(EndReason reason, string hired, string lastDay, decimal wage = 7500, decimal leave = 0, ContractTerm term = ContractTerm.Indefinite, string? ends = null) =>
        new(SettlementKind.EndOfService, reason, term, ends is null ? null : DateOnly.Parse(ends, System.Globalization.CultureInfo.InvariantCulture), wage,
            Day(hired), Day(lastDay), null, 0, leave, [], 0, 0, 0);

    private static DateOnly Day(string s) => DateOnly.Parse(s, System.Globalization.CultureInfo.InvariantCulture);

    private static decimal Amount(SettlementResult r, string code) => r.Lines.Where(l => l.Code == code).Sum(l => l.Amount);

    [Fact]
    public void A_resignation_after_three_years_takes_a_third_of_half_a_month_for_each_year()
    {
        var r = SettlementCalculator.Calculate(End(EndReason.Resignation, "2023-07-01", "2026-11-15"));

        Assert.Equal(1234, r.ServiceDays);
        Assert.Equal(12678.08m, r.AwardFull); // 3,750 × 1,234 ÷ 365
        Assert.Equal(1m / 3m, r.AwardFactor, 4);
        Assert.Equal(4226.03m, Amount(r, "end_of_service"));
    }

    [Theory]
    [InlineData("2025-01-01", "2026-06-30", 0)] // under two years: nothing
    [InlineData("2019-01-01", "2025-12-31", 0.6667)] // five to ten: two thirds
    [InlineData("2014-01-01", "2025-12-31", 1)] // ten and more: all
    public void A_resignation_share_follows_article_85(string hired, string lastDay, decimal factor) =>
        Assert.Equal(factor, SettlementCalculator.Calculate(End(EndReason.Resignation, hired, lastDay)).AwardFactor, 4);

    [Fact]
    public void After_five_years_each_year_counts_a_whole_month()
    {
        // 2018-01-01 to 2023-12-31: 2,191 days (two leap years) = 6.0027 years.
        var r = SettlementCalculator.Calculate(End(EndReason.ContractEnd, "2018-01-01", "2023-12-31", wage: 6000));

        Assert.Equal(2191, r.ServiceDays);
        Assert.Equal(decimal.Round((3000m * 5) + (6000m * ((2191m / 365m) - 5)), 2, MidpointRounding.AwayFromZero), Amount(r, "end_of_service"));
    }

    [Fact]
    public void Ending_without_a_lawful_reason_adds_article_77_two_months_at_least()
    {
        var indefinite = SettlementCalculator.Calculate(End(EndReason.EmployerTermination, "2025-01-01", "2025-12-31", wage: 6000));
        Assert.Equal(12000, Amount(indefinite, "article_77")); // 15 days a year (3,000) is under two months

        var fixedTerm = SettlementCalculator.Calculate(End(EndReason.EmployerTermination, "2025-01-01", "2025-12-31", wage: 6000, term: ContractTerm.Fixed, ends: "2026-04-10"));
        Assert.Equal(20000, Amount(fixedTerm, "article_77")); // the 100 days left of the contract at 200

        Assert.Equal(0, Amount(SettlementCalculator.Calculate(End(EndReason.Resignation, "2025-01-01", "2025-12-31")), "article_77"));
    }

    [Theory]
    [InlineData(EndReason.Probation)]
    [InlineData(EndReason.Article80)]
    public void No_award_in_the_probation_or_under_article_80_but_the_leave_balance_is_paid(EndReason reason)
    {
        var r = SettlementCalculator.Calculate(End(reason, "2026-01-01", "2026-03-31", wage: 3000, leave: 5));

        Assert.Equal(0, Amount(r, "end_of_service"));
        Assert.Equal(500, Amount(r, "leave_balance"));
    }

    [Theory]
    [InlineData("2026-11-01", "2026-11-30", 30)]
    [InlineData("2026-02-01", "2026-02-28", 30)] // a whole month is 30
    [InlineData("2026-01-15", "2026-01-31", 17)]
    [InlineData("2026-01-31", "2026-03-02", 33)] // 1 + 30 + 2
    public void The_unpaid_days_follow_the_payroll_30_day_rule(string from, string to, decimal days) =>
        Assert.Equal(days, SettlementCalculator.PayDays(Day(from), Day(to)));

    [Fact]
    public void A_vacation_settlement_pays_the_unpaid_month_and_the_leave_less_the_installment()
    {
        var installment = new DueDeduction(Guid.NewGuid(), DeductionItemKind.Installment, Guid.NewGuid(), "ADV-2026-00102", "2026-12", 0, 300, false, "ADV-2026-00102");
        var r = SettlementCalculator.Calculate(new SettlementCalculation(
            SettlementKind.Vacation, null, ContractTerm.Indefinite, null, 1100, Day("2025-09-21"), Day("2026-11-30"), Day("2026-11-01"), 0, 30, [installment], 0, 0, 0));

        Assert.Equal(1100, Amount(r, "unpaid_salary"));
        Assert.Equal(1100, Amount(r, "leave_allowance"));
        Assert.Equal(0, Amount(r, "end_of_service"));
        Assert.Equal((2200m, 300m, 1900m), (r.TotalAdditions, r.TotalDeductions, r.Net));
        Assert.Equal(installment.Id, Assert.Single(r.Lines, l => l.Code == "installment").SourceId);
    }

    [Fact]
    public void Day_penalties_are_valued_at_the_day_wage_and_the_entries_are_added()
    {
        var penalty = new DueDeduction(Guid.NewGuid(), DeductionItemKind.PenaltyDays, Guid.NewGuid(), "PN-1", "2026-11", 2, 0, false, "تأخير");
        var r = SettlementCalculator.Calculate(new SettlementCalculation(
            SettlementKind.Vacation, null, ContractTerm.Indefinite, null, 3000, Day("2025-01-01"), Day("2026-11-30"), null, 0, 10, [penalty], 150, 400, 50));

        Assert.Equal(200, Amount(r, "penalty_days"));
        Assert.Equal((1000m + 150m, 200m + 400m + 50m), (r.TotalAdditions, r.TotalDeductions));
    }

    [Fact]
    public void A_worker_is_paid_the_approved_timesheet_at_its_net_and_the_days_on_the_job_after_it()
    {
        var line = new TimesheetPay(Guid.NewGuid(), "TS-2026-00012", 20, 980);
        var r = SettlementCalculator.Calculate(new SettlementCalculation(
            SettlementKind.Vacation, null, ContractTerm.Indefinite, null, 1500, Day("2024-10-01"), Day("2026-10-15"), Day("2026-10-01"), 0, 30, [], 0, 0, 0, [line], 12));

        Assert.Equal((980m, 20m, line.LineId), (Amount(r, "timesheet_pay"), r.Lines.Single(l => l.Code == "timesheet_pay").Days, r.Lines.Single(l => l.Code == "timesheet_pay").SourceId!.Value));
        Assert.Equal(600, Amount(r, "unpaid_salary")); // 12 days on the job (not the 15 calendar days: housing is not paid)
        Assert.Equal(1500, Amount(r, "leave_allowance"));
    }

    [Theory]
    [InlineData("2026-10-01", "2026-10-15", "2026-09-11", null, 15)]
    [InlineData("2026-10-01", "2026-10-31", "2026-09-11", null, 30)] // a month on the job is 30
    [InlineData("2026-10-01", "2026-10-31", "2026-10-06", "2026-10-16", 10)] // the end is the first day off the job
    [InlineData("2026-02-01", "2026-02-28", "2026-01-01", null, 30)]
    public void A_worker_days_on_the_job_follow_the_ledger_and_the_30_day_rule(string from, string to, string starts, string? ends, decimal days) =>
        Assert.Equal(days, SettlementService.WorkedDays(Day(from), Day(to), [(Day(starts), ends is null ? null : Day(ends))]));

    [Fact]
    public void Unpaid_leave_above_20_days_a_year_is_not_service()
    {
        var hired = Day("2024-01-01");
        Assert.Equal(10, SettlementCalculator.ExcludedDays(hired, Day("2025-12-31"), [(Day("2024-03-01"), Day("2024-03-30"))]));
        Assert.Equal(0, SettlementCalculator.ExcludedDays(hired, Day("2025-12-31"), [(Day("2024-03-01"), Day("2024-03-15")), (Day("2025-03-01"), Day("2025-03-15"))]));
    }
}
