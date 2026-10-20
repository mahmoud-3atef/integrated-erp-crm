using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Deductions.Api;
using IntegratedErp.Modules.Deductions.Application;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Deductions.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Deductions;

/// <summary>
/// Deductions module (docs/03-migration-plan/10): the staff's salary advances, penalties and other deductions, each
/// through approval, and the month's due amounts for the staff payroll.
/// </summary>
public sealed class DeductionsModule : IModule
{
    public const string AdvanceSequence = "deduction_advance";
    public const string PenaltySequence = "deduction_penalty";
    public const string OtherSequence = "deduction_other";

    public string Name => DeductionContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<DeductionsDbContext>(configuration, DeductionsDbContext.SchemaName);
        services.AddScoped<DeductionSetup>();
        services.AddScoped<AdvanceService>();
        services.AddScoped<PenaltyService>();
        services.AddScoped<DeductionQueries>();
        services.AddScoped<IStaffDeductions, StaffDeductions>();
        services.AddScoped<IApprovalRecordAdapter, AdvanceAdapter>();
        services.AddScoped<IApprovalRecordAdapter, PenaltyAdapter>();
        services.AddScoped<IApprovalRecordAdapter, OtherDeductionAdapter>();
        services.AddPermissions(DeductionPermissions.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition(AdvanceSequence, DeductionsDbContext.SchemaName, "الموارد البشرية", "Human resources", "السلف", "Salary advances", "ADV-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition(PenaltySequence, DeductionsDbContext.SchemaName, "الموارد البشرية", "Human resources", "الجزاءات", "Penalties", "PEN-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition(OtherSequence, DeductionsDbContext.SchemaName, "الموارد البشرية", "Human resources", "الخصومات الأخرى", "Other deductions", "DED-{YYYY}-{N:5}", NumberReset.Yearly));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapDeductionEndpoints();
}

internal static class DeductionPermissions
{
    public const string View = "deductions.view";
    public const string Manage = "deductions.manage";
    public const string Settings = "deductions.settings";
    public const string Disburse = "deductions.disburse";
    public const string ApproveHr = "deductions.approve.hr";
    public const string ApproveFinance = "deductions.approve.finance";
    public const string ApproveManagement = "deductions.approve.management";

    private const string GroupAr = "السلف والجزاءات";
    private const string GroupEn = "Advances and penalties";

    public static readonly PermissionDefinition[] All =
    [
        new(View, GroupAr, GroupEn, "عرض السلف والجزاءات والخصومات", "View advances, penalties and deductions"),
        new(Manage, GroupAr, GroupEn, "طلب السلف وتسجيل الجزاءات والخصومات", "Request advances and record penalties and deductions"),
        new(Settings, GroupAr, GroupEn, "إدارة إعدادات السلف والجزاءات وأنواعها", "Manage the advance and penalty settings and types"),
        new(Disburse, GroupAr, GroupEn, "صرف السلف وسدادها المبكر (المالية)", "Pay advances and settle them early (finance)"),
        new(ApproveHr, GroupAr, GroupEn, "اعتماد السلف والجزاءات (الموارد البشرية)", "Approve advances and penalties (HR)"),
        new(ApproveFinance, GroupAr, GroupEn, "اعتماد السلف والخصومات (المالية)", "Approve advances and deductions (finance)"),
        new(ApproveManagement, GroupAr, GroupEn, "اعتماد الجزاءات (الإدارة العليا)", "Approve penalties (senior management)"),
    ];
}
