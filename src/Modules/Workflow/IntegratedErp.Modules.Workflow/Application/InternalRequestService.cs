using System.Globalization;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Identity.Contracts;
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
    string Category,
    Guid? DirectManagerId,
    string? ApproverNotes,
    string CreatedByName,
    DateTimeOffset CreatedAt,
    RequestStatus Status,
    string? LastComment,
    bool IsMine,
    bool CanEdit,
    ApprovalStatusInfo? Approval);

public sealed record RequestInput(string Subject, string Details, decimal? Amount, Guid? LegalEntityId, string? Category, Guid? DirectManagerId);

/// <summary>Internal requests (memos): written by their author, then sent through the company's approval process.</summary>
internal sealed class InternalRequestService(
    WorkflowDbContext db,
    IApprovalService approvals,
    NumberSequenceService numbering,
    ILegalEntityDirectory legalEntities,
    IAccessDirectory access,
    IPermissionService permissions,
    ICurrentUser user,
    IClock clock)
{
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

    /// <summary>The author, anyone who may see all requests, and everyone in its approval.</summary>
    public async Task<Result<RequestDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var request = await db.InternalRequests.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (request is null || !await CanSeeAsync(request, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<RequestDto>(NotFound);
        }

        var status = await approvals.StatusAsync(InternalRequestAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(request, Me(), status));
    }

    public async Task<Result<RequestDto>> CreateAsync(RequestInput input, CancellationToken cancellationToken)
    {
        var checkedInput = await CheckAsync(input, cancellationToken).ConfigureAwait(false);
        if (checkedInput.IsFailure)
        {
            return Result.Failure<RequestDto>(checkedInput.Error);
        }

        var now = clock.UtcNow;
        var today = SaudiTime.ToBusinessDate(now);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var value = await numbering.NextAsync(db, new NumberRequest("internal_request", Period: today.Year), cancellationToken).ConfigureAwait(false);
        var created = InternalRequest.Create(DocumentNumberFormat.Format("REQ-{YYYY}-{N:5}", value, today), Fields(input), Me(), user.DisplayName, now);
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

        var checkedInput = await CheckAsync(input, cancellationToken).ConfigureAwait(false);
        if (checkedInput.IsFailure)
        {
            return Result.Failure<RequestDto>(checkedInput.Error);
        }

        var updated = request.Update(Fields(input));
        if (updated.IsFailure)
        {
            return Result.Failure<RequestDto>(updated.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(request, Me(), null));
    }

    /// <summary>Sends the request into the first active process that applies to it.</summary>
    public async Task<Result<RequestDto>> SubmitAsync(Guid id, CancellationToken cancellationToken)
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

        var started = await approvals.SubmitAsync(
            new ApprovalSubmission(InternalRequestAdapter.ScreenCode, request.Id, $"{request.Number} — {request.Subject}", request.LegalEntityId),
            cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            return Result.Failure<RequestDto>(started.Error);
        }

        return await GetAsync(id, cancellationToken).ConfigureAwait(false);
    }

    private async Task<Result> CheckAsync(RequestInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (input.LegalEntityId is { } entity && !(await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).Any(e => e.Id == entity && e.IsActive))
        {
            return Result.Failure(Error.Validation("legal_entity_unknown", "Unknown commercial registration."));
        }

        if (input.DirectManagerId is { } manager && !await access.IsMemberAsync(manager, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(Error.Validation("request_manager_unknown", "The direct manager is not a member of this company."));
        }

        return Result.Success();
    }

    private async Task<InternalRequest?> OwnAsync(Guid id, CancellationToken cancellationToken)
    {
        var me = Me();
        return await db.InternalRequests.FirstOrDefaultAsync(r => r.Id == id && r.CreatedBy == me, cancellationToken).ConfigureAwait(false);
    }

    private async Task<bool> CanSeeAsync(InternalRequest request, CancellationToken cancellationToken) =>
        request.CreatedBy == Me()
        || (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(WorkflowPermissions.RequestsViewAll)
        || await approvals.IsParticipantAsync(InternalRequestAdapter.ScreenCode, request.Id, cancellationToken).ConfigureAwait(false);

    private Guid Me() => Guid.Parse(user.UserId!);

    private static RequestFields Fields(RequestInput input) =>
        new(input.Subject, input.Details, input.Amount, input.LegalEntityId, input.Category, input.DirectManagerId);

    private static RequestDto ToDto(InternalRequest r, Guid me, ApprovalStatusInfo? approval) =>
        new(r.Id, r.Number, r.Subject, r.Details, r.Amount, r.LegalEntityId, r.Category, r.DirectManagerId, r.ApproverNotes, r.CreatedByName,
            r.CreatedAt, r.Status, r.LastComment, r.CreatedBy == me, r.CreatedBy == me && r.CanEdit, approval);
}

/// <summary>
/// The internal request screen as approval processes see it: its fields (for conditions, assignees and updates),
/// and how the request reacts to updates and to the approval's end.
/// </summary>
internal sealed class InternalRequestAdapter(WorkflowDbContext db) : IApprovalRecordAdapter
{
    public const string ScreenCode = "workflow.internal_request";

    // All statuses can be shown and compared; a process may set only the in-approval ones (the end is set by EndedAsync).
    private static readonly RecordFieldOption[] Statuses =
    [
        new(nameof(RequestStatus.Draft), "مسودة", "Draft", Settable: false),
        new(nameof(RequestStatus.InApproval), "قيد الاعتماد", "In approval"),
        new(nameof(RequestStatus.UnderReview), "قيد المراجعة", "Under review"),
        new(nameof(RequestStatus.OnHold), "معلّق", "On hold"),
        new(nameof(RequestStatus.Approved), "معتمد", "Approved", Settable: false),
        new(nameof(RequestStatus.Rejected), "مرفوض", "Rejected", Settable: false),
        new(nameof(RequestStatus.Returned), "مُعاد للتعديل", "Returned", Settable: false),
        new(nameof(RequestStatus.Canceled), "ملغى", "Canceled", Settable: false),
    ];

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "الطلبات الداخلية",
        "Internal requests",
        "/workflow/requests/{id}",
        [
            new("subject", "الموضوع", "Subject", RecordFieldType.Text, Updatable: false),
            new("amount", "المبلغ", "Amount", RecordFieldType.Money, Updatable: false),
            new("category", "نوع الطلب", "Category", RecordFieldType.Choice, Updatable: false,
                [.. RequestCategories.All.Select(c => new RecordFieldOption(c.Code, c.Ar, c.En))]),
            new("legal_entity", "السجل التجاري", "Commercial registration", RecordFieldType.LegalEntity, Updatable: false),
            new("requested_by", "مقدّم الطلب", "Requested by", RecordFieldType.User, Updatable: false),
            new("direct_manager", "المدير المباشر", "Direct manager", RecordFieldType.User, Updatable: false),
            new("status", "حالة الطلب", "Request status", RecordFieldType.Choice, Updatable: true, Statuses),
            new("approver_notes", "ملاحظات المعتمد", "Approver notes", RecordFieldType.Text, Updatable: true),
        ]);

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var r = await db.InternalRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return r is null
            ? null
            : new Dictionary<string, string?>
            {
                ["subject"] = r.Subject,
                ["amount"] = r.Amount?.ToString(CultureInfo.InvariantCulture),
                ["category"] = r.Category,
                ["legal_entity"] = r.LegalEntityId?.ToString(),
                ["requested_by"] = r.CreatedBy.ToString(),
                ["direct_manager"] = r.DirectManagerId?.ToString(),
                ["status"] = r.Status.ToString(),
                ["approver_notes"] = r.ApproverNotes,
            };
    }

    public async Task<Result> ApplyAsync(Guid recordId, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(changes);
        var request = await db.InternalRequests.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (request is null)
        {
            return Result.Failure(Error.NotFound("internal_request", "Request not found."));
        }

        RequestStatus? status = null;
        if (changes.TryGetValue("status", out var value))
        {
            if (!Statuses.Any(s => s.Value == value && s.Settable) || !Enum.TryParse<RequestStatus>(value, out var parsed))
            {
                return Result.Failure(Error.Validation("request_status_not_settable", "This status cannot be set by a process."));
            }

            status = parsed;
        }

        if (changes.Keys.Any(k => k is not ("status" or "approver_notes")))
        {
            return Result.Failure(Error.Validation("request_field_not_settable", "Only the status and approver notes can be set by a process."));
        }

        request.SetFromProcess(status, changes.GetValueOrDefault("approver_notes"), changes.ContainsKey("approver_notes"));
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        var request = await db.InternalRequests.FirstAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        request.Complete(
            end switch
            {
                ApprovalEnd.Approved => RequestStatus.Approved,
                ApprovalEnd.Rejected => RequestStatus.Rejected,
                ApprovalEnd.Returned => RequestStatus.Returned,
                _ => RequestStatus.Canceled,
            },
            comment);

        // Saved with the engine's changes (same database context).
    }
}
