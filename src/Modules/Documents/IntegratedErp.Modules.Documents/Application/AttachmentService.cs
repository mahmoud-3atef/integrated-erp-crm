using System.Security.Cryptography;
using IntegratedErp.BuildingBlocks.Attachments;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Storage;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Documents.Domain;
using IntegratedErp.Modules.Documents.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Documents.Application;

public sealed class DocumentsOptions
{
    public const string Section = "Documents";

    public int MaxFileSizeMb { get; set; } = 20;

    public int EmailPollSeconds { get; set; } = 20;

    /// <summary>Public address of the system, for links in emails (e.g. <c>https://erp.jrco.local</c>); optional.</summary>
    public string? BaseUrl { get; set; }
}

public sealed record AttachmentDto(
    Guid Id,
    string DocumentType,
    string FileName,
    string ContentType,
    long Size,
    DateOnly? ExpiresOn,
    string? Notes,
    string UploadedBy,
    DateTimeOffset UploadedAt);

public sealed record UploadInput(string OwnerType, Guid OwnerId, string DocumentType, string FileName, long Length, Stream Content, DateOnly? ExpiresOn, string? Notes);

public sealed record AttachmentFile(Stream Content, string FileName, string ContentType);

/// <summary>
/// Files on records of the current company. Access follows the owning record: its view permission to see files,
/// its manage permission to add or remove them. The owning module confirms the record exists in this company.
/// </summary>
internal sealed class AttachmentService(
    DocumentsDbContext db,
    IFileStorage storage,
    IPermissionService permissions,
    AttachmentOwnerCatalog owners,
    IEnumerable<IAttachmentOwnerCheck> checks,
    IReferenceData referenceData,
    ITenantContext tenant,
    ICurrentUser user,
    IClock clock,
    IOptions<DocumentsOptions> options)
{
    public const string DocumentTypesList = "document_types";

    public static readonly Error Forbidden = new("forbidden.attachment", "You do not have permission for these files.");
    public static readonly Error OwnerNotFound = Error.NotFound("attachment_owner", "The record was not found.");
    public static readonly Error NotFound = Error.NotFound("attachment", "File not found.");
    public static readonly Error UnknownDocumentType = Error.Validation("document_type_unknown", "Unknown document type.");
    public static readonly Error FileEmpty = Error.Validation("file_empty", "The file is empty.");
    public static readonly Error FileTooLarge = Error.Validation("file_too_large", "The file is too large.");
    public static readonly Error FileTypeNotAllowed = Error.Validation("file_type_not_allowed", "This kind of file is not accepted.");
    public static readonly Error NotesTooLong = Error.Validation("notes_too_long", "Notes are limited to 500 characters.");

    public async Task<Result<IReadOnlyList<AttachmentDto>>> ListAsync(string ownerType, Guid ownerId, CancellationToken cancellationToken)
    {
        var access = await AuthorizeAsync(ownerType, manage: false, cancellationToken).ConfigureAwait(false);
        if (access.IsFailure)
        {
            return Result.Failure<IReadOnlyList<AttachmentDto>>(access.Error);
        }

        var rows = await db.Attachments.AsNoTracking()
            .Where(a => a.OwnerType == ownerType && a.OwnerId == ownerId && !a.IsDeleted)
            .OrderByDescending(a => a.UploadedAt)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success<IReadOnlyList<AttachmentDto>>(rows.Select(ToDto).ToList());
    }

    public async Task<Result<AttachmentDto>> UploadAsync(UploadInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var access = await AuthorizeAsync(input.OwnerType, manage: true, cancellationToken).ConfigureAwait(false);
        if (access.IsFailure)
        {
            return Result.Failure<AttachmentDto>(access.Error);
        }

        if (!await OwnerExistsAsync(input.OwnerType, input.OwnerId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<AttachmentDto>(OwnerNotFound);
        }

        var documentType = (input.DocumentType ?? string.Empty).Trim().ToUpperInvariant();
        if (!await referenceData.IsValidAsync(DocumentTypesList, documentType, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<AttachmentDto>(UnknownDocumentType);
        }

        var notes = string.IsNullOrWhiteSpace(input.Notes) ? null : input.Notes.Trim();
        if (notes?.Length > Attachment.NotesMaxLength)
        {
            return Result.Failure<AttachmentDto>(NotesTooLong);
        }

        var maxBytes = options.Value.MaxFileSizeMb * 1024L * 1024L;
        if (input.Length <= 0)
        {
            return Result.Failure<AttachmentDto>(FileEmpty);
        }

        if (input.Length > maxBytes)
        {
            return Result.Failure<AttachmentDto>(FileTooLarge);
        }

        // Read into memory (bounded by the size limit) to check the real file type and hash it before storing.
        using var buffer = new MemoryStream();
        await CopyBoundedAsync(input.Content, buffer, maxBytes, cancellationToken).ConfigureAwait(false);
        if (buffer.Length == 0)
        {
            return Result.Failure<AttachmentDto>(FileEmpty);
        }

        if (buffer.Length > maxBytes)
        {
            return Result.Failure<AttachmentDto>(FileTooLarge);
        }

        var fileName = FileRules.CleanFileName(input.FileName);
        var head = buffer.GetBuffer().AsSpan(0, (int)Math.Min(16, buffer.Length));
        if (FileRules.ContentTypeOf(fileName, head) is not { } contentType)
        {
            return Result.Failure<AttachmentDto>(FileTypeNotAllowed);
        }

        var tenantId = tenant.TenantId ?? throw new InvalidOperationException("A company must be selected.");
        var attachment = new Attachment(
            tenantId,
            input.OwnerType,
            input.OwnerId,
            documentType,
            fileName,
            contentType,
            buffer.Length,
            Convert.ToHexStringLower(SHA256.HashData(buffer.GetBuffer().AsSpan(0, (int)buffer.Length))),
            input.ExpiresOn,
            notes,
            user.DisplayName,
            clock.UtcNow);

        buffer.Position = 0;
        await storage.PutAsync(attachment.StorageKey, buffer, cancellationToken).ConfigureAwait(false);
        db.Attachments.Add(attachment);
        try
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            // No metadata row, so the stored file would be unreachable: remove it.
            await storage.DeleteAsync(attachment.StorageKey, CancellationToken.None).ConfigureAwait(false);
            throw;
        }

        return Result.Success(ToDto(attachment));
    }

    public async Task<Result<AttachmentFile>> OpenAsync(Guid id, CancellationToken cancellationToken)
    {
        var attachment = await db.Attachments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted, cancellationToken).ConfigureAwait(false);
        if (attachment is null)
        {
            return Result.Failure<AttachmentFile>(NotFound);
        }

        var access = await AuthorizeAsync(attachment.OwnerType, manage: false, cancellationToken).ConfigureAwait(false);
        if (access.IsFailure)
        {
            return Result.Failure<AttachmentFile>(access.Error);
        }

        var stream = await storage.OpenReadAsync(attachment.StorageKey, cancellationToken).ConfigureAwait(false);
        return stream is null
            ? Result.Failure<AttachmentFile>(NotFound)
            : Result.Success(new AttachmentFile(stream, attachment.FileName, attachment.ContentType));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var attachment = await db.Attachments.FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted, cancellationToken).ConfigureAwait(false);
        if (attachment is null)
        {
            return Result.Failure(NotFound);
        }

        var access = await AuthorizeAsync(attachment.OwnerType, manage: true, cancellationToken).ConfigureAwait(false);
        if (access.IsFailure)
        {
            return access;
        }

        attachment.Delete(user.DisplayName, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    private async Task<Result> AuthorizeAsync(string ownerType, bool manage, CancellationToken cancellationToken)
    {
        if (owners.Find(ownerType) is not { } owner)
        {
            return Result.Failure(OwnerNotFound);
        }

        var mine = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        var allowed = manage
            ? owner.ManageCompanyWide ? mine.LegalEntitiesFor(owner.ManagePermission) is null : mine.Has(owner.ManagePermission)
            : mine.Has(owner.ViewPermission);
        return allowed ? Result.Success() : Result.Failure(Forbidden);
    }

    private async Task<bool> OwnerExistsAsync(string ownerType, Guid ownerId, CancellationToken cancellationToken)
    {
        foreach (var check in checks.Where(c => c.OwnerTypes.Contains(ownerType)))
        {
            return await check.ExistsAsync(ownerType, ownerId, cancellationToken).ConfigureAwait(false);
        }

        return false;
    }

    private static async Task CopyBoundedAsync(Stream source, Stream target, long maxBytes, CancellationToken cancellationToken)
    {
        var chunk = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(chunk, cancellationToken).ConfigureAwait(false)) > 0)
        {
            await target.WriteAsync(chunk.AsMemory(0, read), cancellationToken).ConfigureAwait(false);
            if (target.Length > maxBytes)
            {
                return;
            }
        }
    }

    private static AttachmentDto ToDto(Attachment a) =>
        new(a.Id, a.DocumentType, a.FileName, a.ContentType, a.Size, a.ExpiresOn, a.Notes, a.UploadedBy, a.UploadedAt);
}
