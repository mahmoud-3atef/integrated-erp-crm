using System.Text;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workflow.Application;

public sealed record StatusValueDto(Guid Id, string Code, string NameAr, string NameEn, int SortOrder, bool IsActive, int InUse);

/// <summary>A screen's status: the values its code fixes (locked), and those the company added under «in approval».</summary>
public sealed record ScreenStatusesDto(string Screen, IReadOnlyList<RecordFieldOption> System, IReadOnlyList<StatusValueDto> Added);

public sealed record StatusValueInput(string Screen, string NameAr, string NameEn);

public sealed record StatusValueChange(string NameAr, string NameEn, int SortOrder, bool IsActive);

/// <summary>
/// The values companies add to screens' statuses (docs/02-target-architecture/19): listed with the screen's fixed ones,
/// added and renamed, ordered and stopped — never deleted (records and processes keep their code).
/// </summary>
internal sealed class StatusValues(WorkflowDbContext db, ApprovalEngine engine, ICurrentUser user, IClock clock)
{
    public const string StatusField = "status";

    public static readonly Error UnknownScreen = Error.Validation("status_value_screen", "This screen has no record status.");
    public static readonly Error Name = Error.Validation("status_value_name", "Enter the value's Arabic and English names (100 characters at most).");
    public static readonly Error Taken = Error.Conflict("status_value_taken", "The screen already has a value with this name.");
    public static readonly Error NotFound = Error.NotFound("status_value", "The value was not found.");

    public async Task<Result<ScreenStatusesDto>> ListAsync(string screen, CancellationToken cancellationToken)
    {
        if (SystemOf(screen) is not { } system)
        {
            return Result.Failure<ScreenStatusesDto>(UnknownScreen);
        }

        var values = await db.StatusValues.AsNoTracking().Where(v => v.Screen == screen).OrderBy(v => v.SortOrder).ThenBy(v => v.CreatedAt)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var codes = values.Select(v => v.Code).ToList();
        var inUse = await db.Instances.AsNoTracking().Where(i => i.Screen == screen && i.StatusValue != null && codes.Contains(i.StatusValue))
            .GroupBy(i => i.StatusValue!).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, cancellationToken).ConfigureAwait(false);
        return Result.Success(new ScreenStatusesDto(screen, system,
            values.Select(v => new StatusValueDto(v.Id, v.Code, v.NameAr, v.NameEn, v.SortOrder, v.IsActive, inUse.GetValueOrDefault(v.Code))).ToList()));
    }

    public async Task<Result<StatusValueDto>> CreateAsync(StatusValueInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (SystemOf(input.Screen) is not { } system)
        {
            return Result.Failure<StatusValueDto>(UnknownScreen);
        }

        if (!Valid(input.NameAr) || !Valid(input.NameEn))
        {
            return Result.Failure<StatusValueDto>(Name);
        }

        var existing = await db.StatusValues.Where(v => v.Screen == input.Screen).ToListAsync(cancellationToken).ConfigureAwait(false);
        if (existing.Any(v => Same(v.NameAr, input.NameAr) || Same(v.NameEn, input.NameEn)) || system.Any(s => Same(s.NameAr, input.NameAr) || Same(s.NameEn, input.NameEn)))
        {
            return Result.Failure<StatusValueDto>(Taken);
        }

        // A readable code from the English name, kept unique on the screen (also against the fixed values).
        var taken = existing.Select(v => v.Code).Concat(system.Select(s => s.Value)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var code = CodeOf(input.NameEn);
        for (var n = 2; taken.Contains(code); n++)
        {
            code = $"{CodeOf(input.NameEn)}_{n}";
        }

        var value = StatusValue.Create(input.Screen, code, input.NameAr, input.NameEn, existing.Count == 0 ? 10 : existing.Max(v => v.SortOrder) + 10, user.DisplayName, clock.UtcNow);
        db.StatusValues.Add(value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(new StatusValueDto(value.Id, value.Code, value.NameAr, value.NameEn, value.SortOrder, value.IsActive, 0));
    }

    public async Task<Result> UpdateAsync(Guid id, StatusValueChange change, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(change);
        if (await db.StatusValues.FirstOrDefaultAsync(v => v.Id == id, cancellationToken).ConfigureAwait(false) is not { } value)
        {
            return Result.Failure(NotFound);
        }

        if (!Valid(change.NameAr) || !Valid(change.NameEn))
        {
            return Result.Failure(Name);
        }

        var others = await db.StatusValues.Where(v => v.Screen == value.Screen && v.Id != id).ToListAsync(cancellationToken).ConfigureAwait(false);
        if (others.Any(v => Same(v.NameAr, change.NameAr) || Same(v.NameEn, change.NameEn)))
        {
            return Result.Failure(Taken);
        }

        value.Set(change.NameAr, change.NameEn, change.SortOrder, change.IsActive);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>The screen's fixed status values (its record's status choices), or null when it has none.</summary>
    private IReadOnlyList<RecordFieldOption>? SystemOf(string screen) =>
        engine.AdapterFor(screen)?.Screen.Fields.FirstOrDefault(f => f.Key == StatusField && f.Type == RecordFieldType.Choice)?.Options;

    private static bool Valid(string? name) => !string.IsNullOrWhiteSpace(name) && name.Trim().Length <= 100;

    private static bool Same(string a, string b) => string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase);

    private static string CodeOf(string name)
    {
        var builder = new StringBuilder();
        foreach (var c in name.Trim().ToLowerInvariant())
        {
            builder.Append(char.IsAsciiLetterOrDigit(c) ? c : '_');
        }

        var code = string.Join('_', builder.ToString().Split('_', StringSplitOptions.RemoveEmptyEntries));
        code = code.Length == 0 || !char.IsAsciiLetter(code[0]) ? $"v_{code}" : code;
        return code.Length > 50 ? code[..50] : code;
    }
}
