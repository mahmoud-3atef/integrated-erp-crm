using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Identity.Infrastructure.Ldap;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Identity.Application;

public sealed class IdentityOptions
{
    public const string Section = "Identity";

    /// <summary>Key of the configured AD provider; stored on external logins.</summary>
    public string DirectoryProvider { get; set; } = "ad";

    /// <summary>First-run setup: these AD accounts get platform-admin and membership in <see cref="BootstrapTenantCode"/>.</summary>
    public IList<string> BootstrapAdmins { get; } = [];

    public string? BootstrapTenantCode { get; set; }

    /// <summary>
    /// Two-step verification at sign-in (on by default). Turned off only in a server's own settings for a limited test
    /// period; the system logs a warning at every start while it is off.
    /// </summary>
    public bool MfaRequired { get; set; } = true;
}

/// <summary>Where a sign-in stands and what the client must do next.</summary>
public enum SignInNext
{
    MfaSetup,
    Mfa,
    ChooseCompany,
    Done,
    NoCompany,
}

public sealed record CompanyOption(Guid Id, string Code, string NameAr, string NameEn);

public sealed record SignInStep(
    SignInNext Next,
    Guid UserAccountId,
    string DisplayName,
    bool IsPlatformAdmin,
    string? MfaSetupUri = null,
    string? MfaSetupSecret = null,
    IReadOnlyList<string>? RecoveryCodes = null,
    IReadOnlyList<CompanyOption>? Companies = null,
    CompanyOption? Company = null);

/// <summary>
/// Sign-in: password (company AD) ⇒ MFA (mandatory; enrolled on first sign-in) ⇒ company choice.
/// Brute force is limited by name (before AD is contacted, protecting the AD account too) and by account.
/// Every attempt is logged. Error messages never reveal whether a user exists.
/// </summary>
internal sealed class SignInService(
    IdentityDbContext db,
    IDirectory directory,
    IDataProtectionProvider dataProtection,
    IClock clock,
    ITenantDirectory tenants,
    ExecutionContextAccessor context,
    IOptions<IdentityOptions> options)
{
    public const int MaxFailuresPerName = 5;
    public static readonly TimeSpan FailureWindow = TimeSpan.FromMinutes(15);

    public static readonly Error InvalidCredentials = Error.Validation("invalid_credentials", "Wrong user name or password.");
    public static readonly Error Throttled = Error.Validation("too_many_attempts", "Too many failed attempts. Try again later.");
    public static readonly Error LockedOut = Error.Validation("account_locked", "The account is temporarily locked. Try again later.");
    public static readonly Error DirectoryUnavailable = Error.Validation("directory_unavailable", "The sign-in service is unavailable. Try again later.");
    public static readonly Error InvalidCode = Error.Validation("invalid_mfa_code", "The verification code is not valid.");
    public static readonly Error NotAMember = Error.Validation("not_a_member", "You do not have access to this company.");

    private IDataProtector Protector => dataProtection.CreateProtector("Identity.MfaSecret.v1");

    public async Task<Result<SignInStep>> PasswordAsync(string userName, string password, string? ipAddress, CancellationToken cancellationToken)
    {
        // Sign-in reads identity data across companies; it is a system operation.
        context.RunAsSystem("sign-in");
        var provider = options.Value.DirectoryProvider;
        var name = LdapDirectory.NormalizeUserName(userName).ToLowerInvariant();
        var now = clock.UtcNow;

        if (name.Length == 0)
        {
            return Result.Failure<SignInStep>(InvalidCredentials);
        }

        var since = now - FailureWindow;
        var recentFailures = await db.SignInAttempts.CountAsync(
            a => a.UserName == name && a.OccurredAt >= since && a.Result != "password_ok" && a.Result != "mfa_ok" && a.Result != "company_selected",
            cancellationToken).ConfigureAwait(false);
        if (recentFailures >= MaxFailuresPerName)
        {
            await LogAsync(name, provider, null, "throttled", ipAddress, cancellationToken).ConfigureAwait(false);
            return Result.Failure<SignInStep>(Throttled);
        }

        var (outcome, directoryUser) = await directory.AuthenticateAsync(name, password, cancellationToken).ConfigureAwait(false);
        var login = directoryUser is null ? null : await db.ExternalLogins
            .FirstOrDefaultAsync(l => l.Provider == provider && l.Subject == directoryUser.ObjectGuid.ToString(), cancellationToken)
            .ConfigureAwait(false);
        var account = login is null ? null : await LoadAccountAsync(login.UserAccountId, cancellationToken).ConfigureAwait(false);

        if (account is not null && account.IsLockedOut(now))
        {
            await LogAsync(name, provider, account.Id, "locked_out", ipAddress, cancellationToken).ConfigureAwait(false);
            return Result.Failure<SignInStep>(LockedOut);
        }

        if (outcome != DirectoryAuthResult.Success || directoryUser is null)
        {
            account?.RegisterFailure(now);
            await LogAsync(name, provider, account?.Id, ResultCode(outcome), ipAddress, cancellationToken).ConfigureAwait(false);
            return Result.Failure<SignInStep>(outcome == DirectoryAuthResult.DirectoryUnavailable ? DirectoryUnavailable : InvalidCredentials);
        }

        if (account is null)
        {
            // First sign-in of this AD user: create the identity (no company access until a membership exists).
            account = UserAccount.Create(directoryUser.DisplayName, directoryUser.Email);
            db.Users.Add(account);
            db.ExternalLogins.Add(new ExternalLogin(account.Id, provider, directoryUser.ObjectGuid.ToString(), directoryUser.SamAccountName));
        }
        else
        {
            account.UpdateProfile(directoryUser.DisplayName, directoryUser.Email);
            login!.UpdateUserName(directoryUser.SamAccountName);
        }

        if (!account.IsActive)
        {
            await LogAsync(name, provider, account.Id, "account_inactive", ipAddress, cancellationToken).ConfigureAwait(false);
            return Result.Failure<SignInStep>(InvalidCredentials);
        }

        await ApplyBootstrapAsync(account, directoryUser.SamAccountName, cancellationToken).ConfigureAwait(false);

        SignInStep step;
        if (!options.Value.MfaRequired)
        {
            // Two-step verification is switched off for this server (test period): the password is enough.
            // Saved with the log entry (with a first sign-in's account and bootstrap access) before companies are read.
            account.RegisterSuccess(now);
            await LogAsync(name, provider, account.Id, "password_ok_mfa_off", ipAddress, cancellationToken).ConfigureAwait(false);
            var companies = await CompaniesAsync(account.Id, cancellationToken).ConfigureAwait(false);
            return Result.Success(companies.Count switch
            {
                0 => new SignInStep(SignInNext.NoCompany, account.Id, account.DisplayName, account.IsPlatformAdmin, Companies: companies),
                1 => new SignInStep(SignInNext.Done, account.Id, account.DisplayName, account.IsPlatformAdmin, Companies: companies, Company: companies[0]),
                _ => new SignInStep(SignInNext.ChooseCompany, account.Id, account.DisplayName, account.IsPlatformAdmin, Companies: companies),
            });
        }

        if (account.MfaEnabled)
        {
            step = new SignInStep(SignInNext.Mfa, account.Id, account.DisplayName, account.IsPlatformAdmin);
        }
        else
        {
            var secret = Totp.NewSecret();
            account.BeginMfaEnrollment(Protector.Protect(Base32.Encode(secret)));
            step = new SignInStep(
                SignInNext.MfaSetup, account.Id, account.DisplayName, account.IsPlatformAdmin,
                MfaSetupUri: Totp.ProvisioningUri(secret, directoryUser.SamAccountName),
                MfaSetupSecret: Base32.Encode(secret));
        }

        await LogAsync(name, provider, account.Id, "password_ok", ipAddress, cancellationToken).ConfigureAwait(false);
        return Result.Success(step);
    }

    /// <summary>Confirms MFA enrollment (first sign-in) with a code from the authenticator app.</summary>
    public async Task<Result<SignInStep>> ConfirmMfaSetupAsync(Guid userAccountId, string code, string? ipAddress, CancellationToken cancellationToken)
    {
        context.RunAsSystem("sign-in");
        var account = await LoadAccountAsync(userAccountId, cancellationToken).ConfigureAwait(false);
        if (account is null || account.MfaEnabled || account.MfaSecretProtected is null)
        {
            return Result.Failure<SignInStep>(InvalidCode);
        }

        var step = Totp.Verify(Base32.Decode(Protector.Unprotect(account.MfaSecretProtected)), code, clock.UtcNow);
        if (step is null)
        {
            account.RegisterFailure(clock.UtcNow);
            await LogAsync(account.DisplayName, "mfa", account.Id, "mfa_failed", ipAddress, cancellationToken).ConfigureAwait(false);
            return Result.Failure<SignInStep>(InvalidCode);
        }

        var recoveryCodes = account.CompleteMfaEnrollment(step.Value);
        var next = await AfterMfaAsync(account, ipAddress, cancellationToken).ConfigureAwait(false);
        return Result.Success(next with { RecoveryCodes = recoveryCodes });
    }

    /// <summary>Second factor on later sign-ins: a TOTP code or a one-time recovery code.</summary>
    public async Task<Result<SignInStep>> VerifyMfaAsync(Guid userAccountId, string? code, string? recoveryCode, string? ipAddress, CancellationToken cancellationToken)
    {
        context.RunAsSystem("sign-in");
        var now = clock.UtcNow;
        var account = await LoadAccountAsync(userAccountId, cancellationToken).ConfigureAwait(false);
        if (account is null || !account.MfaEnabled || account.MfaSecretProtected is null)
        {
            return Result.Failure<SignInStep>(InvalidCode);
        }

        if (account.IsLockedOut(now))
        {
            return Result.Failure<SignInStep>(LockedOut);
        }

        var ok = false;
        if (!string.IsNullOrWhiteSpace(code))
        {
            var step = Totp.Verify(Base32.Decode(Protector.Unprotect(account.MfaSecretProtected)), code, now);
            ok = step is not null && account.TryAcceptStep(step.Value);
        }
        else if (!string.IsNullOrWhiteSpace(recoveryCode))
        {
            ok = account.TryUseRecoveryCode(recoveryCode, now);
        }

        if (!ok)
        {
            account.RegisterFailure(now);
            await LogAsync(account.DisplayName, "mfa", account.Id, "mfa_failed", ipAddress, cancellationToken).ConfigureAwait(false);
            return Result.Failure<SignInStep>(InvalidCode);
        }

        return Result.Success(await AfterMfaAsync(account, ipAddress, cancellationToken).ConfigureAwait(false));
    }

    /// <summary>The companies the user can enter.</summary>
    public async Task<IReadOnlyList<CompanyOption>> CompaniesAsync(Guid userAccountId, CancellationToken cancellationToken)
    {
        context.RunAsSystem("sign-in");
        var tenantIds = await db.Memberships.AsNoTracking()
            .Where(m => m.UserAccountId == userAccountId && m.IsActive)
            .Select(m => m.TenantId)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return (await tenants.GetAsync(tenantIds, cancellationToken).ConfigureAwait(false))
            .Where(t => t.IsActive)
            .Select(t => new CompanyOption(t.Id, t.Code, t.NameAr, t.NameEn))
            .ToList();
    }

    public async Task<Result<SignInStep>> SelectCompanyAsync(Guid userAccountId, Guid tenantId, string? ipAddress, CancellationToken cancellationToken)
    {
        var companies = await CompaniesAsync(userAccountId, cancellationToken).ConfigureAwait(false);
        var company = companies.FirstOrDefault(c => c.Id == tenantId);
        var account = await LoadAccountAsync(userAccountId, cancellationToken).ConfigureAwait(false);
        if (company is null || account is null)
        {
            return Result.Failure<SignInStep>(NotAMember);
        }

        await LogAsync(account.DisplayName, "company", account.Id, "company_selected", ipAddress, cancellationToken).ConfigureAwait(false);
        return Result.Success(new SignInStep(SignInNext.Done, account.Id, account.DisplayName, account.IsPlatformAdmin, Companies: companies, Company: company));
    }

    private async Task<SignInStep> AfterMfaAsync(UserAccount account, string? ipAddress, CancellationToken cancellationToken)
    {
        account.RegisterSuccess(clock.UtcNow);
        await LogAsync(account.DisplayName, "mfa", account.Id, "mfa_ok", ipAddress, cancellationToken).ConfigureAwait(false);

        var companies = await CompaniesAsync(account.Id, cancellationToken).ConfigureAwait(false);
        return companies.Count switch
        {
            0 => new SignInStep(SignInNext.NoCompany, account.Id, account.DisplayName, account.IsPlatformAdmin, Companies: companies),
            1 => new SignInStep(SignInNext.Done, account.Id, account.DisplayName, account.IsPlatformAdmin, Companies: companies, Company: companies[0]),
            _ => new SignInStep(SignInNext.ChooseCompany, account.Id, account.DisplayName, account.IsPlatformAdmin, Companies: companies),
        };
    }

    private async Task ApplyBootstrapAsync(UserAccount account, string samAccountName, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        if (!settings.BootstrapAdmins.Any(a => string.Equals(LdapDirectory.NormalizeUserName(a), samAccountName, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        account.GrantPlatformAdmin();
        if (settings.BootstrapTenantCode is not { Length: > 0 } code
            || await tenants.FindByCodeAsync(code, cancellationToken).ConfigureAwait(false) is not { } tenant)
        {
            return;
        }

        // First-run access: member of the bootstrap company with the administrator role (for all registrations).
        var membership = await db.Memberships.FirstOrDefaultAsync(m => m.UserAccountId == account.Id && m.TenantId == tenant.Id, cancellationToken).ConfigureAwait(false);
        if (membership is null)
        {
            membership = new Membership(account.Id, tenant.Id);
            db.Memberships.Add(membership);
        }

        var admin = await RoleSeeder.EnsureBuiltInRolesAsync(db, tenant.Id, cancellationToken).ConfigureAwait(false);
        if (!await db.RoleAssignments.AnyAsync(a => a.MembershipId == membership.Id && a.RoleId == admin.Id && a.LegalEntityId == null, cancellationToken).ConfigureAwait(false))
        {
            db.RoleAssignments.Add(new RoleAssignment(membership.Id, admin.Id, null, tenant.Id));
        }
    }

    private Task<UserAccount?> LoadAccountAsync(Guid id, CancellationToken cancellationToken) =>
        db.Users.Include(u => u.RecoveryCodes).FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

    private async Task LogAsync(string userName, string provider, Guid? accountId, string result, string? ipAddress, CancellationToken cancellationToken)
    {
        db.SignInAttempts.Add(new SignInAttempt(userName.ToLowerInvariant(), provider, accountId, result, ipAddress, clock.UtcNow));
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    private static string ResultCode(DirectoryAuthResult outcome) => outcome switch
    {
        DirectoryAuthResult.InvalidCredentials => "invalid_credentials",
        DirectoryAuthResult.UserNotFound => "user_not_found",
        DirectoryAuthResult.Disabled => "disabled",
        DirectoryAuthResult.LockedOut => "directory_locked_out",
        DirectoryAuthResult.DirectoryUnavailable => "directory_unavailable",
        _ => "failed",
    };
}
