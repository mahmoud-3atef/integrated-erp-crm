using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Housing.Contracts;
using IntegratedErp.Modules.Housing.Domain;
using IntegratedErp.Modules.Housing.Infrastructure;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Housing.Application;

public sealed record BuildingInput(string Name, string Type, string? City, string? Address, Guid? ProjectId, string? Notes);

public sealed record RoomInput(string Number, string? Floor, int Capacity, string? Notes);

public sealed record AssignInput(Guid WorkerId, Guid RoomId, DateOnly? From);

/// <summary>
/// The company's housing: buildings and their rooms, and which worker (in housing) is in which room. A room holds up
/// to its capacity; a worker leaving housing frees their room.
/// </summary>
internal sealed class HousingService(HousingDbContext db, IWorkforceDirectory workforce, IProjectDirectory projects, ICurrentUser user, IClock clock) : IHousingRooms
{
    public async Task<Result<Guid>> CreateBuildingAsync(BuildingInput input, CancellationToken cancellationToken)
    {
        var values = await ValuesAsync(input, cancellationToken).ConfigureAwait(false);
        if (values.IsFailure)
        {
            return Result.Failure<Guid>(values.Error);
        }

        if (await NameTakenAsync(values.Value.Name, null, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(HousingErrors.BuildingDuplicate);
        }

        var building = Building.Create(values.Value, clock.UtcNow);
        if (building.IsFailure)
        {
            return Result.Failure<Guid>(building.Error);
        }

        db.Buildings.Add(building.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(building.Value.Id);
    }

    public async Task<Result> UpdateBuildingAsync(Guid id, BuildingInput input, CancellationToken cancellationToken)
    {
        var building = await db.Buildings.FirstOrDefaultAsync(b => b.Id == id, cancellationToken).ConfigureAwait(false);
        if (building is null)
        {
            return Result.Failure(HousingErrors.BuildingNotFound);
        }

        var values = await ValuesAsync(input, cancellationToken).ConfigureAwait(false);
        if (values.IsFailure)
        {
            return values;
        }

        if (await NameTakenAsync(values.Value.Name, id, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(HousingErrors.BuildingDuplicate);
        }

        var updated = building.Update(values.Value);
        if (updated.IsFailure)
        {
            return updated;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>Takes a building out of use (or back); only once nobody lives in it.</summary>
    public async Task<Result> SetBuildingActiveAsync(Guid id, bool active, CancellationToken cancellationToken)
    {
        var building = await db.Buildings.FirstOrDefaultAsync(b => b.Id == id, cancellationToken).ConfigureAwait(false);
        if (building is null)
        {
            return Result.Failure(HousingErrors.BuildingNotFound);
        }

        if (!active && await db.Assignments.AnyAsync(a => a.EndsOn == null && db.Rooms.Any(r => r.Id == a.RoomId && r.BuildingId == id), cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(HousingErrors.RoomOccupied);
        }

        building.SetActive(active);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result<Guid>> CreateRoomAsync(Guid buildingId, RoomInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!await db.Buildings.AnyAsync(b => b.Id == buildingId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(HousingErrors.BuildingNotFound);
        }

        if (await RoomTakenAsync(buildingId, input.Number, null, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(HousingErrors.RoomDuplicate);
        }

        var room = Room.Create(buildingId, new RoomValues(input.Number, input.Floor, input.Capacity, input.Notes));
        if (room.IsFailure)
        {
            return Result.Failure<Guid>(room.Error);
        }

        db.Rooms.Add(room.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(room.Value.Id);
    }

    public async Task<Result> UpdateRoomAsync(Guid id, RoomInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (room is null)
        {
            return Result.Failure(HousingErrors.RoomNotFound);
        }

        if (await RoomTakenAsync(room.BuildingId, input.Number, id, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(HousingErrors.RoomDuplicate);
        }

        var updated = room.Update(new RoomValues(input.Number, input.Floor, input.Capacity, input.Notes), await OccupiedAsync(id, cancellationToken).ConfigureAwait(false));
        if (updated.IsFailure)
        {
            return updated;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> SetRoomActiveAsync(Guid id, bool active, CancellationToken cancellationToken)
    {
        var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (room is null)
        {
            return Result.Failure(HousingErrors.RoomNotFound);
        }

        var set = room.SetActive(active, await OccupiedAsync(id, cancellationToken).ConfigureAwait(false));
        if (set.IsFailure)
        {
            return set;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>Houses a worker in a room from a day (today when not given), by hand.</summary>
    public Task<Result> AssignAsync(AssignInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        return AssignAsync(new RoomAssignRequest(input.WorkerId, input.RoomId, input.From ?? clock.Today, "manual", null), cancellationToken);
    }

    /// <summary>Takes a worker out of their room from a day (today when not given), e.g. moved to a hospital.</summary>
    public async Task<Result> UnassignAsync(Guid workerId, DateOnly? on, CancellationToken cancellationToken)
    {
        var open = await db.Assignments.FirstOrDefaultAsync(a => a.WorkerId == workerId && a.EndsOn == null, cancellationToken).ConfigureAwait(false);
        if (open is null)
        {
            return Result.Success();
        }

        var day = on ?? clock.Today;
        if (day < open.StartsOn)
        {
            return Result.Failure(HousingErrors.BeforeStay);
        }

        open.Close(day);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<IReadOnlyList<RoomInfo>> RoomsAsync(CancellationToken cancellationToken)
    {
        var occupied = await OccupancyAsync(cancellationToken).ConfigureAwait(false);
        return await db.Rooms.AsNoTracking()
            .Join(db.Buildings.AsNoTracking(), r => r.BuildingId, b => b.Id, (r, b) => new { Room = r, Building = b })
            .Where(x => x.Room.IsActive && x.Building.IsActive)
            .OrderBy(x => x.Building.Name).ThenBy(x => x.Room.Number)
            .Select(x => new { x.Room.Id, x.Room.BuildingId, x.Building.Name, x.Room.Number, x.Room.Capacity })
            .ToListAsync(cancellationToken).ConfigureAwait(false) is var rows
            ? rows.Select(r => new RoomInfo(r.Id, r.BuildingId, r.Name, r.Number, r.Capacity, occupied.GetValueOrDefault(r.Id), true)).ToList()
            : [];
    }

    public async Task<RoomInfo?> FindAsync(Guid roomId, CancellationToken cancellationToken)
    {
        var row = await db.Rooms.AsNoTracking().Where(r => r.Id == roomId)
            .Join(db.Buildings.AsNoTracking(), r => r.BuildingId, b => b.Id, (r, b) => new { r.Id, r.BuildingId, b.Name, r.Number, r.Capacity, Active = r.IsActive && b.IsActive })
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return row is null ? null : new RoomInfo(row.Id, row.BuildingId, row.Name, row.Number, row.Capacity, await OccupiedAsync(row.Id, cancellationToken).ConfigureAwait(false), row.Active);
    }

    public async Task<bool> UndoStayAsync(Guid workerId, string sourceType, string sourceNo, CancellationToken cancellationToken)
    {
        var stay = await db.Assignments.FirstOrDefaultAsync(
            a => a.WorkerId == workerId && a.EndsOn == null && a.SourceType == sourceType && a.SourceNo == sourceNo, cancellationToken).ConfigureAwait(false);
        if (stay is null)
        {
            return false;
        }

        db.Assignments.Remove(stay);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return true;
    }

    public async Task<Result> AssignAsync(RoomAssignRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var room = await FindAsync(request.RoomId, cancellationToken).ConfigureAwait(false);
        if (room is null)
        {
            return Result.Failure(HousingErrors.RoomNotFound);
        }

        if (!room.IsActive)
        {
            return Result.Failure(HousingErrors.RoomInactive);
        }

        var card = (await workforce.CardsAsync([request.WorkerId], cancellationToken).ConfigureAwait(false)) is [var only, ..] ? only : null;
        if (card is null || !card.Available)
        {
            return Result.Failure(HousingErrors.NotInHousing);
        }

        var open = await db.Assignments.FirstOrDefaultAsync(a => a.WorkerId == request.WorkerId && a.EndsOn == null, cancellationToken).ConfigureAwait(false);
        if (open is not null)
        {
            if (open.RoomId == request.RoomId)
            {
                return Result.Failure(HousingErrors.SameRoom);
            }

            if (request.From < open.StartsOn)
            {
                return Result.Failure(HousingErrors.BeforeStay);
            }
        }

        if (room.Occupied >= room.Capacity)
        {
            return Result.Failure(HousingErrors.RoomFull);
        }

        // Moving rooms: the stay in the old room ends the day the new one starts.
        open?.Close(request.From);
        db.Assignments.Add(RoomAssignment.Open(room.Id, card.Id, card.WorkerNo, card.Name, request.From, request.SourceType, request.SourceNo, user.DisplayName, clock.UtcNow));
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task ReleaseAsync(IReadOnlyList<Guid> workerIds, DateOnly on, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(workerIds);
        var ids = workerIds.ToList();
        var open = await db.Assignments.Where(a => ids.Contains(a.WorkerId) && a.EndsOn == null).ToListAsync(cancellationToken).ConfigureAwait(false);
        foreach (var assignment in open)
        {
            assignment.Close(on);
        }

        if (open.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    /// <summary>The workers in each room now.</summary>
    internal async Task<Dictionary<Guid, int>> OccupancyAsync(CancellationToken cancellationToken) =>
        await db.Assignments.AsNoTracking().Where(a => a.EndsOn == null).GroupBy(a => a.RoomId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken).ConfigureAwait(false);

    private Task<int> OccupiedAsync(Guid roomId, CancellationToken cancellationToken) =>
        db.Assignments.CountAsync(a => a.RoomId == roomId && a.EndsOn == null, cancellationToken);

    private async Task<Result<BuildingValues>> ValuesAsync(BuildingInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!Enum.TryParse<BuildingType>(input.Type, out var type))
        {
            return Result.Failure<BuildingValues>(Error.Validation("housing_building_type", "Choose the building's type."));
        }

        string? projectName = null;
        if (type == BuildingType.Project && input.ProjectId is { } projectId)
        {
            var project = await projects.FindAsync([projectId], [], cancellationToken).ConfigureAwait(false) is [var p, ..] ? p : null;
            if (project is null)
            {
                return Result.Failure<BuildingValues>(HousingErrors.BuildingProject);
            }

            projectName = project.Name;
        }

        return Result.Success(new BuildingValues(input.Name, type, input.City, input.Address, input.ProjectId, projectName, input.Notes));
    }

    private Task<bool> NameTakenAsync(string name, Guid? except, CancellationToken cancellationToken)
    {
        var trimmed = name.Trim();
        return db.Buildings.AnyAsync(b => b.Name == trimmed && b.Id != except, cancellationToken);
    }

    private Task<bool> RoomTakenAsync(Guid buildingId, string number, Guid? except, CancellationToken cancellationToken)
    {
        var trimmed = (number ?? string.Empty).Trim();
        return db.Rooms.AnyAsync(r => r.BuildingId == buildingId && r.Number == trimmed && r.Id != except, cancellationToken);
    }
}
