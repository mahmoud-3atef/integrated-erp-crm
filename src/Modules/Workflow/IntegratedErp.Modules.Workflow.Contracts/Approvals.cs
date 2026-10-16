using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workflow.Contracts;

/// <summary>
/// Public surface of the Workflow module: configurable approval routes (stages and approvers edited from the
/// screens, versioned), the approval engine, "my tasks", and internal requests.
/// </summary>
public static class WorkflowContracts
{
    public const string ModuleName = "Workflow";
}

/// <summary>
/// A document sent for approval by its module. <paramref name="DynamicApprovers"/> gives the user for each dynamic
/// approver key the document type declares (e.g. <c>project_manager</c>); <paramref name="LegalEntityId"/> limits
/// role-based approvers to those holding the role for that commercial registration (or for all of them).
/// </summary>
public sealed record ApprovalSubmission(
    string DocumentType,
    Guid DocumentId,
    string Title,
    Guid? LegalEntityId = null,
    IReadOnlyDictionary<string, Guid>? DynamicApprovers = null);

public enum ApprovalOutcome
{
    Approved,
    Rejected,
    Returned,
}

public sealed record ApprovalTimelineStep(
    int StageOrder,
    string StageNameAr,
    string StageNameEn,
    string Status,
    IReadOnlyList<string> Assignees,
    string? DecidedBy,
    DateTimeOffset? DecidedAt,
    string? Comment);

/// <summary>Where a document stands in its latest approval, and every decision so far.</summary>
public sealed record ApprovalTimeline(
    Guid InstanceId,
    string Status,
    int CurrentStage,
    int StageCount,
    string SubmittedBy,
    DateTimeOffset SubmittedAt,
    IReadOnlyList<ApprovalTimelineStep> Steps);

/// <summary>Starts approvals and reads their progress (used by the modules that own the documents).</summary>
public interface IApprovalService
{
    /// <summary>Starts the company's route for the document type; fails when no active route or a stage has no approver.</summary>
    Task<Result<Guid>> SubmitAsync(ApprovalSubmission submission, CancellationToken cancellationToken);

    Task<ApprovalTimeline?> TimelineAsync(string documentType, Guid documentId, CancellationToken cancellationToken);
}

/// <summary>
/// Implemented by the module that owns a document type: told when its approval ends, inside the same request,
/// so the document's status changes together with the final decision.
/// </summary>
public interface IApprovalOutcomeHandler
{
    string DocumentType { get; }

    Task OnCompletedAsync(Guid documentId, ApprovalOutcome outcome, string? comment, CancellationToken cancellationToken);
}
