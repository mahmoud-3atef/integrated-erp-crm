using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

public sealed record MovementRowDto(
    Guid Id, string MovementNo, string Type, string Status, Guid WorkerId, string WorkerNo, string WorkerName, string FromPlacement, string? FromProjectName,
    string OpensPeriod, string? ProjectName, DateOnly EffectiveOn, string? VacationKind, string CreatedByName, DateTimeOffset CreatedAt);

public sealed record MovementTypeCountDto(string Type, int Open, int Total);

public sealed record MovementListDto(IReadOnlyList<MovementTypeCountDto> Types, int Open, int Executed, IReadOnlyList<MovementRowDto> Rows);

public sealed record MovementDetailDto(
    Guid Id,
    string MovementNo,
    string Type,
    string Status,
    bool AwaitingApproval,
    Guid WorkerId,
    string WorkerNo,
    string WorkerName,
    string? IqamaNo,
    string FromPlacement,
    string? FromProjectName,
    string OpensPeriod,
    DateOnly EffectiveOn,
    DateOnly? ExpectedReturnOn,
    string? VacationKind,
    string? ReturnTo,
    Guid? ProjectId,
    string? ProjectName,
    string? PackageNo,
    decimal Salary,
    decimal ServiceFee,
    decimal Housing,
    decimal Transport,
    decimal TotalPrice,
    bool IsSpecialPrice,
    string? SpecialReason,
    bool PaySalary,
    string? SuspensionReason,
    string? ExitKind,
    string? Place,
    string? DelayReason,
    string? Notes,
    string CreatedByName,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExecutedAt,
    string? ExecutedByName,
    string? LastComment,
    IReadOnlyList<PeriodInfo> Timeline,
    ApprovalStatusInfo? Approval,
    bool CanEdit);

internal sealed class MovementQueries(OperationsDbContext db, IPeriodLedger ledger, IApprovalService approvals, IPermissionService permissions)
{
    public async Task<MovementListDto> ListAsync(string? type, string? status, string? search, CancellationToken cancellationToken)
    {
        var all = db.Movements.AsNoTracking();
        var counts = await all.GroupBy(m => m.Type)
            .Select(g => new { g.Key, Open = g.Count(m => m.Status == MovementStatus.InApproval || m.Status == MovementStatus.Returned), Total = g.Count() })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var types = Enum.GetValues<MovementType>()
            .Select(t => counts.FirstOrDefault(c => c.Key == t) is { } c ? new MovementTypeCountDto(t.ToString(), c.Open, c.Total) : new MovementTypeCountDto(t.ToString(), 0, 0))
            .ToList();

        var query = all;
        if (Enum.TryParse<MovementType>(type, out var t))
        {
            query = query.Where(m => m.Type == t);
        }

        query = status switch
        {
            "Open" => query.Where(m => m.Status == MovementStatus.InApproval || m.Status == MovementStatus.Returned),
            "Executed" => query.Where(m => m.Status == MovementStatus.Executed),
            "Closed" => query.Where(m => m.Status == MovementStatus.Rejected || m.Status == MovementStatus.Canceled),
            _ => query,
        };
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(m => m.MovementNo.Contains(s) || m.WorkerNo.Contains(s) || m.WorkerName.Contains(s) || (m.IqamaNo != null && m.IqamaNo.Contains(s))
                                     || (m.FromProjectName != null && m.FromProjectName.Contains(s)) || (m.ProjectName != null && m.ProjectName.Contains(s)));
        }

        var rows = (await query.OrderByDescending(m => m.CreatedAt).Take(500).ToListAsync(cancellationToken).ConfigureAwait(false))
            .Select(m => new MovementRowDto(
                m.Id, m.MovementNo, m.Type.ToString(), m.Status.ToString(), m.WorkerId, m.WorkerNo, m.WorkerName, m.FromPlacement, m.FromProjectName,
                m.OpensPeriod, m.ProjectName, m.EffectiveOn, m.VacationKind?.ToString(), m.CreatedByName, m.CreatedAt))
            .ToList();
        return new MovementListDto(types, types.Sum(x => x.Open), await all.CountAsync(m => m.Status == MovementStatus.Executed, cancellationToken).ConfigureAwait(false), rows);
    }

    public async Task<MovementDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var m = await db.Movements.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (m is null)
        {
            return null;
        }

        var timeline = (await ledger.PeriodsAsync(m.WorkerId, cancellationToken).ConfigureAwait(false)).Take(8).ToList();
        var approval = await approvals.StatusAsync(MovementAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        var canManage = (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(OperationsPermissions.MovementsManage);
        return new MovementDetailDto(
            m.Id, m.MovementNo, m.Type.ToString(), m.Status.ToString(), m.AwaitingApproval, m.WorkerId, m.WorkerNo, m.WorkerName, m.IqamaNo, m.FromPlacement,
            m.FromProjectName, m.OpensPeriod, m.EffectiveOn, m.ExpectedReturnOn, m.VacationKind?.ToString(), m.ReturnTo?.ToString(), m.ProjectId, m.ProjectName,
            m.PackageNo, m.Salary, m.ServiceFee, m.Housing, m.Transport, m.TotalPrice, m.IsSpecialPrice, m.SpecialReason, m.PaySalary,
            m.SuspensionReason?.ToString(), m.ExitKind?.ToString(), m.Place, m.DelayReason, m.Notes, m.CreatedByName, m.CreatedAt, m.ExecutedAt,
            m.ExecutedByName, m.LastComment, timeline, approval, CanEdit: canManage && m.IsEditable);
    }
}
