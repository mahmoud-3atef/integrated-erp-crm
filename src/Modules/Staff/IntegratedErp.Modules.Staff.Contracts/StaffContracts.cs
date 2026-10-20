namespace IntegratedErp.Modules.Staff.Contracts;

/// <summary>
/// Public surface of the Staff module (docs/02-target-architecture/08): the company's staff — the organisation
/// (departments, job titles, grades, positions) and the employee files.
/// </summary>
public static class StaffContracts
{
    public const string ModuleName = "Staff";
}

/// <summary>An employee as other modules see them (attendance, later payroll): who, where, and since when.</summary>
public sealed record StaffMember(
    Guid Id,
    string EmployeeNo,
    string? NameAr,
    string NameEn,
    string? IdNumber,
    Guid? LegalEntityId,
    Guid? DepartmentId,
    string? DepartmentAr,
    string? DepartmentEn,
    string? JobTitleAr,
    string? JobTitleEn,
    string Status,
    DateOnly? HireDate,
    DateOnly? EndedOn,
    Guid? UserId = null);

/// <summary>A department, for filters and shift assignments.</summary>
public sealed record StaffDepartment(Guid Id, string NameAr, string NameEn, Guid? ParentId);

/// <summary>The staff and the departments, read-only.</summary>
public interface IStaffDirectory
{
    /// <summary>Every employee file (those who left too: their past months still count).</summary>
    Task<IReadOnlyList<StaffMember>> MembersAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<StaffDepartment>> DepartmentsAsync(CancellationToken cancellationToken);

    /// <summary>
    /// The employee's direct manager (whoever holds the position theirs reports to; else their department's manager, or
    /// a parent department's), with the manager's sign-in account when linked.
    /// </summary>
    Task<StaffManager?> ManagerAsync(Guid employeeId, CancellationToken cancellationToken);

    /// <summary>The employee's monthly salary (basic and allowances) in effect on a date; null when none is recorded.</summary>
    Task<StaffPay?> SalaryAsync(Guid employeeId, DateOnly on, CancellationToken cancellationToken);
}

public sealed record StaffPay(decimal Basic, decimal Total);

public sealed record StaffManager(Guid EmployeeId, string Name, Guid? UserId);

/// <summary>
/// An employee as the staff payroll needs them (4.8): where they work, their dates and nationality, their GOSI start,
/// their bank, and the salary in effect at the period's end with the salary changes inside the period.
/// </summary>
public sealed record StaffPayInfo(
    Guid EmployeeId,
    string EmployeeNo,
    string Name,
    Guid? LegalEntityId,
    Guid? DepartmentId,
    string? DepartmentAr,
    string? DepartmentEn,
    string? JobTitleAr,
    string? JobTitleEn,
    string Status,
    DateOnly? HireDate,
    DateOnly? EndedOn,
    string? NationalityCode,
    DateOnly? GosiSince,
    string? BankName,
    string? Iban,
    StaffSalaryInfo? Salary,
    bool SalaryChangedInPeriod,
    decimal ActingAllowance,
    string? GosiNo = null,
    string? IdNumber = null);

public sealed record StaffSalaryInfo(decimal Basic, decimal Housing, decimal Food, decimal Transport, decimal Mobile, decimal Project, decimal Other, decimal Total);

/// <summary>The staff's pay data, read-only, for the staff payroll.</summary>
public interface IStaffPayroll
{
    /// <summary>Every employee file employed at some time in the period (and those who left in it).</summary>
    Task<IReadOnlyList<StaffPayInfo>> PayInfoAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);

    /// <summary>How many active employees have no commercial registration (they are in no payroll).</summary>
    Task<int> WithoutRegistrationAsync(CancellationToken cancellationToken);

    /// <summary>Records the GOSI number and the day the employee joined GOSI (closing a GOSI registration task, 4.9).</summary>
    Task<bool> SetGosiAsync(Guid employeeId, string gosiNo, DateOnly? since, CancellationToken cancellationToken);
}
