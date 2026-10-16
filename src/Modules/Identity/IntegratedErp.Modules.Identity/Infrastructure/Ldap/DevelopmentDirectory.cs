using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IntegratedErp.Modules.Identity.Infrastructure.Ldap;

/// <summary>A test user that exists only in Development (<c>Identity:DevDirectory:Users</c>).</summary>
public sealed class DevelopmentUser
{
    public string UserName { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;
}

/// <summary>
/// Development only: test accounts (names must start with <c>dev.</c>) answered locally; every other name
/// goes to the real directory. Lets the full sign-in UI be exercised without real passwords.
/// The host registers it only when the environment is Development.
/// </summary>
public sealed class DevelopmentDirectory(LdapDirectory inner, IReadOnlyList<DevelopmentUser> users) : IDirectory
{
    public const string Prefix = "dev.";

    public static IServiceCollection Replace(IServiceCollection services, IConfiguration configuration)
    {
        var users = configuration.GetSection("Identity:DevDirectory:Users").Get<List<DevelopmentUser>>() ?? [];
        if (users.Any(u => !u.UserName.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException($"Development users must start with '{Prefix}'.");
        }

        services.TryAddSingleton<LdapDirectory>();
        services.Replace(ServiceDescriptor.Singleton<IDirectory>(sp => new DevelopmentDirectory(sp.GetRequiredService<LdapDirectory>(), users)));
        return services;
    }

    public Task<DirectoryUser?> FindUserAsync(string userName, CancellationToken cancellationToken) =>
        Find(userName) is { } user ? Task.FromResult<DirectoryUser?>(ToDirectoryUser(user)) : inner.FindUserAsync(userName, cancellationToken);

    public Task<(DirectoryAuthResult Result, DirectoryUser? User)> AuthenticateAsync(string userName, string password, CancellationToken cancellationToken)
    {
        if (Find(userName) is not { } user)
        {
            return LdapDirectory.NormalizeUserName(userName).StartsWith(Prefix, StringComparison.OrdinalIgnoreCase)
                ? Task.FromResult<(DirectoryAuthResult, DirectoryUser?)>((DirectoryAuthResult.UserNotFound, null))
                : inner.AuthenticateAsync(userName, password, cancellationToken);
        }

        var ok = CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(password ?? string.Empty), Encoding.UTF8.GetBytes(user.Password));
        return Task.FromResult<(DirectoryAuthResult, DirectoryUser?)>(
            (ok ? DirectoryAuthResult.Success : DirectoryAuthResult.InvalidCredentials, ToDirectoryUser(user)));
    }

    private DevelopmentUser? Find(string userName)
    {
        var name = LdapDirectory.NormalizeUserName(userName);
        return users.FirstOrDefault(u => string.Equals(u.UserName, name, StringComparison.OrdinalIgnoreCase));
    }

    // Stable id per test user name, so the same dev account is recognized across restarts.
    private static DirectoryUser ToDirectoryUser(DevelopmentUser user) => new(
        new Guid(SHA256.HashData(Encoding.UTF8.GetBytes("dev-directory:" + user.UserName.ToLowerInvariant()))[..16]),
        user.UserName,
        $"CN={user.DisplayName},OU=Development",
        user.DisplayName,
        null,
        IsEnabled: true,
        IsLockedOut: false,
        Groups: []);
}
