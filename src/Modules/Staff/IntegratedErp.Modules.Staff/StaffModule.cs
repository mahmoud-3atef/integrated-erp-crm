using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Staff.Api;
using IntegratedErp.Modules.Staff.Application;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Staff.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Staff;

/// <summary>
/// Staff module (docs/02-target-architecture/08): the company's own staff, apart from the operation workers — the
/// organisation (departments, job titles, grades, positions) and the employee files, built from the old system's
/// staff and kept here.
/// </summary>
public sealed class StaffModule : IModule
{
    public string Name => StaffContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<StaffDbContext>(configuration, StaffDbContext.SchemaName);
        services.AddScoped<StaffService>();
        services.AddScoped<StaffCreateService>();
        services.AddScoped<StructureService>();
        services.AddScoped<StaffQueries>();
        services.AddScoped<StaffDirectory>();
        services.AddScoped<StaffBulkUpdate>();
        services.AddScoped<IStaffDirectory>(sp => sp.GetRequiredService<StaffDirectory>());
        services.AddScoped<IStaffPayroll>(sp => sp.GetRequiredService<StaffDirectory>());
        services.AddScoped<StaffActionService>();
        services.AddScoped<StaffActionApplier>();
        services.AddScoped<StaffActionQueries>();
        services.AddScoped<IApprovalRecordAdapter, StaffActionAdapter>();
        services.AddScoped<IntegratedErp.Modules.Workflow.Contracts.IEntitySource, StaffEntities>();
        services.AddAlertProvider<StaffAlerts>();
        services.AddPermissions(StaffPermissions.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition("staff", StaffDbContext.SchemaName, "الموارد البشرية", "Human resources", "الرقم الوظيفي للموظفين", "Staff numbers", "HO{N:5}", NumberReset.Never),
            new NumberSequenceDefinition("staff_action", StaffDbContext.SchemaName, "الموارد البشرية", "Human resources", "الإجراءات الوظيفية", "Employment actions", "HRA-{YYYY}-{N:5}", NumberReset.Yearly));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapStaffEndpoints();
}

internal static class StaffPermissions
{
    public const string View = "staff.view";
    public const string Manage = "staff.manage";
    public const string StructureManage = "staff.structure.manage";
    public const string SalariesView = "staff.salaries.view";
    public const string SalariesManage = "staff.salaries.manage";
    public const string BankManage = "staff.bank.manage";
    public const string BulkUpdate = "staff.bulk_update";
    public const string ActionsReview = "staff.actions.review";
    public const string ActionsApprove = "staff.actions.approve";

    /// <summary>The kinds of employment action, each with its own permissions to change or cancel it after its approval.</summary>
    private static readonly (StaffActionKind Kind, string Key, string Ar, string En)[] ActionKinds =
    [
        (StaffActionKind.Promotion, "promotion", "ترقية", "Promotion"),
        (StaffActionKind.Transfer, "transfer", "نقل", "Transfer"),
        (StaffActionKind.SalaryChange, "salary_change", "تعديل راتب", "Salary change"),
        (StaffActionKind.Acting, "acting", "تكليف", "Acting"),
        (StaffActionKind.ConfirmProbation, "confirm_probation", "تثبيت بعد التجربة", "Confirm after probation"),
        (StaffActionKind.ExtendProbation, "extend_probation", "تمديد التجربة", "Extend probation"),
        (StaffActionKind.EndProbation, "end_probation", "إنهاء خلال التجربة", "End during probation"),
        (StaffActionKind.RenewContract, "renew_contract", "تجديد العقد", "Contract renewal"),
        (StaffActionKind.NotRenew, "not_renew", "عدم تجديد العقد", "Contract not renewed"),
    ];

    public static string ActionAmend(StaffActionKind kind) => $"staff.actions.{ActionKinds.First(k => k.Kind == kind).Key}.amend";

    public static string ActionCancelApproved(StaffActionKind kind) => $"staff.actions.{ActionKinds.First(k => k.Kind == kind).Key}.cancel_approved";

    private static IEnumerable<PermissionDefinition> ActionAmendments() => ActionKinds.SelectMany(k => new PermissionDefinition[]
    {
        new(ActionAmend(k.Kind), GroupAr, GroupEn, $"تعديل إجراء «{k.Ar}» المطبَّق", $"Change an applied «{k.En}» action"),
        new(ActionCancelApproved(k.Kind), GroupAr, GroupEn, $"إلغاء إجراء «{k.Ar}» المطبَّق (يعود الملف كما كان)", $"Cancel an applied «{k.En}» action (the file goes back as it was)"),
    });

    private const string GroupAr = "الموارد البشرية";
    private const string GroupEn = "Human resources";

    public static readonly PermissionDefinition[] All =
    [
        new(View, GroupAr, GroupEn, "عرض الموظفين والهيكل التنظيمي", "View the staff and the organisation"),
        new(Manage, GroupAr, GroupEn, "تعيين الموظفين وتعديل ملفاتهم", "Hire staff and change their files"),
        new(StructureManage, GroupAr, GroupEn, "إدارة الهيكل التنظيمي والمسميات والدرجات", "Manage the organisation, job titles and grades"),
        new(SalariesView, GroupAr, GroupEn, "عرض رواتب الموظفين", "View the staff's salaries"),
        new(SalariesManage, GroupAr, GroupEn, "تعديل رواتب الموظفين", "Change the staff's salaries"),
        new(BankManage, GroupAr, GroupEn, "عرض البيانات البنكية للموظفين وتعديلها", "View and change the staff's bank details"),
        new(BulkUpdate, GroupAr, GroupEn, "تحديث بيانات الموظفين بملف Excel", "Update the staff's data from an Excel file"),
        new(ActionsReview, GroupAr, GroupEn, "مراجعة الإجراءات الوظيفية (الموارد البشرية)", "Review employment actions (HR)"),
        new(ActionsApprove, GroupAr, GroupEn, "اعتماد الإجراءات الوظيفية (الإدارة العليا)", "Approve employment actions (management)"),
        .. ActionAmendments(),
    ];
}
