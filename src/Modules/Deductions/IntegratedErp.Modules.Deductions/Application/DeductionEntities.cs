using IntegratedErp.BuildingBlocks.Records;
using IntegratedErp.Modules.Deductions.Domain;
using IntegratedErp.Modules.Deductions.Infrastructure;

namespace IntegratedErp.Modules.Deductions.Application;

/// <summary>The deductions tables processes can reach through the entity catalog.</summary>
internal sealed class DeductionEntities(DeductionsDbContext db) : ModelEntitySource(db, Models)
{
    private const string Employee = "staff.employee";
    public const string PenaltyType = "deduction.penalty_type";

    private static readonly IEntityModel[] Models =
    [
        new EntityModel<Advance>(AdvanceAdapter.ScreenCode, "السلفة", "Salary advance")
            .Lookup(nameof(Advance.EmployeeId), Employee, "الموظف", "Employee")
            .User(nameof(Advance.ManagerUserId))
            .Number(nameof(Advance.Months)),
        new EntityModel<Penalty>(PenaltyAdapter.ScreenCode, "الجزاء", "Penalty")
            .Lookup(nameof(Penalty.EmployeeId), Employee, "الموظف", "Employee")
            .Lookup(nameof(Penalty.PenaltyTypeId), PenaltyType, "نوع الجزاء", "Penalty type")
            .Number(nameof(Penalty.Days)),
        new EntityModel<Penalty>(OtherDeductionAdapter.ScreenCode, "الخصم", "Other deduction")
            .Lookup(nameof(Penalty.EmployeeId), Employee, "الموظف", "Employee"),
        new EntityModel<Domain.PenaltyType>(PenaltyType, "نوع الجزاء", "Penalty type"),
    ];
}
