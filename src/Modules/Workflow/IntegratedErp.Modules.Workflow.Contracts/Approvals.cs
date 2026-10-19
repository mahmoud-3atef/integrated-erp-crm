using System.Text.Json.Serialization;
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
public sealed record ApprovalScreen(
    string Code,
    string NameAr,
    string NameEn,
    string LinkTemplate,
    IReadOnlyList<RecordField> Fields,
    IReadOnlyList<RecordRelation>? Relations = null,
    DefaultApprovalProcess? DefaultProcess = null)
{
    [JsonIgnore]
    public IReadOnlyList<RecordRelation> RelatedTables => Relations ?? [];

    public string LinkTo(Guid recordId) => LinkTemplate.Replace("{id}", recordId.ToString(), StringComparison.Ordinal);
}

/// <summary>
/// The process a screen starts with when the company has none for it yet: created and published automatically on
/// the first submission, then shown and edited like any other in "Approval processes". <paramref name="DefinitionJson"/>
/// uses the process editor's format (camelCase, enums as names).
/// </summary>
public sealed record DefaultApprovalProcess(string NameAr, string NameEn, string DefinitionJson);

/// <summary>
/// A table related to the screen's record (e.g. an invoice's project, a movement's worker) whose fields a process may
/// update. Only declared relations exist, so a process can change another table only through a real relation, and
/// the owning module applies the change (through that table's module contract when it belongs to another module).
/// </summary>
public sealed record RecordRelation(string Key, string NameAr, string NameEn, IReadOnlyList<RecordField> Fields);

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

    /// <summary>
    /// Sets updatable fields of the record (<paramref name="relation"/> null) or of the related table with that key
    /// (already type-checked by the engine). Must be idempotent and save its changes.
    /// </summary>
    Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken);

    /// <summary>The approval of the record ended; the module sets its own final state and saves it.</summary>
    Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken);

    /// <summary>
    /// An approval is about to start on the record (submitted, or run by an administrator): the module may refuse
    /// (e.g. an order already delivered) or mark the record as in approval. Must be idempotent and save its changes.
    /// </summary>
    Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken) => Task.FromResult(Result.Success());
}

/// <param name="ProcessId">Run this process (an administrator running a process on a record) instead of the first that applies.</param>
public sealed record ApprovalSubmission(string Screen, Guid RecordId, string Title, Guid? LegalEntityId = null, Guid? ProcessId = null);

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

/// <summary>
/// One approval stage as people read it (the stage bar): who it is (or was) with, who decided what and when, and how
/// long it took since the previous stage. <paramref name="State"/>: Done, Rejected, Returned, Current, Canceled.
/// <paramref name="Round"/> counts the openings of the same stage (2 and up: it opened again after a return);
/// <paramref name="Rule"/>: Any (one approver decides) or All (everyone must approve).
/// </summary>
public sealed record ApprovalStageInfo(
    string StepId,
    string NameAr,
    string NameEn,
    string State,
    IReadOnlyList<string> Assignees,
    string? DecidedBy,
    string? OnBehalfOf,
    DateTimeOffset OpenedAt,
    DateTimeOffset? DecidedAt,
    string? Comment,
    int Round = 1,
    string Rule = "Any");

/// <summary>
/// A stage the approval has not reached yet, as far as it can be told now (the path if everything is approved, with
/// conditions on the record as it is now): its approvers and dates are not known until it opens.
/// </summary>
public sealed record ApprovalPlannedStage(string StepId, string NameAr, string NameEn, string Rule);

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
    IReadOnlyList<ApprovalStageInfo> Stages,
    IReadOnlyList<ApprovalTimelineEntry> History,
    IReadOnlyList<ApprovalPlannedStage>? Planned = null);

/// <summary>Used by modules that own records: start, follow and cancel approvals.</summary>
public interface IApprovalService
{
    /// <summary>Starts the first active process of the screen whose start condition matches the record.</summary>
    Task<Result<Guid>> SubmitAsync(ApprovalSubmission submission, CancellationToken cancellationToken);

    Task<ApprovalStatusInfo?> StatusAsync(string screen, Guid recordId, CancellationToken cancellationToken);

    /// <summary>Whether the current user submitted the record or holds (or held) one of its approval tasks.</summary>
    Task<bool> IsParticipantAsync(string screen, Guid recordId, CancellationToken cancellationToken);
}
