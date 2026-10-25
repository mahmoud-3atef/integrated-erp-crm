using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

/// <summary>A worker's data as the edit form sends it (all of it: the user's decision, 2026-10-25).</summary>
public sealed record WorkerDataInput(
    string NameEn,
    string? NameAr,
    string? Iqama,
    DateOnly? IqamaExpiresOn,
    string? NationalityCode,
    DateOnly? ArrivedOn,
    string? ProfessionCode,
    string? IqamaProfessionCode,
    string? Sponsor,
    string? RecruitmentAgent,
    DateOnly? ContractStartsOn,
    int? ContractMonths,
    DateOnly? ContractEndsOn,
    decimal? AnnualLeaveDays,
    decimal? LeaveBalance,
    decimal? LeaveConsumed,
    decimal? LeaveOldConsumed,
    decimal? LeaveRemaining);

/// <summary>A salary's parts (the total is their sum).</summary>
public sealed record SalaryInput(decimal Basic, decimal Housing, decimal Food, decimal Transport, decimal Overtime, decimal Other, decimal Project, decimal Hardship)
{
    public Salary ToSalary() => Worker.Totalled(new Salary(Basic, Housing, Food, Transport, Overtime, Other, Project, Hardship, 0));
}

public sealed record SalaryChangeInput(SalaryInput Salary, DateOnly EffectiveFrom, string? Reason);

public sealed record EditOptionDto(string Code, string NameAr, string NameEn);

/// <summary>The lists the edit form picks from.</summary>
public sealed record WorkerEditOptionsDto(IReadOnlyList<EditOptionDto> Nationalities, IReadOnlyList<EditOptionDto> Professions);

public sealed record SalaryChangeDto(
    Guid Id,
    string ChangeNo,
    Guid WorkerId,
    string WorkerNo,
    string WorkerName,
    Salary OldSalary,
    Salary NewSalary,
    DateOnly EffectiveFrom,
    string? Reason,
    string Status,
    string RequestedBy,
    DateTimeOffset RequestedAt,
    DateTimeOffset? EndedAt,
    string? LastComment,
    ApprovalStatusInfo? Approval = null);

/// <summary>
/// Changing a worker's file here (the user's request, 2026-10-25), each part with its own permission: the data, the
/// salary directly, or a salary change that goes through approval. Every save is audited (who, when, before and after).
/// In the parallel phase the old system wins: the next change of the CRM record brings its values back.
/// </summary>
internal sealed class WorkerEditService(
    WorkforceDbContext db,
    IReferenceData reference,
    NumberSequenceService numbering,
    IApprovalService approvals,
    ICurrentUser user,
    IClock clock)
{
    public async Task<WorkerEditOptionsDto> OptionsAsync(CancellationToken cancellationToken)
    {
        static List<EditOptionDto> Of(IReadOnlyList<ReferenceItemInfo> items) => items.Select(i => new EditOptionDto(i.Code, i.NameAr, i.NameEn)).ToList();
        return new WorkerEditOptionsDto(
            Of(await reference.ListAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false)),
            Of(await reference.ListAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false)));
    }

    public async Task<Result> EditAsync(Guid id, WorkerDataInput input, CancellationToken cancellationToken)
    {
        var worker = await db.Workers.FirstOrDefaultAsync(w => w.Id == id && w.Kind == WorkerKind.Worker, cancellationToken).ConfigureAwait(false);
        if (worker is null)
        {
            return Result.Failure(WorkforceErrors.WorkerNotFound);
        }

        var nameEn = input.NameEn?.Trim() ?? string.Empty;
        var nameAr = string.IsNullOrWhiteSpace(input.NameAr) ? null : input.NameAr.Trim();
        if (nameEn.Length is 0 or > Person.NameMaxLength || nameAr?.Length > Person.NameMaxLength)
        {
            return Result.Failure(WorkforceErrors.Name);
        }

        static string? Code(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        var nationality = Code(input.NationalityCode);
        var profession = Code(input.ProfessionCode);
        var iqamaProfession = Code(input.IqamaProfessionCode);
        if (!await KnownAsync(ReferenceListCodes.Nationalities, nationality, cancellationToken).ConfigureAwait(false)
            || !await KnownAsync(ReferenceListCodes.Professions, profession, cancellationToken).ConfigureAwait(false)
            || !await KnownAsync(ReferenceListCodes.Professions, iqamaProfession, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(WorkforceErrors.UnknownCode);
        }

        var contractEnd = input.ContractEndsOn ?? (input.ContractStartsOn is { } start && input.ContractMonths is > 0 ? start.AddMonths(input.ContractMonths.Value).AddDays(-1) : null);
        if (input.ContractMonths is <= 0 || input.ContractStartsOn is { } s && contractEnd is { } e && e < s)
        {
            return Result.Failure(WorkforceErrors.Contract);
        }

        var person = await db.People.Include(p => p.Identifiers).FirstAsync(p => p.Id == worker.PersonId, cancellationToken).ConfigureAwait(false);
        var iqama = string.IsNullOrWhiteSpace(input.Iqama) ? null : input.Iqama.Trim().ToUpperInvariant();
        if (iqama is not null
            && await db.Identifiers.AnyAsync(i => i.Type == IdentifierType.Iqama && i.IsCurrent && i.Number == iqama && i.PersonId != person.Id, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(WorkforceErrors.IqamaTaken);
        }

        person.Edit(nameEn, nameAr, nationality);
        person.SetIdentifier(IdentifierType.Iqama, iqama, input.IqamaExpiresOn, usable: true);
        worker.Edit(new WorkerEdit(
            profession,
            iqamaProfession,
            string.IsNullOrWhiteSpace(input.Sponsor) ? null : input.Sponsor.Trim(),
            string.IsNullOrWhiteSpace(input.RecruitmentAgent) ? null : input.RecruitmentAgent.Trim(),
            input.ArrivedOn,
            new ContractTerms(input.ContractStartsOn, input.ContractMonths, contractEnd),
            new LeaveBalance(input.AnnualLeaveDays, input.LeaveBalance, input.LeaveConsumed, input.LeaveOldConsumed, input.LeaveRemaining)));
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> SetSalaryAsync(Guid id, SalaryInput input, CancellationToken cancellationToken)
    {
        var worker = await db.Workers.FirstOrDefaultAsync(w => w.Id == id && w.Kind == WorkerKind.Worker, cancellationToken).ConfigureAwait(false);
        if (worker is null)
        {
            return Result.Failure(WorkforceErrors.WorkerNotFound);
        }

        var salary = input.ToSalary();
        if (WorkerSalaryChange.Negative(salary))
        {
            return Result.Failure(WorkforceErrors.Salary);
        }

        worker.SetSalary(salary);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>A salary change for approval: numbered, then sent to its process (by default one approval that applies it).</summary>
    public async Task<Result<Guid>> RequestSalaryChangeAsync(Guid id, SalaryChangeInput input, CancellationToken cancellationToken)
    {
        var worker = await db.Workers.AsNoTracking().FirstOrDefaultAsync(w => w.Id == id && w.Kind == WorkerKind.Worker, cancellationToken).ConfigureAwait(false);
        if (worker is null)
        {
            return Result.Failure<Guid>(WorkforceErrors.WorkerNotFound);
        }

        if (await db.SalaryChanges.AnyAsync(c => c.WorkerId == id && c.Status == SalaryChangeStatus.InApproval, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(WorkforceErrors.SalaryChangeOpen);
        }

        var name = await db.People.AsNoTracking().Where(p => p.Id == worker.PersonId).Select(p => p.NameEn).FirstAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, WorkforceModule.SalaryChangeSequence, clock.Today, cancellationToken).ConfigureAwait(false);
        var created = WorkerSalaryChange.Create(number, worker, name, input.Salary.ToSalary(), input.EffectiveFrom, input.Reason, user.DisplayName, clock.UtcNow);
        if (created.IsFailure)
        {
            return Result.Failure<Guid>(created.Error);
        }

        var change = created.Value;
        db.SalaryChanges.Add(change);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);

        var started = await approvals.SubmitAsync(new ApprovalSubmission(WorkerSalaryChangeAdapter.ScreenCode, change.Id, $"{change.ChangeNo} — {change.WorkerName}"), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            change.Ended(rejected: false, null, clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure<Guid>(started.Error);
        }

        return Result.Success(change.Id);
    }

    public async Task<IReadOnlyList<SalaryChangeDto>> ChangesAsync(Guid workerId, CancellationToken cancellationToken) =>
        (await db.SalaryChanges.AsNoTracking().Where(c => c.WorkerId == workerId).OrderByDescending(c => c.RequestedAt).ToListAsync(cancellationToken).ConfigureAwait(false))
            .Select(Dto).ToList();

    /// <summary>One salary change with its approval (the approval bar on its page).</summary>
    public async Task<SalaryChangeDto?> ChangeAsync(Guid id, CancellationToken cancellationToken) =>
        await db.SalaryChanges.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, cancellationToken).ConfigureAwait(false) is { } c
            ? Dto(c) with { Approval = await approvals.StatusAsync(WorkerSalaryChangeAdapter.ScreenCode, c.Id, cancellationToken).ConfigureAwait(false) }
            : null;

    private static SalaryChangeDto Dto(WorkerSalaryChange c) =>
        new(c.Id, c.ChangeNo, c.WorkerId, c.WorkerNo, c.WorkerName, c.OldSalary, c.NewSalary, c.EffectiveFrom, c.Reason, c.Status.ToString(), c.RequestedBy, c.RequestedAt, c.EndedAt, c.LastComment);

    private async Task<bool> KnownAsync(string list, string? code, CancellationToken cancellationToken) =>
        code is null || (await reference.ListAllAsync(list, cancellationToken).ConfigureAwait(false)).Any(i => string.Equals(i.Code, code, StringComparison.OrdinalIgnoreCase));
}

/// <summary>
/// A worker's salary change as the approval engine sees it: by default one approval («اعتماد تعديل الراتب») that puts
/// the new salary on the worker's file; returned or rejected, the file is unchanged.
/// </summary>
internal sealed class WorkerSalaryChangeAdapter(WorkforceDbContext db, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "workforce.salary_change";

    /// <summary>The record's code: the new salary is put on the worker's file.</summary>
    public const string ApplyAction = "apply_salary";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new object[]
            {
                new
                {
                    type = "approval", id = "approve", label = "اعتماد تعديل الراتب",
                    nameAr = "اعتماد تعديل الراتب", nameEn = "Salary change approval",
                    assignees = new[] { new { kind = "Permission", permission = WorkforcePermissions.SalaryChangesApprove } }, rule = "Any",
                    onApprove = new object[] { new { type = "action", id = "apply-salary", label = "تطبيق الراتب الجديد على ملف العامل", action = ApplyAction } },
                },
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "تعديل رواتب العمالة",
        "Worker salary changes",
        "/workforce/salary-changes/{id}",
        [
            new("worker", "العامل", "Worker", RecordFieldType.Text, Updatable: false),
            new("effective_from", "تاريخ السريان", "Effective from", RecordFieldType.Date, Updatable: false),
            new("old_salary", "الراتب الحالي", "Current salary", RecordFieldType.Money, Updatable: false),
            new("new_salary", "الراتب الجديد", "New salary", RecordFieldType.Money, Updatable: false),
            new("difference", "الفرق", "Difference", RecordFieldType.Money, Updatable: false),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد تعديل رواتب العمالة", "Worker salary change approval", DefaultDefinition),
        Actions:
        [
            new(
                ApplyAction,
                "تطبيق الراتب الجديد على ملف العامل",
                "Put the new salary on the worker's file",
                "يصبح راتب العامل وبدلاته كما في الطلب، ويُحفظ الراتب السابق في الطلب، وتصبح حالته «مطبَّق».",
                "The worker's salary and allowances become those of the request; the previous salary stays on the request, which is «applied».",
                Required: true),
        ]);

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var c = await db.SalaryChanges.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return c is null
            ? null
            : new Dictionary<string, string?>
            {
                ["worker"] = $"{c.WorkerNo} — {c.WorkerName}",
                ["effective_from"] = c.EffectiveFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["old_salary"] = c.OldSalary.Total.ToString(CultureInfo.InvariantCulture),
                ["new_salary"] = c.NewSalary.Total.ToString(CultureInfo.InvariantCulture),
                ["difference"] = (c.NewSalary.Total - c.OldSalary.Total).ToString(CultureInfo.InvariantCulture),
            };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("workforce_salary_change_field_not_settable", "A process cannot change a salary change.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken) =>
        await db.SalaryChanges.AnyAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) ? Result.Success() : Result.Failure(WorkforceErrors.SalaryChangeNotFound);

    /// <summary>«Apply the new salary» (by default on the approval). Run again on an applied change, it does nothing.</summary>
    public async Task<RecordActionResult> RunAsync(Guid recordId, string action, CancellationToken cancellationToken)
    {
        if (action != ApplyAction)
        {
            return RecordActionResult.Failed($"A salary change has no action \"{action}\".");
        }

        var change = await db.SalaryChanges.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (change is null)
        {
            return RecordActionResult.Failed("The salary change no longer exists.");
        }

        if (change.Status == SalaryChangeStatus.Applied)
        {
            return RecordActionResult.Done;
        }

        if (change.Status != SalaryChangeStatus.InApproval)
        {
            return RecordActionResult.Failed("The salary change is not in approval.");
        }

        var worker = await db.Workers.FirstOrDefaultAsync(w => w.Id == change.WorkerId, cancellationToken).ConfigureAwait(false);
        if (worker is null)
        {
            return RecordActionResult.Failed("The worker no longer exists.");
        }

        worker.SetSalary(change.NewSalary);
        change.Applied(clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return RecordActionResult.Done;
    }

    /// <summary>The approval ended: a rejection or return sets the state; approved, its code already applied it.</summary>
    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        if (await db.SalaryChanges.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { Status: SalaryChangeStatus.InApproval } change)
        {
            return;
        }

        change.Ended(end == ApprovalEnd.Rejected, end == ApprovalEnd.Approved ? "انتهى الاعتماد دون تطبيق الراتب؛ أعد إرساله." : comment, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
