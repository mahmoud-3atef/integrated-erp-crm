using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Organization.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.CrmSync;

[Collection(DatabaseTestGroup.Name)]
public sealed class CrmSyncTests(TestDatabase database)
{
    [SkippableFact]
    public async Task Sync_copies_the_crm_and_import_creates_each_nationality_and_profession_once()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var philippines = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_code"] = "173", ["new_nameenglish"] = "Philippines" });
        var philippinesCopy = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين ", ["new_code"] = "173", ["new_nameenglish"] = "Philippines" });
        var block = crm.Add(CrmEntities.Country, new() { ["new_name"] = "Block" });
        var labour = crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var labourCopy = crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115" });
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "مدير إدارة تطوير الأعمال" });
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "مدير ادارة تطوير الاعمال" });
        crm.Add(CrmEntities.Employee, new() { ["new_nationalityid"] = philippinesCopy.ToString(), ["new_professionid"] = labour.ToString() });
        crm.Add(CrmEntities.Employee, new() { ["new_nationalityid"] = block.ToString(), ["new_professionid"] = labourCopy.ToString() });

        // Full sync into staging.
        var first = await RunAsync(tenantId, crm, SyncMode.Full);
        Assert.Equal(nameof(SyncRunStatus.Succeeded), first.Status);
        Assert.Equal(9, await CountAsync(tenantId, r => !r.IsDeleted));

        // Import: one item per nationality / profession.
        using (var scope = database.Scope(tenantId))
        {
            var report = await scope.ServiceProvider.GetRequiredService<ReferenceImportService>().ImportAsync(default);
            Assert.True(report.IsSuccess, report.IsFailure ? report.Error.Message : null);
            Assert.Equal((3, 1, 1, 1, 1), (report.Value.Nationalities.CrmRecords, report.Value.Nationalities.Items, report.Value.Nationalities.Created, report.Value.Nationalities.Merged, report.Value.Nationalities.Unmapped));
            Assert.Equal((4, 2, 2, 2), (report.Value.Professions.CrmRecords, report.Value.Professions.Items, report.Value.Professions.Created, report.Value.Professions.Merged));
        }

        // Importing again creates nothing new and keeps every code.
        using (var scope = database.Scope(tenantId))
        {
            var again = await scope.ServiceProvider.GetRequiredService<ReferenceImportService>().ImportAsync(default);
            Assert.Equal((0, 1), (again.Value.Nationalities.Created, again.Value.Nationalities.AlreadyPresent));
            Assert.Equal((0, 2), (again.Value.Professions.Created, again.Value.Professions.AlreadyPresent));

            var nationalities = await scope.ServiceProvider.GetRequiredService<IReferenceData>().ListAsync(ReferenceListCodes.Nationalities, default);
            Assert.Equal(["PHL"], nationalities.Select(n => n.Code));
            var report = await scope.ServiceProvider.GetRequiredService<ReferenceImportService>().ReportAsync(ReferenceListCodes.Nationalities, default);
            Assert.Equal(new[] { philippines, philippinesCopy }.Order(), report.Items.Single().Records.Select(r => r.CrmId).Order());
            Assert.Equal(1, report.Items.Single().Usage);
            Assert.Equal(("Block", 1), (report.Unmapped.Single().CrmName, report.Unmapped.Single().Usage));
        }

        // Incremental: only what changed since the last run.
        crm.Touch(labour, "new_professionenglish", "Labourer");
        var incremental = await RunAsync(tenantId, crm, SyncMode.Incremental);
        var professions = incremental.Results.Single(r => r.Entity == CrmEntities.Profession);
        Assert.Equal((1, 0, 1), (professions.Read, professions.Inserted, professions.Updated));
        Assert.Equal(0, incremental.Results.Single(r => r.Entity == CrmEntities.Country).Read);

        // Full: a record deleted in the CRM is marked deleted here.
        crm.Remove(block);
        var full = await RunAsync(tenantId, crm, SyncMode.Full);
        Assert.Equal(1, full.Results.Single(r => r.Entity == CrmEntities.Country).Deleted);
        Assert.Equal(1, await CountAsync(tenantId, r => r.IsDeleted));

        // Another company sees none of it.
        var other = await CreateCompanyAsync();
        Assert.Equal(0, await CountAsync(other, _ => true));
    }

    [SkippableFact]
    public async Task A_merge_by_hand_moves_the_records_switches_the_item_off_and_survives_new_imports()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        crm.Add(CrmEntities.Country, new() { ["new_name"] = "مصر", ["new_nameenglish"] = "Egypt" });
        var block = crm.Add(CrmEntities.Country, new() { ["new_name"] = "Block" });
        var labour = crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var worker = crm.Add(CrmEntities.Profession, new() { ["new_name"] = "worker", ["new_code"] = "worker" });
        crm.Add(CrmEntities.Employee, new() { ["new_professionid"] = worker.ToString() });
        await RunAsync(tenantId, crm, SyncMode.Full);

        using (var scope = database.Scope(tenantId))
        {
            var service = scope.ServiceProvider.GetRequiredService<ReferenceImportService>();
            Assert.True((await service.ImportAsync(default)).IsSuccess);
            Assert.True((await service.MergeAsync(ReferenceListCodes.Professions, "WORKER", "6132115", default)).IsSuccess);
            Assert.True((await service.LinkAsync(ReferenceListCodes.Nationalities, block, "EGY", default)).IsSuccess);
            Assert.False((await service.MergeAsync(ReferenceListCodes.Professions, "6132115", "6132115", default)).IsSuccess);
            Assert.False((await service.LinkAsync(ReferenceListCodes.Nationalities, block, "XXX", default)).IsSuccess);
        }

        using (var scope = database.Scope(tenantId))
        {
            var service = scope.ServiceProvider.GetRequiredService<ReferenceImportService>();
            var again = await service.ImportAsync(default);
            Assert.Equal(0, again.Value.Professions.Created);

            var professions = await service.ReportAsync(ReferenceListCodes.Professions, default);
            var item = professions.Items.Single(i => i.Records.Count > 0);
            Assert.Equal("6132115", item.Code);
            Assert.Equal(new[] { labour, worker }.Order(), item.Records.Select(r => r.CrmId).Order());
            Assert.Equal(1, item.Usage);
            Assert.DoesNotContain(professions.Items, i => i.Code == "WORKER");

            var nationalities = await service.ReportAsync(ReferenceListCodes.Nationalities, default);
            Assert.Empty(nationalities.Unmapped);
            Assert.Equal(nameof(MatchRule.Manual), nationalities.Items.Single(i => i.Code == "EGY").Records.Single(r => r.CrmId == block).Rule);
        }
    }

    private async Task<Guid> CreateCompanyAsync()
    {
        using var scope = database.Scope(system: true);
        var code = $"crm-{Guid.NewGuid():N}"[..16];
        var created = await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(code, "شركة المزامنة", "Sync Co", default);
        return created.Value.Id;
    }

    private async Task<SyncRunDto> RunAsync(Guid tenantId, FakeCrm crm, SyncMode mode)
    {
        using var scope = database.Scope(tenantId, user: "crm-sync");
        var db = scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>();
        var service = ActivatorUtilities.CreateInstance<CrmSyncService>(scope.ServiceProvider, (ICrmSource)crm);
        var run = new SyncRun(mode, "test", DateTimeOffset.UtcNow);
        db.Runs.Add(run);
        await db.SaveChangesAsync();
        await service.RunAsync(run, default);
        return (await service.StatusAsync(default)).Runs.First(r => r.Id == run.Id);
    }

    private async Task<int> CountAsync(Guid tenantId, System.Linq.Expressions.Expression<Func<StagedRecord, bool>> filter)
    {
        using var scope = database.Scope(tenantId);
        return await scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>().Records.CountAsync(filter);
    }

    /// <summary>An in-memory CRM: records per entity with a modifiedon that moves forward on every change.</summary>
    private sealed class FakeCrm : ICrmSource
    {
        private readonly Dictionary<string, Dictionary<Guid, Dictionary<string, object?>>> _entities = [];
        private DateTime _clock = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        public Guid Add(string entity, Dictionary<string, object?> values)
        {
            var id = Guid.NewGuid();
            values["statecode"] = 0;
            values["createdon"] = _clock;
            values["modifiedon"] = _clock = _clock.AddSeconds(1);
            Records(entity)[id] = values;
            return id;
        }

        public void Touch(Guid id, string field, object? value)
        {
            var record = _entities.Values.Single(e => e.ContainsKey(id))[id];
            record[field] = value;
            record["modifiedon"] = _clock = _clock.AddSeconds(1);
        }

        public void Remove(Guid id) => _entities.Values.Single(e => e.ContainsKey(id)).Remove(id);

        public Task<IReadOnlyList<CrmRow>> ReadPageAsync(CrmEntity entity, DateTime? afterModifiedOn, Guid? afterId, int pageSize, CancellationToken cancellationToken)
        {
            // Same order and paging as the SQL source (Guid order differs, but ties never happen here).
            IReadOnlyList<CrmRow> page = Records(entity.Name)
                .Select(r => new CrmRow(r.Key, (DateTime)r.Value["modifiedon"]!, 0, r.Value))
                .Where(r => afterModifiedOn is null || r.ModifiedOn > afterModifiedOn || (r.ModifiedOn == afterModifiedOn && r.Id.CompareTo(afterId) > 0))
                .OrderBy(r => r.ModifiedOn).ThenBy(r => r.Id)
                .Take(pageSize)
                .ToList();
            return Task.FromResult(page);
        }

        private Dictionary<Guid, Dictionary<string, object?>> Records(string entity) =>
            _entities.TryGetValue(entity, out var records) ? records : _entities[entity] = [];
    }
}
