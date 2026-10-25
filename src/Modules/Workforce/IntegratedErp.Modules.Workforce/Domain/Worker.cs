using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workforce.Domain;

/// <summary>Worker (operations, placed with customers) or company staff (head office).</summary>
public enum WorkerKind
{
    Worker,
    Staff,
}

/// <summary>
/// Where the worker is now, as the old system's status shows it. In phase 2 this comes from the period ledger
/// (movement documents); until then it is the CRM status.
/// </summary>
public enum Placement
{
    Working,
    New,
    Housing,
    Vacation,
    Suspended,
    Exited,
    Absconded,
    Other,

    /// <summary>
    /// On the job in the old system, but on a project that stands for inactive workers ("InActive Employee"): not
    /// working, and left out of every count (dashboard, lists, prices, movements).
    /// </summary>
    Inactive,
}

/// <summary>The worker's life cycle (not where they are): docs/02-target-architecture/04 §3.</summary>
public enum Lifecycle
{
    Active,
    Absconded,
    FinalExit,
    EndOfService,
    TransferredOut,
    Deceased,
    Suspended,
}

/// <summary>
/// Monthly salary and allowances (SAR), as the old system's salary section shows them: <see cref="Project"/> is the
/// CRM "mobile/fixed" allowance shown there as the project allowance; <see cref="Hardship"/> is the CRM hard-work
/// allowance (not on the old screen).
/// </summary>
public sealed record Salary(
    decimal Basic,
    decimal Housing,
    decimal Food,
    decimal Transport,
    decimal Overtime,
    decimal Other,
    decimal Project,
    decimal Hardship,
    decimal Total);

/// <summary>The employment contract dates.</summary>
public sealed record ContractTerms(DateOnly? StartsOn, int? Months, DateOnly? EndsOn);

/// <summary>Annual leave entitlement and balances (days).</summary>
public sealed record LeaveBalance(decimal? AnnualDays, decimal? Balance, decimal? Consumed, decimal? OldConsumed, decimal? Remaining);

/// <summary>
/// A worker's or staff member's file. In the parallel phase it is a copy of the CRM employee (read-only here; kept
/// current by the import after every sync), linked to its <see cref="Person"/>.
/// </summary>
public sealed class Worker : ITenantOwned
{
    private Worker()
    {
        WorkerNo = string.Empty;
        Salary = new Salary(0, 0, 0, 0, 0, 0, 0, 0, 0);
        Contract = new ContractTerms(null, null, null);
        Leave = new LeaveBalance(null, null, null, null, null);
    }

    public Worker(Guid personId, Guid crmId)
        : this()
    {
        Id = Guid.CreateVersion7();
        PersonId = personId;
        CrmId = crmId;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid PersonId { get; private set; }

    /// <summary>The CRM employee this file comes from.</summary>
    public Guid CrmId { get; private set; }

    /// <summary>Employee number, e.g. BSS000196.</summary>
    public string WorkerNo { get; private set; }

    public WorkerKind Kind { get; private set; }

    /// <summary>Item code of the professions list.</summary>
    public string? ProfessionCode { get; private set; }

    /// <summary>The profession written in the Iqama (professions list), when different.</summary>
    public string? IqamaProfessionCode { get; private set; }

    /// <summary>The CRM professions they came from (to follow later changes of the profession mapping).</summary>
    public Guid? ProfessionCrmId { get; private set; }

    public Guid? IqamaProfessionCrmId { get; private set; }

    /// <summary>CRM status code (kept to show the exact old status).</summary>
    public int? CrmStatus { get; private set; }

    public Placement Placement { get; private set; }

    public Lifecycle Lifecycle { get; private set; }

    /// <summary>Sponsor or supplier, e.g. "Care-Pro - 05".</summary>
    public string? Sponsor { get; private set; }

    public string? RecruitmentAgent { get; private set; }

    public Guid? ProjectCrmId { get; private set; }

    public string? ProjectName { get; private set; }

    public DateOnly? ProjectJoinedOn { get; private set; }

    /// <summary>Arrival in the Kingdom.</summary>
    public DateOnly? ArrivedOn { get; private set; }

    public Salary Salary { get; private set; }

    public ContractTerms Contract { get; private set; }

    public LeaveBalance Leave { get; private set; }

    public DateTimeOffset? CrmCreatedAt { get; private set; }

    /// <summary>The CRM record no longer exists (deleted there).</summary>
    public bool RemovedInCrm { get; private set; }

    /// <summary>
    /// Added in this system (2026-10-25), not copied from the CRM: its <see cref="CrmId"/> is its own id, so the sync never
    /// finds, changes or removes it.
    /// </summary>
    public bool CreatedHere { get; private set; }

    /// <summary>A new worker added here (status «new» until a delivery order puts them on a project).</summary>
    public static Worker CreateHere(Guid personId, WorkerSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        var id = Guid.CreateVersion7();
        var worker = new Worker(personId, id) { Id = id, CreatedHere = true };
        worker.Update(snapshot);
        return worker;
    }

    /// <summary>
    /// Puts a worker the old system has on the job on an inactive project (see <see cref="Placement.Inactive"/>) out
    /// of the counts, or back when their project changes. Returns whether the placement changed.
    /// </summary>
    public bool SetOnInactiveProject(bool inactive)
    {
        var (placement, _) = CrmWorkerStatus.Map(CrmStatus);
        var next = inactive && placement == Placement.Working ? Placement.Inactive : placement;
        if (next == Placement)
        {
            return false;
        }

        Placement = next;
        return true;
    }

    public void Update(WorkerSnapshot s)
    {
        ArgumentNullException.ThrowIfNull(s);
        WorkerNo = s.WorkerNo;
        Kind = s.Kind;
        ProfessionCrmId = s.ProfessionCrmId;
        IqamaProfessionCrmId = s.IqamaProfessionCrmId;
        ProfessionCode = s.ProfessionCode;
        IqamaProfessionCode = s.IqamaProfessionCode;
        CrmStatus = s.CrmStatus;
        (Placement, Lifecycle) = CrmWorkerStatus.Map(s.CrmStatus);
        Sponsor = s.Sponsor;
        RecruitmentAgent = s.RecruitmentAgent;
        ProjectCrmId = s.ProjectCrmId;
        ProjectName = s.ProjectName;
        ProjectJoinedOn = s.ProjectJoinedOn;
        ArrivedOn = s.ArrivedOn;
        Salary = s.Salary;
        Contract = s.Contract;
        Leave = s.Leave;
        CrmCreatedAt = s.CrmCreatedAt;
        RemovedInCrm = false;
    }

    public void MarkRemovedInCrm() => RemovedInCrm = true;

    /// <summary>The profession mapping changed (e.g. "worker" merged into another profession).</summary>
    public void Remap(string? professionCode, string? iqamaProfessionCode)
    {
        ProfessionCode = professionCode;
        IqamaProfessionCode = iqamaProfessionCode;
    }

    /// <summary>
    /// The file's data changed here by someone allowed to (the user's request, 2026-10-25). In the parallel phase the
    /// old system wins: the next change of the CRM record brings its values back (the user's decision).
    /// </summary>
    public void Edit(WorkerEdit e)
    {
        ArgumentNullException.ThrowIfNull(e);
        ProfessionCode = e.ProfessionCode;
        IqamaProfessionCode = e.IqamaProfessionCode;
        Sponsor = e.Sponsor;
        RecruitmentAgent = e.RecruitmentAgent;
        ArrivedOn = e.ArrivedOn;
        Contract = e.Contract;
        Leave = e.Leave;
    }

    /// <summary>A new salary (directly, or from an approved salary change); the total is the sum of its parts.</summary>
    public void SetSalary(Salary salary)
    {
        ArgumentNullException.ThrowIfNull(salary);
        Salary = Totalled(salary);
    }

    /// <summary>The salary with its total recomputed from the parts.</summary>
    public static Salary Totalled(Salary s) =>
        s with { Total = s.Basic + s.Housing + s.Food + s.Transport + s.Overtime + s.Other + s.Project + s.Hardship };
}

/// <summary>The worker's data that can be changed here (not the project, the status or the dates of movements: the period ledger keeps those).</summary>
public sealed record WorkerEdit(
    string? ProfessionCode,
    string? IqamaProfessionCode,
    string? Sponsor,
    string? RecruitmentAgent,
    DateOnly? ArrivedOn,
    ContractTerms Contract,
    LeaveBalance Leave);

/// <summary>A worker's data as read from the CRM, applied in one go.</summary>
public sealed record WorkerSnapshot(
    string WorkerNo,
    WorkerKind Kind,
    Guid? ProfessionCrmId,
    string? ProfessionCode,
    Guid? IqamaProfessionCrmId,
    string? IqamaProfessionCode,
    int? CrmStatus,
    string? Sponsor,
    string? RecruitmentAgent,
    Guid? ProjectCrmId,
    string? ProjectName,
    DateOnly? ProjectJoinedOn,
    DateOnly? ArrivedOn,
    Salary Salary,
    ContractTerms Contract,
    LeaveBalance Leave,
    DateTimeOffset? CrmCreatedAt);

/// <summary>The old system's status codes (docs/01-current-system-analysis/03) and what they mean here.</summary>
public static class CrmWorkerStatus
{
    private static readonly Dictionary<int, (Placement, Lifecycle, string Ar, string En)> Known = new()
    {
        [1] = (Placement.New, Lifecycle.Active, "جديد", "New"),
        [2] = (Placement.Other, Lifecycle.Active, "غير نشط", "Inactive"),
        [100000000] = (Placement.Working, Lifecycle.Active, "على رأس العمل", "On the job"),
        [100000001] = (Placement.Vacation, Lifecycle.Active, "إجازة", "On vacation"),
        [100000004] = (Placement.Absconded, Lifecycle.Absconded, "هروب", "Absconded"),
        [279640000] = (Placement.Housing, Lifecycle.Active, "مرتجع (في السكن)", "Returned (in housing)"),
        [279640001] = (Placement.Housing, Lifecycle.Active, "في السكن", "In housing"),
        [279640003] = (Placement.Exited, Lifecycle.EndOfService, "تم إنهاء خدماته", "End of service"),
        [279640007] = (Placement.Exited, Lifecycle.FinalExit, "خروج نهائي", "Final exit"),
        [279640009] = (Placement.Exited, Lifecycle.FinalExit, "خرج ولم يعد", "Left and did not return"),
        [279640010] = (Placement.Other, Lifecycle.Active, "في السجن", "In jail"),
        [279640011] = (Placement.Exited, Lifecycle.Deceased, "متوفى", "Deceased"),
        [279640012] = (Placement.Housing, Lifecycle.Active, "جارٍ تسويقه", "Being marketed"),
        [279640013] = (Placement.Suspended, Lifecycle.Suspended, "موقوف", "Suspended"),
        [279640014] = (Placement.Vacation, Lifecycle.Active, "إجازة على العميل", "Customer vacation"),
        [279640015] = (Placement.Other, Lifecycle.Active, "في الفرع", "At a branch"),
        [279640016] = (Placement.Other, Lifecycle.Active, "مرسل إلى الفرع", "Sent to a branch"),
        [279640018] = (Placement.Suspended, Lifecycle.Suspended, "مريض", "Sick"),
        [279640019] = (Placement.Housing, Lifecycle.Active, "سكن مؤقت", "Temporary housing"),
        [279640020] = (Placement.Housing, Lifecycle.Active, "في السكن (محجوز)", "In housing (reserved)"),
        [279640025] = (Placement.Exited, Lifecycle.TransferredOut, "تم نقل كفالته", "Sponsorship transferred"),
        [279640026] = (Placement.Exited, Lifecycle.FinalExit, "خروج نهائي (فيروس سي)", "Final exit (hepatitis C)"),
    };

    public static (Placement Placement, Lifecycle Lifecycle) Map(int? code) =>
        code is { } c && Known.TryGetValue(c, out var known) ? (known.Item1, known.Item2) : (Placement.Other, Lifecycle.Active);

    /// <summary>The old status name, e.g. "في السكن"; null for an unknown code.</summary>
    public static (string Ar, string En)? Name(int? code) =>
        code is { } c && Known.TryGetValue(c, out var known) ? (known.Ar, known.En) : null;
}

/// <summary>The CRM's "Sponsored by" values (new_sponseredby).</summary>
public static class CrmSponsors
{
    private static readonly Dictionary<int, string> Names = new()
    {
        [100000000] = "Care-Pro - 05",
        [100000001] = "Esad - 01",
        [100000002] = "IRC - 02",
        [100000003] = "JAWA - 03",
        [100000004] = "Mehan - 14",
        [100000005] = "Riadty - 09",
        [100000006] = "Watan - 12",
        [100000007] = "Ewan - 13",
        [100000008] = "Care-pro - 07",
        [100000009] = "Maharah - 15",
    };

    public static string? Name(int? code) => code is { } c ? Names.GetValueOrDefault(c) : null;

    public static IReadOnlyCollection<string> All => Names.Values;
}

/// <summary>What the last import from the CRM copy did (one row per company).</summary>
public sealed class WorkforceImport : ITenantOwned
{
    public Guid Id { get; private set; } = Guid.CreateVersion7();

    public Guid TenantId { get; private set; }

    /// <summary>Staged records copied after this time are imported next time.</summary>
    public DateTimeOffset? Watermark { get; private set; }

    public DateTimeOffset? LastRunAt { get; private set; }

    public string? Summary { get; private set; }

    public void Done(DateTimeOffset watermark, DateTimeOffset at, string summary)
    {
        Watermark = watermark;
        LastRunAt = at;
        Summary = summary.Length > 2000 ? summary[..2000] : summary;
    }
}
