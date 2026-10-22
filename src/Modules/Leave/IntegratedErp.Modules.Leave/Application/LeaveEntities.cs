using IntegratedErp.BuildingBlocks.Records;
using IntegratedErp.Modules.Leave.Domain;
using IntegratedErp.Modules.Leave.Infrastructure;

namespace IntegratedErp.Modules.Leave.Application;

/// <summary>The leave tables processes can reach through the entity catalog.</summary>
internal sealed class LeaveEntities(LeaveDbContext db) : ModelEntitySource(db, Models)
{
    private const string Employee = "staff.employee";
    public const string Type = "leave.type";

    private static readonly IEntityModel[] Models =
    [
        new EntityModel<LeaveRequest>(LeaveAdapter.ScreenCode, "طلب الإجازة", "Leave request")
            .Lookup(nameof(LeaveRequest.EmployeeId), Employee, "الموظف", "Employee")
            .Lookup(nameof(LeaveRequest.SubstituteId), Employee, "البديل", "Substitute")
            .Lookup(nameof(LeaveRequest.LeaveTypeId), Type, "نوع الإجازة", "Leave type")
            .User(nameof(LeaveRequest.ManagerUserId))
            .Number(nameof(LeaveRequest.Days)),
        new EntityModel<PermissionRequest>(PermissionAdapter.ScreenCode, "الاستئذان", "Permission")
            .Lookup(nameof(PermissionRequest.EmployeeId), Employee, "الموظف", "Employee")
            .User(nameof(PermissionRequest.ManagerUserId)),
        new EntityModel<LeaveType>(Type, "نوع الإجازة", "Leave type"),
    ];
}
