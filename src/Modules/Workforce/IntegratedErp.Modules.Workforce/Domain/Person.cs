using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workforce.Domain;

/// <summary>
/// One person, whatever their role (worker now, staff later, or both over time). Names, nationality and
/// identity numbers live here once.
/// </summary>
public sealed class Person : ITenantOwned
{
    public const int NameMaxLength = 300;

    private readonly List<PersonIdentifier> _identifiers = [];

    private Person()
    {
        NameEn = string.Empty;
    }

    public Person(string nameEn, string? nameAr)
    {
        Id = Guid.CreateVersion7();
        NameEn = nameEn;
        NameAr = nameAr;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string NameEn { get; private set; }

    public string? NameAr { get; private set; }

    /// <summary>Item code of the nationalities list (ISO alpha-3), e.g. PHL.</summary>
    public string? NationalityCode { get; private set; }

    /// <summary>The CRM country it came from (to follow later changes of the nationality mapping).</summary>
    public Guid? NationalityCrmId { get; private set; }

    /// <summary>CRM marital status code (1 single, 2 married, ...), until the new system has its own list.</summary>
    public int? MaritalStatus { get; private set; }

    public IReadOnlyList<PersonIdentifier> Identifiers => _identifiers;

    public void Update(string nameEn, string? nameAr, Guid? nationalityCrmId, string? nationalityCode, int? maritalStatus)
    {
        NameEn = nameEn;
        NameAr = nameAr;
        NationalityCrmId = nationalityCrmId;
        NationalityCode = nationalityCode;
        MaritalStatus = maritalStatus;
    }

    /// <summary>The names and nationality changed here (the CRM link of the nationality is dropped: it was chosen here).</summary>
    public void Edit(string nameEn, string? nameAr, string? nationalityCode)
    {
        NameEn = nameEn;
        NameAr = nameAr;
        if (NationalityCode != nationalityCode)
        {
            NationalityCode = nationalityCode;
            NationalityCrmId = null;
        }
    }

    /// <summary>The nationality mapping changed (e.g. a CRM value was linked or merged by hand).</summary>
    public void Remap(string? nationalityCode) => NationalityCode = nationalityCode;

    /// <summary>
    /// Sets an identity number of a type (replacing the current one of that type). <paramref name="usable"/> false
    /// when another person already holds the number: it is kept for review but not as the current one.
    /// </summary>
    public void SetIdentifier(IdentifierType type, string? number, DateOnly? expiresOn, bool usable)
    {
        var current = _identifiers.FirstOrDefault(i => i.Type == type && i.IsCurrent);
        number = string.IsNullOrWhiteSpace(number) ? null : number.Trim().ToUpperInvariant();
        if (number is null)
        {
            current?.Retire();
            return;
        }

        if (current is not null && current.Number == number)
        {
            current.SetExpiry(expiresOn);
            if (!usable)
            {
                current.Retire();
            }

            return;
        }

        current?.Retire();
        var existing = _identifiers.FirstOrDefault(i => i.Type == type && i.Number == number);
        if (existing is not null)
        {
            existing.SetExpiry(expiresOn);
            if (usable)
            {
                existing.Restore();
            }

            return;
        }

        _identifiers.Add(new PersonIdentifier(Id, type, number, expiresOn, usable));
    }
}

/// <summary>Kinds of identity numbers a person may have.</summary>
public enum IdentifierType
{
    /// <summary>Residence permit (Iqama) or national ID.</summary>
    Iqama,
    Passport,
    BorderNumber,
    Visa,
    WorkPermit,
    Gosi,
}

/// <summary>
/// An identity number of a person. A current number of a type is unique in the company (a unique index), so a
/// passport or Iqama can never belong to two people; numbers kept for history are not current.
/// </summary>
public sealed class PersonIdentifier : ITenantOwned
{
    public const int NumberMaxLength = 50;

    private PersonIdentifier()
    {
        Number = string.Empty;
    }

    internal PersonIdentifier(Guid personId, IdentifierType type, string number, DateOnly? expiresOn, bool isCurrent)
    {
        Id = Guid.CreateVersion7();
        PersonId = personId;
        Type = type;
        Number = number.Length > NumberMaxLength ? number[..NumberMaxLength] : number;
        ExpiresOn = expiresOn;
        IsCurrent = isCurrent;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid PersonId { get; private set; }

    public IdentifierType Type { get; private set; }

    public string Number { get; private set; }

    public DateOnly? ExpiresOn { get; private set; }

    public bool IsCurrent { get; private set; }

    internal void SetExpiry(DateOnly? expiresOn) => ExpiresOn = expiresOn;

    internal void Retire() => IsCurrent = false;

    internal void Restore() => IsCurrent = true;
}
