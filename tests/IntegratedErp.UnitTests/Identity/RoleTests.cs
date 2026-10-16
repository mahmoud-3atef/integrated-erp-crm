using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Identity.Application;
using IntegratedErp.Modules.Identity.Domain;

namespace IntegratedErp.UnitTests.Identity;

public sealed class RoleTests
{
    private static readonly PermissionCatalog Catalog = new(
    [
        new("finance.invoices.view", "م", "F", "عرض", "View"),
        new("finance.invoices.manage", "م", "F", "إدارة", "Manage"),
        new("hr.staff.view", "م", "H", "عرض", "View"),
    ]);

    private static readonly Guid Tenant = Guid.NewGuid();

    [Fact]
    public void Built_in_roles_follow_the_catalog()
    {
        Assert.Equal(3, Role.BuiltIn(Tenant, RoleKind.Administrator).Effective(Catalog).Count());
        Assert.Equal(["finance.invoices.view", "hr.staff.view"], Role.BuiltIn(Tenant, RoleKind.ReadOnly).Effective(Catalog).Order());
    }

    [Fact]
    public void Built_in_roles_cannot_be_edited()
    {
        var admin = Role.BuiltIn(Tenant, RoleKind.Administrator);
        Assert.Equal("validation.role_built_in", admin.SetPermissions([], Catalog).Error.Code);
        Assert.Equal("validation.role_built_in", admin.Rename("x", "y").Error.Code);
    }

    [Fact]
    public void Custom_role_accepts_only_known_permissions_and_a_safe_code()
    {
        Assert.Equal("validation.permission_unknown", Role.Create("acc", "محاسب", "Accountant", ["finance.everything"], Catalog).Error.Code);
        Assert.Equal("validation.role_code_invalid", Role.Create("a b", "محاسب", "Accountant", [], Catalog).Error.Code);
        Assert.Equal("validation.role_name_invalid", Role.Create("acc", "", "Accountant", [], Catalog).Error.Code);

        var role = Role.Create(" Acc-05 ", "محاسب 05", "Accountant 05", ["finance.invoices.view", "finance.invoices.view"], Catalog).Value;
        Assert.Equal("acc-05", role.Code);
        Assert.Single(role.Permissions);
    }

    [Fact]
    public void Inactive_role_grants_nothing()
    {
        var role = Role.Create("acc", "محاسب", "Accountant", ["finance.invoices.view"], Catalog).Value;
        role.Deactivate();
        Assert.Empty(role.Effective(Catalog));
    }

    [Fact]
    public void Grants_combine_and_all_registrations_wins_over_one()
    {
        var cp05 = Guid.NewGuid();
        var cp07 = Guid.NewGuid();
        var accountant = Role.Create("acc", "محاسب", "Accountant", ["finance.invoices.manage"], Catalog).Value;
        var viewer = Role.BuiltIn(Tenant, RoleKind.ReadOnly);
        var roles = new Dictionary<Guid, Role> { [accountant.Id] = accountant, [viewer.Id] = viewer };
        var membership = Guid.NewGuid();

        var permissions = PermissionService.Combine(
            [new RoleAssignment(membership, accountant.Id, cp05), new RoleAssignment(membership, viewer.Id, null)],
            roles,
            Catalog);

        // Accountant of Care-Pro 05 only.
        Assert.True(permissions.Has("finance.invoices.manage", cp05));
        Assert.False(permissions.Has("finance.invoices.manage", cp07));
        Assert.Equal([cp05], permissions.LegalEntitiesFor("finance.invoices.manage")!);

        // Read-only for every registration.
        Assert.True(permissions.Has("finance.invoices.view", cp07));
        Assert.Null(permissions.LegalEntitiesFor("finance.invoices.view"));

        Assert.False(permissions.Has("hr.staff.manage"));
        Assert.Empty(permissions.LegalEntitiesFor("hr.staff.manage")!);
    }

    [Fact]
    public void No_assignments_means_no_permissions()
    {
        Assert.Empty(PermissionService.Combine([], new Dictionary<Guid, Role>(), Catalog).Codes);
    }
}
