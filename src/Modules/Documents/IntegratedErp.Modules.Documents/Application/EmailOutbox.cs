using IntegratedErp.BuildingBlocks.Email;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Documents.Contracts;
using IntegratedErp.Modules.Documents.Domain;
using IntegratedErp.Modules.Documents.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Documents.Application;

/// <summary>The email outbox for other modules: emails to any address, sent by <see cref="EmailDispatcher"/>.</summary>
internal sealed class EmailOutbox(DocumentsDbContext db, IEmailSender sender, IOptions<EmailOptions> options, IClock clock) : IEmailOutbox
{
    public (bool Configured, string? FromAddress) Sender => (sender.IsEnabled, sender.IsEnabled ? options.Value.FromAddress : null);

    public async Task<IReadOnlyList<Guid>> QueueAsync(IReadOnlyList<OutgoingEmailRequest> emails, bool confidential, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(emails);
        var now = clock.UtcNow;
        var queued = emails.Select(e => new OutgoingEmail(null, e.To, e.Subject, e.HtmlBody, e.TextBody, now, confidential)).ToList();
        db.OutgoingEmails.AddRange(queued);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return queued.Select(e => e.Id).ToList();
    }

    public async Task<IReadOnlyList<OutgoingEmailState>> StatesAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ids);
        var list = ids.ToList();
        return await db.OutgoingEmails.AsNoTracking().Where(e => list.Contains(e.Id))
            .Select(e => new OutgoingEmailState(e.Id, e.Status.ToString(), e.Attempts, e.SentAt, e.LastError))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }
}
