using IntegratedErp.BuildingBlocks.Records;
using IntegratedErp.Modules.Attendance.Domain;
using IntegratedErp.Modules.Attendance.Infrastructure;

namespace IntegratedErp.Modules.Attendance.Application;

/// <summary>The attendance tables processes can reach through the entity catalog.</summary>
internal sealed class AttendanceEntities(AttendanceDbContext db) : ModelEntitySource(db, Models)
{
    private const string Employee = "staff.employee";

    private static readonly IEntityModel[] Models =
    [
        new EntityModel<AttendanceMonth>(MonthAdapter.ScreenCode, "شهر الحضور", "Attendance month"),
        new EntityModel<OvertimeRequest>(OvertimeAdapter.ScreenCode, "طلب العمل الإضافي", "Overtime request")
            .Lookup(nameof(OvertimeRequest.EmployeeId), Employee, "الموظف", "Employee"),
    ];
}
