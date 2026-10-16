using IntegratedErp.Modules.Organization.Domain.LegalEntities;

namespace IntegratedErp.UnitTests.Organization;

public sealed class LegalEntityTests
{
    [Theory]
    [InlineData("300000000000003", true)]
    [InlineData("310123456700003", true)]
    [InlineData("200000000000003", false)]
    [InlineData("30000000000000", false)]
    [InlineData("30000000000000A", false)]
    public void Vat_number_format(string value, bool valid) => Assert.Equal(valid, LegalEntity.IsValidVatNumber(value));

    [Fact]
    public void Commercial_registration_must_be_ten_digits()
    {
        Assert.True(LegalEntity.Create("cp05", "كير برو", "Care-Pro", "1010101010", null).IsSuccess);
        Assert.Equal("validation.cr_number_invalid", LegalEntity.Create("cp05", "كير برو", "Care-Pro", "12345", null).Error.Code);
    }

    [Fact]
    public void Code_is_upper_cased()
    {
        Assert.Equal("CP05", LegalEntity.Create(" cp05 ", "كير برو", "Care-Pro", "1010101010", null).Value.Code);
    }
}
