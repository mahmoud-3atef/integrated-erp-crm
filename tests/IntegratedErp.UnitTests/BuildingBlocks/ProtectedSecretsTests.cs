using System.Security.Cryptography;
using IntegratedErp.BuildingBlocks.Configuration;
using Microsoft.Extensions.Configuration;

namespace IntegratedErp.UnitTests.BuildingBlocks;

public sealed class ProtectedSecretsTests
{
    [SkippableFact]
    public void Secrets_round_trip_and_are_not_stored_in_plain_text()
    {
        Skip.IfNot(OperatingSystem.IsWindows(), "DPAPI is Windows-only.");
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        var path = Path.Combine(Path.GetTempPath(), $"erp-secrets-{Guid.NewGuid():N}.dat");
        try
        {
            ProtectedSecretsConfiguration.Write(path, new Dictionary<string, string?> { ["Identity:Ldap:BindPassword"] = "p@ss-شيء" }, DataProtectionScope.CurrentUser);

            Assert.DoesNotContain("p@ss", File.ReadAllText(path), StringComparison.Ordinal);

            var configuration = new ConfigurationBuilder().AddProtectedSecretsFile(path).Build();
            Assert.Equal("p@ss-شيء", configuration["Identity:Ldap:BindPassword"]);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void Missing_file_adds_nothing()
    {
        var configuration = new ConfigurationBuilder().AddProtectedSecretsFile(Path.Combine(Path.GetTempPath(), "does-not-exist.dat")).Build();

        Assert.Null(configuration["Identity:Ldap:BindPassword"]);
    }
}
