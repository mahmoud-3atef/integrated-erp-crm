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

public interface IHousingEntries
{
    /// <summary>The approved housing orders whose arrival falls in a period.</summary>
    Task<IReadOnlyList<HousingEntryFact>> InAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);
}
