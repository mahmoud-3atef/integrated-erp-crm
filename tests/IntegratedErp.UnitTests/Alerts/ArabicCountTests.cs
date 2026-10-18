using IntegratedErp.BuildingBlocks.Alerts;

namespace IntegratedErp.UnitTests.Alerts;

public sealed class ArabicCountTests
{
    private static readonly int[] SomeDays = [1, 2, 7, 45];

    [Theory]
    [InlineData(1, "فاتورة واحدة متأخرة")]
    [InlineData(2, "فاتورتان متأخرتان")]
    [InlineData(4, "4 فواتير متأخرة")]
    [InlineData(10, "10 فواتير متأخرة")]
    [InlineData(11, "11 فاتورة متأخرة")]
    [InlineData(103, "103 فاتورة متأخرة")]
    public void A_counted_noun_agrees_with_its_number(int n, string expected) =>
        Assert.Equal(expected, ArabicCount.Of(n, "فاتورة واحدة متأخرة", "فاتورتان متأخرتان", "فواتير متأخرة", "فاتورة متأخرة"));

    [Fact]
    public void Days_read_right_after_since_or_in() =>
        Assert.Equal(["يوم واحد", "يومين", "7 أيام", "45 يومًا"], SomeDays.Select(ArabicCount.Days));
}
