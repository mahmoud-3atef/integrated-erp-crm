using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workforce.Domain;

/// <summary>
/// A period of a worker's history as derived from the old system (work starts, approved housing orders, approved
/// vacations): rebuilt after every sync, never edited. The worker's timeline shows it up to the worker's first period
/// recorded in this system (<see cref="WorkerPeriod"/>), which takes over from there.
/// </summary>
public sealed class HistoryPeriod : ITenantOwned, INotAudited
{
    private HistoryPeriod()
    {
        SourceType = string.Empty;
        SourceNo = string.Empty;
    }

    public HistoryPeriod(Guid workerId, PeriodKind kind, DateOnly startsOn, DateOnly? endsOn, Guid? projectCrmId, string? place, PeriodRate rate, string sourceType, Guid sourceCrmId, string sourceNo)
        : this()
    {
        Id = Guid.CreateVersion7();
        WorkerId = workerId;
        Kind = kind;
        StartsOn = startsOn;
        EndsOn = endsOn;
        ProjectCrmId = projectCrmId;
        Place = place;
        Rate = rate;
        SourceType = sourceType;
        SourceCrmId = sourceCrmId;
        SourceNo = sourceNo;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid WorkerId { get; private set; }

    public PeriodKind Kind { get; private set; }

    public DateOnly StartsOn { get; private set; }

    /// <summary>First day no longer in the period (exclusive); null while open.</summary>
    public DateOnly? EndsOn { get; private set; }

    public Guid? ProjectCrmId { get; private set; }

    /// <summary>The project (work) or the housing (housing) by name.</summary>
    public string? Place { get; private set; }

    public PeriodRate Rate { get; private set; } = PeriodRate.None;

    /// <summary>empwork, housing_order or vacation.</summary>
    public string SourceType { get; private set; }

    public Guid SourceCrmId { get; private set; }

    public string SourceNo { get; private set; }
}

/// <summary>What does not add up in a worker's history in the old system, for operations to review.</summary>
public static class HistoryIssues
{
    /// <summary>Two movements of the worker on the same day (the later one was kept).</summary>
    public const string SameDay = "SameDay";

    /// <summary>A movement ended (end date) before the next one started: days nobody accounts for.</summary>
    public const string Gap = "Gap";

    /// <summary>An end date before the movement's own start (ignored).</summary>
    public const string EndBeforeStart = "EndBeforeStart";

    /// <summary>An end date after the next movement's start (ignored).</summary>
    public const string EndAfterNext = "EndAfterNext";

    /// <summary>A work start without a service price.</summary>
    public const string WorkWithoutPrice = "WorkWithoutPrice";

    /// <summary>A return to housing while the worker was not on a project.</summary>
    public const string ReturnWithoutWork = "ReturnWithoutWork";

    /// <summary>On the job in the old system, but no work start at all.</summary>
    public const string OnJobWithoutWorkStart = "OnJobWithoutWorkStart";

    /// <summary>The worker's status in the old system differs from where the history leaves them.</summary>
    public const string StatusMismatch = "StatusMismatch";

    /// <summary>On the job on another project than the last work start says.</summary>
    public const string ProjectMismatch = "ProjectMismatch";

    public static readonly string[] All = [SameDay, Gap, EndBeforeStart, EndAfterNext, WorkWithoutPrice, ReturnWithoutWork, OnJobWithoutWorkStart, StatusMismatch, ProjectMismatch];
}

public sealed class HistoryIssue : ITenantOwned, INotAudited
{
    private HistoryIssue()
    {
        Code = string.Empty;
        Details = string.Empty;
    }

    public HistoryIssue(Guid workerId, string code, DateOnly? on, string details, string? sourceNo)
        : this()
    {
        Id = Guid.CreateVersion7();
        WorkerId = workerId;
        Code = code;
        On = on;
        Details = details;
        SourceNo = sourceNo;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid WorkerId { get; private set; }

    public string Code { get; private set; }

    public DateOnly? On { get; private set; }

    /// <summary>What was found, in Arabic (shown as is).</summary>
    public string Details { get; private set; }

    public string? SourceNo { get; private set; }
}

/// <summary>When the history was last rebuilt, from which changes, and the outcome.</summary>
public sealed class HistoryImport : ITenantOwned
{
    public Guid Id { get; private set; } = Guid.CreateVersion7();

    public Guid TenantId { get; private set; }

    public DateTimeOffset? WorkStartsWatermark { get; private set; }

    public DateTimeOffset? HousingWatermark { get; private set; }

    public DateTimeOffset? VacationsWatermark { get; private set; }

    public DateTimeOffset? WorkersWatermark { get; private set; }

    public DateTimeOffset? BuiltAt { get; private set; }

    public string? Summary { get; private set; }

    public void Built(DateTimeOffset? workStarts, DateTimeOffset? housing, DateTimeOffset? vacations, DateTimeOffset? workers, DateTimeOffset at, string summary)
    {
        WorkStartsWatermark = workStarts ?? WorkStartsWatermark;
        HousingWatermark = housing ?? HousingWatermark;
        VacationsWatermark = vacations ?? VacationsWatermark;
        WorkersWatermark = workers ?? WorkersWatermark;
        BuiltAt = at;
        Summary = summary;
    }
}
