namespace IntegratedErp.Modules.Organization.Domain.Settings;

/// <summary>
/// One effective-dated value of a setting at one scope. Values are JSON text so any shape
/// (number, flag, object) can be stored; typed reading happens in the application layer.
/// The validity range is <c>[EffectiveFrom, EffectiveTo)</c> — the end date is exclusive, null means open.
/// </summary>
public sealed class Setting
{
    public const int KeyMaxLength = 200;

    private Setting()
    {
        // EF Core
        Key = string.Empty;
        Value = string.Empty;
    }

    private Setting(string key, SettingScope scope, string value, DateOnly effectiveFrom)
    {
        Id = Guid.CreateVersion7();
        Key = key;
        ScopeType = scope.Type;
        TenantId = scope.TenantId;
        ScopeId = scope.ScopeId;
        Value = value;
        EffectiveFrom = effectiveFrom;
    }

    public Guid Id { get; private set; }

    public string Key { get; private set; }

    public SettingScopeType ScopeType { get; private set; }

    public Guid? TenantId { get; private set; }

    public Guid? ScopeId { get; private set; }

    public string Value { get; private set; }

    public DateOnly EffectiveFrom { get; private set; }

    public DateOnly? EffectiveTo { get; private set; }

    public SettingScope Scope => SettingScope.Restore(ScopeType, TenantId, ScopeId);

    public bool IsEffectiveOn(DateOnly date) => EffectiveFrom <= date && (EffectiveTo is null || date < EffectiveTo);

    internal static Setting Create(string key, SettingScope scope, string value, DateOnly effectiveFrom) =>
        new(NormalizeKey(key), scope, value, effectiveFrom);

    internal void ChangeValue(string value) => Value = value;

    internal void CloseOn(DateOnly endExclusive)
    {
        if (endExclusive <= EffectiveFrom)
        {
            throw new InvalidOperationException("A setting version cannot end on or before its start.");
        }

        EffectiveTo = endExclusive;
    }

    public static string NormalizeKey(string key)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);

        var normalized = key.Trim().ToLowerInvariant();
        if (normalized.Length > KeyMaxLength)
        {
            throw new ArgumentException($"Setting key is longer than {KeyMaxLength} characters.", nameof(key));
        }

        return normalized;
    }
}
