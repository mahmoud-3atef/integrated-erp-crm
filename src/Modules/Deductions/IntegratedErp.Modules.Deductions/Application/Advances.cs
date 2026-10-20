using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Deductions.Domain;
using IntegratedErp.Modules.Deductions.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Deductions.Application;

public sealed record SettingsDto(
    decimal AdvanceCapPercent,
    int AdvanceMaxMonths,
    bool AdvanceAfterProbation,
    int AdvanceMinServiceMonths,
    bool AdvanceOneOpen,
    decimal PenaltyMaxDaysPerViolation,
    decimal PenaltyMaxDaysPerMonth,
    decimal SuspensionMaxDaysPerMonth,
    decimal MonthlyCapPercent);

public sealed record PenaltyTypeDto(Guid Id, string Code, string NameAr, string NameEn, string Effect, bool IsActive, int SortOrder);

public sealed record PenaltyTypeInput(string NameAr, string? NameEn, string Effect, bool IsActive, int SortOrder);

public sealed record SetupDto(SettingsDto Settings, IReadOnlyList<PenaltyTypeDto> PenaltyTypes);

/// <summary>The settings and the penalty types (the four of the labour law the first time; HR adds the company's).</summary>
internal sealed class DeductionSetup(DeductionsDbContext db)
{
    public async Task<DeductionSetting> SettingAsync(CancellationToken cancellationToken)
    {
        var setting = await db.Settings.FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (setting is not null)
        {
            return setting;
        }

        setting = DeductionSetting.Default();
        db.Settings.Add(setting);
        if (!await db.PenaltyTypes.AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            var n = 0;
            foreach (var (code, ar, en, effect) in new[]
            {
                ("warning", "إنذار كتابي", "Written warning", PenaltyEffect.Warning),
                ("deduct_days", "خصم أيام من الأجر", "Days of wage deducted", PenaltyEffect.DeductDays),
                ("deduct_amount", "خصم مبلغ", "An amount deducted", PenaltyEffect.DeductAmount),
                ("suspension", "إيقاف عن العمل بدون أجر", "Suspension without pay", PenaltyEffect.Suspension),
            })
            {
                db.PenaltyTypes.Add(PenaltyType.Create(code, ar, en, effect, ++n).Value);
            }
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return setting;
    }

    public static SettingsDto Dto(DeductionSetting s) => new(
        s.AdvanceCapPercent, s.AdvanceMaxMonths, s.AdvanceAfterProbation, s.AdvanceMinServiceMonths, s.AdvanceOneOpen,
        s.PenaltyMaxDaysPerViolation, s.PenaltyMaxDaysPerMonth, s.SuspensionMaxDaysPerMonth, s.MonthlyCapPercent);

    public async Task<SetupDto> SetupAsync(CancellationToken cancellationToken)
    {
        var setting = await SettingAsync(cancellationToken).ConfigureAwait(false);
        var types = await db.PenaltyTypes.AsNoTracking().OrderBy(t => t.SortOrder).ThenBy(t => t.NameAr)
            .Select(t => new PenaltyTypeDto(t.Id, t.Code, t.NameAr, t.NameEn, t.Effect.ToString(), t.IsActive, t.SortOrder)).ToListAsync(cancellationToken).ConfigureAwait(false);
        return new SetupDto(Dto(setting), types);
    }

    public async Task<Result> SaveSettingsAsync(SettingsDto input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var setting = await SettingAsync(cancellationToken).ConfigureAwait(false);
        var set = setting.Set(input.AdvanceCapPercent, input.AdvanceMaxMonths, input.AdvanceAfterProbation, input.AdvanceMinServiceMonths, input.AdvanceOneOpen,
            input.PenaltyMaxDaysPerViolation, input.PenaltyMaxDaysPerMonth, input.SuspensionMaxDaysPerMonth, input.MonthlyCapPercent);
        if (set.IsSuccess)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return set;
    }

    public async Task<Result<Guid>> SaveTypeAsync(Guid? id, PenaltyTypeInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        await SettingAsync(cancellationToken).ConfigureAwait(false);
        var effect = Enum.TryParse<PenaltyEffect>(input.Effect, out var e) ? e : PenaltyEffect.Warning;
        if (id is { } existing)
        {
            if (await db.PenaltyTypes.FirstOrDefaultAsync(t => t.Id == existing, cancellationToken).ConfigureAwait(false) is not { } type)
            {
                return Result.Failure<Guid>(DeductionErrors.TypeNotFound);
            }

            var set = type.Set(input.NameAr, input.NameEn, effect, input.IsActive, input.SortOrder);
            if (set.IsFailure)
            {
                return Result.Failure<Guid>(set.Error);
            }

            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Success(type.Id);
        }

        var created = PenaltyType.Create($"custom-{Guid.NewGuid():N}"[..20], input.NameAr, input.NameEn, effect, input.SortOrder);
        if (created.IsFailure)
        {
            return Result.Failure<Guid>(created.Error);
        }

        db.PenaltyTypes.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(created.Value.Id);
    }
}

public sealed record AdvanceInput(Guid EmployeeId, decimal Amount, int Months, string FirstPeriod, string Reason, bool AboveCap);

public sealed record AdvancePreview(
    decimal? Salary,
    decimal? Cap,
    decimal Installment,
    decimal MonthDeductions,
    decimal? MonthCap,
    decimal? MonthShare,
    int MaxMonths,
    string? ManagerName,
    bool ManagerLinked,
    IReadOnlyList<string> Problems,
    IReadOnlyList<string> NeedsAboveCap);

public sealed record DisburseInput(DateOnly PaidOn, string Method, string? Reference);

public sealed record NoteInput(string Note);

/// <summary>
/// Salary advances: the preview (the salary, the cap, the installment, the month's deductions against its cap, the
/// conditions), the request through approval, finance's payment, and the early settlement or a postponed installment.
/// </summary>
internal sealed class AdvanceService(
    DeductionsDbContext db,
    IStaffDirectory staff,
    DeductionSetup setup,
    NumberSequenceService numbering,
    IApprovalService approvals,
    ICurrentUser user,
    IPermissionService permissions,
    IClock clock)
{
    /// <summary>Who may see the staff's salaries (the salary, the caps in money and the month's share are shown only to them).</summary>
    internal const string SalariesView = "staff.salaries.view";

    public async Task<Result<AdvancePreview>> PreviewAsync(AdvanceInput input, Guid? advanceId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var setting = await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        var member = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(m => m.Id == input.EmployeeId);
        if (member is null)
        {
            return Result.Failure<AdvancePreview>(DeductionErrors.EmployeeNotFound);
        }

        var today = clock.Today;
        var problems = new List<string>();
        var aboveCap = new List<string>();
        if (input.Amount <= 0 || !Periods.Valid(input.FirstPeriod) || string.IsNullOrWhiteSpace(input.Reason) || input.Months < 1)
        {
            problems.Add("fields");
        }

        if (input.Months > setting.AdvanceMaxMonths)
        {
            problems.Add("too_many_months");
        }

        if (member.Status == "Left")
        {
            problems.Add("not_employed");
        }

        if (setting.AdvanceAfterProbation && member.Status == "Probation")
        {
            problems.Add("on_probation");
        }

        if (setting.AdvanceMinServiceMonths > 0 && (member.HireDate is not { } hired || hired.AddMonths(setting.AdvanceMinServiceMonths) > today))
        {
            problems.Add("short_service");
        }

        if (setting.AdvanceOneOpen && await db.Advances.AsNoTracking().AnyAsync(a => a.EmployeeId == member.Id && a.Id != advanceId
                && (a.Status == AdvanceStatus.InApproval || a.Status == AdvanceStatus.Approved || a.Status == AdvanceStatus.Disbursed), cancellationToken).ConfigureAwait(false))
        {
            problems.Add("open_advance");
        }

        var pay = await staff.SalaryAsync(member.Id, today, cancellationToken).ConfigureAwait(false);
        decimal? cap = pay is null ? null : decimal.Round(pay.Total * setting.AdvanceCapPercent / 100, 2);
        if (pay is null)
        {
            problems.Add("no_salary");
        }
        else if (input.Amount > cap)
        {
            aboveCap.Add("advance_cap");
        }

        var installment = input.Months > 0 ? decimal.Round(input.Amount / input.Months, 2) : input.Amount;
        var first = Periods.Valid(input.FirstPeriod) ? input.FirstPeriod : Periods.Of(today);
        var month = await MonthTotalAsync(db, member.Id, first, advanceId, null, cancellationToken).ConfigureAwait(false) + installment;
        decimal? monthCap = pay is null ? null : decimal.Round(pay.Total * setting.MonthlyCapPercent / 100, 2);
        if (monthCap is { } mc && month > mc)
        {
            aboveCap.Add("month_cap");
        }

        if (aboveCap.Count > 0 && !input.AboveCap)
        {
            problems.Add("above_cap");
        }

        var manager = await staff.ManagerAsync(member.Id, cancellationToken).ConfigureAwait(false);
        var seeSalary = (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(SalariesView);
        return Result.Success(new AdvancePreview(
            seeSalary ? pay?.Total : null, seeSalary ? cap : null, installment, month, seeSalary ? monthCap : null,
            seeSalary && pay is { Total: > 0 } p ? decimal.Round(month / p.Total * 100, 1) : null, setting.AdvanceMaxMonths,
            manager?.Name, manager?.UserId is not null, problems, aboveCap));
    }

    /// <summary>The amounts already due in a payroll month (advance installments and amount deductions), for the month's cap.</summary>
    internal static async Task<decimal> MonthTotalAsync(DeductionsDbContext db, Guid employeeId, string period, Guid? exceptAdvance, Guid? exceptPenalty, CancellationToken cancellationToken)
    {
        var installments = await (from i in db.Installments.AsNoTracking()
                                  join a in db.Advances.AsNoTracking() on i.AdvanceId equals a.Id
                                  where a.EmployeeId == employeeId && i.Period == period && a.Id != exceptAdvance
                                      && (i.Status == InstallmentStatus.Scheduled || i.Status == InstallmentStatus.Deferred)
                                  select (decimal?)(i.Amount - i.Deducted)).SumAsync(cancellationToken).ConfigureAwait(false) ?? 0;
        var pending = await db.Advances.AsNoTracking()
            .Where(a => a.EmployeeId == employeeId && a.Id != exceptAdvance && a.Status == AdvanceStatus.InApproval && a.FirstPeriod == period)
            .SumAsync(a => (decimal?)(a.Amount / a.Months), cancellationToken).ConfigureAwait(false) ?? 0;
        var amounts = await db.Penalties.AsNoTracking()
            .Where(p => p.EmployeeId == employeeId && p.Id != exceptPenalty && p.Period == period && p.Amount != null && (p.Status == PenaltyStatus.InApproval || p.Status == PenaltyStatus.Applied))
            .SumAsync(p => p.Amount, cancellationToken).ConfigureAwait(false) ?? 0;
        return installments + pending + amounts;
    }

    public async Task<Result<Guid>> RequestAsync(AdvanceInput input, CancellationToken cancellationToken)
    {
        var preview = await PreviewAsync(input, null, cancellationToken).ConfigureAwait(false);
        if (preview.IsFailure)
        {
            return Result.Failure<Guid>(preview.Error);
        }

        if (Refusal(preview.Value) is { } refused)
        {
            return Result.Failure<Guid>(refused);
        }

        var member = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).First(m => m.Id == input.EmployeeId);
        var manager = await staff.ManagerAsync(member.Id, cancellationToken).ConfigureAwait(false);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, DeductionsModule.AdvanceSequence, clock.Today, cancellationToken).ConfigureAwait(false);
        var advance = Advance.Create(number, member.Id, member.NameAr ?? member.NameEn, user.DisplayName, clock.UtcNow);
        var salary = await staff.SalaryAsync(member.Id, clock.Today, cancellationToken).ConfigureAwait(false);
        var set = advance.Set(input.Amount, input.Months, input.FirstPeriod, input.Reason, preview.Value.NeedsAboveCap.Count > 0 && input.AboveCap, salary?.Total, manager?.UserId);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        db.Advances.Add(advance);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return await SendAsync(advance, member.LegalEntityId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<Result<Guid>> ResubmitAsync(Guid id, AdvanceInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Advances.FirstOrDefaultAsync(a => a.Id == id, cancellationToken).ConfigureAwait(false) is not { } advance)
        {
            return Result.Failure<Guid>(DeductionErrors.AdvanceNotFound);
        }

        if (advance.Status != AdvanceStatus.Returned)
        {
            return Result.Failure<Guid>(DeductionErrors.NotReturned);
        }

        var preview = await PreviewAsync(input with { EmployeeId = advance.EmployeeId }, id, cancellationToken).ConfigureAwait(false);
        if (preview.IsFailure)
        {
            return Result.Failure<Guid>(preview.Error);
        }

        if (Refusal(preview.Value) is { } refused)
        {
            return Result.Failure<Guid>(refused);
        }

        var manager = await staff.ManagerAsync(advance.EmployeeId, cancellationToken).ConfigureAwait(false);
        var salary = await staff.SalaryAsync(advance.EmployeeId, clock.Today, cancellationToken).ConfigureAwait(false);
        var set = advance.Set(input.Amount, input.Months, input.FirstPeriod, input.Reason, preview.Value.NeedsAboveCap.Count > 0 && input.AboveCap, salary?.Total, manager?.UserId);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var legalEntity = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(m => m.Id == advance.EmployeeId)?.LegalEntityId;
        return await SendAsync(advance, legalEntity, cancellationToken).ConfigureAwait(false);
    }

    public async Task<Result> DisburseAsync(Guid id, DisburseInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Advances.FirstOrDefaultAsync(a => a.Id == id, cancellationToken).ConfigureAwait(false) is not { } advance)
        {
            return Result.Failure(DeductionErrors.AdvanceNotFound);
        }

        var done = advance.Disburse(input.PaidOn, input.Method, input.Reference, user.DisplayName);
        if (done.IsSuccess)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return done;
    }

    public async Task<Result> SettleAsync(Guid id, NoteInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Advances.Include(a => a.Installments).FirstOrDefaultAsync(a => a.Id == id, cancellationToken).ConfigureAwait(false) is not { } advance)
        {
            return Result.Failure(DeductionErrors.AdvanceNotFound);
        }

        var done = string.IsNullOrWhiteSpace(input.Note) ? Result.Failure(DeductionErrors.NotOpen) : advance.SettleEarly($"{input.Note.Trim()} — {user.DisplayName}");
        if (done.IsSuccess)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return done;
    }

    public async Task<Result> PostponeAsync(Guid id, Guid installmentId, NoteInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Advances.Include(a => a.Installments).FirstOrDefaultAsync(a => a.Id == id, cancellationToken).ConfigureAwait(false) is not { } advance)
        {
            return Result.Failure(DeductionErrors.AdvanceNotFound);
        }

        var moved = string.IsNullOrWhiteSpace(input.Note) ? Result.Failure<AdvanceInstallment>(DeductionErrors.NotPostponable) : advance.Postpone(installmentId, $"{input.Note.Trim()} — {user.DisplayName}");
        if (moved.IsFailure)
        {
            return moved;
        }

        db.Installments.Add(moved.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    private static Error? Refusal(AdvancePreview p) => (p.Problems.Count > 0 ? p.Problems[0] : null) switch
    {
        null => null,
        "fields" => DeductionErrors.AdvanceFields,
        "too_many_months" => DeductionErrors.TooManyMonths,
        "not_employed" => DeductionErrors.NotEmployed,
        "on_probation" => DeductionErrors.OnProbation,
        "short_service" => DeductionErrors.ShortService,
        "open_advance" => DeductionErrors.OpenAdvance,
        "no_salary" => DeductionErrors.NoSalary,
        _ => DeductionErrors.AboveCap,
    };

    private async Task<Result<Guid>> SendAsync(Advance advance, Guid? legalEntityId, CancellationToken cancellationToken)
    {
        var started = await approvals.SubmitAsync(new ApprovalSubmission(AdvanceAdapter.ScreenCode, advance.Id, $"{advance.AdvanceNo} — {advance.EmployeeName}", legalEntityId), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            advance.Ended(AdvanceStatus.Returned, null, clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure<Guid>(started.Error);
        }

        return Result.Success(advance.Id);
    }
}

/// <summary>The advance as the approval engine sees it: the direct manager (when linked), HR, then finance.</summary>
internal sealed class AdvanceAdapter(DeductionsDbContext db, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "deduction.advance";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new object[]
            {
                new
                {
                    type = "condition", id = "has-manager",
                    branches = new[]
                    {
                        new
                        {
                            condition = new { matchAll = true, rules = new[] { new { fieldKey = "manager", @operator = "IsNotEmpty" } } },
                            steps = new object[]
                            {
                                new
                                {
                                    type = "approval", id = "manager", label = "المدير المباشر", nameAr = "المدير المباشر", nameEn = "Direct manager",
                                    assignees = new[] { new { kind = "UserField", fieldKey = "manager" } }, rule = "Any",
                                },
                            },
                        },
                    },
                },
                new
                {
                    type = "approval", id = "hr", label = "الموارد البشرية", nameAr = "الموارد البشرية", nameEn = "HR",
                    assignees = new[] { new { kind = "Permission", permission = DeductionPermissions.ApproveHr } }, rule = "Any",
                },
                new
                {
                    type = "approval", id = "finance", label = "المالية", nameAr = "المالية", nameEn = "Finance",
                    assignees = new[] { new { kind = "Permission", permission = DeductionPermissions.ApproveFinance } }, rule = "Any",
                },
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "السلف",
        "Salary advances",
        "/hr/advances/{id}",
        [
            new("employee", "الموظف", "Employee", RecordFieldType.Text, Updatable: false),
            new("amount", "المبلغ", "Amount", RecordFieldType.Money, Updatable: false),
            new("months", "عدد الأشهر", "Months", RecordFieldType.Number, Updatable: false),
            new("above_cap", "يتجاوز السقف", "Above the cap", RecordFieldType.Boolean, Updatable: false),
            new("manager", "المدير المباشر", "Direct manager", RecordFieldType.User, Updatable: false),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد السلف", "Advance approval", DefaultDefinition));

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var a = await db.Advances.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return a is null
            ? null
            : new Dictionary<string, string?>
            {
                ["employee"] = a.EmployeeName,
                ["amount"] = a.Amount.ToString(CultureInfo.InvariantCulture),
                ["months"] = a.Months.ToString(CultureInfo.InvariantCulture),
                ["above_cap"] = a.AboveCap ? "true" : "false",
                ["manager"] = a.ManagerUserId?.ToString(),
            };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("deduction_advance_field_not_settable", "A process cannot change an advance.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        if (await db.Advances.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { } a)
        {
            return Result.Failure(DeductionErrors.AdvanceNotFound);
        }

        a.Started();
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        if (await db.Advances.Include(x => x.Installments).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { Status: AdvanceStatus.InApproval } a)
        {
            return;
        }

        if (end == ApprovalEnd.Approved)
        {
            db.Installments.AddRange(a.Approve(comment, clock.UtcNow));
        }
        else
        {
            a.Ended(end == ApprovalEnd.Rejected ? AdvanceStatus.Rejected : AdvanceStatus.Returned, comment, clock.UtcNow);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
