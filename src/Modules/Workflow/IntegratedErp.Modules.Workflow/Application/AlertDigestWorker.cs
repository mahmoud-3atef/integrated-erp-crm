using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace IntegratedErp.Modules.Workflow.Application;

/// <summary>
/// Sends each company's morning alert digest once a day, from <c>Alerts:DigestHour</c> (Riyadh time, default 7):
/// checked every half hour, so a server started later in the day still sends it.
/// </summary>
internal sealed partial class AlertDigestWorker(IServiceScopeFactory scopes, IConfiguration configuration, ILogger<AlertDigestWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromMinutes(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var hour = configuration.GetValue("Alerts:DigestHour", 7);
        if (hour < 0)
        {
            LogOff(logger);
            return;
        }

        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken).ConfigureAwait(false); // let the server start
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RoundAsync(hour, stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogFailed(logger, ex);
            }

            await Task.Delay(Every, stoppingToken).ConfigureAwait(false);
        }
    }

    private async Task RoundAsync(int hour, CancellationToken stoppingToken)
    {
        IReadOnlyList<TenantInfo> companies;
        using (var lookup = scopes.CreateScope())
        {
            var clock = lookup.ServiceProvider.GetRequiredService<IClock>();
            if (clock.UtcNow.ToOffset(TimeSpan.FromHours(3)).Hour < hour)
            {
                return;
            }

            var context = lookup.ServiceProvider.GetRequiredService<ExecutionContextAccessor>();
            context.RunAsSystem("alerts");
            companies = await lookup.ServiceProvider.GetRequiredService<ITenantDirectory>().ActiveAsync(stoppingToken).ConfigureAwait(false);
        }

        foreach (var company in companies)
        {
            using var scope = scopes.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ExecutionContextAccessor>();
            context.SetTenant(company.Id);
            context.SetUser(null, "alerts");
            var told = await scope.ServiceProvider.GetRequiredService<AlertCenter>().DigestAsync(force: false, stoppingToken).ConfigureAwait(false);
            if (told > 0)
            {
                LogDigest(logger, company.Code, told);
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Alert digest is off (Alerts:DigestHour < 0)")]
    private static partial void LogOff(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "Alert digest for {Company}: {Count} new alerts told")]
    private static partial void LogDigest(ILogger logger, string company, int count);

    [LoggerMessage(Level = LogLevel.Error, Message = "Alert digest round failed")]
    private static partial void LogFailed(ILogger logger, Exception exception);
}
