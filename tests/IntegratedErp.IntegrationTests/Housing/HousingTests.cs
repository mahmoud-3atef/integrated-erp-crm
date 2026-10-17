using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Housing.Application;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Housing;

[Collection(DatabaseTestGroup.Name)]
public sealed class HousingTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task Workers_in_housing_are_put_in_rooms_up_to_their_capacity_and_leave_them_when_they_leave_housing()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var first = Worker(crm, "BSS0401", 279640001);
        Worker(crm, "BSS0402", 279640001);
        Worker(crm, "BSS0403", 1); // new
        Worker(crm, "BSS0404", 100000000); // on the job
        await SyncAsync(tenantId, crm);

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
        Guid buildingId, small, large;
        Dictionary<string, Guid> workers;
        using (var scope = database.Scope(tenantId))
        {
            var service = scope.ServiceProvider.GetRequiredService<HousingService>();
            Assert.Equal("validation.housing_building_project", (await service.CreateBuildingAsync(new BuildingInput("سكن مشروع", "Project", null, null, null, null), default)).Error.Code);
            buildingId = (await service.CreateBuildingAsync(new BuildingInput("سكن الرجال - جدة", "Company", "جدة", "حي الصفا", null, null), default)).Value;
            Assert.Equal("conflict.housing_building_duplicate", (await service.CreateBuildingAsync(new BuildingInput("سكن الرجال - جدة", "Rented", null, null, null, null), default)).Error.Code);
            small = (await service.CreateRoomAsync(buildingId, new RoomInput("ROOM 1", "1", 2, null), default)).Value;
            large = (await service.CreateRoomAsync(buildingId, new RoomInput("FLAT NO. 2", "2", 10, null), default)).Value;
            Assert.Equal("conflict.housing_room_duplicate", (await service.CreateRoomAsync(buildingId, new RoomInput("ROOM 1", null, 4, null), default)).Error.Code);
            Assert.Equal("validation.housing_room_capacity", (await service.CreateRoomAsync(buildingId, new RoomInput("ROOM 3", null, 0, null), default)).Error.Code);

            workers = (await scope.ServiceProvider.GetRequiredService<IWorkforceDirectory>().SearchAsync("BSS0401 BSS0402 BSS0403 BSS0404", 10, default))
                .ToDictionary(w => w.WorkerNo, w => w.Id);
            Assert.Equal(3, (await scope.ServiceProvider.GetRequiredService<HousingQueries>().WithoutRoomAsync(default)).Count);

            // Up to the room's capacity; a worker on the job cannot be housed.
            Assert.True((await service.AssignAsync(new AssignInput(workers["BSS0401"], small, today.AddDays(-10)), default)).IsSuccess);
            Assert.True((await service.AssignAsync(new AssignInput(workers["BSS0402"], small, null), default)).IsSuccess);
            Assert.Equal("conflict.housing_room_full", (await service.AssignAsync(new AssignInput(workers["BSS0403"], small, null), default)).Error.Code);
            Assert.Equal("validation.housing_worker_not_in_housing", (await service.AssignAsync(new AssignInput(workers["BSS0404"], large, null), default)).Error.Code);
            Assert.Equal("validation.housing_room_capacity_below", (await service.UpdateRoomAsync(small, new RoomInput("ROOM 1", "1", 1, null), default)).Error.Code);

            // Moving rooms ends the first stay the day the next one starts.
            Assert.True((await service.AssignAsync(new AssignInput(workers["BSS0401"], large, today.AddDays(-3)), default)).IsSuccess);
            Assert.True((await service.AssignAsync(new AssignInput(workers["BSS0403"], small, null), default)).IsSuccess);
        }

        using (var scope = database.Scope(tenantId))
        {
            var queries = scope.ServiceProvider.GetRequiredService<HousingQueries>();
            var overview = await queries.OverviewAsync(default);
            Assert.Equal((1, 2, 12, 3, 3, 0), (overview.Totals.Buildings, overview.Totals.Rooms, overview.Totals.Capacity, overview.Totals.Occupied, overview.Totals.InHousing, overview.Totals.WithoutRoom));
            var building = (await queries.BuildingAsync(buildingId, default))!;
            Assert.Equal(["BSS0402", "BSS0403"], building.Rooms.Single(r => r.Number == "ROOM 1").Occupants.Select(o => o.WorkerNo));
            var stays = await queries.StaysAsync(workers["BSS0401"], default);
            Assert.Equal([("FLAT NO. 2", today.AddDays(-3), (DateOnly?)null), ("ROOM 1", today.AddDays(-10), today.AddDays(-3))], stays.Select(s => (s.RoomNo, s.StartsOn, s.EndsOn)));
        }

        // The first worker goes to work in the old system: the next sync frees their room.
        crm.Touch(first, "statuscode", 100000000);
        await SyncAsync(tenantId, crm);
        using (var scope = database.Scope(tenantId))
        {
            var queries = scope.ServiceProvider.GetRequiredService<HousingQueries>();
            Assert.Equal((2, 2), ((await queries.OverviewAsync(default)).Totals.Occupied, (await queries.OverviewAsync(default)).Totals.InHousing));
            Assert.NotNull((await queries.StaysAsync(workers["BSS0401"], default))[0].EndsOn);
            Assert.Equal("conflict.housing_room_occupied", (await scope.ServiceProvider.GetRequiredService<HousingService>().SetRoomActiveAsync(small, false, default)).Error.Code);
        }
    }

    private static Guid Worker(FakeCrm crm, string number, int status) =>
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {number}", ["new_empidnumber"] = number, ["new_idnumber"] = $"2{number[3..]}00000",
            ["statuscode"] = status, ["new_employeetype"] = 2, ["new_totalsalary"] = 1500m,
        }, created: Created2025);

    private async Task<Guid> CreateCompanyAsync()
    {
        using var scope = database.Scope(system: true);
        var code = $"hs-{Guid.NewGuid():N}"[..16];
        return (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(code, "شركة السكن", "Housing Co", default)).Value.Id;
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
