using IntegratedErp.BuildingBlocks.Records;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>The payroll tables processes can reach through the entity catalog.</summary>
internal sealed class PayrollEntities(PayrollDbContext db) : ModelEntitySource(db, Models)
{
    private static readonly IEntityModel[] Models =
    [
        new EntityModel<PayrollRun>(PayrollAdapter.ScreenCode, "مسير رواتب العمالة", "Worker payroll run"),
        new EntityModel<StaffPayrollRun>(StaffPayrollAdapter.ScreenCode, "مسير رواتب الموظفين", "Staff payroll run"),
        new EntityModel<Settlement>(SettlementAdapter.ScreenCode, "مخالصة الموظف", "Staff settlement")
            .Lookup(nameof(Settlement.PersonId), "staff.employee", "الموظف", "Employee")
            .Lookup(nameof(Settlement.LeaveRequestId), "leave.request", "طلب الإجازة", "Leave request")
            .Number(nameof(Settlement.LeaveDays)),
        new EntityModel<Settlement>(WorkerSettlementAdapter.ScreenCode, "مخالصة العامل", "Worker settlement")
            .Lookup(nameof(Settlement.PersonId), "workforce.worker", "العامل", "Worker")
            .Lookup(nameof(Settlement.LeaveRequestId), "operations.movement", "مغادرة الإجازة", "Vacation departure")
            .Number(nameof(Settlement.LeaveDays)),
    ];
}
