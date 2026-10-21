using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Staff.Application;

public sealed record ActionRowDto(Guid Id, string ActionNo, Guid EmployeeId, string EmployeeName, string Kind, DateOnly EffectiveFrom, string Status, string CreatedByName, DateTimeOffset CreatedAt, DateTimeOffset? AppliedAt);

public sealed record PlaceDto(NamedRef? LegalEntity, NamedRef? Department, NamedRef? JobTitle, string? Grade);

public sealed record ActionDto(
    Guid Id,
    string ActionNo,
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeNo,
    string Kind,
    DateOnly EffectiveFrom,
    string Reason,
    string Status,
    bool AwaitingApproval,
    PlaceDto Before,
    PlaceDto After,
    decimal? OldSalaryTotal,
    SalaryValues? NewSalary,
    decimal? NewSalaryTotal,
    decimal? ActingAllowance,
    DateOnly? ActingUntil,
    DateOnly? OldProbationEndsOn,
    DateOnly? NewProbationEndsOn,
    DateOnly? OldContractEndsOn,
    string? NewContractKind,
    int? NewContractMonths,
    DateOnly? NewContractEndsOn,
    string CreatedByName,
    DateTimeOffset CreatedAt,
    DateTimeOffset? AppliedAt,
    string? LastComment,
    bool CanResubmit,
    bool CanSeeSalary,
    ApprovalStatusInfo? Approval,
    bool CanAmend = false,
    bool CanCancelApproved = false,
    DateTimeOffset? AmendedAt = null,
    string? AmendedByName = null,
    string? AmendNote = null,
    DateTimeOffset? CanceledAt = null,
    string? CanceledByName = null);

public sealed record ContractDto(Guid Id, string Kind, DateOnly StartsOn, int? Months, DateOnly? EndsOn, int ProbationDays, int NoticeDays, string Status, Guid? ActionId, string? Notes, string CreatedByName, DateTimeOffset CreatedAt);

/// <summary>The employment actions (all, or one employee's), one action with what it changes, and an employee's contracts.</summary>
internal sealed class StaffActionQueries(StaffDbContext db, IApprovalService approvals, ILegalEntityDirectory legalEntities, IPermissionService permissions)
{
    public async Task<IReadOnlyList<ActionRowDto>> ListAsync(Guid? employeeId, string? status, CancellationToken cancellationToken)
    {
        var actions = db.Actions.AsNoTracking();
        if (employeeId is { } e)
        {
            actions = actions.Where(a => a.EmployeeId == e);
        }

        if (Enum.TryParse<StaffActionStatus>(status, out var s))
        {
            actions = actions.Where(a => a.Status == s);
        }

        return await actions.OrderByDescending(a => a.CreatedAt).Take(500)
            .Select(a => new ActionRowDto(a.Id, a.ActionNo, a.EmployeeId, a.EmployeeName, a.Kind.ToString(), a.EffectiveFrom, a.Status.ToString(), a.CreatedByName, a.CreatedAt, a.AppliedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<ActionDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var a = await db.Actions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (a is null)
        {
            return null;
        }

        var employeeNo = await db.Employees.AsNoTracking().Where(e => e.Id == a.EmployeeId).Select(e => e.EmployeeNo).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false) ?? "—";
        var departments = await db.Departments.AsNoTracking().ToDictionaryAsync(d => d.Id, cancellationToken).ConfigureAwait(false);
        var positions = await db.Positions.AsNoTracking().ToDictionaryAsync(p => p.Id, cancellationToken).ConfigureAwait(false);
        var titles = await db.JobTitles.AsNoTracking().ToDictionaryAsync(t => t.Id, cancellationToken).ConfigureAwait(false);
        var grades = await db.Grades.AsNoTracking().ToDictionaryAsync(g => g.Id, cancellationToken).ConfigureAwait(false);
        var entities = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).ToDictionary(e => e.Id);
        PlaceDto Place(Guid? legalEntity, Guid? department, Guid? position)
        {
            var p = position is { } pid ? positions.GetValueOrDefault(pid) : null;
            var t = p is not null ? titles.GetValueOrDefault(p.JobTitleId) : null;
            var g = p?.GradeId is { } gid ? grades.GetValueOrDefault(gid) : null;
            var d = department is { } did ? departments.GetValueOrDefault(did) : null;
            var le = legalEntity is { } lid ? entities.GetValueOrDefault(lid) : null;
            return new PlaceDto(
                le is null ? null : new NamedRef(le.Id, le.NameAr, le.NameEn), d is null ? null : new NamedRef(d.Id, d.NameAr, d.NameEn),
                t is null ? null : new NamedRef(t.Id, t.NameAr, t.NameEn), g is null ? null : $"{g.Code} · {g.NameAr}");
        }

        var before = Place(a.OldLegalEntityId, a.OldDepartmentId, a.OldPositionId);
        var after = Place(a.NewLegalEntityId ?? a.OldLegalEntityId, a.NewDepartmentId ?? a.OldDepartmentId, a.NewPositionId ?? (a.NewDepartmentId is null || a.NewDepartmentId == a.OldDepartmentId ? a.OldPositionId : null));
        var seeSalary = (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(StaffPermissions.SalariesView);
        var s = a.NewSalary;
        var approval = await approvals.StatusAsync(StaffActionAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        var granted = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        var canManage = granted.Has(StaffPermissions.Manage);
        return new ActionDto(
            a.Id, a.ActionNo, a.EmployeeId, a.EmployeeName, employeeNo, a.Kind.ToString(), a.EffectiveFrom, a.Reason, a.Status.ToString(), a.AwaitingApproval,
            before, after, seeSalary ? a.OldSalaryTotal : null, seeSalary ? s : null,
            seeSalary && s is not null ? s.Basic + s.Housing + s.Food + s.Transport + s.Mobile + s.Project + s.Other : null,
            seeSalary ? a.ActingAllowance : null, a.ActingUntil, a.OldProbationEndsOn, a.NewProbationEndsOn, a.OldContractEndsOn,
            a.NewContractKind?.ToString(), a.NewContractMonths, a.NewContractEndsOn,
            a.CreatedByName, a.CreatedAt, a.AppliedAt, a.LastComment, canManage && a.Status == StaffActionStatus.Returned, seeSalary, approval,
            CanAmend: a.IsAmendable && granted.Has(StaffPermissions.ActionAmend(a.Kind)),
            CanCancelApproved: a.IsAmendable && granted.Has(StaffPermissions.ActionCancelApproved(a.Kind)),
            AmendedAt: a.AmendedAt,
            AmendedByName: a.AmendedByName,
            AmendNote: a.AmendNote,
            CanceledAt: a.CanceledAt,
            CanceledByName: a.CanceledByName);
    }

    public async Task<IReadOnlyList<ContractDto>> ContractsAsync(Guid employeeId, CancellationToken cancellationToken) =>
        await db.Contracts.AsNoTracking().Where(c => c.EmployeeId == employeeId).OrderByDescending(c => c.StartsOn)
            .Select(c => new ContractDto(c.Id, c.Kind.ToString(), c.StartsOn, c.Months, c.EndsOn, c.ProbationDays, c.NoticeDays, c.Status.ToString(), c.ActionId, c.Notes, c.CreatedByName, c.CreatedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
}
