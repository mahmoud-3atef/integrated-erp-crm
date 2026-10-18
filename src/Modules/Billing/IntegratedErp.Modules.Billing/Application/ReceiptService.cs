using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

public sealed record AllocationDto(string Kind, Guid TargetId, decimal Amount);

public sealed record ReceiptInput(
    Guid ProjectId, DateOnly ReceiptDate, decimal Amount, string Method, Guid? BankAccountId, string? Reference, string? Notes, IReadOnlyList<AllocationDto> Allocations);

public sealed record BankAccountInput(string BankName, string AccountNo, string? Iban, string? Label, bool IsActive);

/// <summary>
/// Receipt vouchers (docs/02-target-architecture/07 §4.2–4.3): a project's payment, allocated to its open invoices by
/// hand or oldest due first, sent through the company's review (accountant, then finance) and numbered on approval.
/// What is not allocated stays the project's credit and can be allocated later. Also the company's bank accounts.
/// </summary>
internal sealed class ReceiptService(
    BillingDbContext db,
    ReceivablesLedger ledger,
    IProjectDirectory projects,
    IApprovalService approvals,
    ICurrentUser user,
    IClock clock)
{
    public async Task<Result<Guid>> CreateAsync(ReceiptInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var project = await projects.FindAsync([input.ProjectId], [], cancellationToken).ConfigureAwait(false) is [var p, ..] ? p : null;
        if (project is null)
        {
            return Result.Failure<Guid>(ReceiptErrors.Project);
        }

        var receipt = Receipt.Create(project.Id, project.CrmId, project.Code, project.Name, project.CustomerName, user.DisplayName, clock.UtcNow);
        var set = await SetAsync(receipt, input, cancellationToken).ConfigureAwait(false);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        db.Receipts.Add(receipt);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(receipt.Id);
    }

    public async Task<Result> UpdateAsync(Guid id, ReceiptInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var receipt = await db.Receipts.Include(r => r.Allocations).FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (receipt is null)
        {
            return Result.Failure(ReceiptErrors.NotFound);
        }

        if (input.ProjectId != receipt.ProjectId)
        {
            return Result.Failure(ReceiptErrors.Project); // a receipt stays on its project; make a new one for another
        }

        var old = receipt.Allocations.ToList();
        var set = await SetAsync(receipt, input, cancellationToken).ConfigureAwait(false);
        if (set.IsFailure)
        {
            return set;
        }

        db.ReceiptAllocations.RemoveRange(old);
        db.ReceiptAllocations.AddRange(receipt.Allocations);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var receipt = await db.Receipts.Include(r => r.Allocations).FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (receipt is null)
        {
            return Result.Failure(ReceiptErrors.NotFound);
        }

        if (!receipt.IsEditable)
        {
            return Result.Failure(ReceiptErrors.NotEditable);
        }

        db.Receipts.Remove(receipt);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> SubmitAsync(Guid id, CancellationToken cancellationToken)
    {
        var receipt = await db.Receipts.Include(r => r.Allocations).FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (receipt is null)
        {
            return Result.Failure(ReceiptErrors.NotFound);
        }

        // Another receipt may have taken the same invoices since this one was saved.
        var items = await ledger.ItemsAsync(receipt.ProjectCrmId, receipt.Id, cancellationToken).ConfigureAwait(false);
        var fits = receipt.Recheck(ReceivablesLedger.Open(items));
        if (fits.IsFailure)
        {
            return fits;
        }

        var marked = receipt.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var started = await approvals.SubmitAsync(new ApprovalSubmission(ReceiptAdapter.ScreenCode, receipt.Id, ReceiptAdapter.Title(receipt)), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            receipt.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure(started.Error);
        }

        return Result.Success();
    }

    /// <summary>An approved receipt's credit put against the project's open items (by hand, or oldest due first when none are given).</summary>
    public async Task<Result> AllocateAsync(Guid id, IReadOnlyList<AllocationDto>? allocations, CancellationToken cancellationToken)
    {
        var receipt = await db.Receipts.Include(r => r.Allocations).FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (receipt is null)
        {
            return Result.Failure(ReceiptErrors.NotFound);
        }

        // Approved, its own allocations are already paid on the items: what is open now is the rest.
        var items = await ledger.ItemsAsync(receipt.ProjectCrmId, null, cancellationToken).ConfigureAwait(false);
        var open = ReceivablesLedger.Open(items);
        var parsed = allocations is null or { Count: 0 } ? ReceivablesLedger.Auto(items, receipt.Unallocated) : Parse(allocations);
        if (parsed is null)
        {
            return Result.Failure(ReceiptErrors.Allocation);
        }

        var added = receipt.AllocateRemainder(parsed, open);
        if (added.IsFailure)
        {
            return Result.Failure(added.Error);
        }

        db.ReceiptAllocations.AddRange(added.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<IReadOnlyList<BankAccount>> BankAccountsAsync(CancellationToken cancellationToken) =>
        await db.BankAccounts.AsNoTracking().OrderByDescending(b => b.IsActive).ThenBy(b => b.BankName).ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task<Result<Guid>> SaveBankAccountAsync(Guid? id, BankAccountInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (id is null)
        {
            var made = BankAccount.Create(input.BankName, input.AccountNo, input.Iban, input.Label);
            if (made.IsFailure)
            {
                return Result.Failure<Guid>(made.Error);
            }

            db.BankAccounts.Add(made.Value);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Success(made.Value.Id);
        }

        var account = await db.BankAccounts.FirstOrDefaultAsync(b => b.Id == id, cancellationToken).ConfigureAwait(false);
        if (account is null)
        {
            return Result.Failure<Guid>(ReceiptErrors.BankAccountNotFound);
        }

        var set = account.Update(input.BankName, input.AccountNo, input.Iban, input.Label, input.IsActive);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(account.Id);
    }

    private async Task<Result> SetAsync(Receipt receipt, ReceiptInput input, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<PaymentMethod>(input.Method, out var method))
        {
            return Result.Failure(ReceiptErrors.AccountRequired);
        }

        BankAccount? account = null;
        if (input.BankAccountId is { } accountId)
        {
            account = await db.BankAccounts.AsNoTracking().FirstOrDefaultAsync(b => b.Id == accountId && b.IsActive, cancellationToken).ConfigureAwait(false);
            if (account is null)
            {
                return Result.Failure(ReceiptErrors.AccountRequired);
            }
        }

        var allocations = Parse(input.Allocations ?? []);
        if (allocations is null)
        {
            return Result.Failure(ReceiptErrors.Allocation);
        }

        var items = await ledger.ItemsAsync(receipt.ProjectCrmId, receipt.Id, cancellationToken).ConfigureAwait(false);
        return receipt.Set(input.ReceiptDate, input.Amount, method, account, input.Reference, input.Notes, allocations, ReceivablesLedger.Open(items));
    }

    private static List<AllocationInput>? Parse(IReadOnlyList<AllocationDto> allocations)
    {
        var parsed = new List<AllocationInput>();
        foreach (var a in allocations)
        {
            if (!Enum.TryParse<ReceivableKind>(a.Kind, out var kind))
            {
                return null;
            }

            parsed.Add(new AllocationInput(kind, a.TargetId, a.Amount));
        }

        return parsed;
    }
}
