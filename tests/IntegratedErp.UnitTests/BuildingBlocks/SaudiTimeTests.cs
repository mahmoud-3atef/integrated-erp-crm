using IntegratedErp.BuildingBlocks.Time;

namespace IntegratedErp.UnitTests.BuildingBlocks;

public sealed class SaudiTimeTests
{
    [Fact]
    public void Business_date_is_the_riyadh_calendar_date()
    {
        // 21:30 UTC on the 14th is already the 15th in Riyadh (UTC+3) — the "same-day" bug class of the old system.
        Assert.Equal(new DateOnly(2026, 10, 15), SaudiTime.ToBusinessDate(new DateTimeOffset(2026, 10, 14, 21, 30, 0, TimeSpan.Zero)));
        Assert.Equal(new DateOnly(2026, 10, 14), SaudiTime.ToBusinessDate(new DateTimeOffset(2026, 10, 14, 20, 59, 0, TimeSpan.Zero)));
    }

    [Fact]
    public void Riyadh_has_no_daylight_saving()
    {
        Assert.Equal(TimeSpan.FromHours(3), SaudiTime.Zone.GetUtcOffset(new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc)));
        Assert.Equal(TimeSpan.FromHours(3), SaudiTime.Zone.GetUtcOffset(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)));
    }
}
