using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Documents.Domain;

/// <summary>An in-system message to one user in one company, in both languages.</summary>
public sealed class Notification : ITenantOwned
{
    private Notification()
    {
        Kind = string.Empty;
        TitleAr = string.Empty;
        TitleEn = string.Empty;
        BodyAr = string.Empty;
        BodyEn = string.Empty;
    }

    public Notification(Guid recipientUserId, string kind, string titleAr, string titleEn, string bodyAr, string bodyEn, string? link, DateTimeOffset createdAt)
    {
        Id = Guid.CreateVersion7();
        RecipientUserId = recipientUserId;
        Kind = kind;
        TitleAr = titleAr;
        TitleEn = titleEn;
        BodyAr = bodyAr;
        BodyEn = bodyEn;
        Link = link;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid RecipientUserId { get; private set; }

    public string Kind { get; private set; }

    public string TitleAr { get; private set; }

    public string TitleEn { get; private set; }

    public string BodyAr { get; private set; }

    public string BodyEn { get; private set; }

    /// <summary>In-app path only (never an external address).</summary>
    public string? Link { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? ReadAt { get; private set; }

    public void MarkRead(DateTimeOffset at) => ReadAt ??= at;
}

public enum EmailStatus
{
    Pending = 0,
    Sent = 1,
    Failed = 2,
}

/// <summary>
/// An email waiting to be sent, saved in the same transaction as its notification so none is lost; a background
/// dispatcher sends it and retries with back-off (a small, dedicated outbox).
/// </summary>
public sealed class OutgoingEmail : ITenantOwned
{
    public const int MaxAttempts = 6;

    private OutgoingEmail()
    {
        To = string.Empty;
        Subject = string.Empty;
        HtmlBody = string.Empty;
        TextBody = string.Empty;
    }

    public OutgoingEmail(Guid? notificationId, string to, string subject, string htmlBody, string textBody, DateTimeOffset createdAt)
    {
        Id = Guid.CreateVersion7();
        NotificationId = notificationId;
        To = to;
        Subject = subject;
        HtmlBody = htmlBody;
        TextBody = textBody;
        CreatedAt = createdAt;
        NextAttemptAt = createdAt;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid? NotificationId { get; private set; }

    public string To { get; private set; }

    public string Subject { get; private set; }

    public string HtmlBody { get; private set; }

    public string TextBody { get; private set; }

    public EmailStatus Status { get; private set; }

    public int Attempts { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset NextAttemptAt { get; private set; }

    public DateTimeOffset? SentAt { get; private set; }

    public string? LastError { get; private set; }

    public void MarkSent(DateTimeOffset at)
    {
        Status = EmailStatus.Sent;
        SentAt = at;
        Attempts++;
        LastError = null;
    }

    /// <summary>Retries after 1, 2, 4, 8, 16 minutes, then gives up (visible as Failed).</summary>
    public void MarkFailed(string error, DateTimeOffset at)
    {
        Attempts++;
        LastError = error.Length > 500 ? error[..500] : error;
        if (Attempts >= MaxAttempts)
        {
            Status = EmailStatus.Failed;
            return;
        }

        NextAttemptAt = at.AddMinutes(Math.Pow(2, Attempts - 1));
    }
}
