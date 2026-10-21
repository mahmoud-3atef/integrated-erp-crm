using IntegratedErp.BuildingBlocks.Attachments;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Expenses.Contracts;
using IntegratedErp.Modules.Expenses.Domain;
using IntegratedErp.Modules.Expenses.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Expenses.Application;

/// <param name="Scope"><c>Project</c>, <c>Worker</c> or <c>General</c>: whom the cost is charged to.</param>
public sealed record ExpenseDto(
    Guid Id,
    string ExpenseNo,
    DateOnly SpentOn,
    string Category,
    string CategoryAr,
    string CategoryEn,
    string Scope,
    Guid? WorkerId,
    string? WorkerNo,
    string? WorkerName,
    Guid? ProjectCrmId,
    string? ProjectName,
    decimal Amount,
    decimal Vat,
    int Months,
    string? PaidTo,
    string? Reference,
    string? Notes,
    string Status,
    string? CancelReason,
    string CreatedBy,
    DateTimeOffset CreatedAt);

public sealed record ExpenseInput(DateOnly? SpentOn, string? Category, Guid? WorkerId, Guid? ProjectCrmId, decimal Amount, decimal? Vat, int? Months, string? PaidTo, string? Reference, string? Notes);

public sealed record ExpenseFilter(DateOnly? From, DateOnly? To, string? Category, string? Scope, Guid? WorkerId, Guid? ProjectCrmId, string? Search, bool WithCancelled, int Page, int PageSize);

public sealed record ExpenseSumDto(string Key, string NameAr, string NameEn, int Count, decimal Amount);

public sealed record ExpenseListDto(IReadOnlyList<ExpenseDto> Items, int Total, decimal Amount, decimal Vat, IReadOnlyList<ExpenseSumDto> ByScope, IReadOnlyList<ExpenseSumDto> ByCategory);

public sealed record ExpenseWorkerDto(Guid Id, string WorkerNo, string Name, string? ProjectName);

public sealed record ExpenseProjectDto(Guid CrmId, string Code, string Name, string? Manager);

/// <summary>
/// The company's expenses (docs/03-migration-plan/16): recorded against a project, a worker or the company, spread over
/// the months they cover, cancelled with a reason (never deleted), and their shares in a period for the profitability.
/// </summary>
internal sealed class ExpenseService(
    ExpensesDbContext db,
    NumberSequenceService numbering,
    IReferenceData referenceData,
    IWorkforceDirectory workforce,
    IProjectDirectory projects,
    ITenantContext tenant,
    ICurrentUser user,
    IClock clock) : IExpenseLedger
{
    private static readonly DateOnly Earliest = new(2025, 1, 1);

    public static readonly Error NotFound = Error.NotFound("expense", "Expense not found.");
    public static readonly Error BadDate = Error.Validation("expense_date", "The date must be from 2025 and not in the future.");
    public static readonly Error BadCategory = Error.Validation("expense_category", "Choose a category from the list.");
    public static readonly Error BadAmount = Error.Validation("expense_amount", "The amount must be above zero and at most 10,000,000; the VAT at most the amount.");
    public static readonly Error BadMonths = Error.Validation("expense_months", "An expense covers 1 to 36 months.");
    public static readonly Error UnknownWorker = Error.Validation("expense_worker", "The worker was not found.");
    public static readonly Error UnknownProject = Error.Validation("expense_project", "The project was not found.");
    public static readonly Error TooLong = Error.Validation("expense_text", "A text is too long.");
    public static readonly Error Cancelled = Error.Validation("expense_cancelled", "The expense is cancelled.");
    public static readonly Error ReasonRequired = Error.Validation("expense_reason", "Write why the expense is cancelled.");

    public async Task<ExpenseListDto> ListAsync(ExpenseFilter f, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(f);
        IQueryable<Expense> q = db.Expenses.AsNoTracking();
        if (!f.WithCancelled)
        {
            q = q.Where(e => e.Status == ExpenseStatus.Active);
        }

        if (f.From is { } from)
        {
            q = q.Where(e => e.SpentOn >= from);
        }

        if (f.To is { } to)
        {
            q = q.Where(e => e.SpentOn <= to);
        }

        if (!string.IsNullOrWhiteSpace(f.Category))
        {
            q = q.Where(e => e.Category == f.Category);
        }

        q = f.Scope switch
        {
            "Project" => q.Where(e => e.ProjectCrmId != null),
            "Worker" => q.Where(e => e.ProjectCrmId == null && e.WorkerId != null),
            "General" => q.Where(e => e.ProjectCrmId == null && e.WorkerId == null),
            _ => q,
        };
        if (f.WorkerId is { } worker)
        {
            q = q.Where(e => e.WorkerId == worker);
        }

        if (f.ProjectCrmId is { } project)
        {
            q = q.Where(e => e.ProjectCrmId == project);
        }

        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var s = f.Search.Trim();
            q = q.Where(e => e.ExpenseNo.Contains(s) || (e.WorkerNo != null && e.WorkerNo.Contains(s)) || (e.WorkerName != null && e.WorkerName.Contains(s))
                || (e.ProjectName != null && e.ProjectName.Contains(s)) || (e.PaidTo != null && e.PaidTo.Contains(s)) || (e.Reference != null && e.Reference.Contains(s)));
        }

        var all = await q.Select(e => new { e.Category, e.ProjectCrmId, e.WorkerId, e.Amount, e.Vat, e.Status }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var active = all.Where(e => e.Status == ExpenseStatus.Active).ToList();
        var size = Math.Clamp(f.PageSize, 10, 200);
        var page = await q.OrderByDescending(e => e.SpentOn).ThenByDescending(e => e.CreatedAt).Skip((Math.Max(1, f.Page) - 1) * size).Take(size).ToListAsync(cancellationToken).ConfigureAwait(false);
        var names = await NamesAsync(cancellationToken).ConfigureAwait(false);
        static string Scope(Guid? p, Guid? w) => p is not null ? "Project" : w is not null ? "Worker" : "General";
        return new ExpenseListDto(
            page.Select(e => Dto(e, names)).ToList(), all.Count, active.Sum(e => e.Amount), active.Sum(e => e.Vat),
            active.GroupBy(e => Scope(e.ProjectCrmId, e.WorkerId)).Select(g => new ExpenseSumDto(g.Key, g.Key, g.Key, g.Count(), g.Sum(e => e.Amount))).OrderByDescending(s => s.Amount).ToList(),
            active.GroupBy(e => e.Category).Select(g => new ExpenseSumDto(g.Key, names.GetValueOrDefault(g.Key).Ar ?? g.Key, names.GetValueOrDefault(g.Key).En ?? g.Key, g.Count(), g.Sum(e => e.Amount))).OrderByDescending(s => s.Amount).ToList());
    }

    public async Task<ExpenseDto?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        await db.Expenses.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id, cancellationToken).ConfigureAwait(false) is { } e ? Dto(e, await NamesAsync(cancellationToken).ConfigureAwait(false)) : null;

    public async Task<Result<Guid>> CreateAsync(ExpenseInput input, CancellationToken cancellationToken)
    {
        var values = await ValidateAsync(input, cancellationToken).ConfigureAwait(false);
        if (values.IsFailure)
        {
            return Result.Failure<Guid>(values.Error);
        }

        // The number is taken in the transaction that saves the expense (no gaps).
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var no = await numbering.NextNumberAsync(db, ExpensesModule.Sequence, values.Value.SpentOn, cancellationToken).ConfigureAwait(false);
        var expense = new Expense(tenant.TenantId ?? throw new InvalidOperationException("A company must be selected."), no, values.Value, user.DisplayName, clock.UtcNow);
        db.Expenses.Add(expense);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(expense.Id);
    }

    public async Task<Result> UpdateAsync(Guid id, ExpenseInput input, CancellationToken cancellationToken)
    {
        var expense = await db.Expenses.FirstOrDefaultAsync(e => e.Id == id, cancellationToken).ConfigureAwait(false);
        if (expense is null)
        {
            return Result.Failure(NotFound);
        }

        if (expense.Status == ExpenseStatus.Cancelled)
        {
            return Result.Failure(Cancelled);
        }

        var values = await ValidateAsync(input, cancellationToken).ConfigureAwait(false);
        if (values.IsFailure)
        {
            return values;
        }

        expense.Update(values.Value, user.DisplayName, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> CancelAsync(Guid id, string? reason, CancellationToken cancellationToken)
    {
        var expense = await db.Expenses.FirstOrDefaultAsync(e => e.Id == id, cancellationToken).ConfigureAwait(false);
        if (expense is null)
        {
            return Result.Failure(NotFound);
        }

        if (expense.Status == ExpenseStatus.Cancelled)
        {
            return Result.Failure(Cancelled);
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure(ReasonRequired);
        }

        expense.Cancel(reason.Trim(), user.DisplayName, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<IReadOnlyList<ExpenseWorkerDto>> WorkersAsync(string search, CancellationToken cancellationToken) =>
        string.IsNullOrWhiteSpace(search) || search.Trim().Length < 2
            ? []
            : (await workforce.SearchAsync(search.Trim(), 20, cancellationToken).ConfigureAwait(false)).Select(w => new ExpenseWorkerDto(w.Id, w.WorkerNo, w.Name, w.ProjectName)).ToList();

    public Task<IReadOnlyList<ReferenceItemInfo>> CategoriesAsync(CancellationToken cancellationToken) => referenceData.ListAsync(ExpenseCategories.ListCode, cancellationToken);

    public async Task<IReadOnlyList<ExpenseProjectDto>> ProjectsAsync(CancellationToken cancellationToken) =>
        (await projects.ActiveAsync(cancellationToken).ConfigureAwait(false)).Select(p => new ExpenseProjectDto(p.CrmId, p.Code, p.Name, p.Manager)).ToList();

    public async Task<IReadOnlyList<ExpenseShare>> SharesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        // An expense spread over months reaches back up to 36 months before the period.
        var earliest = new DateOnly(from.Year, from.Month, 1).AddMonths(-Expense.MaxMonths);
        var expenses = await db.Expenses.AsNoTracking().Where(e => e.Status == ExpenseStatus.Active && e.SpentOn >= earliest && e.SpentOn <= to).ToListAsync(cancellationToken).ConfigureAwait(false);
        return expenses.Select(e => new ExpenseShare(e.Id, e.ExpenseNo, e.Category, e.WorkerId, e.ProjectCrmId, e.ShareIn(from, to))).Where(s => s.Amount != 0).ToList();
    }

    public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken) => db.Expenses.AnyAsync(e => e.Id == id, cancellationToken);

    private async Task<Result<ExpenseValues>> ValidateAsync(ExpenseInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (input.SpentOn is not { } on || on < Earliest || on > clock.Today)
        {
            return Result.Failure<ExpenseValues>(BadDate);
        }

        var category = (input.Category ?? string.Empty).Trim().ToUpperInvariant();
        if (!await referenceData.IsValidAsync(ExpenseCategories.ListCode, category, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<ExpenseValues>(BadCategory);
        }

        var vat = input.Vat ?? 0;
        if (input.Amount <= 0 || input.Amount > 10_000_000 || vat < 0 || vat > input.Amount)
        {
            return Result.Failure<ExpenseValues>(BadAmount);
        }

        var months = input.Months ?? 1;
        if (months is < 1 or > Expense.MaxMonths)
        {
            return Result.Failure<ExpenseValues>(BadMonths);
        }

        static string? Text(string? v, int max, out bool tooLong)
        {
            var t = string.IsNullOrWhiteSpace(v) ? null : v.Trim();
            tooLong = t?.Length > max;
            return t;
        }

        var paidTo = Text(input.PaidTo, Expense.TextMaxLength, out var l1);
        var reference = Text(input.Reference, 100, out var l2);
        var notes = Text(input.Notes, Expense.NotesMaxLength, out var l3);
        if (l1 || l2 || l3)
        {
            return Result.Failure<ExpenseValues>(TooLong);
        }

        string? workerNo = null, workerName = null, projectName = null;
        if (input.WorkerId is { } workerId)
        {
            if (await workforce.CardsAsync([workerId], cancellationToken).ConfigureAwait(false) is not [var card, ..])
            {
                return Result.Failure<ExpenseValues>(UnknownWorker);
            }

            workerNo = card.WorkerNo;
            workerName = card.Name.Length > Expense.TextMaxLength ? card.Name[..Expense.TextMaxLength] : card.Name;
        }

        if (input.ProjectCrmId is { } projectId)
        {
            if (await projects.FindAsync([], [projectId], cancellationToken).ConfigureAwait(false) is not [var project, ..])
            {
                return Result.Failure<ExpenseValues>(UnknownProject);
            }

            projectName = project.Name;
        }

        return Result.Success(new ExpenseValues(on, category, input.WorkerId, workerNo, workerName, input.ProjectCrmId, projectName, Math.Round(input.Amount, 2), Math.Round(vat, 2), months, paidTo, reference, notes));
    }

    private async Task<Dictionary<string, (string? Ar, string? En)>> NamesAsync(CancellationToken cancellationToken) =>
        (await referenceData.ListAllAsync(ExpenseCategories.ListCode, cancellationToken).ConfigureAwait(false))
            .GroupBy(i => i.Code, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => ((string?)g.First().NameAr, (string?)g.First().NameEn), StringComparer.OrdinalIgnoreCase);

    private static ExpenseDto Dto(Expense e, Dictionary<string, (string? Ar, string? En)> names)
    {
        var n = names.GetValueOrDefault(e.Category);
        return new ExpenseDto(e.Id, e.ExpenseNo, e.SpentOn, e.Category, n.Ar ?? e.Category, n.En ?? e.Category,
            e.ProjectCrmId is not null ? "Project" : e.WorkerId is not null ? "Worker" : "General",
            e.WorkerId, e.WorkerNo, e.WorkerName, e.ProjectCrmId, e.ProjectName, e.Amount, e.Vat, e.Months, e.PaidTo, e.Reference, e.Notes,
            e.Status.ToString(), e.CancelReason, e.CreatedBy, e.CreatedAt);
    }
}

/// <summary>Files attach to an expense of the current company.</summary>
internal sealed class ExpenseOwnerCheck(ExpenseService expenses) : IAttachmentOwnerCheck
{
    public IReadOnlyCollection<string> OwnerTypes { get; } = [ExpensesModule.OwnerType];

    public Task<bool> ExistsAsync(string ownerType, Guid ownerId, CancellationToken cancellationToken) => expenses.ExistsAsync(ownerId, cancellationToken);
}
