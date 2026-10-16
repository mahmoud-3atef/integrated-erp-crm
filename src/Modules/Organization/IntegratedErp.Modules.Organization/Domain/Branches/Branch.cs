using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Organization.Domain.Branches;

/// <summary>A branch or office of the company, optionally under one commercial registration.</summary>
public sealed class Branch : ITenantOwned
{
    public const int CodeMaxLength = 30;
    public const int NameMaxLength = 200;
    public const int CityMaxLength = 100;

    private Branch()
    {
        Code = string.Empty;
        NameAr = string.Empty;
        NameEn = string.Empty;
    }

    private Branch(string code)
    {
        Id = Guid.CreateVersion7();
        Code = code;
        NameAr = string.Empty;
        NameEn = string.Empty;
        IsActive = true;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>Unique within the company, upper-case, e.g. <c>RUH</c>. Never changes.</summary>
    public string Code { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    /// <summary>The commercial registration the branch belongs to; null when it serves all of them.</summary>
    public Guid? LegalEntityId { get; private set; }

    public string? City { get; private set; }

    public bool IsActive { get; private set; }

    public static Result<Branch> Create(string code, string nameAr, string nameEn, Guid? legalEntityId, string? city)
    {
        var normalized = (code ?? string.Empty).Trim().ToUpperInvariant();
        if (normalized.Length is 0 or > CodeMaxLength || !normalized.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_'))
        {
            return Result.Failure<Branch>(Error.Validation("branch_code_invalid", "Code: 1-30 letters, digits, '-' or '_'."));
        }

        var branch = new Branch(normalized);
        var updated = branch.Update(nameAr, nameEn, legalEntityId, city);
        return updated.IsFailure ? Result.Failure<Branch>(updated.Error) : Result.Success(branch);
    }

    public Result Update(string nameAr, string nameEn, Guid? legalEntityId, string? city)
    {
        nameAr = (nameAr ?? string.Empty).Trim();
        nameEn = (nameEn ?? string.Empty).Trim();
        if (nameAr.Length is 0 or > NameMaxLength || nameEn.Length is 0 or > NameMaxLength)
        {
            return Result.Failure(Error.Validation("branch_name_required", "Arabic and English names are required."));
        }

        city = string.IsNullOrWhiteSpace(city) ? null : city.Trim();
        if (city?.Length > CityMaxLength)
        {
            return Result.Failure(Error.Validation("branch_city_too_long", "City is limited to 100 characters."));
        }

        NameAr = nameAr;
        NameEn = nameEn;
        LegalEntityId = legalEntityId;
        City = city;
        return Result.Success();
    }

    public void SetActive(bool active) => IsActive = active;
}
