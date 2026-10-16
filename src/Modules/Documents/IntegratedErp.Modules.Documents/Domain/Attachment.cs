using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Documents.Domain;

/// <summary>
/// A file attached to a record of the current company (docs/02-target-architecture/14: "on any record, with a type,
/// an expiry date and a viewing permission"). The file lives in storage under <see cref="StorageKey"/>; removal is
/// soft (the file and its metadata stay for audit).
/// </summary>
public sealed class Attachment : ITenantOwned
{
    public const int FileNameMaxLength = 200;
    public const int NotesMaxLength = 500;

    private Attachment()
    {
        OwnerType = string.Empty;
        DocumentType = string.Empty;
        FileName = string.Empty;
        ContentType = string.Empty;
        Sha256 = string.Empty;
        StorageKey = string.Empty;
        UploadedBy = string.Empty;
    }

    public Attachment(
        Guid tenantId,
        string ownerType,
        Guid ownerId,
        string documentType,
        string fileName,
        string contentType,
        long size,
        string sha256,
        DateOnly? expiresOn,
        string? notes,
        string uploadedBy,
        DateTimeOffset uploadedAt)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        OwnerType = ownerType;
        OwnerId = ownerId;
        DocumentType = documentType;
        FileName = fileName;
        ContentType = contentType;
        Size = size;
        Sha256 = sha256;
        ExpiresOn = expiresOn;
        Notes = notes;
        UploadedBy = uploadedBy;
        UploadedAt = uploadedAt;
        StorageKey = $"{tenantId:N}/{uploadedAt:yyyy}/{uploadedAt:MM}/{Id:N}";
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>The kind of record, e.g. <c>organization.legal_entity</c>.</summary>
    public string OwnerType { get; private set; }

    public Guid OwnerId { get; private set; }

    /// <summary>Code from the <c>document_types</c> reference list.</summary>
    public string DocumentType { get; private set; }

    /// <summary>The original name, cleaned of paths and control characters (display only).</summary>
    public string FileName { get; private set; }

    public string ContentType { get; private set; }

    public long Size { get; private set; }

    public string Sha256 { get; private set; }

    public string StorageKey { get; private set; }

    public DateOnly? ExpiresOn { get; private set; }

    public string? Notes { get; private set; }

    public string UploadedBy { get; private set; }

    public DateTimeOffset UploadedAt { get; private set; }

    public bool IsDeleted { get; private set; }

    public string? DeletedBy { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public void Delete(string by, DateTimeOffset at)
    {
        IsDeleted = true;
        DeletedBy = by;
        DeletedAt = at;
    }
}

/// <summary>Accepted file kinds: checked by extension, declared type and the file's first bytes.</summary>
public static class FileRules
{
    private static readonly Dictionary<string, (string ContentType, byte[][] Signatures)> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = ("application/pdf", [[0x25, 0x50, 0x44, 0x46]]),
        [".png"] = ("image/png", [[0x89, 0x50, 0x4E, 0x47]]),
        [".jpg"] = ("image/jpeg", [[0xFF, 0xD8, 0xFF]]),
        [".jpeg"] = ("image/jpeg", [[0xFF, 0xD8, 0xFF]]),
        [".docx"] = ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", [[0x50, 0x4B, 0x03, 0x04]]),
        [".xlsx"] = ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", [[0x50, 0x4B, 0x03, 0x04]]),
    };

    public static IReadOnlyCollection<string> Extensions => Allowed.Keys;

    /// <summary>The content type to store and serve, or null when the file is not an accepted kind.</summary>
    public static string? ContentTypeOf(string fileName, ReadOnlySpan<byte> head)
    {
        if (!Allowed.TryGetValue(Path.GetExtension(fileName ?? string.Empty), out var rule))
        {
            return null;
        }

        foreach (var signature in rule.Signatures)
        {
            if (head.Length >= signature.Length && head[..signature.Length].SequenceEqual(signature))
            {
                return rule.ContentType;
            }
        }

        return null;
    }

    /// <summary>Keeps only the file name (no folders) without control or reserved characters.</summary>
    public static string CleanFileName(string? fileName)
    {
        var name = Path.GetFileName((fileName ?? string.Empty).Replace('\\', '/'));
        var cleaned = new string(name.Where(c => !char.IsControl(c) && c is not ('"' or '<' or '>' or '|' or ':' or '*' or '?' or '/')).ToArray()).Trim();
        if (cleaned.Length > Attachment.FileNameMaxLength)
        {
            var extension = Path.GetExtension(cleaned);
            cleaned = cleaned[..(Attachment.FileNameMaxLength - extension.Length)] + extension;
        }

        return cleaned.Length == 0 ? "file" : cleaned;
    }
}
