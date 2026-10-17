using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Organization.Domain.Settings;

/// <summary>
/// The company's numbering of one document type (a declared <see cref="NumberSequenceDefinition"/>): the pattern of
/// its numbers, when its counter starts again, and the least number to issue next (to continue an old serial).
/// </summary>
public sealed class NumberingSetting : ITenantOwned
{
    private NumberingSetting()
    {
        Key = string.Empty;
        Pattern = string.Empty;
        UpdatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Key { get; private set; }

    public string Pattern { get; private set; }

    public NumberReset Reset { get; private set; }

    public long StartAt { get; private set; }

    public string UpdatedByName { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public static NumberingSetting Create(string key) => new() { Id = Guid.CreateVersion7(), Key = key };

    public void Set(string pattern, NumberReset reset, long startAt, string by, DateTimeOffset at)
    {
        Pattern = pattern.Trim();
        Reset = reset;
        StartAt = startAt;
        UpdatedByName = by;
        UpdatedAt = at;
    }
}
