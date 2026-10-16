using IntegratedErp.BuildingBlocks.Configuration;
using IntegratedErp.Modules.Identity.Infrastructure.Ldap;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Identity;

/// <summary>
/// Against the real company AD. Runs only when ERP_LDAP_TEST=1 and the bind account is in the
/// DPAPI secrets file (tools/Set-ErpSecret.ps1). Never tries a wrong password, so the service
/// account cannot be locked out by repeated test runs.
/// </summary>
public sealed class ActiveDirectoryTests
{
    private static readonly IConfiguration Configuration = new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Identity:Ldap:Server"] = Environment.GetEnvironmentVariable("ERP_LDAP_SERVER") ?? "AD.JRCO.LOCAL",
            ["Identity:Ldap:BaseDn"] = Environment.GetEnvironmentVariable("ERP_LDAP_BASEDN") ?? "DC=JRCO,DC=LOCAL",
        })
        .AddProtectedSecretsFile()
        .Build();

    private static bool Enabled =>
        Environment.GetEnvironmentVariable("ERP_LDAP_TEST") == "1"
        && !string.IsNullOrEmpty(Configuration["Identity:Ldap:BindUser"])
        && !string.IsNullOrEmpty(Configuration["Identity:Ldap:BindPassword"]);

    private static LdapDirectory CreateDirectory()
    {
        var options = new LdapOptions();
        Configuration.GetSection(LdapOptions.Section).Bind(options);
        return new LdapDirectory(Options.Create(options));
    }

    [SkippableFact]
    public async Task Service_account_can_find_itself()
    {
        Skip.IfNot(Enabled, "Set ERP_LDAP_TEST=1 and store the bind account to run against AD.");

        var user = await CreateDirectory().FindUserAsync(Configuration["Identity:Ldap:BindUser"]!, default);

        Assert.NotNull(user);
        Assert.NotEqual(Guid.Empty, user.ObjectGuid);
        Assert.True(user.IsEnabled);
    }

    [SkippableFact]
    public async Task Correct_password_authenticates_over_ldaps()
    {
        Skip.IfNot(Enabled, "Set ERP_LDAP_TEST=1 and store the bind account to run against AD.");

        var (result, user) = await CreateDirectory().AuthenticateAsync(Configuration["Identity:Ldap:BindUser"]!, Configuration["Identity:Ldap:BindPassword"]!, default);

        Assert.Equal(DirectoryAuthResult.Success, result);
        Assert.False(string.IsNullOrEmpty(user!.DisplayName));
    }

    [SkippableFact]
    public async Task Unknown_user_and_empty_password_are_refused_without_a_bind()
    {
        Skip.IfNot(Enabled, "Set ERP_LDAP_TEST=1 and store the bind account to run against AD.");
        var directory = CreateDirectory();

        var (unknown, _) = await directory.AuthenticateAsync($"no-such-user-{Guid.NewGuid():N}"[..20], "x", default);
        var (empty, _) = await directory.AuthenticateAsync(Configuration["Identity:Ldap:BindUser"]!, string.Empty, default);

        Assert.Equal(DirectoryAuthResult.UserNotFound, unknown);
        Assert.Equal(DirectoryAuthResult.InvalidCredentials, empty);
    }
}
