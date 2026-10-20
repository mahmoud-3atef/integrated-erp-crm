using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Leave.Api;
using IntegratedErp.Modules.Leave.Application;
using IntegratedErp.Modules.Leave.Contracts;
using IntegratedErp.Modules.Leave.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Leave;

/// <summary>
/// Leave module (docs/03-migration-plan/09): the staff's leave — types with the labour law's defaults, balances as
/// entries with a monthly accrual, and leave requests through approval that the attendance counts as leave.
/// </summary>
public sealed class LeaveModule : IModule
{
    public const string RequestSequence = "leave_request";

    public string Name => LeaveContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<LeaveDbContext>(configuration, LeaveDbContext.SchemaName);
        services.AddScoped<LeaveSetup>();
        services.AddScoped<LeaveBalances>();
        services.AddScoped<LeaveRequests>();
        services.AddScoped<LeaveQueries>();
        services.AddScoped<IApprovedLeaves, ApprovedLeaves>();
        services.AddScoped<IApprovalRecordAdapter, LeaveAdapter>();
        services.AddPermissions(LeavePermissions.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition(RequestSequence, LeaveDbContext.SchemaName, "الإجازات", "Leave", "طلبات الإجازة", "Leave requests", "LV-{YYYY}-{N:5}", NumberReset.Yearly));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapLeaveEndpoints();
}

internal static class LeavePermissions
{
    public const string View = "leave.view";
    public const string Manage = "leave.manage";
    public const string Settings = "leave.settings";
    public const string Approve = "leave.approve";
    public const string ApproveManagement = "leave.approve.management";

    private const string GroupAr = "الإجازات";
    private const string GroupEn = "Leave";

    public static readonly PermissionDefinition[] All =
    [
        new(View, GroupAr, GroupEn, "عرض الإجازات والأرصدة", "View leave and balances"),
        new(Manage, GroupAr, GroupEn, "طلب الإجازة نيابة عن الموظف وإدارة الأرصدة", "Request leave for employees and manage balances"),
        new(Settings, GroupAr, GroupEn, "إدارة أنواع الإجازات وإعداداتها", "Manage leave types and settings"),
        new(Approve, GroupAr, GroupEn, "اعتماد الإجازات (الموارد البشرية)", "Approve leave (HR)"),
        new(ApproveManagement, GroupAr, GroupEn, "اعتماد الإجازات (الإدارة العليا)", "Approve leave (senior management)"),
    ];
}
