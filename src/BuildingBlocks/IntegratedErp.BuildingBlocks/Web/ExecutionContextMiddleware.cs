using IntegratedErp.BuildingBlocks.Context;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.BuildingBlocks.Web;

/// <summary>
/// Establishes the tenant and user of each request.
/// Until authentication (slice 0.4) they can come from the <c>X-Tenant-Id</c> / <c>X-User</c> headers,
/// and only when <c>Platform:DevContextHeaders</c> is true (Development). After 0.4 they come from the token.
/// </summary>
public static class ExecutionContextMiddleware
{
    public const string TenantHeader = "X-Tenant-Id";
    public const string UserHeader = "X-User";

    public static IApplicationBuilder UseExecutionContext(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var allowDevHeaders = app.ApplicationServices.GetRequiredService<IConfiguration>()
            .GetValue("Platform:DevContextHeaders", defaultValue: false);

        return app.Use(async (context, next) =>
        {
            if (allowDevHeaders)
            {
                var accessor = context.RequestServices.GetRequiredService<ExecutionContextAccessor>();

                if (context.Request.Headers.TryGetValue(TenantHeader, out var tenantValue))
                {
                    if (!Guid.TryParse(tenantValue, out var tenantId) || tenantId == Guid.Empty)
                    {
                        context.Response.StatusCode = StatusCodes.Status400BadRequest;
                        await context.Response.WriteAsJsonAsync(new { title = $"Header {TenantHeader} must be a tenant id." }).ConfigureAwait(false);
                        return;
                    }

                    accessor.SetTenant(tenantId);
                }

                if (context.Request.Headers.TryGetValue(UserHeader, out var user) && !string.IsNullOrWhiteSpace(user))
                {
                    accessor.SetUser(user.ToString(), user.ToString());
                }
            }

            await next(context).ConfigureAwait(false);
        });
    }
}
