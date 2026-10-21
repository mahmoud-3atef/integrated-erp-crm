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

public sealed class ShowroomRulesTests
{
    [Theory]
    [InlineData("فندق ريكسوس ابحر - Waiter", "WAITER")]
    [InlineData("شركة برج اصيلة للخدمات الفندقية - Service - Banquet", "WAITER")]
    [InlineData("فندق ريكسوس ابحر - HK", "HOUSEKEEPING")]
    [InlineData("قسم الضيافة", "HOSPITALITY")]
    [InlineData("EXACT", null)]
    [InlineData("شركة الاتصال الميداني - CONNECT SERVICES", null)]
    [InlineData(null, null)]
    public void A_specialty_is_suggested_from_the_work_places_name(string? place, string? specialty) =>
        Assert.Equal(specialty, IntegratedErp.Modules.Workforce.Application.WorkerShowcaseService.Suggest(place));

    [Theory]
    [InlineData("فندق جبل عمر دبل تري باي هيلتون", true)]
    [InlineData("REXOS KAEC", true)]
    [InlineData("شركة الحدود الزرقاء", false)]
    public void Hotel_experience_is_read_from_the_places(string place, bool hotel) =>
        Assert.Equal(hotel, IntegratedErp.Modules.Operations.Application.Showroom.IsHotel(place));

    [Fact]
    public void The_presentation_shows_the_first_name() => Assert.Equal("MARIA", IntegratedErp.Modules.Operations.Application.Showroom.FirstName("  MARIA SANTOS CRUZ"));
}

public sealed class WorkerPhotoTests
{
    [Fact]
    public void Only_jpeg_png_and_webp_are_photos()
    {
        Assert.Equal("image/jpeg", IntegratedErp.Modules.Workforce.Domain.WorkerPhoto.ImageType([0xFF, 0xD8, 0xFF, 0xE0]));
        Assert.Equal("image/webp", IntegratedErp.Modules.Workforce.Domain.WorkerPhoto.ImageType("RIFF0000WEBPVP8 "u8));
        Assert.Null(IntegratedErp.Modules.Workforce.Domain.WorkerPhoto.ImageType("%PDF-1.7"u8));
    }
}

public sealed class WorkerCostRulesTests
{
    private static readonly DateOnly On = new(2026, 9, 15);

    private static IntegratedErp.Modules.Workforce.Domain.SupplierCostPackage Package(string? profession, string? nationality, decimal cost, string from = "2026-01-01") =>
        new(Guid.NewGuid(), new IntegratedErp.Modules.Workforce.Domain.CostValues("IRC - 02", profession, nationality, cost, IntegratedErp.Modules.Workforce.Domain.CostMethod.MonthlyFixed, DateOnly.Parse(from, System.Globalization.CultureInfo.InvariantCulture), null), "t", DateTimeOffset.UtcNow);

    [Fact]
    public void A_worker_takes_the_narrowest_package_that_fits_and_has_started()
    {
        var any = Package(null, null, 2500);
        var waiter = Package("6132115", null, 2800);
        var filipinoWaiter = Package("6132115", "PHL", 3000);
        var later = Package("6132115", "PHL", 3300, "2026-10-01");
        var packages = new[] { any, waiter, filipinoWaiter, later };
        Assert.Equal(3000m, IntegratedErp.Modules.Workforce.Application.WorkerCostService.Best(packages, "IRC - 02", "6132115", "PHL", On)!.MonthlyCost);
        Assert.Equal(2800m, IntegratedErp.Modules.Workforce.Application.WorkerCostService.Best(packages, "irc - 02", "6132115", "IND", On)!.MonthlyCost);
        Assert.Equal(2500m, IntegratedErp.Modules.Workforce.Application.WorkerCostService.Best(packages, "IRC - 02", "999", "IND", On)!.MonthlyCost);
        Assert.Null(IntegratedErp.Modules.Workforce.Application.WorkerCostService.Best(packages, "Ewan - 13", "6132115", "PHL", On));
    }

    [Theory]
    [InlineData("Care-Pro - 05", "Company")]
    [InlineData("Care-pro - 07", "Company")]
    [InlineData("IRC - 02", "Supplier")]
    [InlineData(null, "Unknown")]
    public void The_source_is_read_from_the_sponsor(string? sponsor, string source) =>
        Assert.Equal(source, IntegratedErp.Modules.Workforce.Domain.WorkerSources.Of(sponsor).ToString());
}
