namespace IntegratedErp.Modules.Operations.Contracts;

/// <summary>
/// Public surface of the Operations module: the movement documents that move workers (docs/02-target-architecture/05),
/// starting with the delivery order.
/// </summary>
public static class OperationsContracts
{
    public const string ModuleName = "Operations";
}

/// <summary>
/// An approved housing order for the reports: who entered housing, when, how (a return, a new arrival, back from
/// vacation) and, for a return, why and from which project.
/// </summary>
/// <param name="Entry"><c>ReturnedWorker</c>, <c>NewArrival</c> or <c>BackFromVacation</c>.</param>
/// <param name="Reason"><c>ClientNoReason</c>, <c>WorkerRefuses</c>, <c>Sick</c>, <c>WorkerAbused</c>, <c>ContractCanceled</c> or <c>Other</c>.</param>
public sealed record HousingEntryFact(Guid? WorkerId, string WorkerNo, string Name, DateOnly ArrivedOn, string Entry, string Reason, Guid? ProjectCrmId, string? ProjectName, string? HousingName);

/// <summary>
/// A worker's leave as operations approved it (a vacation departure, VD-): when they leave and are expected back (the
/// first day back). <paramref name="OnClient"/>: a leave the customer pays.
/// </summary>
public sealed record WorkerVacation(Guid MovementId, string MovementNo, Guid WorkerId, string WorkerNo, string Name, DateOnly LeavesOn, DateOnly ExpectedReturnOn, bool OnClient);

/// <summary>The workers' approved leaves, for their vacation settlements (4.11ب).</summary>
public interface IWorkerVacations
{
    /// <summary>The approved vacation departures leaving from a day on (one worker's, or everyone's).</summary>
    Task<IReadOnlyList<WorkerVacation>> ApprovedAsync(DateOnly from, Guid? workerId, CancellationToken cancellationToken);
}

public interface IHousingEntries
{
    /// <summary>The approved housing orders whose arrival falls in a period.</summary>
    Task<IReadOnlyList<HousingEntryFact>> InAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);
}
