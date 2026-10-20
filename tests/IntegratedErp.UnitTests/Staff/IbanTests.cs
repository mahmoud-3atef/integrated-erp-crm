using IntegratedErp.Modules.Staff.Domain;

namespace IntegratedErp.UnitTests.Staff;

public sealed class IbanTests
{
    [Theory]
    [InlineData("SA0380000000608010167519", true)]
    [InlineData("sa03 8000 0000 6080 1016 7519", true)]
    [InlineData("SA0480000000608010167519", false)]
    [InlineData("SA038000000060801016751", false)]
    [InlineData("AE070331234567890123456", false)]
    public void Saudi_IBANs_are_checked_with_mod_97(string iban, bool valid) => Assert.Equal(valid, Ibans.Valid(Ibans.Normalize(iban)!));
}
