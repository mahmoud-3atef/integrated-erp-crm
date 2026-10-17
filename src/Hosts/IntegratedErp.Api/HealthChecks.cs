using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace IntegratedErp.Api;

/// <summary>
/// <c>/health</c>: whether the system's database and the old CRM (read-only) answer. Shows each check's state and
/// time only — never connection strings or error text, since the endpoint is open to monitoring without sign-in.
/// </summary>
internal static class HealthChecks
{
    public static IServiceCollection AddPlatformHealthChecks(this IServiceCollection services, IConfiguration configuration)
    {
        var checks = services.AddHealthChecks()
            .Add(new HealthCheckRegistration("database", _ => new SqlHealthCheck(configuration.GetConnectionString("Erp"), readOnly: false), HealthStatus.Unhealthy, ["ready"]));

        // The CRM is needed only for syncing: if it is down the system still works (degraded).
        if (!string.IsNullOrWhiteSpace(configuration["CrmSync:ConnectionString"]))
        {
            checks.Add(new HealthCheckRegistration("crm", _ => new SqlHealthCheck(configuration["CrmSync:ConnectionString"], readOnly: true), HealthStatus.Degraded, ["crm"]));
        }

        return services;
    }

    public static IEndpointConventionBuilder MapPlatformHealthChecks(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapHealthChecks("/health", new HealthCheckOptions
        {
            ResultStatusCodes =
            {
                [HealthStatus.Healthy] = StatusCodes.Status200OK,
                [HealthStatus.Degraded] = StatusCodes.Status200OK,
                [HealthStatus.Unhealthy] = StatusCodes.Status503ServiceUnavailable,
            },
            ResponseWriter = WriteAsync,
        });

    private static Task WriteAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.Headers.CacheControl = "no-store";
        var body = new
        {
            status = report.Status.ToString(),
            durationMs = (int)report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.Select(e => new { name = e.Key, status = e.Value.Status.ToString(), durationMs = (int)e.Value.Duration.TotalMilliseconds }),
        };
        return context.Response.WriteAsync(JsonSerializer.Serialize(body));
    }

    /// <summary>Opens a connection and runs <c>SELECT 1</c> (read-only intent for the CRM).</summary>
    private sealed class SqlHealthCheck(string? connectionString, bool readOnly) : IHealthCheck
    {
        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                return new HealthCheckResult(context.Registration.FailureStatus, "Not configured.");
            }

            var builder = new SqlConnectionStringBuilder(connectionString) { ConnectTimeout = 5 };
            if (readOnly)
            {
                builder.ApplicationIntent = ApplicationIntent.ReadOnly;
            }

            var watch = Stopwatch.StartNew();
            try
            {
                await using var connection = new SqlConnection(builder.ConnectionString);
                await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
                await using var command = new SqlCommand("SELECT 1", connection) { CommandTimeout = 5 };
                await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
                return HealthCheckResult.Healthy($"{watch.ElapsedMilliseconds} ms");
            }
            catch (Exception ex) when (ex is SqlException or InvalidOperationException or TimeoutException)
            {
                return new HealthCheckResult(context.Registration.FailureStatus, "Unreachable.", ex);
            }
        }
    }
}
