using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.Commercial.Application;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Operations.Application;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Workflow.Application;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using IntegratedErp.Modules.Workforce.Application;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Operations;

[Collection(DatabaseTestGroup.Name)]
public sealed class DeliveryOrderTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task A_delivery_order_takes_its_prices_from_the_packages_and_goes_through_approval_to_delivery()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var philippines = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        var india = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الهند", ["new_nameenglish"] = "India" });
        var labour = crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var project = crm.Add("new_project", new() { ["new_name"] = "مشروع الرياض", ["new_code"] = "pro00400", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: Created2025);
        Worker(crm, "BSS0001", philippines, labour, 279640001, null); // in housing
        Worker(crm, "BSS0002", india, labour, 279640001, null); // in housing, no package for India
        var onJob = Worker(crm, "BSS0003", philippines, labour, 100000000, project); // on the job

        // An order of the old system, delivered, with its work start.
        var crmOrder = crm.Add("new_deliverorder", new()
        {
            ["new_number"] = "D003162", ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الرياض", ["statuscode"] = 279640001,
            ["new_laborsnumber"] = "BSS0003", ["new_deliverdate"] = "2026-09-28T21:00:00Z", ["new_startworkdate"] = "2026-09-29T21:00:00Z",
            ["new_receicename"] = "عبدالمجيد", ["new_serviceprice"] = 4500m,
        }, created: Created2025);
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = onJob.ToString(), ["new_projectid"] = project.ToString(), ["new_deliverorderid"] = crmOrder.ToString(),
            ["new_startdate"] = "2026-09-29T21:00:00Z", ["new_serviceprice"] = 4600m, ["new_number"] = "SW009732", ["statecode"] = 0,
        }, created: Created2025);

        await SyncAndImportAsync(tenantId, crm);

        Guid projectId;
        Guid first, second, busyWorker;
        using (var scope = database.Scope(tenantId))
        {
            var queries = scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>();
            var list = await queries.ListAsync(new DeliveryListFilter(null, null, null, null, true, 1, 50), default);
            var copied = list.Items.Single();
            Assert.Equal(("D003162", "Crm", "Delivered", 1, 4600m), (copied.OrderNo, copied.Source, copied.Status, copied.Workers, copied.TotalPrice));
            var copiedDetail = await queries.GetAsync(copied.Id, default);
            Assert.Equal(("SW009732", new DateOnly(2026, 9, 30)), (copiedDetail!.Lines.Single().WorkStartNo, copiedDetail.Lines.Single().StartedOn));
            Assert.False(copiedDetail.CanEdit);

            projectId = (await queries.ProjectsAsync(default)).Single().Id;
            var workers = scope.ServiceProvider.GetRequiredService<IntegratedErp.Modules.Workforce.Contracts.IWorkforceDirectory>();
            var found = await workers.SearchAsync("BSS0001 BSS0002 BSS0003", 10, default);
            Assert.Equal([true, true, false], found.Select(w => w.Available));
            first = found.Single(w => w.WorkerNo == "BSS0001").Id;
            second = found.Single(w => w.WorkerNo == "BSS0002").Id;
            busyWorker = found.Single(w => w.WorkerNo == "BSS0003").Id;

            // The user's package for Filipino labourers on the project.
            var options = await scope.ServiceProvider.GetRequiredService<PricingQueries>().OptionsAsync(null, default);
            var created = await scope.ServiceProvider.GetRequiredService<PricingService>().CreateAsync(
                new PackageInput(projectId, options.Professions.Single().Code, options.Nationalities.Single(n => n.NameEn == "Philippines").Code,
                    1500m, 1300m, 200m, true, 0m, false, new DateOnly(2026, 1, 1), null, null),
                default);
            Assert.True(created.IsSuccess);
        }

        // The people of the default process: the order's creator and an operations manager.
        var (creator, operationsManager) = await PeopleAsync(tenantId);

        var deliverOn = DateOnly.FromDateTime(DateTime.UtcNow);
        Guid orderId;
        using (var scope = database.Scope(tenantId, user: creator.ToString()))
        {
            var service = scope.ServiceProvider.GetRequiredService<DeliveryOrderService>();
            DeliveryInput Input(params DeliveryLineInput[] lines) => new(projectId, deliverOn, deliverOn.AddDays(1), "مشرف الضيافة", "مشرف", null, null, lines);

            // The Indian worker has no package: a special price with a reason is required.
            Assert.Equal("validation.delivery_no_price", (await service.CreateAsync(Input(new DeliveryLineInput(first, null, null, null), new DeliveryLineInput(second, null, null, null)), default)).Error.Code);
            Assert.Equal("validation.delivery_special_reason", (await service.CreateAsync(Input(new DeliveryLineInput(second, null, 3200m, null)), default)).Error.Code);
            Assert.Equal("validation.delivery_worker_unavailable", (await service.CreateAsync(Input(new DeliveryLineInput(busyWorker, null, 3000m, "x")), default)).Error.Code);
            Assert.Equal("validation.delivery_delay_reason",
                (await service.CreateAsync(Input(new DeliveryLineInput(first, null, null, null)) with { DeliverOn = deliverOn.AddDays(-5), StartOn = deliverOn }, default)).Error.Code);

            // Saved: under preparation, and the default process starts at once (created for the company on first use).
            var created = await service.CreateAsync(
                Input(new DeliveryLineInput(first, deliverOn.AddDays(2), null, null), new DeliveryLineInput(second, null, 3200m, "اتفاق مع العميل")), default);
            Assert.True(created.IsSuccess, created.IsFailure ? created.Error.Code : null);
            Assert.Null(created.Value.ApprovalError);
            orderId = created.Value.Id;

            // A worker on an open order cannot be on another one.
            Assert.Equal("conflict.delivery_worker_busy", (await service.CreateAsync(Input(new DeliveryLineInput(first, null, null, null)), default)).Error.Code);
        }

        using (var scope = database.Scope(tenantId, user: creator.ToString()))
        {
            var detail = (await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().GetAsync(orderId, default))!;
            Assert.Equal(("UnderPreparation", true, 2), (detail.Summary.Status, detail.AwaitingApproval, detail.Lines.Count));
            Assert.StartsWith("DO-", detail.Summary.OrderNo, StringComparison.Ordinal);
            var packaged = detail.Lines.Single(l => l.WorkerNo == "BSS0001");
            Assert.Equal(("PKG-00001", 3000m, false, true), (packaged.PackageNo, packaged.TotalPrice, packaged.IsSpecialPrice, packaged.HousingBillable));
            var special = detail.Lines.Single(l => l.WorkerNo == "BSS0002");
            Assert.Equal((3200m, true, null), (special.TotalPrice, special.IsSpecialPrice, special.PackageNo));
            Assert.Equal("تأكيد منشئ أمر التسليم", detail.Approval!.CurrentStepAr);

            // 1. The creator confirms their own order: sent to the operations manager.
            await DecideAsync(scope, creator, "موافق");
        }

        using (var scope = database.Scope(tenantId, user: operationsManager.ToString()))
        {
            var detail = (await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().GetAsync(orderId, default))!;
            Assert.Equal(("SentToOperationsManager", "اعتماد مدير العمليات"), (detail.Summary.Status, detail.Approval!.CurrentStepAr));
            Assert.False(detail.CanEdit);

            // 2. The operations manager approves: delivered.
            await DecideAsync(scope, operationsManager, "تم");
        }

        using (var scope = database.Scope(tenantId))
        {
            var detail = (await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().GetAsync(orderId, default))!;
            Assert.Equal(("Delivered", false), (detail.Summary.Status, detail.AwaitingApproval));
            Assert.Equal([deliverOn.AddDays(2), deliverOn.AddDays(1)], detail.Lines.Select(l => l.StartedOn!.Value));

            // Each worker now has an open work period on the project, with the line's price.
            var ledger = scope.ServiceProvider.GetRequiredService<IPeriodLedger>();
            var period = (await ledger.PeriodsAsync(first, default)).Single();
            Assert.Equal(("Work", "مشروع الرياض", deliverOn.AddDays(2), (DateOnly?)null, 3000m, detail.Summary.OrderNo),
                (period.Kind, period.ProjectName, period.StartsOn, period.EndsOn, period.TotalPrice, period.SourceNo));
            Assert.Equal((3200m, true), ((await ledger.PeriodsAsync(second, default)).Single().TotalPrice, (await ledger.PeriodsAsync(second, default)).Single().IsSpecialPrice));

            // The worker's file shows them on the job from the ledger, with the old system's status beside it.
            var file = (await scope.ServiceProvider.GetRequiredService<WorkerQueries>().GetAsync(first, WorkerKind.Worker, false, default))!.Summary;
            Assert.Equal(("Working", true, "مشروع الرياض", deliverOn.AddDays(2), "في السكن"),
                (file.Placement, file.FromLedger, file.ProjectName, file.ProjectJoinedOn, file.CrmStatusAr));
            var counts = (await scope.ServiceProvider.GetRequiredService<WorkerQueries>().ListAsync(
                new WorkerFilter(WorkerKind.Worker, null, "Working", null, false, 1, 50), false, default));
            Assert.Equal(3, counts.Total); // the two delivered here and the one on the job in the old system

            // On the job here: no longer available for another delivery order.
            var available = await scope.ServiceProvider.GetRequiredService<IWorkforceDirectory>().AvailableAsync(default);
            Assert.DoesNotContain(available, w => w.Id == first || w.Id == second);

            var list = await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().ListAsync(new DeliveryListFilter(null, "delivered", null, null, true, 1, 50), default);
            Assert.Equal(2, list.Totals.Delivered);
        }

        // An administrator running a process on a delivered order is refused by the order.
        using (var scope = database.Scope(tenantId, user: operationsManager.ToString()))
        {
            var workflow = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
            var process = await workflow.Processes.SingleAsync(p => p.Screen == DeliveryOrderAdapter.ScreenCode);
            Assert.Equal("اعتماد أمر التسليم", process.NameAr);
            var run = await scope.ServiceProvider.GetRequiredService<ApprovalEngine>().SubmitAsync(
                new ApprovalSubmission(DeliveryOrderAdapter.ScreenCode, orderId, "x", null, process.Id), default);
            Assert.Equal("conflict.delivery_not_startable", run.Error.Code);
        }
    }

    [SkippableFact]
    public async Task A_stage_without_approver_stops_and_running_the_process_again_replaces_the_stopped_approval()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var philippines = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        var labour = crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        crm.Add("new_project", new() { ["new_name"] = "مشروع جدة", ["new_code"] = "pro00500", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: Created2025);
        Worker(crm, "BSS0101", philippines, labour, 279640001, null);
        await SyncAndImportAsync(tenantId, crm);

        // Nobody holds the operations manager's permission (and the company has no other administrator).
        var (creator, _) = await PeopleAsync(tenantId, withManager: false);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        Guid orderId;
        using (var scope = database.Scope(tenantId, user: creator.ToString()))
        {
            var projectId = (await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().ProjectsAsync(default)).Single().Id;
            var worker = (await scope.ServiceProvider.GetRequiredService<IWorkforceDirectory>().AvailableAsync(default)).Single().Id;
            var saved = await scope.ServiceProvider.GetRequiredService<DeliveryOrderService>().CreateAsync(
                new DeliveryInput(projectId, today, today, "مستلم", null, null, null, [new DeliveryLineInput(worker, null, 3000m, "اختبار")]), default);
            orderId = saved.Value.Id;
            await DecideAsync(scope, creator, "موافق");
        }

        using (var scope = database.Scope(tenantId, user: creator.ToString()))
        {
            var detail = (await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().GetAsync(orderId, default))!;
            Assert.Equal(("SentToOperationsManager", "Failed"), (detail.Summary.Status, detail.Approval!.Status));

            // Running the process again cancels the stopped approval and starts from the beginning.
            var workflow = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
            var process = await workflow.Processes.SingleAsync(p => p.Screen == DeliveryOrderAdapter.ScreenCode);
            var run = await scope.ServiceProvider.GetRequiredService<ApprovalEngine>().RunOnRecordAsync(
                new ApprovalSubmission(DeliveryOrderAdapter.ScreenCode, orderId, "x", null, process.Id), default);
            Assert.True(run.IsSuccess, run.IsFailure ? run.Error.Code : null);
        }

        using (var scope = database.Scope(tenantId, user: creator.ToString()))
        {
            var detail = (await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().GetAsync(orderId, default))!;
            Assert.Equal(("UnderPreparation", true, "InProgress"), (detail.Summary.Status, detail.AwaitingApproval, detail.Approval!.Status));
            Assert.Equal("تأكيد منشئ أمر التسليم", detail.Approval.CurrentStepAr);
        }
    }

    [SkippableFact]
    public async Task A_return_order_goes_through_sales_and_the_operations_manager_and_puts_the_worker_in_housing()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var philippines = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        var labour = crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var project = crm.Add("new_project", new() { ["new_name"] = "مشروع الدمام", ["new_code"] = "pro00600", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: Created2025);
        var onJob = crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = "WORKER BSS0201", ["new_empidnumber"] = "BSS0201", ["new_idnumber"] = "2020100000", ["statuscode"] = 100000000, ["new_employeetype"] = 2,
            ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الدمام", ["new_projectjoingdate"] = "2025-12-31T21:00:00Z",
            ["new_nationalityid"] = philippines.ToString(), ["new_professionid"] = labour.ToString(), ["new_totalsalary"] = 1500m,
        }, created: Created2025);

        // An old housing order of the old system is copied read-only.
        crm.Add("mw_lodginorderdetails", new()
        {
            ["mw_name"] = "HO04306", ["mw_empid"] = onJob.ToString(), ["new_projectid"] = project.ToString(), ["statuscode"] = 100000009,
            ["new_entertype"] = 100000001, ["new_backreason"] = 279640000, ["mw_arrivedate"] = "2025-09-28T21:00:00Z", ["mw_housingname"] = "سكن الرجال-جدة",
        }, created: Created2025);
        await SyncAndImportAsync(tenantId, crm);

        Guid creator, sales, manager;
        using (var scope = database.Scope(tenantId, user: "setup"))
        {
            var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
            var catalog = scope.ServiceProvider.GetRequiredService<PermissionCatalog>();
            async Task<Guid> PersonAsync(string name, params string[] permissions)
            {
                var account = UserAccount.Create(name, null);
                identity.Users.Add(account);
                var membership = new Membership(account.Id, tenantId);
                identity.Memberships.Add(membership);
                var role = Role.Create($"r-{Guid.NewGuid():N}"[..20], name, name, ["operations.return.view", .. permissions], catalog).Value;
                identity.Roles.Add(role);
                identity.RoleAssignments.Add(new RoleAssignment(membership.Id, role.Id, null, tenantId));
                await identity.SaveChangesAsync();
                return account.Id;
            }

            creator = await PersonAsync("مشرف المشروع", "operations.return.create");
            sales = await PersonAsync("المبيعات", "operations.return.sales");
            manager = await PersonAsync("مدير العمليات", "operations.return.approve");
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
        Guid orderId, workerId;
        using (var scope = database.Scope(tenantId, user: creator.ToString()))
        {
            var queries = scope.ServiceProvider.GetRequiredService<ReturnOrderQueries>();
            var copied = (await queries.ListAsync(new DeliveryListFilter(null, null, "crm", null, true, 1, 50), default)).Items.Single();
            Assert.Equal(("HO04306", "Completed", "ClientNoReason", "مشروع الدمام"), (copied.OrderNo, copied.Status, copied.Reason, copied.ProjectName));

            var service = scope.ServiceProvider.GetRequiredService<ReturnOrderService>();
            var worker = (await service.OnJobAsync(null, default)).Single();
            Assert.Equal(("مشروع الدمام", new DateOnly(2026, 1, 1)), (worker.Worker.ProjectName, worker.Worker.ProjectJoinedOn));
            workerId = worker.Worker.Id;

            Assert.Equal("validation.return_reason_notes", (await service.CreateAsync(new ReturnInput(workerId, today, "Other", null, true, null, null, null), default)).Error.Code);
            Assert.Equal("validation.return_future", (await service.CreateAsync(new ReturnInput(workerId, today.AddDays(1), "Sick", null, true, null, null, null), default)).Error.Code);
            var saved = await service.CreateAsync(new ReturnInput(workerId, today, "WorkerRefuses", null, true, "سكن الرجال-جدة", null, null), default);
            Assert.True(saved.IsSuccess, saved.IsFailure ? saved.Error.Code : null);
            Assert.Null(saved.Value.ApprovalError);
            orderId = saved.Value.Id;
            Assert.Equal("conflict.return_worker_busy", (await service.CreateAsync(new ReturnInput(workerId, today, "Sick", null, true, null, null, null), default)).Error.Code);

            // 1. The creator confirms.
            await DecideAsync(scope, creator, "موافق");
        }

        using (var scope = database.Scope(tenantId, user: sales.ToString()))
        {
            var detail = (await scope.ServiceProvider.GetRequiredService<ReturnOrderQueries>().GetAsync(orderId, default))!;
            Assert.Equal(("SentToSales", "المبيعات: رغبة العميل"), (detail.Summary.Status, detail.Approval!.CurrentStepAr));

            // 2. Sales record the customer's wish (a required field of their stage).
            await DecideAsync(scope, sales, "العميل يريد بديلًا", new Dictionary<string, string?> { ["customer_wish"] = "Replace" });
        }

        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var detail = (await scope.ServiceProvider.GetRequiredService<ReturnOrderQueries>().GetAsync(orderId, default))!;
            Assert.Equal(("SentToOperationsManager", "Replace"), (detail.Summary.Status, detail.Summary.CustomerWish));

            // 3. The operations manager approves: the worker is in housing.
            await DecideAsync(scope, manager, "تم");
        }

        using (var scope = database.Scope(tenantId))
        {
            var detail = (await scope.ServiceProvider.GetRequiredService<ReturnOrderQueries>().GetAsync(orderId, default))!;
            Assert.Equal("Completed", detail.Summary.Status);

            var period = (await scope.ServiceProvider.GetRequiredService<IPeriodLedger>().PeriodsAsync(workerId, default)).Single();
            Assert.Equal(("Housing", today, (DateOnly?)null, false, detail.Summary.OrderNo), (period.Kind, period.StartsOn, period.EndsOn, period.PaySalary, period.SourceNo));

            // In housing here (the old system still says on the job): available for a delivery order again.
            var file = (await scope.ServiceProvider.GetRequiredService<WorkerQueries>().GetAsync(workerId, WorkerKind.Worker, false, default))!.Summary;
            Assert.Equal(("Housing", true, "على رأس العمل"), (file.Placement, file.FromLedger, file.CrmStatusAr));
            Assert.Contains(await scope.ServiceProvider.GetRequiredService<IWorkforceDirectory>().AvailableAsync(default), w => w.Id == workerId);
            Assert.DoesNotContain(await scope.ServiceProvider.GetRequiredService<IWorkforceDirectory>().OnJobAsync(default), w => w.Id == workerId);
        }
    }

    /// <summary>The user's open approval task on the order, approved.</summary>
    private static async Task DecideAsync(IServiceScope scope, Guid userId, string comment, IReadOnlyDictionary<string, string?>? fields = null)
    {
        var workflow = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
        var task = await workflow.WorkItems.SingleAsync(w => w.AssigneeUserId == userId && w.Status == WorkItemStatus.Pending);
        var decided = await scope.ServiceProvider.GetRequiredService<ApprovalEngine>().DecideAsync(task.Id, Decision.Approve, comment, fields, default);
        Assert.True(decided.IsSuccess, decided.IsFailure ? decided.Error.Code : null);
    }

    /// <summary>Two members of the company: a creator of delivery orders and an operations manager (approve permission).</summary>
    private async Task<(Guid Creator, Guid OperationsManager)> PeopleAsync(Guid tenantId, bool withManager = true)
    {
        using var scope = database.Scope(tenantId, user: "setup");
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<PermissionCatalog>();
        async Task<Guid> PersonAsync(string name, string role, params string[] permissions)
        {
            var user = UserAccount.Create(name, null);
            identity.Users.Add(user);
            var membership = new Membership(user.Id, tenantId);
            identity.Memberships.Add(membership);
            var created = Role.Create($"{role}-{Guid.NewGuid():N}"[..20], role, role, ["operations.delivery.view", "operations.return.view", .. permissions], catalog);
            identity.Roles.Add(created.Value);
            identity.RoleAssignments.Add(new RoleAssignment(membership.Id, created.Value.Id, null, tenantId));
            await identity.SaveChangesAsync();
            return user.Id;
        }

        var creator = await PersonAsync("منشئ الأمر", "sales", "operations.delivery.create");
        return (creator, withManager ? await PersonAsync("مدير العمليات", "operations", "operations.delivery.approve") : Guid.Empty);
    }

    private static Guid Worker(FakeCrm crm, string number, Guid nationality, Guid profession, int status, Guid? project) =>
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {number}", ["new_empidnumber"] = number, ["new_idnumber"] = $"2{number[3..]}00000",
            ["statuscode"] = status, ["new_employeetype"] = 2, ["new_projectid"] = project?.ToString(),
            ["new_nationalityid"] = nationality.ToString(), ["new_professionid"] = profession.ToString(), ["new_totalsalary"] = 1500m,
        }, created: Created2025);

    private async Task<Guid> CreateCompanyAsync()
    {
        using var scope = database.Scope(system: true);
        var code = $"do-{Guid.NewGuid():N}"[..16];
        return (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(code, "شركة التسليم", "Delivery Co", default)).Value.Id;
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
