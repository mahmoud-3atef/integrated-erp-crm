using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure.Ldap;
using IntegratedErp.Modules.Organization.Application.Organization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IntegratedErp.IntegrationTests.Identity;

/// <summary>Roles and permissions over HTTP: what each user can call is decided on the server, per request.</summary>
[Collection(DatabaseTestGroup.Name)]
public sealed class AccessControlTests : IAsyncLifetime
{
    private const string Password = "Correct-Horse-1";
    private static readonly string[] ManageLegalEntities = ["organization.legal_entities.manage"];

    private readonly TestDatabase _database;
    private readonly FakeDirectory _directory = new();
    private readonly string _keysPath = Path.Combine(Path.GetTempPath(), $"erp-keys-{Guid.NewGuid():N}");
    private readonly string _tenantCode = $"ac-{Guid.NewGuid():N}"[..20];
    private readonly string _admin = $"adm{Guid.NewGuid():N}"[..14];
    private readonly string _clerk = $"clk{Guid.NewGuid():N}"[..14];
    private WebApplicationFactory<Program>? _factory;

    public AccessControlTests(TestDatabase database) => _database = database;

    public async Task InitializeAsync()
    {
        if (!TestDatabase.IsAvailable)
        {
            return;
        }

        using (var scope = _database.Scope(system: true))
        {
            await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(_tenantCode, "شركة الصلاحيات", "Access Co", default);
        }

        _directory.Add(_admin, Password, "Admin");
        _directory.Add(_clerk, Password, "Clerk");

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

    [SkippableFact]
    public async Task Bootstrap_admin_is_company_administrator()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync(_admin);

        var permissions = await PermissionsAsync(admin);

        Assert.Contains("identity.roles.manage", permissions);
        Assert.Contains("organization.legal_entities.manage", permissions);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/v1/access/members")).StatusCode);
    }

    [SkippableFact]
    public async Task A_member_without_a_role_sees_nothing()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync(_admin);
        await AddMemberAsync(admin, _clerk);

        var clerk = await SignInAsync(_clerk);

        Assert.Empty(await PermissionsAsync(clerk));
        Assert.Equal(HttpStatusCode.Forbidden, (await clerk.GetAsync("/api/v1/organization/legal-entities")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await clerk.GetAsync("/api/v1/access/members")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await clerk.PostAsJsonAsync("/api/v1/access/roles", new { code = "x", nameAr = "س", nameEn = "X", permissions = Array.Empty<string>() })).StatusCode);
    }

    [SkippableFact]
    public async Task A_role_change_applies_on_the_next_call()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync(_admin);
        var membershipId = await AddMemberAsync(admin, _clerk);
        var clerk = await SignInAsync(_clerk);
        Assert.Equal(HttpStatusCode.Forbidden, (await clerk.GetAsync("/api/v1/organization/legal-entities")).StatusCode);

        var roleId = await CreateRoleAsync(admin, "le-viewer", "organization.legal_entities.view");
        await SetRolesAsync(admin, membershipId, HttpStatusCode.NoContent, new { roleId, legalEntityId = (Guid?)null });

        // Same session, no new sign-in.
        Assert.Equal(HttpStatusCode.OK, (await clerk.GetAsync("/api/v1/organization/legal-entities")).StatusCode);

        await SetRolesAsync(admin, membershipId, HttpStatusCode.NoContent);
        Assert.Equal(HttpStatusCode.Forbidden, (await clerk.GetAsync("/api/v1/organization/legal-entities")).StatusCode);

        var deactivate = await admin.PutAsJsonAsync($"/api/v1/access/members/{membershipId}/active", new { isActive = false });
        Assert.Equal(HttpStatusCode.NoContent, deactivate.StatusCode);
        Assert.Empty(await PermissionsAsync(clerk));
    }

    [SkippableFact]
    public async Task A_role_can_be_limited_to_one_commercial_registration()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync(_admin);
        var created = await admin.PostAsJsonAsync("/api/v1/organization/legal-entities", new { code = "CP05", nameAr = "كير برو 05", nameEn = "Care-Pro 05", commercialRegistrationNo = "1010101010" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var cp05 = (await Json(created)).GetProperty("id").GetGuid();

        var membershipId = await AddMemberAsync(admin, _clerk);
        var roleId = await CreateRoleAsync(admin, "le-viewer", "organization.legal_entities.view");
        await SetRolesAsync(admin, membershipId, HttpStatusCode.NoContent, new { roleId, legalEntityId = (Guid?)cp05 });
        await SetRolesAsync(admin, membershipId, HttpStatusCode.BadRequest, new { roleId, legalEntityId = (Guid?)Guid.NewGuid() });

        // Administering access is company-wide: a grant for one registration does not open it.
        var usersViewer = await CreateRoleAsync(admin, "users-viewer", "identity.users.view");
        await SetRolesAsync(admin, membershipId, HttpStatusCode.NoContent, new { roleId, legalEntityId = (Guid?)cp05 }, new { roleId = usersViewer, legalEntityId = (Guid?)cp05 });
        var clerk = await SignInAsync(_clerk);
        Assert.Equal(HttpStatusCode.OK, (await clerk.GetAsync("/api/v1/organization/legal-entities")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await clerk.GetAsync("/api/v1/access/members")).StatusCode);

        var members = (await Json(await admin.GetAsync("/api/v1/access/members"))).EnumerateArray()
            .Single(m => m.GetProperty("membershipId").GetGuid() == membershipId);
        Assert.Equal(cp05, members.GetProperty("roles")[0].GetProperty("legalEntityId").GetGuid());
    }

    [SkippableFact]
    public async Task The_last_administrator_cannot_be_removed_or_deactivate_themselves()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync(_admin);
        var self = (await Json(await admin.GetAsync("/api/v1/access/members"))).EnumerateArray().Single().GetProperty("membershipId").GetGuid();

        var removeOwn = await admin.PutAsJsonAsync($"/api/v1/access/members/{self}/roles", new { roles = Array.Empty<object>() });
        Assert.Equal("validation.last_administrator", (await Json(removeOwn)).GetProperty("title").GetString());

        var deactivate = await admin.PutAsJsonAsync($"/api/v1/access/members/{self}/active", new { isActive = false });
        Assert.Equal("validation.not_yourself", (await Json(deactivate)).GetProperty("title").GetString());

        Assert.Contains("identity.roles.manage", await PermissionsAsync(admin));
    }

    [SkippableFact]
    public async Task Nobody_grants_permissions_they_do_not_hold()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync(_admin);
        var membershipId = await AddMemberAsync(admin, _clerk);
        var userAdmin = await CreateRoleAsync(admin, "user-admin", "identity.users.view", "identity.users.manage", "identity.roles.view", "identity.roles.manage");
        await SetRolesAsync(admin, membershipId, HttpStatusCode.NoContent, new { roleId = userAdmin, legalEntityId = (Guid?)null });
        var clerk = await SignInAsync(_clerk);

        var bigger = await clerk.PostAsJsonAsync("/api/v1/access/roles", new { code = "bigger", nameAr = "أكبر", nameEn = "Bigger", permissions = ManageLegalEntities });
        Assert.Equal("validation.beyond_own_permissions", (await Json(bigger)).GetProperty("title").GetString());

        var roles = (await Json(await clerk.GetAsync("/api/v1/access/roles"))).EnumerateArray().ToList();
        var administrator = roles.Single(r => r.GetProperty("kind").GetString() == nameof(RoleKind.Administrator)).GetProperty("id").GetGuid();
        var selfPromote = await clerk.PutAsJsonAsync(
            $"/api/v1/access/members/{membershipId}/roles",
            new { roles = new object[] { new { roleId = userAdmin, legalEntityId = (Guid?)null }, new { roleId = administrator, legalEntityId = (Guid?)null } } });
        Assert.Equal("validation.beyond_own_permissions", (await Json(selfPromote)).GetProperty("title").GetString());
    }

    private HttpClient Client()
    {
        var client = _factory!.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), HandleCookies = true });
        client.DefaultRequestHeaders.Add(PlatformAuthentication.CsrfHeader, "1");
        return client;
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    /// <summary>Password ⇒ MFA (enrolled on first sign-in) ⇒ the single company.</summary>
    private async Task<HttpClient> SignInAsync(string userName)
    {
        var client = Client();
        var step = await Json(await client.PostAsJsonAsync("/api/v1/auth/login", new { userName, password = Password }));
        var secret = step.GetProperty("mfaSetupSecret").GetString()!;
        var done = await Json(await client.PostAsJsonAsync("/api/v1/auth/mfa/setup", new { code = Totp.Code(Base32.Decode(secret), Totp.TimeStep(DateTimeOffset.UtcNow)) }));
        Assert.Equal("done", done.GetProperty("next").GetString());
        return client;
    }

    private static async Task<List<string>> PermissionsAsync(HttpClient client) =>
        (await Json(await client.GetAsync("/api/v1/auth/me"))).GetProperty("permissions").EnumerateArray().Select(p => p.GetString()!).ToList();

    private static async Task<Guid> AddMemberAsync(HttpClient admin, string userName)
    {
        var response = await admin.PostAsJsonAsync("/api/v1/access/members", new { userName });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await Json(response)).GetProperty("membershipId").GetGuid();
    }

    private static async Task<Guid> CreateRoleAsync(HttpClient admin, string code, params string[] permissions)
    {
        var response = await admin.PostAsJsonAsync("/api/v1/access/roles", new { code, nameAr = "دور " + code, nameEn = "Role " + code, permissions });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await Json(response)).GetProperty("id").GetGuid();
    }

    private static async Task SetRolesAsync(HttpClient admin, Guid membershipId, HttpStatusCode expected, params object[] roles)
    {
        var response = await admin.PutAsJsonAsync($"/api/v1/access/members/{membershipId}/roles", new { roles });
        Assert.Equal(expected, response.StatusCode);
    }
}
