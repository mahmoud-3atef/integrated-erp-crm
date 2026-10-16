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

/// <summary>Sends notifications; saved in the caller's company and emailed in the background (retried on failure).</summary>
public interface INotifier
{
    Task NotifyAsync(NotificationRequest request, CancellationToken cancellationToken);
}
