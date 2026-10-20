using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Staff.Application;

public sealed record HireInput(string? NameAr, string NameEn, DateOnly HireDate, int ProbationDays, Guid? LegalEntityId, Guid? DepartmentId, Guid? PositionId, SalaryValues Salary);

public sealed record PersonalInput(string? NameAr, string NameEn, string? IdNumber, string? NationalityCode, DateOnly? BirthDate, string? Mobile, string? Email, string? GosiNo);

public sealed record JobInput(Guid? LegalEntityId, Guid? DepartmentId, Guid? PositionId, DateOnly? HireDate, DateOnly? ProbationEndsOn, string Status);

public sealed record PayDetailsInput(string? BankName, string? Iban, string? AccountHolder, DateOnly? GosiSince);

public sealed record ContractInput(DateOnly? StartsOn, int? Months, DateOnly? EndsOn);

public sealed record SalaryChangeInput(DateOnly EffectiveFrom, SalaryValues Salary, string Reason);

public sealed record ImportResult(int Created, int Updated, int Left);

/// <summary>
/// The staff's files: built from the old system's staff (again after each sync, without touching what HR set here),
/// a new hire, and the changes to a file — personal data, the job (registration, department, position, dates, status),
/// the contract dates, and a salary change from a date (the earlier salary stays as history).
/// </summary>
internal sealed class StaffService(
    StaffDbContext db,
    IStaffRecords oldSystem,
    IReferenceData reference,
    NumberSequenceService numbering,
    ICurrentUser user,
    IClock clock)
{
    /// <summary>Links a sign-in account to an employee (or unlinks it): one account, one employee.</summary>
    public async Task<Result> LinkUserAsync(Guid userId, Guid? employeeId, CancellationToken cancellationToken)
    {
        var current = await db.Employees.Where(e => e.UserId == userId).ToListAsync(cancellationToken).ConfigureAwait(false);
        StaffEmployee? target = null;
        if (employeeId is { } id)
        {
            target = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, cancellationToken).ConfigureAwait(false);
            if (target is null)
            {
                return Result.Failure(StaffErrors.NotFound);
            }

            if (target.UserId is { } other && other != userId)
            {
                return Result.Failure(StaffErrors.UserTaken);
            }
        }

        foreach (var e in current.Where(e => e.Id != employeeId))
        {
            e.LinkUser(null);
        }

        target?.LinkUser(userId);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<ImportResult> ImportAsync(CancellationToken cancellationToken)
    {
        var records = await oldSystem.StaffAsync(cancellationToken).ConfigureAwait(false);
        var files = await db.Employees.Where(e => e.WorkerId != null).ToDictionaryAsync(e => e.WorkerId!.Value, cancellationToken).ConfigureAwait(false);
        var ids = files.Values.Select(f => f.Id).ToList();
        var salaries = (await db.Salaries.Where(s => ids.Contains(s.EmployeeId)).ToListAsync(cancellationToken).ConfigureAwait(false))
            .GroupBy(s => s.EmployeeId).ToDictionary(g => g.Key, g => g.ToList());
        var now = clock.UtcNow;
        int created = 0, updated = 0, left = 0;
        foreach (var r in records)
        {
            if (!files.TryGetValue(r.WorkerId, out var file))
            {
                file = StaffEmployee.FromOldSystem(r.WorkerId, r.PersonId, r.EmployeeNo, now);
                db.Employees.Add(file);
                created++;
            }
            else
            {
                updated++;
            }

            var wasLeft = file.Status == StaffStatus.Left;
            file.Refresh(new OldSystemValues(
                r.NameEn, r.NameAr, r.IdNumber, r.NationalityCode, r.NationalityAr, r.NationalityEn, r.JoinedOn, r.ContractStartsOn, r.ContractMonths,
                r.ContractEndsOn, r.AnnualLeaveDays, r.LeaveBalance, r.LeaveConsumed, r.LeaveOldConsumed, r.LeaveRemaining, r.StatusAr, r.StatusEn, r.Active, r.Sponsor), now);
            if (!wasLeft && file.Status == StaffStatus.Left)
            {
                left++;
            }

            // The old system's salary: kept as it is there until HR changes it here.
            var values = new SalaryValues(r.Salary.Basic, r.Salary.Housing, r.Salary.Food, r.Salary.Transport, r.Mobile, r.Project, r.Salary.Other);
            var mine = salaries.GetValueOrDefault(file.Id) ?? [];
            if (mine.Count == 0)
            {
                if (values.Basic + values.Housing + values.Food + values.Transport + values.Mobile + values.Project + values.Other > 0)
                {
                    db.Salaries.Add(StaffSalary.Create(file.Id, r.JoinedOn ?? r.ContractStartsOn ?? clock.Today, values, SalarySource.OldSystem, null, "النظام القديم", now).Value);
                }
            }
            else if (mine.Count == 1 && mine[0].Source == SalarySource.OldSystem && !mine[0].Same(values))
            {
                mine[0].Follow(values);
            }
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return new ImportResult(created, updated, left);
    }

    public async Task<Result<Guid>> HireAsync(HireInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (string.IsNullOrWhiteSpace(input.NameEn) && string.IsNullOrWhiteSpace(input.NameAr))
        {
            return Result.Failure<Guid>(StaffErrors.Name);
        }

        if (input.ProbationDays is < 0 or > 180)
        {
            return Result.Failure<Guid>(StaffErrors.Value);
        }

        var placed = await CheckPlaceAsync(null, input.DepartmentId, input.PositionId, cancellationToken).ConfigureAwait(false);
        if (placed.IsFailure)
        {
            return Result.Failure<Guid>(placed.Error);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        // The old system's numbers share the sequence's pattern: a number already held is skipped.
        var number = await numbering.NextNumberAsync(db, "staff", input.HireDate, cancellationToken).ConfigureAwait(false);
        for (var tries = 0; tries < 1000 && await db.Employees.AnyAsync(e => e.EmployeeNo == number, cancellationToken).ConfigureAwait(false); tries++)
        {
            number = await numbering.NextNumberAsync(db, "staff", input.HireDate, cancellationToken).ConfigureAwait(false);
        }

        var employee = StaffEmployee.Hire(number, input.NameAr, string.IsNullOrWhiteSpace(input.NameEn) ? input.NameAr! : input.NameEn, input.HireDate, input.ProbationDays, user.DisplayName, clock.UtcNow);
        employee.SetJob(input.LegalEntityId, null, input.DepartmentId, input.PositionId, input.HireDate, employee.ProbationEndsOn, employee.Status);
        db.Employees.Add(employee);
        var salary = StaffSalary.Create(employee.Id, input.HireDate, input.Salary, SalarySource.Hire, null, user.DisplayName, clock.UtcNow);
        if (salary.IsFailure)
        {
            return Result.Failure<Guid>(salary.Error);
        }

        db.Salaries.Add(salary.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(employee.Id);
    }

    public async Task<Result> SetPersonalAsync(Guid id, PersonalInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var employee = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, cancellationToken).ConfigureAwait(false);
        if (employee is null)
        {
            return Result.Failure(StaffErrors.NotFound);
        }

        ReferenceItemInfo? nationality = null;
        if (!string.IsNullOrWhiteSpace(input.NationalityCode))
        {
            nationality = (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false))
                .FirstOrDefault(n => n.Code == input.NationalityCode.Trim());
            if (nationality is null)
            {
                return Result.Failure(StaffErrors.Value);
            }
        }

        var set = employee.SetPersonal(input.NameAr, input.NameEn, input.IdNumber, nationality?.Code, nationality?.NameAr, nationality?.NameEn, input.BirthDate, input.Mobile, input.Email, input.GosiNo);
        if (set.IsFailure)
        {
            return set;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>The bank the salary goes to and the GOSI start (each change is in the file's audited history).</summary>
    public async Task<Result> SetPayDetailsAsync(Guid id, PayDetailsInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var employee = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, cancellationToken).ConfigureAwait(false);
        if (employee is null)
        {
            return Result.Failure(StaffErrors.NotFound);
        }

        var set = employee.SetBank(input.BankName, input.Iban, input.AccountHolder);
        if (set.IsFailure)
        {
            return set;
        }

        employee.SetGosiSince(input.GosiSince);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> SetJobAsync(Guid id, JobInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var employee = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, cancellationToken).ConfigureAwait(false);
        if (employee is null)
        {
            return Result.Failure(StaffErrors.NotFound);
        }

        if (!Enum.TryParse<StaffStatus>(input.Status, out var status))
        {
            return Result.Failure(StaffErrors.Value);
        }

        var placed = await CheckPlaceAsync(id, input.DepartmentId, input.PositionId, cancellationToken).ConfigureAwait(false);
        if (placed.IsFailure)
        {
            return placed;
        }

        employee.SetJob(input.LegalEntityId, employee.BranchId, input.DepartmentId, input.PositionId, input.HireDate, input.ProbationEndsOn, status);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> SetContractAsync(Guid id, ContractInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var employee = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, cancellationToken).ConfigureAwait(false);
        if (employee is null)
        {
            return Result.Failure(StaffErrors.NotFound);
        }

        var set = employee.SetContract(input.StartsOn, input.Months, input.EndsOn);
        if (set.IsFailure)
        {
            return set;
        }

        // The active contract follows the file's terms (made the first time they are set here).
        if (employee.ContractStartsOn is { } start)
        {
            var kind = employee.ContractEndsOn is null ? ContractKind.Open : ContractKind.Fixed;
            var active = await db.Contracts.Where(c => c.EmployeeId == id && c.Status == ContractStatus.Active).OrderByDescending(c => c.StartsOn)
                .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
            if (active is null)
            {
                var created = StaffContract.Create(id, kind, start, employee.ContractMonths, employee.ContractEndsOn, 90, 30, null, null, null, user.DisplayName, clock.UtcNow);
                if (created.IsFailure)
                {
                    return Result.Failure(created.Error);
                }

                db.Contracts.Add(created.Value);
            }
            else
            {
                var corrected = active.Correct(kind, start, employee.ContractMonths, employee.ContractEndsOn);
                if (corrected.IsFailure)
                {
                    return corrected;
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>A new salary from a date after the current one's; the current one stays as history.</summary>
    public async Task<Result> ChangeSalaryAsync(Guid id, SalaryChangeInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!await db.Employees.AnyAsync(e => e.Id == id, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(StaffErrors.NotFound);
        }

        var current = await db.Salaries.Where(s => s.EmployeeId == id).OrderByDescending(s => s.EffectiveFrom).ThenByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (current is not null && input.EffectiveFrom <= current.EffectiveFrom)
        {
            return Result.Failure(StaffErrors.SalaryDate);
        }

        var salary = StaffSalary.Create(id, input.EffectiveFrom, input.Salary, SalarySource.Change, input.Reason, user.DisplayName, clock.UtcNow);
        if (salary.IsFailure)
        {
            return salary;
        }

        db.Salaries.Add(salary.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>The position is in the department and has a free seat (the employee's own seat counts as free).</summary>
    private async Task<Result> CheckPlaceAsync(Guid? employeeId, Guid? departmentId, Guid? positionId, CancellationToken cancellationToken)
    {
        if (departmentId is { } d && !await db.Departments.AnyAsync(x => x.Id == d, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(StaffErrors.DepartmentNotFound);
        }

        if (positionId is not { } p)
        {
            return Result.Success();
        }

        var position = await db.Positions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == p, cancellationToken).ConfigureAwait(false);
        if (position is null)
        {
            return Result.Failure(StaffErrors.PositionNotFound);
        }

        if (departmentId != position.DepartmentId)
        {
            return Result.Failure(StaffErrors.PositionElsewhere);
        }

        var taken = await db.Employees.CountAsync(e => e.PositionId == p && e.Id != employeeId && e.Status != StaffStatus.Left, cancellationToken).ConfigureAwait(false);
        return taken >= position.Seats ? Result.Failure(StaffErrors.PositionFull) : Result.Success();
    }
}
