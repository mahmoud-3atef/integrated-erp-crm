using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Staff.Application;

/// <summary>Applies an approved employment action to the employee's file (kept apart from the service so the approval engine can call it).</summary>
internal sealed class StaffActionApplier(StaffDbContext db, ICurrentUser user, IClock clock)
{
    /// <summary>The approved action changes the file (called by the approval's end).</summary>
    public async Task ApplyAsync(StaffAction action, string? comment, CancellationToken cancellationToken)
    {
        var employee = await db.Employees.FirstAsync(e => e.Id == action.EmployeeId, cancellationToken).ConfigureAwait(false);
        var by = $"{user.DisplayName} · {action.ActionNo}";
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
