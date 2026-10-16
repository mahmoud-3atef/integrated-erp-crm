using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Organization.Domain.Settings;

/// <summary>
/// Rules for the versions of one setting key at one scope, and for picking the value that applies.
/// Pure functions over the loaded versions, so they are unit-tested without a database.
/// </summary>
public static class SettingTimeline
{
    public static readonly Error FutureVersionExists = Error.Conflict(
        "setting_future_version",
        "A later version of this setting already exists; change it instead of inserting before it.");

    /// <summary>
    /// Applies "value V is effective from date D" to the existing versions (same key and scope).
    /// The version covering D is closed at D and a new open-ended version starts at D;
    /// if a version already starts exactly on D its value is replaced.
    /// Returns the version that now holds the value (new or changed).
    /// </summary>
    public static Result<Setting> SetValue(
        IReadOnlyCollection<Setting> versions,
        string key,
        SettingScope scope,
        string value,
        DateOnly effectiveFrom)
    {
        ArgumentNullException.ThrowIfNull(versions);
        ArgumentNullException.ThrowIfNull(scope);
        ArgumentException.ThrowIfNullOrWhiteSpace(value);

        if (versions.Any(v => v.EffectiveFrom > effectiveFrom))
        {
            return Result.Failure<Setting>(FutureVersionExists);
        }

        var sameDay = versions.FirstOrDefault(v => v.EffectiveFrom == effectiveFrom);
        if (sameDay is not null)
        {
            sameDay.ChangeValue(value);
            return Result.Success(sameDay);
        }

        var covering = versions.FirstOrDefault(v => v.IsEffectiveOn(effectiveFrom));
        covering?.CloseOn(effectiveFrom);

        return Result.Success(Setting.Create(key, scope, value, effectiveFrom));
    }

    /// <summary>
    /// The value that applies on <paramref name="asOf"/> for <paramref name="context"/>:
    /// the most specific scope that has a version effective on that date.
    /// </summary>
    public static Setting? Resolve(IEnumerable<Setting> candidates, SettingContext context, DateOnly asOf)
    {
        ArgumentNullException.ThrowIfNull(candidates);
        ArgumentNullException.ThrowIfNull(context);

        var effective = candidates.Where(c => c.IsEffectiveOn(asOf)).ToList();

        foreach (var scope in context.ScopesByPrecedence())
        {
            var match = effective.FirstOrDefault(c => c.Scope == scope);
            if (match is not null)
            {
                return match;
            }
        }

        return null;
    }
}
