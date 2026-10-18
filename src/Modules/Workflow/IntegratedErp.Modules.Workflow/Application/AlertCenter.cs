using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Documents.Contracts;
using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workflow.Application;

public sealed record AlertDto(
    string Code, string Key, string Severity, string GroupAr, string GroupEn, string NameAr, string NameEn, string TitleAr, string TitleEn,
    string? DetailAr, string? DetailEn, string Link, DateOnly Since, int Days, decimal? Amount);

public sealed record AlertCountsDto(int Critical, int Warning, int Info, int Hidden);

public sealed record AlertListDto(AlertCountsDto Counts, IReadOnlyList<AlertDto> Items);

public sealed record AlertSettingDto(
    string Code, string GroupAr, string GroupEn, string NameAr, string NameEn, string DaysMeaningAr, string DaysMeaningEn, int DefaultDays,
    bool Enabled, int Days, string? UpdatedByName, DateTimeOffset? UpdatedAt);

public sealed record AlertSettingInput(bool Enabled, int Days);

public sealed record DismissInput(string Code, string Key, int Days);

/// <summary>
/// The alerts center (docs/03-migration-plan/05, slice 2.6): every module's alerts the user may see and the company has
/// on, with the company's thresholds; a user can hide one for some days; and each morning the people responsible are
/// told of the new ones (once per alert while it lasts).
/// </summary>
internal sealed class AlertCenter(
    WorkflowDbContext db,
    IEnumerable<IAlertProvider> providers,
    IPermissionService permissions,
    IAccessDirectory access,
    INotifier notifier,
    ICurrentUser user,
    IClock clock)
{
    public const string SettingsManage = "workflow.alerts.manage";

    private IReadOnlyList<(IAlertProvider Provider, AlertDefinition Definition)> All =>
        providers.SelectMany(p => p.Definitions.Select(d => (p, d))).ToList();

    public async Task<AlertListDto> ListAsync(string? code, CancellationToken cancellationToken)
    {
        var granted = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        var visible = All.Where(x => granted.Has(x.Definition.ViewPermission) && (code is null || x.Definition.Code == code)).ToList();
        var items = await ComputeAsync(visible, cancellationToken).ConfigureAwait(false);

        var today = clock.Today;
        var userId = Guid.TryParse(user.UserId, out var id) ? id : Guid.Empty;
        var hidden = await db.AlertDismissals.AsNoTracking().Where(d => d.UserId == userId && d.Until >= today)
            .Select(d => new { d.Code, d.Key }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var shown = items.Where(i => !hidden.Any(h => h.Code == i.Item.Code && h.Key == i.Item.Key)).ToList();
        var counts = new AlertCountsDto(
            shown.Count(i => i.Item.Severity == AlertSeverity.Critical), shown.Count(i => i.Item.Severity == AlertSeverity.Warning),
            shown.Count(i => i.Item.Severity == AlertSeverity.Info), items.Count - shown.Count);
        return new AlertListDto(counts, shown
            .OrderByDescending(i => i.Item.Severity).ThenBy(i => i.Item.Since)
            .Select(i => new AlertDto(
                i.Item.Code, i.Item.Key, i.Item.Severity.ToString(), i.Definition.GroupAr, i.Definition.GroupEn, i.Definition.NameAr, i.Definition.NameEn,
                i.Item.TitleAr, i.Item.TitleEn, i.Item.DetailAr, i.Item.DetailEn, i.Item.Link, i.Item.Since, Math.Max(0, today.DayNumber - i.Item.Since.DayNumber), i.Item.Amount))
            .ToList());
    }

    /// <summary>Hides an alert for the user for some days (it shows again then, if it still stands).</summary>
    public async Task<Result> DismissAsync(DismissInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!Guid.TryParse(user.UserId, out var userId) || input.Days is < 1 or > 365 || string.IsNullOrWhiteSpace(input.Code) || string.IsNullOrWhiteSpace(input.Key))
        {
            return Result.Failure(Error.Validation("alert_dismiss", "Choose the alert and for how many days."));
        }

        var until = clock.Today.AddDays(input.Days);
        var existing = await db.AlertDismissals.FirstOrDefaultAsync(d => d.UserId == userId && d.Code == input.Code && d.Key == input.Key, cancellationToken).ConfigureAwait(false);
        if (existing is null)
        {
            db.AlertDismissals.Add(AlertDismissal.Create(userId, input.Code, input.Key, until));
        }
        else
        {
            existing.Extend(until);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>Shows again every alert the user hid.</summary>
    public async Task<Result> RestoreAsync(CancellationToken cancellationToken)
    {
        if (Guid.TryParse(user.UserId, out var userId))
        {
            await db.AlertDismissals.Where(d => d.UserId == userId).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        }

        return Result.Success();
    }

    public async Task<IReadOnlyList<AlertSettingDto>> SettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await db.AlertSettings.AsNoTracking().ToDictionaryAsync(s => s.Code, cancellationToken).ConfigureAwait(false);
        return All.Select(x =>
            {
                var d = x.Definition;
                var s = settings.GetValueOrDefault(d.Code);
                return new AlertSettingDto(d.Code, d.GroupAr, d.GroupEn, d.NameAr, d.NameEn, d.DaysMeaningAr, d.DaysMeaningEn, d.DefaultDays,
                    s?.Enabled ?? true, s?.Days ?? d.DefaultDays, s?.UpdatedByName, s?.UpdatedAt);
            })
            .ToList();
    }

    public async Task<Result> SaveSettingAsync(string code, AlertSettingInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (All.All(x => x.Definition.Code != code))
        {
            return Result.Failure(Error.NotFound("alert", "Alert not found."));
        }

        if (input.Days is < 0 or > 365)
        {
            return Result.Failure(Error.Validation("alert_days", "The days must be between 0 and 365."));
        }

        var setting = await db.AlertSettings.FirstOrDefaultAsync(s => s.Code == code, cancellationToken).ConfigureAwait(false);
        if (setting is null)
        {
            setting = AlertSetting.Create(code);
            db.AlertSettings.Add(setting);
        }

        setting.Set(input.Enabled, input.Days, user.DisplayName, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>
    /// The morning digest (once a day, in the company's context): for each kind of alert, the ones not told yet go in
    /// one notification to the people responsible; an alert that went away is forgotten, so it is told again if it comes back.
    /// Returns how many alerts were told.
    /// </summary>
    public async Task<int> DigestAsync(bool force, CancellationToken cancellationToken)
    {
        var today = clock.Today;
        if (!force && await db.AlertDigestRuns.AnyAsync(r => r.Day == today, cancellationToken).ConfigureAwait(false))
        {
            return 0;
        }

        var items = await ComputeAsync(All, cancellationToken).ConfigureAwait(false);
        var told = await db.AlertNotices.ToListAsync(cancellationToken).ConfigureAwait(false);
        var now = clock.UtcNow;
        var count = 0;
        foreach (var group in items.GroupBy(i => i.Definition.Code))
        {
            var definition = group.First().Definition;
            var fresh = group.Where(i => !told.Any(t => t.Code == i.Item.Code && t.Key == i.Item.Key)).Select(i => i.Item).ToList();
            if (fresh.Count == 0)
            {
                continue;
            }

            var people = await access.MembersWithPermissionAsync(definition.NotifyPermission, null, cancellationToken).ConfigureAwait(false);
            if (people.Count > 0)
            {
                var lines = string.Join("\n", fresh.OrderByDescending(f => f.Severity).Take(10).Select(f => $"• {f.TitleAr}"));
                var linesEn = string.Join("\n", fresh.OrderByDescending(f => f.Severity).Take(10).Select(f => $"• {f.TitleEn}"));
                var more = fresh.Count > 10 ? $"\n… و{fresh.Count - 10} غيرها." : string.Empty;
                var moreEn = fresh.Count > 10 ? $"\n… and {fresh.Count - 10} more." : string.Empty;
                await notifier.NotifyAsync(
                    new NotificationRequest(
                        people, $"alerts.{definition.Code}",
                        $"{definition.NameAr}: {fresh.Count} تنبيه جديد", $"{definition.NameEn}: {fresh.Count} new",
                        lines + more, linesEn + moreEn, $"/alerts?code={definition.Code}"),
                    cancellationToken).ConfigureAwait(false);
            }

            db.AlertNotices.AddRange(fresh.Select(f => AlertNotice.Create(f.Code, f.Key, now)));
            count += fresh.Count;
        }

        // Forget what went away (and what belongs to an alert turned off).
        var standing = items.Select(i => (i.Item.Code, i.Item.Key)).ToHashSet();
        db.AlertNotices.RemoveRange(told.Where(t => !standing.Contains((t.Code, t.Key))));
        db.AlertDismissals.RemoveRange(await db.AlertDismissals.Where(d => d.Until < today).ToListAsync(cancellationToken).ConfigureAwait(false));
        if (!force)
        {
            db.AlertDigestRuns.Add(AlertDigestRun.Create(today));
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return count;
    }

    /// <summary>The current alerts of the given kinds that the company has on, with its thresholds.</summary>
    private async Task<List<(AlertDefinition Definition, AlertItem Item)>> ComputeAsync(
        IReadOnlyList<(IAlertProvider Provider, AlertDefinition Definition)> kinds, CancellationToken cancellationToken)
    {
        var settings = await db.AlertSettings.AsNoTracking().ToDictionaryAsync(s => s.Code, cancellationToken).ConfigureAwait(false);
        var on = kinds.Where(k => settings.GetValueOrDefault(k.Definition.Code)?.Enabled ?? true).ToList();
        var query = new AlertQuery(clock.Today, settings.Values.ToDictionary(s => s.Code, s => s.Days));
        var result = new List<(AlertDefinition, AlertItem)>();
        foreach (var provider in on.GroupBy(k => k.Provider))
        {
            var codes = provider.Select(k => k.Definition.Code).ToHashSet(StringComparer.Ordinal);
            var definitions = provider.ToDictionary(k => k.Definition.Code, k => k.Definition, StringComparer.Ordinal);
            foreach (var item in await provider.Key.AlertsAsync(query, codes, cancellationToken).ConfigureAwait(false))
            {
                if (definitions.TryGetValue(item.Code, out var definition))
                {
                    result.Add((definition, item));
                }
            }
        }

        return result;
    }
}
