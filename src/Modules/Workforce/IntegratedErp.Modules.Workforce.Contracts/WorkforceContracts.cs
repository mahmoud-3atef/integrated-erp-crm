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

/// <summary>
/// A worker's monthly salary as the payroll splits it: basic, housing, food, transport and the rest (overtime
/// allowance, project, hardship and other allowances), with the total the old system holds.
/// </summary>
public sealed record WorkerSalary(Guid WorkerId, string? Sponsor, decimal Basic, decimal Housing, decimal Food, decimal Transport, decimal Other, decimal Total);

/// <summary>The workers' salaries, for the payroll (salaries are read only by the payroll module).</summary>
public interface IWorkerSalaries
{
    /// <summary>The salaries of these workers (unknown ids are left out).</summary>
    Task<IReadOnlyList<WorkerSalary>> SalariesAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken);
}

/// <summary>
/// A company staff member as the old system holds them (new_employeetype = staff), for the Staff module to build its
/// employee files from: who they are, their salary, contract dates and leave balance there.
/// </summary>
public sealed record StaffRecord(
    Guid WorkerId,
    Guid PersonId,
    string EmployeeNo,
    string NameEn,
    string? NameAr,
    string? IdNumber,
    string? NationalityCode,
    string? NationalityAr,
    string? NationalityEn,
    string? ProfessionCode,
    string? StatusAr,
    string? StatusEn,
    bool Active,
    string? Sponsor,
    DateOnly? JoinedOn,
    WorkerSalary Salary,
    decimal Mobile,
    decimal Project,
    DateOnly? ContractStartsOn,
    int? ContractMonths,
    DateOnly? ContractEndsOn,
    decimal? AnnualLeaveDays,
    decimal? LeaveBalance,
    decimal? LeaveConsumed,
    decimal? LeaveOldConsumed,
    decimal? LeaveRemaining);

/// <summary>The company's staff in the old system's copy (read by the Staff module).</summary>
public interface IStaffRecords
{
    Task<IReadOnlyList<StaffRecord>> StaffAsync(CancellationToken cancellationToken);
}

/// <summary>Where the company's workers are now (the dashboard's count: the period ledger first, then the old system).</summary>
public sealed record WorkforceNow(int OnJob, int InHousing, int ProjectsWithWorkers);

/// <param name="Kind"><c>Work</c> (a work start: delivery or transfer) or <c>Housing</c> (a return to housing).</param>
/// <param name="FromProjectCrmId">For a return: the project the worker came back from (the work just before).</param>
/// <param name="FromStartedOn">For a return: when that work began (how long the worker stayed on the project).</param>
public sealed record WorkforceMove(
    Guid WorkerId,
    string WorkerNo,
    string Name,
    string Kind,
    DateOnly StartsOn,
    Guid? ProjectCrmId,
    string? Place,
    Guid? FromProjectCrmId,
    string? FromPlace,
    DateOnly? FromStartedOn = null);

/// <summary>A worker who joined the company in a period (the old system's «date of joining»), and how they have fared since.</summary>
public sealed record WorkforceArrival(Guid WorkerId, string WorkerNo, string Name, string? Sponsor, DateOnly ArrivedOn, string Placement, DateOnly? FirstWorkOn, string? FirstProject, int WorkDays, int HousingDays);

/// <summary>A worker in housing now: since when, and where from.</summary>
public sealed record WorkforceInHousing(Guid WorkerId, string WorkerNo, string Name, DateOnly Since, string? Place, Guid? FromProjectCrmId, string? FromPlace, decimal MonthlySalary);

/// <summary>The workforce's numbers for the reports (read only).</summary>
public interface IWorkforceReport
{
    Task<WorkforceNow> NowAsync(CancellationToken cancellationToken);

    /// <summary>
    /// The work starts and returns to housing starting in a period, from the timeline (the old system's history up to
    /// each worker's first period recorded here, then the recorded ones); none of inactive workers, nor work starts on an
    /// inactive project.
    /// </summary>
    Task<IReadOnlyList<WorkforceMove>> MovesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);

    /// <summary>The workers who joined the company in a period, with their first work and their days at work and in housing to today.</summary>
    Task<IReadOnlyList<WorkforceArrival>> ArrivalsAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);

    /// <summary>The active workers in housing now, the longest there first.</summary>
    Task<IReadOnlyList<WorkforceInHousing>> InHousingAsync(CancellationToken cancellationToken);
}

/// <summary>A work period on a worker's record, for their showroom file.</summary>
public sealed record WorkerStint(string? Place, Guid? ProjectCrmId, DateOnly StartsOn, DateOnly? EndsOn);

/// <summary>
/// What the showroom shows of a worker (docs/03-migration-plan/15): the marketing profile written here, the photos (the
/// main one first), and the work with the company.
/// </summary>
/// <param name="SuggestedSpecialty">From the last work place's name while no specialty is set (e.g. «- Waiter»).</param>
public sealed record WorkerShowcaseInfo(
    Guid WorkerId,
    string? Specialty,
    string? SuggestedSpecialty,
    IReadOnlyList<string> Skills,
    IReadOnlyList<string> Languages,
    string? Gender,
    DateOnly? BirthDate,
    string? Religion,
    string? Education,
    int? PriorExperienceYears,
    string? BioAr,
    string? BioEn,
    IReadOnlyList<Guid> Photos,
    int WorkDays,
    IReadOnlyList<WorkerStint> Stints);

public interface IWorkerShowcase
{
    Task<IReadOnlyList<WorkerShowcaseInfo>> ForAsync(IReadOnlyCollection<Guid> workerIds, CancellationToken cancellationToken);
}

/// <summary>What a worker costs on a day, for the profitability (docs/03-migration-plan/16).</summary>
/// <param name="Source"><c>Company</c>, <c>Supplier</c> or <c>Unknown</c>, from the sponsor.</param>
/// <param name="SupplierMonthlyCost">For a supplier's worker: the cost agreed with the supplier (null: not entered yet).</param>
/// <param name="ByWorkingDays">The supplier charges by the days on the job (else the whole month).</param>
/// <param name="Salary">The worker's total salary on their file.</param>
public sealed record WorkerCostInfo(Guid WorkerId, string Source, string? Supplier, decimal? SupplierMonthlyCost, bool? ByWorkingDays, decimal Salary);

public interface IWorkerCosts
{
    Task<IReadOnlyList<WorkerCostInfo>> CostsAsync(IReadOnlyCollection<Guid> workerIds, DateOnly on, CancellationToken cancellationToken);
}
