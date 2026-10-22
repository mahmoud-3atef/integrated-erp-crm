using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Identity.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Identity.Application;

/// <summary>User accounts are catalog-level (not per company), so this needs no tenant.</summary>
internal sealed class UserDirectory(IdentityDbContext db) : IUserDirectory
{
    public async Task<IReadOnlyList<UserContact>> GetAsync(IReadOnlyCollection<Guid> userAccountIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(userAccountIds);
        return await db.Users.AsNoTracking()
            .Where(u => userAccountIds.Contains(u.Id))
            .Select(u => new UserContact(u.Id, u.DisplayName, u.Email, u.IsActive))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<string>> LoginsAsync(Guid userAccountId, CancellationToken cancellationToken) =>
        (await db.ExternalLogins.AsNoTracking()
            .Where(l => l.UserAccountId == userAccountId)
            .Select(l => l.UserName)
            .ToListAsync(cancellationToken).ConfigureAwait(false))
        .Select(n => n[(n.LastIndexOf('\\') + 1)..])
        .Select(n => n.Trim().ToLowerInvariant())
        .Where(n => n.Length > 0)
        .Distinct()
        .ToList();

    public async Task<IReadOnlyDictionary<string, Guid>> UsersByLoginsAsync(IReadOnlyCollection<string> logins, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(logins);
        var wanted = logins.Select(l => l.Trim().ToLowerInvariant()).Where(l => l.Length > 0).ToHashSet(StringComparer.Ordinal);
        if (wanted.Count == 0)
        {
            return new Dictionary<string, Guid>();
        }

        var all = await db.ExternalLogins.AsNoTracking().Select(l => new { l.UserName, l.UserAccountId }).ToListAsync(cancellationToken).ConfigureAwait(false);
        return all
            .Select(l => (Name: l.UserName[(l.UserName.LastIndexOf('\\') + 1)..].Trim().ToLowerInvariant(), l.UserAccountId))
            .Where(l => wanted.Contains(l.Name))
            .GroupBy(l => l.Name, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First().UserAccountId, StringComparer.Ordinal);
    }
}
