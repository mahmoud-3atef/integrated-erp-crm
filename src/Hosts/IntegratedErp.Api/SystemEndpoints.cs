using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Live;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Security;
using Microsoft.AspNetCore.Http.Features;

namespace IntegratedErp.Api;

internal static class SystemEndpoints
{
    public static IEndpointRouteBuilder MapSystemEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/system").WithTags("System");

        // Which modules this deployment knows and which are switched on.
        group.MapGet("/modules", (ModuleRegistry registry) => Results.Ok(registry.Describe()))
            .WithName("SystemModules")
            .RequireAuthorization(PlatformPolicies.CompanyUser);

        // The company's changes as they are saved (server-sent events): the modules' names only, for open pages to refresh.
        group.MapGet("/live", LiveAsync)
            .WithName("SystemLive")
            .RequireAuthorization(PlatformPolicies.CompanyUser)
            .ExcludeFromDescription();

        return endpoints;
    }

    private static async Task LiveAsync(HttpContext http, LiveChanges live, ITenantContext tenant, CancellationToken cancellationToken)
    {
        if (tenant.TenantId is not { } tenantId)
        {
            http.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        http.Response.ContentType = "text/event-stream";
        http.Response.Headers.CacheControl = "no-cache, no-transform";
        http.Response.Headers["X-Accel-Buffering"] = "no";
        http.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        using var subscription = live.Subscribe(tenantId);
        // A stream lasts ten minutes; the browser opens the next one by itself, signed in again (an ended session ends it).
        using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        lifetime.CancelAfter(TimeSpan.FromMinutes(10));
        try
        {
            await WriteAsync(http, "retry: 5000\n: open\n\n", lifetime.Token).ConfigureAwait(false);
            while (!lifetime.IsCancellationRequested)
            {
                using var beat = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token);
                beat.CancelAfter(TimeSpan.FromSeconds(25));
                string message;
                try
                {
                    var areas = new SortedSet<string>(StringComparer.Ordinal) { await subscription.Reader.ReadAsync(beat.Token).ConfigureAwait(false) };
                    while (subscription.Reader.TryRead(out var more))
                    {
                        areas.Add(more);
                    }

                    message = $"event: change\ndata: {string.Join(',', areas)}\n\n";
                }
                catch (OperationCanceledException) when (!lifetime.IsCancellationRequested)
                {
                    // A heartbeat, so proxies keep the stream open.
                    message = ": ping\n\n";
                }

                await WriteAsync(http, message, lifetime.Token).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException)
        {
            // The page closed, or the stream's ten minutes ended.
        }
    }

    private static async Task WriteAsync(HttpContext http, string text, CancellationToken cancellationToken)
    {
        await http.Response.WriteAsync(text, cancellationToken).ConfigureAwait(false);
        await http.Response.Body.FlushAsync(cancellationToken).ConfigureAwait(false);
    }
}
