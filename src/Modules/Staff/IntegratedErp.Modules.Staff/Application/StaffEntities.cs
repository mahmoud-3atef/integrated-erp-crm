using IntegratedErp.BuildingBlocks.Records;
using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;

namespace IntegratedErp.Modules.Staff.Application;

/// <summary>The staff tables processes can reach through the entity catalog.</summary>
internal sealed class StaffEntities(StaffDbContext db) : ModelEntitySource(db, Models)
{
    public const string Employee = "staff.employee";
    public const string Department = "staff.department";
    public const string Position = "staff.position";
    public const string JobTitle = "staff.job_title";

    private static readonly IEntityModel[] Models =
    [
        new EntityModel<StaffEmployee>(Employee, "الموظف", "Employee")
            .Lookup(nameof(StaffEmployee.DepartmentId), Department, "الإدارة", "Department")
            .Lookup(nameof(StaffEmployee.PositionId), Position, "الوظيفة", "Position")
            .Lookup(nameof(StaffEmployee.ActingPositionId), Position, "وظيفة التكليف", "Acting position")
            .User(nameof(StaffEmployee.UserId))
            .Hide(nameof(StaffEmployee.Iban), nameof(StaffEmployee.IdNumber), nameof(StaffEmployee.BankName), nameof(StaffEmployee.AccountHolder))
            .Number(nameof(StaffEmployee.AnnualLeaveDays), nameof(StaffEmployee.LeaveBalance), nameof(StaffEmployee.LeaveConsumed), nameof(StaffEmployee.LeaveOldConsumed), nameof(StaffEmployee.LeaveRemaining)),
        new EntityModel<Department>(Department, "الإدارة", "Department")
            .Lookup(nameof(Domain.Department.ParentId), Department, "الإدارة الأم", "Parent department")
            .Lookup(nameof(Domain.Department.ManagerId), Employee, "مدير الإدارة", "Department manager"),
        new EntityModel<Position>(Position, "الوظيفة", "Position")
            .Lookup(nameof(Domain.Position.DepartmentId), Department, "الإدارة", "Department")
            .Lookup(nameof(Domain.Position.JobTitleId), JobTitle, "المسمى الوظيفي", "Job title")
            .Lookup(nameof(Domain.Position.ReportsToId), Position, "تتبع وظيفة", "Reports to"),
        new EntityModel<JobTitle>(JobTitle, "المسمى الوظيفي", "Job title"),
        new EntityModel<StaffAction>(StaffActionAdapter.ScreenCode, "الإجراء الوظيفي", "Employment action")
            .Lookup(nameof(StaffAction.EmployeeId), Employee, "الموظف", "Employee")
            .Lookup(nameof(StaffAction.NewDepartmentId), Department, "الإدارة الجديدة", "New department")
            .Lookup(nameof(StaffAction.NewPositionId), Position, "الوظيفة الجديدة", "New position")
            .Lookup(nameof(StaffAction.OldDepartmentId), Department, "الإدارة السابقة", "Former department")
            .Lookup(nameof(StaffAction.OldPositionId), Position, "الوظيفة السابقة", "Former position")
            .Hide(nameof(StaffAction.PriorFile)),
    ];
}
