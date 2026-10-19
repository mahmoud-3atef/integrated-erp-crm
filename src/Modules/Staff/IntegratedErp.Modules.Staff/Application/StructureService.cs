using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Staff.Application;

public sealed record DepartmentInput(string NameAr, string? NameEn, Guid? ParentId, string? CostCenter, Guid? ManagerId, int SortOrder, bool IsActive = true);

public sealed record JobTitleInput(string NameAr, string? NameEn, string? OccupationCode, bool IsActive = true);

public sealed record GradeInput(string Code, string NameAr, decimal? MinBasic, decimal? MaxBasic, bool IsActive = true);

public sealed record PositionInput(Guid DepartmentId, Guid JobTitleId, Guid? GradeId, Guid? ReportsToId, int Seats, bool IsActive = true);

/// <summary>
/// The organisation HR builds: departments (a tree), the job titles and grades catalogues, and the positions (seats)
/// of each department. A department, title, grade or position in use cannot be deleted (deactivate it instead).
/// </summary>
internal sealed class StructureService(StaffDbContext db)
{
    public async Task<Result<Guid>> SaveDepartmentAsync(Guid? id, DepartmentInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (input.ParentId is { } parent)
        {
            if (!await db.Departments.AnyAsync(d => d.Id == parent, cancellationToken).ConfigureAwait(false))
            {
                return Result.Failure<Guid>(StaffErrors.DepartmentNotFound);
            }

            if (id is { } self && await IsUnderAsync(parent, self, cancellationToken).ConfigureAwait(false))
            {
                return Result.Failure<Guid>(StaffErrors.ParentLoop);
            }
        }

        if (input.ManagerId is { } manager && !await db.Employees.AnyAsync(e => e.Id == manager, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(StaffErrors.NotFound);
        }

        if (id is null)
        {
            var created = Department.Create(input.NameAr, input.NameEn ?? string.Empty, input.ParentId, input.CostCenter, input.ManagerId, input.SortOrder);
            if (created.IsFailure)
            {
                return Result.Failure<Guid>(created.Error);
            }

            db.Departments.Add(created.Value);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Success(created.Value.Id);
        }

        var department = await db.Departments.FirstOrDefaultAsync(d => d.Id == id, cancellationToken).ConfigureAwait(false);
        if (department is null)
        {
            return Result.Failure<Guid>(StaffErrors.DepartmentNotFound);
        }

        var set = department.Set(input.NameAr, input.NameEn ?? string.Empty, input.ParentId, input.CostCenter, input.ManagerId, input.SortOrder, input.IsActive);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(department.Id);
    }

    public async Task<Result> DeleteDepartmentAsync(Guid id, CancellationToken cancellationToken)
    {
        var department = await db.Departments.FirstOrDefaultAsync(d => d.Id == id, cancellationToken).ConfigureAwait(false);
        if (department is null)
        {
            return Result.Failure(StaffErrors.DepartmentNotFound);
        }

        if (await db.Departments.AnyAsync(d => d.ParentId == id, cancellationToken).ConfigureAwait(false)
            || await db.Positions.AnyAsync(p => p.DepartmentId == id, cancellationToken).ConfigureAwait(false)
            || await db.Employees.AnyAsync(e => e.DepartmentId == id, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(StaffErrors.InUse);
        }

        db.Departments.Remove(department);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result<Guid>> SaveJobTitleAsync(Guid? id, JobTitleInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (id is null)
        {
            var created = JobTitle.Create(input.NameAr, input.NameEn ?? string.Empty, input.OccupationCode);
            if (created.IsFailure)
            {
                return Result.Failure<Guid>(created.Error);
            }

            db.JobTitles.Add(created.Value);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Success(created.Value.Id);
        }

        var title = await db.JobTitles.FirstOrDefaultAsync(j => j.Id == id, cancellationToken).ConfigureAwait(false);
        if (title is null)
        {
            return Result.Failure<Guid>(StaffErrors.JobTitleNotFound);
        }

        var set = title.Set(input.NameAr, input.NameEn ?? string.Empty, input.OccupationCode, input.IsActive);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(title.Id);
    }

    public async Task<Result<Guid>> SaveGradeAsync(Guid? id, GradeInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Grades.AnyAsync(g => g.Code == input.Code.Trim() && g.Id != id, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(Error.Conflict("staff_grade_code_taken", "Another grade has this code."));
        }

        if (id is null)
        {
            var created = Grade.Create(input.Code, input.NameAr, input.MinBasic, input.MaxBasic);
            if (created.IsFailure)
            {
                return Result.Failure<Guid>(created.Error);
            }

            db.Grades.Add(created.Value);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Success(created.Value.Id);
        }

        var grade = await db.Grades.FirstOrDefaultAsync(g => g.Id == id, cancellationToken).ConfigureAwait(false);
        if (grade is null)
        {
            return Result.Failure<Guid>(StaffErrors.GradeNotFound);
        }

        var set = grade.Set(input.Code, input.NameAr, input.MinBasic, input.MaxBasic, input.IsActive);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(grade.Id);
    }

    public async Task<Result<Guid>> SavePositionAsync(Guid? id, PositionInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!await db.Departments.AnyAsync(d => d.Id == input.DepartmentId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(StaffErrors.DepartmentNotFound);
        }

        if (!await db.JobTitles.AnyAsync(j => j.Id == input.JobTitleId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(StaffErrors.JobTitleNotFound);
        }

        if (input.GradeId is { } g && !await db.Grades.AnyAsync(x => x.Id == g, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(StaffErrors.GradeNotFound);
        }

        if (input.ReportsToId is { } r && !await db.Positions.AnyAsync(x => x.Id == r, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(StaffErrors.PositionNotFound);
        }

        if (id is null)
        {
            var created = Position.Create(input.DepartmentId, input.JobTitleId, input.GradeId, input.ReportsToId, input.Seats);
            if (created.IsFailure)
            {
                return Result.Failure<Guid>(created.Error);
            }

            db.Positions.Add(created.Value);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Success(created.Value.Id);
        }

        var position = await db.Positions.FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false);
        if (position is null)
        {
            return Result.Failure<Guid>(StaffErrors.PositionNotFound);
        }

        var taken = await db.Employees.CountAsync(e => e.PositionId == id && e.Status != StaffStatus.Left, cancellationToken).ConfigureAwait(false);
        if (input.Seats < taken || (position.DepartmentId != input.DepartmentId && taken > 0))
        {
            return Result.Failure<Guid>(StaffErrors.InUse);
        }

        var set = position.Set(input.DepartmentId, input.JobTitleId, input.GradeId, input.ReportsToId, input.Seats, input.IsActive);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(position.Id);
    }

    public async Task<Result> DeletePositionAsync(Guid id, CancellationToken cancellationToken)
    {
        var position = await db.Positions.FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false);
        if (position is null)
        {
            return Result.Failure(StaffErrors.PositionNotFound);
        }

        if (await db.Employees.AnyAsync(e => e.PositionId == id, cancellationToken).ConfigureAwait(false)
            || await db.Positions.AnyAsync(p => p.ReportsToId == id, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(StaffErrors.InUse);
        }

        db.Positions.Remove(position);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>Whether <paramref name="candidate"/> is <paramref name="department"/> itself or below it.</summary>
    private async Task<bool> IsUnderAsync(Guid candidate, Guid department, CancellationToken cancellationToken)
    {
        var parents = await db.Departments.AsNoTracking().ToDictionaryAsync(d => d.Id, d => d.ParentId, cancellationToken).ConfigureAwait(false);
        for (Guid? at = candidate; at is { } current; at = parents.GetValueOrDefault(current))
        {
            if (current == department)
            {
                return true;
            }
        }

        return false;
    }
}
