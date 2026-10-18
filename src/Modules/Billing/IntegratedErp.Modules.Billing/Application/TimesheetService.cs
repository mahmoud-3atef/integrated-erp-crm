using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

public sealed record GenerateInput(Guid ProjectId, DateOnly Month);

public sealed record AdjustmentInput(Guid WorkerId, string Type, decimal Value, string Reason);

public sealed record BillingSettingsDto(int CycleStartDay, string DayBasis, decimal OvertimeMultiplier, decimal MonthlyHours, decimal? OvertimeHourlyRate, decimal MaxOvertimeHours, decimal GosiRate, decimal VatRate);

/// <summary>
/// Monthly project timesheets: generated from the period ledger for a project's billing cycle (again while open, the
/// adjustments staying on their workers), adjusted with reasons, and sent through the company's approval process.
/// </summary>
internal sealed class TimesheetService(
    BillingDbContext db,
    IPeriodLedger ledger,
    IWorkforceDirectory workforce,
    IProjectDirectory projects,
    IApprovalService approvals,
    NumberSequenceService numbering,
    ICurrentUser user,
    IClock clock)
{
    /// <summary>The old system's sponsors that are the company's own registrations; the others are internal suppliers.</summary>
    private static readonly string[] CompanySponsors = ["Care-Pro"];

    public async Task<BillingSettingsDto> SettingsAsync(Guid projectId, CancellationToken cancellationToken) =>
        ToDto(await SettingAsync(projectId, cancellationToken).ConfigureAwait(false));

    public async Task<Result> SaveSettingsAsync(Guid projectId, BillingSettingsDto input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!Enum.TryParse<DayBasis>(input.DayBasis, out var basis))
        {
            return Result.Failure(TimesheetErrors.Settings);
        }

        var setting = await db.ProjectSettings.FirstOrDefaultAsync(s => s.ProjectId == projectId, cancellationToken).ConfigureAwait(false);
        if (setting is null)
        {
            setting = ProjectBillingSetting.Default(projectId);
            db.ProjectSettings.Add(setting);
        }

        var set = setting.Set(input.CycleStartDay, basis, input.OvertimeMultiplier, input.MonthlyHours, input.OvertimeHourlyRate, input.MaxOvertimeHours, input.GosiRate, input.VatRate);
        if (set.IsFailure)
        {
            return set;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>
    /// The project's timesheet for the month: created on first generation, generated again while open (draft or
    /// returned) — the lines follow the ledger, the adjustments stay.
    /// </summary>
    public async Task<Result<Guid>> GenerateAsync(GenerateInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var project = await projects.FindAsync([input.ProjectId], [], cancellationToken).ConfigureAwait(false) is [var p, ..] ? p : null;
        if (project is null)
        {
            return Result.Failure<Guid>(TimesheetErrors.Project);
        }

        var month = new DateOnly(input.Month.Year, input.Month.Month, 1);
        var setting = await SettingAsync(project.Id, cancellationToken).ConfigureAwait(false);
        var (from, to) = TimesheetMath.Cycle(month, setting.CycleStartDay);
        var rules = Rules(setting, project.ContractType);
        var timesheet = await db.Timesheets.Include(t => t.Lines).Include(t => t.Adjustments)
            .FirstOrDefaultAsync(t => t.ProjectId == project.Id && t.Month == month, cancellationToken).ConfigureAwait(false);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        if (timesheet is null)
        {
            var number = await numbering.NextNumberAsync(db, "timesheet", to, cancellationToken).ConfigureAwait(false);
            timesheet = Timesheet.Create(number, new TimesheetProject(project.Id, project.CrmId, project.Code, project.Name, project.CustomerName, project.ContractType), month, from, to, setting.DayBasis);
            db.Timesheets.Add(timesheet);
        }
        else
        {
            db.TimesheetLines.RemoveRange(timesheet.Lines);
        }

        var lines = await LinesAsync(timesheet.Id, project.CrmId, from, to, setting.DayBasis, cancellationToken).ConfigureAwait(false);
        var generated = timesheet.Regenerate(from, to, setting.DayBasis, lines, rules, user.DisplayName, clock.UtcNow);
        if (generated.IsFailure)
        {
            return Result.Failure<Guid>(generated.Error);
        }

        db.TimesheetLines.AddRange(timesheet.Lines);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(timesheet.Id);
    }

    public async Task<Result> AdjustAsync(Guid id, AdjustmentInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!Enum.TryParse<AdjustmentType>(input.Type, out var type))
        {
            return Result.Failure(TimesheetErrors.Value);
        }

        var (timesheet, rules, setting) = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
        if (timesheet is null)
        {
            return Result.Failure(TimesheetErrors.NotFound);
        }

        var added = timesheet.Adjust(input.WorkerId, type, input.Value, input.Reason, rules!, setting!.MaxOvertimeHours, user.DisplayName, clock.UtcNow);
        if (added.IsFailure)
        {
            return Result.Failure(added.Error);
        }

        db.TimesheetAdjustments.Add(added.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> RemoveAdjustmentAsync(Guid id, Guid adjustmentId, CancellationToken cancellationToken)
    {
        var (timesheet, rules, _) = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
        if (timesheet is null)
        {
            return Result.Failure(TimesheetErrors.NotFound);
        }

        var adjustment = timesheet.Adjustments.FirstOrDefault(a => a.Id == adjustmentId);
        var removed = timesheet.RemoveAdjustment(adjustmentId, rules!);
        if (removed.IsFailure)
        {
            return removed;
        }

        db.TimesheetAdjustments.Remove(adjustment!);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>The timesheet as the Excel template to fill in (with the adjustments entered so far).</summary>
    public async Task<(byte[] Content, string FileName)?> ExportAsync(Guid id, CancellationToken cancellationToken)
    {
        var (timesheet, rules, setting) = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
        return timesheet is null ? null : (TimesheetWorkbook.Build(timesheet, rules!, setting!.MaxOvertimeHours), TimesheetWorkbook.FileName(timesheet));
    }

    /// <summary>What an uploaded file would change, and its problems — nothing is saved.</summary>
    public async Task<Result<ExcelPreview>> PreviewAsync(Guid id, Stream content, CancellationToken cancellationToken)
    {
        var (timesheet, _, setting) = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
        if (timesheet is null)
        {
            return Result.Failure<ExcelPreview>(TimesheetErrors.NotFound);
        }

        return timesheet.IsEditable
            ? Result.Success(TimesheetWorkbook.Read(content, timesheet, setting!.MaxOvertimeHours).Preview)
            : Result.Failure<ExcelPreview>(TimesheetErrors.NotEditable);
    }

    /// <summary>Applies an uploaded file: all its changes as adjustments with their reasons, or nothing when it has a problem.</summary>
    public async Task<Result<ExcelPreview>> ApplyExcelAsync(Guid id, Stream content, CancellationToken cancellationToken)
    {
        var (timesheet, rules, setting) = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
        if (timesheet is null)
        {
            return Result.Failure<ExcelPreview>(TimesheetErrors.NotFound);
        }

        var (preview, totals) = TimesheetWorkbook.Read(content, timesheet, setting!.MaxOvertimeHours);
        if (preview.Problems.Count > 0 || totals.Count == 0)
        {
            return Result.Success(preview);
        }

        var set = timesheet.SetTotals(totals, rules!, setting.MaxOvertimeHours, $"{user.DisplayName} (Excel)", clock.UtcNow);
        if (set.IsFailure)
        {
            return Result.Failure<ExcelPreview>(set.Error);
        }

        db.TimesheetAdjustments.RemoveRange(set.Value.Removed);
        db.TimesheetAdjustments.AddRange(set.Value.Added);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(preview);
    }

    /// <summary>Sends the timesheet through the company's approval process for timesheets.</summary>
    public async Task<Result> SubmitAsync(Guid id, CancellationToken cancellationToken)
    {
        var timesheet = await db.Timesheets.Include(t => t.Lines).FirstOrDefaultAsync(t => t.Id == id, cancellationToken).ConfigureAwait(false);
        if (timesheet is null)
        {
            return Result.Failure(TimesheetErrors.NotFound);
        }

        var marked = timesheet.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var started = await approvals.SubmitAsync(
            new ApprovalSubmission(TimesheetAdapter.ScreenCode, timesheet.Id, $"{timesheet.TimesheetNo} — {timesheet.ProjectName}"), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            timesheet.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure(started.Error);
        }

        return Result.Success();
    }

    internal static BillingRules Rules(ProjectBillingSetting s, string? contractType) =>
        new(s.OvertimeMultiplier, s.MonthlyHours, s.OvertimeHourlyRate, s.GosiRate, s.VatRate, contractType == "CostPlus");

    internal static WorkerSource SourceOf(string? sponsor) =>
        string.IsNullOrWhiteSpace(sponsor) ? WorkerSource.Unknown
        : CompanySponsors.Any(c => sponsor.StartsWith(c, StringComparison.OrdinalIgnoreCase)) ? WorkerSource.Company
        : WorkerSource.Supplier;

    private async Task<(Timesheet? Timesheet, BillingRules? Rules, ProjectBillingSetting? Setting)> LoadAsync(Guid id, CancellationToken cancellationToken)
    {
        var timesheet = await db.Timesheets.Include(t => t.Lines).Include(t => t.Adjustments).FirstOrDefaultAsync(t => t.Id == id, cancellationToken).ConfigureAwait(false);
        if (timesheet is null)
        {
            return (null, null, null);
        }

        var setting = await SettingAsync(timesheet.ProjectId, cancellationToken).ConfigureAwait(false);
        return (timesheet, Rules(setting, timesheet.ContractType), setting);
    }

    /// <summary>One line per worker period in the cycle, priced from the period and paid from the worker's own salary.</summary>
    private async Task<List<TimesheetLine>> LinesAsync(Guid timesheetId, Guid projectCrmId, DateOnly from, DateOnly to, DayBasis basis, CancellationToken cancellationToken)
    {
        var spans = await ledger.WorkAsync(projectCrmId, from, to, cancellationToken).ConfigureAwait(false);
        var cards = (await workforce.CardsAsync(spans.Select(s => s.WorkerId).Distinct().ToList(), cancellationToken).ConfigureAwait(false)).ToDictionary(c => c.Id);
        var divisor = basis == DayBasis.Thirty ? 30 : to.DayNumber - from.DayNumber + 1;
        var lines = new List<TimesheetLine>();
        foreach (var worker in spans.GroupBy(s => s.WorkerId))
        {
            if (!cards.TryGetValue(worker.Key, out var card))
            {
                continue;
            }

            var periods = worker.OrderBy(s => s.StartsOn).ToList();
            var days = TimesheetMath.WorkDays(periods.Select(s => (s.StartsOn, s.EndsOn)).ToList(), from, to, basis);
            var source = SourceOf(card.Sponsor);
            for (var n = 0; n < periods.Count; n++)
            {
                if (days[n] <= 0)
                {
                    continue;
                }

                var s = periods[n];
                var lineFrom = s.StartsOn > from ? s.StartsOn : from;
                var lineTo = s.EndsOn is { } end && end.AddDays(-1) < to ? end.AddDays(-1) : to;
                lines.Add(new TimesheetLine(timesheetId, new TimesheetLineValues(
                    s.Key, card.Id, card.WorkerNo, card.Name, card.IqamaNo, card.ProfessionCode, card.NationalityCode,
                    source, source == WorkerSource.Supplier ? card.Sponsor : null,
                    lineFrom, lineTo, days[n], divisor, s.PackageNo,
                    s.Salary > 0 ? s.Salary : card.TotalSalary, s.TotalPrice, s.Housing, s.HousingBillable, s.Transport, s.TransportBillable, s.IsSpecialPrice,
                    card.TotalSalary, card.BasicSalary, s.SourceType, s.SourceNo, s.FromOldSystem)));
            }
        }

        return lines.OrderBy(l => l.WorkerNo, StringComparer.Ordinal).ThenBy(l => l.LineFrom).ToList();
    }

    private async Task<ProjectBillingSetting> SettingAsync(Guid projectId, CancellationToken cancellationToken) =>
        await db.ProjectSettings.AsNoTracking().FirstOrDefaultAsync(s => s.ProjectId == projectId, cancellationToken).ConfigureAwait(false)
        ?? ProjectBillingSetting.Default(projectId);

    internal static BillingSettingsDto ToDto(ProjectBillingSetting s) =>
        new(s.CycleStartDay, s.DayBasis.ToString(), s.OvertimeMultiplier, s.MonthlyHours, s.OvertimeHourlyRate, s.MaxOvertimeHours, s.GosiRate, s.VatRate);
}
