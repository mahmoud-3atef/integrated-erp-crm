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
/// Approval processes over HTTP, end to end: designed and published through the API, then run by internal requests.
/// Users: an administrator (designs processes), an employee (requests), a reviewer (role "reviewers"),
/// and a manager (chosen by the employee as direct manager).
/// </summary>
[Collection(DatabaseTestGroup.Name)]
public sealed class WorkflowApiTests : IAsyncLifetime
{
    private const string Password = "Correct-Horse-1";
    private const string Screen = "workflow.internal_request";

    private readonly TestDatabase _database;
    private readonly FakeDirectory _directory = new();
    private readonly string _keys = Path.Combine(Path.GetTempPath(), $"erp-keys-{Guid.NewGuid():N}");
    private readonly string _tenantCode = $"wf-{Guid.NewGuid():N}"[..20];
    private readonly string _admin = $"adm{Guid.NewGuid():N}"[..14];
    private readonly string _employee = $"emp{Guid.NewGuid():N}"[..14];
    private readonly string _reviewer = $"rev{Guid.NewGuid():N}"[..14];
    private readonly string _manager = $"mgr{Guid.NewGuid():N}"[..14];
    private WebApplicationFactory<Program>? _factory;

    private HttpClient _adminClient = null!;
    private HttpClient _employeeClient = null!;
    private HttpClient _reviewerClient = null!;
    private HttpClient _managerClient = null!;
    private Guid _reviewersRole;
    private Guid _managerId;
    private Guid _reviewerId;

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

        foreach (var name in new[] { _admin, _employee, _reviewer, _manager })
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

        _adminClient = await SignInAsync(_admin);
        var employeeMembership = await AddMemberAsync(_employee);
        var reviewerMembership = await AddMemberAsync(_reviewer);
        var managerMembership = await AddMemberAsync(_manager);
        var requester = await CreateRoleAsync("requester", "workflow.requests.create");
        _reviewersRole = await CreateRoleAsync("reviewers", "workflow.requests.view");
        await SetRoleAsync(employeeMembership, requester);
        await SetRoleAsync(reviewerMembership, _reviewersRole);
        await SetRoleAsync(managerMembership, _reviewersRole);

        _employeeClient = await SignInAsync(_employee);
        _reviewerClient = await SignInAsync(_reviewer);
        _managerClient = await SignInAsync(_manager);
        _managerId = await MeAsync(_managerClient);
        _reviewerId = await MeAsync(_reviewerClient);
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

    /// <summary>Purchases over 10,000 go to the reviewers first; then the direct manager approves and must write notes.</summary>
    private object PurchaseProcess(string managerStageName = "Manager approval") => new
    {
        startCondition = (object?)null,
        steps = new object[]
        {
            new
            {
                type = "condition",
                id = "big",
                branches = new[]
                {
                    new
                    {
                        condition = new { matchAll = true, rules = new[] { new { fieldKey = "amount", @operator = "GreaterThan", value = "10000" } } },
                        steps = new object[]
                        {
                            new { type = "update", id = "mark", changes = new[] { new { fieldKey = "status", value = "UnderReview" } } },
                            new
                            {
                                type = "approval", id = "finance", nameAr = "مراجعة مالية", nameEn = "Finance review",
                                assignees = new[] { new { kind = "Role", roleId = _reviewersRole } }, rule = "Any",
                            },
                        },
                    },
                },
            },
            new
            {
                type = "approval", id = "manager", nameAr = "اعتماد المدير المباشر", nameEn = managerStageName,
                assignees = new[] { new { kind = "UserField", fieldKey = "direct_manager" } }, rule = "Any",
                requiredFields = new[] { "approver_notes" }, dueHours = 48,
            },
        },
    };

    [SkippableFact]
    public async Task A_small_request_goes_straight_to_the_direct_manager_who_must_write_notes()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        await PublishAsync(PurchaseProcess());

        var id = await NewRequestAsync("شراء أحبار", 500m, _managerId);
        Assert.Equal(HttpStatusCode.OK, (await _employeeClient.PostAsync($"/api/v1/workflow/requests/{id}/submit", null)).StatusCode);

        Assert.Empty(await InboxAsync(_reviewerClient));
        var task = Assert.Single(await InboxAsync(_managerClient));
        Assert.Equal("Manager approval", task.GetProperty("stepNameEn").GetString());
        Assert.NotEqual(JsonValueKind.Null, task.GetProperty("dueAt").ValueKind);

        var missing = await DecideAsync(_managerClient, task, "Approve", null);
        Assert.Equal("validation.approval_field_required", (await Json(missing)).GetProperty("title").GetString());

        var approved = await DecideAsync(_managerClient, task, "Approve", "موافق", new Dictionary<string, string?> { ["approver_notes"] = "يُشترى من المورد المعتمد" });
        Assert.Equal(HttpStatusCode.NoContent, approved.StatusCode);

        var request = await Json(await _employeeClient.GetAsync($"/api/v1/workflow/requests/{id}"));
        Assert.Equal("Approved", request.GetProperty("status").GetString());
        Assert.Equal("يُشترى من المورد المعتمد", request.GetProperty("approverNotes").GetString());
        var kinds = request.GetProperty("approval").GetProperty("history").EnumerateArray().Select(h => h.GetProperty("kind").GetString()).ToList();
        Assert.Equal(["Submitted", "ConditionEvaluated", "StageOpened", "RecordUpdated", "Approved", "Completed"], kinds);
        Assert.Equal(
            Enumerable.Range(1, kinds.Count),
            request.GetProperty("approval").GetProperty("history").EnumerateArray().Select(h => h.GetProperty("sequence").GetInt32()));
    }

    [SkippableFact]
    public async Task A_large_request_is_reviewed_first_and_its_status_is_updated_by_the_process()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        await PublishAsync(PurchaseProcess());
        var id = await NewRequestAsync("شراء خادم", 25000m, _managerId);
        await _employeeClient.PostAsync($"/api/v1/workflow/requests/{id}/submit", null);

        var request = await Json(await _employeeClient.GetAsync($"/api/v1/workflow/requests/{id}"));
        Assert.Equal("UnderReview", request.GetProperty("status").GetString());

        // Role stage: both role holders get the task; the first decision closes it for the other.
        var reviewerTask = Assert.Single(await InboxAsync(_reviewerClient));
        var managerReviewTask = Assert.Single(await InboxAsync(_managerClient));
        Assert.Equal("Finance review", managerReviewTask.GetProperty("stepNameEn").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await DecideAsync(_reviewerClient, reviewerTask, "Approve", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await DecideAsync(_managerClient, managerReviewTask, "Approve", null)).StatusCode);

        // Next: the direct manager stage opens for the manager.
        var managerTask = Assert.Single(await InboxAsync(_managerClient));
        Assert.Equal("Manager approval", managerTask.GetProperty("stepNameEn").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await DecideAsync(_managerClient, managerTask, "Reject", "الميزانية لا تسمح")).StatusCode);
        Assert.Equal("Rejected", (await Json(await _employeeClient.GetAsync($"/api/v1/workflow/requests/{id}"))).GetProperty("status").GetString());
    }

    [SkippableFact]
    public async Task Returned_requests_are_corrected_and_sent_again_on_the_new_version()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var process = await PublishAsync(PurchaseProcess());
        var id = await NewRequestAsync("سلفة", 300m, _managerId);
        await _employeeClient.PostAsync($"/api/v1/workflow/requests/{id}/submit", null);

        // Publishing version 2 now does not change the running approval (still on version 1).
        await SaveAndPublishAsync(process, PurchaseProcess("Manager approval v2"));
        var task = Assert.Single(await InboxAsync(_managerClient));
        Assert.Equal("Manager approval", task.GetProperty("stepNameEn").GetString());

        Assert.Equal("validation.approval_comment_required", (await Json(await DecideAsync(_managerClient, task, "Return", " "))).GetProperty("title").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await DecideAsync(_managerClient, task, "Return", "أرفق عرض السعر")).StatusCode);

        var returned = await Json(await _employeeClient.GetAsync($"/api/v1/workflow/requests/{id}"));
        Assert.Equal("Returned", returned.GetProperty("status").GetString());
        Assert.True(returned.GetProperty("canEdit").GetBoolean());

        Assert.Equal(HttpStatusCode.OK, (await _employeeClient.PostAsync($"/api/v1/workflow/requests/{id}/submit", null)).StatusCode);
        var again = Assert.Single(await InboxAsync(_managerClient));
        Assert.Equal("Manager approval v2", again.GetProperty("stepNameEn").GetString());
    }

    [SkippableFact]
    public async Task A_decision_repeated_with_the_same_idempotency_key_is_made_once()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        await PublishAsync(PurchaseProcess());
        var id = await NewRequestAsync("شراء خادم", 25000m, _managerId);
        await _employeeClient.PostAsync($"/api/v1/workflow/requests/{id}/submit", null);

        // The bar's data: the current stage with its rule and round, and the stage still ahead marked as planned.
        var approval = (await Json(await _employeeClient.GetAsync($"/api/v1/workflow/requests/{id}"))).GetProperty("approval");
        var current = Assert.Single(approval.GetProperty("stages").EnumerateArray());
        Assert.Equal("Current", current.GetProperty("state").GetString());
        Assert.Equal("Any", current.GetProperty("rule").GetString());
        Assert.Equal(1, current.GetProperty("round").GetInt32());
        var planned = Assert.Single(approval.GetProperty("planned").EnumerateArray());
        Assert.Equal("manager", planned.GetProperty("stepId").GetString());

        var task = Assert.Single(await InboxAsync(_reviewerClient));
        var key = Guid.NewGuid().ToString("N");
        Assert.Equal(HttpStatusCode.NoContent, (await DecideAsync(_reviewerClient, task, "Approve", "موافق", key: key)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await DecideAsync(_reviewerClient, task, "Approve", "موافق", key: key)).StatusCode);

        // Done once: one approval in the history, and the next stage opened once.
        approval = (await Json(await _employeeClient.GetAsync($"/api/v1/workflow/requests/{id}"))).GetProperty("approval");
        Assert.Single(approval.GetProperty("history").EnumerateArray(), h => h.GetProperty("kind").GetString() == "Approved");
        Assert.Single(approval.GetProperty("history").EnumerateArray(), h => h.GetProperty("stepNameEn").GetString() == "Manager approval");
        Assert.Empty(approval.GetProperty("planned").EnumerateArray());

        // Another key (or none) on the closed task is still a conflict.
        Assert.Equal(HttpStatusCode.Conflict, (await DecideAsync(_reviewerClient, task, "Approve", "موافق", key: Guid.NewGuid().ToString("N"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await DecideAsync(_reviewerClient, task, "Approve", "موافق")).StatusCode);
    }

    [SkippableFact]
    public async Task All_rule_waits_for_everyone_and_a_task_can_be_delegated()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var adminId = await MeAsync(_adminClient);
        await PublishAsync(new
        {
            steps = new object[]
            {
                new
                {
                    type = "approval", id = "committee", nameAr = "اللجنة", nameEn = "Committee",
                    assignees = new object[] { new { kind = "User", userId = _reviewerId }, new { kind = "User", userId = _managerId } },
                    rule = "All",
                },
            },
        });
        var id = await NewRequestAsync("شراء أثاث", 900m, null);
        await _employeeClient.PostAsync($"/api/v1/workflow/requests/{id}/submit", null);

        Assert.Equal(HttpStatusCode.NoContent, (await DecideAsync(_reviewerClient, Assert.Single(await InboxAsync(_reviewerClient)), "Approve", null)).StatusCode);
        Assert.Equal("InApproval", (await Json(await _employeeClient.GetAsync($"/api/v1/workflow/requests/{id}"))).GetProperty("status").GetString());

        // The manager hands the task to the administrator, who approves on the manager's behalf.
        var managerTask = Assert.Single(await InboxAsync(_managerClient));
        var delegated = await _managerClient.PostAsJsonAsync($"/api/v1/workflow/work-items/{managerTask.GetProperty("id").GetGuid()}/delegate", new { userId = adminId, comment = "إجازة" });
        Assert.Equal(HttpStatusCode.NoContent, delegated.StatusCode);
        Assert.Empty(await InboxAsync(_managerClient));
        Assert.Equal(HttpStatusCode.NoContent, (await DecideAsync(_adminClient, Assert.Single(await InboxAsync(_adminClient)), "Approve", null)).StatusCode);

        var request = await Json(await _employeeClient.GetAsync($"/api/v1/workflow/requests/{id}"));
        Assert.Equal("Approved", request.GetProperty("status").GetString());
        var onBehalf = request.GetProperty("approval").GetProperty("history").EnumerateArray().Last(h => h.GetProperty("kind").GetString() == "Approved");
        Assert.Equal(_manager, onBehalf.GetProperty("onBehalfOf").GetString());
    }

    [SkippableFact]
    public async Task Without_a_matching_process_or_approver_nothing_starts_and_requests_can_be_withdrawn()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var id = await NewRequestAsync("بلا عملية", 100m, _managerId);
        Assert.Equal("validation.approval_no_process", (await Json(await _employeeClient.PostAsync($"/api/v1/workflow/requests/{id}/submit", null))).GetProperty("title").GetString());

        // Nobody can be their own direct manager.
        var self = await _employeeClient.PostAsJsonAsync("/api/v1/workflow/requests", new { subject = "x", details = "", directManagerId = await MeAsync(_employeeClient) });
        Assert.Equal("validation.request_manager_self", (await Json(self)).GetProperty("title").GetString());

        // Withdraw: the submitter cancels with a reason; the request can be edited again.
        await PublishAsync(PurchaseProcess());
        await _employeeClient.PostAsync($"/api/v1/workflow/requests/{id}/submit", null);
        var instance = (await Json(await _employeeClient.GetAsync("/api/v1/workflow/my-requests"))).EnumerateArray().First().GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Forbidden, (await _reviewerClient.PostAsJsonAsync($"/api/v1/workflow/instances/{instance}/cancel", new { reason = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await _employeeClient.PostAsJsonAsync($"/api/v1/workflow/instances/{instance}/cancel", new { reason = "لم أعد أحتاجه" })).StatusCode);
        Assert.Empty(await InboxAsync(_managerClient));
        Assert.Equal("Canceled", (await Json(await _employeeClient.GetAsync($"/api/v1/workflow/requests/{id}"))).GetProperty("status").GetString());

        // Only process designers may publish.
        Assert.Equal(HttpStatusCode.Forbidden, (await _employeeClient.GetAsync("/api/v1/workflow/processes")).StatusCode);
    }

    [SkippableFact]
    public async Task Invalid_processes_cannot_be_published()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var created = await _adminClient.PostAsJsonAsync("/api/v1/workflow/processes", new { screen = Screen, nameAr = "عملية", nameEn = "Process", priority = 0 });
        var id = (await Json(created)).GetProperty("process").GetProperty("id").GetGuid();
        await _adminClient.PutAsJsonAsync($"/api/v1/workflow/processes/{id}/draft", new
        {
            nameAr = "عملية",
            nameEn = "Process",
            priority = 0,
            definition = new { steps = new object[] { new { type = "update", id = "u", changes = new[] { new { fieldKey = "amount", value = "1" } } } } },
        });

        var invalid = await _adminClient.PostAsync($"/api/v1/workflow/processes/{id}/publish", null);
        Assert.Equal("validation.process_invalid", (await Json(invalid)).GetProperty("title").GetString());
    }

    // ---------------------------------------------------------------- helpers

    private async Task<Guid> PublishAsync(object definition)
    {
        var created = await _adminClient.PostAsJsonAsync("/api/v1/workflow/processes", new { screen = Screen, nameAr = "عملية الشراء", nameEn = "Purchase process", priority = 10 });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await Json(created)).GetProperty("process").GetProperty("id").GetGuid();
        await SaveAndPublishAsync(id, definition);
        return id;
    }

    private async Task SaveAndPublishAsync(Guid id, object definition)
    {
        var saved = await _adminClient.PutAsJsonAsync($"/api/v1/workflow/processes/{id}/draft", new { nameAr = "عملية الشراء", nameEn = "Purchase process", priority = 10, definition });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var published = await _adminClient.PostAsync($"/api/v1/workflow/processes/{id}/publish", null);
        Assert.True(published.StatusCode == HttpStatusCode.OK, await published.Content.ReadAsStringAsync());
    }

    private async Task<Guid> NewRequestAsync(string subject, decimal amount, Guid? manager)
    {
        var created = await _employeeClient.PostAsJsonAsync("/api/v1/workflow/requests", new { subject, details = "", amount, category = "PURCHASE", directManagerId = manager });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        return (await Json(created)).GetProperty("id").GetGuid();
    }

    private static async Task<List<JsonElement>> InboxAsync(HttpClient client) =>
        (await Json(await client.GetAsync("/api/v1/workflow/inbox"))).EnumerateArray().ToList();

    private static async Task<HttpResponseMessage> DecideAsync(HttpClient client, JsonElement task, string decision, string? comment, Dictionary<string, string?>? fields = null, string? key = null)
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/workflow/work-items/{task.GetProperty("id").GetGuid()}/decision")
        {
            Content = JsonContent.Create(new { decision, comment, fields }),
        };
        if (key is not null)
        {
            message.Headers.Add("Idempotency-Key", key);
        }

        return await client.SendAsync(message);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static async Task<Guid> MeAsync(HttpClient client) => (await Json(await client.GetAsync("/api/v1/auth/me"))).GetProperty("userId").GetGuid();

    private async Task<Guid> AddMemberAsync(string userName) =>
        (await Json(await _adminClient.PostAsJsonAsync("/api/v1/access/members", new { userName }))).GetProperty("membershipId").GetGuid();

    private async Task<Guid> CreateRoleAsync(string code, params string[] permissions)
    {
        var response = await _adminClient.PostAsJsonAsync("/api/v1/access/roles", new { code, nameAr = "دور " + code, nameEn = "Role " + code, permissions });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await Json(response)).GetProperty("id").GetGuid();
    }

    private async Task SetRoleAsync(Guid membershipId, Guid roleId)
    {
        var response = await _adminClient.PutAsJsonAsync($"/api/v1/access/members/{membershipId}/roles", new { roles = new[] { new { roleId, legalEntityId = (Guid?)null } } });
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
