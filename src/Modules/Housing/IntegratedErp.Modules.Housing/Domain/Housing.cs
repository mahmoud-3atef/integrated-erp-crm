using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Housing.Domain;

/// <summary>Who provides the building.</summary>
public enum BuildingType
{
    /// <summary>Owned or run by the company.</summary>
    Company,

    /// <summary>Rented by the company.</summary>
    Rented,

    /// <summary>A project's (the customer's) housing for its workers.</summary>
    Project,
}

/// <summary>A building the company houses workers in; its rooms hold the workers.</summary>
public sealed class Building : ITenantOwned
{
    private Building()
    {
        Name = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Name { get; private set; }

    public BuildingType Type { get; private set; }

    public string? City { get; private set; }

    public string? Address { get; private set; }

    /// <summary>The project whose housing this is (project housing only).</summary>
    public Guid? ProjectId { get; private set; }

    public string? ProjectName { get; private set; }

    public string? Notes { get; private set; }

    public bool IsActive { get; private set; } = true;

    public DateTimeOffset CreatedAt { get; private set; }

    public static Result<Building> Create(BuildingValues values, DateTimeOffset at)
    {
        var building = new Building { Id = Guid.CreateVersion7(), CreatedAt = at };
        var set = building.Set(values);
        return set.IsFailure ? Result.Failure<Building>(set.Error) : Result.Success(building);
    }

    public Result Update(BuildingValues values) => Set(values);

    public void SetActive(bool active) => IsActive = active;

    private Result Set(BuildingValues v)
    {
        if (string.IsNullOrWhiteSpace(v.Name))
        {
            return Result.Failure(HousingErrors.BuildingName);
        }

        if (v.Type == BuildingType.Project && v.ProjectId is null)
        {
            return Result.Failure(HousingErrors.BuildingProject);
        }

        Name = v.Name.Trim();
        Type = v.Type;
        City = Clean(v.City);
        Address = Clean(v.Address);
        ProjectId = v.Type == BuildingType.Project ? v.ProjectId : null;
        ProjectName = v.Type == BuildingType.Project ? Clean(v.ProjectName) : null;
        Notes = Clean(v.Notes);
        return Result.Success();
    }

    internal static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();
}

public sealed record BuildingValues(string Name, BuildingType Type, string? City, string? Address, Guid? ProjectId, string? ProjectName, string? Notes);

/// <summary>A room (or flat) of a building, holding up to <see cref="Capacity"/> workers.</summary>
public sealed class Room : ITenantOwned
{
    private Room()
    {
        Number = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid BuildingId { get; private set; }

    /// <summary>The room's number or name (ROOM 10, FLAT NO. 2).</summary>
    public string Number { get; private set; }

    public string? Floor { get; private set; }

    /// <summary>How many workers the room holds (its beds).</summary>
    public int Capacity { get; private set; }

    public string? Notes { get; private set; }

    public bool IsActive { get; private set; } = true;

    public static Result<Room> Create(Guid buildingId, RoomValues values)
    {
        var room = new Room { Id = Guid.CreateVersion7(), BuildingId = buildingId };
        var set = room.Set(values, 0);
        return set.IsFailure ? Result.Failure<Room>(set.Error) : Result.Success(room);
    }

    /// <summary>Changes the room; its capacity cannot go below the workers in it now.</summary>
    public Result Update(RoomValues values, int occupied) => Set(values, occupied);

    public Result SetActive(bool active, int occupied)
    {
        if (!active && occupied > 0)
        {
            return Result.Failure(HousingErrors.RoomOccupied);
        }

        IsActive = active;
        return Result.Success();
    }

    private Result Set(RoomValues v, int occupied)
    {
        if (string.IsNullOrWhiteSpace(v.Number))
        {
            return Result.Failure(HousingErrors.RoomNumber);
        }

        if (v.Capacity is < 1 or > 500)
        {
            return Result.Failure(HousingErrors.Capacity);
        }

        if (v.Capacity < occupied)
        {
            return Result.Failure(HousingErrors.CapacityBelowOccupied);
        }

        Number = v.Number.Trim();
        Floor = Building.Clean(v.Floor);
        Capacity = v.Capacity;
        Notes = Building.Clean(v.Notes);
        return Result.Success();
    }
}

public sealed record RoomValues(string Number, string? Floor, int Capacity, string? Notes);

/// <summary>
/// A worker's stay in a room: from <see cref="StartsOn"/> to <see cref="EndsOn"/> (the first day no longer there),
/// open while the worker is in it. A worker is in one room at a time.
/// </summary>
public sealed class RoomAssignment : ITenantOwned
{
    private RoomAssignment()
    {
        WorkerNo = string.Empty;
        Name = string.Empty;
        SourceType = string.Empty;
        AssignedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid RoomId { get; private set; }

    public Guid WorkerId { get; private set; }

    public string WorkerNo { get; private set; }

    public string Name { get; private set; }

    public DateOnly StartsOn { get; private set; }

    public DateOnly? EndsOn { get; private set; }

    /// <summary>manual, or the document that housed the worker (return_order).</summary>
    public string SourceType { get; private set; }

    public string? SourceNo { get; private set; }

    public string AssignedByName { get; private set; }

    public DateTimeOffset AssignedAt { get; private set; }

    public bool IsOpen => EndsOn is null;

    public static RoomAssignment Open(Guid roomId, Guid workerId, string workerNo, string name, DateOnly from, string sourceType, string? sourceNo, string by, DateTimeOffset at) =>
        new()
        {
            Id = Guid.CreateVersion7(),
            RoomId = roomId,
            WorkerId = workerId,
            WorkerNo = workerNo,
            Name = name,
            StartsOn = from,
            SourceType = sourceType,
            SourceNo = sourceNo,
            AssignedByName = by,
            AssignedAt = at,
        };

    /// <summary>The worker left the room on the given day (a day before or on the start closes it at its start).</summary>
    public void Close(DateOnly on) => EndsOn = on > StartsOn ? on : StartsOn;

    /// <summary>The leaving was taken back: the stay goes on.</summary>
    public void Reopen() => EndsOn = null;
}

public static class HousingErrors
{
    public static readonly Error BuildingNotFound = Error.NotFound("building", "Building not found.");
    public static readonly Error RoomNotFound = Error.NotFound("room", "Room not found.");
    public static readonly Error BuildingName = Error.Validation("housing_building_name", "Enter the building's name.");
    public static readonly Error BuildingProject = Error.Validation("housing_building_project", "Choose the project whose housing this is.");
    public static readonly Error BuildingDuplicate = Error.Conflict("housing_building_duplicate", "There is already a building with this name.");
    public static readonly Error RoomNumber = Error.Validation("housing_room_number", "Enter the room's number.");
    public static readonly Error RoomDuplicate = Error.Conflict("housing_room_duplicate", "The building already has a room with this number.");
    public static readonly Error Capacity = Error.Validation("housing_room_capacity", "The capacity is between 1 and 500.");
    public static readonly Error CapacityBelowOccupied = Error.Validation("housing_room_capacity_below", "The capacity cannot be less than the workers in the room now.");
    public static readonly Error RoomOccupied = Error.Conflict("housing_room_occupied", "Move the workers out of the room first.");
    public static readonly Error RoomInactive = Error.Validation("housing_room_inactive", "The room or its building is not in use.");
    public static readonly Error RoomFull = Error.Conflict("housing_room_full", "The room is full.");
    public static readonly Error NotInHousing = Error.Validation("housing_worker_not_in_housing", "The worker is not in housing.");
    public static readonly Error BeforeStay = Error.Validation("housing_before_stay", "The date is before the worker's stay in their current room.");
    public static readonly Error SameRoom = Error.Validation("housing_same_room", "The worker is already in this room.");
}
