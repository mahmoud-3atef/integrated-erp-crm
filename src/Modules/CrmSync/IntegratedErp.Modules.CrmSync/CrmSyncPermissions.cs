using IntegratedErp.BuildingBlocks.Security;

namespace IntegratedErp.Modules.CrmSync;

internal static class CrmSyncPermissions
{
    public const string View = "crm_sync.view";
    public const string Run = "crm_sync.run";

    private const string GroupAr = "المزامنة من النظام القديم";
    private const string GroupEn = "Sync from the old system";

    public static readonly PermissionDefinition[] All =
    [
        new(View, GroupAr, GroupEn, "عرض حالة المزامنة ومطابقة القوائم", "View sync status and list mappings"),
        new(Run, GroupAr, GroupEn, "تشغيل المزامنة واستيراد القوائم المرجعية", "Run the sync and import reference lists"),
    ];
}
