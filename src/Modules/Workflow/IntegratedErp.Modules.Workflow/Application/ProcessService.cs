using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workflow.Application;

public sealed record ProcessSummaryDto(
    Guid Id,
    string Screen,
    string ScreenNameAr,
    string ScreenNameEn,
    string NameAr,
    string NameEn,
    int Priority,
    bool IsActive,
    int CurrentVersion,
    bool HasUnpublishedChanges,
    DateTimeOffset? PublishedAt,
    string? PublishedBy);

public sealed record ProcessDetailDto(ProcessSummaryDto Process, ProcessDefinition Draft, IReadOnlyList<VersionDto> Versions);

public sealed record VersionDto(int Version, string PublishedBy, DateTimeOffset PublishedAt, ProcessDefinition Definition);

public sealed record ProcessInput(string Screen, string NameAr, string NameEn, int Priority);

/// <summary>A permission a stage can be assigned to (whoever holds it through a role).</summary>
public sealed record PermissionOptionDto(string Code, string GroupAr, string GroupEn, string NameAr, string NameEn);

public sealed record ApproverOptionsDto(IReadOnlyList<RoleInfo> Roles, IReadOnlyList<MemberInfo> Members, IReadOnlyList<PermissionOptionDto> Permissions);

/// <summary>Approval processes of the current company: drafts edited freely, published as immutable versions.</summary>
internal sealed class ProcessService(WorkflowDbContext db, ApprovalEngine engine, IAccessDirectory access, PermissionCatalog permissions, ICurrentUser user, IClock clock)
{
    private static readonly Error NotFound = Error.NotFound("approval_process", "Process not found.");

    public IReadOnlyList<ApprovalScreen> Screens() => engine.Screens;

    public async Task<IReadOnlyList<ProcessSummaryDto>> ListAsync(CancellationToken cancellationToken)
    {
        // A process published before its screen declared required actions gets them first (and shows them).
        foreach (var screen in engine.Screens)
        {
            await RequiredActions.UpgradeAsync(db, screen, clock.UtcNow, cancellationToken).ConfigureAwait(false);
        }

        var processes = await db.Processes.AsNoTracking().Include(p => p.Versions)
            .OrderBy(p => p.Screen).ThenBy(p => p.Priority).ThenBy(p => p.NameEn)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return processes.Select(Summary).ToList();
    }

    public async Task<Result<ProcessDetailDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var process = await db.Processes.AsNoTracking().Include(p => p.Versions).FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false);
        return process is null ? Result.Failure<ProcessDetailDto>(NotFound) : Result.Success(Detail(process));
    }

    public async Task<Result<ProcessDetailDto>> CreateAsync(ProcessInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (engine.AdapterFor(input.Screen) is null)
        {
            return Result.Failure<ProcessDetailDto>(ApprovalEngine.UnknownScreen);
        }

        var process = new ApprovalProcess(input.Screen, string.Empty, string.Empty, 0, DefinitionJson.Write(ProcessDefinition.Empty));
        var named = process.Rename(input.NameAr, input.NameEn, input.Priority);
        if (named.IsFailure)
        {
            return Result.Failure<ProcessDetailDto>(named.Error);
        }

        db.Processes.Add(process);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(Detail(process));
    }

    /// <summary>Saves names, priority and the draft steps. Checks only the shape; full checks run on validate/publish.</summary>
    public async Task<Result<ProcessDetailDto>> SaveDraftAsync(Guid id, string nameAr, string nameEn, int priority, JsonElement draft, CancellationToken cancellationToken)
    {
        var process = await db.Processes.Include(p => p.Versions).FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false);
        if (process is null)
        {
            return Result.Failure<ProcessDetailDto>(NotFound);
        }

        var named = process.Rename(nameAr, nameEn, priority);
        if (named.IsFailure)
        {
            return Result.Failure<ProcessDetailDto>(named.Error);
        }

        if (Parse(draft) is not { } definition)
        {
            return Result.Failure<ProcessDetailDto>(Error.Validation("process_invalid", "The steps could not be read."));
        }

        process.SaveDraft(DefinitionJson.Write(definition));
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(Detail(process));
    }

    public async Task<Result> ValidateAsync(Guid id, CancellationToken cancellationToken)
    {
        var process = await db.Processes.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false);
        return process is null ? Result.Failure(NotFound) : await CheckAsync(process, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Validates the draft and publishes it as the next version; the process becomes active.</summary>
    public async Task<Result<ProcessDetailDto>> PublishAsync(Guid id, CancellationToken cancellationToken)
    {
        var process = await db.Processes.Include(p => p.Versions).FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false);
        if (process is null)
        {
            return Result.Failure<ProcessDetailDto>(NotFound);
        }

        var valid = await CheckAsync(process, cancellationToken).ConfigureAwait(false);
        if (valid.IsFailure)
        {
            return Result.Failure<ProcessDetailDto>(valid.Error);
        }

        process.Publish(user.DisplayName, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(Detail(process));
    }

    public async Task<Result<ProcessDetailDto>> SetActiveAsync(Guid id, bool active, CancellationToken cancellationToken)
    {
        var process = await db.Processes.Include(p => p.Versions).FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false);
        if (process is null)
        {
            return Result.Failure<ProcessDetailDto>(NotFound);
        }

        var changed = process.SetActive(active);
        if (changed.IsFailure)
        {
            return Result.Failure<ProcessDetailDto>(changed.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(Detail(process));
    }

    public async Task<ApproverOptionsDto> ApproverOptionsAsync(CancellationToken cancellationToken) =>
        new(
            (await access.ListRolesAsync(cancellationToken).ConfigureAwait(false)).Where(r => r.IsActive).ToList(),
            await access.ListMembersAsync(cancellationToken).ConfigureAwait(false),
            permissions.All.Where(p => !p.IsView).Select(p => new PermissionOptionDto(p.Code, p.GroupAr, p.GroupEn, p.NameAr, p.NameEn)).ToList());

    /// <summary>The steps' rules, then that named users and roles belong to this company.</summary>
    private async Task<Result> CheckAsync(ApprovalProcess process, CancellationToken cancellationToken)
    {
        var adapter = engine.AdapterFor(process.Screen);
        if (adapter is null)
        {
            return Result.Failure(ApprovalEngine.UnknownScreen);
        }

        var definition = DefinitionJson.Read(process.Draft);
        var added = (await db.StatusValues.AsNoTracking().Where(v => v.Screen == process.Screen && v.IsActive).Select(v => v.Code)
            .ToListAsync(cancellationToken).ConfigureAwait(false)).ToHashSet(StringComparer.Ordinal);
        var rules = DefinitionRules.Validate(definition, adapter.Screen, added);
        if (rules.IsFailure)
        {
            return rules;
        }

        var roles = (await access.ListRolesAsync(cancellationToken).ConfigureAwait(false)).Where(r => r.IsActive).Select(r => r.Id).ToHashSet();
        var members = (await access.ListMembersAsync(cancellationToken).ConfigureAwait(false)).Select(m => m.UserAccountId).ToHashSet();
        foreach (var step in DefinitionRules.Walk(definition.Steps))
        {
            IEnumerable<(Guid? User, Guid? Role)> people = step switch
            {
                ApprovalStep a => a.Assignees.Select(x => (x.UserId, x.RoleId)),
                NotifyStep n => n.To.Select(x => (x.UserId, x.RoleId)),
                _ => [],
            };
            if (people.Any(p => (p.User is { } u && !members.Contains(u)) || (p.Role is { } r && !roles.Contains(r))))
            {
                return Result.Failure(Error.Validation("process_approver_unknown", "A user or role in the process is not part of this company."));
            }

            if (step is ApprovalStep stage && stage.Assignees.Any(a => a.Kind == AssigneeKind.Permission && !permissions.Contains(a.Permission!)))
            {
                return Result.Failure(Error.Validation("process_permission_unknown", "A permission in the process does not exist."));
            }
        }

        return Result.Success();
    }

    private static ProcessDefinition? Parse(JsonElement draft)
    {
        try
        {
            return draft.ValueKind == JsonValueKind.Object ? draft.Deserialize<ProcessDefinition>(DefinitionJson.Options) : null;
        }
        catch (JsonException)
        {
            return null;
        }
        catch (NotSupportedException)
        {
            return null;
        }
    }

    private ProcessSummaryDto Summary(ApprovalProcess p)
    {
        var screen = engine.AdapterFor(p.Screen)?.Screen;
        var current = p.Current;
        return new ProcessSummaryDto(
            p.Id, p.Screen, screen?.NameAr ?? p.Screen, screen?.NameEn ?? p.Screen, p.NameAr, p.NameEn, p.Priority, p.IsActive,
            p.CurrentVersion, p.DraftChanged || p.CurrentVersion == 0, current?.PublishedAt, current?.PublishedBy);
    }

    private ProcessDetailDto Detail(ApprovalProcess p) => new(
        Summary(p),
        DefinitionJson.Read(p.Draft),
        p.Versions.OrderByDescending(v => v.Version).Select(v => new VersionDto(v.Version, v.PublishedBy, v.PublishedAt, DefinitionJson.Read(v.Definition))).ToList());
}
