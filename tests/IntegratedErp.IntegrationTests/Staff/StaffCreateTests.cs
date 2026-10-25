using ClosedXML.Excel;
using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Staff.Application;
using IntegratedErp.Modules.Staff.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Staff;

[Collection(DatabaseTestGroup.Name)]
public sealed class StaffCreateTests(TestDatabase database)
{
    [SkippableFact]
    public async Task New_employees_are_checked_first_then_created_together_with_their_job_nationality_and_salary()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"sc-{Guid.NewGuid():N}"[..16], "شركة التعيين", "Hire Co", default)).Value.Id;
        }

        using (var scope = database.Scope(tenantId, user: "setup"))
        {
            await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateLegalEntityAsync("CP05", "كير برو 05", "Care-Pro 05", "1010202020", null, default);
        }

        // The nationalities come from the old system's list.
        var crm = new FakeCrm();
        var egyptCrm = crm.Add(CrmEntities.Country, new() { ["new_name"] = "مصر", ["new_nameenglish"] = "Egypt" });
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = "WORKER BSS0900", ["new_empidnumber"] = "BSS000900", ["new_idnumber"] = "2090000000", ["statuscode"] = 100000000, ["new_employeetype"] = 2,
            ["new_nationalityid"] = egyptCrm.ToString(),
        }, created: new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        await SyncAsync(tenantId, crm);

        using var scope2 = database.Scope(tenantId, user: "hr");
        var structure = scope2.ServiceProvider.GetRequiredService<StructureService>();
        var finance = (await structure.SaveDepartmentAsync(null, new DepartmentInput("المالية", "Finance", null, "CC-200", null, 1), default)).Value;
        var accountant = (await structure.SaveJobTitleAsync(null, new JobTitleInput("محاسب", "Accountant", null), default)).Value;
        await structure.SavePositionAsync(null, new PositionInput(finance, accountant, null, null, 2), default);

        var service = scope2.ServiceProvider.GetRequiredService<StaffCreateService>();
        var options = await service.OptionsAsync(default);
        Assert.Equal(2, options.Departments.Single().Positions.Single().Free);
        var egypt = options.Nationalities.Single();

        // A sheet from the template: names as in the lists; a wrong nationality, a missing salary, and a third accountant
        // for two seats.
        using var book = new XLWorkbook(new MemoryStream(await service.TemplateAsync(default)));
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

        var hired = new DateTime(2026, 11, 1);
        Row(2, "AHMED ALI", "أحمد علي", egypt.NameAr, "2100000001", hired, null, "كير برو 05", "المالية", "محاسب", 5000m, 1250m);
        Row(3, "SAMY ADEL", null, "جنسية غير موجودة", null, hired, null, "كير برو 05", "المالية", "محاسب");
        Row(4, "OMAR SAID", null, egypt.NameEn, null, hired, null, "كير برو 05", "المالية", "Accountant", 4000m);
        using var sheet = new MemoryStream();
        book.SaveAs(sheet);
        sheet.Position = 0;
        var read = await service.ReadAsync(sheet, default);
        Assert.True(read.IsSuccess);
        var rows = read.Value;
        Assert.Empty(rows[0].Issues);
        Assert.Equal([("nationality", "unknown"), ("basic", "required")], rows[1].Issues.Select(i => (i.Field, i.Code)));
        Assert.Equal([("position", "full")], rows[2].Issues.Select(i => (i.Field, i.Code)));

        // Nothing is created while a row is wrong; fixed (the nationality picked, a salary, the third row left out), all are.
        Assert.Empty((await service.CreateAsync(rows.Select(r => r.Input).ToList(), default)).Value.Created);
        var created = await service.CreateAsync([rows[0].Input, rows[1].Input with { Nationality = rows[0].Input.Nationality, Basic = 4500m }], default);
        Assert.Equal(2, created.Value.Created.Count);

        var db = scope2.ServiceProvider.GetRequiredService<StaffDbContext>();
        var ahmed = await db.Employees.SingleAsync(e => e.Id == created.Value.Created[0].Id);
        Assert.Equal((egypt.NameEn, "2100000001", finance), (ahmed.NationalityEn, ahmed.IdNumber, ahmed.DepartmentId!.Value));
        var salary = await db.Salaries.SingleAsync(x => x.EmployeeId == ahmed.Id);
        Assert.Equal((5000m, 1250m), (salary.Basic, salary.Housing));

        // The seats are now taken: a third accountant is refused.
        Assert.Equal([("position", "full")], (await service.CheckAsync([rows[2].Input], default)).Single().Issues.Select(i => (i.Field, i.Code)));
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
