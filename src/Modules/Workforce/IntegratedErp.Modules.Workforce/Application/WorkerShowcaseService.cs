using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Storage;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Workforce.Application;

public sealed record WorkerProfileDto(
    string? Specialty,
    string? SuggestedSpecialty,
    IReadOnlyList<string> Skills,
    IReadOnlyList<string> Languages,
    string? Gender,
    DateOnly? BirthDate,
    string? Religion,
    string? Education,
    int? PriorExperienceYears,
    string? BioAr,
    string? BioEn,
    IReadOnlyList<Guid> Photos,
    string? UpdatedBy,
    DateTimeOffset? UpdatedAt);

public sealed record WorkerProfileInput(
    string? Specialty,
    IReadOnlyList<string>? Skills,
    IReadOnlyList<string>? Languages,
    string? Gender,
    DateOnly? BirthDate,
    string? Religion,
    string? Education,
    int? PriorExperienceYears,
    string? BioAr,
    string? BioEn);

public sealed record ProfileListsDto(IReadOnlyList<ReferenceItemInfo> Specialties, IReadOnlyList<ReferenceItemInfo> Skills, IReadOnlyList<ReferenceItemInfo> Languages);

public sealed record WorkerPhotoFile(Stream Content, string ContentType);

/// <summary>
/// A worker's marketing profile and photos (docs/03-migration-plan/15): written here by marketing or the housing
/// officer, shown on the worker's file and in the showroom.
/// </summary>
internal sealed class WorkerShowcaseService(
    WorkforceDbContext db,
    WorkforceDashboard dashboard,
    IFileStorage storage,
    IReferenceData referenceData,
    ITenantContext tenant,
    ICurrentUser user,
    IOptions<WorkforceOptions> options,
    IClock clock) : IWorkerShowcase
{
    public const int MaxPhotos = 8;
    public const long MaxPhotoBytes = 6 * 1024 * 1024;

    public static readonly string[] Genders = ["M", "F"];
    public static readonly string[] Religions = ["MUSLIM", "CHRISTIAN", "HINDU", "BUDDHIST", "OTHER"];
    public static readonly string[] Educations = ["NONE", "PRIMARY", "SECONDARY", "DIPLOMA", "BACHELOR"];

    public static readonly Error WorkerNotFound = Error.NotFound("worker", "Worker not found.");
    public static readonly Error PhotoNotFound = Error.NotFound("worker_photo", "Photo not found.");
    public static readonly Error UnknownCode = Error.Validation("profile_code_unknown", "A chosen item is not in its list.");
    public static readonly Error BadValue = Error.Validation("profile_value", "A value is not accepted.");
    public static readonly Error BadBirthDate = Error.Validation("profile_birth_date", "The birth date must make the worker 16 to 75 years old.");
    public static readonly Error BioTooLong = Error.Validation("profile_bio_too_long", "The introduction is limited to 600 characters.");
    public static readonly Error TooManyPhotos = Error.Validation("photos_too_many", "A worker has at most 8 photos.");
    public static readonly Error PhotoTooLarge = Error.Validation("photo_too_large", "A photo is limited to 6 MB.");
    public static readonly Error NotAnImage = Error.Validation("photo_not_image", "Only JPEG, PNG or WebP photos are accepted.");

    public async Task<ProfileListsDto> ListsAsync(CancellationToken cancellationToken) => new(
        await referenceData.ListAsync(WorkforceReferenceLists.Specialties, cancellationToken).ConfigureAwait(false),
        await referenceData.ListAsync(WorkforceReferenceLists.Skills, cancellationToken).ConfigureAwait(false),
        await referenceData.ListAsync(WorkforceReferenceLists.Languages, cancellationToken).ConfigureAwait(false));

    public async Task<WorkerProfileDto?> GetAsync(Guid workerId, CancellationToken cancellationToken)
    {
        if (!await IsWorkerAsync(workerId, cancellationToken).ConfigureAwait(false))
        {
            return null;
        }

        var info = (await ForAsync([workerId], cancellationToken).ConfigureAwait(false)).Single();
        var p = await db.WorkerProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.WorkerId == workerId, cancellationToken).ConfigureAwait(false);
        return new WorkerProfileDto(info.Specialty, info.SuggestedSpecialty, info.Skills, info.Languages, info.Gender, info.BirthDate, info.Religion, info.Education,
            info.PriorExperienceYears, info.BioAr, info.BioEn, info.Photos, p?.UpdatedBy, p?.UpdatedAt);
    }

    public async Task<Result> UpdateAsync(Guid workerId, WorkerProfileInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!await IsWorkerAsync(workerId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(WorkerNotFound);
        }

        static string? Code(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim().ToUpperInvariant();
        static string? Text(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
        var specialty = Code(input.Specialty);
        var skills = (input.Skills ?? []).Select(Code).OfType<string>().Distinct(StringComparer.Ordinal).ToList();
        var languages = (input.Languages ?? []).Select(Code).OfType<string>().Distinct(StringComparer.Ordinal).ToList();
        if ((specialty is not null && !await referenceData.IsValidAsync(WorkforceReferenceLists.Specialties, specialty, cancellationToken).ConfigureAwait(false))
            || !await AllValidAsync(WorkforceReferenceLists.Skills, skills, cancellationToken).ConfigureAwait(false)
            || !await AllValidAsync(WorkforceReferenceLists.Languages, languages, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(UnknownCode);
        }

        var gender = Code(input.Gender);
        var religion = Code(input.Religion);
        var education = Code(input.Education);
        if ((gender is not null && !Genders.Contains(gender)) || (religion is not null && !Religions.Contains(religion)) || (education is not null && !Educations.Contains(education))
            || input.PriorExperienceYears is < 0 or > 40 || string.Join(',', skills).Length > WorkerProfile.CodesMaxLength || string.Join(',', languages).Length > WorkerProfile.CodesMaxLength)
        {
            return Result.Failure(BadValue);
        }

        var today = clock.Today;
        if (input.BirthDate is { } born && (born > today.AddYears(-16) || born < today.AddYears(-75)))
        {
            return Result.Failure(BadBirthDate);
        }

        var bioAr = Text(input.BioAr);
        var bioEn = Text(input.BioEn);
        if (bioAr?.Length > WorkerProfile.BioMaxLength || bioEn?.Length > WorkerProfile.BioMaxLength)
        {
            return Result.Failure(BioTooLong);
        }

        var profile = await db.WorkerProfiles.FirstOrDefaultAsync(x => x.WorkerId == workerId, cancellationToken).ConfigureAwait(false);
        if (profile is null)
        {
            profile = new WorkerProfile(TenantId(), workerId);
            db.WorkerProfiles.Add(profile);
        }

        profile.Update(new WorkerProfileValues(specialty, skills, languages, gender, input.BirthDate, religion, education, input.PriorExperienceYears, bioAr, bioEn), user.DisplayName, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result<Guid>> AddPhotoAsync(Guid workerId, Stream content, long length, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(content);
        if (!await IsWorkerAsync(workerId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(WorkerNotFound);
        }

        var count = await db.WorkerPhotos.CountAsync(p => p.WorkerId == workerId && !p.IsDeleted, cancellationToken).ConfigureAwait(false);
        if (count >= MaxPhotos)
        {
            return Result.Failure<Guid>(TooManyPhotos);
        }

        if (length > MaxPhotoBytes)
        {
            return Result.Failure<Guid>(PhotoTooLarge);
        }

        // Read (bounded) to check the real type before storing.
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await content.ReadAsync(chunk, cancellationToken).ConfigureAwait(false)) > 0)
        {
            await buffer.WriteAsync(chunk.AsMemory(0, read), cancellationToken).ConfigureAwait(false);
            if (buffer.Length > MaxPhotoBytes)
            {
                return Result.Failure<Guid>(PhotoTooLarge);
            }
        }

        if (WorkerPhoto.ImageType(buffer.GetBuffer().AsSpan(0, (int)Math.Min(16, buffer.Length))) is not { } type)
        {
            return Result.Failure<Guid>(NotAnImage);
        }

        var last = await db.WorkerPhotos.Where(p => p.WorkerId == workerId && !p.IsDeleted).MaxAsync(p => (int?)p.SortOrder, cancellationToken).ConfigureAwait(false);
        var photo = new WorkerPhoto(TenantId(), workerId, type, buffer.Length, (last ?? -1) + 1, user.DisplayName, clock.UtcNow);
        buffer.Position = 0;
        await storage.PutAsync(photo.StorageKey, buffer, cancellationToken).ConfigureAwait(false);
        db.WorkerPhotos.Add(photo);
        try
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            await storage.DeleteAsync(photo.StorageKey, CancellationToken.None).ConfigureAwait(false);
            throw;
        }

        return Result.Success(photo.Id);
    }

    public async Task<WorkerPhotoFile?> PhotoAsync(Guid workerId, Guid photoId, CancellationToken cancellationToken)
    {
        var photo = await db.WorkerPhotos.AsNoTracking().FirstOrDefaultAsync(p => p.Id == photoId && p.WorkerId == workerId && !p.IsDeleted, cancellationToken).ConfigureAwait(false);
        return photo is not null && await storage.OpenReadAsync(photo.StorageKey, cancellationToken).ConfigureAwait(false) is { } stream ? new WorkerPhotoFile(stream, photo.ContentType) : null;
    }

    public async Task<Result> DeletePhotoAsync(Guid workerId, Guid photoId, CancellationToken cancellationToken)
    {
        var photo = await db.WorkerPhotos.FirstOrDefaultAsync(p => p.Id == photoId && p.WorkerId == workerId && !p.IsDeleted, cancellationToken).ConfigureAwait(false);
        if (photo is null)
        {
            return Result.Failure(PhotoNotFound);
        }

        photo.Delete();
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>Makes a photo the main one (first); the others keep their order after it.</summary>
    public async Task<Result> MakeMainAsync(Guid workerId, Guid photoId, CancellationToken cancellationToken)
    {
        var photos = await db.WorkerPhotos.Where(p => p.WorkerId == workerId && !p.IsDeleted).OrderBy(p => p.SortOrder).ToListAsync(cancellationToken).ConfigureAwait(false);
        var main = photos.FirstOrDefault(p => p.Id == photoId);
        if (main is null)
        {
            return Result.Failure(PhotoNotFound);
        }

        var order = 1;
        main.MoveTo(0);
        foreach (var p in photos.Where(p => p.Id != photoId))
        {
            p.MoveTo(order++);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<IReadOnlyList<WorkerShowcaseInfo>> ForAsync(IReadOnlyCollection<Guid> workerIds, CancellationToken cancellationToken)
    {
        var ids = workerIds.Distinct().ToList();
        var profiles = await db.WorkerProfiles.AsNoTracking().Where(p => ids.Contains(p.WorkerId)).ToDictionaryAsync(p => p.WorkerId, cancellationToken).ConfigureAwait(false);
        var photos = (await db.WorkerPhotos.AsNoTracking().Where(p => ids.Contains(p.WorkerId) && !p.IsDeleted)
                .Select(p => new { p.WorkerId, p.Id, p.SortOrder }).ToListAsync(cancellationToken).ConfigureAwait(false))
            .ToLookup(p => p.WorkerId);
        var timelines = await dashboard.TimelinesAsync(ids.ToHashSet(), cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        return ids.Select(id =>
            {
                var stints = timelines[id].Where(s => s.Kind == PeriodKind.Work && !options.Value.IsInactiveProject(s.Place)).OrderByDescending(s => s.StartsOn)
                    .Select(s => new WorkerStint(s.Place, s.ProjectCrmId, s.StartsOn, s.EndsOn)).ToList();
                var days = stints.Sum(s => Math.Max(0, Math.Min((s.EndsOn ?? today.AddDays(1)).DayNumber, today.AddDays(1).DayNumber) - s.StartsOn.DayNumber));
                var p = profiles.GetValueOrDefault(id);
                return new WorkerShowcaseInfo(
                    id, p?.Specialty, p?.Specialty is null ? Suggest(stints.FirstOrDefault()?.Place) : null,
                    p is null ? [] : WorkerProfile.Split(p.Skills), p is null ? [] : WorkerProfile.Split(p.Languages),
                    p?.Gender, p?.BirthDate, p?.Religion, p?.Education, p?.PriorExperienceYears, p?.BioAr, p?.BioEn,
                    photos[id].OrderBy(x => x.SortOrder).Select(x => x.Id).ToList(), days, stints);
            })
            .ToList();
    }

    /// <summary>A specialty read from a work place's name, as the old system named its project lines («... - Waiter»).</summary>
    internal static string? Suggest(string? place)
    {
        if (string.IsNullOrWhiteSpace(place))
        {
            return null;
        }

        var p = place.ToUpperInvariant();
        return p.Contains("WAITER", StringComparison.Ordinal) || p.Contains("BANQUET", StringComparison.Ordinal) || p.Replace(" ", string.Empty, StringComparison.Ordinal).Contains("-SERVICE", StringComparison.Ordinal) || place.Contains("نادل", StringComparison.Ordinal) ? WorkforceReferenceLists.Waiter
            : p.Contains("HK", StringComparison.Ordinal) || p.Contains("HOUSEKEEP", StringComparison.Ordinal) || place.Contains("تدبير", StringComparison.Ordinal) ? WorkforceReferenceLists.Housekeeping
            : p.Contains("KITCHEN", StringComparison.Ordinal) || p.Contains("STEWARD", StringComparison.Ordinal) ? WorkforceReferenceLists.KitchenHelper
            : p.Contains("CLEAN", StringComparison.Ordinal) || place.Contains("نظافة", StringComparison.Ordinal) ? WorkforceReferenceLists.Cleaner
            : place.Contains("ضيافة", StringComparison.Ordinal) ? WorkforceReferenceLists.Hospitality
            : null;
    }

    private async Task<bool> AllValidAsync(string list, List<string> codes, CancellationToken cancellationToken)
    {
        foreach (var code in codes)
        {
            if (!await referenceData.IsValidAsync(list, code, cancellationToken).ConfigureAwait(false))
            {
                return false;
            }
        }

        return true;
    }

    private Task<bool> IsWorkerAsync(Guid workerId, CancellationToken cancellationToken) =>
        db.Workers.AnyAsync(w => w.Id == workerId && w.Kind == WorkerKind.Worker, cancellationToken);

    private Guid TenantId() => tenant.TenantId ?? throw new InvalidOperationException("A company must be selected.");
}
