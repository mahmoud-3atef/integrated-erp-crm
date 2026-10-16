using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Json;
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
