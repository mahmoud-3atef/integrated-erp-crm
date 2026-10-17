using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workforce.Contracts;

/// <summary>A worker starting work on a project from a movement document's line, with the line's price.</summary>
public sealed record WorkStartRequest(
    Guid WorkerId,
    Guid ProjectId,
    Guid ProjectCrmId,
    string ProjectName,
    DateOnly StartsOn,
    string SourceType,
    Guid SourceId,
    Guid SourceLineId,
    string SourceNo,
    Guid? PackageId,
    string? PackageNo,
    decimal Salary,
    decimal ServiceFee,
    decimal Housing,
    bool HousingBillable,
    decimal Transport,
    bool TransportBillable,
    decimal TotalPrice,
    bool IsSpecialPrice);

/// <summary>A period of a worker's timeline as other modules and screens show it.</summary>
public sealed record PeriodInfo(
    Guid Id,
    string Kind,
    Guid? ProjectId,
    string? ProjectName,
    DateOnly StartsOn,
    DateOnly? EndsOn,
    string SourceType,
    Guid SourceId,
    string SourceNo,
    string? ClosedByNo,
    string? PackageNo,
    decimal? Salary,
    decimal? ServiceFee,
    decimal? Housing,
    decimal? Transport,
    decimal? TotalPrice,
    bool IsSpecialPrice);

/// <summary>
/// The period ledger (docs/02-target-architecture/04): each worker's timeline of periods (housing, work on a project,
/// vacation…) built from movement documents; attendance and invoices are counted from it.
/// </summary>
public interface IPeriodLedger
{
    /// <summary>
    /// Opens a work period for each worker of a delivered document (all or none): the worker's open period, if any,
    /// closes on the start day. Repeating the same document line does nothing (idempotent).
    /// </summary>
    Task<Result> StartWorkAsync(IReadOnlyList<WorkStartRequest> starts, CancellationToken cancellationToken);

    /// <summary>A worker's periods, latest first.</summary>
    Task<IReadOnlyList<PeriodInfo>> PeriodsAsync(Guid workerId, CancellationToken cancellationToken);
}
