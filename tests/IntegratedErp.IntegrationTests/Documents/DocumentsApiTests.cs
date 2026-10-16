using System.Net;
using System.Net.Http.Headers;
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

namespace IntegratedErp.IntegrationTests.Documents;

/// <summary>Attachments and notifications over HTTP, with a real folder for files and a pickup folder for emails.</summary>
[Collection(DatabaseTestGroup.Name)]
public sealed class DocumentsApiTests : IAsyncLifetime
{
    private const string Password = "Correct-Horse-1";
    private static readonly byte[] PdfBytes = "%PDF-1.7\n1 0 obj << >> endobj\n%%EOF"u8.ToArray();

    private readonly TestDatabase _database;
    private readonly FakeDirectory _directory = new();
    private readonly string _work = Path.Combine(Path.GetTempPath(), $"erp-docs-{Guid.NewGuid():N}");
    private readonly string _tenantCode = $"dc-{Guid.NewGuid():N}"[..20];
    private readonly string _admin = $"adm{Guid.NewGuid():N}"[..14];
    private readonly string _clerk = $"clk{Guid.NewGuid():N}"[..14];
    private WebApplicationFactory<Program>? _factory;

    public DocumentsApiTests(TestDatabase database) => _database = database;

    private string MailFolder => Path.Combine(_work, "mail");

    public async Task InitializeAsync()
    {
        if (!TestDatabase.IsAvailable)
        {
            return;
        }

        using (var scope = _database.Scope(system: true))
        {
            await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(_tenantCode, "شركة المستندات", "Documents Co", default);
        }

        _directory.Add(_admin, Password, "Docs Admin");
        _directory.Add(_clerk, Password, "Docs Clerk");
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Erp", _database.ConnectionString);
            builder.UseSetting("Platform:KeysPath", Path.Combine(_work, "keys"));
            builder.UseSetting("Storage:Root", Path.Combine(_work, "files"));
            builder.UseSetting("Email:FromAddress", "erp@test.local");
            builder.UseSetting("Email:PickupDirectory", MailFolder);
            builder.UseSetting("Documents:EmailPollSeconds", "1");
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

        if (Directory.Exists(_work))
        {
            Directory.Delete(_work, recursive: true);
        }
    }

    [SkippableFact]
    public async Task A_file_attached_to_a_registration_downloads_byte_for_byte()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync(_admin);
        var entity = await CreateLegalEntityAsync(admin);

        var uploaded = await UploadAsync(admin, entity, "COMMERCIAL_REGISTRATION", "سجل تجاري.pdf", PdfBytes, expiresOn: "2027-03-30");
        Assert.Equal(HttpStatusCode.Created, uploaded.StatusCode);
        var id = (await Json(uploaded)).GetProperty("id").GetGuid();

        var list = (await Json(await admin.GetAsync($"/api/v1/documents/attachments?ownerType=organization.legal_entity&ownerId={entity}"))).EnumerateArray().ToList();
        var item = Assert.Single(list);
        Assert.Equal("سجل تجاري.pdf", item.GetProperty("fileName").GetString());
        Assert.Equal("2027-03-30", item.GetProperty("expiresOn").GetString());

        var download = await admin.GetAsync($"/api/v1/documents/attachments/{id}/content");
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("application/pdf", download.Content.Headers.ContentType?.MediaType);
        Assert.Equal("attachment", download.Content.Headers.ContentDisposition?.DispositionType);
        Assert.Equal(PdfBytes, await download.Content.ReadAsByteArrayAsync());

        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/v1/documents/attachments/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/v1/documents/attachments/{id}/content")).StatusCode);
    }

    [SkippableFact]
    public async Task Disguised_or_misplaced_files_are_refused()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync(_admin);
        var entity = await CreateLegalEntityAsync(admin);

        var renamedProgram = await UploadAsync(admin, entity, "OTHER", "invoice.pdf", "MZ-not-a-pdf"u8.ToArray());
        Assert.Equal("validation.file_type_not_allowed", (await Json(renamedProgram)).GetProperty("title").GetString());

        var unknownType = await UploadAsync(admin, entity, "NO_SUCH_TYPE", "cr.pdf", PdfBytes);
        Assert.Equal("validation.document_type_unknown", (await Json(unknownType)).GetProperty("title").GetString());

        var unknownRecord = await UploadAsync(admin, Guid.NewGuid(), "OTHER", "cr.pdf", PdfBytes);
        Assert.Equal(HttpStatusCode.NotFound, unknownRecord.StatusCode);
    }

    [SkippableFact]
    public async Task Files_follow_the_permissions_of_their_record()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync(_admin);
        var entity = await CreateLegalEntityAsync(admin);
        var id = (await Json(await UploadAsync(admin, entity, "OTHER", "cr.pdf", PdfBytes))).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/v1/access/members", new { userName = _clerk })).StatusCode);

        var clerk = await SignInAsync(_clerk);

        Assert.Equal(HttpStatusCode.Forbidden, (await clerk.GetAsync($"/api/v1/documents/attachments/{id}/content")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await clerk.GetAsync($"/api/v1/documents/attachments?ownerType=organization.legal_entity&ownerId={entity}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await UploadAsync(clerk, entity, "OTHER", "cr.pdf", PdfBytes)).StatusCode);
    }

    [SkippableFact]
    public async Task Adding_a_member_notifies_them_in_the_system_and_by_email()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync(_admin);
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/v1/access/members", new { userName = _clerk })).StatusCode);

        var clerk = await SignInAsync(_clerk);
        var page = await Json(await clerk.GetAsync("/api/v1/documents/notifications"));
        Assert.Equal(1, page.GetProperty("unreadCount").GetInt32());
        var notification = page.GetProperty("items")[0];
        Assert.Equal("identity.member_added", notification.GetProperty("kind").GetString());
        Assert.Contains("شركة المستندات", notification.GetProperty("bodyAr").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await clerk.PostAsync($"/api/v1/documents/notifications/{notification.GetProperty("id").GetGuid()}/read", null)).StatusCode);
        Assert.Equal(0, (await Json(await clerk.GetAsync("/api/v1/documents/notifications"))).GetProperty("unreadCount").GetInt32());

        // Nobody else can see it.
        Assert.Equal(0, (await Json(await admin.GetAsync("/api/v1/documents/notifications"))).GetProperty("items").GetArrayLength());

        // The background dispatcher writes the email to the pickup folder. The queue is shared by all companies,
        // so the folder may also receive mail queued by earlier tests: look for this recipient's complete message.
        var deadline = DateTime.UtcNow.AddSeconds(15);
        string? mail = null;
        while (DateTime.UtcNow < deadline && mail is null)
        {
            await Task.Delay(250);
            mail = await FindMailAsync($"To: {_clerk}@test.local");
        }

        Assert.NotNull(mail);
        Assert.Contains("multipart/alternative", mail);
    }

    private async Task<string?> FindMailAsync(string header)
    {
        foreach (var file in Directory.Exists(MailFolder) ? Directory.GetFiles(MailFolder, "*.eml") : [])
        {
            try
            {
                var text = await File.ReadAllTextAsync(file);
                if (text.Contains(header, StringComparison.Ordinal) && text.TrimEnd().EndsWith("--", StringComparison.Ordinal))
                {
                    return text;
                }
            }
            catch (IOException)
            {
                // Still being written; try again on the next round.
            }
        }

        return null;
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static async Task<Guid> CreateLegalEntityAsync(HttpClient admin)
    {
        var created = await admin.PostAsJsonAsync("/api/v1/organization/legal-entities", new { code = $"E{Guid.NewGuid():N}"[..8], nameAr = "سجل", nameEn = "Entity", commercialRegistrationNo = "1010101010" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        return (await Json(created)).GetProperty("id").GetGuid();
    }

    private static Task<HttpResponseMessage> UploadAsync(HttpClient client, Guid owner, string documentType, string fileName, byte[] bytes, string? expiresOn = null)
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent("organization.legal_entity"), "ownerType" },
            { new StringContent(owner.ToString()), "ownerId" },
            { new StringContent(documentType), "documentType" },
        };
        if (expiresOn is not null)
        {
            form.Add(new StringContent(expiresOn), "expiresOn");
        }

        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", fileName);
        return client.PostAsync("/api/v1/documents/attachments", form);
    }

    /// <summary>First sign-in: password, MFA enrollment, then the only company.</summary>
    private async Task<HttpClient> SignInAsync(string userName)
    {
        var client = _factory!.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), HandleCookies = true });
        client.DefaultRequestHeaders.Add(PlatformAuthentication.CsrfHeader, "1");
        var step = await Json(await client.PostAsJsonAsync("/api/v1/auth/login", new { userName, password = Password }));
        var secret = step.GetProperty("mfaSetupSecret").GetString()!;
        await client.PostAsJsonAsync("/api/v1/auth/mfa/setup", new { code = Totp.Code(Base32.Decode(secret), Totp.TimeStep(DateTimeOffset.UtcNow)) });
        return client;
    }
}
