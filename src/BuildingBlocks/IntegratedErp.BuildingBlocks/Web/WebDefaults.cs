using System.IO.Compression;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.BuildingBlocks.Web;

public static class WebDefaults
{
    /// <summary>
    /// API conventions shared by every module: enums travel as their stable code (text, never a number),
    /// and malformed requests become 400 problem responses instead of 500.
    /// </summary>
    public static IServiceCollection AddWebDefaults(this IServiceCollection services)
    {
        services.Configure<JsonOptions>(options =>
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false)));

        services.AddProblemDetails();
        services.AddExceptionHandler<BadRequestExceptionHandler>();

        // Compressed responses (Brotli, else gzip): a report's JSON is 5–10 times smaller, which is what a page opened
        // from outside (through the tunnel, on the server's upload) waits for. The fastest level: the CPU stays free.
        // The live feed (text/event-stream) is not in the list, so its events are never held back.
        services.AddResponseCompression(options =>
        {
            options.EnableForHttps = true;
            options.Providers.Add<BrotliCompressionProvider>();
            options.Providers.Add<GzipCompressionProvider>();
        });
        services.Configure<BrotliCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);
        services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);

        return services;
    }
}

/// <summary>Turns request-binding failures (bad JSON, unknown enum code) into 400 Problem Details.</summary>
internal sealed class BadRequestExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not BadHttpRequestException badRequest)
        {
            return false;
        }

        httpContext.Response.StatusCode = badRequest.StatusCode;

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails =
            {
                Status = badRequest.StatusCode,
                Title = "The request is invalid.",
                Detail = badRequest.InnerException?.Message ?? badRequest.Message,
            },
        }).ConfigureAwait(false);
    }
}
