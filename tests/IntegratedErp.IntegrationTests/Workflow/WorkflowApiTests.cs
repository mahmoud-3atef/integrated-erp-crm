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

namespace IntegratedErp.IntegrationTests.Workflow;

/// <summary>
/// A document running on a route defined over the API (the slice 0.8 acceptance): an employee submits an internal
/// request, a reviewer (by role) and the administrator (by name) approve it, and each sees only their own tasks.
/// </summary>
[Collection(DatabaseTestGroup.Name)]
public sealed class WorkflowApiTests : IAsyncLifetime
{
    private const string Password = "Correct-Horse-1";

    private readonly TestDatabase _database;
    private readonly FakeDirectory _directory = new();
    private readonly string _keys = Path.Combine(Path.GetTempPath(), $"erp-keys-{Guid.NewGuid():N}");
    private readonly string _tenantCode = $"wf-{Guid.NewGuid():N}"[..20];
    private readonly string _admin = $"adm{Guid.NewGuid():N}"[..14];
    private readonly string _employee = $"emp{Guid.NewGuid():N}"[..14];
    private readonly string _reviewer = $"rev{Guid.NewGuid():N}"[..14];
    private WebApplicationFactory<Program>? _factory;

    public WorkflowApiTests(TestDatabase database) => _database = database;

    public async Task InitializeAsync()
    {
        if (!TestDatabase.IsAvailable)
        {
            return;
        }

        using (var scope = _database.Scope(system: true))
        {
            await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(_tenantCode, "شركة الاعتمادات", "Approvals Co", default);
        }

        foreach (var name in new[] { _admin, _employee, _reviewer })
        {
            _directory.Add(name, Password, name);
        }

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Erp", _database.ConnectionString);
            builder.UseSetting("Platform:KeysPath", _keys);
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

        if (Directory.Exists(_keys))
        {
            Directory.Delete(_keys, recursive: true);
        }
    }

    [SkippableFact]
    public async Task A_request_runs_through_a_route_defined_from_the_api()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var (admin, adminId, employee, reviewer) = await SetUpAsync();

        var created = await employee.PostAsJsonAsync("/api/v1/workflow/requests", new { subject = "شراء طابعة", details = "طابعة لقسم الموارد البشرية", amount = 1500.555m });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var request = await Json(created);
        var id = request.GetProperty("id").GetGuid();
        Assert.Matches(@"^REQ-\d{4}-00001$", request.GetProperty("number").GetString());
        Assert.Equal(1500.56m, request.GetProperty("amount").GetDecimal());

        Assert.Equal(HttpStatusCode.OK, (await employee.PostAsJsonAsync($"/api/v1/workflow/requests/{id}/submit", new { })).StatusCode);

        // Stage 1 (role): only the reviewer has a task; the employee cannot edit while in approval.
        Assert.Empty(await TasksAsync(admin));
        var reviewTask = Assert.Single(await TasksAsync(reviewer));
        Assert.Equal(HttpStatusCode.Conflict, (await employee.PutAsJsonAsync($"/api/v1/workflow/requests/{id}", new { subject = "x", details = "" })).StatusCode);

        // Editing the route now does not affect this running approval (it keeps its version).
        await PublishRouteAsync(admin, adminId, onlyAdmin: true);

        Assert.Equal(HttpStatusCode.NoContent, (await Decide(reviewer, reviewTask, "Approve", null)).StatusCode);
        Assert.Empty(await TasksAsync(reviewer));
        var managerTask = Assert.Single(await TasksAsync(admin));
        Assert.Equal(2, managerTask.GetProperty("stageOrder").GetInt32());

        Assert.Equal(HttpStatusCode.NoContent, (await Decide(admin, managerTask, "Approve", "موافق")).StatusCode);

        var done = await Json(await employee.GetAsync($"/api/v1/workflow/requests/{id}"));
        Assert.Equal("Approved", done.GetProperty("status").GetString());
        var approval = done.GetProperty("approval");
        Assert.Equal("Approved", approval.GetProperty("status").GetString());
        Assert.Equal(["Approved", "Approved"], approval.GetProperty("steps").EnumerateArray().Select(s => s.GetProperty("status").GetString()));

        // The reviewer took part, so may open it; a decided task cannot be decided again.
        Assert.Equal(HttpStatusCode.OK, (await reviewer.GetAsync($"/api/v1/workflow/requests/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Decide(admin, managerTask, "Approve", null)).StatusCode);
    }

    [SkippableFact]
    public async Task A_returned_request_can_be_corrected_and_submitted_again()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var (_, _, employee, reviewer) = await SetUpAsync();
        var id = (await Json(await employee.PostAsJsonAsync("/api/v1/workflow/requests", new { subject = "سلفة", details = "" }))).GetProperty("id").GetGuid();
        await employee.PostAsJsonAsync($"/api/v1/workflow/requests/{id}/submit", new { });
        var task = Assert.Single(await TasksAsync(reviewer));

        Assert.Equal("validation.approval_comment_required", (await Json(await Decide(reviewer, task, "Return", ""))).GetProperty("title").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await Decide(reviewer, task, "Return", "أضف المبلغ")).StatusCode);

        var returned = await Json(await employee.GetAsync($"/api/v1/workflow/requests/{id}"));
        Assert.Equal("Returned", returned.GetProperty("status").GetString());
        Assert.Equal("أضف المبلغ", returned.GetProperty("lastComment").GetString());

        Assert.Equal(HttpStatusCode.OK, (await employee.PutAsJsonAsync($"/api/v1/workflow/requests/{id}", new { subject = "سلفة", details = "", amount = 3000 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await employee.PostAsJsonAsync($"/api/v1/workflow/requests/{id}/submit", new { })).StatusCode);
        Assert.Single(await TasksAsync(reviewer));
    }

    [SkippableFact]
    public async Task Without_a_route_or_an_approver_a_request_cannot_be_submitted()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var admin = await SignInAsync(_admin);
        await admin.PostAsJsonAsync("/api/v1/access/members", new { userName = _employee });
        var employee = await SignInAsync(_employee);
        var myId = (await Json(await admin.GetAsync("/api/v1/auth/me"))).GetProperty("userId").GetGuid();

        // Bootstrap admin may create requests too; with no route there is nothing to submit to.
        var id = (await Json(await admin.PostAsJsonAsync("/api/v1/workflow/requests", new { subject = "بلا مسار", details = "" }))).GetProperty("id").GetGuid();
        Assert.Equal("validation.approval_no_route", (await Json(await admin.PostAsJsonAsync($"/api/v1/workflow/requests/{id}/submit", new { }))).GetProperty("title").GetString());

        // The only approver is the submitter: refused before starting (nobody approves their own request).
        await PublishRouteAsync(admin, myId, onlyAdmin: true);
        Assert.Equal("validation.approval_stage_unassigned", (await Json(await admin.PostAsJsonAsync($"/api/v1/workflow/requests/{id}/submit", new { }))).GetProperty("title").GetString());

        // A member without the create permission cannot create requests, and cannot see the routes.
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.PostAsJsonAsync("/api/v1/workflow/requests", new { subject = "x", details = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/v1/workflow/routes")).StatusCode);
    }

    /// <summary>Route: reviewers (role) then the administrator (named user). Employee may create requests.</summary>
    private async Task<(HttpClient Admin, Guid AdminId, HttpClient Employee, HttpClient Reviewer)> SetUpAsync()
    {
        var admin = await SignInAsync(_admin);
        var adminId = (await Json(await admin.GetAsync("/api/v1/auth/me"))).GetProperty("userId").GetGuid();
        var employeeMembership = await AddMemberAsync(admin, _employee);
        var reviewerMembership = await AddMemberAsync(admin, _reviewer);

        var requester = await CreateRoleAsync(admin, "requester", "workflow.requests.create");
        var reviewers = await CreateRoleAsync(admin, "reviewers", "workflow.routes.view");
        await SetRolesAsync(admin, employeeMembership, requester);
        await SetRolesAsync(admin, reviewerMembership, reviewers);
        _reviewersRole = reviewers;

        await PublishRouteAsync(admin, adminId, onlyAdmin: false);
        return (admin, adminId, await SignInAsync(_employee), await SignInAsync(_reviewer));
    }

    private Guid _reviewersRole;

    private async Task PublishRouteAsync(HttpClient admin, Guid adminId, bool onlyAdmin)
    {
        object[] stages = onlyAdmin
            ? [new { nameAr = "اعتماد المدير", nameEn = "Manager approval", kind = "User", userId = adminId }]
            : [
                new { nameAr = "المراجعة", nameEn = "Review", kind = "Role", roleId = _reviewersRole },
                new { nameAr = "اعتماد المدير", nameEn = "Manager approval", kind = "User", userId = adminId },
            ];
        var response = await admin.PutAsJsonAsync("/api/v1/workflow/routes/workflow.internal_request", new { stages, isActive = true });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static async Task<List<JsonElement>> TasksAsync(HttpClient client) =>
        (await Json(await client.GetAsync("/api/v1/workflow/tasks"))).EnumerateArray().ToList();

    private static Task<HttpResponseMessage> Decide(HttpClient client, JsonElement task, string decision, string? comment) =>
        client.PostAsJsonAsync($"/api/v1/workflow/tasks/{task.GetProperty("id").GetGuid()}/decision", new { decision, comment });

    private static async Task<Guid> AddMemberAsync(HttpClient admin, string userName) =>
        (await Json(await admin.PostAsJsonAsync("/api/v1/access/members", new { userName }))).GetProperty("membershipId").GetGuid();

    private static async Task<Guid> CreateRoleAsync(HttpClient admin, string code, params string[] permissions)
    {
        var response = await admin.PostAsJsonAsync("/api/v1/access/roles", new { code, nameAr = "دور " + code, nameEn = "Role " + code, permissions });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await Json(response)).GetProperty("id").GetGuid();
    }

    private static async Task SetRolesAsync(HttpClient admin, Guid membershipId, Guid roleId)
    {
        var response = await admin.PutAsJsonAsync($"/api/v1/access/members/{membershipId}/roles", new { roles = new[] { new { roleId, legalEntityId = (Guid?)null } } });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

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
