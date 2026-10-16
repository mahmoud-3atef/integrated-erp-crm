using System.Net;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Email;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Documents.Contracts;
using IntegratedErp.Modules.Documents.Domain;
using IntegratedErp.Modules.Documents.Infrastructure;
using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Documents.Application;

public sealed record NotificationDto(Guid Id, string Kind, string TitleAr, string TitleEn, string BodyAr, string BodyEn, string? Link, DateTimeOffset CreatedAt, bool IsRead);

public sealed record NotificationPage(int UnreadCount, IReadOnlyList<NotificationDto> Items);

/// <summary>
/// In-system notifications of the current company. A notification and its email are saved together, so a
/// notification never exists without its email being queued (and the other way round).
/// </summary>
internal sealed class NotificationService(
    DocumentsDbContext db,
    IUserDirectory users,
    IEmailSender email,
    ITenantContext tenant,
    ICurrentUser user,
    IClock clock,
    IOptions<DocumentsOptions> options) : INotifier
{
    public const int PageSize = 50;

    public async Task NotifyAsync(NotificationRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (tenant.TenantId is null || request.RecipientUserIds.Count == 0)
        {
            return;
        }

        if (request.Link is { } link && (!link.StartsWith('/') || link.StartsWith("//", StringComparison.Ordinal)))
        {
            throw new ArgumentException("A notification link must be an in-app path.", nameof(request));
        }

        var now = clock.UtcNow;
        var contacts = (await users.GetAsync(request.RecipientUserIds.Distinct().ToList(), cancellationToken).ConfigureAwait(false))
            .Where(c => c.IsActive).ToList();
        foreach (var contact in contacts)
        {
            var notification = new Notification(contact.UserAccountId, request.Kind, request.TitleAr, request.TitleEn, request.BodyAr, request.BodyEn, request.Link, now);
            db.Notifications.Add(notification);
            if (request.SendEmail && email.IsEnabled && contact.Email is { Length: > 0 } address)
            {
                var (html, text) = Render(contact.DisplayName, request);
                db.OutgoingEmails.Add(new OutgoingEmail(notification.Id, address, $"{request.TitleAr} | {request.TitleEn}", html, text, now));
            }
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<NotificationPage> MineAsync(CancellationToken cancellationToken)
    {
        var me = CurrentUserId();
        var unread = await db.Notifications.CountAsync(n => n.RecipientUserId == me && n.ReadAt == null, cancellationToken).ConfigureAwait(false);
        var items = await db.Notifications.AsNoTracking()
            .Where(n => n.RecipientUserId == me)
            .OrderByDescending(n => n.CreatedAt)
            .Take(PageSize)
            .Select(n => new NotificationDto(n.Id, n.Kind, n.TitleAr, n.TitleEn, n.BodyAr, n.BodyEn, n.Link, n.CreatedAt, n.ReadAt != null))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return new NotificationPage(unread, items);
    }

    public async Task<Result> MarkReadAsync(Guid id, CancellationToken cancellationToken)
    {
        var me = CurrentUserId();
        var notification = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.RecipientUserId == me, cancellationToken).ConfigureAwait(false);
        if (notification is null)
        {
            return Result.Failure(Error.NotFound("notification", "Notification not found."));
        }

        notification.MarkRead(clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task MarkAllReadAsync(CancellationToken cancellationToken)
    {
        var me = CurrentUserId();
        var now = clock.UtcNow;
        var unread = await db.Notifications.Where(n => n.RecipientUserId == me && n.ReadAt == null).ToListAsync(cancellationToken).ConfigureAwait(false);
        unread.ForEach(n => n.MarkRead(now));
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    private Guid CurrentUserId() =>
        Guid.TryParse(user.UserId, out var id) ? id : throw new InvalidOperationException("A signed-in user is required.");

    /// <summary>One email in both languages (Arabic first, right-to-left), every value HTML-encoded.</summary>
    private (string Html, string Text) Render(string recipient, NotificationRequest request)
    {
        static string E(string value) => WebUtility.HtmlEncode(value);
        var url = request.Link is { } link && options.Value.BaseUrl is { Length: > 0 } baseUrl ? baseUrl.TrimEnd('/') + link : null;
        var button = url is null
            ? string.Empty
            : $"<p style=\"margin:18px 0\"><a href=\"{E(url)}\" style=\"background:#0d4a6c;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none\">فتح في النظام · Open in the system</a></p>";

        var html = $"""
            <!doctype html>
            <html lang="ar"><body style="margin:0;background:#e3e7ec;font-family:'Segoe UI',Tahoma,sans-serif;color:#102633">
            <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:18px;overflow:hidden">
              <div style="background:#0d4a6c;color:#fff;padding:16px 22px;font-weight:700">النظام المتكامل · Integrated ERP</div>
              <div dir="rtl" lang="ar" style="padding:20px 22px;text-align:right">
                <p>مرحبًا {E(recipient)}،</p>
                <h2 style="margin:0 0 8px;color:#0a3c58;font-size:18px">{E(request.TitleAr)}</h2>
                <p style="line-height:1.8">{E(request.BodyAr)}</p>
              </div>
              <div dir="ltr" lang="en" style="padding:0 22px 20px;text-align:left;border-top:1px solid #e1ebf1">
                <h2 style="margin:16px 0 8px;color:#0a3c58;font-size:18px">{E(request.TitleEn)}</h2>
                <p style="line-height:1.7">{E(request.BodyEn)}</p>
                {button}
              </div>
            </div></body></html>
            """;
        var text = $"{request.TitleAr}\n{request.BodyAr}\n\n{request.TitleEn}\n{request.BodyEn}" + (url is null ? string.Empty : $"\n\n{url}");
        return (html, text);
    }
}
