using System.Text;
using IntegratedErp.Modules.Identity.Domain;

namespace IntegratedErp.UnitTests.Identity;

public sealed class TotpTests
{
    // RFC 6238 Appendix B (SHA-1 key "12345678901234567890"), 8-digit reference values.
    private static readonly byte[] RfcSecret = Encoding.ASCII.GetBytes("12345678901234567890");

    [Theory]
    [InlineData(59, "94287082")]
    [InlineData(1111111109, "07081804")]
    [InlineData(1111111111, "14050471")]
    [InlineData(1234567890, "89005924")]
    [InlineData(2000000000, "69279037")]
    [InlineData(20000000000, "65353130")]
    public void Matches_rfc_6238_test_vectors(long unixSeconds, string expected) =>
        Assert.Equal(expected, Totp.Code(RfcSecret, unixSeconds / Totp.StepSeconds, digits: 8));

    [Fact]
    public void Accepts_one_step_of_clock_drift_and_rejects_more()
    {
        var secret = Totp.NewSecret();
        var now = DateTimeOffset.UtcNow;
        var current = Totp.Code(secret, Totp.TimeStep(now));
        var previous = Totp.Code(secret, Totp.TimeStep(now) - 1);
        var old = Totp.Code(secret, Totp.TimeStep(now) - 3);

        Assert.Equal(Totp.TimeStep(now), Totp.Verify(secret, current, now));
        Assert.NotNull(Totp.Verify(secret, previous, now));
        Assert.Null(Totp.Verify(secret, old == current ? "000000" : old, now));
        Assert.Null(Totp.Verify(secret, "12345", now));
        Assert.Null(Totp.Verify(secret, "abcdef", now));
    }

    [Fact]
    public void Base32_round_trips_and_matches_rfc_4648()
    {
        Assert.Equal("MZXW6YTBOI", Base32.Encode(Encoding.ASCII.GetBytes("foobar")));
        var secret = Totp.NewSecret();
        Assert.Equal(secret, Base32.Decode(Base32.Encode(secret)));
    }

    [Fact]
    public void Provisioning_uri_is_what_authenticator_apps_expect()
    {
        var uri = Totp.ProvisioningUri(Encoding.ASCII.GetBytes("foobar"), "mahmoud");

        Assert.StartsWith("otpauth://totp/IntegratedErp%3Amahmoud?secret=MZXW6YTBOI&issuer=IntegratedErp", uri, StringComparison.Ordinal);
    }
}
