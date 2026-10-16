using System.Security.Cryptography;
using System.Text;
using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Identity.Domain;

/// <summary>
/// One person's identity across all companies (docs/02-target-architecture/14 §1.2.1). Sign-in proofs come
/// from an external login (company AD) or a local password; MFA (TOTP) is mandatory before any company access.
/// </summary>
public sealed class UserAccount
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    private readonly List<RecoveryCode> _recoveryCodes = [];

    private UserAccount()
    {
        DisplayName = string.Empty;
    }

    private UserAccount(string displayName, string? email)
    {
        Id = Guid.CreateVersion7();
        DisplayName = displayName;
        Email = email;
        IsActive = true;
    }

    public Guid Id { get; private set; }

    public string DisplayName { get; private set; }

    public string? Email { get; private set; }

    public bool IsActive { get; private set; }

    /// <summary>Platform administrator (can create companies and change system-wide settings).</summary>
    public bool IsPlatformAdmin { get; private set; }

    /// <summary>TOTP secret, encrypted with the data-protection key ring (never stored in clear).</summary>
    public string? MfaSecretProtected { get; private set; }

    public bool MfaEnabled { get; private set; }

    /// <summary>Last accepted TOTP time step — a code can be used once (replay protection).</summary>
    public long? MfaLastTimeStep { get; private set; }

    public int FailedAttempts { get; private set; }

    public DateTimeOffset? LockedUntil { get; private set; }

    public DateTimeOffset? LastSignInAt { get; private set; }

    public IReadOnlyCollection<RecoveryCode> RecoveryCodes => _recoveryCodes;

    public static UserAccount Create(string displayName, string? email)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(displayName);
        return new UserAccount(displayName.Trim(), string.IsNullOrWhiteSpace(email) ? null : email.Trim());
    }

    public void UpdateProfile(string displayName, string? email)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(displayName);
        DisplayName = displayName.Trim();
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
    }

    public void GrantPlatformAdmin() => IsPlatformAdmin = true;

    public bool IsLockedOut(DateTimeOffset now) => LockedUntil is { } until && until > now;

    public void RegisterFailure(DateTimeOffset now)
    {
        FailedAttempts++;
        if (FailedAttempts >= MaxFailedAttempts)
        {
            LockedUntil = now + LockoutDuration;
            FailedAttempts = 0;
        }
    }

    public void RegisterSuccess(DateTimeOffset now)
    {
        FailedAttempts = 0;
        LockedUntil = null;
        LastSignInAt = now;
    }

    /// <summary>Starts (or restarts) MFA enrollment with a new secret; MFA stays off until confirmed.</summary>
    public void BeginMfaEnrollment(string protectedSecret)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(protectedSecret);
        if (MfaEnabled)
        {
            throw new InvalidOperationException("MFA is already enabled; reset it first.");
        }

        MfaSecretProtected = protectedSecret;
    }

    /// <summary>Confirms enrollment with an accepted code; returns new recovery codes (shown once, stored hashed).</summary>
    public IReadOnlyList<string> CompleteMfaEnrollment(long acceptedStep)
    {
        if (MfaSecretProtected is null)
        {
            throw new InvalidOperationException("MFA enrollment was not started.");
        }

        MfaEnabled = true;
        MfaLastTimeStep = acceptedStep;
        return ReplaceRecoveryCodes();
    }

    /// <summary>Accepts a TOTP step only if it is newer than the last one used.</summary>
    public bool TryAcceptStep(long step)
    {
        if (MfaLastTimeStep is { } last && step <= last)
        {
            return false;
        }

        MfaLastTimeStep = step;
        return true;
    }

    public bool TryUseRecoveryCode(string code, DateTimeOffset now)
    {
        var hash = RecoveryCode.Hash(code);
        var match = _recoveryCodes.FirstOrDefault(c => c.UsedAt is null && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(c.CodeHash), Encoding.ASCII.GetBytes(hash)));
        if (match is null)
        {
            return false;
        }

        match.MarkUsed(now);
        return true;
    }

    private List<string> ReplaceRecoveryCodes()
    {
        _recoveryCodes.Clear();
        var codes = Enumerable.Range(0, 8).Select(_ => RecoveryCode.NewCode()).ToList();
        _recoveryCodes.AddRange(codes.Select(c => new RecoveryCode(Id, RecoveryCode.Hash(c))));
        return codes;
    }
}

/// <summary>One-time backup code for MFA (lost phone). Stored as a SHA-256 hash only.</summary>
public sealed class RecoveryCode
{
    private RecoveryCode()
    {
        CodeHash = string.Empty;
    }

    internal RecoveryCode(Guid userAccountId, string codeHash)
    {
        Id = Guid.CreateVersion7();
        UserAccountId = userAccountId;
        CodeHash = codeHash;
    }

    public Guid Id { get; private set; }

    public Guid UserAccountId { get; private set; }

    public string CodeHash { get; private set; }

    public DateTimeOffset? UsedAt { get; private set; }

    internal void MarkUsed(DateTimeOffset at) => UsedAt = at;

    /// <summary>10 Base32 characters (~50 bits), shown as XXXXX-XXXXX.</summary>
    internal static string NewCode()
    {
        var raw = Base32.Encode(RandomNumberGenerator.GetBytes(7))[..10];
        return $"{raw[..5]}-{raw[5..]}";
    }

    internal static string Hash(string code)
    {
        var normalized = (code ?? string.Empty).Replace("-", string.Empty, StringComparison.Ordinal).Trim().ToUpperInvariant();
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalized)));
    }
}

/// <summary>Link between a user account and an identity at a sign-in provider (e.g. AD objectGUID).</summary>
public sealed class ExternalLogin
{
    private ExternalLogin()
    {
        Provider = string.Empty;
        Subject = string.Empty;
        UserName = string.Empty;
    }

    public ExternalLogin(Guid userAccountId, string provider, string subject, string userName)
    {
        Id = Guid.CreateVersion7();
        UserAccountId = userAccountId;
        Provider = provider;
        Subject = subject;
        UserName = userName;
    }

    public Guid Id { get; private set; }

    public Guid UserAccountId { get; private set; }

    /// <summary>Provider key from configuration, e.g. <c>ad-jrco</c>.</summary>
    public string Provider { get; private set; }

    /// <summary>Stable id at the provider (AD objectGUID) — never the user name, which can change.</summary>
    public string Subject { get; private set; }

    /// <summary>Last seen sign-in name (display/search only).</summary>
    public string UserName { get; private set; }

    public void UpdateUserName(string userName) => UserName = userName;
}

/// <summary>A user's access to one company. Roles per company arrive in slice 0.4c.</summary>
public sealed class Membership : ITenantOwned
{
    private Membership()
    {
    }

    public Membership(Guid userAccountId, Guid tenantId)
    {
        Id = Guid.CreateVersion7();
        UserAccountId = userAccountId;
        TenantId = tenantId;
        IsActive = true;
    }

    public Guid Id { get; private set; }

    public Guid UserAccountId { get; private set; }

    public Guid TenantId { get; private set; }

    public bool IsActive { get; private set; }

    public void Deactivate() => IsActive = false;
}

/// <summary>Every sign-in attempt (success or failure) — security log and brute-force throttling.</summary>
public sealed class SignInAttempt
{
    private SignInAttempt()
    {
        UserName = string.Empty;
        Provider = string.Empty;
        Result = string.Empty;
    }

    public SignInAttempt(string userName, string provider, Guid? userAccountId, string result, string? ipAddress, DateTimeOffset occurredAt)
    {
        Id = Guid.CreateVersion7();
        UserName = userName;
        Provider = provider;
        UserAccountId = userAccountId;
        Result = result;
        IpAddress = ipAddress;
        OccurredAt = occurredAt;
    }

    public Guid Id { get; private set; }

    /// <summary>Normalized sign-in name as typed (lower case).</summary>
    public string UserName { get; private set; }

    public string Provider { get; private set; }

    public Guid? UserAccountId { get; private set; }

    /// <summary>Stable result code, e.g. <c>password_ok</c>, <c>invalid_credentials</c>, <c>mfa_failed</c>, <c>throttled</c>.</summary>
    public string Result { get; private set; }

    public string? IpAddress { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    public bool IsFailure => Result is not ("password_ok" or "mfa_ok" or "company_selected");
}
