using IntegratedErp.Modules.Payroll.Application;

namespace IntegratedErp.UnitTests.Payroll;

public sealed class PayslipTests
{
    [Theory]
    [InlineData("1087654321", "4321")]
    [InlineData(" 2418871203 ", "1203")]
    [InlineData("123", "123")]
    [InlineData(null, null)]
    [InlineData("  ", null)]
    public void The_ID_number_shows_its_last_four_digits_only(string? id, string? expected) => Assert.Equal(expected, PayslipService.Last4(id));

    [Fact]
    public void The_IBAN_shows_its_country_and_last_four_digits_only()
    {
        Assert.Equal("SA•• •••• 4471", PayslipService.MaskIban("SA0380000000608010164471"));
        Assert.Null(PayslipService.MaskIban(null));
        Assert.Null(PayslipService.MaskIban("SA03"));
    }
}
