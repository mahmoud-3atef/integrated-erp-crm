using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.IntegrationTests.Identity;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure.Ldap;
using IntegratedErp.Modules.Organization.Application.Organization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IntegratedErp.IntegrationTests.Organization;

/// <summary>Company setup over HTTP: commercial registrations, branches, reference lists, with their history.</summary>
[Collection(DatabaseTestGroup.Name)]
public sealed class CompanySetupApiTests : IAsyncLifetime
{
    private const string Password = "Correct-Horse-1";

    private readonly TestDatabase _database;
    private readonly FakeDirectory _directory = new();
    private readonly string _keysPath = Path.Combine(Path.GetTempPath(), $"erp-keys-{Guid.NewGuid():N}");
    private readonly string _tenantCode = $"cs-{Guid.NewGuid():N}"[..20];
    private readonly string _admin = $"adm{Guid.NewGuid():N}"[..14];
    private WebApplicationFactory<Program>? _factory;

    public CompanySetupApiTests(TestDatabase database) => _database = database;

    public async Task InitializeAsync()
    {
        if (!TestDatabase.IsAvailable)
        {
            return;
        }

        using (var scope = _database.Scope(system: true))
        {
            await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(_tenantCode, "شركة الإعداد", "Setup Co", default);
        }

        _directory.Add(_admin, Password, "Setup Admin");
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Erp", _database.ConnectionString);
            builder.UseSetting("Platform:KeysPath", _keysPath);
            builder.UseSetting("Identity:DirectoryProvider", "fake");
            builder.UseSetting("Identity:BootstrapTenantCode", _tenantCode);
            builder.UseSetting("Identity:BootstrapAdmins:0", _admin);
            builder.UseSetting("Identity:RateLimitPerMinute", "10000");
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
    public async Task Commercial_registration_edits_are_recorded_in_its_history()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync();

        var created = await admin.PostAsJsonAsync("/api/v1/organization/legal-entities", new { code = "CP05", nameAr = "كير برو 05", nameEn = "Care-Pro 05", commercialRegistrationNo = "1010101010" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await Json(created)).GetProperty("id").GetGuid();

        var updated = await admin.PutAsJsonAsync($"/api/v1/organization/legal-entities/{id}", new { nameAr = "كير برو 05", nameEn = "Care-Pro 05", commercialRegistrationNo = "1010101010", vatNumber = "300000000000003", isActive = true });
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var invalid = await admin.PutAsJsonAsync($"/api/v1/organization/legal-entities/{id}", new { nameAr = "س", nameEn = "X", commercialRegistrationNo = "1", isActive = true });
        Assert.Equal("validation.cr_number_invalid", (await Json(invalid)).GetProperty("title").GetString());

        var history = (await Json(await admin.GetAsync($"/api/v1/organization/legal-entities/{id}/history"))).EnumerateArray().ToList();
        Assert.Equal(["Modified", "Added"], history.Select(h => h.GetProperty("action").GetString()));
        Assert.Equal("Setup Admin", history[0].GetProperty("userName").GetString());
        Assert.Equal("300000000000003", history[0].GetProperty("changes").GetProperty("VatNumber").GetProperty("new").GetString());
    }

    [SkippableFact]
    public async Task Branches_belong_to_a_known_registration_and_have_unique_codes()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync();

        var unknown = await admin.PostAsJsonAsync("/api/v1/organization/branches", new { code = "RUH", nameAr = "فرع الرياض", nameEn = "Riyadh", legalEntityId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);

        var created = await admin.PostAsJsonAsync("/api/v1/organization/branches", new { code = "ruh", nameAr = "فرع الرياض", nameEn = "Riyadh", city = "الرياض" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("RUH", (await Json(created)).GetProperty("code").GetString());

        var duplicate = await admin.PostAsJsonAsync("/api/v1/organization/branches", new { code = "RUH", nameAr = "مكرر", nameEn = "Duplicate" });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    [SkippableFact]
    public async Task Reference_lists_come_with_their_system_codes_and_accept_company_items()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync();

        var lists = (await Json(await admin.GetAsync("/api/v1/organization/reference-lists"))).EnumerateArray().ToList();
        Assert.Contains(lists, l => l.GetProperty("code").GetString() == "nationalities");
        Assert.Equal(6, lists.Single(l => l.GetProperty("code").GetString() == "return_reasons").GetProperty("itemCount").GetInt32());

        var reasons = (await Json(await admin.GetAsync("/api/v1/organization/reference-lists/return_reasons/items"))).EnumerateArray().ToList();
        var sick = reasons.Single(r => r.GetProperty("code").GetString() == "SICK");
        Assert.True(sick.GetProperty("isSystem").GetBoolean());
        var switchOff = await admin.PutAsJsonAsync(
            $"/api/v1/organization/reference-lists/return_reasons/items/{sick.GetProperty("id").GetGuid()}",
            new { nameAr = "مرض العامل", nameEn = "Worker is sick", sortOrder = 3, isActive = false });
        Assert.Equal("validation.reference_item_system", (await Json(switchOff)).GetProperty("title").GetString());

        var added = await admin.PostAsJsonAsync("/api/v1/organization/reference-lists/nationalities/items", new { code = "phl", nameAr = "الفلبين", nameEn = "Philippines", sortOrder = 1 });
        Assert.Equal(HttpStatusCode.Created, added.StatusCode);
        var duplicate = await admin.PostAsJsonAsync("/api/v1/organization/reference-lists/nationalities/items", new { code = "PHL", nameAr = "مكرر", nameEn = "Duplicate", sortOrder = 2 });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync("/api/v1/organization/reference-lists/no_such_list/items")).StatusCode);
    }

    [SkippableFact]
    public async Task Company_setup_needs_a_session_and_permissions()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var anonymous = _factory!.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/v1/organization/branches")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/v1/system/modules")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await (await SignInAsync()).GetAsync("/api/v1/organization/modules")).StatusCode);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    /// <summary>First sign-in of the bootstrap admin: password, then MFA enrollment, then the only company.</summary>
    private async Task<HttpClient> SignInAsync()
    {
        var client = _factory!.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), HandleCookies = true });
        client.DefaultRequestHeaders.Add(PlatformAuthentication.CsrfHeader, "1");
        var step = await Json(await client.PostAsJsonAsync("/api/v1/auth/login", new { userName = _admin, password = Password }));
        var secret = step.GetProperty("mfaSetupSecret").GetString()!;
        var done = await Json(await client.PostAsJsonAsync("/api/v1/auth/mfa/setup", new { code = Totp.Code(Base32.Decode(secret), Totp.TimeStep(DateTimeOffset.UtcNow)) }));
        Assert.Equal("done", done.GetProperty("next").GetString());
        return client;
    }
}
