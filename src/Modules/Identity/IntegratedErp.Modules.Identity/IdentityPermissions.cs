using IntegratedErp.BuildingBlocks.Security;

namespace IntegratedErp.Modules.Identity;

internal static class IdentityPermissions
{
    public const string UsersView = "identity.users.view";
    public const string UsersManage = "identity.users.manage";
    public const string RolesView = "identity.roles.view";
    public const string RolesManage = "identity.roles.manage";

    private const string GroupAr = "المستخدمين والصلاحيات";
    private const string GroupEn = "Users and permissions";

    public static readonly PermissionDefinition[] All =
    [
        new(UsersView, GroupAr, GroupEn, "عرض المستخدمين", "View users"),
        new(UsersManage, GroupAr, GroupEn, "إضافة المستخدمين وتعديل أدوارهم", "Add users and change their roles"),
        new(RolesView, GroupAr, GroupEn, "عرض الأدوار", "View roles"),
        new(RolesManage, GroupAr, GroupEn, "إنشاء وتعديل الأدوار", "Create and change roles"),
    ];
}
