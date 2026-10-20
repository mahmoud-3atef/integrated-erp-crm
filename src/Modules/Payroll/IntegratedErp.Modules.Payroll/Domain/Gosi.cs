using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Payroll.Domain;

public enum GosiPersonKind
{
    Staff,
    Worker,
}

/// <summary>
/// A person's contributory wage as registered with GOSI (docs/03-migration-plan/12): the contribution is on it, so the
/// payroll matches GOSI's invoice; a salary change opens a task to update it there, and closing the task moves it here.
/// </summary>
public sealed class GosiMember : ITenantOwned
{
    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public GosiPersonKind Kind { get; private set; }

    public Guid PersonId { get; private set; }

    public decimal? RegisteredWage { get; private set; }

    public DateOnly? RegisteredOn { get; private set; }

    public DateOnly? ExcludedOn { get; private set; }

    public static GosiMember Create(GosiPersonKind kind, Guid personId, decimal? wage, DateOnly? on) => new()
    {
        Id = Guid.CreateVersion7(),
        Kind = kind,
        PersonId = personId,
        RegisteredWage = wage,
        RegisteredOn = on,
    };

    public void Register(decimal wage, DateOnly on)
    {
        RegisteredWage = decimal.Round(wage, 2);
        RegisteredOn = on;
        ExcludedOn = null;
    }

    public void Exclude(DateOnly on) => ExcludedOn = on;
}

public enum GosiTaskKind
{
    /// <summary>A new employee without a GOSI number: register them.</summary>
    Register,

    /// <summary>The basic and housing changed from the wage registered with GOSI: update it there.</summary>
    WageUpdate,

    /// <summary>The employee left: exclude them from GOSI.</summary>
    Exclude,
}

public enum GosiTaskStatus
{
    Open,
    Done,

    /// <summary>No longer needed (the wage came back to the registered one, the employee returned…).</summary>
    Resolved,
}

/// <summary>What HR has to do on GOSI's portal for an employee, opened by the system and closed with the transaction.</summary>
public sealed class GosiTask : ITenantOwned
{
    private GosiTask()
    {
        EmployeeNo = string.Empty;
        Name = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public GosiTaskKind Kind { get; private set; }

    public GosiTaskStatus Status { get; private set; }

    public Guid EmployeeId { get; private set; }

    public string EmployeeNo { get; private set; }

    public string Name { get; private set; }

    public Guid? LegalEntityId { get; private set; }

    public decimal? OldWage { get; private set; }

    public decimal? NewWage { get; private set; }

    public DateOnly? EventOn { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? DoneAt { get; private set; }

    public string? DoneByName { get; private set; }

    public DateOnly? DoneOn { get; private set; }

    public string? Reference { get; private set; }

    public static GosiTask Open(GosiTaskKind kind, Guid employeeId, string employeeNo, string name, Guid? legalEntityId, decimal? oldWage, decimal? newWage, DateOnly? eventOn, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        Kind = kind,
        Status = GosiTaskStatus.Open,
        EmployeeId = employeeId,
        EmployeeNo = employeeNo,
        Name = name.Length > 300 ? name[..300] : name,
        LegalEntityId = legalEntityId,
        OldWage = oldWage,
        NewWage = newWage,
        EventOn = eventOn,
        CreatedAt = at,
    };

    /// <summary>The wage changed again while the task was open: it now asks for the latest one.</summary>
    public void Refresh(decimal? newWage, Guid? legalEntityId)
    {
        NewWage = newWage;
        LegalEntityId = legalEntityId;
    }

    public Result Done(DateOnly on, string? reference, string by, DateTimeOffset at)
    {
        if (Status != GosiTaskStatus.Open || (reference?.Trim().Length ?? 0) > 100)
        {
            return Result.Failure(PayrollErrors.GosiTask);
        }

        Status = GosiTaskStatus.Done;
        DoneOn = on;
        Reference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        DoneByName = by;
        DoneAt = at;
        return Result.Success();
    }

    public void Resolve(DateTimeOffset at)
    {
        Status = GosiTaskStatus.Resolved;
        DoneAt = at;
    }
}

/// <summary>GOSI's monthly invoice for a commercial registration, entered by finance to compare with the payroll.</summary>
public sealed class GosiInvoice : ITenantOwned
{
    private GosiInvoice()
    {
        Period = string.Empty;
        EnteredByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid LegalEntityId { get; private set; }

    public string Period { get; private set; }

    public decimal Amount { get; private set; }

    public string? Note { get; private set; }

    public string EnteredByName { get; private set; }

    public DateTimeOffset EnteredAt { get; private set; }

    public static GosiInvoice Create(Guid legalEntityId, string period) => new() { Id = Guid.CreateVersion7(), LegalEntityId = legalEntityId, Period = period };

    public Result Set(decimal amount, string? note, string by, DateTimeOffset at)
    {
        if (amount < 0 || amount > 1_000_000_000 || (note?.Trim().Length ?? 0) > 500)
        {
            return Result.Failure(PayrollErrors.GosiInvoice);
        }

        Amount = decimal.Round(amount, 2);
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        EnteredByName = by;
        EnteredAt = at;
        return Result.Success();
    }
}

/// <summary>How Saudization is counted: a Saudi with a contributory wage at or above the full wage counts as one, below it as half.</summary>
public sealed class SaudizationSetting : ITenantOwned
{
    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public decimal FullWage { get; private set; } = 4000;

    public static SaudizationSetting Default() => new() { Id = Guid.CreateVersion7() };

    public Result Set(decimal fullWage)
    {
        if (fullWage is < 0 or > 100_000)
        {
            return Result.Failure(PayrollErrors.Setting);
        }

        FullWage = fullWage;
        return Result.Success();
    }
}

/// <summary>The Saudization percentage a commercial registration has to keep (from Qiwa / Nitaqat).</summary>
public sealed class SaudizationTarget : ITenantOwned
{
    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid LegalEntityId { get; private set; }

    public decimal RequiredPercent { get; private set; }

    public static SaudizationTarget Create(Guid legalEntityId) => new() { Id = Guid.CreateVersion7(), LegalEntityId = legalEntityId };

    public Result Set(decimal percent)
    {
        if (percent is < 0 or > 100)
        {
            return Result.Failure(PayrollErrors.Setting);
        }

        RequiredPercent = percent;
        return Result.Success();
    }
}
