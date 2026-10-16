using IntegratedErp.Modules.Organization.Domain.Settings;

namespace IntegratedErp.UnitTests.Organization;

public sealed class SettingTimelineTests
{
    private static readonly Guid Tenant = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid OtherTenant = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Customer = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid Project = Guid.Parse("44444444-4444-4444-4444-444444444444");

    private static DateOnly D(int year, int month, int day) => new(year, month, day);

    private static Setting NewVersion(List<Setting> versions, SettingScope scope, string value, DateOnly from)
    {
        var result = SettingTimeline.SetValue(versions, "billing.day_basis", scope, value, from);
        Assert.True(result.IsSuccess);
        if (!versions.Contains(result.Value))
        {
            versions.Add(result.Value);
        }

        return result.Value;
    }

    [Fact]
    public void First_value_is_open_ended()
    {
        var versions = new List<Setting>();

        var created = NewVersion(versions, SettingScope.ForTenant(Tenant), "\"THIRTY\"", D(2026, 1, 1));

        Assert.Null(created.EffectiveTo);
        Assert.True(created.IsEffectiveOn(D(2030, 12, 31)));
        Assert.False(created.IsEffectiveOn(D(2025, 12, 31)));
    }

    [Fact]
    public void New_value_closes_the_previous_version_on_its_start_date()
    {
        var versions = new List<Setting>();
        var first = NewVersion(versions, SettingScope.ForTenant(Tenant), "\"THIRTY\"", D(2026, 1, 1));

        var second = NewVersion(versions, SettingScope.ForTenant(Tenant), "\"ACTUAL_DAYS\"", D(2026, 7, 1));

        // End date is exclusive: the old value applies up to 30 June, the new one from 1 July.
        Assert.Equal(D(2026, 7, 1), first.EffectiveTo);
        Assert.True(first.IsEffectiveOn(D(2026, 6, 30)));
        Assert.False(first.IsEffectiveOn(D(2026, 7, 1)));
        Assert.True(second.IsEffectiveOn(D(2026, 7, 1)));
    }

    [Fact]
    public void Same_start_date_replaces_the_value()
    {
        var versions = new List<Setting>();
        var first = NewVersion(versions, SettingScope.ForTenant(Tenant), "\"THIRTY\"", D(2026, 1, 1));

        var again = NewVersion(versions, SettingScope.ForTenant(Tenant), "\"ACTUAL_DAYS\"", D(2026, 1, 1));

        Assert.Same(first, again);
        Assert.Single(versions);
        Assert.Equal("\"ACTUAL_DAYS\"", first.Value);
    }

    [Fact]
    public void Inserting_before_a_later_version_is_rejected()
    {
        var versions = new List<Setting>();
        NewVersion(versions, SettingScope.ForTenant(Tenant), "\"THIRTY\"", D(2026, 7, 1));

        var result = SettingTimeline.SetValue(versions, "billing.day_basis", SettingScope.ForTenant(Tenant), "\"ACTUAL_DAYS\"", D(2026, 1, 1));

        Assert.True(result.IsFailure);
        Assert.Equal(SettingTimeline.FutureVersionExists, result.Error);
    }

    [Fact]
    public void Most_specific_scope_wins()
    {
        var versions = new List<Setting>();
        NewVersion(versions, SettingScope.System, "\"THIRTY\"", D(2020, 1, 1));
        var tenantVersions = new List<Setting>();
        NewVersion(tenantVersions, SettingScope.ForTenant(Tenant), "\"THIRTY\"", D(2026, 1, 1));
        var customerVersions = new List<Setting>();
        NewVersion(customerVersions, SettingScope.For(SettingScopeType.Customer, Tenant, Customer), "\"ACTUAL_DAYS\"", D(2026, 1, 1));
        var all = versions.Concat(tenantVersions).Concat(customerVersions).ToList();

        var forCustomerProject = SettingTimeline.Resolve(all, new SettingContext(Tenant, CustomerId: Customer, ProjectId: Project), D(2026, 10, 1));
        var forTenantOnly = SettingTimeline.Resolve(all, new SettingContext(Tenant), D(2026, 10, 1));
        var forOtherTenant = SettingTimeline.Resolve(all, new SettingContext(OtherTenant), D(2026, 10, 1));

        // Customer-level setting (e.g. a customer billed on actual month days) overrides the tenant default.
        Assert.Equal("\"ACTUAL_DAYS\"", forCustomerProject!.Value);
        Assert.Equal(SettingScopeType.Tenant, forTenantOnly!.ScopeType);
        // Another tenant never sees this tenant's values; it falls back to System.
        Assert.Equal(SettingScopeType.System, forOtherTenant!.ScopeType);
    }

    [Fact]
    public void Resolution_respects_the_date()
    {
        var versions = new List<Setting>();
        NewVersion(versions, SettingScope.ForTenant(Tenant), "1000", D(2026, 1, 1));
        NewVersion(versions, SettingScope.ForTenant(Tenant), "1200", D(2026, 9, 1));
        var context = new SettingContext(Tenant);

        Assert.Equal("1000", SettingTimeline.Resolve(versions, context, D(2026, 8, 31))!.Value);
        Assert.Equal("1200", SettingTimeline.Resolve(versions, context, D(2026, 9, 1))!.Value);
        Assert.Null(SettingTimeline.Resolve(versions, context, D(2025, 12, 31)));
    }

    [Fact]
    public void Scoped_setting_requires_ids()
    {
        Assert.Throws<ArgumentException>(() => SettingScope.For(SettingScopeType.Project, Tenant, Guid.Empty));
        Assert.Throws<ArgumentException>(() => SettingScope.For(SettingScopeType.Tenant, Tenant, Project));
    }

    [Fact]
    public void Keys_are_case_insensitive()
    {
        Assert.Equal("billing.day_basis", Setting.NormalizeKey("  Billing.Day_Basis "));
    }
}
