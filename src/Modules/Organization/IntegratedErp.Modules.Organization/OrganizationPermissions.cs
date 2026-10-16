using IntegratedErp.BuildingBlocks.Security;

namespace IntegratedErp.Modules.Organization;

internal static class OrganizationPermissions
{
    public const string LegalEntitiesView = "organization.legal_entities.view";
    public const string LegalEntitiesManage = "organization.legal_entities.manage";
    public const string BranchesView = "organization.branches.view";
    public const string BranchesManage = "organization.branches.manage";
    public const string ReferenceView = "organization.reference_data.view";
    public const string ReferenceManage = "organization.reference_data.manage";
    public const string ModulesView = "organization.modules.view";
    public const string SettingsView = "organization.settings.view";
    public const string SettingsManage = "organization.settings.manage";

    private const string GroupAr = "بيانات الشركة";
    private const string GroupEn = "Company setup";

    public static readonly PermissionDefinition[] All =
    [
        new(LegalEntitiesView, GroupAr, GroupEn, "عرض السجلات التجارية", "View commercial registrations"),
        new(LegalEntitiesManage, GroupAr, GroupEn, "إدارة السجلات التجارية", "Manage commercial registrations"),
        new(BranchesView, GroupAr, GroupEn, "عرض الفروع", "View branches"),
        new(BranchesManage, GroupAr, GroupEn, "إدارة الفروع", "Manage branches"),
        new(ReferenceView, GroupAr, GroupEn, "عرض القوائم المرجعية", "View reference lists"),
        new(ReferenceManage, GroupAr, GroupEn, "إدارة القوائم المرجعية", "Manage reference lists"),
        new(ModulesView, GroupAr, GroupEn, "عرض وحدات النظام", "View system modules"),
        new(SettingsView, GroupAr, GroupEn, "عرض الإعدادات", "View settings"),
        new(SettingsManage, GroupAr, GroupEn, "تعديل الإعدادات", "Change settings"),
    ];
}
