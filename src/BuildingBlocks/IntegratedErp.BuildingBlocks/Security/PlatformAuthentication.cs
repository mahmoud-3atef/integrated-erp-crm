using System.Security.Claims;
using IntegratedErp.BuildingBlocks.Context;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace IntegratedErp.BuildingBlocks.Security;

/// <summary>Claim types carried in the session (kept small; permissions are loaded per request).</summary>
public static class ErpClaims
{
    public const string UserId = "sub";
    public const string Name = "name";
    public const string TenantId = "tenant_id";
    public const string PlatformAdmin = "platform_admin";
    public const string AuthMethods = "amr";
}

/// <summary>
/// Web sign-in (docs/02-target-architecture/14 §4): an encrypted, HttpOnly, SameSite=Strict session cookie
/// issued after password + MFA and the company choice. A second short-lived cookie holds a sign-in that is
/// still in progress (password checked, MFA or company choice pending). Mobile/external clients get tokens later.
/// </summary>
public static class PlatformAuthentication
{
    public const string SessionScheme = "erp";
    public const string PendingScheme = "erp.pending";
    public const string CsrfHeader = "X-ERP-CSRF";

    public static IServiceCollection AddPlatformAuthentication(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(environment);

        // Keys that encrypt cookies and protected values (MFA secrets). Persisted so sessions survive restarts;
        // on Windows the key ring itself is encrypted with DPAPI.
        var keysPath = configuration["Platform:KeysPath"] is { Length: > 0 } configured
            ? configured
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "IntegratedErp", "keys");
        var dataProtection = services.AddDataProtection()
            .SetApplicationName("IntegratedErp")
            .PersistKeysToFileSystem(new DirectoryInfo(keysPath));
        if (OperatingSystem.IsWindows())
        {
            // On a server the app runs as an IIS app pool: protect the keys for the machine (the folder's permissions
            // limit who can read them) rather than for a user profile that the pool may not load.
            dataProtection.ProtectKeysWithDpapi(protectToLocalMachine: configuration.GetValue("Platform:KeysMachineScope", false));
        }

        var secure = environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;

        services.AddAuthentication(SessionScheme)
            .AddCookie(SessionScheme, options =>
            {
                options.Cookie.Name = "erp.session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.Cookie.SecurePolicy = secure;
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.SlidingExpiration = true;
                UseApiResponses(options);
            })
            .AddCookie(PendingScheme, options =>
            {
                options.Cookie.Name = "erp.pending";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.Cookie.SecurePolicy = secure;
                options.ExpireTimeSpan = TimeSpan.FromMinutes(5);
                options.SlidingExpiration = false;
                UseApiResponses(options);
            });

        services.AddAuthorizationBuilder()
            .AddPolicy(PlatformPolicies.CompanyUser, policy => policy
                .AddAuthenticationSchemes(SessionScheme)
                .RequireAuthenticatedUser()
                .RequireClaim(ErpClaims.TenantId))
            .AddPolicy(PlatformPolicies.PlatformAdmin, policy => policy
                .AddAuthenticationSchemes(SessionScheme)
                .RequireAuthenticatedUser()
                .RequireClaim(ErpClaims.PlatformAdmin, "true"));

        return services;
    }

    /// <summary>
    /// After authentication: CSRF check for cookie-authenticated state changes, then the execution context
    /// (tenant + user) from the session claims.
    /// </summary>
    public static IApplicationBuilder UsePlatformSecurity(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.UseAuthentication();

        app.Use(async (context, next) =>
        {
            // SameSite=Strict already blocks cross-site cookies; the custom header is a second guard
            // (a cross-site page cannot add it without a CORS pre-flight, which we never allow).
            if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method)
                && !HttpMethods.IsOptions(context.Request.Method)
                && (context.Request.Cookies.ContainsKey("erp.session") || context.Request.Cookies.ContainsKey("erp.pending"))
                && !context.Request.Headers.ContainsKey(CsrfHeader))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { title = $"Missing {CsrfHeader} header." }).ConfigureAwait(false);
                return;
            }

            var user = context.User;
            if (user.Identity?.IsAuthenticated == true)
            {
                var accessor = context.RequestServices.GetRequiredService<ExecutionContextAccessor>();
                accessor.SetUser(user.FindFirstValue(ErpClaims.UserId), user.FindFirstValue(ErpClaims.Name) ?? "user");
                if (Guid.TryParse(user.FindFirstValue(ErpClaims.TenantId), out var tenantId))
                {
                    accessor.SetTenant(tenantId);
                }
            }

            await next(context).ConfigureAwait(false);
        });

        app.UseAuthorization();
        return app;
    }

    private static void UseApiResponses(CookieAuthenticationOptions options)
    {
        // An API: answer 401/403, never redirect to a login page.
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    }
}

public static class PlatformPolicies
{
    /// <summary>Signed in (password + MFA) with a company selected.</summary>
    public const string CompanyUser = "company-user";

    /// <summary>Platform administrators (create companies, system settings).</summary>
    public const string PlatformAdmin = "platform-admin";
}

public static class ClaimsPrincipalExtensions
{
    public static Guid? GetUserAccountId(this ClaimsPrincipal principal) =>
        Guid.TryParse(principal?.FindFirstValue(ErpClaims.UserId), out var id) ? id : null;

    public static Task SignOutAllAsync(this HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        return Task.WhenAll(
            context.SignOutAsync(PlatformAuthentication.SessionScheme),
            context.SignOutAsync(PlatformAuthentication.PendingScheme));
    }
}
