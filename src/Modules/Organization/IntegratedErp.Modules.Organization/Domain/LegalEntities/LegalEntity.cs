using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Organization.Domain.LegalEntities;

/// <summary>
/// A commercial registration of the tenant (e.g. Care-Pro 05 and Care-Pro 07): the employer of
/// company-sponsored workers, the seller on tax invoices, and the unit of separate financial statements.
/// </summary>
public sealed class LegalEntity : ITenantOwned
{
    public const int CodeMaxLength = 30;
    public const int NameMaxLength = 200;

    private LegalEntity()
    {
        Code = string.Empty;
        NameAr = string.Empty;
        NameEn = string.Empty;
        CommercialRegistrationNo = string.Empty;
    }

    private LegalEntity(string code, string nameAr, string nameEn, string crNumber, string? vatNumber)
    {
        Id = Guid.CreateVersion7();
        Code = code;
        NameAr = nameAr;
        NameEn = nameEn;
        CommercialRegistrationNo = crNumber;
        VatNumber = vatNumber;
        IsActive = true;
    }

    public Guid Id { get; private set; }

    /// <summary>Stamped by the persistence layer from the current tenant.</summary>
    public Guid TenantId { get; private set; }

    /// <summary>Short code, unique within the tenant, e.g. <c>CP05</c>.</summary>
    public string Code { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    /// <summary>Saudi commercial registration number (10 digits).</summary>
    public string CommercialRegistrationNo { get; private set; }

    /// <summary>Saudi VAT registration number (15 digits, starts and ends with 3); required before issuing tax invoices.</summary>
    public string? VatNumber { get; private set; }

    public bool IsActive { get; private set; }

    public static Result<LegalEntity> Create(string code, string nameAr, string nameEn, string crNumber, string? vatNumber)
    {
        var normalizedCode = (code ?? string.Empty).Trim().ToUpperInvariant();
        if (normalizedCode.Length is 0 or > CodeMaxLength)
        {
            return Result.Failure<LegalEntity>(Error.Validation("legal_entity_code_invalid", "Code must be 1-30 characters."));
        }

        var details = Check(nameAr, nameEn, crNumber, vatNumber);
        return details.IsFailure
            ? Result.Failure<LegalEntity>(details.Error)
            : Result.Success(new LegalEntity(normalizedCode, details.Value.NameAr, details.Value.NameEn, details.Value.Cr, details.Value.Vat));
    }

    /// <summary>Changes the names and registration numbers; the code never changes (other records refer to it).</summary>
    public Result Update(string nameAr, string nameEn, string crNumber, string? vatNumber)
    {
        var details = Check(nameAr, nameEn, crNumber, vatNumber);
        if (details.IsFailure)
        {
            return Result.Failure(details.Error);
        }

        (NameAr, NameEn, CommercialRegistrationNo, VatNumber) = details.Value;
        return Result.Success();
    }

    public void SetActive(bool active) => IsActive = active;

    private static Result<(string NameAr, string NameEn, string Cr, string? Vat)> Check(string nameAr, string nameEn, string crNumber, string? vatNumber)
    {
        nameAr = (nameAr ?? string.Empty).Trim();
        nameEn = (nameEn ?? string.Empty).Trim();
        if (nameAr.Length is 0 or > NameMaxLength || nameEn.Length is 0 or > NameMaxLength)
        {
            return Result.Failure<(string, string, string, string?)>(Error.Validation("legal_entity_name_required", "Arabic and English names are required."));
        }

        var cr = (crNumber ?? string.Empty).Trim();
        if (cr.Length != 10 || !cr.All(char.IsAsciiDigit))
        {
            return Result.Failure<(string, string, string, string?)>(Error.Validation("cr_number_invalid", "Commercial registration number must be 10 digits."));
        }

        var vat = string.IsNullOrWhiteSpace(vatNumber) ? null : vatNumber.Trim();
        if (vat is not null && !IsValidVatNumber(vat))
        {
            return Result.Failure<(string, string, string, string?)>(Error.Validation("vat_number_invalid", "VAT number must be 15 digits starting and ending with 3."));
        }

        return Result.Success((nameAr, nameEn, cr, vat));
    }

    public static bool IsValidVatNumber(string value) =>
        value.Length == 15 && value.All(char.IsAsciiDigit) && value[0] == '3' && value[^1] == '3';
}
