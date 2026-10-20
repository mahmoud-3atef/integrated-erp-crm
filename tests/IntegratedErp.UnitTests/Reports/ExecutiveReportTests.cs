using IntegratedErp.Modules.Reports.Application;

namespace IntegratedErp.UnitTests.Reports;

public sealed class ExecutiveReportTests
{
    [Theory]
    [InlineData("2026-10-01", "2026-10-31", "2026-11-15", "2026-09-01", "2026-09-30", "2026-09-30")]
    [InlineData("2026-10-01", "2026-10-31", "2026-10-20", "2026-09-01", "2026-09-30", "2026-09-20")]
    [InlineData("2026-07-01", "2026-09-30", "2026-12-01", "2026-04-01", "2026-06-30", "2026-06-30")]
    [InlineData("2026-03-01", "2026-03-31", "2026-03-31", "2026-02-01", "2026-02-28", "2026-02-28")]
    [InlineData("2026-10-05", "2026-10-14", "2026-12-01", "2026-09-25", "2026-10-04", "2026-10-04")]
    public void Whole_months_compare_with_the_months_before_and_a_running_period_moves_with_as_many_days(string from, string to, string today, string previousFrom, string previousTo, string movesTo)
    {
        static DateOnly D(string s) => DateOnly.Parse(s, System.Globalization.CultureInfo.InvariantCulture);
        var period = ExecutiveReport.PeriodOf(D(from), D(to), D(today));
        Assert.Equal((D(previousFrom), D(previousTo), D(movesTo)), (period.PreviousFrom, period.PreviousTo, period.MovesPreviousTo));
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(30, 1)]
    [InlineData(31, 2)]
    [InlineData(61, 3)]
    [InlineData(91, 4)]
    [InlineData(181, 5)]
    public void A_debt_falls_in_its_age_bucket(int age, int bucket) => Assert.Equal(bucket, ExecutiveReport.Bucket(age));

    [Fact]
    public void The_trend_is_the_six_months_ending_with_the_period()
    {
        var months = ExecutiveReport.Months(new DateOnly(2026, 2, 15));
        Assert.Equal(new DateOnly(2025, 9, 1), months[0]);
        Assert.Equal(new DateOnly(2026, 2, 1), months[^1]);
        Assert.Equal(6, months.Count);
    }

    [Theory]
    [InlineData("HeadOffice", true)]
    [InlineData(" head office ", true)]
    [InlineData("pro00137", true)]
    [InlineData("pro00148", true)]
    [InlineData("PRO00138", false)]
    [InlineData(null, false)]
    public void The_head_office_and_inactive_projects_are_left_out(string? code, bool excluded) => Assert.Equal(excluded, new ReportsOptions().IsExcluded(code));
}

public sealed class MovementReportTests
{
    [Fact]
    public void The_average_stint_counts_the_returns_from_the_start_of_their_work()
    {
        var on = new DateOnly(2026, 10, 10);
        IntegratedErp.Modules.Workforce.Contracts.WorkforceMove Move(string kind, DateOnly? fromStarted) => new(Guid.NewGuid(), "BSS1", "A", kind, on, null, null, null, null, fromStarted);
        Assert.Equal(25m, MovementReport.Stint([Move("Housing", on.AddDays(-20)), Move("Housing", on.AddDays(-30)), Move("Housing", null), Move("Work", on.AddDays(-99))]));
        Assert.Null(MovementReport.Stint([Move("Work", on.AddDays(-5))]));
    }
}
