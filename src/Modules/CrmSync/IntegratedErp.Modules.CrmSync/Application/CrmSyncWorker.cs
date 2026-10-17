using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.CrmSync.Application;

/// <summary>
/// Runs sync requests in the background (a full sync can take minutes), and an incremental sync every
/// <see cref="CrmSyncOptions.IntervalMinutes"/> when configured. Runs in the context of the configured company.
/// </summary>
internal sealed partial class CrmSyncWorker(IServiceScopeFactory scopes, CrmSyncSignal signal, IOptions<CrmSyncOptions> options, ILogger<CrmSyncWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (string.IsNullOrWhiteSpace(options.Value.ConnectionString) || string.IsNullOrWhiteSpace(options.Value.Company))
        {
            LogNotConfigured(logger);
            return;
        }

        var interval = options.Value.IntervalMinutes > 0 ? TimeSpan.FromMinutes(options.Value.IntervalMinutes) : Timeout.InfiniteTimeSpan;
        var nextScheduled = interval == Timeout.InfiniteTimeSpan ? DateTimeOffset.MaxValue : DateTimeOffset.UtcNow + interval;
        await WorkAsync(recover: true, scheduled: false, stoppingToken).ConfigureAwait(false);

        while (!stoppingToken.IsCancellationRequested)
        {
            var wait = interval == Timeout.InfiniteTimeSpan ? TimeSpan.FromHours(1) : nextScheduled - DateTimeOffset.UtcNow;
            await signal.WaitAsync(wait > TimeSpan.Zero ? wait : TimeSpan.Zero, stoppingToken).ConfigureAwait(false);
            var scheduled = interval != Timeout.InfiniteTimeSpan && DateTimeOffset.UtcNow >= nextScheduled;
            if (scheduled)
            {
                nextScheduled = DateTimeOffset.UtcNow + interval;
            }

            await WorkAsync(recover: false, scheduled, stoppingToken).ConfigureAwait(false);
        }
    }

    private async Task WorkAsync(bool recover, bool scheduled, CancellationToken stoppingToken)
    {
        try
        {
            Guid tenantId;
            using (var lookup = scopes.CreateScope())
            {
                var company = await lookup.ServiceProvider.GetRequiredService<ITenantDirectory>()
                    .FindByCodeAsync(options.Value.Company, stoppingToken).ConfigureAwait(false);
                if (company is null)
                {
                    LogUnknownCompany(logger, options.Value.Company);
                    return;
                }

                tenantId = company.Id;
            }

            using var scope = scopes.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ExecutionContextAccessor>();
            context.SetTenant(tenantId);
            context.SetUser(null, "crm-sync");
            var sync = scope.ServiceProvider.GetRequiredService<CrmSyncService>();
            if (recover)
            {
                await sync.RecoverInterruptedAsync(stoppingToken).ConfigureAwait(false);
            }

            if (scheduled)
            {
                await sync.QueueScheduledAsync(stoppingToken).ConfigureAwait(false);
            }

            while (await sync.RunNextAsync(stoppingToken).ConfigureAwait(false))
            {
                LogRunFinished(logger);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogRunFailed(logger, ex);
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "CRM sync is not configured (CrmSync:ConnectionString / CrmSync:Company); the sync worker is off")]
    private static partial void LogNotConfigured(ILogger logger);

    [LoggerMessage(Level = LogLevel.Warning, Message = "CRM sync company {Company} does not exist")]
    private static partial void LogUnknownCompany(ILogger logger, string company);

    [LoggerMessage(Level = LogLevel.Information, Message = "CRM sync run finished")]
    private static partial void LogRunFinished(ILogger logger);

    [LoggerMessage(Level = LogLevel.Error, Message = "CRM sync round failed")]
    private static partial void LogRunFailed(ILogger logger, Exception exception);
}
