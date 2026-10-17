using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Housing.Contracts;

/// <summary>
/// Public surface of the Housing module: the company's housing (buildings and rooms with a capacity) and which worker
/// is in which room (docs/02-target-architecture/01 §7).
/// </summary>
public static class HousingContracts
{
    public const string ModuleName = "Housing";
}

/// <summary>A room for other modules' forms (e.g. the room a returned worker goes to).</summary>
public sealed record RoomInfo(Guid Id, Guid BuildingId, string BuildingName, string RoomNo, int Capacity, int Occupied, bool IsActive)
{
    public int Free => Math.Max(0, Capacity - Occupied);

    /// <summary>"Building — room".</summary>
    public string Label => $"{BuildingName} — {RoomNo}";
}

/// <summary>A worker housed in a room from a day, by a document (a return order) or by hand.</summary>
public sealed record RoomAssignRequest(Guid WorkerId, Guid RoomId, DateOnly From, string SourceType, string? SourceNo);

/// <summary>Which worker is in which room.</summary>
public interface IHousingRooms
{
    /// <summary>The active rooms with their occupancy, by building.</summary>
    Task<IReadOnlyList<RoomInfo>> RoomsAsync(CancellationToken cancellationToken);

    Task<RoomInfo?> FindAsync(Guid roomId, CancellationToken cancellationToken);

    /// <summary>
    /// Houses a worker (in housing) in a room from the given day, within the room's capacity; a worker in another room
    /// moves (their stay there ends that day).
    /// </summary>
    Task<Result> AssignAsync(RoomAssignRequest request, CancellationToken cancellationToken);

    /// <summary>The workers left housing on the given day (delivered, transferred out…): their rooms are free from then.</summary>
    Task ReleaseAsync(IReadOnlyList<Guid> workerIds, DateOnly on, CancellationToken cancellationToken);
}
