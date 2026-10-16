using IntegratedErp.Modules.Identity.Infrastructure.Ldap;

namespace IntegratedErp.UnitTests.Identity;

public sealed class LdapInputTests
{
    [Theory]
    [InlineData(@"JRCO\mahmoud", "mahmoud")]
    [InlineData("mahmoud@jrco.local", "mahmoud")]
    [InlineData("  mahmoud ", "mahmoud")]
    [InlineData(@"JRCO.LOCAL\m.atef", "m.atef")]
    public void User_name_forms_map_to_the_account_name(string input, string expected) =>
        Assert.Equal(expected, LdapDirectory.NormalizeUserName(input));

    [Theory]
    [InlineData("*", @"\2a")]
    [InlineData("admin)(|(objectClass=*)", @"admin\29\28|\28objectClass=\2a\29")]
    [InlineData(@"a\b", @"a\5cb")]
    public void Filter_values_are_escaped_against_ldap_injection(string input, string expected) =>
        Assert.Equal(expected, LdapDirectory.EscapeFilter(input));
}
