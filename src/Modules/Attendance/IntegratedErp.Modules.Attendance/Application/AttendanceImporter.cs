using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Attendance.Domain;
using IntegratedErp.Modules.Attendance.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Attendance.Application;

/// <summary>A row the import refuses or warns about: unknown_employee, not_employed, duplicate, bad_time.</summary>
public sealed record ImportProblem(int Row, string Key, string? Name, DateOnly Date, TimeOnly? In, TimeOnly? Out, string Code, bool Rejected);

/// <summary>An employee number in the file that matches no one, with how many rows carry it.</summary>
public sealed record UnmatchedKey(string Key, string? Name, int Rows);

public sealed record ImportPreview(
    string MatchBy,
    IReadOnlyList<FileColumn> Columns,
    IReadOnlyDictionary<string, string> Mapping,
    int Rows,
    int Accepted,
    int Rejected,
    int Warnings,
    int Skipped,
    int Employees,
    DateOnly? From,
    DateOnly? To,
    IReadOnlyList<ImportProblem> Problems,
    IReadOnlyList<UnmatchedKey> Unmatched,
    Guid? ImportId);

/// <summary>
/// Imports a fingerprint file in two steps, both from the same upload: the preview reads it and says what it would do;
/// the apply writes the accepted rows as days. Each row is matched to an employee by the number the settings name (ID
/// number, employee number or fingerprint number). Importing a period again replaces what the file said and keeps what
/// HR corrected.
/// </summary>
internal sealed class AttendanceImporter(AttendanceDbContext db, IStaffDirectory staff, AttendanceSetup setup, ICurrentUser user, IClock clock)
{
    public async Task<Result<ImportPreview>> PreviewAsync(Stream content, IReadOnlyDictionary<string, string>? mapping, CancellationToken cancellationToken)
    {
        var (preview, _, _) = await AnalyseAsync(content, mapping, cancellationToken).ConfigureAwait(false);
        return preview is null ? Result.Failure<ImportPreview>(AttendanceErrors.File) : Result.Success(preview);
    }

    public async Task<Result<ImportPreview>> ApplyAsync(Stream content, IReadOnlyDictionary<string, string>? mapping, string fileName, CancellationToken cancellationToken)
    {
        var (preview, accepted, setting) = await AnalyseAsync(content, mapping, cancellationToken).ConfigureAwait(false);
        if (preview is null || accepted.Count == 0)
        {
            return Result.Failure<ImportPreview>(AttendanceErrors.File);
        }

        var from = accepted.Min(a => a.Row.Date);
        var to = accepted.Max(a => a.Row.Date);
        var import = AttendanceImport.Create(
            fileName, from, to, preview.Rows, preview.Accepted, preview.Rejected, preview.Employees,
            JsonSerializer.Serialize(preview.Problems.Take(2000)), user.DisplayName, clock.UtcNow);
        db.Imports.Add(import);

        var ids = accepted.Select(a => a.EmployeeId).Distinct().ToList();
        var stored = await db.Days.Where(d => d.Date >= from && d.Date <= to && ids.Contains(d.EmployeeId)).ToDictionaryAsync(d => (d.EmployeeId, d.Date), cancellationToken).ConfigureAwait(false);
        foreach (var (row, employeeId) in accepted)
        {
            if (!stored.TryGetValue((employeeId, row.Date), out var day))
            {
                day = AttendanceDay.For(employeeId, row.Date);
                db.Days.Add(day);
                stored[(employeeId, row.Date)] = day;
            }

            day.FromDevice(row.In, row.Out, row.Status, AttendanceFile.Mark(row.Status), row.PermissionMinutes, row.LateMinutes, row.EarlyMinutes, import.Id);
        }

        setting.RememberColumns(JsonSerializer.Serialize(preview.Mapping));
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(preview with { ImportId = import.Id });
    }

    private async Task<(ImportPreview? Preview, List<(FileRow Row, Guid EmployeeId)> Accepted, AttendanceSetting Setting)> AnalyseAsync(
        Stream content, IReadOnlyDictionary<string, string>? mapping, CancellationToken cancellationToken)
    {
        var setting = await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        if (mapping is null || mapping.Count == 0)
        {
            mapping = JsonSerializer.Deserialize<Dictionary<string, string>>(string.IsNullOrWhiteSpace(setting.Columns) ? "{}" : setting.Columns);
        }

        ParsedFile file;
        try
        {
            file = AttendanceFile.Read(content, mapping);
        }
        catch (Exception e) when (e is InvalidDataException or ArgumentException or InvalidOperationException or FormatException or IOException)
        {
            return (null, [], setting);
        }

        if (file.Rows.Count == 0)
        {
            return (null, [], setting);
        }

        var members = await staff.MembersAsync(cancellationToken).ConfigureAwait(false);
        var keys = new Dictionary<string, StaffMember>(StringComparer.OrdinalIgnoreCase);
        if (setting.MatchBy == MatchBy.BadgeNo)
        {
            var badges = await db.EmployeeSettings.AsNoTracking().Where(s => s.BadgeNo != null).ToListAsync(cancellationToken).ConfigureAwait(false);
            var byId = members.ToDictionary(m => m.Id);
            foreach (var b in badges)
            {
                if (byId.TryGetValue(b.EmployeeId, out var m))
                {
                    keys.TryAdd(b.BadgeNo!, m);
                }
            }
        }
        else
        {
            // Prefer the current file when two share a number (a re-hire keeps the old file as Left).
            foreach (var m in members.OrderBy(m => m.Status == "Left" ? 1 : 0))
            {
                var key = setting.MatchBy == MatchBy.IdNumber ? m.IdNumber?.Trim() : m.EmployeeNo.Trim();
                if (!string.IsNullOrEmpty(key))
                {
                    keys.TryAdd(key, m);
                }
            }
        }

        var problems = new List<ImportProblem>();
        var accepted = new List<(FileRow, Guid)>();
        var seen = new HashSet<(Guid, DateOnly)>();
        var unmatched = new Dictionary<string, (string? Name, int Rows)>();
        int skipped = 0;
        foreach (var row in file.Rows)
        {
            if (row.NoData)
            {
                skipped++;
                continue;
            }

            if (!keys.TryGetValue(row.Key.Trim(), out var m))
            {
                problems.Add(new ImportProblem(row.RowNo, row.Key, row.Name, row.Date, row.In, row.Out, "unknown_employee", true));
                unmatched[row.Key] = (row.Name, unmatched.TryGetValue(row.Key, out var u) ? u.Rows + 1 : 1);
                continue;
            }

            if (!AttendanceBook.Employed(m, row.Date))
            {
                problems.Add(new ImportProblem(row.RowNo, row.Key, row.Name ?? m.NameAr, row.Date, row.In, row.Out, "not_employed", true));
                continue;
            }

            if (!seen.Add((m.Id, row.Date)))
            {
                problems.Add(new ImportProblem(row.RowNo, row.Key, row.Name ?? m.NameAr, row.Date, row.In, row.Out, "duplicate", false));
                continue;
            }

            if (row.BadTime)
            {
                problems.Add(new ImportProblem(row.RowNo, row.Key, row.Name ?? m.NameAr, row.Date, row.In, row.Out, "bad_time", false));
            }

            accepted.Add((row, m.Id));
        }

        var rejected = problems.Count(p => p.Rejected);
        var preview = new ImportPreview(
            setting.MatchBy.ToString(),
            file.Columns,
            file.Mapping,
            file.Rows.Count,
            accepted.Count,
            rejected,
            problems.Count - rejected,
            skipped,
            accepted.Select(a => a.Item2).Distinct().Count(),
            accepted.Count > 0 ? accepted.Min(a => a.Item1.Date) : null,
            accepted.Count > 0 ? accepted.Max(a => a.Item1.Date) : null,
            problems.OrderBy(p => p.Rejected ? 0 : 1).ThenBy(p => p.Row).Take(500).ToList(),
            unmatched.Select(u => new UnmatchedKey(u.Key, u.Value.Name, u.Value.Rows)).OrderByDescending(u => u.Rows).ToList(),
            null);
        return (preview, accepted, setting);
    }
}
