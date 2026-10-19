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
    DateOnly? EndedOn);

/// <summary>A department, for filters and shift assignments.</summary>
public sealed record StaffDepartment(Guid Id, string NameAr, string NameEn, Guid? ParentId);

/// <summary>The staff and the departments, read-only.</summary>
public interface IStaffDirectory
{
    /// <summary>Every employee file (those who left too: their past months still count).</summary>
    Task<IReadOnlyList<StaffMember>> MembersAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<StaffDepartment>> DepartmentsAsync(CancellationToken cancellationToken);
}
