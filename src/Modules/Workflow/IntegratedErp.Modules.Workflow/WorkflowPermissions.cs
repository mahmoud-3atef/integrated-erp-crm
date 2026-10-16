using IntegratedErp.BuildingBlocks.Security;

namespace IntegratedErp.Modules.Workflow;

internal static class WorkflowPermissions
{
    public const string RoutesView = "workflow.routes.view";
    public const string RoutesManage = "workflow.routes.manage";
    public const string RequestsCreate = "workflow.requests.create";
    public const string RequestsViewAll = "workflow.requests.view";

    private const string GroupAr = "الاعتمادات";
    private const string GroupEn = "Approvals";

    public static readonly PermissionDefinition[] All =
    [
        new(RoutesView, GroupAr, GroupEn, "عرض مسارات الاعتماد", "View approval routes"),
        new(RoutesManage, GroupAr, GroupEn, "تعديل مسارات الاعتماد", "Change approval routes"),
        new(RequestsCreate, GroupAr, GroupEn, "إنشاء الطلبات الداخلية", "Create internal requests"),
        new(RequestsViewAll, GroupAr, GroupEn, "عرض جميع الطلبات الداخلية", "View all internal requests"),
    ];
}
