using IntegratedErp.Modules.Housing.Domain;
using IntegratedErp.Modules.Housing.Infrastructure;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Housing.Application;

public sealed record BuildingRowDto(
    Guid Id, string Name, string Type, string? City, string? Address, Guid? ProjectId, string? ProjectName, string? Notes, bool IsActive,
    int Rooms, int Capacity, int Occupied);

/// <summary>The housing page's cards: buildings, rooms, beds (capacity), occupied, free, and the workers in housing without a room.</summary>
public sealed record HousingTotalsDto(int Buildings, int Rooms, int Capacity, int Occupied, int InHousing, int WithoutRoom);

public sealed record HousingOverviewDto(HousingTotalsDto Totals, IReadOnlyList<BuildingRowDto> Buildings);

public sealed record OccupantDto(Guid AssignmentId, Guid WorkerId, string WorkerNo, string Name, DateOnly Since, string SourceType, string? SourceNo);

public sealed record RoomDto(Guid Id, string Number, string? Floor, int Capacity, string? Notes, bool IsActive, IReadOnlyList<OccupantDto> Occupants);

public sealed record BuildingDetailDto(BuildingRowDto Building, IReadOnlyList<RoomDto> Rooms);

/// <summary>A worker's stays in rooms, latest first.</summary>
public sealed record StayDto(Guid RoomId, string BuildingName, string RoomNo, DateOnly StartsOn, DateOnly? EndsOn, string SourceType, string? SourceNo);

internal sealed class HousingQueries(HousingDbContext db, IWorkforceDirectory workforce)
{
    public async Task<HousingOverviewDto> OverviewAsync(CancellationToken cancellationToken)
    {
        var buildings = await RowsAsync(null, cancellationToken).ConfigureAwait(false);
        var inHousing = await workforce.AvailableAsync(cancellationToken).ConfigureAwait(false);
        var housed = await db.Assignments.AsNoTracking().Where(a => a.EndsOn == null).Select(a => a.WorkerId).ToListAsync(cancellationToken).ConfigureAwait(false);
        var active = buildings.Where(b => b.IsActive).ToList();
        return new HousingOverviewDto(
            new HousingTotalsDto(active.Count, active.Sum(b => b.Rooms), active.Sum(b => b.Capacity), active.Sum(b => b.Occupied),
                inHousing.Count, inHousing.Count(c => !housed.Contains(c.Id))),
            buildings);
    }

    public async Task<BuildingDetailDto?> BuildingAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = (await RowsAsync(id, cancellationToken).ConfigureAwait(false)) is [var only, ..] ? only : null;
        if (row is null)
        {
            return null;
        }

        var rooms = await db.Rooms.AsNoTracking().Where(r => r.BuildingId == id).OrderBy(r => r.Number).ToListAsync(cancellationToken).ConfigureAwait(false);
        var roomIds = rooms.Select(r => r.Id).ToList();
        var occupants = (await db.Assignments.AsNoTracking().Where(a => a.EndsOn == null && roomIds.Contains(a.RoomId)).OrderBy(a => a.WorkerNo)
                .ToListAsync(cancellationToken).ConfigureAwait(false))
            .ToLookup(a => a.RoomId);
        return new BuildingDetailDto(row, rooms
            .OrderBy(r => r.Number, StringComparer.OrdinalIgnoreCase)
            .Select(r => new RoomDto(r.Id, r.Number, r.Floor, r.Capacity, r.Notes, r.IsActive,
                occupants[r.Id].Select(a => new OccupantDto(a.Id, a.WorkerId, a.WorkerNo, a.Name, a.StartsOn, a.SourceType, a.SourceNo)).ToList()))
            .ToList());
    }

    /// <summary>The workers in housing (or new) who have no room yet, longest waiting first.</summary>
    public async Task<IReadOnlyList<WorkerCard>> WithoutRoomAsync(CancellationToken cancellationToken)
    {
        var inHousing = await workforce.AvailableAsync(cancellationToken).ConfigureAwait(false);
        var housed = (await db.Assignments.AsNoTracking().Where(a => a.EndsOn == null).Select(a => a.WorkerId).ToListAsync(cancellationToken).ConfigureAwait(false)).ToHashSet();
        return inHousing.Where(c => !housed.Contains(c.Id)).OrderBy(c => c.WorkerNo, StringComparer.Ordinal).ToList();
    }

    public async Task<IReadOnlyList<StayDto>> StaysAsync(Guid workerId, CancellationToken cancellationToken) =>
        await db.Assignments.AsNoTracking().Where(a => a.WorkerId == workerId)
            .Join(db.Rooms.AsNoTracking(), a => a.RoomId, r => r.Id, (a, r) => new { a, r })
            .Join(db.Buildings.AsNoTracking(), x => x.r.BuildingId, b => b.Id, (x, b) => new { x.a, x.r, b })
            .OrderByDescending(x => x.a.StartsOn).ThenByDescending(x => x.a.AssignedAt)
            .Select(x => new StayDto(x.r.Id, x.b.Name, x.r.Number, x.a.StartsOn, x.a.EndsOn, x.a.SourceType, x.a.SourceNo))
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    private async Task<List<BuildingRowDto>> RowsAsync(Guid? only, CancellationToken cancellationToken)
    {
        var buildings = await db.Buildings.AsNoTracking().Where(b => only == null || b.Id == only).OrderBy(b => b.Name).ToListAsync(cancellationToken).ConfigureAwait(false);
        var ids = buildings.Select(b => b.Id).ToList();
        var rooms = await db.Rooms.AsNoTracking().Where(r => ids.Contains(r.BuildingId) && r.IsActive)
            .Select(r => new { r.Id, r.BuildingId, r.Capacity }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var roomIds = rooms.Select(r => r.Id).ToList();
        var occupied = await db.Assignments.AsNoTracking().Where(a => a.EndsOn == null && roomIds.Contains(a.RoomId)).GroupBy(a => a.RoomId)
            .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken).ConfigureAwait(false);
        var byBuilding = rooms.ToLookup(r => r.BuildingId);
        return buildings.Select(b => new BuildingRowDto(
                b.Id, b.Name, b.Type.ToString(), b.City, b.Address, b.ProjectId, b.ProjectName, b.Notes, b.IsActive,
                byBuilding[b.Id].Count(), byBuilding[b.Id].Sum(r => r.Capacity), byBuilding[b.Id].Sum(r => occupied.GetValueOrDefault(r.Id))))
            .ToList();
    }
}
