using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workflow.Domain;

/// <summary>The company's setting for a kind of alert: on or off, and its threshold in days.</summary>
public sealed class AlertSetting : ITenantOwned
{
    private AlertSetting()
    {
        Code = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Code { get; private set; }

    public bool Enabled { get; private set; }

    public int Days { get; private set; }

    public string? UpdatedByName { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public static AlertSetting Create(string code) => new() { Id = Guid.CreateVersion7(), Code = code, Enabled = true };

    public void Set(bool enabled, int days, string by, DateTimeOffset at)
    {
        Enabled = enabled;
        Days = days;
        UpdatedByName = by;
        UpdatedAt = at;
    }
}

/// <summary>A user hid an alert until a day (it shows again then, if it still stands).</summary>
public sealed class AlertDismissal : ITenantOwned
{
    private AlertDismissal()
    {
        Code = string.Empty;
        Key = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid UserId { get; private set; }

    public string Code { get; private set; }

    public string Key { get; private set; }

    public DateOnly Until { get; private set; }

    public static AlertDismissal Create(Guid userId, string code, string key, DateOnly until) =>
        new() { Id = Guid.CreateVersion7(), UserId = userId, Code = code, Key = key, Until = until };

    public void Extend(DateOnly until) => Until = until;
}

/// <summary>An alert already told in a morning digest (it is told again only after it went away and came back).</summary>
public sealed class AlertNotice : ITenantOwned
{
    private AlertNotice()
    {
        Code = string.Empty;
        Key = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Code { get; private set; }

    public string Key { get; private set; }

    public DateTimeOffset NotifiedAt { get; private set; }

    public static AlertNotice Create(string code, string key, DateTimeOffset at) => new() { Id = Guid.CreateVersion7(), Code = code, Key = key, NotifiedAt = at };
}

/// <summary>The day the company's morning digest last ran (once a day).</summary>
public sealed class AlertDigestRun : ITenantOwned
{
    private AlertDigestRun()
    {
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public DateOnly Day { get; private set; }

    public static AlertDigestRun Create(DateOnly day) => new() { Id = Guid.CreateVersion7(), Day = day };
}
