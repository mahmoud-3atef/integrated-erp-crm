using System.Globalization;
using ClosedXML.Excel;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Leave.Domain;
using IntegratedErp.Modules.Leave.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Leave.Application;

public sealed record EntryInput(Guid LeaveTypeId, DateOnly Date, decimal Days, string Reason);

public sealed record AccrualResult(string Period, int Employees, decimal Days, int Skipped);

public sealed record CarryOverResult(int Year, int Employees, decimal Days);

public sealed record OpeningRow(int Row, string Key, string? Name, decimal? Days, string? Problem);

public sealed record OpeningImportResult(int Rows, int Accepted, int Rejected, bool Applied, IReadOnlyList<OpeningRow> Problems);

/// <summary>An employee's balance of a type: what accrued and was given, what was taken, and what requests hold.</summary>
public sealed record Balance(decimal Entries, decimal Reserved)
{
    public decimal Available => Entries - Reserved;
}

/// <summary>
/// Balances as entries: the opening balance (from the employee's screen or an Excel file), the monthly accrual (the
/// yearly days ÷ 12 from the hire date, the senior days after the years of service), the consumption of an approved
/// leave, the carry-over at the year's end (only when the company sets a limit), and adjustments with their reason.
/// </summary>
internal sealed class LeaveBalances(LeaveDbContext db, IStaffDirectory staff, LeaveSetup setup, ICurrentUser user, IClock clock)
{
    public async Task<Balance> BalanceAsync(Guid employeeId, Guid typeId, Guid? excludingRequest, CancellationToken cancellationToken)
    {
        var entries = await db.Entries.AsNoTracking().Where(e => e.EmployeeId == employeeId && e.LeaveTypeId == typeId).SumAsync(e => (decimal?)e.Days, cancellationToken).ConfigureAwait(false) ?? 0;
        var reserved = await db.Requests.AsNoTracking()
            .Where(r => r.EmployeeId == employeeId && r.LeaveTypeId == typeId && r.Status == RequestStatus.InApproval && r.Id != excludingRequest)
            .SumAsync(r => (decimal?)r.Days, cancellationToken).ConfigureAwait(false) ?? 0;
        return new Balance(entries, reserved);
    }

    public async Task<Result> AddAsync(Guid employeeId, EntryKind kind, EntryInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (kind is not (EntryKind.Opening or EntryKind.Adjustment) || input.Days == 0 || Math.Abs(input.Days) > 999 || string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Trim().Length > 300
            || (kind == EntryKind.Opening && input.Days < 0))
        {
            return Result.Failure(LeaveErrors.Entry);
        }

        if ((await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).All(m => m.Id != employeeId))
        {
            return Result.Failure(LeaveErrors.EmployeeNotFound);
        }

        if (await db.Types.AsNoTracking().FirstOrDefaultAsync(t => t.Id == input.LeaveTypeId, cancellationToken).ConfigureAwait(false) is not { HasBalance: true })
        {
            return Result.Failure(LeaveErrors.TypeNotFound);
        }

        if (kind == EntryKind.Opening && await db.Entries.AnyAsync(e => e.EmployeeId == employeeId && e.LeaveTypeId == input.LeaveTypeId && e.Kind == EntryKind.Opening, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(LeaveErrors.OpeningExists);
        }

        db.Entries.Add(BalanceEntry.Of(employeeId, input.LeaveTypeId, input.Date, kind, input.Days, input.Reason.Trim(), null, null, user.DisplayName, clock.UtcNow));
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>The month's accrual for every employee and balance type (run again, it adds nothing).</summary>
    public async Task<Result<AccrualResult>> AccrueAsync(string period, CancellationToken cancellationToken)
    {
        if (!TryPeriod(period, out var first))
        {
            return Result.Failure<AccrualResult>(LeaveErrors.Entry);
        }

        await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        var last = first.AddMonths(1).AddDays(-1);
        var types = await db.Types.AsNoTracking().Where(t => t.HasBalance && t.IsActive).ToListAsync(cancellationToken).ConfigureAwait(false);
        var members = await staff.MembersAsync(cancellationToken).ConfigureAwait(false);
        var existing = await db.Entries.AsNoTracking().Where(e => e.Period == period).Select(e => new { e.EmployeeId, e.LeaveTypeId }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var openings = await db.Entries.AsNoTracking().Where(e => e.Kind == EntryKind.Opening).Select(e => new { e.EmployeeId, e.LeaveTypeId, e.Date }).ToListAsync(cancellationToken).ConfigureAwait(false);
        int employees = 0, skipped = 0;
        decimal total = 0;
        foreach (var m in members)
        {
            if (m.HireDate is not { } hired || hired > last || (m.EndedOn is { } ended ? ended < first : m.Status == "Left"))
            {
                continue;
            }

            var added = false;
            foreach (var t in types)
            {
                if (existing.Any(e => e.EmployeeId == m.Id && e.LeaveTypeId == t.Id))
                {
                    skipped++;
                    continue;
                }

                // The days in the month the accrual covers: from the hire date or the opening balance's date, to the end of service.
                var from = hired > first ? hired : first;
                if (openings.FirstOrDefault(o => o.EmployeeId == m.Id && o.LeaveTypeId == t.Id) is { } opening && opening.Date > from)
                {
                    from = opening.Date;
                }

                var to = m.EndedOn is { } end && end < last ? end : last;
                if (to < from)
                {
                    continue;
                }

                var share = (decimal)(to.DayNumber - from.DayNumber + 1) / (last.DayNumber - first.DayNumber + 1);
                var years = (last.DayNumber - hired.DayNumber) / 365.25;
                var days = decimal.Round(t.Entitlement(years) / 12 * share, 2);
                if (days <= 0)
                {
                    continue;
                }

                db.Entries.Add(BalanceEntry.Of(m.Id, t.Id, last, EntryKind.Accrual, days, $"استحقاق {Months[first.Month - 1]} {first.Year}", period, null, user.DisplayName, clock.UtcNow));
                total += days;
                added = true;
            }

            employees += added ? 1 : 0;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(new AccrualResult(period, employees, total, skipped));
    }

    /// <summary>
    /// Every month not yet accrued, from the earliest opening balance (or January of the month's year) through the month:
    /// a missed month is caught up, and a month already accrued is not repeated.
    /// </summary>
    public async Task<Result<AccrualResult>> AccrueThroughAsync(string period, CancellationToken cancellationToken)
    {
        if (!TryPeriod(period, out var last))
        {
            return Result.Failure<AccrualResult>(LeaveErrors.Entry);
        }

        var earliest = await db.Entries.AsNoTracking().Where(e => e.Kind == EntryKind.Opening).MinAsync(e => (DateOnly?)e.Date, cancellationToken).ConfigureAwait(false);
        var start = earliest is { } d && d < last ? new DateOnly(d.Year, d.Month, 1) : new DateOnly(last.Year, 1, 1);
        int count = 0, skipped = 0;
        decimal days = 0;
        for (var m = start; m <= last; m = m.AddMonths(1))
        {
            var r = await AccrueAsync($"{m.Year:D4}-{m.Month:D2}", cancellationToken).ConfigureAwait(false);
            if (r.IsFailure)
            {
                return r;
            }

            count = Math.Max(count, r.Value.Employees);
            skipped += r.Value.Skipped;
            days += r.Value.Days;
        }

        return Result.Success(new AccrualResult(period, count, days, skipped));
    }

    /// <summary>The year's end: what is above the company's carry-over limit is forfeited (nothing when there is no limit).</summary>
    public async Task<Result<CarryOverResult>> CarryOverAsync(int year, CancellationToken cancellationToken)
    {
        var setting = await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        if (setting.CarryOverLimit is not { } limit)
        {
            return Result.Success(new CarryOverResult(year, 0, 0));
        }

        var end = new DateOnly(year, 12, 31);
        var key = $"{year}-CO";
        var types = await db.Types.AsNoTracking().Where(t => t.HasBalance).Select(t => t.Id).ToListAsync(cancellationToken).ConfigureAwait(false);
        var sums = await db.Entries.AsNoTracking().Where(e => types.Contains(e.LeaveTypeId) && e.Date <= end)
            .GroupBy(e => new { e.EmployeeId, e.LeaveTypeId }).Select(g => new { g.Key.EmployeeId, g.Key.LeaveTypeId, Days = g.Sum(e => e.Days) })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var done = await db.Entries.AsNoTracking().Where(e => e.Period == key).Select(e => new { e.EmployeeId, e.LeaveTypeId }).ToListAsync(cancellationToken).ConfigureAwait(false);
        int employees = 0;
        decimal total = 0;
        foreach (var s in sums.Where(s => s.Days > limit && !done.Any(d => d.EmployeeId == s.EmployeeId && d.LeaveTypeId == s.LeaveTypeId)))
        {
            var excess = s.Days - limit;
            db.Entries.Add(BalanceEntry.Of(s.EmployeeId, s.LeaveTypeId, end, EntryKind.CarryOver, -excess, $"ترحيل {year}: الحد {limit} يومًا", key, null, user.DisplayName, clock.UtcNow));
            employees++;
            total += excess;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(new CarryOverResult(year, employees, total));
    }

    /// <summary>
    /// Opening balances from Excel: a column of employee numbers (the employee number or the ID number) and one of days,
    /// as of a date. The preview applies nothing; an employee who already has an opening balance is refused.
    /// </summary>
    public async Task<Result<OpeningImportResult>> ImportOpeningsAsync(Stream content, Guid typeId, DateOnly asOf, bool apply, CancellationToken cancellationToken)
    {
        if (await db.Types.AsNoTracking().FirstOrDefaultAsync(t => t.Id == typeId, cancellationToken).ConfigureAwait(false) is not { HasBalance: true })
        {
            return Result.Failure<OpeningImportResult>(LeaveErrors.TypeNotFound);
        }

        List<(int Row, string Key, string? Name, string Days)> rows;
        try
        {
            rows = ReadOpenings(content);
        }
        catch (Exception e) when (e is InvalidDataException or ArgumentException or InvalidOperationException or FormatException or IOException)
        {
            return Result.Failure<OpeningImportResult>(LeaveErrors.Entry);
        }

        var members = await staff.MembersAsync(cancellationToken).ConfigureAwait(false);
        var withOpening = (await db.Entries.AsNoTracking().Where(e => e.LeaveTypeId == typeId && e.Kind == EntryKind.Opening).Select(e => e.EmployeeId).ToListAsync(cancellationToken).ConfigureAwait(false)).ToHashSet();
        var problems = new List<OpeningRow>();
        var accepted = new List<(Guid Employee, decimal Days)>();
        foreach (var r in rows)
        {
            var key = r.Key.Trim();
            var m = members.FirstOrDefault(x => string.Equals(x.EmployeeNo, key, StringComparison.OrdinalIgnoreCase)) ?? members.FirstOrDefault(x => x.IdNumber?.Trim() == key);
            var ok = decimal.TryParse(r.Days.Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out var days) && days >= 0 && days <= 999;
            string? problem = m is null ? "unknown_employee" : !ok ? "bad_days" : withOpening.Contains(m.Id) || accepted.Any(a => a.Employee == m.Id) ? "opening_exists" : null;
            if (problem is not null)
            {
                problems.Add(new OpeningRow(r.Row, key, r.Name ?? m?.NameAr ?? m?.NameEn, ok ? days : null, problem));
                continue;
            }

            accepted.Add((m!.Id, days));
        }

        if (apply)
        {
            foreach (var (employee, days) in accepted.Where(a => a.Days > 0))
            {
                db.Entries.Add(BalanceEntry.Of(employee, typeId, asOf, EntryKind.Opening, days, "رصيد افتتاحي (ملف Excel)", null, null, user.DisplayName, clock.UtcNow));
            }

            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return Result.Success(new OpeningImportResult(rows.Count, accepted.Count, problems.Count, apply, problems.Take(500).ToList()));
    }

    private static List<(int Row, string Key, string? Name, string Days)> ReadOpenings(Stream content)
    {
        using var workbook = new XLWorkbook(content);
        var sheet = workbook.Worksheets.First();
        var used = sheet.RangeUsed() ?? throw new InvalidDataException("empty");
        int header = 0, keyCol = 0, nameCol = 0, daysCol = 0;
        string[] keys = ["رقم الموظف", "الرقم الوظيفي", "رقم الهوية", "employeeno", "employee no", "id", "idnumber", "no"];
        string[] names = ["الاسم", "الإسم", "اسم الموظف", "name"];
        string[] dayNames = ["الرصيد", "الرصيد الافتتاحي", "الأيام", "رصيد الإجازة", "balance", "days", "opening"];
        for (var r = 1; r <= Math.Min(20, used.LastRow().RowNumber()) && header == 0; r++)
        {
            for (var c = 1; c <= used.LastColumn().ColumnNumber(); c++)
            {
                var h = sheet.Cell(r, c).GetString().Trim().ToLowerInvariant();
                keyCol = keyCol == 0 && keys.Contains(h) ? c : keyCol;
                nameCol = nameCol == 0 && names.Contains(h) ? c : nameCol;
                daysCol = daysCol == 0 && dayNames.Contains(h) ? c : daysCol;
            }

            if (keyCol > 0 && daysCol > 0)
            {
                header = r;
            }
            else
            {
                keyCol = nameCol = daysCol = 0;
            }
        }

        if (header == 0)
        {
            throw new InvalidDataException("no header");
        }

        var rows = new List<(int, string, string?, string)>();
        for (var r = header + 1; r <= used.LastRow().RowNumber(); r++)
        {
            var key = sheet.Cell(r, keyCol).GetFormattedString().Trim();
            if (key.Length == 0)
            {
                continue;
            }

            var cell = sheet.Cell(r, daysCol);
            var days = cell.DataType == XLDataType.Number ? cell.GetDouble().ToString(CultureInfo.InvariantCulture) : cell.GetString();
            rows.Add((r, key, nameCol > 0 ? sheet.Cell(r, nameCol).GetString().Trim() : null, days));
        }

        return rows;
    }

    private static readonly string[] Months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

    internal static bool TryPeriod(string period, out DateOnly first)
    {
        first = default;
        var parts = (period ?? string.Empty).Split('-');
        if (parts.Length == 2 && int.TryParse(parts[0], out var y) && int.TryParse(parts[1], out var m) && y is >= 2025 and <= 2100 && m is >= 1 and <= 12)
        {
            first = new DateOnly(y, m, 1);
            return true;
        }

        return false;
    }
}
