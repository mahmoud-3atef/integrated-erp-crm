using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workflow.Domain;

public enum RequestStatus
{
    Draft = 0,
    InApproval = 1,
    Approved = 2,
    Rejected = 3,
    Returned = 4,

    /// <summary>Set by a process step while reviewers look into it.</summary>
    UnderReview = 5,

    /// <summary>Set by a process step while waiting for something outside the approval.</summary>
    OnHold = 6,

    Canceled = 7,
}

/// <summary>Kinds of internal request, usable in process conditions.</summary>
public static class RequestCategories
{
    public static readonly IReadOnlyList<(string Code, string Ar, string En)> All =
    [
        ("GENERAL", "عام", "General"),
        ("PURCHASE", "شراء", "Purchase"),
        ("ADVANCE", "سلفة", "Advance"),
        ("LEAVE", "إجازة", "Leave"),
        ("OTHER", "أخرى", "Other"),
    ];

    public static bool IsKnown(string code) => All.Any(c => c.Code == code);
}

/// <summary>
/// An internal request or memo (طلب داخلي) that goes through the company's approval route: the first document
/// type of the approval engine, and a template for the movement documents that follow.
/// </summary>
public sealed class InternalRequest : ITenantOwned
{
    public const int SubjectMaxLength = 200;
    public const int DetailsMaxLength = 4000;

    private InternalRequest()
    {
        Number = string.Empty;
        Subject = string.Empty;
        Details = string.Empty;
        CreatedByName = string.Empty;
    }

    private InternalRequest(string number, Guid createdBy, string createdByName, DateTimeOffset createdAt)
    {
        Id = Guid.CreateVersion7();
        Number = number;
        Subject = string.Empty;
        Details = string.Empty;
        CreatedBy = createdBy;
        CreatedByName = createdByName;
        CreatedAt = createdAt;
        Status = RequestStatus.Draft;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>Gap-free per company and year, e.g. <c>REQ-2026-00001</c>.</summary>
    public string Number { get; private set; }

    public string Subject { get; private set; }

    public string Details { get; private set; }

    public decimal? Amount { get; private set; }

    public Guid? LegalEntityId { get; private set; }

    public string Category { get; private set; } = "GENERAL";

    /// <summary>Chosen by the requester; a process stage can be assigned to this person.</summary>
    public Guid? DirectManagerId { get; private set; }

    /// <summary>Filled by an approver when a stage requires it.</summary>
    public string? ApproverNotes { get; private set; }

    public Guid CreatedBy { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public RequestStatus Status { get; private set; }

    public string? LastComment { get; private set; }

    public bool CanEdit => Status is RequestStatus.Draft or RequestStatus.Returned or RequestStatus.Canceled;

    public bool InApproval => Status is RequestStatus.InApproval or RequestStatus.UnderReview or RequestStatus.OnHold;

    public static Result<InternalRequest> Create(string number, RequestFields fields, Guid createdBy, string createdByName, DateTimeOffset at)
    {
        var request = new InternalRequest(number, createdBy, createdByName, at);
        var updated = request.Update(fields);
        return updated.IsFailure ? Result.Failure<InternalRequest>(updated.Error) : Result.Success(request);
    }

    public Result Update(RequestFields fields)
    {
        ArgumentNullException.ThrowIfNull(fields);
        var (subject, details, amount, legalEntityId, category, directManagerId) = fields;
        if (!CanEdit)
        {
            return Result.Failure(Error.Conflict("request_locked", "The request cannot be changed while in approval or after a decision."));
        }

        subject = (subject ?? string.Empty).Trim();
        details = (details ?? string.Empty).Trim();
        if (subject.Length is 0 or > SubjectMaxLength)
        {
            return Result.Failure(Error.Validation("request_subject_required", "A subject of up to 200 characters is required."));
        }

        if (details.Length > DetailsMaxLength)
        {
            return Result.Failure(Error.Validation("request_details_too_long", "Details are limited to 4000 characters."));
        }

        if (amount is < 0 or > 999_999_999)
        {
            return Result.Failure(Error.Validation("request_amount_invalid", "The amount must be between 0 and 999,999,999."));
        }

        category = string.IsNullOrWhiteSpace(category) ? "GENERAL" : category.Trim().ToUpperInvariant();
        if (!RequestCategories.IsKnown(category))
        {
            return Result.Failure(Error.Validation("request_category_invalid", "Unknown request category."));
        }

        if (directManagerId == CreatedBy)
        {
            return Result.Failure(Error.Validation("request_manager_self", "You cannot be your own direct manager."));
        }

        Subject = subject;
        Details = details;
        Amount = amount is null ? null : Money.RoundAmount(amount.Value);
        LegalEntityId = legalEntityId;
        Category = category;
        DirectManagerId = directManagerId;
        return Result.Success();
    }

    /// <summary>Fields a process may set while the request is in approval.</summary>
    public void SetFromProcess(RequestStatus? status, string? approverNotes, bool notesGiven)
    {
        if (status is { } s)
        {
            Status = s;
        }

        if (notesGiven)
        {
            ApproverNotes = string.IsNullOrWhiteSpace(approverNotes) ? null : approverNotes.Trim();
        }
    }

    public Result MarkSubmitted()
    {
        if (InApproval || Status is RequestStatus.Approved or RequestStatus.Rejected)
        {
            return Result.Failure(Error.Conflict("request_locked", "The request is already in approval or decided."));
        }

        Status = RequestStatus.InApproval;
        return Result.Success();
    }

    public void Complete(RequestStatus status, string? comment)
    {
        Status = status;
        LastComment = comment;
    }
}

public sealed record RequestFields(string Subject, string Details, decimal? Amount, Guid? LegalEntityId, string? Category, Guid? DirectManagerId);
