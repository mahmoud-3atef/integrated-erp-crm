using IntegratedErp.SharedKernel;

namespace IntegratedErp.UnitTests.SharedKernel;

public sealed class MoneyTests
{
    [Fact]
    public void Absence_example_from_the_billing_rules()
    {
        // docs/02-target-architecture/03 §4: salary 1,000 + fee 1,500, one day absent on a 30-day basis.
        var salary = Money.Of(1000m);
        var fee = Money.Of(1500m);

        var absence = salary.Prorate(1, 30).Round();
        var invoice = (salary - absence + fee).Round();

        Assert.Equal(33.33m, absence.Amount);
        Assert.Equal(2466.67m, invoice.Amount);
        Assert.Equal(370.00m, invoice.Multiply(0.15m).Round().Amount);
    }

    [Fact]
    public void Half_month_example()
    {
        var salary = Money.Of(1000m).Prorate(15, 30).Round();
        var fee = Money.Of(1500m).Prorate(15, 30).Round();

        Assert.Equal(1250m, (salary + fee).Amount);
    }

    [Theory]
    [InlineData(0.005, 0.01)]
    [InlineData(-0.005, -0.01)]
    [InlineData(2.345, 2.35)]
    [InlineData(2.344, 2.34)]
    public void Rounding_is_two_decimals_midpoint_away_from_zero(double value, double expected) =>
        Assert.Equal((decimal)expected, Money.RoundAmount((decimal)value));

    [Fact]
    public void Currencies_do_not_mix()
    {
        Assert.Throws<InvalidOperationException>(() => Money.Of(1m) + Money.Of(1m, "USD"));
        Assert.Throws<ArgumentException>(() => Money.Of(1m, "sar"));
    }
}
