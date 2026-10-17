using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.Commercial.Application;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Operations.Application;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workflow.Contracts;
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

        var deliverOn = DateOnly.FromDateTime(DateTime.UtcNow);
        Guid orderId;
        using (var scope = database.Scope(tenantId))
        {
            var service = scope.ServiceProvider.GetRequiredService<DeliveryOrderService>();
            DeliveryInput Input(params DeliveryLineInput[] lines) => new(projectId, deliverOn, deliverOn.AddDays(1), "مشرف الضيافة", "مشرف", null, null, lines);

            // The Indian worker has no package: a special price with a reason is required.
            Assert.Equal("validation.delivery_no_price", (await service.CreateAsync(Input(new DeliveryLineInput(first, null, null, null), new DeliveryLineInput(second, null, null, null)), default)).Error.Code);
            Assert.Equal("validation.delivery_special_reason", (await service.CreateAsync(Input(new DeliveryLineInput(second, null, 3200m, null)), default)).Error.Code);
            Assert.Equal("validation.delivery_worker_unavailable", (await service.CreateAsync(Input(new DeliveryLineInput(busyWorker, null, 3000m, "x")), default)).Error.Code);
            Assert.Equal("validation.delivery_delay_reason",
                (await service.CreateAsync(Input(new DeliveryLineInput(first, null, null, null)) with { DeliverOn = deliverOn.AddDays(-5), StartOn = deliverOn }, default)).Error.Code);

            var created = await service.CreateAsync(Input(new DeliveryLineInput(first, null, null, null), new DeliveryLineInput(second, null, 3200m, "اتفاق مع العميل")), default);
            Assert.True(created.IsSuccess, created.IsFailure ? created.Error.Code : null);
            orderId = created.Value;

            // A worker on an open order cannot be on another one.
            Assert.Equal("conflict.delivery_worker_busy", (await service.CreateAsync(Input(new DeliveryLineInput(first, null, null, null)), default)).Error.Code);

            // No approval process is set up for delivery orders: the order stays a draft.
            Assert.Equal("validation.approval_no_process", (await service.SubmitAsync(orderId, default)).Error.Code);
        }

        using (var scope = database.Scope(tenantId))
        {
            var detail = (await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().GetAsync(orderId, default))!;
            Assert.Equal(("Draft", 2), (detail.Summary.Status, detail.Lines.Count));
            Assert.StartsWith("DO-", detail.Summary.OrderNo, StringComparison.Ordinal);
            var packaged = detail.Lines.Single(l => l.WorkerNo == "BSS0001");
            Assert.Equal(("PKG-00001", 3000m, false, true), (packaged.PackageNo, packaged.TotalPrice, packaged.IsSpecialPrice, packaged.HousingBillable));
            var special = detail.Lines.Single(l => l.WorkerNo == "BSS0002");
            Assert.Equal((3200m, true, null), (special.TotalPrice, special.IsSpecialPrice, special.PackageNo));

            // The approval engine sends it, then approves it.
            var db = scope.ServiceProvider.GetRequiredService<OperationsDbContext>();
            var order = await db.DeliveryOrders.Include(o => o.Lines).SingleAsync(o => o.Id == orderId);
            Assert.True(order.MarkSubmitted(DateTimeOffset.UtcNow).IsSuccess);
            await db.SaveChangesAsync();
            var adapter = scope.ServiceProvider.GetServices<IApprovalRecordAdapter>().Single(a => a.Screen.Code == DeliveryOrderAdapter.ScreenCode);
            var fields = await adapter.ReadAsync(orderId, default);
            Assert.Equal(("2", "6200.00", "true"), (fields!["workers"], fields["total_price"], fields["has_special_price"]));
            await adapter.EndedAsync(orderId, ApprovalEnd.Approved, "موافق", default);
        }

        using (var scope = database.Scope(tenantId))
        {
            var service = scope.ServiceProvider.GetRequiredService<DeliveryOrderService>();
            var lines = (await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().GetAsync(orderId, default))!.Lines;
            Assert.Equal("validation.delivery_start_before",
                (await service.ConfirmAsync(orderId, new ConfirmInput([new(lines[0].Id, deliverOn.AddDays(-1))]), default)).Error.Code);
            Assert.True((await service.ConfirmAsync(orderId, new ConfirmInput([new(lines[0].Id, deliverOn.AddDays(2))]), default)).IsSuccess);

            var detail = (await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().GetAsync(orderId, default))!;
            Assert.Equal("Delivered", detail.Summary.Status);
            Assert.Equal([deliverOn.AddDays(2), deliverOn.AddDays(1)], detail.Lines.Select(l => l.StartedOn!.Value));

            // Delivered: the workers are free for a new order again.
            var list = await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().ListAsync(new DeliveryListFilter(null, "delivered", null, null, true, 1, 50), default);
            Assert.Equal(2, list.Totals.Delivered);
        }
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
