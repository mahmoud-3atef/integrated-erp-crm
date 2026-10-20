using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

public sealed record NamedCodeDto(string Code, string NameAr, string NameEn);

public sealed record ShowroomStintDto(string? Place, DateOnly StartsOn, DateOnly? EndsOn, int Days);

/// <param name="Name">The full name inside the company; the first name only in the presentation for a customer.</param>
/// <param name="SpecialtySuggested">The specialty is read from the last work place's name, not yet confirmed.</param>
/// <param name="HotelExperience">Has worked at a hotel, resort or hospitality project.</param>
/// <param name="Since">Internal: in housing since (null in the presentation).</param>
/// <param name="ReservedBy">Internal: the open delivery order that already has the worker.</param>
/// <param name="LastPlace">Internal: the last work place (customers' names never reach the presentation).</param>
public sealed record ShowroomWorkerDto(
    Guid Id,
    string WorkerNo,
    string Name,
    string? NationalityCode,
    string? NationalityAr,
    string? NationalityEn,
    NamedCodeDto? Specialty,
    bool SpecialtySuggested,
    IReadOnlyList<NamedCodeDto> Skills,
    IReadOnlyList<NamedCodeDto> Languages,
    string? Gender,
    int? Age,
    int? PriorExperienceYears,
    string? BioAr,
    string? BioEn,
    IReadOnlyList<Guid> Photos,
    int WorkDays,
    int Projects,
    bool HotelExperience,
    bool IsNew,
    DateOnly? Since,
    int? DaysAvailable,
    string? ReservedBy,
    string? LastPlace,
    string? LastReturnReason);

public sealed record ShowroomCountDto(string? Code, string NameAr, string NameEn, int Count);

/// <param name="Available">Not reserved by an open delivery order.</param>
public sealed record ShowroomDto(
    int Available,
    int Reserved,
    int Nationalities,
    int WithHotelExperience,
    int NewArrivals,
    int? OldestDays,
    IReadOnlyList<ShowroomCountDto> BySpecialty,
    IReadOnlyList<ShowroomCountDto> ByNationality,
    IReadOnlyList<ShowroomWorkerDto> Workers,
    bool Presentation);

public sealed record ShowroomWorkerFileDto(ShowroomWorkerDto Worker, IReadOnlyList<ShowroomStintDto> Stints, int LongestStintDays);

/// <summary>
/// The showroom (docs/03-migration-plan/15): the workers available in housing now, as sales show them to a customer.
/// In the presentation for a customer the server leaves out what is internal: full names, past customers, days in
/// housing, return reasons and the reserved workers.
/// </summary>
internal sealed class Showroom(DeliveryOrderService delivery, IWorkforceReport workforce, IWorkerShowcase showcase, IReferenceData referenceData, OperationsDbContext db, IClock clock)
{
    public const string NoSpecialty = "—";

    private static readonly string[] HotelWords = ["فندق", "منتجع", "ضيافة", "HOTEL", "RESORT", "HILTON", "MARRIOTT", "RIXOS", "REXOS", "HYATT", "ROTANA", "INTERCONTINENTAL", "SHERATON", "RITZ", "FOUR SEASONS", "NOVOTEL", "RADISSON", "CONRAD", "حياة", "هيلتون", "ماريوت", "ريكسوس", "روتانا"];

    public async Task<ShowroomDto> GetAsync(bool presentation, CancellationToken cancellationToken)
    {
        var rows = await RowsAsync(null, presentation, cancellationToken).ConfigureAwait(false);
        var shown = presentation ? rows.Where(r => r.Worker.ReservedBy is null).ToList() : rows;
        var specialties = shown.GroupBy(r => r.Worker.Specialty?.Code)
            .Select(g => g.Key is null
                ? new ShowroomCountDto(null, "دون تصنيف", "Not classified", g.Count())
                : new ShowroomCountDto(g.Key, g.First().Worker.Specialty!.NameAr, g.First().Worker.Specialty!.NameEn, g.Count()))
            .OrderBy(c => c.Code is null).ThenByDescending(c => c.Count).ToList();
        var nationalities = shown.GroupBy(r => r.Worker.NationalityCode)
            .Select(g => new ShowroomCountDto(g.Key, g.First().Worker.NationalityAr ?? "غير محددة", g.First().Worker.NationalityEn ?? "Not set", g.Count()))
            .OrderBy(c => c.Code is null).ThenByDescending(c => c.Count).ToList();
        var since = rows.Select(r => r.Worker.Since).OfType<DateOnly>().ToList();
        return new ShowroomDto(
            rows.Count(r => r.Worker.ReservedBy is null),
            presentation ? 0 : rows.Count(r => r.Worker.ReservedBy is not null),
            shown.Select(r => r.Worker.NationalityCode).Where(c => c is not null).Distinct().Count(),
            shown.Count(r => r.Worker.HotelExperience),
            shown.Count(r => r.Worker.IsNew),
            presentation || since.Count == 0 ? null : clock.Today.DayNumber - since.Min().DayNumber,
            specialties, nationalities,
            shown.OrderBy(r => r.Worker.ReservedBy is not null).ThenByDescending(r => r.Worker.Photos.Count > 0).ThenByDescending(r => r.Worker.WorkDays).Select(r => r.Worker).ToList(),
            presentation);
    }

    /// <summary>One available worker's file: the card, and where they worked (places left out of the presentation).</summary>
    public async Task<ShowroomWorkerFileDto?> FileAsync(Guid workerId, bool presentation, CancellationToken cancellationToken)
    {
        var row = (await RowsAsync(workerId, presentation, cancellationToken).ConfigureAwait(false)).FirstOrDefault();
        if (row is null || (presentation && row.Worker.ReservedBy is not null))
        {
            return null;
        }

        var today = clock.Today;
        var stints = row.Stints.Select(s => new ShowroomStintDto(presentation ? null : s.Place, s.StartsOn, s.EndsOn, Days(s, today))).ToList();
        return new ShowroomWorkerFileDto(row.Worker, stints, stints.Count == 0 ? 0 : stints.Max(s => s.Days));
    }

    private sealed record Row(ShowroomWorkerDto Worker, IReadOnlyList<WorkerStint> Stints);

    private async Task<List<Row>> RowsAsync(Guid? only, bool presentation, CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var available = (await delivery.AvailableAsync(null, cancellationToken).ConfigureAwait(false)).Where(a => only is null || a.Worker.Id == only).ToList();
        var ids = available.Select(a => a.Worker.Id).ToList();
        var housing = (await workforce.InHousingAsync(cancellationToken).ConfigureAwait(false)).ToDictionary(h => h.WorkerId);
        var infos = (await showcase.ForAsync(ids, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.WorkerId);
        var specialties = await NamesAsync("worker_specialties", cancellationToken).ConfigureAwait(false);
        var skills = await NamesAsync("worker_skills", cancellationToken).ConfigureAwait(false);
        var languages = await NamesAsync("languages", cancellationToken).ConfigureAwait(false);
        var reasons = presentation
            ? []
            : (await db.ReturnOrders.AsNoTracking().Where(o => o.WorkerId != null && ids.Contains(o.WorkerId.Value) && o.Status == ReturnStatus.Completed)
                    .Select(o => new { WorkerId = o.WorkerId!.Value, o.ArrivedOn, o.Reason }).ToListAsync(cancellationToken).ConfigureAwait(false))
                .GroupBy(o => o.WorkerId).ToDictionary(g => g.Key, g => g.OrderByDescending(o => o.ArrivedOn).First().Reason);

        return available.Select(a =>
            {
                var w = a.Worker;
                var info = infos.GetValueOrDefault(w.Id);
                var stints = info?.Stints ?? [];
                var code = info?.Specialty ?? info?.SuggestedSpecialty;
                var age = info?.BirthDate is { } born ? today.Year - born.Year - (today < born.AddYears(today.Year - born.Year) ? 1 : 0) : (int?)null;
                var stay = housing.GetValueOrDefault(w.Id);
                return new Row(
                    new ShowroomWorkerDto(
                        w.Id, w.WorkerNo, presentation ? FirstName(w.Name) : w.Name, w.NationalityCode, w.NationalityAr, w.NationalityEn,
                        code is not null ? specialties.GetValueOrDefault(code) ?? new NamedCodeDto(code, code, code) : null,
                        info?.Specialty is null && code is not null,
                        Named(info?.Skills, skills), Named(info?.Languages, languages),
                        info?.Gender, age, info?.PriorExperienceYears, info?.BioAr, info?.BioEn, info?.Photos ?? [],
                        info?.WorkDays ?? 0, stints.Select(s => s.Place ?? s.ProjectCrmId?.ToString()).Distinct().Count(),
                        stints.Any(s => IsHotel(s.Place)), stints.Count == 0,
                        presentation ? null : stay?.Since ?? w.ProjectJoinedOn,
                        presentation || stay is null ? null : today.DayNumber - stay.Since.DayNumber,
                        presentation ? null : a.BusyOrderNo,
                        presentation ? null : (stints.Count > 0 ? stints[0].Place : null),
                        presentation ? null : reasons.GetValueOrDefault(w.Id)),
                    stints);
            })
            .ToList();
    }

    internal static bool IsHotel(string? place)
    {
        if (string.IsNullOrWhiteSpace(place))
        {
            return false;
        }

        var p = place.ToUpperInvariant();
        return HotelWords.Any(word => p.Contains(word, StringComparison.Ordinal));
    }

    internal static string FirstName(string name) => name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? name;

    private static int Days(WorkerStint s, DateOnly today) => Math.Max(0, Math.Min((s.EndsOn ?? today.AddDays(1)).DayNumber, today.AddDays(1).DayNumber) - s.StartsOn.DayNumber);

    private static List<NamedCodeDto> Named(IReadOnlyList<string>? codes, Dictionary<string, NamedCodeDto> names) =>
        (codes ?? []).Select(c => names.GetValueOrDefault(c) ?? new NamedCodeDto(c, c, c)).ToList();

    private async Task<Dictionary<string, NamedCodeDto>> NamesAsync(string list, CancellationToken cancellationToken) =>
        (await referenceData.ListAllAsync(list, cancellationToken).ConfigureAwait(false))
            .GroupBy(i => i.Code, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => new NamedCodeDto(g.Key, g.First().NameAr, g.First().NameEn), StringComparer.OrdinalIgnoreCase);
}
