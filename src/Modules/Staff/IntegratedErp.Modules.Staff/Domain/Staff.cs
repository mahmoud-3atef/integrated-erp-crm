using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Staff.Domain;

// The company's staff (docs/02-target-architecture/08): not operation workers. Their place is the organisation — a
// tree of departments, job titles and grades, and positions (seats) in departments — and their file holds their
// employment, their salary by effective date, their contract dates and leave balance.

/// <summary>A department or section: departments nest without a fixed depth.</summary>
public sealed class Department : ITenantOwned
{
    private Department()
    {
        NameAr = string.Empty;
        NameEn = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid? ParentId { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    /// <summary>The cost centre the department's salaries go to.</summary>
    public string? CostCenter { get; private set; }

    /// <summary>The department's manager (an employee): the direct manager of those without a reporting position.</summary>
    public Guid? ManagerId { get; private set; }

    public int SortOrder { get; private set; }

    public bool IsActive { get; private set; } = true;

    public static Result<Department> Create(string nameAr, string nameEn, Guid? parentId, string? costCenter, Guid? managerId, int sortOrder)
    {
        var department = new Department { Id = Guid.CreateVersion7() };
        var set = department.Set(nameAr, nameEn, parentId, costCenter, managerId, sortOrder, true);
        return set.IsFailure ? Result.Failure<Department>(set.Error) : Result.Success(department);
    }

    public Result Set(string nameAr, string nameEn, Guid? parentId, string? costCenter, Guid? managerId, int sortOrder, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(nameAr) || nameAr.Trim().Length > 150 || (nameEn?.Trim().Length ?? 0) > 150)
        {
            return Result.Failure(StaffErrors.Name);
        }

        if (parentId == Id)
        {
            return Result.Failure(StaffErrors.ParentLoop);
        }

        NameAr = nameAr.Trim();
        NameEn = string.IsNullOrWhiteSpace(nameEn) ? NameAr : nameEn.Trim();
        ParentId = parentId;
        CostCenter = string.IsNullOrWhiteSpace(costCenter) ? null : costCenter.Trim();
        ManagerId = managerId;
        SortOrder = sortOrder;
        IsActive = isActive;
        return Result.Success();
    }
}

/// <summary>A job title of the catalogue (Arabic and English), with its occupation for Qiwa and the residence permit.</summary>
public sealed class JobTitle : ITenantOwned
{
    private JobTitle()
    {
        NameAr = string.Empty;
        NameEn = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    public string? OccupationCode { get; private set; }

    public bool IsActive { get; private set; } = true;

    public static Result<JobTitle> Create(string nameAr, string nameEn, string? occupationCode)
    {
        var title = new JobTitle { Id = Guid.CreateVersion7() };
        var set = title.Set(nameAr, nameEn, occupationCode, true);
        return set.IsFailure ? Result.Failure<JobTitle>(set.Error) : Result.Success(title);
    }

    public Result Set(string nameAr, string nameEn, string? occupationCode, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(nameAr) || nameAr.Trim().Length > 150 || (nameEn?.Trim().Length ?? 0) > 150)
        {
            return Result.Failure(StaffErrors.Name);
        }

        NameAr = nameAr.Trim();
        NameEn = string.IsNullOrWhiteSpace(nameEn) ? NameAr : nameEn.Trim();
        OccupationCode = string.IsNullOrWhiteSpace(occupationCode) ? null : occupationCode.Trim();
        IsActive = isActive;
        return Result.Success();
    }
}

/// <summary>A grade and its basic salary band.</summary>
public sealed class Grade : ITenantOwned
{
    private Grade()
    {
        Code = string.Empty;
        NameAr = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Code { get; private set; }

    public string NameAr { get; private set; }

    public decimal? MinBasic { get; private set; }

    public decimal? MaxBasic { get; private set; }

    public bool IsActive { get; private set; } = true;

    public static Result<Grade> Create(string code, string nameAr, decimal? minBasic, decimal? maxBasic)
    {
        var grade = new Grade { Id = Guid.CreateVersion7() };
        var set = grade.Set(code, nameAr, minBasic, maxBasic, true);
        return set.IsFailure ? Result.Failure<Grade>(set.Error) : Result.Success(grade);
    }

    public Result Set(string code, string nameAr, decimal? minBasic, decimal? maxBasic, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(code) || code.Trim().Length > 20 || string.IsNullOrWhiteSpace(nameAr) || nameAr.Trim().Length > 100)
        {
            return Result.Failure(StaffErrors.Name);
        }

        if (minBasic < 0 || maxBasic < 0 || (minBasic is { } min && maxBasic is { } max && max < min))
        {
            return Result.Failure(StaffErrors.Band);
        }

        Code = code.Trim();
        NameAr = nameAr.Trim();
        MinBasic = minBasic;
        MaxBasic = maxBasic;
        IsActive = isActive;
        return Result.Success();
    }
}

/// <summary>
/// A position of the establishment: a job title in a department, of a grade, reporting to another position, with its
/// number of seats (a seat not taken by an employee is a vacancy).
/// </summary>
public sealed class Position : ITenantOwned
{
    private Position()
    {
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid DepartmentId { get; private set; }

    public Guid JobTitleId { get; private set; }

    public Guid? GradeId { get; private set; }

    public Guid? ReportsToId { get; private set; }

    public int Seats { get; private set; } = 1;

    public bool IsActive { get; private set; } = true;

    public static Result<Position> Create(Guid departmentId, Guid jobTitleId, Guid? gradeId, Guid? reportsToId, int seats)
    {
        var position = new Position { Id = Guid.CreateVersion7() };
        var set = position.Set(departmentId, jobTitleId, gradeId, reportsToId, seats, true);
        return set.IsFailure ? Result.Failure<Position>(set.Error) : Result.Success(position);
    }

    public Result Set(Guid departmentId, Guid jobTitleId, Guid? gradeId, Guid? reportsToId, int seats, bool isActive)
    {
        if (seats is < 1 or > 500)
        {
            return Result.Failure(StaffErrors.Seats);
        }

        if (reportsToId == Id)
        {
            return Result.Failure(StaffErrors.ParentLoop);
        }

        DepartmentId = departmentId;
        JobTitleId = jobTitleId;
        GradeId = gradeId;
        ReportsToId = reportsToId;
        Seats = seats;
        IsActive = isActive;
        return Result.Success();
    }
}

public enum StaffStatus
{
    Active,

    /// <summary>Within the probation period.</summary>
    Probation,

    Suspended,

    /// <summary>No longer with the company (end of service, resignation, transfer).</summary>
    Left,
}

/// <summary>
/// A staff member's file: who they are, where they work (registration, branch, department, position), their status,
/// hire and probation dates, contract dates and leave balance. Files of the old system's staff are built by the import
/// and keep their number; a new hire gets the next number of the «staff» sequence.
/// </summary>
public sealed class StaffEmployee : ITenantOwned
{
    private StaffEmployee()
    {
        EmployeeNo = string.Empty;
        NameEn = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>The old system's employee (Workforce), when the file was imported.</summary>
    public Guid? WorkerId { get; private set; }

    public Guid? PersonId { get; private set; }

    public string EmployeeNo { get; private set; }

    public string? NameAr { get; private set; }

    public string NameEn { get; private set; }

    public string? IdNumber { get; private set; }

    public string? NationalityCode { get; private set; }

    public string? NationalityAr { get; private set; }

    public string? NationalityEn { get; private set; }

    public DateOnly? BirthDate { get; private set; }

    public string? Mobile { get; private set; }

    public string? Email { get; private set; }

    public string? GosiNo { get; private set; }

    public StaffStatus Status { get; private set; }

    public DateOnly? HireDate { get; private set; }

    public DateOnly? ProbationEndsOn { get; private set; }

    public Guid? LegalEntityId { get; private set; }

    public Guid? BranchId { get; private set; }

    public Guid? DepartmentId { get; private set; }

    public Guid? PositionId { get; private set; }

    public DateOnly? ContractStartsOn { get; private set; }

    public int? ContractMonths { get; private set; }

    public DateOnly? ContractEndsOn { get; private set; }

    public decimal? AnnualLeaveDays { get; private set; }

    public decimal? LeaveBalance { get; private set; }

    public decimal? LeaveConsumed { get; private set; }

    public decimal? LeaveOldConsumed { get; private set; }

    public decimal? LeaveRemaining { get; private set; }

    /// <summary>The old system's status of the employee, as it is there (shown beside ours in the parallel phase).</summary>
    public string? LegacyStatusAr { get; private set; }

    public string? LegacyStatusEn { get; private set; }

    public string? Sponsor { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset? ImportedAt { get; private set; }

    /// <summary>The name to show: Arabic when there is one.</summary>
    public string DisplayName => NameAr ?? NameEn;

    public static StaffEmployee Hire(string employeeNo, string? nameAr, string nameEn, DateOnly hireDate, int probationDays, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        EmployeeNo = employeeNo,
        NameAr = Clean(nameAr),
        NameEn = nameEn.Trim(),
        HireDate = hireDate,
        ProbationEndsOn = probationDays > 0 ? hireDate.AddDays(probationDays) : null,
        Status = probationDays > 0 ? StaffStatus.Probation : StaffStatus.Active,
        CreatedAt = at,
        CreatedByName = by,
    };

    /// <summary>A file for one of the old system's staff, from the import.</summary>
    public static StaffEmployee FromOldSystem(Guid workerId, Guid personId, string employeeNo, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        WorkerId = workerId,
        PersonId = personId,
        EmployeeNo = employeeNo,
        CreatedAt = at,
        CreatedByName = "النظام القديم",
    };

    /// <summary>
    /// What the old system holds (the import, again after each sync): identity, contract dates, leave balance and its
    /// status. The organisation (department, position) and the salary changes made here are never touched.
    /// </summary>
    public void Refresh(OldSystemValues v, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(v);
        NameEn = v.NameEn;
        NameAr = Clean(v.NameAr) ?? NameAr;
        IdNumber = Clean(v.IdNumber) ?? IdNumber;
        NationalityCode = v.NationalityCode ?? NationalityCode;
        NationalityAr = v.NationalityAr ?? NationalityAr;
        NationalityEn = v.NationalityEn ?? NationalityEn;
        HireDate ??= v.JoinedOn;
        ContractStartsOn = v.ContractStartsOn ?? ContractStartsOn;
        ContractMonths = v.ContractMonths ?? ContractMonths;
        ContractEndsOn = v.ContractEndsOn
            ?? (v.ContractStartsOn is { } start && v.ContractMonths is > 0 ? start.AddMonths(v.ContractMonths.Value).AddDays(-1) : (DateOnly?)null)
            ?? ContractEndsOn;
        AnnualLeaveDays = v.AnnualLeaveDays;
        LeaveBalance = v.LeaveBalance;
        LeaveConsumed = v.LeaveConsumed;
        LeaveOldConsumed = v.LeaveOldConsumed;
        LeaveRemaining = v.LeaveRemaining;
        LegacyStatusAr = v.StatusAr;
        LegacyStatusEn = v.StatusEn;
        Sponsor = v.Sponsor;
        if (!v.Active)
        {
            Status = StaffStatus.Left;
        }
        else if (Status == StaffStatus.Left)
        {
            Status = StaffStatus.Active;
        }

        ImportedAt = at;
    }

    public Result SetPersonal(string? nameAr, string nameEn, string? idNumber, string? nationalityCode, string? nationalityAr, string? nationalityEn,
        DateOnly? birthDate, string? mobile, string? email, string? gosiNo)
    {
        if (string.IsNullOrWhiteSpace(nameEn) || nameEn.Trim().Length > 300 || (nameAr?.Trim().Length ?? 0) > 300)
        {
            return Result.Failure(StaffErrors.Name);
        }

        if ((mobile?.Trim().Length ?? 0) > 30 || (email?.Trim().Length ?? 0) > 200 || (idNumber?.Trim().Length ?? 0) > 30 || (gosiNo?.Trim().Length ?? 0) > 30)
        {
            return Result.Failure(StaffErrors.Value);
        }

        NameAr = Clean(nameAr);
        NameEn = nameEn.Trim();
        IdNumber = Clean(idNumber);
        NationalityCode = Clean(nationalityCode);
        NationalityAr = nationalityAr;
        NationalityEn = nationalityEn;
        BirthDate = birthDate;
        Mobile = Clean(mobile);
        Email = Clean(email);
        GosiNo = Clean(gosiNo);
        return Result.Success();
    }

    public void SetJob(Guid? legalEntityId, Guid? branchId, Guid? departmentId, Guid? positionId, DateOnly? hireDate, DateOnly? probationEndsOn, StaffStatus status)
    {
        LegalEntityId = legalEntityId;
        BranchId = branchId;
        DepartmentId = departmentId;
        PositionId = positionId;
        HireDate = hireDate;
        ProbationEndsOn = probationEndsOn;
        Status = status;
    }

    /// <summary>The day the employment ended (end of probation, contract not renewed, …).</summary>
    public DateOnly? EndedOn { get; private set; }

    /// <summary>The employee's sign-in account (set from the users screen): who approves as their manager, and later self-service.</summary>
    public Guid? UserId { get; private set; }

    public void LinkUser(Guid? userId) => UserId = userId;

    /// <summary>The bank the salary is transferred to (the payroll's bank file and Mudad).</summary>
    public string? BankName { get; private set; }

    public string? Iban { get; private set; }

    public string? AccountHolder { get; private set; }

    /// <summary>The day the employee joined GOSI (the rates differ for those who joined after 2024-07-03).</summary>
    public DateOnly? GosiSince { get; private set; }

    public Result SetBank(string? bankName, string? iban, string? accountHolder)
    {
        var cleaned = Ibans.Normalize(iban);
        if ((cleaned is not null && !Ibans.Valid(cleaned)) || (bankName?.Trim().Length ?? 0) > 100 || (accountHolder?.Trim().Length ?? 0) > 200)
        {
            return Result.Failure(StaffErrors.Iban);
        }

        BankName = Clean(bankName);
        Iban = cleaned;
        AccountHolder = Clean(accountHolder);
        return Result.Success();
    }

    public void SetGosiSince(DateOnly? since) => GosiSince = since;

    /// <summary>Acting in another position until a date, with a monthly allowance (paid by the payroll).</summary>
    public Guid? ActingPositionId { get; private set; }

    public DateOnly? ActingUntil { get; private set; }

    public decimal? ActingAllowance { get; private set; }

    public void SetActing(Guid positionId, DateOnly until, decimal allowance)
    {
        ActingPositionId = positionId;
        ActingUntil = until;
        ActingAllowance = allowance;
    }

    public void ConfirmProbation()
    {
        if (Status == StaffStatus.Probation)
        {
            Status = StaffStatus.Active;
        }
    }

    public void ExtendProbation(DateOnly until) => ProbationEndsOn = until;

    public void EndEmployment(DateOnly on)
    {
        Status = StaffStatus.Left;
        EndedOn = on;
    }

    public void Place(Guid? legalEntityId, Guid? departmentId, Guid? positionId)
    {
        LegalEntityId = legalEntityId;
        DepartmentId = departmentId;
        PositionId = positionId;
    }

    public Result SetContract(DateOnly? startsOn, int? months, DateOnly? endsOn)
    {
        if (months is < 0 or > 600 || (startsOn is { } s && endsOn is { } e && e < s))
        {
            return Result.Failure(StaffErrors.Contract);
        }

        ContractStartsOn = startsOn;
        ContractMonths = months;
        ContractEndsOn = endsOn ?? (startsOn is { } start && months is > 0 ? start.AddMonths(months.Value).AddDays(-1) : null);
        return Result.Success();
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed record OldSystemValues(
    string NameEn,
    string? NameAr,
    string? IdNumber,
    string? NationalityCode,
    string? NationalityAr,
    string? NationalityEn,
    DateOnly? JoinedOn,
    DateOnly? ContractStartsOn,
    int? ContractMonths,
    DateOnly? ContractEndsOn,
    decimal? AnnualLeaveDays,
    decimal? LeaveBalance,
    decimal? LeaveConsumed,
    decimal? LeaveOldConsumed,
    decimal? LeaveRemaining,
    string? StatusAr,
    string? StatusEn,
    bool Active,
    string? Sponsor);

public enum SalarySource
{
    /// <summary>As the old system holds it (kept current by the import until a change is made here).</summary>
    OldSystem,
    Hire,
    Change,
}

/// <summary>A staff member's salary from a date: each change is a new row, the earlier ones stay as the history.</summary>
public sealed class StaffSalary : ITenantOwned
{
    private StaffSalary()
    {
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public DateOnly EffectiveFrom { get; private set; }

    public decimal Basic { get; private set; }

    public decimal Housing { get; private set; }

    public decimal Food { get; private set; }

    public decimal Transport { get; private set; }

    public decimal Mobile { get; private set; }

    public decimal Project { get; private set; }

    public decimal Other { get; private set; }

    public decimal Total { get; private set; }

    public SalarySource Source { get; private set; }

    public string? Reason { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public string CreatedByName { get; private set; }

    public static Result<StaffSalary> Create(Guid employeeId, DateOnly effectiveFrom, SalaryValues v, SalarySource source, string? reason, string by, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(v);
        if (new[] { v.Basic, v.Housing, v.Food, v.Transport, v.Mobile, v.Project, v.Other }.Any(x => x < 0 || x > 10_000_000))
        {
            return Result.Failure<StaffSalary>(StaffErrors.Value);
        }

        if (source == SalarySource.Change && string.IsNullOrWhiteSpace(reason))
        {
            return Result.Failure<StaffSalary>(StaffErrors.Reason);
        }

        return Result.Success(new StaffSalary
        {
            Id = Guid.CreateVersion7(),
            EmployeeId = employeeId,
            EffectiveFrom = effectiveFrom,
            Basic = v.Basic,
            Housing = v.Housing,
            Food = v.Food,
            Transport = v.Transport,
            Mobile = v.Mobile,
            Project = v.Project,
            Other = v.Other,
            Total = v.Basic + v.Housing + v.Food + v.Transport + v.Mobile + v.Project + v.Other,
            Source = source,
            Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(),
            CreatedAt = at,
            CreatedByName = by,
        });
    }

    /// <summary>The old system's salary changed and no change was made here: follow it.</summary>
    public void Follow(SalaryValues v)
    {
        ArgumentNullException.ThrowIfNull(v);
        Basic = v.Basic;
        Housing = v.Housing;
        Food = v.Food;
        Transport = v.Transport;
        Mobile = v.Mobile;
        Project = v.Project;
        Other = v.Other;
        Total = v.Basic + v.Housing + v.Food + v.Transport + v.Mobile + v.Project + v.Other;
    }

    public bool Same(SalaryValues v) =>
        Basic == v.Basic && Housing == v.Housing && Food == v.Food && Transport == v.Transport && Mobile == v.Mobile && Project == v.Project && Other == v.Other;
}

public sealed record SalaryValues(decimal Basic, decimal Housing, decimal Food, decimal Transport, decimal Mobile, decimal Project, decimal Other);

public static class StaffErrors
{
    public static readonly Error NotFound = Error.NotFound("staff_employee", "Employee not found.");
    public static readonly Error DepartmentNotFound = Error.NotFound("staff_department", "Department not found.");
    public static readonly Error PositionNotFound = Error.NotFound("staff_position", "Position not found.");
    public static readonly Error JobTitleNotFound = Error.NotFound("staff_job_title", "Job title not found.");
    public static readonly Error GradeNotFound = Error.NotFound("staff_grade", "Grade not found.");
    public static readonly Error Name = Error.Validation("staff_name", "Enter the name (Arabic required, 150 characters at most).");
    public static readonly Error Value = Error.Validation("staff_value", "A value is not valid.");
    public static readonly Error Band = Error.Validation("staff_band", "The grade's band: the maximum at or above the minimum, neither negative.");
    public static readonly Error Seats = Error.Validation("staff_seats", "A position has 1 to 500 seats.");
    public static readonly Error ParentLoop = Error.Validation("staff_parent_loop", "A department or position cannot be under itself.");
    public static readonly Error Contract = Error.Validation("staff_contract", "The contract's end is before its start, or its months are not valid.");
    public static readonly Error Reason = Error.Validation("staff_reason", "A salary change needs a reason.");
    public static readonly Error PositionFull = Error.Conflict("staff_position_full", "Every seat of this position is taken.");
    public static readonly Error UserTaken = Error.Conflict("staff_user_taken", "This account is linked to another employee.");
    public static readonly Error PositionElsewhere = Error.Validation("staff_position_department", "The position belongs to another department.");
    public static readonly Error InUse = Error.Conflict("staff_in_use", "It is in use: move what uses it first.");
    public static readonly Error ActionNotFound = Error.NotFound("staff_action", "Action not found.");
    public static readonly Error ActionFields = Error.Validation("staff_action_fields", "Fill what this action needs (and it applies to the employee's current state).");
    public static readonly Error ActionNotEditable = Error.Conflict("staff_action_not_editable", "Only a draft or returned action can be sent.");
    public static readonly Error ActionOpen = Error.Conflict("staff_action_open", "The employee already has an action in approval.");
    public static readonly Error Iban = Error.Validation("staff_iban", "The IBAN is not valid: a Saudi IBAN is SA and 22 digits.");
    public static readonly Error SalaryDate = Error.Validation("staff_salary_date", "A salary change takes effect after the current salary's date.");
}

/// <summary>Saudi IBANs: «SA» and 22 digits, checked with the ISO 13616 mod-97 rule.</summary>
public static class Ibans
{
    public static string? Normalize(string? iban) =>
        string.IsNullOrWhiteSpace(iban) ? null : string.Concat(iban.Where(c => !char.IsWhiteSpace(c) && c != '-')).ToUpperInvariant();

    public static bool Valid(string iban)
    {
        if (iban.Length != 24 || !iban.StartsWith("SA", StringComparison.Ordinal) || !iban[2..].All(char.IsAsciiDigit))
        {
            return false;
        }

        var rearranged = iban[4..] + iban[..4];
        var remainder = 0;
        foreach (var c in rearranged)
        {
            var value = char.IsAsciiDigit(c) ? (c - '0').ToString(System.Globalization.CultureInfo.InvariantCulture) : (c - 'A' + 10).ToString(System.Globalization.CultureInfo.InvariantCulture);
            foreach (var d in value)
            {
                remainder = ((remainder * 10) + (d - '0')) % 97;
            }
        }

        return remainder == 1;
    }
}
