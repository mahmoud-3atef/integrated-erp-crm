using IntegratedErp.Modules.Leave.Domain;
using IntegratedErp.Modules.Leave.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Leave.Application;

public sealed record LeaveTypeInput(
    string NameAr,
    string? NameEn,
    string Pay,
    bool HasBalance,
    decimal? DaysPerYear,
    decimal? SeniorDaysPerYear,
    int? SeniorAfterYears,
    decimal? MaxDaysPerRequest,
    bool OncePerService,
    string DayCount,
    bool NeedsAttachment,
    bool IsActive,
    int SortOrder);

public sealed record LeaveTypeDto(
    Guid Id,
    string Code,
    string NameAr,
    string NameEn,
    string Pay,
    bool HasBalance,
    decimal? DaysPerYear,
    decimal? SeniorDaysPerYear,
    int? SeniorAfterYears,
    decimal? MaxDaysPerRequest,
    bool OncePerService,
    string DayCount,
    bool NeedsAttachment,
    bool IsActive,
    int SortOrder);

public sealed record LeaveSettingsInput(int? CarryOverLimit, int PermissionMinutesPerMonth);

public sealed record LeaveSettingsDto(int? CarryOverLimit, int PermissionMinutesPerMonth);

public sealed record LeaveSetupDto(LeaveSettingsDto Settings, IReadOnlyList<LeaveTypeDto> Types);

/// <summary>The leave settings and types; the first time, the types with the Saudi labour law's defaults (calendar days).</summary>
internal sealed class LeaveSetup(LeaveDbContext db)
{
    public const string Annual = "annual";
    public const string Sick = "sick";

    public async Task<LeaveSetting> SettingAsync(CancellationToken cancellationToken)
    {
        var setting = await db.Settings.FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (setting is not null)
        {
            return setting;
        }

        setting = LeaveSetting.Default();
        db.Settings.Add(setting);
        if (!await db.Types.AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            var n = 0;
            void Add(string code, string ar, string en, LeavePay pay, bool balance, decimal? perYear, decimal? senior, int? after, decimal? max, bool once, bool attachment) =>
                db.Types.Add(LeaveType.Create(code, new LeaveTypeValues(ar, en, pay, balance, perYear, senior, after, max, once, DayCount.Calendar, attachment, true, ++n)).Value);
            Add(Annual, "سنوية", "Annual", LeavePay.Full, true, 21, 30, 5, null, false, false);
            Add(Sick, "مرضية", "Sick", LeavePay.SickTiers, false, 120, null, null, null, false, true);
            Add("marriage", "زواج", "Marriage", LeavePay.Full, false, null, null, null, 5, true, true);
            Add("bereavement", "وفاة", "Bereavement", LeavePay.Full, false, null, null, null, 5, false, false);
            Add("newborn", "مولود", "Newborn", LeavePay.Full, false, null, null, null, 3, false, true);
            Add("maternity", "أمومة", "Maternity", LeavePay.Full, false, null, null, null, 70, false, true);
            Add("hajj", "حج", "Hajj", LeavePay.Full, false, null, null, null, 15, true, true);
            Add("exam", "امتحانات", "Exams", LeavePay.Full, false, null, null, null, null, false, true);
            Add("unpaid", "بدون راتب", "Unpaid", LeavePay.Unpaid, false, null, null, null, null, false, false);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return setting;
    }

    public async Task<LeaveSetupDto> SetupAsync(CancellationToken cancellationToken)
    {
        var setting = await SettingAsync(cancellationToken).ConfigureAwait(false);
        var types = await db.Types.AsNoTracking().OrderBy(t => t.SortOrder).ThenBy(t => t.NameAr).ToListAsync(cancellationToken).ConfigureAwait(false);
        return new LeaveSetupDto(new LeaveSettingsDto(setting.CarryOverLimit, setting.PermissionMinutesPerMonth), types.Select(Dto).ToList());
    }

    public static LeaveTypeDto Dto(LeaveType t) => new(
        t.Id, t.Code, t.NameAr, t.NameEn, t.Pay.ToString(), t.HasBalance, t.DaysPerYear, t.SeniorDaysPerYear, t.SeniorAfterYears, t.MaxDaysPerRequest, t.OncePerService,
        t.DayCount.ToString(), t.NeedsAttachment, t.IsActive, t.SortOrder);

    public async Task<Result> SaveSettingsAsync(LeaveSettingsInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var setting = await SettingAsync(cancellationToken).ConfigureAwait(false);
        var set = setting.Set(input.CarryOverLimit, input.PermissionMinutesPerMonth);
        if (set.IsSuccess)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return set;
    }

    public async Task<Result<Guid>> SaveTypeAsync(Guid? id, LeaveTypeInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        await SettingAsync(cancellationToken).ConfigureAwait(false);
        var values = new LeaveTypeValues(
            input.NameAr, input.NameEn, Enum.TryParse<LeavePay>(input.Pay, out var pay) ? pay : LeavePay.Full, input.HasBalance, input.DaysPerYear, input.SeniorDaysPerYear,
            input.SeniorAfterYears, input.MaxDaysPerRequest, input.OncePerService, Enum.TryParse<DayCount>(input.DayCount, out var count) ? count : DayCount.Calendar,
            input.NeedsAttachment, input.IsActive, input.SortOrder);
        if (id is { } existing)
        {
            if (await db.Types.FirstOrDefaultAsync(t => t.Id == existing, cancellationToken).ConfigureAwait(false) is not { } type)
            {
                return Result.Failure<Guid>(LeaveErrors.TypeNotFound);
            }

            var set = type.Set(values);
            if (set.IsFailure)
            {
                return Result.Failure<Guid>(set.Error);
            }

            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Success(type.Id);
        }

        var created = LeaveType.Create($"custom-{Guid.NewGuid():N}"[..20], values);
        if (created.IsFailure)
        {
            return Result.Failure<Guid>(created.Error);
        }

        db.Types.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(created.Value.Id);
    }
}
