using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workflow.Contracts;

/// <summary>
/// Public surface of the Workflow module: approval processes in the style of Dynamics CRM workflows (stages as
/// approval tasks, conditions, record updates, notifications), "my tasks" and "my requests", and internal requests.
/// </summary>
public static class WorkflowContracts
{
    public const string ModuleName = "Workflow";
}

/// <summary>Field types a screen may expose to approval processes.</summary>
public enum RecordFieldType
{
    Text,
    Number,
    Money,
    Date,
    Boolean,

    /// <summary>One of <see cref="RecordField.Options"/> (e.g. a status).</summary>
    Choice,

    /// <summary>A user account id (e.g. direct manager, project manager): can be an approver or a recipient.</summary>
    User,

    /// <summary>A commercial registration id.</summary>
    LegalEntity,
}

/// <param name="Settable">Whether a process may set this value (e.g. a final status is shown and compared, but set only by the module).</param>
public sealed record RecordFieldOption(string Value, string NameAr, string NameEn, bool Settable = true);

/// <summary>
/// A field of a screen's record usable in conditions; <paramref name="Updatable"/> fields may also be set by a
/// process step or filled by an approver. Values travel as invariant strings: numbers "1500.56", dates "2026-10-16",
/// booleans "true"/"false", ids as GUIDs.
/// </summary>
public sealed record RecordField(
    string Key,
    string NameAr,
    string NameEn,
    RecordFieldType Type,
    bool Updatable,
    IReadOnlyList<RecordFieldOption>? Options = null);

/// <summary>
/// A screen whose records go through approval processes. <paramref name="LinkTemplate"/> is the in-app page of one
/// record with <c>{id}</c>.
/// </summary>
public sealed record ApprovalScreen(string Code, string NameAr, string NameEn, string LinkTemplate, IReadOnlyList<RecordField> Fields)
{
    public string LinkTo(Guid recordId) => LinkTemplate.Replace("{id}", recordId.ToString(), StringComparison.Ordinal);
}

/// <summary>How an approval ended, as told to the module that owns the record.</summary>
public enum ApprovalEnd
{
    Approved,
    Rejected,

    /// <summary>Sent back to the submitter to change and send again.</summary>
    Returned,

    Canceled,
}

/// <summary>
/// Implemented by the module that owns a screen (one per screen). The approval engine never touches the module's
/// tables: it reads field values through <see cref="ReadAsync"/>, asks for field changes through
/// <see cref="ApplyAsync"/> (the module validates and saves them), and reports the end with <see cref="EndedAsync"/>.
/// </summary>
public interface IApprovalRecordAdapter
{
    ApprovalScreen Screen { get; }

    /// <summary>Current values of the declared fields; null when the record does not exist in the current company.</summary>
    Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken);

    /// <summary>Sets updatable fields (already type-checked by the engine). Must be idempotent and save its changes.</summary>
    Task<Result> ApplyAsync(Guid recordId, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken);

    /// <summary>The approval of the record ended; the module sets its own final state and saves it.</summary>
    Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken);
}

public sealed record ApprovalSubmission(string Screen, Guid RecordId, string Title, Guid? LegalEntityId = null);

public sealed record ApprovalTimelineEntry(
    int Sequence,
    string Kind,
    string? StepNameAr,
    string? StepNameEn,
    string? Actor,
    string? OnBehalfOf,
    string? Outcome,
    string? Comment,
    IReadOnlyDictionary<string, string?>? Changes,
    DateTimeOffset At);

/// <summary>The latest approval of a record: where it stands, who it waits for, and its full history.</summary>
public sealed record ApprovalStatusInfo(
    Guid InstanceId,
    string ProcessNameAr,
    string ProcessNameEn,
    int ProcessVersion,
    string Status,
    string? CurrentStepAr,
    string? CurrentStepEn,
    IReadOnlyList<string> WaitingFor,
    string SubmittedBy,
    DateTimeOffset SubmittedAt,
    IReadOnlyList<ApprovalTimelineEntry> History);

/// <summary>Used by modules that own records: start, follow and cancel approvals.</summary>
public interface IApprovalService
{
    /// <summary>Starts the first active process of the screen whose start condition matches the record.</summary>
    Task<Result<Guid>> SubmitAsync(ApprovalSubmission submission, CancellationToken cancellationToken);

    Task<ApprovalStatusInfo?> StatusAsync(string screen, Guid recordId, CancellationToken cancellationToken);

    /// <summary>Whether the current user submitted the record or holds (or held) one of its approval tasks.</summary>
    Task<bool> IsParticipantAsync(string screen, Guid recordId, CancellationToken cancellationToken);
}
