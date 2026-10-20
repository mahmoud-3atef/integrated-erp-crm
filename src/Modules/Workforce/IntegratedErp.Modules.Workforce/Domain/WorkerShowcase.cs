using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workforce.Domain;

/// <summary>
/// What sales show a customer about a worker (docs/03-migration-plan/15): the specialty, skills and languages, and a
/// few personal facts the old system never kept. Written here by marketing or the housing officer, one per worker.
/// </summary>
public sealed class WorkerProfile : ITenantOwned
{
    public const int CodesMaxLength = 400;
    public const int BioMaxLength = 600;

    private WorkerProfile()
    {
        Skills = string.Empty;
        Languages = string.Empty;
        UpdatedBy = string.Empty;
    }

    public WorkerProfile(Guid tenantId, Guid workerId)
        : this()
    {
        TenantId = tenantId;
        WorkerId = workerId;
    }

    public Guid WorkerId { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>Code from the <c>worker_specialties</c> list (waiter, housekeeping...).</summary>
    public string? Specialty { get; private set; }

    /// <summary>Codes from the <c>worker_skills</c> list, comma separated.</summary>
    public string Skills { get; private set; }

    /// <summary>Codes from the <c>languages</c> list, comma separated (the first is the mother tongue).</summary>
    public string Languages { get; private set; }

    /// <summary><c>M</c> or <c>F</c>.</summary>
    public string? Gender { get; private set; }

    public DateOnly? BirthDate { get; private set; }

    /// <summary><c>MUSLIM</c>, <c>CHRISTIAN</c>, <c>HINDU</c>, <c>BUDDHIST</c> or <c>OTHER</c>.</summary>
    public string? Religion { get; private set; }

    /// <summary><c>NONE</c>, <c>PRIMARY</c>, <c>SECONDARY</c>, <c>DIPLOMA</c> or <c>BACHELOR</c>.</summary>
    public string? Education { get; private set; }

    /// <summary>Years of experience before joining the company.</summary>
    public int? PriorExperienceYears { get; private set; }

    public string? BioAr { get; private set; }

    public string? BioEn { get; private set; }

    public string UpdatedBy { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(WorkerProfileValues v, string by, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(v);
        Specialty = v.Specialty;
        Skills = string.Join(',', v.Skills);
        Languages = string.Join(',', v.Languages);
        Gender = v.Gender;
        BirthDate = v.BirthDate;
        Religion = v.Religion;
        Education = v.Education;
        PriorExperienceYears = v.PriorExperienceYears;
        BioAr = v.BioAr;
        BioEn = v.BioEn;
        UpdatedBy = by;
        UpdatedAt = at;
    }

    public static IReadOnlyList<string> Split(string codes) => codes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

public sealed record WorkerProfileValues(
    string? Specialty,
    IReadOnlyList<string> Skills,
    IReadOnlyList<string> Languages,
    string? Gender,
    DateOnly? BirthDate,
    string? Religion,
    string? Education,
    int? PriorExperienceYears,
    string? BioAr,
    string? BioEn);

/// <summary>A worker's photo for the showroom; the first in order is the main one. Removal is soft (kept for audit).</summary>
public sealed class WorkerPhoto : ITenantOwned
{
    private WorkerPhoto()
    {
        ContentType = string.Empty;
        StorageKey = string.Empty;
        UploadedBy = string.Empty;
    }

    public WorkerPhoto(Guid tenantId, Guid workerId, string contentType, long size, int sortOrder, string uploadedBy, DateTimeOffset uploadedAt)
        : this()
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        WorkerId = workerId;
        ContentType = contentType;
        Size = size;
        SortOrder = sortOrder;
        UploadedBy = uploadedBy;
        UploadedAt = uploadedAt;
        StorageKey = $"{tenantId:N}/worker-photos/{workerId:N}/{Id:N}";
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid WorkerId { get; private set; }

    public string ContentType { get; private set; }

    public long Size { get; private set; }

    public string StorageKey { get; private set; }

    public int SortOrder { get; private set; }

    public string UploadedBy { get; private set; }

    public DateTimeOffset UploadedAt { get; private set; }

    public bool IsDeleted { get; private set; }

    public void MoveTo(int sortOrder) => SortOrder = sortOrder;

    public void Delete() => IsDeleted = true;

    /// <summary>The image type from the file's first bytes (JPEG, PNG or WebP); null for anything else.</summary>
    public static string? ImageType(ReadOnlySpan<byte> head) =>
        head.Length >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF ? "image/jpeg"
        : head.Length >= 4 && head[0] == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47 ? "image/png"
        : head.Length >= 12 && head[0] == (byte)'R' && head[1] == (byte)'I' && head[2] == (byte)'F' && head[3] == (byte)'F' && head[8] == (byte)'W' && head[9] == (byte)'E' && head[10] == (byte)'B' && head[11] == (byte)'P' ? "image/webp"
        : null;
}
