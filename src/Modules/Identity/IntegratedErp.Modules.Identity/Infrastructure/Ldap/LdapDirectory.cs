using System.DirectoryServices.Protocols;
using System.Net;
using System.Runtime.Versioning;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Identity.Infrastructure.Ldap;

/// <summary>Connection to one Active Directory (per company — docs/02-target-architecture/14 §1.2.1).</summary>
public sealed class LdapOptions
{
    public const string Section = "Identity:Ldap";

    /// <summary>Host name as in the server certificate, e.g. <c>AD.JRCO.LOCAL</c> (not the IP).</summary>
    public string Server { get; set; } = string.Empty;

    public int Port { get; set; } = 636;

    /// <summary>LDAPS. Plain LDAP is refused unless explicitly disabled (never in production).</summary>
    public bool UseSsl { get; set; } = true;

    /// <summary>Search base, e.g. <c>DC=JRCO,DC=LOCAL</c>.</summary>
    public string BaseDn { get; set; } = string.Empty;

    /// <summary>Read-only service account used to find users (e.g. <c>JRCO\svc-erp-ldap</c>). Secret store only.</summary>
    public string BindUser { get; set; } = string.Empty;

    public string BindPassword { get; set; } = string.Empty;

    public int TimeoutSeconds { get; set; } = 10;
}

/// <summary>A directory user as the system needs it.</summary>
public sealed record DirectoryUser(
    Guid ObjectGuid,
    string SamAccountName,
    string DistinguishedName,
    string DisplayName,
    string? Email,
    bool IsEnabled,
    bool IsLockedOut,
    IReadOnlyList<string> Groups);

public enum DirectoryAuthResult
{
    Success,
    InvalidCredentials,
    UserNotFound,
    Disabled,
    LockedOut,
    DirectoryUnavailable,
}

public interface IDirectory
{
    Task<DirectoryUser?> FindUserAsync(string userName, CancellationToken cancellationToken);

    Task<(DirectoryAuthResult Result, DirectoryUser? User)> AuthenticateAsync(string userName, string password, CancellationToken cancellationToken);
}

/// <summary>
/// Active Directory over LDAPS: the service account finds the user, then a second bind with the
/// user's own DN and password proves the password. Passwords are never logged or stored.
/// </summary>
[UnsupportedOSPlatform("browser")]
public sealed class LdapDirectory(IOptions<LdapOptions> options) : IDirectory
{
    private static readonly string[] Attributes =
        ["objectGUID", "sAMAccountName", "distinguishedName", "displayName", "mail", "userAccountControl", "msDS-User-Account-Control-Computed", "memberOf"];

    private const int UacAccountDisabled = 0x2;
    private const int UacLockout = 0x10;

    public Task<DirectoryUser?> FindUserAsync(string userName, CancellationToken cancellationToken) =>
        Task.Run(() => FindUser(userName), cancellationToken);

    public Task<(DirectoryAuthResult Result, DirectoryUser? User)> AuthenticateAsync(string userName, string password, CancellationToken cancellationToken) =>
        Task.Run(() => Authenticate(userName, password), cancellationToken);

    private (DirectoryAuthResult, DirectoryUser?) Authenticate(string userName, string password)
    {
        if (string.IsNullOrEmpty(password))
        {
            // An empty password would be an "unauthenticated bind" that AD accepts — never allow it.
            return (DirectoryAuthResult.InvalidCredentials, null);
        }

        DirectoryUser? user;
        try
        {
            user = FindUser(userName);
        }
        catch (LdapException)
        {
            return (DirectoryAuthResult.DirectoryUnavailable, null);
        }

        if (user is null)
        {
            return (DirectoryAuthResult.UserNotFound, null);
        }

        if (!user.IsEnabled)
        {
            return (DirectoryAuthResult.Disabled, user);
        }

        if (user.IsLockedOut)
        {
            return (DirectoryAuthResult.LockedOut, user);
        }

        try
        {
            using var connection = Connect(new NetworkCredential(user.DistinguishedName, password));
            connection.Bind();
            return (DirectoryAuthResult.Success, user);
        }
        catch (LdapException ex) when (ex.ErrorCode == 49)
        {
            return (DirectoryAuthResult.InvalidCredentials, user);
        }
        catch (LdapException)
        {
            return (DirectoryAuthResult.DirectoryUnavailable, user);
        }
    }

    private DirectoryUser? FindUser(string userName)
    {
        var sam = NormalizeUserName(userName);
        if (sam.Length == 0)
        {
            return null;
        }

        var settings = options.Value;
        using var connection = Connect(new NetworkCredential(settings.BindUser, settings.BindPassword));
        connection.Bind();

        var filter = $"(&(objectCategory=person)(objectClass=user)(sAMAccountName={EscapeFilter(sam)}))";
        var request = new SearchRequest(settings.BaseDn, filter, SearchScope.Subtree, Attributes) { SizeLimit = 2 };
        var response = (SearchResponse)connection.SendRequest(request);

        return response.Entries.Count == 1 ? Map(response.Entries[0]) : null;
    }

    private LdapConnection Connect(NetworkCredential credential)
    {
        var settings = options.Value;
        if (string.IsNullOrWhiteSpace(settings.Server))
        {
            throw new InvalidOperationException($"{LdapOptions.Section}:Server is not configured.");
        }

        var connection = new LdapConnection(new LdapDirectoryIdentifier(settings.Server, settings.Port), credential, AuthType.Basic)
        {
            Timeout = TimeSpan.FromSeconds(settings.TimeoutSeconds),
        };
        connection.SessionOptions.ProtocolVersion = 3;
        connection.SessionOptions.ReferralChasing = ReferralChasingOptions.None;

        if (settings.UseSsl)
        {
            connection.SessionOptions.SecureSocketLayer = true;
            // Standard chain + host-name validation against the trusted (domain) CA.
            connection.SessionOptions.VerifyServerCertificate = (_, certificate) => IsTrusted(certificate, settings.Server);
        }

        return connection;
    }

    private static bool IsTrusted(X509Certificate certificate, string host)
    {
        using var cert = new X509Certificate2(certificate);
        using var chain = new X509Chain();
        chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
        return chain.Build(cert) && cert.MatchesHostname(host);
    }

    private static DirectoryUser Map(SearchResultEntry entry)
    {
        var uac = int.TryParse(Single(entry, "userAccountControl"), out var flags) ? flags : 0;
        var computed = int.TryParse(Single(entry, "msDS-User-Account-Control-Computed"), out var computedFlags) ? computedFlags : 0;
        var guidBytes = entry.Attributes["objectGUID"]?[0] as byte[] ?? throw new InvalidOperationException("Directory entry has no objectGUID.");

        var groups = new List<string>();
        if (entry.Attributes["memberOf"] is { } memberOf)
        {
            foreach (var value in memberOf.GetValues(typeof(string)))
            {
                groups.Add(CommonName((string)value));
            }
        }

        return new DirectoryUser(
            new Guid(guidBytes),
            Single(entry, "sAMAccountName") ?? string.Empty,
            entry.DistinguishedName,
            Single(entry, "displayName") ?? Single(entry, "sAMAccountName") ?? string.Empty,
            Single(entry, "mail"),
            (uac & UacAccountDisabled) == 0,
            (computed & UacLockout) != 0,
            groups);
    }

    private static string? Single(SearchResultEntry entry, string name) =>
        entry.Attributes[name] is { Count: > 0 } attribute ? attribute.GetValues(typeof(string))[0] as string : null;

    private static string CommonName(string dn) =>
        dn.StartsWith("CN=", StringComparison.OrdinalIgnoreCase) && dn.IndexOf(',', StringComparison.Ordinal) is var comma and > 3
            ? dn[3..comma]
            : dn;

    /// <summary><c>JRCO\mahmoud</c>, <c>mahmoud@jrco.local</c> and <c>mahmoud</c> all mean sAMAccountName <c>mahmoud</c>.</summary>
    public static string NormalizeUserName(string userName)
    {
        var value = (userName ?? string.Empty).Trim();
        var slash = value.LastIndexOf('\\');
        if (slash >= 0)
        {
            value = value[(slash + 1)..];
        }

        var at = value.IndexOf('@', StringComparison.Ordinal);
        if (at > 0)
        {
            value = value[..at];
        }

        return value;
    }

    /// <summary>RFC 4515 escaping so user input can't change the search filter (LDAP injection).</summary>
    public static string EscapeFilter(string value)
    {
        ArgumentNullException.ThrowIfNull(value);
        var builder = new StringBuilder(value.Length);
        foreach (var c in value)
        {
            builder.Append(c switch
            {
                '\\' => @"\5c",
                '*' => @"\2a",
                '(' => @"\28",
                ')' => @"\29",
                '\0' => @"\00",
                _ => c.ToString(),
            });
        }

        return builder.ToString();
    }
}
