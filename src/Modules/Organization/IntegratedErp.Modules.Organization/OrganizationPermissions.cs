using IntegratedErp.BuildingBlocks.Security;

namespace IntegratedErp.Modules.Organization;

internal static class OrganizationPermissions
{
    public const string LegalEntitiesView = "organization.legal_entities.view";
    public const string LegalEntitiesManage = "organization.legal_entities.manage";
    public const string SettingsView = "organization.settings.view";
    public const string SettingsManage = "organization.settings.manage";

    private const string GroupAr = "بيانات الشركة";
    private const string GroupEn = "Company setup";

    public static readonly PermissionDefinition[] All =
    [
        new(LegalEntitiesView, GroupAr, GroupEn, "عرض السجلات التجارية", "View commercial registrations"),
        new(LegalEntitiesManage, GroupAr, GroupEn, "إدارة السجلات التجارية", "Manage commercial registrations"),
        new(SettingsView, GroupAr, GroupEn, "عرض الإعدادات", "View settings"),
        new(SettingsManage, GroupAr, GroupEn, "تعديل الإعدادات", "Change settings"),
    ];
}
