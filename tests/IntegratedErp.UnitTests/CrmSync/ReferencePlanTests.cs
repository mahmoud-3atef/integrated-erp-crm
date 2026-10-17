using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;

namespace IntegratedErp.UnitTests.CrmSync;

public sealed class ReferencePlanTests
{
    private static CrmLookup Record(string? name, string? code = null, string? english = null, int usage = 0, string? nationality = null, string? previous = null, bool active = true) =>
        new(Guid.NewGuid(), name, code, english, nationality, active, new DateTime(2016, 11, 16, 0, 0, 0, DateTimeKind.Utc), usage, previous);

    [Theory]
    [InlineData("مدير إدارة تطوير الأعمال", "مدير ادارة  تطوير الاعمال")]
    [InlineData("سائق شاحنة", "سائق شاحنه")]
    [InlineData("فني حاسب آلي", " فني حاسب الي ")]
    [InlineData("منظف أواني", "منظف اوآني")]
    [InlineData("عامل تعبئة  و تغليف", "عامل تعبئة وتغليف")]
    [InlineData("بوروندى", "بوروندي")]
    [InlineData("DRIVER", "Driver")]
    public void Spellings_of_one_name_have_one_key(string a, string b) => Assert.Equal(ArabicText.Key(a), ArabicText.Key(b));

    [Fact]
    public void Different_names_keep_different_keys() => Assert.NotEqual(ArabicText.Key("عامل نظافة عامة"), ArabicText.Key("عامل تنظيف مباني عامة"));

    [Fact]
    public void Copies_and_spellings_of_a_profession_become_one_item()
    {
        var used = Record("عامل", "6132115", "labour", usage: 1143);
        var copy = Record("عامل", "6132115");
        var spelling = Record("عامل الة حاسبة", english: "Calculator operator", usage: 2);
        var spelling2 = Record("عامل اله حاسبة");
        var englishOnly = Record("labour", "worker");
        var plan = ProfessionPlanner.Plan([used, copy, spelling, spelling2, englishOnly]);

        Assert.Equal(2, plan.Items.Count);
        var labour = plan.Items[0];
        Assert.Equal(("6132115", "عامل", "labour", 1), (labour.Code, labour.NameAr, labour.NameEn, labour.SortOrder));
        Assert.All(plan.Mappings.Where(m => m.CrmId == used.Id || m.CrmId == copy.Id || m.CrmId == englishOnly.Id), m => Assert.Equal("6132115", m.ItemCode));
        Assert.Equal(MatchRule.Name, plan.Mappings.Single(m => m.CrmId == used.Id).Rule);
        Assert.Equal(MatchRule.Duplicate, plan.Mappings.Single(m => m.CrmId == copy.Id).Rule);
        Assert.Equal(MatchRule.EnglishName, plan.Mappings.Single(m => m.CrmId == englishOnly.Id).Rule);
        Assert.Equal(MatchRule.Spelling, plan.Mappings.Single(m => m.CrmId == spelling2.Id).Rule);
        Assert.StartsWith("CRM-", plan.Items[1].Code, StringComparison.Ordinal);
    }

    [Fact]
    public void A_code_used_by_two_professions_goes_to_the_more_used_one()
    {
        var a = Record("ضابط امن", "0012", "Security officer", usage: 5);
        var b = Record("فني تبريد وتكيف", "0012", "AC technician");
        var plan = ProfessionPlanner.Plan([b, a]);

        Assert.Equal("0012", plan.Items.Single(i => i.NameAr == "ضابط امن").Code);
        Assert.NotEqual("0012", plan.Items.Single(i => i.NameAr == "فني تبريد وتكيف").Code);
        Assert.Equal(plan.Items.Count, plan.Items.Select(i => i.Code).Distinct().Count());
    }

    [Fact]
    public void Importing_again_keeps_earlier_codes()
    {
        var record = Record("كهربائي عام", "9214124", "General electrician", previous: "OLD-CODE");
        Assert.Equal("OLD-CODE", ProfessionPlanner.Plan([record]).Items.Single().Code);
    }

    [Fact]
    public void Arabic_codes_are_replaced_and_missing_english_is_flagged()
    {
        var plan = ProfessionPlanner.Plan([Record("منسق توظيف", "منسق توظيف")]);
        var item = plan.Items.Single();
        Assert.Matches("^CRM-[0-9A-F]{8}$", item.Code);
        Assert.Equal("منسق توظيف", item.NameEn);
        Assert.True(item.NeedsReview);
    }

    [Fact]
    public void Countries_typed_several_ways_become_one_iso_item()
    {
        var philippines = Record("الفلبين", "173", "Philippines", usage: 666);
        var eritrea1 = Record("ارتيريا", "1", "Eritrea", usage: 1);
        var eritrea2 = Record("إريتريا", "67", "Eritrean");
        var india = Record("الهند", "166", "Indian", usage: 478);
        var pakistan = Record("باكستان", "166", "Pakistan", usage: 300);
        var sriLanka = Record("Srilanka", "Srilanka", "Srilanka", usage: 12);
        var saudi = Record("KSA", nationality: "SAUDI");
        var kenya2 = Record("كينيا 2", "25", "Kenya", active: false);
        var plan = NationalityPlanner.Plan([philippines, eritrea1, eritrea2, india, pakistan, sriLanka, saudi, kenya2]);

        string? CodeOf(CrmLookup r) => plan.Mappings.Single(m => m.CrmId == r.Id).ItemCode;
        Assert.Equal("PHL", CodeOf(philippines));
        Assert.Equal("ERI", CodeOf(eritrea1));
        Assert.Equal("ERI", CodeOf(eritrea2));
        Assert.Equal("IND", CodeOf(india));
        Assert.Equal("PAK", CodeOf(pakistan));
        Assert.Equal("LKA", CodeOf(sriLanka));
        Assert.Equal("SAU", CodeOf(saudi));
        Assert.Equal("KEN", CodeOf(kenya2));
        Assert.Equal(plan.Items.Count, plan.Items.Select(i => i.Code).Distinct().Count());
        var phl = plan.Items.Single(i => i.Code == "PHL");
        Assert.Equal(("الفلبين", "Philippines", 1), (phl.NameAr, phl.NameEn, phl.SortOrder));
    }

    [Fact]
    public void Values_that_are_not_countries_are_left_unmapped()
    {
        var plan = NationalityPlanner.Plan([Record("Block", usage: 393), Record("عام "), Record("جميع الدول", "All", "All Countries"), Record("-", english: "-"), Record("النبيال -الهند-الفلبين-بنجالديش ")]);
        Assert.Empty(plan.Items);
        Assert.All(plan.Mappings, m => Assert.Equal(MatchRule.Unmapped, m.Rule));
    }

    [Fact]
    public void Arabic_and_english_names_of_different_countries_are_a_conflict()
    {
        var record = Record("الولايات المتحدة", english: "United Kingdom");
        var mapping = NationalityPlanner.Plan([record]).Mappings.Single();
        Assert.Equal(("USA", MatchRule.Conflict), (mapping.ItemCode, mapping.Rule));
    }

    [Fact]
    public void A_mapping_chosen_by_a_person_is_kept()
    {
        var worker = Record("worker", "worker", previous: "6132115") with { ChosenByPerson = true };
        var block = Record("Block", previous: "EGY") with { ChosenByPerson = true };
        var professions = ProfessionPlanner.Plan([worker, Record("عامل", "6132115", "labour")]);
        Assert.Equal(("6132115", MatchRule.Manual), professions.Mappings.Where(m => m.CrmId == worker.Id).Select(m => (m.ItemCode, m.Rule)).Single());
        Assert.DoesNotContain(professions.Items, i => i.Code == "WORKER");

        var nationalities = NationalityPlanner.Plan([block]);
        Assert.Equal(("EGY", MatchRule.Manual), (nationalities.Mappings.Single().ItemCode, nationalities.Mappings.Single().Rule));
    }

    [Fact]
    public void Every_country_has_a_unique_code_and_names()
    {
        Assert.Equal(Countries.All.Count, Countries.All.Select(c => c.Code).Distinct().Count());
        Assert.All(Countries.All, c => Assert.Matches("^[A-Z]{3}$", c.Code));
        Assert.All(Countries.All, c => Assert.True(ArabicText.HasArabic(c.NameAr) && !ArabicText.HasArabic(c.NameEn), c.Code));
        Assert.Equal(Countries.All.Count * 2, Countries.All.SelectMany(c => new[] { ArabicText.Key(c.NameAr), ArabicText.Key(c.NameEn) }).Distinct().Count());
    }

    [Theory]
    [InlineData("SELECT TOP (10) * FROM [dbo].[new_country]")]
    [InlineData("  select a from b where c > @d order by a")]
    public void Plain_selects_may_be_sent_to_the_crm(string sql) => SqlCrmSource.EnsureReadOnly(sql);

    [Theory]
    [InlineData("UPDATE new_country SET new_name = 'x'")]
    [InlineData("SELECT * FROM a; DELETE FROM a")]
    [InlineData("SELECT * INTO copy FROM a")]
    [InlineData("SELECT 1 EXEC sp_who")]
    [InlineData("WITH x AS (SELECT 1 a) DELETE FROM x")]
    public void Anything_else_is_refused(string sql) => Assert.Throws<InvalidOperationException>(() => SqlCrmSource.EnsureReadOnly(sql));
}
