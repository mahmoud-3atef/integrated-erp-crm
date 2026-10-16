using IntegratedErp.BuildingBlocks.Numbering;

namespace IntegratedErp.UnitTests.BuildingBlocks;

public sealed class DocumentNumberFormatTests
{
    private static readonly DateOnly Date = new(2026, 10, 16);

    [Theory]
    [InlineData("{SCOPE}-INV-{YYYY}-{N:6}", 123, "CP05", "CP05-INV-2026-000123")]
    [InlineData("DO-{YY}{MM}-{N:5}", 7, "", "DO-2610-00007")]
    [InlineData("SW{N:6}", 9733, "", "SW009733")]
    [InlineData("{N}", 1234567, "", "1234567")]
    public void Formats_patterns(string pattern, long value, string scope, string expected) =>
        Assert.Equal(expected, DocumentNumberFormat.Format(pattern, value, Date, scope));

    [Fact]
    public void Pattern_must_contain_the_number() =>
        Assert.Throws<ArgumentException>(() => DocumentNumberFormat.Format("INV-{YYYY}", 1, Date));

    [Fact]
    public void Unknown_tokens_are_rejected() =>
        Assert.Throws<ArgumentException>(() => DocumentNumberFormat.Format("{FOO}-{N}", 1, Date));
}
