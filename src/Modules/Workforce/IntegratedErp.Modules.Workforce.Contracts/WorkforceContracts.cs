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

/// <summary>Workers (not company staff) by CRM project, for the project and customer pages.</summary>
public interface IWorkforceDirectory
{
    /// <summary>Workers on the job, by the CRM project they work on.</summary>
    Task<IReadOnlyDictionary<Guid, int>> WorkingByProjectAsync(CancellationToken cancellationToken);

    /// <summary>The workers whose current project is this CRM project (on the job first).</summary>
    Task<IReadOnlyList<WorkerInfo>> OnProjectAsync(Guid crmProjectId, CancellationToken cancellationToken);

    /// <summary>Every worker on the job on a CRM project (for the price packages).</summary>
    Task<IReadOnlyList<WorkingWorker>> WorkingAsync(CancellationToken cancellationToken);
}
