using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workflow.Domain;

public enum RequestStatus
{
    Draft = 0,
    InApproval = 1,
    Approved = 2,
    Rejected = 3,
    Returned = 4,
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

    public Guid CreatedBy { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public RequestStatus Status { get; private set; }

    public string? LastComment { get; private set; }

    public bool CanEdit => Status is RequestStatus.Draft or RequestStatus.Returned;

    public static Result<InternalRequest> Create(string number, string subject, string details, decimal? amount, Guid? legalEntityId, Guid createdBy, string createdByName, DateTimeOffset at)
    {
        var request = new InternalRequest(number, createdBy, createdByName, at);
        var updated = request.Update(subject, details, amount, legalEntityId);
        return updated.IsFailure ? Result.Failure<InternalRequest>(updated.Error) : Result.Success(request);
    }

    public Result Update(string subject, string details, decimal? amount, Guid? legalEntityId)
    {
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

        Subject = subject;
        Details = details;
        Amount = amount is null ? null : Money.RoundAmount(amount.Value);
        LegalEntityId = legalEntityId;
        return Result.Success();
    }

    public Result MarkSubmitted()
    {
        if (!CanEdit)
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
