using IntegratedErp.BuildingBlocks.Approvals;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workflow.Application;

public sealed record RequestDto(
    Guid Id,
    string Number,
    string Subject,
    string Details,
    decimal? Amount,
    Guid? LegalEntityId,
    string CreatedByName,
    DateTimeOffset CreatedAt,
    RequestStatus Status,
    string? LastComment,
    bool IsMine,
    ApprovalTimeline? Approval);

public sealed record RequestInput(string Subject, string Details, decimal? Amount, Guid? LegalEntityId);

/// <summary>Internal requests (memos): created and edited by their author, approved through the company route.</summary>
internal sealed class InternalRequestService(
    WorkflowDbContext db,
    ApprovalEngine engine,
    NumberSequenceService numbering,
    ILegalEntityDirectory legalEntities,
    IPermissionService permissions,
    ICurrentUser user,
    IClock clock)
{
    public const string DocumentType = "workflow.internal_request";

    public static readonly ApprovalDocumentDefinition Definition = new(
        DocumentType,
        "طلب داخلي",
        "Internal request",
        "/workflow/requests/{id}",
        [new DynamicApproverKey("direct_manager", "المدير المباشر", "Direct manager")]);

    private static readonly Error NotFound = Error.NotFound("internal_request", "Request not found.");

    public async Task<IReadOnlyList<RequestDto>> ListAsync(bool all, CancellationToken cancellationToken)
    {
        var me = Me();
        var canSeeAll = all && (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(WorkflowPermissions.RequestsViewAll);
        var rows = await db.InternalRequests.AsNoTracking()
            .Where(r => canSeeAll || r.CreatedBy == me)
            .OrderByDescending(r => r.CreatedAt)
            .Take(200)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.Select(r => ToDto(r, me, null)).ToList();
    }

    /// <summary>The author, anyone who may see all requests, and the approvers of the request.</summary>
    public async Task<Result<RequestDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var request = await db.InternalRequests.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (request is null || !await CanSeeAsync(request, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<RequestDto>(NotFound);
        }

        var timeline = await engine.TimelineAsync(DocumentType, id, cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(request, Me(), timeline));
    }

    public async Task<Result<RequestDto>> CreateAsync(RequestInput input, CancellationToken cancellationToken)
    {
        if (!await LegalEntityKnownAsync(input.LegalEntityId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<RequestDto>(Error.Validation("legal_entity_unknown", "Unknown commercial registration."));
        }

        var now = clock.UtcNow;
        var today = SaudiTime.ToBusinessDate(now);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var value = await numbering.NextAsync(db, new NumberRequest("internal_request", Period: today.Year), cancellationToken).ConfigureAwait(false);
        var created = InternalRequest.Create(
            DocumentNumberFormat.Format("REQ-{YYYY}-{N:5}", value, today), input.Subject, input.Details, input.Amount, input.LegalEntityId, Me(), user.DisplayName, now);
        if (created.IsFailure)
        {
            // Rolled back: the number is not used, so the sequence stays gap-free.
            return Result.Failure<RequestDto>(created.Error);
        }

        db.InternalRequests.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(created.Value, Me(), null));
    }

    public async Task<Result<RequestDto>> UpdateAsync(Guid id, RequestInput input, CancellationToken cancellationToken)
    {
        var request = await OwnAsync(id, cancellationToken).ConfigureAwait(false);
        if (request is null)
        {
            return Result.Failure<RequestDto>(NotFound);
        }

        if (!await LegalEntityKnownAsync(input.LegalEntityId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<RequestDto>(Error.Validation("legal_entity_unknown", "Unknown commercial registration."));
        }

        var updated = request.Update(input.Subject, input.Details, input.Amount, input.LegalEntityId);
        if (updated.IsFailure)
        {
            return Result.Failure<RequestDto>(updated.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(request, Me(), null));
    }

    /// <summary>Sends the request to the route. The status change and the approval start are saved together.</summary>
    public async Task<Result<RequestDto>> SubmitAsync(Guid id, Guid? directManager, CancellationToken cancellationToken)
    {
        var request = await OwnAsync(id, cancellationToken).ConfigureAwait(false);
        if (request is null)
        {
            return Result.Failure<RequestDto>(NotFound);
        }

        var marked = request.MarkSubmitted();
        if (marked.IsFailure)
        {
            return Result.Failure<RequestDto>(marked.Error);
        }

        var dynamic = directManager is { } manager ? new Dictionary<string, Guid> { ["direct_manager"] = manager } : null;
        var started = await engine.SubmitAsync(
            new ApprovalSubmission(DocumentType, request.Id, $"{request.Number} — {request.Subject}", request.LegalEntityId, dynamic),
            cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            return Result.Failure<RequestDto>(started.Error);
        }

        return await GetAsync(id, cancellationToken).ConfigureAwait(false);
    }

    private async Task<InternalRequest?> OwnAsync(Guid id, CancellationToken cancellationToken)
    {
        var me = Me();
        return await db.InternalRequests.FirstOrDefaultAsync(r => r.Id == id && r.CreatedBy == me, cancellationToken).ConfigureAwait(false);
    }

    private async Task<bool> CanSeeAsync(InternalRequest request, CancellationToken cancellationToken) =>
        request.CreatedBy == Me()
        || (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(WorkflowPermissions.RequestsViewAll)
        || await engine.IsParticipantAsync(DocumentType, request.Id, cancellationToken).ConfigureAwait(false);

    private async Task<bool> LegalEntityKnownAsync(Guid? id, CancellationToken cancellationToken) =>
        id is null || (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).Any(e => e.Id == id && e.IsActive);

    private Guid Me() => Guid.Parse(user.UserId!);

    private static RequestDto ToDto(InternalRequest r, Guid me, ApprovalTimeline? timeline) =>
        new(r.Id, r.Number, r.Subject, r.Details, r.Amount, r.LegalEntityId, r.CreatedByName, r.CreatedAt, r.Status, r.LastComment, r.CreatedBy == me, timeline);
}

/// <summary>Applies the final decision to the request; saved with the decision (same database context).</summary>
internal sealed class InternalRequestOutcomeHandler(WorkflowDbContext db) : IApprovalOutcomeHandler
{
    public string DocumentType => InternalRequestService.DocumentType;

    public async Task OnCompletedAsync(Guid documentId, ApprovalOutcome outcome, string? comment, CancellationToken cancellationToken)
    {
        var request = await db.InternalRequests.FirstAsync(r => r.Id == documentId, cancellationToken).ConfigureAwait(false);
        request.Complete(
            outcome switch
            {
                ApprovalOutcome.Approved => RequestStatus.Approved,
                ApprovalOutcome.Rejected => RequestStatus.Rejected,
                _ => RequestStatus.Returned,
            },
            comment);
    }
}
