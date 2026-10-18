using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Billing.Domain;

/// <summary>How the customer paid (no cheques: the company does not take them).</summary>
public enum PaymentMethod
{
    BankTransfer,
    Cash,
    Card,
}

/// <summary>
/// Where a receipt stands: a draft, reviewed by the accountant then by finance (the company's process, changeable), and
/// approved: numbered, it lowers what the project owes.
/// </summary>
public enum ReceiptStatus
{
    Draft,
    AccountantReview,
    FinanceReview,

    /// <summary>Sent back by a reviewer: changed and sent again.</summary>
    Returned,
    Approved,
}

/// <summary>What a receipt can be allocated to: an issued invoice, an issued debit note, or a balance from the old system.</summary>
public enum ReceivableKind
{
    Invoice,
    DebitNote,
    OpeningBalance,
}

/// <summary>A bank account of the company that receives the customers' payments.</summary>
public sealed class BankAccount : ITenantOwned
{
    private BankAccount()
    {
        BankName = string.Empty;
        AccountNo = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string BankName { get; private set; }

    public string AccountNo { get; private set; }

    public string? Iban { get; private set; }

    /// <summary>The name the account is known by (e.g. "الراجحي — الرئيسي").</summary>
    public string? Label { get; private set; }

    public bool IsActive { get; private set; }

    public string Display => Label ?? $"{BankName} {AccountNo}";

    public static Result<BankAccount> Create(string bankName, string accountNo, string? iban, string? label)
    {
        var account = new BankAccount { Id = Guid.CreateVersion7(), IsActive = true };
        var set = account.Update(bankName, accountNo, iban, label, true);
        return set.IsSuccess ? Result.Success(account) : Result.Failure<BankAccount>(set.Error);
    }

    public Result Update(string bankName, string accountNo, string? iban, string? label, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(bankName) || string.IsNullOrWhiteSpace(accountNo) || bankName.Length > 100 || accountNo.Length > 50
            || (iban?.Length ?? 0) > 34 || (label?.Length ?? 0) > 100)
        {
            return Result.Failure(ReceiptErrors.BankAccount);
        }

        BankName = bankName.Trim();
        AccountNo = accountNo.Trim();
        Iban = string.IsNullOrWhiteSpace(iban) ? null : iban.Replace(" ", string.Empty, StringComparison.Ordinal).ToUpperInvariant();
        Label = string.IsNullOrWhiteSpace(label) ? null : label.Trim();
        IsActive = isActive;
        return Result.Success();
    }
}

/// <summary>
/// An invoice of the old system still open when it was read (docs/02-target-architecture/07 §8): what was left to collect,
/// with its number and dates, so the project's balance and the debts' ages are right from the first day. Read from the old
/// system on every sync during the parallel phase.
/// </summary>
public sealed class OpeningBalance : ITenantOwned
{
    private OpeningBalance()
    {
        InvoiceNo = string.Empty;
        ProjectName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid CrmId { get; private set; }

    public string InvoiceNo { get; private set; }

    public Guid ProjectCrmId { get; private set; }

    public Guid? ProjectId { get; private set; }

    public string ProjectName { get; private set; }

    public DateOnly InvoiceDate { get; private set; }

    public DateOnly DueDate { get; private set; }

    /// <summary>The invoice's total with VAT.</summary>
    public decimal Total { get; private set; }

    /// <summary>What was left to collect in the old system (total − collected there).</summary>
    public decimal Amount { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public static OpeningBalance Create(Guid crmId) => new() { Id = Guid.CreateVersion7(), CrmId = crmId };

    public void Set(string invoiceNo, Guid projectCrmId, Guid? projectId, string projectName, DateOnly invoiceDate, DateOnly dueDate, decimal total, decimal amount, DateTimeOffset at)
    {
        InvoiceNo = invoiceNo;
        ProjectCrmId = projectCrmId;
        ProjectId = projectId;
        ProjectName = projectName;
        InvoiceDate = invoiceDate;
        DueDate = dueDate;
        Total = total;
        Amount = amount;
        UpdatedAt = at;
    }
}

/// <summary>A receipt's amount put against one of the project's open items.</summary>
public sealed record AllocationInput(ReceivableKind Kind, Guid TargetId, decimal Amount);

/// <summary>
/// A receipt voucher (docs/02-target-architecture/07 §4.2): what a project's customer paid, how and into which account,
/// and how it is allocated to the project's open invoices (the rest stays the project's credit, to allocate later).
/// Approved, it is numbered and lowers what the project owes.
/// </summary>
public sealed class Receipt : ITenantOwned
{
    private readonly List<ReceiptAllocation> _allocations = [];

    private Receipt()
    {
        ProjectCode = string.Empty;
        ProjectName = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>The final number, given on approval.</summary>
    public string? ReceiptNo { get; private set; }

    public Guid ProjectId { get; private set; }

    public Guid ProjectCrmId { get; private set; }

    public string ProjectCode { get; private set; }

    public string ProjectName { get; private set; }

    public string? CustomerName { get; private set; }

    public DateOnly ReceiptDate { get; private set; }

    public decimal Amount { get; private set; }

    public PaymentMethod Method { get; private set; }

    public Guid? BankAccountId { get; private set; }

    public string? BankAccountName { get; private set; }

    /// <summary>The transfer's or card payment's reference.</summary>
    public string? Reference { get; private set; }

    public string? Notes { get; private set; }

    public ReceiptStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset? ApprovedAt { get; private set; }

    public string? ApprovedByName { get; private set; }

    public string? LastComment { get; private set; }

    public IReadOnlyList<ReceiptAllocation> Allocations => _allocations;

    public decimal Allocated => _allocations.Sum(a => a.Amount);

    public decimal Unallocated => Amount - Allocated;

    public bool IsEditable => Status is ReceiptStatus.Draft or ReceiptStatus.Returned && !AwaitingApproval;

    public bool IsInApproval => AwaitingApproval && Status is ReceiptStatus.AccountantReview or ReceiptStatus.FinanceReview;

    public static Receipt Create(Guid projectId, Guid projectCrmId, string projectCode, string projectName, string? customerName, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        ProjectId = projectId,
        ProjectCrmId = projectCrmId,
        ProjectCode = projectCode,
        ProjectName = projectName,
        CustomerName = customerName,
        Status = ReceiptStatus.Draft,
        CreatedAt = at,
        CreatedByName = by,
    };

    /// <summary>
    /// The draft's payment and allocations. <paramref name="open"/> is what each of the project's items still owes
    /// (leaving out this receipt's own allocations): an allocation cannot exceed it, nor all of them the amount.
    /// </summary>
    public Result Set(
        DateOnly date, decimal amount, PaymentMethod method, BankAccount? account, string? reference, string? notes,
        IReadOnlyList<AllocationInput> allocations, IReadOnlyDictionary<(ReceivableKind, Guid), decimal> open)
    {
        ArgumentNullException.ThrowIfNull(allocations);
        ArgumentNullException.ThrowIfNull(open);
        if (!IsEditable)
        {
            return Result.Failure(ReceiptErrors.NotEditable);
        }

        if (amount <= 0 || amount != Math.Round(amount, 2))
        {
            return Result.Failure(ReceiptErrors.Amount);
        }

        if (method != PaymentMethod.Cash && account is null)
        {
            return Result.Failure(ReceiptErrors.AccountRequired);
        }

        if ((reference?.Length ?? 0) > 100 || (notes?.Length ?? 0) > 1000)
        {
            return Result.Failure(ReceiptErrors.Text);
        }

        var check = Check(allocations, amount, open);
        if (check.IsFailure)
        {
            return check;
        }

        ReceiptDate = date;
        Amount = amount;
        Method = method;
        BankAccountId = account?.Id;
        BankAccountName = account?.Display;
        Reference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        _allocations.Clear();
        _allocations.AddRange(allocations.Where(a => a.Amount > 0).Select(a => new ReceiptAllocation(Id, a.Kind, a.TargetId, a.Amount)));
        return Result.Success();
    }

    /// <summary>An approved receipt's unallocated amount put against open items (allocating its credit later).</summary>
    public Result<IReadOnlyList<ReceiptAllocation>> AllocateRemainder(IReadOnlyList<AllocationInput> allocations, IReadOnlyDictionary<(ReceivableKind, Guid), decimal> open)
    {
        ArgumentNullException.ThrowIfNull(allocations);
        if (Status != ReceiptStatus.Approved)
        {
            return Result.Failure<IReadOnlyList<ReceiptAllocation>>(ReceiptErrors.NotApproved);
        }

        var check = Check(allocations, Unallocated, open);
        if (check.IsFailure)
        {
            return Result.Failure<IReadOnlyList<ReceiptAllocation>>(check.Error);
        }

        var added = allocations.Where(a => a.Amount > 0).Select(a => new ReceiptAllocation(Id, a.Kind, a.TargetId, a.Amount)).ToList();
        _allocations.AddRange(added);
        return Result.Success<IReadOnlyList<ReceiptAllocation>>(added);
    }

    /// <summary>The allocations still fit what the items owe (checked again when the receipt is approved).</summary>
    public Result Recheck(IReadOnlyDictionary<(ReceivableKind, Guid), decimal> open) =>
        Check(_allocations.Select(a => new AllocationInput(a.Kind, a.TargetId, a.Amount)).ToList(), Amount, open);

    public Result MarkSubmitted(DateTimeOffset at)
    {
        if (!IsEditable)
        {
            return Result.Failure(ReceiptErrors.NotEditable);
        }

        if (Amount <= 0)
        {
            return Result.Failure(ReceiptErrors.Amount);
        }

        Status = ReceiptStatus.AccountantReview;
        AwaitingApproval = true;
        return Result.Success();
    }

    public void SubmissionFailed()
    {
        Status = ReceiptStatus.Draft;
        AwaitingApproval = false;
    }

    public Result SetStatusFromProcess(ReceiptStatus status)
    {
        if (!IsInApproval || status is not (ReceiptStatus.AccountantReview or ReceiptStatus.FinanceReview))
        {
            return Result.Failure(ReceiptErrors.StatusNotSettable);
        }

        Status = status;
        return Result.Success();
    }

    public void Approve(string number, string by, string? comment, DateTimeOffset at)
    {
        ReceiptNo = number;
        Status = ReceiptStatus.Approved;
        AwaitingApproval = false;
        ApprovedAt = at;
        ApprovedByName = by;
        LastComment = comment;
    }

    /// <summary>The approval ended without approving (or the allocations no longer fit): back to be changed.</summary>
    public void ApprovalEnded(bool withdrawn, string? comment)
    {
        Status = withdrawn ? ReceiptStatus.Draft : ReceiptStatus.Returned;
        AwaitingApproval = false;
        LastComment = comment;
    }

    private static Result Check(IReadOnlyList<AllocationInput> allocations, decimal limit, IReadOnlyDictionary<(ReceivableKind, Guid), decimal> open)
    {
        if (allocations.Any(a => a.Amount < 0 || a.Amount != Math.Round(a.Amount, 2)) || allocations.GroupBy(a => (a.Kind, a.TargetId)).Any(g => g.Count() > 1))
        {
            return Result.Failure(ReceiptErrors.Allocation);
        }

        if (allocations.Sum(a => a.Amount) > limit)
        {
            return Result.Failure(ReceiptErrors.OverAmount);
        }

        foreach (var a in allocations.Where(a => a.Amount > 0))
        {
            if (!open.TryGetValue((a.Kind, a.TargetId), out var owed) || a.Amount > owed)
            {
                return Result.Failure(ReceiptErrors.OverItem);
            }
        }

        return Result.Success();
    }
}

/// <summary>A part of a receipt put against one open item of the project.</summary>
public sealed class ReceiptAllocation : ITenantOwned
{
    private ReceiptAllocation()
    {
    }

    internal ReceiptAllocation(Guid receiptId, ReceivableKind kind, Guid targetId, decimal amount)
    {
        Id = Guid.CreateVersion7();
        ReceiptId = receiptId;
        Kind = kind;
        TargetId = targetId;
        Amount = amount;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid ReceiptId { get; private set; }

    public ReceivableKind Kind { get; private set; }

    /// <summary>The invoice, debit note or opening balance.</summary>
    public Guid TargetId { get; private set; }

    public decimal Amount { get; private set; }
}

public static class ReceiptErrors
{
    public static readonly Error NotFound = Error.NotFound("receipt", "Receipt not found.");
    public static readonly Error Project = Error.Validation("receipt_project", "Choose the project.");
    public static readonly Error NotEditable = Error.Conflict("receipt_not_editable", "Only a draft or returned receipt can be changed or deleted.");
    public static readonly Error NotApproved = Error.Conflict("receipt_not_approved", "Only an approved receipt's remainder can be allocated.");
    public static readonly Error Amount = Error.Validation("receipt_amount", "Enter the amount received (more than zero).");
    public static readonly Error AccountRequired = Error.Validation("receipt_account", "Choose the bank account that received the payment.");
    public static readonly Error Text = Error.Validation("receipt_text", "The reference or the notes are too long.");
    public static readonly Error Allocation = Error.Validation("receipt_allocation", "Check the allocations: each item once, amounts of zero or more.");
    public static readonly Error OverAmount = Error.Validation("receipt_over_amount", "The allocations exceed the receipt's amount.");
    public static readonly Error OverItem = Error.Validation("receipt_over_item", "An allocation exceeds what is left on its invoice.");
    public static readonly Error StatusNotSettable = Error.Validation("receipt_status_not_settable", "A process can only move the receipt between its reviews.");
    public static readonly Error BankAccount = Error.Validation("bank_account", "Enter the bank and the account number.");
    public static readonly Error BankAccountNotFound = Error.NotFound("bank_account", "Bank account not found.");
}
