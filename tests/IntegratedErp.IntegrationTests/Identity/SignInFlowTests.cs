using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Configuration;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure.Ldap;
using IntegratedErp.Modules.Organization.Application.Organization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IntegratedErp.IntegrationTests.Identity;

/// <summary>A directory with fixed users, so the whole HTTP sign-in flow runs without the real AD.</summary>
internal sealed class FakeDirectory : IDirectory
{
    private readonly Dictionary<string, (DirectoryUser User, string Password)> _users = new(StringComparer.OrdinalIgnoreCase);

    public void Add(string sam, string password, string displayName) =>
        _users[sam] = (new DirectoryUser(Guid.NewGuid(), sam, $"CN={displayName},DC=TEST", displayName, $"{sam}@test.local", true, false, []), password);

    public Task<DirectoryUser?> FindUserAsync(string userName, CancellationToken cancellationToken) =>
        Task.FromResult(_users.TryGetValue(LdapDirectory.NormalizeUserName(userName), out var u) ? u.User : null);

    public Task<(DirectoryAuthResult Result, DirectoryUser? User)> AuthenticateAsync(string userName, string password, CancellationToken cancellationToken)
    {
        if (!_users.TryGetValue(LdapDirectory.NormalizeUserName(userName), out var entry))
        {
            return Task.FromResult<(DirectoryAuthResult, DirectoryUser?)>((DirectoryAuthResult.UserNotFound, null));
        }

        return Task.FromResult<(DirectoryAuthResult, DirectoryUser?)>(
            entry.Password == password ? (DirectoryAuthResult.Success, entry.User) : (DirectoryAuthResult.InvalidCredentials, entry.User));
    }
}

[Collection(DatabaseTestGroup.Name)]
public sealed class SignInFlowTests : IAsyncLifetime
{
    private readonly TestDatabase _database;
    private readonly FakeDirectory _directory = new();
    private readonly string _keysPath = Path.Combine(Path.GetTempPath(), $"erp-keys-{Guid.NewGuid():N}");
    private readonly string _tenantCode = $"co-{Guid.NewGuid():N}"[..20];
    private readonly string _admin = $"admin{Guid.NewGuid():N}"[..14];
    private WebApplicationFactory<Program>? _factory;

    public SignInFlowTests(TestDatabase database) => _database = database;

    public Guid CompanyId { get; private set; }

    public async Task InitializeAsync()
    {
        if (!TestDatabase.IsAvailable)
        {
            return;
        }

        using (var scope = _database.Scope(system: true))
        {
            CompanyId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>()
                .CreateTenantAsync(_tenantCode, "شركة الاختبار", "Test Co", default)).Value.Id;
        }

        _directory.Add(_admin, "Correct-Horse-1", "Admin User");
        _directory.Add("outsider", "Outsider-Pass-1", "Outsider");

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Erp", _database.ConnectionString);
            builder.UseSetting("Platform:KeysPath", _keysPath);
            builder.UseSetting("Identity:DirectoryProvider", "fake");
            builder.UseSetting("Identity:BootstrapTenantCode", _tenantCode);
            builder.UseSetting("Identity:BootstrapAdmins:0", _admin);
            builder.UseSetting("Identity:RateLimitPerMinute", "10000");
            builder.UseSetting("Modules:Organization:DevEndpoints", "true");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IDirectory>();
                services.AddSingleton<IDirectory>(_directory);
            });
        });
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }

        if (Directory.Exists(_keysPath))
        {
            Directory.Delete(_keysPath, recursive: true);
        }
    }

    private HttpClient Client()
    {
        var client = _factory!.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), HandleCookies = true });
        client.DefaultRequestHeaders.Add(PlatformAuthentication.CsrfHeader, "1");
        return client;
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static string CurrentCode(string base32Secret) =>
        Totp.Code(Base32.Decode(base32Secret), Totp.TimeStep(DateTimeOffset.UtcNow));

    /// <summary>Full first sign-in: password ⇒ MFA enrollment ⇒ the single company is entered automatically.</summary>
    private async Task<(HttpClient Client, string Secret, IReadOnlyList<string> RecoveryCodes)> FirstSignInAsync()
    {
        var client = Client();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { userName = $@"TEST\{_admin}", password = "Correct-Horse-1" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var step = await Json(login);
        Assert.Equal("mfa_setup", step.GetProperty("next").GetString());
        var secret = step.GetProperty("mfaSetupSecret").GetString()!;

        var setup = await client.PostAsJsonAsync("/api/v1/auth/mfa/setup", new { code = CurrentCode(secret) });
        Assert.Equal(HttpStatusCode.OK, setup.StatusCode);
        var done = await Json(setup);
        Assert.Equal("done", done.GetProperty("next").GetString());
        var codes = done.GetProperty("recoveryCodes").EnumerateArray().Select(c => c.GetString()!).ToList();

        return (client, secret, codes);
    }

    [SkippableFact]
    public async Task First_sign_in_enrolls_mfa_and_opens_the_company_session()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");

        var (client, _, codes) = await FirstSignInAsync();

        Assert.Equal(8, codes.Count);
        var me = await Json(await client.GetAsync("/api/v1/auth/me"));
        Assert.Equal(CompanyId, me.GetProperty("company").GetProperty("id").GetGuid());
        Assert.True(me.GetProperty("isPlatformAdmin").GetBoolean());

        // The session gives access to company data (row-level security sees this company only).
        var entities = await client.GetAsync("/api/v1/organization/legal-entities");
        Assert.Equal(HttpStatusCode.OK, entities.StatusCode);
    }

    [SkippableFact]
    public async Task With_mfa_switched_off_the_password_opens_the_company_session()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");

        using var factory = _factory!.WithWebHostBuilder(builder => builder.UseSetting("Identity:MfaRequired", "false"));
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), HandleCookies = true });
        client.DefaultRequestHeaders.Add(PlatformAuthentication.CsrfHeader, "1");

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { userName = $@"TEST\{_admin}", password = "Correct-Horse-1" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal("done", (await Json(login)).GetProperty("next").GetString());
        var me = await Json(await client.GetAsync("/api/v1/auth/me"));
        Assert.Equal(CompanyId, me.GetProperty("company").GetProperty("id").GetGuid());

        // A wrong password is still refused.
        var wrong = await factory.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new { userName = $@"TEST\{_admin}", password = "wrong" });
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
    }

    [SkippableFact]
    public async Task Without_a_session_company_endpoints_are_closed()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");

        var anonymous = Client();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/v1/organization/legal-entities")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/v1/auth/me")).StatusCode);
    }

    [SkippableFact]
    public async Task Password_alone_is_not_enough_and_mfa_codes_cannot_be_replayed()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var (_, secret, recoveryCodes) = await FirstSignInAsync();

        var client = Client();
        var login = await Json(await client.PostAsJsonAsync("/api/v1/auth/login", new { userName = _admin, password = "Correct-Horse-1" }));
        Assert.Equal("mfa", login.GetProperty("next").GetString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/auth/me")).StatusCode);

        // The code used during enrollment (same 30 s step) is refused; a recovery code works once.
        var replay = await client.PostAsJsonAsync("/api/v1/auth/mfa/verify", new { code = CurrentCode(secret) });
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
        var recovery = await client.PostAsJsonAsync("/api/v1/auth/mfa/verify", new { recoveryCode = recoveryCodes[0] });
        Assert.Equal(HttpStatusCode.OK, recovery.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/auth/me")).StatusCode);
    }

    [SkippableFact]
    public async Task Repeated_wrong_passwords_are_throttled_before_reaching_the_directory()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var client = Client();

        for (var i = 0; i < 5; i++)
        {
            var wrong = await client.PostAsJsonAsync("/api/v1/auth/login", new { userName = "outsider", password = "nope" });
            Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        }

        var throttled = await client.PostAsJsonAsync("/api/v1/auth/login", new { userName = "outsider", password = "Outsider-Pass-1" });
        Assert.Equal(HttpStatusCode.TooManyRequests, throttled.StatusCode);
    }

    [SkippableFact]
    public async Task Unknown_user_and_wrong_password_get_the_same_answer()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var client = Client();

        var unknown = await client.PostAsJsonAsync("/api/v1/auth/login", new { userName = "nobody-here", password = "x" });
        var wrong = await client.PostAsJsonAsync("/api/v1/auth/login", new { userName = _admin, password = "wrong" });

        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal((await Json(unknown)).GetProperty("title").GetString(), (await Json(wrong)).GetProperty("title").GetString());
    }

    [SkippableFact]
    public async Task A_user_cannot_enter_a_company_they_are_not_a_member_of()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var (client, _, _) = await FirstSignInAsync();

        var foreign = await client.PostAsJsonAsync("/api/v1/auth/select-company", new { companyId = Guid.NewGuid() });

        Assert.Equal(HttpStatusCode.Forbidden, foreign.StatusCode);
    }

    [SkippableFact]
    public async Task State_changes_with_a_session_cookie_require_the_csrf_header()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var (client, _, _) = await FirstSignInAsync();
        client.DefaultRequestHeaders.Remove(PlatformAuthentication.CsrfHeader);

        var response = await client.PostAsJsonAsync("/api/v1/organization/legal-entities", new { code = "X", nameAr = "س", nameEn = "X", commercialRegistrationNo = "1234567890" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [SkippableFact]
    public async Task Real_active_directory_password_step_works_over_http()
    {
        var bindUser = new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddProtectedSecretsFile().Build()["Identity:Ldap:BindUser"];
        Skip.IfNot(TestDatabase.IsAvailable && Environment.GetEnvironmentVariable("ERP_LDAP_TEST") == "1" && bindUser is not null,
            "Set ERP_LDAP_TEST=1 and store the bind account to run against AD.");

        // The real LdapDirectory (no fake); bind account credentials come from the DPAPI secrets file.
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Erp", _database.ConnectionString);
            builder.UseSetting("Platform:KeysPath", _keysPath);
            builder.UseSetting("Identity:DirectoryProvider", "ad-jrco");
            builder.UseSetting("Identity:Ldap:Server", "AD.JRCO.LOCAL");
            builder.UseSetting("Identity:Ldap:BaseDn", "DC=JRCO,DC=LOCAL");
        });
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        var password = new Microsoft.Extensions.Configuration.ConfigurationBuilder().AddProtectedSecretsFile().Build()["Identity:Ldap:BindPassword"];

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { userName = bindUser, password });

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var next = (await Json(login)).GetProperty("next").GetString();
        Assert.True(next is "mfa_setup" or "mfa", $"Unexpected next step '{next}'.");
    }

    [SkippableFact]
    public async Task Logout_ends_the_session()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var (client, _, _) = await FirstSignInAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/v1/auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/auth/me")).StatusCode);
    }
}
