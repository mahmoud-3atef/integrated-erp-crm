using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Email;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Documents.Domain;
using IntegratedErp.Modules.Documents.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Documents.Application;

/// <summary>Sends queued emails of every company in the background; failures are retried with back-off.</summary>
internal sealed partial class EmailDispatcher(IServiceScopeFactory scopes, IEmailSender sender, IOptions<DocumentsOptions> options, ILogger<EmailDispatcher> logger)
    : BackgroundService
{
    private const int BatchSize = 20;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!sender.IsEnabled)
        {
            return;
        }

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(1, options.Value.EmailPollSeconds)));
        do
        {
            try
            {
                await SendDueAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // The database may be briefly unreachable; the next tick tries again.
                LogDispatchFailed(logger, ex);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }

    internal async Task SendDueAsync(CancellationToken cancellationToken)
    {
        using var scope = scopes.CreateScope();
        // Reads queued emails of all companies: a system operation (also for row-level security).
        scope.ServiceProvider.GetRequiredService<ExecutionContextAccessor>().RunAsSystem("email-dispatcher");
        var db = scope.ServiceProvider.GetRequiredService<DocumentsDbContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();

        var now = clock.UtcNow;
        var due = await db.OutgoingEmails
            .Where(e => e.Status == EmailStatus.Pending && e.NextAttemptAt <= now)
            .OrderBy(e => e.NextAttemptAt)
            .Take(BatchSize)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        foreach (var email in due)
        {
            try
            {
                await sender.SendAsync(new EmailMessage(email.To, email.Subject, email.HtmlBody, email.TextBody), cancellationToken).ConfigureAwait(false);
                email.MarkSent(clock.UtcNow);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                email.MarkFailed(ex.Message, clock.UtcNow);
                LogSendFailed(logger, email.Id, email.Attempts, ex);
            }

            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Email dispatch round failed")]
    private static partial void LogDispatchFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Email {EmailId} failed (attempt {Attempt})")]
    private static partial void LogSendFailed(ILogger logger, Guid emailId, int attempt, Exception exception);
}
