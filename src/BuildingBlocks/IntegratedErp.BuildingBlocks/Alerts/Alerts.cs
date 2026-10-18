using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.BuildingBlocks.Alerts;

/// <summary>How urgent an alert is.</summary>
public enum AlertSeverity
{
    Info,
    Warning,
    Critical,
}

/// <summary>
/// A kind of alert a module raises (docs/03-migration-plan/05, slice 2.6): its code, its group and names, who sees it
/// (<see cref="ViewPermission"/>) and who is told of new ones each morning (<see cref="NotifyPermission"/>), and its
/// threshold in days (<see cref="DefaultDays"/>; the company can change it, or turn the alert off).
/// </summary>
public sealed record AlertDefinition(
    string Code,
    string GroupAr,
    string GroupEn,
    string NameAr,
    string NameEn,
    string DaysMeaningAr,
    string DaysMeaningEn,
    int DefaultDays,
    string ViewPermission,
    string NotifyPermission);

/// <summary>
/// One alert: its kind, the thing it is about (<see cref="Key"/> is stable while the situation lasts, so it is told once
/// and can be hidden), what to say, where to act, and since when.
/// </summary>
public sealed record AlertItem(
    string Code,
    string Key,
    AlertSeverity Severity,
    string TitleAr,
    string TitleEn,
    string? DetailAr,
    string? DetailEn,
    string Link,
    DateOnly Since,
    decimal? Amount = null);

/// <summary>What a provider is asked: today, and each of its alerts' threshold in days (as the company set it).</summary>
public sealed record AlertQuery(DateOnly Today, IReadOnlyDictionary<string, int> Days)
{
    public int DaysOf(AlertDefinition definition) => Days.TryGetValue(definition.Code, out var days) ? days : definition.DefaultDays;
}

/// <summary>A module's alerts: computed from its own records when asked (nothing is stored but what was already told).</summary>
public interface IAlertProvider
{
    IReadOnlyList<AlertDefinition> Definitions { get; }

    /// <summary>The current alerts of the given codes (the ones the asker may see and the company has on).</summary>
    Task<IReadOnlyList<AlertItem>> AlertsAsync(AlertQuery query, IReadOnlySet<string> codes, CancellationToken cancellationToken);
}

public static class AlertExtensions
{
    /// <summary>Declares a module's alert provider (call from <c>IModule.RegisterServices</c>).</summary>
    public static IServiceCollection AddAlertProvider<TProvider>(this IServiceCollection services)
        where TProvider : class, IAlertProvider
    {
        services.AddScoped<IAlertProvider, TProvider>();
        return services;
    }
}

/// <summary>
/// A counted noun in correct Arabic: one, two (dual), 3–10 (plural), 11 and more (singular accusative) —
/// e.g. <c>ArabicCount.Of(4, "فاتورة واحدة", "فاتورتان", "فواتير", "فاتورة")</c> ⇒ «4 فواتير».
/// </summary>
public static class ArabicCount
{
    public static string Of(int n, string one, string two, string few, string many) => Math.Abs(n) switch
    {
        1 => one,
        2 => two,
        >= 3 and <= 10 => $"{n} {few}",
        _ => $"{n} {many}",
    };

    /// <summary>Days, after «منذ»، «بعد» or «متأخر»: «يوم واحد»، «يومين»، «5 أيام»، «12 يومًا».</summary>
    public static string Days(int n) => Of(n, "يوم واحد", "يومين", "أيام", "يومًا");
}
