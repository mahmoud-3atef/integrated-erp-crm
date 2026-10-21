using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Staff.Application;

/// <summary>Applies an approved employment action to the employee's file (kept apart from the service so the approval engine can call it).</summary>
internal sealed class StaffActionApplier(StaffDbContext db, ICurrentUser user, IClock clock)
{
    /// <summary>The approved action changes the file (called by its code step); the file before it is kept on the action.</summary>
    public async Task ApplyAsync(StaffAction action, string? comment, CancellationToken cancellationToken)
    {
        var employee = await db.Employees.FirstAsync(e => e.Id == action.EmployeeId, cancellationToken).ConfigureAwait(false);
        var by = $"{user.DisplayName} · {action.ActionNo}";
        var activeContracts = await db.Contracts.Where(c => c.EmployeeId == employee.Id && c.Status == ContractStatus.Active).Select(c => c.Id).ToListAsync(cancellationToken).ConfigureAwait(false);
        action.KeepPrior(JsonSerializer.Serialize(new PriorFile(employee.Snapshot(), activeContracts)));
        switch (action.Kind)
        {
            case StaffActionKind.Promotion:
                employee.Place(action.NewLegalEntityId ?? employee.LegalEntityId, action.NewDepartmentId ?? employee.DepartmentId, action.NewPositionId);
                break;
            case StaffActionKind.Transfer:
                var department = action.NewDepartmentId ?? employee.DepartmentId;
                employee.Place(action.NewLegalEntityId ?? employee.LegalEntityId, department, action.NewPositionId ?? (department == employee.DepartmentId ? employee.PositionId : null));
                break;
            case StaffActionKind.Acting:
                employee.SetActing(action.NewPositionId!.Value, action.ActingUntil!.Value, action.ActingAllowance ?? 0);
                break;
            case StaffActionKind.ConfirmProbation:
                employee.ConfirmProbation();
                break;
            case StaffActionKind.ExtendProbation:
                employee.ExtendProbation(action.NewProbationEndsOn!.Value);
                break;
            case StaffActionKind.EndProbation:
                employee.EndEmployment(action.EffectiveFrom);
                break;
            case StaffActionKind.RenewContract:
                await RenewAsync(employee, action, by, cancellationToken).ConfigureAwait(false);
                break;
            case StaffActionKind.NotRenew:
                employee.EndEmployment(employee.ContractEndsOn ?? action.EffectiveFrom);
                foreach (var active in await db.Contracts.Where(c => c.EmployeeId == employee.Id && c.Status == ContractStatus.Active).ToListAsync(cancellationToken).ConfigureAwait(false))
                {
                    active.End();
                }

                break;
        }

        if (action.NewSalary is { } salary)
        {
            var row = StaffSalary.Create(employee.Id, action.EffectiveFrom, salary, SalarySource.Change, $"{action.ActionNo}: {action.Reason}", user.DisplayName, clock.UtcNow);
            if (row.IsSuccess)
            {
                db.Salaries.Add(row.Value);
            }
        }

        action.Applied(comment, clock.UtcNow);
    }

    /// <summary>
    /// Takes an applied action back: the file as it was before it, the contracts it renewed or ended active again (the
    /// one it made removed), and the salary it set removed.
    /// </summary>
    public async Task UndoAsync(StaffAction action, CancellationToken cancellationToken)
    {
        var prior = JsonSerializer.Deserialize<PriorFile>(action.PriorFile!)!;
        var employee = await db.Employees.FirstAsync(e => e.Id == action.EmployeeId, cancellationToken).ConfigureAwait(false);
        employee.Restore(prior.File);
        db.Contracts.RemoveRange(await db.Contracts.Where(c => c.ActionId == action.Id).ToListAsync(cancellationToken).ConfigureAwait(false));
        foreach (var contract in await db.Contracts.Where(c => prior.ActiveContracts.Contains(c.Id) && c.Status != ContractStatus.Active).ToListAsync(cancellationToken).ConfigureAwait(false))
        {
            contract.Reactivate();
        }

        var mark = $"{action.ActionNo}:";
        db.Salaries.RemoveRange(await db.Salaries
            .Where(s => s.EmployeeId == action.EmployeeId && s.Source == SalarySource.Change && s.Reason != null && s.Reason.StartsWith(mark))
            .ToListAsync(cancellationToken).ConfigureAwait(false));
    }

    /// <summary>The file before an action, and the contracts active then.</summary>
    private sealed record PriorFile(EmployeeSnapshot File, IReadOnlyList<Guid> ActiveContracts);

    private async Task RenewAsync(StaffEmployee employee, StaffAction action, string by, CancellationToken cancellationToken)
    {
        var active = await db.Contracts.Where(c => c.EmployeeId == employee.Id && c.Status == ContractStatus.Active).OrderByDescending(c => c.StartsOn)
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        var start = employee.ContractEndsOn is { } end && end >= action.EffectiveFrom.AddDays(-1) ? end.AddDays(1) : action.EffectiveFrom;
        var renewed = StaffContract.Create(employee.Id, action.NewContractKind ?? ContractKind.Fixed, start, action.NewContractMonths, action.NewContractEndsOn,
            0, active?.NoticeDays ?? 30, active?.Id, action.Id, action.Reason, by, clock.UtcNow);
        if (renewed.IsFailure)
        {
            return;
        }

        active?.Renewed();
        db.Contracts.Add(renewed.Value);
        employee.SetContract(renewed.Value.StartsOn, renewed.Value.Months, renewed.Value.EndsOn);
    }

}
