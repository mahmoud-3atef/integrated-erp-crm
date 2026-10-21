using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workflow.Application;

/// <summary>
/// A screen's required actions (e.g. a return order's «house the worker») in its processes. A process published before
/// the screen declared them gets them as «action» steps at its end — a new version published by the system, keeping
/// the process's state and the designer's unpublished draft (which gets them too).
/// </summary>
internal static class RequiredActions
{
    public const string PublishedBy = "النظام: إضافة الإجراءات الأساسية / System: required actions added";

    /// <summary>The definition with the screen's missing required actions added at its end (the same one when none is missing).</summary>
    public static ProcessDefinition WithRequired(ProcessDefinition definition, ApprovalScreen screen)
    {
        ArgumentNullException.ThrowIfNull(definition);
        ArgumentNullException.ThrowIfNull(screen);
        var steps = DefinitionRules.Walk(definition.Steps).ToList();
        var present = steps.OfType<ActionStep>().Select(a => a.Action).ToHashSet(StringComparer.Ordinal);
        var missing = screen.RecordActions.Where(a => a.Required && !present.Contains(a.Key)).ToList();
        if (missing.Count == 0)
        {
            return definition;
        }

        var ids = steps.Select(s => s.Id).ToHashSet(StringComparer.Ordinal);
        string Id(string key)
        {
            var id = $"action-{key}";
            for (var n = 2; !ids.Add(id); n++)
            {
                id = $"action-{key}-{n}";
            }

            return id[..Math.Min(40, id.Length)];
        }

        return definition with { Steps = [.. definition.Steps, .. missing.Select(a => new ActionStep { Id = Id(a.Key), Label = a.NameAr, Action = a.Key })] };
    }

    public static async Task UpgradeAsync(WorkflowDbContext db, ApprovalScreen screen, DateTimeOffset at, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(screen);
        if (!screen.RecordActions.Any(a => a.Required))
        {
            return;
        }

        var changed = false;
        foreach (var process in await db.Processes.Include(p => p.Versions).Where(p => p.Screen == screen.Code).ToListAsync(cancellationToken).ConfigureAwait(false))
        {
            string? Upgraded(string json)
            {
                var definition = DefinitionJson.Read(json);
                var upgraded = WithRequired(definition, screen);
                return ReferenceEquals(upgraded, definition) ? null : DefinitionJson.Write(upgraded);
            }

            if (process.Current is not { } current)
            {
                if (Upgraded(process.Draft) is { } draft)
                {
                    process.SaveDraft(draft);
                    changed = true;
                }

                continue;
            }

            if (Upgraded(current.Definition) is not { } published)
            {
                continue;
            }

            var userDraft = process.DraftChanged ? process.Draft : null;
            var active = process.IsActive;
            process.SaveDraft(published);
            process.Publish(PublishedBy, at);
            if (!active)
            {
                process.SetActive(false);
            }

            if (userDraft is not null)
            {
                process.SaveDraft(Upgraded(userDraft) ?? userDraft);
            }

            changed = true;
        }

        if (changed)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }
}
