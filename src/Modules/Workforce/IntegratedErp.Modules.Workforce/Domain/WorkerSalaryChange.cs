using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workforce.Domain;

/// <summary>Where a salary change stands.</summary>
public enum SalaryChangeStatus
{
    InApproval,
    Applied,
    Returned,
    Rejected,
}

/// <summary>
/// A request to change a worker's salary that goes through approval (the user's request, 2026-10-25: «تعديل من خلال
/// إجراء تعديل راتب»). The salary before it is kept; on the last approval the new one is put on the worker's file.
/// </summary>
public sealed class WorkerSalaryChange : ITenantOwned
{
    public const int ReasonMaxLength = 1000;

    private WorkerSalaryChange()
    {
        ChangeNo = string.Empty;
        WorkerNo = string.Empty;
        WorkerName = string.Empty;
        RequestedBy = string.Empty;
        OldSalary = new Salary(0, 0, 0, 0, 0, 0, 0, 0, 0);
        NewSalary = new Salary(0, 0, 0, 0, 0, 0, 0, 0, 0);
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>E.g. SAL-2026-00001.</summary>
    public string ChangeNo { get; private set; }

    public Guid WorkerId { get; private set; }

    public string WorkerNo { get; private set; }

    public string WorkerName { get; private set; }

    public Salary OldSalary { get; private set; }

    public Salary NewSalary { get; private set; }

    public DateOnly EffectiveFrom { get; private set; }

    public string? Reason { get; private set; }

    public SalaryChangeStatus Status { get; private set; }

    public string RequestedBy { get; private set; }

    public DateTimeOffset RequestedAt { get; private set; }

    public DateTimeOffset? EndedAt { get; private set; }

    /// <summary>The approver's comment on a return or rejection.</summary>
    public string? LastComment { get; private set; }

    public static Result<WorkerSalaryChange> Create(string changeNo, Worker worker, string workerName, Salary newSalary, DateOnly effectiveFrom, string? reason, string by, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(worker);
        var next = Worker.Totalled(newSalary);
        if (Negative(next) || next with { Total = 0 } == worker.Salary with { Total = 0 })
        {
            return Result.Failure<WorkerSalaryChange>(WorkforceErrors.SalaryChangeFields);
        }

        reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        if (reason?.Length > ReasonMaxLength)
        {
            return Result.Failure<WorkerSalaryChange>(WorkforceErrors.SalaryChangeFields);
        }

        return Result.Success(new WorkerSalaryChange
        {
            Id = Guid.CreateVersion7(),
            ChangeNo = changeNo,
            WorkerId = worker.Id,
            WorkerNo = worker.WorkerNo,
            WorkerName = workerName,
            OldSalary = worker.Salary,
            NewSalary = next,
            EffectiveFrom = effectiveFrom,
            Reason = reason,
            Status = SalaryChangeStatus.InApproval,
            RequestedBy = by,
            RequestedAt = at,
        });
    }

    /// <summary>A salary part below zero is never valid.</summary>
    public static bool Negative(Salary s) =>
        s.Basic < 0 || s.Housing < 0 || s.Food < 0 || s.Transport < 0 || s.Overtime < 0 || s.Other < 0 || s.Project < 0 || s.Hardship < 0;

    public void Applied(DateTimeOffset at)
    {
        Status = SalaryChangeStatus.Applied;
        EndedAt = at;
        LastComment = null;
    }

    public void Ended(bool rejected, string? comment, DateTimeOffset at)
    {
        Status = rejected ? SalaryChangeStatus.Rejected : SalaryChangeStatus.Returned;
        EndedAt = at;
        LastComment = comment;
    }
}

/// <summary>The errors of editing a worker's file here.</summary>
public static class WorkforceErrors
{
    public static readonly Error WorkerNotFound = Error.NotFound("workforce_worker", "Worker not found.");
    public static readonly Error SalaryChangeNotFound = Error.NotFound("workforce_salary_change", "Salary change not found.");
    public static readonly Error Name = Error.Validation("workforce_name", "Enter the English name (300 characters at most).");
    public static readonly Error UnknownCode = Error.Validation("workforce_unknown_code", "Choose the nationality and the professions from their lists.");
    public static readonly Error IqamaTaken = Error.Validation("workforce_iqama_taken", "Another person already has this iqama number.");
    public static readonly Error Contract = Error.Validation("workforce_contract", "The contract's end cannot be before its start, and its months must be above zero.");
    public static readonly Error Salary = Error.Validation("workforce_salary", "No salary part can be below zero.");
    public static readonly Error SalaryChangeFields = Error.Validation("workforce_salary_change_fields", "Give a new salary different from the current one (no part below zero) and a reason of 1000 characters at most.");
    public static readonly Error SalaryChangeOpen = Error.Validation("workforce_salary_change_open", "This worker already has a salary change in approval.");
}
