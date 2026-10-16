using IntegratedErp.Modules.Organization.Domain.Branches;
using IntegratedErp.Modules.Organization.Domain.LegalEntities;
using IntegratedErp.Modules.Organization.Domain.Reference;

namespace IntegratedErp.UnitTests.Organization;

public sealed class CompanySetupTests
{
    [Fact]
    public void Legal_entity_update_keeps_the_code_and_applies_the_same_rules()
    {
        var entity = LegalEntity.Create("cp05", "كير برو 05", "Care-Pro 05", "1010101010", null).Value;

        Assert.Equal("validation.cr_number_invalid", entity.Update("كير برو 05", "Care-Pro 05", "123", null).Error.Code);
        Assert.Equal("validation.vat_number_invalid", entity.Update("كير برو 05", "Care-Pro 05", "1010101010", "123").Error.Code);
        Assert.True(entity.Update(" شركة كير برو 05 ", "Care-Pro 05", "1010101011", "300000000000003").IsSuccess);

        Assert.Equal("CP05", entity.Code);
        Assert.Equal("شركة كير برو 05", entity.NameAr);
        Assert.Equal("300000000000003", entity.VatNumber);
    }

    [Fact]
    public void Branch_code_is_normalized_and_names_are_required()
    {
        Assert.Equal("validation.branch_code_invalid", Branch.Create("r u h", "الرياض", "Riyadh", null, null).Error.Code);
        Assert.Equal("validation.branch_name_required", Branch.Create("ruh", "", "Riyadh", null, null).Error.Code);

        var branch = Branch.Create(" ruh ", "فرع الرياض", "Riyadh branch", null, "  الرياض ").Value;
        Assert.Equal("RUH", branch.Code);
        Assert.Equal("الرياض", branch.City);
        Assert.True(branch.IsActive);
    }

    [Fact]
    public void System_reference_items_cannot_be_switched_off_but_can_be_renamed()
    {
        var item = ReferenceItem.System(Guid.NewGuid(), "return_reasons", "SICK", "مرض العامل", "Worker is sick", 3);

        Assert.Equal("validation.reference_item_system", item.SetActive(false).Error.Code);
        Assert.True(item.Update("مرض العامل أو إصابته", "Worker is sick or injured", 3).IsSuccess);
        Assert.Equal("SICK", item.Code);
    }

    [Fact]
    public void Custom_reference_items_use_upper_case_codes_and_can_be_switched_off()
    {
        Assert.Equal("validation.reference_code_invalid", ReferenceItem.Create("nationalities", "ph l", "الفلبين", "Philippines", 1).Error.Code);

        var item = ReferenceItem.Create("nationalities", "phl", "الفلبين", "Philippines", 1).Value;
        Assert.Equal("PHL", item.Code);
        Assert.True(item.SetActive(false).IsSuccess);
        Assert.False(item.IsActive);
    }
}
