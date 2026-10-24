using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.Modules.CrmSync.Contracts;

namespace IntegratedErp.Modules.Reports.Application;

/// <param name="Type">invoice, deliver, housing, vacation, permission or other (what the task is about).</param>
/// <param name="Status">done, late or open.</param>
/// <param name="Timing">doneOnTime, doneLate, late, lateNoDue, noDue or onTime; <paramref name="TimingDays"/> how many days late or open.</param>
public sealed record TaskRowDto(Guid CrmId, string Subject, string Owner, string Type, string? Regarding, DateOnly? CreatedOn, DateOnly? DueOn, DateOnly? DoneOn, string Status, string Timing, int TimingDays, int AgeDays);

public sealed record TaskOwnerDto(string Name, int Total, int Completed, int Open, int Overdue, int OldestPendingDays, decimal CompletionRate, decimal OnTimeRate);

public sealed record TaskTypeDto(string Type, int Total, int Done, int Open);

/// <param name="OnTimeRate">Of the completed tasks, those done by their due day (null: none completed).</param>
/// <param name="Rows">Every pending task, then the latest completed ones (at most <see cref="ManagementDashboard.CompletedShown"/>).</param>
public sealed record TasksDto(int Total, int Completed, int Open, int Overdue, int OnTime, decimal? CompletionRate, decimal? OnTimeRate, IReadOnlyList<TaskOwnerDto> Owners, IReadOnlyList<TaskTypeDto> ByType, IReadOnlyList<TaskRowDto> Rows);

/// <summary>An old-system CRM task, as the old dashboard read it (dates as Riyadh days).</summary>
internal sealed record LegacyTask(Guid CrmId, string Subject, string Owner, string Type, string? Regarding, DateOnly? CreatedOn, DateOnly? ModifiedOn, DateOnly? DueOn, bool Completed, bool Canceled);

/// <summary>
/// The old system's tasks during the parallel phase (docs/03-migration-plan/19): read from the CRM copy the sync keeps
/// (never from the CRM itself, never written), without the integration account's («cit»). Kept per company until the
/// copied tasks change (<see cref="ReportCache"/>).
/// </summary>
internal sealed class LegacyTasks(ICrmStaging staging, ITenantContext tenant, ReportCache cache)
{
    private static readonly TimeSpan Riyadh = TimeSpan.FromHours(3);

    // What a task is about, by its record's CRM type code (this CRM's own entities).
    private static readonly Dictionary<int, string> Types = new()
    {
        [10105] = "invoice",
        [10066] = "deliver",
        [10017] = "housing",
        [10011] = "vacation",
        [10113] = "permission",
    };

    public Task<IReadOnlyList<LegacyTask>> LoadAsync(CancellationToken cancellationToken)
    {
        var tenantId = tenant.TenantId ?? Guid.Empty;
        return cache.GetAsync($"reports.legacy-tasks.{tenantId}", tenantId, ReportSources.LegacyTasks, TimeSpan.FromHours(6), () => ReadAsync(cancellationToken), cancellationToken);
    }

    private async Task<IReadOnlyList<LegacyTask>> ReadAsync(CancellationToken cancellationToken)
    {
        var tasks = new List<LegacyTask>();
        foreach (var record in await staging.ChangedSinceAsync("task", null, cancellationToken).ConfigureAwait(false))
        {
            if (record.IsDeleted)
            {
                continue;
            }

            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            var owner = Text(row, "owneridname") ?? string.Empty;
            if (IsIntegration(owner))
            {
                continue;
            }

            var state = Int(row, "statecode") ?? 0;
            tasks.Add(new LegacyTask(
                record.CrmId, Text(row, "subject") ?? string.Empty, owner,
                Int(row, "regardingobjecttypecode") is { } code && Types.TryGetValue(code, out var type) ? type : "other",
                Text(row, "regardingobjectidname"), Date(row, "createdon"), Date(row, "modifiedon"), Date(row, "scheduledend"), state == 1, state == 2));
        }

        return tasks;
    }

    private static bool IsIntegration(string owner)
    {
        // The integration account shows as «c it» too.
        var o = owner.Replace(" ", string.Empty, StringComparison.Ordinal).ToLowerInvariant();
        return o == "cit" || o.EndsWith("\\cit", StringComparison.Ordinal) || o.StartsWith("cit@", StringComparison.Ordinal);
    }

    private static string? Text(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString()!.Trim() : null;

    private static int? Int(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static DateOnly? Date(JsonElement row, string field) =>
        DateTimeOffset.TryParse(Text(row, field), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at) ? DateOnly.FromDateTime(at.ToOffset(Riyadh).DateTime) : null;
}

/// <summary>The old dashboard's task rules: a task with a due day is late after it; one without, after three days open.</summary>
internal static class TaskRules
{
    public const int NoDueLateDays = 3;

    public static bool Late(LegacyTask t, DateOnly today) =>
        !t.Completed && (t.DueOn is { } due ? due < today : t.CreatedOn is { } c && today.DayNumber - c.DayNumber > NoDueLateDays);

    /// <summary>Completed by its due day (the completion day is the task's last change, as the old dashboard took it).</summary>
    public static bool OnTime(LegacyTask t) => t.Completed && (t.DueOn is not { } due || (t.ModifiedOn is { } done && done <= due));

    public static (string Timing, int Days) Timing(LegacyTask t, DateOnly today)
    {
        if (t.Completed)
        {
            return t.DueOn is { } due && t.ModifiedOn is { } done && done > due ? ("doneLate", done.DayNumber - due.DayNumber) : ("doneOnTime", 0);
        }

        var age = t.CreatedOn is { } c ? Math.Max(0, today.DayNumber - c.DayNumber) : 0;
        if (t.DueOn is not { } dueOn)
        {
            return Late(t, today) ? ("lateNoDue", age) : ("noDue", age);
        }

        return dueOn < today ? ("late", today.DayNumber - dueOn.DayNumber) : ("onTime", dueOn.DayNumber - today.DayNumber);
    }

    public static decimal? Rate(int part, int whole) => whole == 0 ? null : Math.Round(part * 100m / whole, 1);
}
