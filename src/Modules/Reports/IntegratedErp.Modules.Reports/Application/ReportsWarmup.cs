using System.Threading.Channels;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Live;
using IntegratedErp.Modules.Organization.Contracts;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Reports.Application;

/// <summary>
/// Prepares the slow reports before anyone opens them (the user's request, 2026-10-24): every company's old invoices,
/// tasks and the last six invoiced months' profit, shortly after the server starts and again a little after the CRM sync
/// copies changed invoices or tasks. The first person to open the management or CEO report then gets it from memory.
/// <c>Reports:WarmupSeconds</c> is the wait after start (default 20; below 0 turns it off).
/// </summary>
internal sealed partial class ReportsWarmup(IServiceScopeFactory scopes, LiveChanges live, IOptions<ReportsOptions> options, ILogger<ReportsWarmup> logger) : BackgroundService
{
    // Changes close together (a sync copies page after page) are prepared for once.
    private static readonly TimeSpan Settle = TimeSpan.FromSeconds(15);

    private readonly Channel<Guid> _changed = Channel.CreateUnbounded<Guid>(new UnboundedChannelOptions { SingleReader = true });

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (options.Value.WarmupSeconds < 0)
        {
            return;
        }

        live.Published += OnPublished;
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(options.Value.WarmupSeconds), stoppingToken).ConfigureAwait(false);
            foreach (var company in await CompaniesAsync(stoppingToken).ConfigureAwait(false))
            {
                await WarmAsync(company, stoppingToken).ConfigureAwait(false);
            }

            while (await _changed.Reader.WaitToReadAsync(stoppingToken).ConfigureAwait(false))
            {
                await Task.Delay(Settle, stoppingToken).ConfigureAwait(false);
                var companies = new HashSet<Guid>();
                while (_changed.Reader.TryRead(out var company))
                {
                    companies.Add(company);
                }

                foreach (var company in companies)
                {
                    await WarmAsync(company, stoppingToken).ConfigureAwait(false);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // The server is stopping.
        }
        finally
        {
            live.Published -= OnPublished;
        }
    }

    private void OnPublished(Guid tenantId, string area)
    {
        if (ReportSources.LegacyInvoices.Contains(area) || ReportSources.LegacyTasks.Contains(area))
        {
            _changed.Writer.TryWrite(tenantId);
        }
    }

    private async Task<IReadOnlyList<Guid>> CompaniesAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = scopes.CreateScope();
            scope.ServiceProvider.GetRequiredService<ExecutionContextAccessor>().RunAsSystem("reports-warmup");
            return (await scope.ServiceProvider.GetRequiredService<ITenantDirectory>().ActiveAsync(stoppingToken).ConfigureAwait(false)).Select(c => c.Id).ToList();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogFailed(logger, ex);
            return [];
        }
    }

    private async Task WarmAsync(Guid tenantId, CancellationToken stoppingToken)
    {
        try
        {
            var started = TimeProvider.System.GetTimestamp();
            using var scope = scopes.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ExecutionContextAccessor>();
            context.SetTenant(tenantId);
            context.SetUser(null, "reports-warmup");
            var services = scope.ServiceProvider;
            await services.GetRequiredService<LegacyInvoices>().LoadAsync(stoppingToken).ConfigureAwait(false);
            await services.GetRequiredService<LegacyTasks>().LoadAsync(stoppingToken).ConfigureAwait(false);
            var profit = services.GetRequiredService<ProfitReport>();
            foreach (var month in (await profit.InvoicedMonthsAsync(stoppingToken).ConfigureAwait(false)).Take(6))
            {
                await profit.MonthAsync(month, stoppingToken).ConfigureAwait(false);
            }

            var took = (long)TimeProvider.System.GetElapsedTime(started).TotalMilliseconds;
            LogWarmed(logger, tenantId, took);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogFailed(logger, ex);
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Reports prepared for company {TenantId} in {Milliseconds} ms")]
    private static partial void LogWarmed(ILogger logger, Guid tenantId, long milliseconds);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Preparing the reports failed")]
    private static partial void LogFailed(ILogger logger, Exception exception);
}
