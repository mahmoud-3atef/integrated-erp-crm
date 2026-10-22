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

/// <summary>A worker back in housing from a movement document (a return order), with or without salary while there.</summary>
public sealed record HousingStartRequest(
    Guid WorkerId,
    DateOnly StartsOn,
    bool PaySalary,
    string? HousingName,
    string SourceType,
    Guid SourceId,
    string SourceNo);

/// <summary>
/// A worker's movement out of the current period (docs/02-target-architecture/05 §2): <paramref name="Kind"/> is Housing,
/// Vacation, ClientVacation (billed: it keeps the work period's project and price), Absconded, Suspended or Out. The
/// worker's open period closes on <paramref name="StartsOn"/>, as allowed by the period they are in.
/// </summary>
public sealed record PeriodStartRequest(
    Guid WorkerId,
    string Kind,
    DateOnly StartsOn,
    bool PaySalary,
    string? Place,
    string SourceType,
    Guid SourceId,
    string SourceNo);

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
    bool IsSpecialPrice,
    bool PaySalary = false,
    bool FromOldSystem = false,
    Guid? ProjectCrmId = null);

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

    /// <summary>
    /// Opens a housing period from the start day: the worker's open work period (if any) closes on that day; a worker
    /// whose timeline starts here (on the job in the old system) gets the housing period only. Idempotent per document.
    /// </summary>
    Task<Result> StartHousingAsync(HousingStartRequest start, CancellationToken cancellationToken);

    /// <summary>
    /// Opens a period of the given kind (a worker movement): only from a period that allows it (vacation from work or
    /// housing, client vacation from work, back to housing from vacation, absconding or suspension…). A worker whose
    /// timeline starts here (in the old system) gets the new period only. Idempotent per document.
    /// </summary>
    Task<Result> StartPeriodAsync(PeriodStartRequest start, CancellationToken cancellationToken);

    /// <summary>
    /// A worker's timeline, latest first: the history from the old system up to the first period recorded here, then
    /// the periods recorded here.
    /// </summary>
    Task<IReadOnlyList<PeriodInfo>> PeriodsAsync(Guid workerId, CancellationToken cancellationToken);

    /// <summary>
    /// Changes the period an approved document opened (the document amended): its first day — the period before it ends
    /// on the new day, never overlapping another — whether it is paid, and its place.
    /// </summary>
    Task<Result> AmendAsync(PeriodAmendRequest amend, CancellationToken cancellationToken);

    /// <summary>
    /// Takes back the period an approved document opened (the document cancelled): only the worker's latest period —
    /// cancel what came after it first; the period before it is open again.
    /// </summary>
    Task<Result> UndoAsync(Guid workerId, Guid sourceId, CancellationToken cancellationToken);

    /// <summary>
    /// The number of a document already built on the period a document opened (a timesheet, a payroll run, a
    /// settlement): that period can no longer change or be taken back. Null when it can.
    /// </summary>
    Task<string?> LockedAsync(Guid workerId, Guid sourceId, CancellationToken cancellationToken);

    /// <summary>
    /// The work periods overlapping a date range (both days included), as the timelines show them: the old system's
    /// history up to each worker's first period recorded here, then the recorded periods. One project, or all of them
    /// (<paramref name="projectCrmId"/> null). Work on an inactive project ("InActive Employee") is left out.
    /// </summary>
    Task<IReadOnlyList<WorkSpan>> WorkAsync(Guid? projectCrmId, DateOnly from, DateOnly to, CancellationToken cancellationToken);
}

/// <summary>
/// A work period for a timesheet: the worker, the project, the days (<see cref="EndsOn"/> is the first day no longer
/// there) and the price. A period from the old system has only its total price and housing/transport parts: its
/// salary is 0 (the worker's salary stands for it).
/// </summary>
public sealed record WorkSpan(
    string Key,
    Guid WorkerId,
    Guid ProjectCrmId,
    string? ProjectName,
    DateOnly StartsOn,
    DateOnly? EndsOn,
    string? PackageNo,
    decimal Salary,
    decimal ServiceFee,
    decimal Housing,
    bool HousingBillable,
    decimal Transport,
    bool TransportBillable,
    decimal TotalPrice,
    bool IsSpecialPrice,
    string SourceType,
    string SourceNo,
    bool FromOldSystem);

/// <summary>
/// The new values of a period a document opened: its first day, whether it is paid (housing), its place, and a work
/// period's monthly service price (a special price; null keeps it).
/// </summary>
public sealed record PeriodAmendRequest(Guid WorkerId, Guid SourceId, DateOnly StartsOn, bool PaySalary, string? Place, string SourceNo, decimal? TotalPrice = null);

/// <summary>
/// Documents of other modules built on a worker's periods from a day (a timesheet or a payroll run in approval or
/// approved, a settlement not cancelled): the periods from that day — or the one a document opened — cannot change.
/// </summary>
public interface IWorkerPeriodLocks
{
    /// <summary>The number of such a document, if any.</summary>
    Task<string?> LockedFromAsync(Guid workerId, Guid sourceId, DateOnly day, CancellationToken cancellationToken);
}
