using IntegratedErp.BuildingBlocks.Security;

namespace IntegratedErp.Modules.Workflow;

internal static class WorkflowPermissions
{
    public const string ProcessesView = "workflow.processes.view";
    public const string ProcessesManage = "workflow.processes.manage";
    public const string InstancesView = "workflow.instances.view";
    public const string RequestsCreate = "workflow.requests.create";
    public const string RequestsViewAll = "workflow.requests.view";

    private const string GroupAr = "الاعتمادات";
    private const string GroupEn = "Approvals";

    public static readonly PermissionDefinition[] All =
    [
        new(ProcessesView, GroupAr, GroupEn, "عرض عمليات الاعتماد", "View approval processes"),
        new(ProcessesManage, GroupAr, GroupEn, "تصميم عمليات الاعتماد ونشرها", "Design and publish approval processes"),
        new(InstancesView, GroupAr, GroupEn, "متابعة جميع الاعتمادات", "Monitor all approvals"),
        new(RequestsCreate, GroupAr, GroupEn, "إنشاء الطلبات الداخلية", "Create internal requests"),
        new(RequestsViewAll, GroupAr, GroupEn, "عرض جميع الطلبات الداخلية", "View all internal requests"),
    ];
}
