namespace IntegratedErp.Modules.Identity.Contracts;

/// <summary>How other modules may see a user (e.g. to address a notification or an email).</summary>
public sealed record UserContact(Guid UserAccountId, string DisplayName, string? Email, bool IsActive);

public interface IUserDirectory
{
    Task<IReadOnlyList<UserContact>> GetAsync(IReadOnlyCollection<Guid> userAccountIds, CancellationToken cancellationToken);
}
