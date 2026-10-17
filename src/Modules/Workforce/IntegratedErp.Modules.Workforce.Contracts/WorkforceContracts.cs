namespace IntegratedErp.Modules.Workforce.Contracts;

/// <summary>
/// Public surface of the Workforce module: people (one record per person, with identity numbers that cannot repeat)
/// and the worker / staff file. In the parallel phase the records are built from the old CRM's copy.
/// </summary>
public static class WorkforceContracts
{
    public const string ModuleName = "Workforce";
}

/// <summary>A worker as another module shows it (e.g. on a project's page).</summary>
public sealed record WorkerInfo(
    Guid Id,
    string WorkerNo,
    string Name,
    string Placement,
    string? StatusAr,
    string? StatusEn,
    string? ProfessionAr,
    string? ProfessionEn,
    string? NationalityAr,
    string? NationalityEn,
    DateOnly? JoinedOn);

/// <summary>A worker on the job, with what prices them: the project, profession, nationality and total salary.</summary>
public sealed record WorkingWorker(
    Guid Id,
    Guid CrmId,
    string WorkerNo,
    string Name,
    Guid ProjectCrmId,
    string? ProfessionCode,
    string? NationalityCode,
    decimal TotalSalary,
    DateOnly? JoinedOn);

/// <summary>
/// A worker as a movement document picks them: who they are, where they are now and what prices them.
/// <paramref name="Available"/>: an active worker in housing (or new), who can be delivered to a project.
/// </summary>
public sealed record WorkerCard(
    Guid Id,
    Guid CrmId,
    string WorkerNo,
    string Name,
    string Placement,
    bool Available,
    string? StatusAr,
    string? StatusEn,
    string? ProfessionCode,
    string? ProfessionAr,
    string? ProfessionEn,
    string? NationalityCode,
    string? NationalityAr,
    string? NationalityEn,
    string? IqamaNo,
    DateOnly? IqamaExpiresOn,
    decimal TotalSalary,
    Guid? ProjectCrmId,
    string? ProjectName,
    DateOnly? ProjectJoinedOn = null,
    bool OnJob = false,
    string? Sponsor = null,
    decimal BasicSalary = 0);

/// <summary>Workers (not company staff) by CRM project, for the project and customer pages.</summary>
public interface IWorkforceDirectory
{
    /// <summary>Workers on the job, by the CRM project they work on.</summary>
    Task<IReadOnlyDictionary<Guid, int>> WorkingByProjectAsync(CancellationToken cancellationToken);

    /// <summary>The workers whose current project is this CRM project (on the job first).</summary>
    Task<IReadOnlyList<WorkerInfo>> OnProjectAsync(Guid crmProjectId, CancellationToken cancellationToken);

    /// <summary>Every worker on the job on a CRM project (for the price packages).</summary>
    Task<IReadOnlyList<WorkingWorker>> WorkingAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Workers (not staff) matching a search: worker number, name or any identity number; several numbers separated by
    /// spaces or commas find each of them. Available workers first.
    /// </summary>
    Task<IReadOnlyList<WorkerCard>> SearchAsync(string search, int take, CancellationToken cancellationToken);

    /// <summary>Every available worker: an active worker (not staff) in housing or new, who can be delivered to a project.</summary>
    Task<IReadOnlyList<WorkerCard>> AvailableAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Every worker on the job (to return to housing): with an open work period opened here, or on the job in the old
    /// system when nothing opened here says otherwise.
    /// </summary>
    Task<IReadOnlyList<WorkerCard>> OnJobAsync(CancellationToken cancellationToken);

    /// <summary>The cards of these workers (unknown ids are left out).</summary>
    Task<IReadOnlyList<WorkerCard>> CardsAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken);

    /// <summary>The cards of the workers with these worker numbers or CRM ids (for documents copied from the old system).</summary>
    Task<IReadOnlyList<WorkerCard>> CardsByCrmAsync(IReadOnlyCollection<string> workerNos, IReadOnlyCollection<Guid> crmIds, CancellationToken cancellationToken);
}
