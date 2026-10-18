using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.Commercial.Application;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Operations.Application;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workflow.Application;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Operations;

[Collection(DatabaseTestGroup.Name)]
public sealed class TransferOrderTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task A_transfer_order_moves_workers_on_the_job_to_another_project_with_its_package_price()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var philippines = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        var labour = crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var riyadh = crm.Add("new_project", new() { ["new_name"] = "مشروع الرياض", ["new_code"] = "pro00700", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: Created2025);
        var jeddah = crm.Add("new_project", new() { ["new_name"] = "مشروع جدة", ["new_code"] = "pro00701", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: Created2025);
        Worker(crm, "BSS0301", philippines, labour, 100000000, riyadh, "مشروع الرياض");
        Worker(crm, "BSS0302", philippines, labour, 100000000, jeddah, "مشروع جدة");
        Worker(crm, "BSS0303", philippines, labour, 279640001, null, null); // in housing
        await SyncAndImportAsync(tenantId, crm);

        var (creator, manager) = await PeopleAsync(tenantId);
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
        Guid jeddahId, moving, already, housed, orderId;
        using (var scope = database.Scope(tenantId, user: creator.ToString()))
        {
            jeddahId = (await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().ProjectsAsync(default)).Single(p => p.Name == "مشروع جدة").Id;
            var options = await scope.ServiceProvider.GetRequiredService<PricingQueries>().OptionsAsync(null, default);
            var package = await scope.ServiceProvider.GetRequiredService<PricingService>().CreateAsync(
                new PackageInput(jeddahId, options.Professions.Single().Code, options.Nationalities.Single().Code, 1500m, 1300m, 200m, true, 0m, false, new DateOnly(2026, 1, 1), null, null),
                default);
            Assert.True(package.IsSuccess);

            var service = scope.ServiceProvider.GetRequiredService<TransferOrderService>();
            var onJob = await service.OnJobAsync(null, default);
            Assert.Equal(["BSS0301", "BSS0302"], onJob.Select(w => w.Worker.WorkerNo).Order());
            moving = onJob.Single(w => w.Worker.WorkerNo == "BSS0301").Worker.Id;
            already = onJob.Single(w => w.Worker.WorkerNo == "BSS0302").Worker.Id;
            housed = (await scope.ServiceProvider.GetRequiredService<IWorkforceDirectory>().SearchAsync("BSS0303", 5, default)).Single().Id;

            TransferInput Input(DateOnly on, params TransferLineInput[] lines) => new(jeddahId, on, "أحمد", "مشرف الموقع", null, null, lines);
            Assert.Equal("validation.transfer_same_project", (await service.CreateAsync(Input(today, new TransferLineInput(already, null, null)), default)).Error.Code);
            Assert.Equal("validation.transfer_not_on_job", (await service.CreateAsync(Input(today, new TransferLineInput(housed, null, null)), default)).Error.Code);
            Assert.Equal("validation.transfer_delay_reason", (await service.CreateAsync(Input(today.AddDays(-5), new TransferLineInput(moving, null, null)), default)).Error.Code);
            Assert.Equal("validation.transfer_special_reason", (await service.CreateAsync(Input(today, new TransferLineInput(moving, 3500m, null)), default)).Error.Code);

            var saved = await service.CreateAsync(Input(today, new TransferLineInput(moving, null, null)), default);
            Assert.True(saved.IsSuccess, saved.IsFailure ? saved.Error.Code : null);
            Assert.Null(saved.Value.ApprovalError);
            orderId = saved.Value.Id;

            // The worker cannot be moved twice at once, nor sent back to housing meanwhile.
            Assert.Equal("conflict.transfer_worker_busy", (await service.CreateAsync(Input(today, new TransferLineInput(moving, null, null)), default)).Error.Code);
            var returned = await scope.ServiceProvider.GetRequiredService<ReturnOrderService>().CreateAsync(new ReturnInput(moving, today, "Sick", null, true, null, null, null), default);
            Assert.Equal("conflict.return_worker_busy", returned.Error.Code);

            var detail = (await scope.ServiceProvider.GetRequiredService<TransferOrderQueries>().GetAsync(orderId, default))!;
            var line = detail.Lines.Single();
            Assert.Equal(("مشروع الرياض", new DateOnly(2026, 1, 1), "PKG-00001", 3000m, false), (line.FromProjectName, line.FromStartedOn, line.PackageNo, line.TotalPrice, line.IsSpecialPrice));
            Assert.Null(line.FromTotalPrice); // The work on the old project came from the old system: no price recorded here.
            Assert.Equal(("UnderPreparation", "تأكيد منشئ أمر النقل"), (detail.Summary.Status, detail.Approval!.CurrentStepAr));
            // A list sees where the order's approval waits, and since when.
            var stage = (await scope.ServiceProvider.GetRequiredService<ApprovalEngine>().CurrentStagesAsync("operations.transfer_order", [orderId, Guid.NewGuid()], default)).Single();
            Assert.Equal((orderId, "تأكيد منشئ أمر النقل", true), (stage.RecordId, stage.StepAr, stage.Since.HasValue));

            // 1. The creator confirms.
            await DecideAsync(scope, creator);
        }

        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var detail = (await scope.ServiceProvider.GetRequiredService<TransferOrderQueries>().GetAsync(orderId, default))!;
            Assert.Equal("SentToOperationsManager", detail.Summary.Status);

            // 2. The operations manager approves: the worker is on the new project from the transfer date.
            await DecideAsync(scope, manager);
        }

        using (var scope = database.Scope(tenantId))
        {
            var detail = (await scope.ServiceProvider.GetRequiredService<TransferOrderQueries>().GetAsync(orderId, default))!;
            Assert.Equal(("Transferred", true), (detail.Summary.Status, detail.TransferredAt is not null));

            var period = (await scope.ServiceProvider.GetRequiredService<IPeriodLedger>().PeriodsAsync(moving, default))[0];
            Assert.Equal(("Work", "مشروع جدة", today, (DateOnly?)null, 3000m, detail.Summary.OrderNo), (period.Kind, period.ProjectName, period.StartsOn, period.EndsOn, period.TotalPrice, period.SourceNo));

            var card = (await scope.ServiceProvider.GetRequiredService<IWorkforceDirectory>().CardsAsync([moving], default)).Single();
            Assert.Equal(("مشروع جدة", today, true), (card.ProjectName, card.ProjectJoinedOn, card.OnJob));
            var list = await scope.ServiceProvider.GetRequiredService<TransferOrderQueries>().ListAsync(new DeliveryListFilter(null, "transferred", null, null, true, 1, 50), default);
            Assert.Equal(("مشروع الرياض", 1), (list.Items.Single().FromProjects, list.Totals.Transferred));
        }
    }

    /// <summary>The user's open approval task on the order, approved.</summary>
    private static async Task DecideAsync(IServiceScope scope, Guid userId)
    {
        var workflow = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
        var task = await workflow.WorkItems.SingleAsync(w => w.AssigneeUserId == userId && w.Status == WorkItemStatus.Pending);
        var decided = await scope.ServiceProvider.GetRequiredService<ApprovalEngine>().DecideAsync(task.Id, Decision.Approve, "موافق", null, default);
        Assert.True(decided.IsSuccess, decided.IsFailure ? decided.Error.Code : null);
    }

    /// <summary>A creator of transfer orders (who also manages prices) and an operations manager.</summary>
    private async Task<(Guid Creator, Guid OperationsManager)> PeopleAsync(Guid tenantId)
    {
        using var scope = database.Scope(tenantId, user: "setup");
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<PermissionCatalog>();
        async Task<Guid> PersonAsync(string name, params string[] permissions)
        {
            var user = UserAccount.Create(name, null);
            identity.Users.Add(user);
            var membership = new Membership(user.Id, tenantId);
            identity.Memberships.Add(membership);
            var role = Role.Create($"r-{Guid.NewGuid():N}"[..20], name, name, ["operations.transfer.view", .. permissions], catalog).Value;
            identity.Roles.Add(role);
            identity.RoleAssignments.Add(new RoleAssignment(membership.Id, role.Id, null, tenantId));
            await identity.SaveChangesAsync();
            return user.Id;
        }

        var creator = await PersonAsync("منشئ أمر النقل", "operations.transfer.create", "operations.return.create", "commercial.prices.manage");
        return (creator, await PersonAsync("مدير العمليات", "operations.transfer.approve"));
    }

    private static void Worker(FakeCrm crm, string number, Guid nationality, Guid profession, int status, Guid? project, string? projectName) =>
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {number}", ["new_empidnumber"] = number, ["new_idnumber"] = $"2{number[3..]}00000",
            ["statuscode"] = status, ["new_employeetype"] = 2, ["new_projectid"] = project?.ToString(), ["new_projectidname"] = projectName,
            ["new_projectjoingdate"] = project is null ? null : "2025-12-31T21:00:00Z",
            ["new_nationalityid"] = nationality.ToString(), ["new_professionid"] = profession.ToString(), ["new_totalsalary"] = 1500m,
        }, created: Created2025);

    private async Task<Guid> CreateCompanyAsync()
    {
        using var scope = database.Scope(system: true);
        var code = $"tr-{Guid.NewGuid():N}"[..16];
        return (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(code, "شركة النقل", "Transfer Co", default)).Value.Id;
    }

    private async Task SyncAndImportAsync(Guid tenantId, FakeCrm crm)
    {
        using var scope = database.Scope(tenantId, user: "crm-sync");
        var db = scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>();
        var sync = ActivatorUtilities.CreateInstance<CrmSyncService>(scope.ServiceProvider, (ICrmSource)crm, Options.Create(new CrmSyncOptions()));
        db.Runs.Add(new SyncRun(SyncMode.Incremental, "test", DateTimeOffset.UtcNow));
        await db.SaveChangesAsync();
        var consumers = scope.ServiceProvider.GetServices<ICrmStagingConsumer>().ToList();
        Assert.True(await sync.RunNextAsync(scope.ServiceProvider.GetRequiredService<ReferenceImportService>(), consumers, default));
    }
}
