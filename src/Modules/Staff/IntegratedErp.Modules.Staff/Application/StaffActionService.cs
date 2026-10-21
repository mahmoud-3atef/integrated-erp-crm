using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Staff.Application;

public sealed record ActionInput(
    string Kind,
    DateOnly EffectiveFrom,
    string Reason,
    Guid? NewLegalEntityId,
    Guid? NewDepartmentId,
    Guid? NewPositionId,
    SalaryValues? NewSalary,
    decimal? ActingAllowance,
    DateOnly? ActingUntil,
    DateOnly? NewProbationEndsOn,
    string? NewContractKind,
    int? NewContractMonths,
    DateOnly? NewContractEndsOn);

/// <summary>
/// Employment actions (docs/02-target-architecture/08 §4–5): requested on an employee, sent through the company's
/// approval process (HR reviews, management approves by default), and applied to the file when approved — the job,
/// a salary from the effective date, the probation, or the contract (a renewal is a new contract).
/// </summary>
/// <summary>What may change on an applied action: its effective day and its kind's values, with the reason for the change.</summary>
public sealed record ActionAmendInput(
    DateOnly EffectiveFrom,
    SalaryValues? NewSalary,
    decimal? ActingAllowance,
    DateOnly? ActingUntil,
    DateOnly? NewProbationEndsOn,
    int? NewContractMonths,
    DateOnly? NewContractEndsOn,
    string AmendReason);

internal sealed class StaffActionService(
    StaffDbContext db,
    IApprovalService approvals,
    NumberSequenceService numbering,
    StaffActionApplier applier,
    IPermissionService permissions,
    IEnumerable<IStaffFileLocks> locks,
    ICurrentUser user,
    IClock clock)
{
    /// <summary>
    /// Changes an applied action (its kind's own permission and a reason): it is taken back, its effective day and values
    /// change, and it is applied again. Not when a later action of the employee was applied, nor when a payroll run or a
    /// settlement already used the file from its (old or new) day.
    /// </summary>
    public async Task<Result> AmendAsync(Guid id, ActionAmendInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Actions.FirstOrDefaultAsync(a => a.Id == id, cancellationToken).ConfigureAwait(false) is not { } action)
        {
            return Result.Failure(StaffErrors.ActionNotFound);
        }

        if (await HeldAsync(action, StaffPermissions.ActionAmend(action.Kind), input.AmendReason, Min(action.EffectiveFrom, input.EffectiveFrom), cancellationToken).ConfigureAwait(false) is { } held)
        {
            return Result.Failure(held);
        }

        // Taken back and saved (applying reads the contracts as stored), then applied again: one transaction.
        var comment = action.LastComment;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await applier.UndoAsync(action, cancellationToken).ConfigureAwait(false);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var amended = action.Amend(
            input.EffectiveFrom, input.NewSalary, input.ActingAllowance, input.ActingUntil, input.NewProbationEndsOn, input.NewContractMonths, input.NewContractEndsOn,
            input.AmendReason, user.DisplayName, clock.UtcNow);
        if (amended.IsFailure)
        {
            return amended; // rolled back: the file stays as it was
        }

        await applier.ApplyAsync(action, comment, cancellationToken).ConfigureAwait(false);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>Cancels an applied action (its kind's own permission and a reason): the employee's file is put back as it was before it.</summary>
    public async Task<Result> CancelApprovedAsync(Guid id, string? reason, CancellationToken cancellationToken)
    {
        if (await db.Actions.FirstOrDefaultAsync(a => a.Id == id, cancellationToken).ConfigureAwait(false) is not { } action)
        {
            return Result.Failure(StaffErrors.ActionNotFound);
        }

        if (await HeldAsync(action, StaffPermissions.ActionCancelApproved(action.Kind), reason, action.EffectiveFrom, cancellationToken).ConfigureAwait(false) is { } held)
        {
            return Result.Failure(held);
        }

        await applier.UndoAsync(action, cancellationToken).ConfigureAwait(false);
        var canceled = action.CancelApproved(reason!, user.DisplayName, clock.UtcNow);
        if (canceled.IsFailure)
        {
            return canceled;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    private static DateOnly Min(DateOnly a, DateOnly b) => a < b ? a : b;

    /// <summary>Why an applied action cannot be changed or cancelled now (null when it can).</summary>
    private async Task<Error?> HeldAsync(StaffAction action, string permission, string? reason, DateOnly from, CancellationToken cancellationToken)
    {
        if (!(await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(permission))
        {
            return StaffErrors.ActionKindForbidden;
        }

        if (!action.IsAmendable)
        {
            return StaffErrors.ActionNotAmendable;
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return StaffErrors.ActionAmendReason;
        }

        if (await db.Actions.AnyAsync(a => a.EmployeeId == action.EmployeeId && a.Id != action.Id && a.Status == StaffActionStatus.Applied && a.AppliedAt > action.AppliedAt, cancellationToken).ConfigureAwait(false))
        {
            return StaffErrors.ActionLater;
        }

        foreach (var lockSource in locks)
        {
            if (await lockSource.LockedFromAsync(action.EmployeeId, from, cancellationToken).ConfigureAwait(false) is not null)
            {
                return StaffErrors.ActionLocked;
            }
        }

        return null;
    }

    public async Task<Result<Guid>> RequestAsync(Guid employeeId, ActionInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!Enum.TryParse<StaffActionKind>(input.Kind, out var kind))
        {
            return Result.Failure<Guid>(StaffErrors.ActionFields);
        }

        ContractKind? contractKind = null;
        if (input.NewContractKind is { } ck)
        {
            if (!Enum.TryParse<ContractKind>(ck, out var parsed))
            {
                return Result.Failure<Guid>(StaffErrors.ActionFields);
            }

            contractKind = parsed;
        }

        var employee = await db.Employees.FirstOrDefaultAsync(e => e.Id == employeeId, cancellationToken).ConfigureAwait(false);
        if (employee is null)
        {
            return Result.Failure<Guid>(StaffErrors.NotFound);
        }

        if (employee.Status == StaffStatus.Left)
        {
            return Result.Failure<Guid>(StaffErrors.ActionFields);
        }

        if (await db.Actions.AnyAsync(a => a.EmployeeId == employeeId && a.Status == StaffActionStatus.InApproval, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(StaffErrors.ActionOpen);
        }

        // A promotion or transfer to a position takes a free seat of its department.
        var departmentId = input.NewDepartmentId;
        if (input.NewPositionId is { } positionId && kind is StaffActionKind.Promotion or StaffActionKind.Transfer or StaffActionKind.Acting)
        {
            var position = await db.Positions.AsNoTracking().FirstOrDefaultAsync(p => p.Id == positionId, cancellationToken).ConfigureAwait(false);
            if (position is null)
            {
                return Result.Failure<Guid>(StaffErrors.PositionNotFound);
            }

            departmentId ??= position.DepartmentId;
            if (departmentId != position.DepartmentId)
            {
                return Result.Failure<Guid>(StaffErrors.PositionElsewhere);
            }

            if (kind != StaffActionKind.Acting && positionId != employee.PositionId
                && await db.Employees.CountAsync(e => e.PositionId == positionId && e.Status != StaffStatus.Left, cancellationToken).ConfigureAwait(false) >= position.Seats)
            {
                return Result.Failure<Guid>(StaffErrors.PositionFull);
            }
        }

        var current = await CurrentSalaryAsync(employeeId, cancellationToken).ConfigureAwait(false);
        if (input.NewSalary is not null && current is not null && input.EffectiveFrom <= current.EffectiveFrom)
        {
            return Result.Failure<Guid>(StaffErrors.SalaryDate);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, "staff_action", input.EffectiveFrom, cancellationToken).ConfigureAwait(false);
        var created = StaffAction.Create(number, employee, current?.Total, new StaffActionRequest(
            kind, input.EffectiveFrom, input.Reason, input.NewLegalEntityId, departmentId, input.NewPositionId, input.NewSalary,
            input.ActingAllowance, input.ActingUntil, input.NewProbationEndsOn, contractKind, input.NewContractMonths, input.NewContractEndsOn), user.DisplayName, clock.UtcNow);
        if (created.IsFailure)
        {
            return Result.Failure<Guid>(created.Error);
        }

        var action = created.Value;
        action.MarkSubmitted(clock.UtcNow);
        db.Actions.Add(action);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);

        var started = await approvals.SubmitAsync(new ApprovalSubmission(StaffActionAdapter.ScreenCode, action.Id, $"{action.ActionNo} — {action.EmployeeName}", employee.LegalEntityId), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            action.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure<Guid>(started.Error);
        }

        return Result.Success(action.Id);
    }

    /// <summary>Sends a returned action again (as it is).</summary>
    public async Task<Result> ResubmitAsync(Guid id, CancellationToken cancellationToken)
    {
        var action = await db.Actions.FirstOrDefaultAsync(a => a.Id == id, cancellationToken).ConfigureAwait(false);
        if (action is null)
        {
            return Result.Failure(StaffErrors.ActionNotFound);
        }

        var marked = action.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var legalEntity = await db.Employees.Where(e => e.Id == action.EmployeeId).Select(e => e.LegalEntityId).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        var started = await approvals.SubmitAsync(new ApprovalSubmission(StaffActionAdapter.ScreenCode, action.Id, $"{action.ActionNo} — {action.EmployeeName}", legalEntity), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            action.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure(started.Error);
        }

        return Result.Success();
    }

    private Task<StaffSalary?> CurrentSalaryAsync(Guid employeeId, CancellationToken cancellationToken) =>
        db.Salaries.AsNoTracking().Where(s => s.EmployeeId == employeeId).OrderByDescending(s => s.EffectiveFrom).ThenByDescending(s => s.CreatedAt).FirstOrDefaultAsync(cancellationToken);
}
