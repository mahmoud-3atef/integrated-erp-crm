using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Leave.Contracts;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>A payslip's amount: a stable code the page translates, with its reference (an advance, a penalty) or quantity (days, hours).</summary>
public sealed record PayslipItem(string Code, decimal Amount, string? Reference = null, decimal? Quantity = null, string? Note = null);

public sealed record PayslipAdvance(string AdvanceNo, decimal Remaining, int Installments);

public sealed record PayslipSource(string TimesheetNo, string ProjectName, DateOnly From, DateOnly To, decimal Days);

public sealed record PayslipDto(
    Guid LineId,
    Guid PersonId,
    string No,
    string Name,
    string? IdLast4,
    string? DepartmentAr,
    string? DepartmentEn,
    string? JobAr,
    string? JobEn,
    string? ProjectName,
    string? StatusAr,
    string? StatusEn,
    string? GosiNo,
    string GosiCategory,
    decimal ServiceDays,
    decimal PaidDays,
    decimal AbsenceDays,
    string? BankName,
    string? Iban,
    IReadOnlyList<PayslipItem> Earnings,
    IReadOnlyList<PayslipItem> Deductions,
    decimal TotalEarnings,
    decimal TotalDeductions,
    decimal Net,
    decimal GosiEmployer,
    IReadOnlyList<PayslipAdvance> Advances,
    decimal? LeaveBalance,
    decimal? LeaveTaken,
    IReadOnlyList<PayslipSource> Sources);

public sealed record PayslipBatchDto(
    string Kind,
    Guid RunId,
    string RunNo,
    string Status,
    bool Draft,
    string LegalEntityNameAr,
    string LegalEntityNameEn,
    string? CommercialRegistrationNo,
    DateOnly From,
    DateOnly To,
    DateTimeOffset? ApprovedAt,
    string? ApprovedByName,
    DateTimeOffset PrintedAt,
    string PrintedBy,
    int Total,
    IReadOnlyList<PayslipDto> Items);

/// <summary>The payslips' scope: one line, or the run's lines as its grid filters them (the same filters).</summary>
public sealed record PayslipQuery(Guid? Line, string? Search, Guid? Group, string? Note);

/// <summary>
/// Payslips (docs/03-migration-plan/13, 4.12): built from the run's saved lines (never recalculated), up to
/// <see cref="MaxPerRequest"/> at once; before approval marked as a draft. Each printing is recorded without amounts.
/// The ID number and the IBAN show only their last four digits.
/// </summary>
internal sealed class PayslipService(
    PayrollDbContext db,
    StaffPayrollQueries staffQueries,
    PayrollQueries workerQueries,
    IStaffPayroll staff,
    IStaffDeductions deductions,
    IEnumerable<ILeavePayroll> leave,
    IWorkforceDirectory workforce,
    ILegalEntityDirectory legalEntities,
    ICurrentUser user,
    IClock clock)
{
    public const int MaxPerRequest = 300;

    /// <summary>Null when the run is not found; the batch's <see cref="PayslipBatchDto.Total"/> says how many the scope holds.</summary>
    public Task<PayslipBatchDto?> StaffAsync(Guid runId, PayslipQuery q, CancellationToken cancellationToken) => StaffAsync(runId, q, MaxPerRequest, true, cancellationToken);

    /// <param name="max">How many payslips at most (the emails take the whole scope).</param>
    /// <param name="record">Records the printing (the emails record their own sending instead).</param>
    internal async Task<PayslipBatchDto?> StaffAsync(Guid runId, PayslipQuery q, int max, bool record, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(q);
        if (await staffQueries.ScopeAsync(runId, new StaffLineQuery(q.Search, q.Group, q.Note, null, false, 1, int.MaxValue), cancellationToken).ConfigureAwait(false) is not { } scope)
        {
            return null;
        }

        var run = scope.Run;
        var ids = q.Line is { } one ? scope.Lines.Where(l => l.Id == one).Select(l => l.Id).ToList() : scope.Lines.Select(l => l.Id).ToList();
        var take = ids.Take(max).ToList();
        var lines = await db.StaffLines.AsNoTracking().Include(l => l.Items).Where(l => take.Contains(l.Id)).ToListAsync(cancellationToken).ConfigureAwait(false);
        var order = take.Select((id, i) => (id, i)).ToDictionary(x => x.id, x => x.i);
        lines = lines.OrderBy(l => order[l.Id]).ToList();

        var people = (await staff.PayInfoAsync(run.From, run.To, cancellationToken).ConfigureAwait(false)).ToDictionary(p => p.EmployeeId);
        var advances = (await deductions.OutstandingAsync(cancellationToken).ConfigureAwait(false)).ToLookup(a => a.EmployeeId);
        var balances = new Dictionary<Guid, AnnualLeaveBalance>();
        foreach (var source in leave)
        {
            foreach (var b in await source.AnnualAsync(run.To, cancellationToken).ConfigureAwait(false))
            {
                balances[b.EmployeeId] = b;
            }
        }

        var items = lines.Select(l =>
        {
            people.TryGetValue(l.EmployeeId, out var p);
            var earnings = new List<PayslipItem> { new("basic", l.Basic), new("housing", l.Housing) };
            Add(earnings, "other", l.OtherAllowances);
            Add(earnings, "overtime", l.Overtime, quantity: l.OvertimeHours);
            foreach (var i in l.Items.Where(i => i.Kind == StaffItemKind.Addition))
            {
                earnings.Add(new PayslipItem("addition", i.Deducted, Note: i.Description));
            }

            Rest(earnings, "additions", l.Gross);

            var cuts = new List<PayslipItem>();
            Add(cuts, "absence", l.Absence, quantity: l.UnpaidDays);
            Add(cuts, "late", l.Late, quantity: l.LateMinutes);
            Add(cuts, "sick", l.SickPart, quantity: l.SickPartDays);
            foreach (var i in l.Items.Where(i => i.Kind is not (StaffItemKind.Addition or StaffItemKind.Suspension) && i.Deducted > 0).OrderBy(i => i.Kind))
            {
                cuts.Add(new PayslipItem(Code(i.Kind), i.Deducted, i.Kind == StaffItemKind.Deduction ? null : i.Reference, i.Kind == StaffItemKind.PenaltyDays ? i.Days : null, i.Kind == StaffItemKind.Deduction ? i.Description : null));
            }

            Add(cuts, "gosi", l.GosiEmployee);
            Rest(cuts, "otherDeductions", l.Deductions);
            balances.TryGetValue(l.EmployeeId, out var balance);
            return new PayslipDto(
                l.Id, l.EmployeeId, l.EmployeeNo, l.Name, Last4(p?.IdNumber), l.DepartmentAr, l.DepartmentEn, l.JobTitleAr, l.JobTitleEn, null, null, null,
                p?.GosiNo, l.GosiCategory, l.ServiceDays, l.PaidDays, l.UnpaidDays, l.BankName, MaskIban(l.Iban),
                earnings, cuts, l.Gross, l.Deductions, l.Net, l.GosiEmployer,
                advances[l.EmployeeId].Select(a => new PayslipAdvance(a.AdvanceNo, a.Remaining, a.Installments)).ToList(),
                balance?.Balance, balance?.TakenThisYear, []);
        }).ToList();

        return await BatchAsync("Staff", run.Id, run.RunNo, run.Status, run.LegalEntityId, run.From, run.To, run.ApprovedAt, run.ApprovedByName, ids.Count, items, q.Line is not null ? lines.FirstOrDefault()?.EmployeeId : null, record, cancellationToken).ConfigureAwait(false);
    }

    public async Task<PayslipBatchDto?> WorkersAsync(Guid runId, PayslipQuery q, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(q);
        if (await workerQueries.ScopeAsync(runId, new LineQuery(q.Search, q.Note, q.Group, null, false, 1, int.MaxValue), cancellationToken).ConfigureAwait(false) is not { } scope)
        {
            return null;
        }

        var run = scope.Run;
        var ids = q.Line is { } one ? scope.Lines.Where(l => l.Id == one).Select(l => l.Id).ToList() : scope.Lines.Select(l => l.Id).ToList();
        var take = ids.Take(MaxPerRequest).ToList();
        var lines = await db.Lines.AsNoTracking().Include(l => l.Sources).Where(l => take.Contains(l.Id)).ToListAsync(cancellationToken).ConfigureAwait(false);
        var order = take.Select((id, i) => (id, i)).ToDictionary(x => x.id, x => x.i);
        lines = lines.OrderBy(l => order[l.Id]).ToList();
        var professions = scope.Lines.ToDictionary(l => l.Id);
        var cards = (await workforce.CardsAsync(lines.Select(l => l.WorkerId).Distinct().ToList(), cancellationToken).ConfigureAwait(false)).ToDictionary(c => c.Id);

        var items = lines.Select(l =>
        {
            cards.TryGetValue(l.WorkerId, out var card);
            var dto = professions[l.Id];
            var earnings = new List<PayslipItem> { new("basic", l.Base), new("housing", l.Housing) };
            Add(earnings, "food", l.Food);
            Add(earnings, "transport", l.Transport);
            Add(earnings, "other", l.OtherAllowances);
            Add(earnings, "overtime", l.Overtime, quantity: l.Sources.Sum(s => s.OvertimeHours));
            Add(earnings, "clientAdditions", l.ClientAdditions);
            Add(earnings, "internalAdditions", l.InternalAdditions);
            var cuts = new List<PayslipItem>();
            Add(cuts, "clientDeductions", l.ClientDeductions);
            Add(cuts, "customerLoans", l.CustomerLoans);
            Add(cuts, "internalDeductions", l.InternalDeductions);
            Add(cuts, "gosi", l.GosiEmployee);
            var gross = earnings.Sum(e => e.Amount);
            var deducted = cuts.Sum(c => c.Amount);
            return new PayslipDto(
                l.Id, l.WorkerId, l.WorkerNo, l.Name, Last4(card?.IqamaNo), null, null, dto.ProfessionAr ?? card?.ProfessionAr, dto.ProfessionEn ?? card?.ProfessionEn,
                l.ProjectName, l.StatusAr, l.StatusEn, null, l.GosiCategory, l.PaidDays + l.AbsenceDays, l.PaidDays, l.AbsenceDays, null, null,
                earnings, cuts, gross, deducted, l.Net, l.GosiEmployer, [], null, null,
                l.Sources.OrderBy(s => s.LineFrom).Select(s => new PayslipSource(s.TimesheetNo, s.ProjectName, s.LineFrom, s.LineTo, s.WorkDays)).ToList());
        }).ToList();

        return await BatchAsync("Workers", run.Id, run.RunNo, run.Status, run.LegalEntityId, run.From, run.To, run.ApprovedAt, run.ApprovedByName, ids.Count, items, q.Line is not null ? lines.FirstOrDefault()?.WorkerId : null, true, cancellationToken).ConfigureAwait(false);
    }

    private async Task<PayslipBatchDto> BatchAsync(
        string kind, Guid runId, string runNo, PayrollStatus status, Guid legalEntityId, DateOnly from, DateOnly to, DateTimeOffset? approvedAt, string? approvedBy,
        int total, List<PayslipDto> items, Guid? person, bool record, CancellationToken cancellationToken)
    {
        var entity = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(e => e.Id == legalEntityId);
        var draft = status != PayrollStatus.Approved;
        var now = clock.UtcNow;
        if (record && items.Count > 0)
        {
            db.PayslipPrints.Add(PayslipPrint.Of(kind, runId, runNo, items.Count, person, draft, user.DisplayName, now));
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return new PayslipBatchDto(
            kind, runId, runNo, status.ToString(), draft, entity?.NameAr ?? string.Empty, entity?.NameEn ?? string.Empty, entity?.CommercialRegistrationNo,
            from, to, approvedAt, approvedBy, now, user.DisplayName, total, items);
    }

    private static string Code(StaffItemKind kind) => kind switch
    {
        StaffItemKind.Installment => "installment",
        StaffItemKind.PenaltyDays => "penaltyDays",
        StaffItemKind.PenaltyAmount => "penaltyAmount",
        StaffItemKind.Other => "deduction",
        _ => "adjustment",
    };

    private static void Add(List<PayslipItem> list, string code, decimal amount, decimal? quantity = null)
    {
        if (amount != 0)
        {
            list.Add(new PayslipItem(code, amount, Quantity: quantity is > 0 ? quantity : null));
        }
    }

    /// <summary>What the listed amounts do not explain of the line's total (so the payslip always adds up to the run).</summary>
    private static void Rest(List<PayslipItem> list, string code, decimal total)
    {
        var rest = total - list.Sum(i => i.Amount);
        if (rest != 0)
        {
            list.Add(new PayslipItem(code, rest));
        }
    }

    internal static string? Last4(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim()[^Math.Min(4, value.Trim().Length)..];

    internal static string? MaskIban(string? iban) => iban is { Length: > 8 } ? $"{iban[..2]}•• •••• {iban[^4..]}" : null;
}
