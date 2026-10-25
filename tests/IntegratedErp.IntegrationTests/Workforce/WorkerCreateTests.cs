using ClosedXML.Excel;
using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workforce.Application;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Workforce;

[Collection(DatabaseTestGroup.Name)]
public sealed class WorkerCreateTests(TestDatabase database)
{
    [SkippableFact]
    public async Task New_workers_are_checked_first_then_created_together_after_the_highest_number_with_the_supplier_s_cost()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"wc-{Guid.NewGuid():N}"[..16], "شركة الإضافة", "Create Co", default)).Value.Id;
        }

        // The old system already has BSS000750 with iqama 2075000000.
        var crm = new FakeCrm();
        var philippines = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = "WORKER BSS0750", ["new_empidnumber"] = "BSS000750", ["new_idnumber"] = "2075000000", ["statuscode"] = 100000000, ["new_employeetype"] = 2,
            ["new_nationalityid"] = philippines.ToString(),
        }, created: new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        await SyncAsync(tenantId, crm);

        using var scope2 = database.Scope(tenantId, user: "hr");
        var service = scope2.ServiceProvider.GetRequiredService<WorkerCreateService>();
        var options = await service.OptionsAsync(default);
        Assert.Equal("BSS000751", options.NextNumber);
        Assert.Contains("IRC - 02", options.Sponsors);

        // A sheet from the template: names typed as in the lists, one wrong nationality, a supplier worker without a cost,
        // a taken iqama and a row without an identity number.
        var template = await service.TemplateAsync(default);
        using var book = new XLWorkbook(new MemoryStream(template));
        var ws = book.Worksheet(1);
        void Row(int r, params object?[] values)
        {
            for (var c = 0; c < values.Length; c++)
            {
                if (values[c] is { } v)
                {
                    ws.Cell(r, c + 1).Value = v switch { DateTime d => d, decimal m => m, _ => v.ToString() };
                }
            }
        }

        var arrived = new DateTime(2026, 9, 1);
        Row(2, "ALI ONE", null, "الفلبين", "عامل", null, "Care-Pro - 05", "2099000001", null, null, null, arrived, null, 1200m);
        Row(3, "ALI TWO", null, "فلبيني", "labour", null, "IRC - 02", "2099000002", null, null, null, arrived);
        Row(4, "ALI THREE", null, "Philippines", "عامل", null, "IRC - 02", "2075000000", null, null, null, arrived, null, null, null, null, null, null, 2500m);
        Row(5, "ALI FOUR", null, "Philippines", "عامل", null, "Care-Pro - 05", null, null, null, null, arrived);
        using var sheet = new MemoryStream();
        book.SaveAs(sheet);
        sheet.Position = 0;
        var read = await service.ReadAsync(sheet, default);
        Assert.True(read.IsSuccess);
        var rows = read.Value;
        Assert.Empty(rows[0].Issues);
        Assert.Equal([("nationality", "unknown"), ("cost", "cost_required")], rows[1].Issues.Select(i => (i.Field, i.Code)));
        Assert.Equal([("iqama", "taken")], rows[2].Issues.Select(i => (i.Field, i.Code)));
        Assert.Equal([("iqama", "identity_required")], rows[3].Issues.Select(i => (i.Field, i.Code)));

        // Nothing is created while a row is wrong.
        var refused = await service.CreateAsync(rows.Select(r => r.Input).ToList(), default);
        Assert.True(refused.IsSuccess);
        Assert.Empty(refused.Value.Created);

        // Fixed on the page: the nationality picked, the cost given, another iqama, a border number.
        var fixedRows = new List<NewWorkerInput>
        {
            rows[0].Input,
            rows[1].Input with { Nationality = rows[0].Input.Nationality, SupplierMonthlyCost = 2600m },
            rows[2].Input with { Iqama = "2099000003" },
            rows[3].Input with { BorderNumber = "3099000004" },
        };
        var created = await service.CreateAsync(fixedRows, default);
        Assert.True(created.IsSuccess);
        Assert.Equal(["BSS000751", "BSS000752", "BSS000753", "BSS000754"], created.Value.Created.Select(c => c.WorkerNo));

        var db = scope2.ServiceProvider.GetRequiredService<WorkforceDbContext>();
        var two = await db.Workers.SingleAsync(w => w.WorkerNo == "BSS000752");
        Assert.True(two.CreatedHere);
        Assert.Equal((Placement.New, "IRC - 02", new DateOnly(2026, 9, 1)), (two.Placement, two.Sponsor, two.ArrivedOn!.Value));
        var card = await db.CostCards.SingleAsync(c => c.WorkerId == two.Id);
        Assert.Equal((2600m, CostMethod.MonthlyFixed), (card.MonthlyCost, card.Method));
        Assert.Equal(1200m, (await db.Workers.SingleAsync(w => w.WorkerNo == "BSS000751")).Salary.Total);
        var ids = created.Value.Created.Select(x => x.Id).ToList();
        Assert.Equal(2, await db.CostCards.CountAsync(c => ids.Contains(c.WorkerId))); // the two IRC workers only

        // A later sync leaves the workers added here alone.
        await SyncAsync(tenantId, crm);
        using var after = database.Scope(tenantId);
        Assert.Equal(5, await after.ServiceProvider.GetRequiredService<WorkforceDbContext>().Workers.CountAsync(w => !w.RemovedInCrm));
    }

    private async Task SyncAsync(Guid tenantId, FakeCrm crm)
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
