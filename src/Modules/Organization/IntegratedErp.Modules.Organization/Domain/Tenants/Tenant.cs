using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Organization.Domain.Tenants;

/// <summary>
/// A separate company using the system (docs/02-target-architecture/14 §1.2.1). Its data, users and
/// settings are isolated from every other tenant. Not tenant-owned itself — it is the tenant.
/// </summary>
public sealed class Tenant
{
    public const int CodeMaxLength = 50;
    public const int NameMaxLength = 200;

    private Tenant()
    {
        Code = string.Empty;
        NameAr = string.Empty;
        NameEn = string.Empty;
    }

    private Tenant(string code, string nameAr, string nameEn)
    {
        Id = Guid.CreateVersion7();
        Code = code;
        NameAr = nameAr;
        NameEn = nameEn;
        IsActive = true;
    }

    public Guid Id { get; private set; }

    /// <summary>Short stable key, e.g. <c>carepro</c>; also usable as a sub-domain later.</summary>
    public string Code { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    public bool IsActive { get; private set; }

    public static Result<Tenant> Create(string code, string nameAr, string nameEn)
    {
        var normalizedCode = (code ?? string.Empty).Trim().ToLowerInvariant();
        if (normalizedCode.Length is 0 or > CodeMaxLength || !normalizedCode.All(c => char.IsAsciiLetterOrDigit(c) || c == '-'))
        {
            return Result.Failure<Tenant>(Error.Validation("tenant_code_invalid", "Tenant code must be 1-50 latin letters, digits or '-'."));
        }

        if (string.IsNullOrWhiteSpace(nameAr) || string.IsNullOrWhiteSpace(nameEn))
        {
            return Result.Failure<Tenant>(Error.Validation("tenant_name_required", "Arabic and English names are required."));
        }

        return Result.Success(new Tenant(normalizedCode, nameAr.Trim(), nameEn.Trim()));
    }
}
