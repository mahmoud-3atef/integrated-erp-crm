using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workforce.Domain;

/// <summary>Where a worker is during a period (docs/02-target-architecture/04 §4).</summary>
public enum PeriodKind
{
    Housing,
    Work,
    Vacation,
    ClientVacation,
    Absconded,
    Suspended,
    Out,
}

/// <summary>The price of a work period, copied from its document's line (a later package change never alters it).</summary>
public sealed record PeriodRate(
    Guid? PackageId,
    string? PackageNo,
    decimal Salary,
    decimal ServiceFee,
    decimal Housing,
    bool HousingBillable,
    decimal Transport,
    bool TransportBillable,
    decimal TotalPrice,
    bool IsSpecialPrice)
{
    /// <summary>No price (periods other than work).</summary>
    public static PeriodRate None { get; } = new(null, null, 0, 0, 0, false, 0, false, 0, false);
}

/// <summary>
/// One period of a worker's timeline in the period ledger (docs/02-target-architecture/04): from <see cref="StartsOn"/>
/// up to the day before <see cref="EndsOn"/> (end exclusive: the day of a move belongs to the new period), or open.
/// It is the effect of a movement document (e.g. a delivered delivery order opens a work period with its price), and
/// attendance and invoices are counted from it. A worker's periods never overlap.
/// </summary>
public sealed class WorkerPeriod : ITenantOwned
{
    private WorkerPeriod()
    {
        SourceType = string.Empty;
        SourceNo = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid WorkerId { get; private set; }

    public PeriodKind Kind { get; private set; }

    /// <summary>The project (Commercial module) for work periods.</summary>
    public Guid? ProjectId { get; private set; }

    public Guid? ProjectCrmId { get; private set; }

    public string? ProjectName { get; private set; }

    public DateOnly StartsOn { get; private set; }

    /// <summary>First day no longer in the period (exclusive); null while open.</summary>
    public DateOnly? EndsOn { get; private set; }

    /// <summary>The price of a work period (<see cref="PeriodRate.None"/> for other kinds).</summary>
    public PeriodRate Rate { get; private set; } = PeriodRate.None;

    /// <summary>The document that opened the period, e.g. "delivery_order".</summary>
    public string SourceType { get; private set; }

    public Guid SourceId { get; private set; }

    /// <summary>The document's line for this worker.</summary>
    public Guid? SourceLineId { get; private set; }

    public string SourceNo { get; private set; }

    /// <summary>Housing periods: the worker is paid while in housing (the default is not).</summary>
    public bool PaySalary { get; private set; }

    /// <summary>The document that closed the period.</summary>
    public string? ClosedByNo { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public bool IsOpen => EndsOn is null;

    public static WorkerPeriod Open(Guid workerId, PeriodKind kind, DateOnly startsOn, PeriodProject? project, PeriodRate? rate, PeriodSource source, DateTimeOffset at, bool paySalary = false)
    {
        ArgumentNullException.ThrowIfNull(source);
        return new WorkerPeriod
        {
            Id = Guid.CreateVersion7(),
            WorkerId = workerId,
            Kind = kind,
            ProjectId = project?.ProjectId,
            ProjectCrmId = project?.ProjectCrmId,
            ProjectName = project?.ProjectName,
            StartsOn = startsOn,
            Rate = rate ?? PeriodRate.None,
            SourceType = source.Type,
            SourceId = source.Id,
            SourceLineId = source.LineId,
            SourceNo = source.No,
            PaySalary = paySalary,
            CreatedAt = at,
        };
    }

    /// <summary>Closes the period on the day the next one starts (that day belongs to the next period).</summary>
    public Result Close(DateOnly nextStartsOn, string closedByNo)
    {
        if (!IsOpen)
        {
            return Result.Failure(Error.Conflict("period_closed", "The period is already closed."));
        }

        if (nextStartsOn <= StartsOn)
        {
            return Result.Failure(Error.Conflict("period_overlap", "The new period would start on or before the start of the worker's current period."));
        }

        EndsOn = nextStartsOn;
        ClosedByNo = closedByNo;
        return Result.Success();
    }
}

public sealed record PeriodProject(Guid? ProjectId, Guid? ProjectCrmId, string? ProjectName);

public sealed record PeriodSource(string Type, Guid Id, Guid? LineId, string No);
