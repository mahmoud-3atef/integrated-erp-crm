namespace IntegratedErp.BuildingBlocks.Time;

/// <summary>
/// The one source of "now". Timestamps are UTC <see cref="DateTimeOffset"/>; business dates are
/// <see cref="DateOnly"/> in Saudi time (docs/02-target-architecture/14 §3). No code calls DateTime.Now.
/// </summary>
public interface IClock
{
    DateTimeOffset UtcNow { get; }

    /// <summary>Today's business date in Riyadh.</summary>
    DateOnly Today { get; }
}

public sealed class SystemClock(TimeProvider timeProvider) : IClock
{
    public DateTimeOffset UtcNow => timeProvider.GetUtcNow();

    public DateOnly Today => SaudiTime.ToBusinessDate(UtcNow);
}

public static class SaudiTime
{
    /// <summary>Asia/Riyadh (UTC+3, no daylight saving). IANA and Windows ids both resolve on .NET 6+.</summary>
    public static TimeZoneInfo Zone { get; } = TimeZoneInfo.FindSystemTimeZoneById("Asia/Riyadh");

    /// <summary>The Riyadh calendar date of an instant — e.g. 2026-10-14 21:30Z is 2026-10-15 in Riyadh.</summary>
    public static DateOnly ToBusinessDate(DateTimeOffset instant) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, Zone).DateTime);

    public static DateTimeOffset ToLocal(DateTimeOffset instant) => TimeZoneInfo.ConvertTime(instant, Zone);
}
