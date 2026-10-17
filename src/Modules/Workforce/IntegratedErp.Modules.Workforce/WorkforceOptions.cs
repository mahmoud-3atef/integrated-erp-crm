namespace IntegratedErp.Modules.Workforce;

/// <summary>Workforce settings (appsettings "Workforce").</summary>
public sealed class WorkforceOptions
{
    public const string Section = "Workforce";

    /// <summary>
    /// The old system's projects that stand for inactive workers, by name: a worker "on the job" on one of them is
    /// not working and is left out of every count.
    /// </summary>
    public string[] InactiveProjects { get; set; } = ["InActive Employee"];

    internal HashSet<string> InactiveProjectNames => InactiveProjects.Select(n => n.Trim()).Where(n => n.Length > 0).ToHashSet(StringComparer.OrdinalIgnoreCase);

    internal bool IsInactiveProject(string? name) => name is not null && InactiveProjectNames.Contains(name.Trim());
}
