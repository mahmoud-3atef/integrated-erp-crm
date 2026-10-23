using Microsoft.AspNetCore.Builder;

namespace IntegratedErp.BuildingBlocks.Web;

public static class SecurityHeaders
{
    /// <summary>
    /// Browser hardening for the app and the API: only our own origin may load scripts, fonts, data and
    /// frames; no framing (clickjacking); no MIME sniffing; no referrer. Inline styles are allowed because
    /// the UI library injects them at runtime.
    /// </summary>
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        return app.Use(async (context, next) =>
        {
            var headers = context.Response.Headers;
            headers["Content-Security-Policy"] =
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
                // blob: previews of files the page itself fetched (a timesheet's attachments), never another origin.
                "frame-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
            await next(context).ConfigureAwait(false);
        });
    }
}
