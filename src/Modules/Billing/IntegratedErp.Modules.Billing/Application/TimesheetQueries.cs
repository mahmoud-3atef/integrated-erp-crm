using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>A project with work in the month, and its timesheet (when generated).</summary>
public sealed record MonthProjectDto(
    Guid? ProjectId,
    Guid ProjectCrmId,
    string ProjectName,
    string? CustomerName,
    string? ProjectManager,
    int LedgerWorkers,
    Guid? TimesheetId,
    string? TimesheetNo,
    string? Status,
    int? Workers,
    decimal? WorkDays,
    decimal? InvoiceAmount,
    decimal? InvoiceTotal,
    InvoiceRefDto? InvoiceDoc)
{
    /// <summary>The old system's invoice the timesheet was made from (its number).</summary>
    public string? LegacyInvoiceNo { get; init; }
}

public sealed record MonthTotalsDto(int Projects, int Generated, int InApproval, int Approved, decimal InvoiceAmount, int Invoiced);

public sealed record MonthDto(DateOnly Month, MonthTotalsDto Totals, IReadOnlyList<MonthProjectDto> Projects);

public sealed record TimesheetLineDto(
    Guid Id,
    Guid WorkerId,
    string WorkerNo,
    string Name,
    string? IqamaNo,
    string? ProfessionAr,
    string? ProfessionEn,
    string? NationalityAr,
    string? NationalityEn,
    string Source,
    string? SupplierName,
    DateOnly LineFrom,
    DateOnly LineTo,
    decimal WorkDays,
    string? PackageNo,
    decimal BillSalary,
    decimal TotalPrice,
    decimal Housing,
    bool HousingBillable,
    decimal Transport,
    bool TransportBillable,
    bool IsSpecialPrice,
    decimal PaySalary,
    string SourceNo,
    bool FromOldSystem,
    decimal AbsenceDays,
    decimal OvertimeHours,
    decimal ClientAdditions,
    decimal ClientDeductions,
    decimal CustomerLoans,
    decimal FeeDays,
    decimal OtherCosts,
    decimal InternalAdditions,
    decimal InternalDeductions,
    decimal DueSalary,
    decimal AbsenceAmount,
    decimal DueFees,
    decimal DueHousing,
    decimal DueTransport,
    decimal Overtime,
    decimal Gosi,
    decimal InvoiceAmount,
    decimal Vat,
    decimal InvoiceTotal,
    decimal PayDueSalary,
    decimal PayAbsence,
    decimal WorkerNet)
{
    public decimal OvertimeAmount { get; init; }

    public decimal OtherDeductions { get; init; }
}

public sealed record AdjustmentDto(Guid Id, Guid WorkerId, string Type, decimal Value, string Reason, string CreatedByName, DateTimeOffset CreatedAt);

/// <summary>The customer invoice the timesheet makes (before the invoice itself is issued).</summary>
public sealed record InvoicePreviewDto(
    decimal DueSalary, decimal AbsenceAmount, decimal DueFees, decimal DueHousing, decimal DueTransport, decimal Overtime,
    decimal ClientAdditions, decimal ClientDeductions, decimal CustomerLoans, decimal OtherCosts, decimal Gosi,
    decimal Amount, decimal Vat, decimal Total)
{
    public decimal OtherDeductions { get; init; }
}

/// <summary>A worker's month for the payroll or a supplier's statement (all their lines together).</summary>
public sealed record WorkerPayDto(
    Guid WorkerId, string WorkerNo, string Name, string? IqamaNo, decimal PaySalary, decimal WorkDays, decimal AbsenceDays, decimal OvertimeHours,
    decimal PayDueSalary, decimal PayAbsence, decimal Overtime, decimal ClientAdditions, decimal ClientDeductions, decimal CustomerLoans,
    decimal InternalAdditions, decimal InternalDeductions, decimal Net);

public sealed record SupplierStatementDto(string SupplierName, int Workers, decimal WorkDays, decimal Net, IReadOnlyList<WorkerPayDto> Items);

public sealed record TimesheetDetailDto(
    Guid Id,
    string TimesheetNo,
    Guid ProjectId,
    string ProjectCode,
    string ProjectName,
    string? CustomerName,
    string? ContractType,
    DateOnly Month,
    DateOnly From,
    DateOnly To,
    string DayBasis,
    string Status,
    bool AwaitingApproval,
    DateTimeOffset GeneratedAt,
    string GeneratedByName,
    DateTimeOffset? ApprovedAt,
    string? ApprovedByName,
    string? LastComment,
    BillingSettingsDto Settings,
    IReadOnlyList<TimesheetLineDto> Lines,
    IReadOnlyList<AdjustmentDto> Adjustments,
    InvoicePreviewDto Invoice,
    IReadOnlyList<WorkerPayDto> Payroll,
    IReadOnlyList<SupplierStatementDto> Suppliers,
    IReadOnlyList<WorkerPayDto> UnknownSource,
    ApprovalStatusInfo? Approval,
    bool CanEdit,
    bool CanSubmit,
    InvoiceRefDto? InvoiceDoc,
    bool CanInvoice)
{
    /// <summary>The old system's invoice this draft was made from, and its status code there.</summary>
    public string? LegacyInvoiceNo { get; init; }

    public int? LegacyStatus { get; init; }
}

internal sealed class TimesheetQueries(
    BillingDbContext db,
    IPeriodLedger ledger,
    IProjectDirectory projects,
    IReferenceData reference,
    IApprovalService approvals,
    IPermissionService permissions)
{
    /// <summary>Every project with work in the month (from the ledger), with its timesheet when there is one.</summary>
    public async Task<MonthDto> MonthAsync(DateOnly month, CancellationToken cancellationToken)
    {
        var first = new DateOnly(month.Year, month.Month, 1);
        var spans = await ledger.WorkAsync(null, first, first.AddMonths(1).AddDays(-1), cancellationToken).ConfigureAwait(false);
        var byProject = spans.GroupBy(s => s.ProjectCrmId).ToDictionary(g => g.Key, g => (Name: g.First().ProjectName, Workers: g.Select(s => s.WorkerId).Distinct().Count()));
        var sheets = await db.Timesheets.AsNoTracking().Where(t => t.Month == first)
            .Select(t => new
            {
                t.Id, t.TimesheetNo, t.ProjectId, t.ProjectCrmId, t.ProjectName, t.CustomerName, t.Status, t.LegacyInvoiceNo,
                Workers = t.Lines.Select(l => l.WorkerId).Distinct().Count(),
                Days = t.Lines.Sum(l => (decimal?)l.WorkDays) ?? 0,
                Amount = t.Lines.Sum(l => (decimal?)l.InvoiceAmount) ?? 0,
                Total = t.Lines.Sum(l => (decimal?)l.InvoiceTotal) ?? 0,
            })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var sheetIds = sheets.Select(s => (Guid?)s.Id).ToList();
        var invoices = (await db.Invoices.AsNoTracking().Where(i => sheetIds.Contains(i.TimesheetId))
                .Select(i => new { i.TimesheetId, i.Id, i.InvoiceNo, i.Status }).ToListAsync(cancellationToken).ConfigureAwait(false))
            .ToDictionary(i => i.TimesheetId!.Value, i => new InvoiceRefDto(i.Id, i.InvoiceNo, i.Status.ToString()));
        var crmIds = byProject.Keys.Union(sheets.Select(s => s.ProjectCrmId)).ToList();
        var known = (await projects.FindAsync([], crmIds, cancellationToken).ConfigureAwait(false)).ToDictionary(p => p.CrmId);
        // A row per timesheet (a project has several when the old system invoiced it more than once in the month), or one without.
        var rows = crmIds.SelectMany(crm => sheets.Where(s => s.ProjectCrmId == crm).Select(s => (Crm: crm, Sheet: s)).DefaultIfEmpty((crm, null!)))
            .Select(pair =>
            {
                var (crm, sheet) = pair;
                var project = known.GetValueOrDefault(crm);
                return new MonthProjectDto(
                    project?.Id, crm, project?.Name ?? sheet?.ProjectName ?? byProject.GetValueOrDefault(crm).Name ?? "—", project?.CustomerName ?? sheet?.CustomerName,
                    project?.Manager, byProject.GetValueOrDefault(crm).Workers, sheet?.Id, sheet?.TimesheetNo, sheet?.Status.ToString(),
                    sheet?.Workers, sheet?.Days, sheet?.Amount, sheet?.Total, sheet is null ? null : invoices.GetValueOrDefault(sheet.Id))
                {
                    LegacyInvoiceNo = sheet?.LegacyInvoiceNo,
                };
            })
            .OrderBy(r => r.TimesheetId is null ? 0 : 1).ThenByDescending(r => r.LedgerWorkers)
            .ToList();
        return new MonthDto(
            first,
            new MonthTotalsDto(rows.Count, sheets.Count, sheets.Count(s => s.Status == TimesheetStatus.InApproval), sheets.Count(s => s.Status == TimesheetStatus.Approved), sheets.Sum(s => s.Amount),
                invoices.Values.Count(i => i.Status == nameof(InvoiceStatus.Issued))),
            rows);
    }

    public async Task<TimesheetDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var t = await db.Timesheets.AsNoTracking().Include(x => x.Lines).Include(x => x.Adjustments).FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (t is null)
        {
            return null;
        }

        var setting = await db.ProjectSettings.AsNoTracking().FirstOrDefaultAsync(s => s.ProjectId == t.ProjectId, cancellationToken).ConfigureAwait(false)
            ?? ProjectBillingSetting.Default(t.ProjectId);
        var professions = (await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal);
        var nationalities = (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal);
        var lines = t.Lines.OrderBy(l => l.WorkerNo, StringComparer.Ordinal).ThenBy(l => l.LineFrom).Select(l =>
            {
                var profession = l.ProfessionCode is { } pc ? professions.GetValueOrDefault(pc) : null;
                var nationality = l.NationalityCode is { } nc ? nationalities.GetValueOrDefault(nc) : null;
                return new TimesheetLineDto(
                    l.Id, l.WorkerId, l.WorkerNo, l.Name, l.IqamaNo, profession?.NameAr, profession?.NameEn, nationality?.NameAr, nationality?.NameEn,
                    l.Source.ToString(), l.SupplierName, l.LineFrom, l.LineTo, l.WorkDays, l.PackageNo, l.BillSalary, l.TotalPrice, l.Housing, l.HousingBillable,
                    l.Transport, l.TransportBillable, l.IsSpecialPrice, l.PaySalary, l.SourceNo, l.FromOldSystem, l.AbsenceDays, l.OvertimeHours,
                    l.ClientAdditions, l.ClientDeductions, l.CustomerLoans, l.FeeDays, l.OtherCosts, l.InternalAdditions, l.InternalDeductions, l.DueSalary, l.AbsenceAmount, l.DueFees,
                    l.DueHousing, l.DueTransport, l.Overtime, l.Gosi, l.InvoiceAmount, l.Vat, l.InvoiceTotal, l.PayDueSalary, l.PayAbsence, l.WorkerNet)
                {
                    OvertimeAmount = l.OvertimeAmount,
                    OtherDeductions = l.OtherDeductions,
                };
            })
            .ToList();
        var invoice = new InvoicePreviewDto(
            t.Lines.Sum(l => l.DueSalary), t.Lines.Sum(l => l.AbsenceAmount), t.Lines.Sum(l => l.DueFees), t.Lines.Sum(l => l.DueHousing),
            t.Lines.Sum(l => l.DueTransport), t.Lines.Sum(l => l.Overtime), t.Lines.Sum(l => l.ClientAdditions), t.Lines.Sum(l => l.ClientDeductions),
            t.Lines.Sum(l => l.CustomerLoans), t.Lines.Sum(l => l.OtherCosts), t.Lines.Sum(l => l.Gosi),
            t.Lines.Sum(l => l.InvoiceAmount), t.Lines.Sum(l => l.Vat), t.Lines.Sum(l => l.InvoiceTotal))
        {
            OtherDeductions = t.Lines.Sum(l => l.OtherDeductions),
        };
        var pays = t.Lines.GroupBy(l => l.WorkerId).Select(g =>
            {
                var l0 = g.First();
                return (Line: l0, Pay: new WorkerPayDto(
                    g.Key, l0.WorkerNo, l0.Name, l0.IqamaNo, l0.PaySalary, g.Sum(l => l.WorkDays), g.Sum(l => l.AbsenceDays), g.Sum(l => l.OvertimeHours),
                    g.Sum(l => l.PayDueSalary), g.Sum(l => l.PayAbsence), g.Sum(l => l.Overtime), g.Sum(l => l.ClientAdditions), g.Sum(l => l.ClientDeductions),
                    g.Sum(l => l.CustomerLoans), g.Sum(l => l.InternalAdditions), g.Sum(l => l.InternalDeductions), g.Sum(l => l.WorkerNet)));
            })
            .OrderBy(x => x.Pay.WorkerNo, StringComparer.Ordinal)
            .ToList();
        var suppliers = pays.Where(p => p.Line.Source == WorkerSource.Supplier).GroupBy(p => p.Line.SupplierName ?? "—")
            .Select(g => new SupplierStatementDto(g.Key, g.Count(), g.Sum(p => p.Pay.WorkDays), g.Sum(p => p.Pay.Net), g.Select(p => p.Pay).ToList()))
            .OrderByDescending(s => s.Workers)
            .ToList();

        var approval = await approvals.StatusAsync(TimesheetAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        var granted = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        var canManage = granted.Has(BillingPermissions.TimesheetsManage);
        var invoiceRow = await db.Invoices.AsNoTracking().Where(i => i.TimesheetId == id)
            .Select(i => new { Ref = new InvoiceRefDto(i.Id, i.InvoiceNo, i.Status.ToString()), Locks = i.InvoiceNo != null || i.AwaitingApproval || (i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Returned) })
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        var invoiceDoc = invoiceRow?.Ref;
        return new TimesheetDetailDto(
            t.Id, t.TimesheetNo, t.ProjectId, t.ProjectCode, t.ProjectName, t.CustomerName, t.ContractType, t.Month, t.From, t.To, t.DayBasis.ToString(),
            t.Status.ToString(), t.AwaitingApproval, t.GeneratedAt, t.GeneratedByName, t.ApprovedAt, t.ApprovedByName, t.LastComment,
            TimesheetService.ToDto(setting), lines,
            t.Adjustments.OrderBy(a => a.CreatedAt).Select(a => new AdjustmentDto(a.Id, a.WorkerId, a.Type.ToString(), a.Value, a.Reason, a.CreatedByName, a.CreatedAt)).ToList(),
            invoice,
            pays.Where(p => p.Line.Source == WorkerSource.Company).Select(p => p.Pay).ToList(),
            suppliers,
            pays.Where(p => p.Line.Source == WorkerSource.Unknown).Select(p => p.Pay).ToList(),
            approval,
            CanEdit: canManage && t.IsEditable && invoiceRow?.Locks != true,
            CanSubmit: canManage && t.IsEditable && t.Lines.Count > 0,
            invoiceDoc,
            CanInvoice: invoiceDoc is null && t.Status == TimesheetStatus.Approved && !t.LegacyIssued && granted.Has(BillingPermissions.InvoicesManage))
        {
            LegacyInvoiceNo = t.LegacyInvoiceNo,
            LegacyStatus = t.LegacyStatus,
        };
    }
}
