namespace IntegratedErp.Modules.Documents.Contracts;

/// <summary>
/// A message to users of the current company, in both languages. <see cref="Kind"/> is a stable code
/// (e.g. <c>identity.member_added</c>); <see cref="Link"/> is an in-app path such as <c>/admin/users</c>.
/// </summary>
public sealed record NotificationRequest(
    IReadOnlyCollection<Guid> RecipientUserIds,
    string Kind,
    string TitleAr,
    string TitleEn,
    string BodyAr,
    string BodyEn,
    string? Link = null,
    bool SendEmail = true);

/// <summary>An email to an address outside the users (an employee's own address), in the caller's company.</summary>
public sealed record OutgoingEmailRequest(string To, string Subject, string HtmlBody, string TextBody);

/// <param name="Status"><c>Pending</c>, <c>Sent</c> or <c>Failed</c> (given up after the retries).</param>
public sealed record OutgoingEmailState(Guid Id, string Status, int Attempts, DateTimeOffset? SentAt, string? LastError);

/// <summary>
/// Queues emails to any address (sent in the background and retried, like the notifications), and reads back how
/// each went. A confidential email's body is cleared once it is sent or given up.
/// </summary>
public interface IEmailOutbox
{
    /// <summary>Whether the server has an email account to send from, and its address.</summary>
    (bool Configured, string? FromAddress) Sender { get; }

    Task<IReadOnlyList<Guid>> QueueAsync(IReadOnlyList<OutgoingEmailRequest> emails, bool confidential, CancellationToken cancellationToken);

    Task<IReadOnlyList<OutgoingEmailState>> StatesAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken);
}

/// <summary>Sends notifications; saved in the caller's company and emailed in the background (retried on failure).</summary>
public interface INotifier
{
    Task NotifyAsync(NotificationRequest request, CancellationToken cancellationToken);
}
