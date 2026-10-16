using System.Security.Claims;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Identity.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Identity.Api;

/// <summary>
/// Sign-in endpoints: <c>login</c> (password) ⇒ <c>mfa/setup</c> or <c>mfa/verify</c> ⇒ <c>select-company</c>.
/// Between steps the client holds only the short-lived pending cookie; the session cookie is issued
/// once MFA is done and a company is chosen.
/// </summary>
internal static class AuthEndpoints
{
    public const string RateLimitPolicy = "auth";
    private const string StageClaim = "stage";

    public sealed record LoginRequest(string UserName, string Password);

    public sealed record MfaCodeRequest(string? Code, string? RecoveryCode);

    public sealed record SelectCompanyRequest(Guid CompanyId);

    public sealed record StepResponse(
        string Next,
        string DisplayName,
        string? MfaSetupUri,
        string? MfaSetupSecret,
        IReadOnlyList<string>? RecoveryCodes,
        IReadOnlyList<CompanyOption>? Companies,
        CompanyOption? Company);

    public sealed record MeResponse(Guid UserId, string DisplayName, bool IsPlatformAdmin, CompanyOption? Company, IReadOnlyList<CompanyOption> Companies, IReadOnlyList<string> Permissions, IReadOnlyList<string> CompanyWidePermissions);

    public static void MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/auth").WithTags("Auth").RequireRateLimiting(RateLimitPolicy);

        group.MapPost("/login", async (LoginRequest request, HttpContext http, SignInService service, CancellationToken ct) =>
        {
            await http.SignOutAllAsync().ConfigureAwait(false);
            var result = await service.PasswordAsync(request.UserName, request.Password, Ip(http), ct).ConfigureAwait(false);
            return await ContinueAsync(http, result).ConfigureAwait(false);
        }).AllowAnonymous();

        group.MapPost("/mfa/setup", async (MfaCodeRequest request, HttpContext http, SignInService service, CancellationToken ct) =>
        {
            if (await PendingUserAsync(http, SignInNext.MfaSetup).ConfigureAwait(false) is not { } userId)
            {
                return Results.Unauthorized();
            }

            var result = await service.ConfirmMfaSetupAsync(userId, request.Code ?? string.Empty, Ip(http), ct).ConfigureAwait(false);
            return await ContinueAsync(http, result).ConfigureAwait(false);
        }).AllowAnonymous();

        group.MapPost("/mfa/verify", async (MfaCodeRequest request, HttpContext http, SignInService service, CancellationToken ct) =>
        {
            if (await PendingUserAsync(http, SignInNext.Mfa).ConfigureAwait(false) is not { } userId)
            {
                return Results.Unauthorized();
            }

            var result = await service.VerifyMfaAsync(userId, request.Code, request.RecoveryCode, Ip(http), ct).ConfigureAwait(false);
            return await ContinueAsync(http, result).ConfigureAwait(false);
        }).AllowAnonymous();

        // Choose a company after MFA, or switch company within a session.
        group.MapPost("/select-company", async (SelectCompanyRequest request, HttpContext http, SignInService service, CancellationToken ct) =>
        {
            var userId = await PendingUserAsync(http, SignInNext.ChooseCompany).ConfigureAwait(false)
                ?? (await http.AuthenticateAsync(PlatformAuthentication.SessionScheme).ConfigureAwait(false)).Principal?.GetUserAccountId();
            if (userId is null)
            {
                return Results.Unauthorized();
            }

            var result = await service.SelectCompanyAsync(userId.Value, request.CompanyId, Ip(http), ct).ConfigureAwait(false);
            if (result.IsFailure)
            {
                return Results.Problem(result.Error.Message, statusCode: StatusCodes.Status403Forbidden, title: result.Error.Code);
            }

            return await ContinueAsync(http, result).ConfigureAwait(false);
        }).AllowAnonymous();

        group.MapGet("/me", async (HttpContext http, IServiceScopeFactory scopes, IPermissionService permissions, CancellationToken ct) =>
        {
            var user = http.User;
            var userId = user.GetUserAccountId()!.Value;

            // Listing companies reads across tenants (a system operation): done in its own scope so this
            // request keeps the user's own tenant and identity for everything else.
            IReadOnlyList<CompanyOption> companies;
            using (var scope = scopes.CreateScope())
            {
                companies = await scope.ServiceProvider.GetRequiredService<SignInService>().CompaniesAsync(userId, ct).ConfigureAwait(false);
            }

            var tenantId = user.FindFirstValue(ErpClaims.TenantId);
            var mine = await permissions.GetCurrentAsync(ct).ConfigureAwait(false);
            var codes = mine.Codes.Order(StringComparer.Ordinal).ToList();
            return Results.Ok(new MeResponse(
                userId,
                user.FindFirstValue(ErpClaims.Name) ?? string.Empty,
                user.HasClaim(ErpClaims.PlatformAdmin, "true"),
                companies.FirstOrDefault(c => c.Id.ToString() == tenantId),
                companies,
                codes,
                codes.Where(c => mine.LegalEntitiesFor(c) is null).ToList()));
        }).RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapPost("/logout", async (HttpContext http) =>
        {
            await http.SignOutAllAsync().ConfigureAwait(false);
            return Results.NoContent();
        }).AllowAnonymous();
    }

    private static async Task<IResult> ContinueAsync(HttpContext http, Result<SignInStep> result)
    {
        if (result.IsFailure)
        {
            var status = result.Error == SignInService.Throttled ? StatusCodes.Status429TooManyRequests
                : result.Error == SignInService.LockedOut ? StatusCodes.Status423Locked
                : result.Error == SignInService.DirectoryUnavailable ? StatusCodes.Status503ServiceUnavailable
                : StatusCodes.Status401Unauthorized;
            return Results.Problem(result.Error.Message, statusCode: status, title: result.Error.Code);
        }

        var step = result.Value;
        if (step.Next == SignInNext.Done && step.Company is { } company)
        {
            var claims = new List<Claim>
            {
                new(ErpClaims.UserId, step.UserAccountId.ToString()),
                new(ErpClaims.Name, step.DisplayName),
                new(ErpClaims.TenantId, company.Id.ToString()),
                new(ErpClaims.AuthMethods, "pwd"),
                new(ErpClaims.AuthMethods, "otp"),
            };
            if (step.IsPlatformAdmin)
            {
                claims.Add(new Claim(ErpClaims.PlatformAdmin, "true"));
            }

            await http.SignOutAsync(PlatformAuthentication.PendingScheme).ConfigureAwait(false);
            await http.SignInAsync(
                PlatformAuthentication.SessionScheme,
                new ClaimsPrincipal(new ClaimsIdentity(claims, PlatformAuthentication.SessionScheme, ErpClaims.Name, null))).ConfigureAwait(false);
        }
        else if (step.Next is SignInNext.MfaSetup or SignInNext.Mfa or SignInNext.ChooseCompany)
        {
            var pending = new ClaimsIdentity(
                [
                    new Claim(ErpClaims.UserId, step.UserAccountId.ToString()),
                    new Claim(ErpClaims.Name, step.DisplayName),
                    new Claim(StageClaim, step.Next.ToString()),
                ],
                PlatformAuthentication.PendingScheme);
            await http.SignInAsync(PlatformAuthentication.PendingScheme, new ClaimsPrincipal(pending)).ConfigureAwait(false);
        }
        else
        {
            await http.SignOutAllAsync().ConfigureAwait(false);
        }

        return Results.Ok(new StepResponse(
            ToCode(step.Next), step.DisplayName, step.MfaSetupUri, step.MfaSetupSecret, step.RecoveryCodes, step.Companies, step.Company));
    }

    private static async Task<Guid?> PendingUserAsync(HttpContext http, SignInNext expectedStage)
    {
        var pending = await http.AuthenticateAsync(PlatformAuthentication.PendingScheme).ConfigureAwait(false);
        return pending.Succeeded && pending.Principal!.FindFirstValue(StageClaim) == expectedStage.ToString()
            ? pending.Principal.GetUserAccountId()
            : null;
    }

    private static string ToCode(SignInNext next) => next switch
    {
        SignInNext.MfaSetup => "mfa_setup",
        SignInNext.Mfa => "mfa",
        SignInNext.ChooseCompany => "choose_company",
        SignInNext.Done => "done",
        SignInNext.NoCompany => "no_company",
        _ => throw new ArgumentOutOfRangeException(nameof(next)),
    };

    private static string? Ip(HttpContext http) => http.Connection.RemoteIpAddress?.ToString();
}
