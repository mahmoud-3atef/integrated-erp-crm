using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Contracts;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

public sealed record CreateRunInput(Guid LegalEntityId, DateOnly From, DateOnly To);

public sealed record SponsorLinkInput(string Sponsor, Guid? LegalEntityId);

/// <summary>
/// The company workers' payroll runs (docs/02-target-architecture/09): created for a commercial registration and a
/// period, calculated from the approved timesheet lines not paid in another run, recalculated while open, and sent
/// through the company's approval process (HR, then finance, then management by default).
/// </summary>
internal sealed class PayrollService(
    PayrollDbContext db,
    ITimesheetPayroll timesheets,
    IWorkerSalaries salaries,
    IWorkforceDirectory workforce,
    IPeriodLedger ledger,
    ILegalEntityDirectory legalEntities,
    IApprovalService approvals,
    NumberSequenceService numbering,
    ICurrentUser user,
    IClock clock)
{
    /// <summary>How far back an approved timesheet line not paid yet is taken (a timesheet approved after its run).</summary>
    private const int LateDays = 92;

    public async Task<Result<Guid>> CreateAsync(CreateRunInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (input.To < input.From || input.To.DayNumber - input.From.DayNumber > 61)
        {
            return Result.Failure<Guid>(PayrollErrors.Period);
        }

        var entity = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(e => e.Id == input.LegalEntityId && e.IsActive);
        if (entity is null)
        {
            return Result.Failure<Guid>(PayrollErrors.LegalEntity);
        }

        if (!await db.Sponsors.AnyAsync(s => s.LegalEntityId == entity.Id, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(PayrollErrors.NoSponsors);
        }

        if (await OverlapsAsync(null, entity.Id, input.From, input.To, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(PayrollErrors.Overlap);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, "payroll", input.To, cancellationToken).ConfigureAwait(false);
        var run = PayrollRun.Create(number, PayrollGroup.CompanyWorkers, entity.Id, entity.NameAr, input.From, input.To, user.DisplayName, clock.UtcNow);
        db.Runs.Add(run);
        var calculated = await CalculateAsync(run, cancellationToken).ConfigureAwait(false);
        if (calculated.IsFailure)
        {
            return Result.Failure<Guid>(calculated.Error);
        }

        var saved = await SaveAsync(cancellationToken).ConfigureAwait(false);
        if (saved.IsFailure)
        {
            return Result.Failure<Guid>(saved.Error);
        }

        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(run.Id);
    }

    public async Task<Result> RecalculateAsync(Guid id, CancellationToken cancellationToken)
    {
        var run = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return Result.Failure(PayrollErrors.NotFound);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var calculated = await CalculateAsync(run, cancellationToken).ConfigureAwait(false);
        var saved = calculated.IsFailure ? calculated : await SaveAsync(cancellationToken).ConfigureAwait(false);
        if (saved.IsSuccess)
        {
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }

        return saved;
    }

    /// <summary>Recalculates (so the run sent is the one the timesheets make now) and starts the approval.</summary>
    public async Task<Result> SubmitAsync(Guid id, CancellationToken cancellationToken)
    {
        var run = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return Result.Failure(PayrollErrors.NotFound);
        }

        await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false))
        {
            var calculated = await CalculateAsync(run, cancellationToken).ConfigureAwait(false);
            if (calculated.IsFailure)
            {
                return calculated;
            }

            var marked = run.MarkSubmitted(clock.UtcNow);
            if (marked.IsFailure)
            {
                return marked;
            }

            var saved = await SaveAsync(cancellationToken).ConfigureAwait(false);
            if (saved.IsFailure)
            {
                return saved;
            }

            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }

        var started = await approvals.SubmitAsync(
            new ApprovalSubmission(PayrollAdapter.ScreenCode, run.Id, $"{run.RunNo} — {run.LegalEntityName}", run.LegalEntityId), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            run.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure(started.Error);
        }

        return Result.Success();
    }

    /// <summary>Deletes an open run: its timesheet lines are free for another run.</summary>
    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var run = await db.Runs.FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return Result.Failure(PayrollErrors.NotFound);
        }

        if (!run.IsEditable)
        {
            return Result.Failure(PayrollErrors.NotEditable);
        }

        db.Runs.Remove(run);
        return await SaveAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>The period a new run of the registration starts with: the day after its last run, for a month.</summary>
    public async Task<(DateOnly From, DateOnly To)> NextPeriodAsync(Guid legalEntityId, CancellationToken cancellationToken)
    {
        var last = await db.Runs.AsNoTracking().Where(r => r.LegalEntityId == legalEntityId && r.Group == PayrollGroup.CompanyWorkers)
            .OrderByDescending(r => r.To).Select(r => (DateOnly?)r.To).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        var from = last is { } end ? end.AddDays(1) : new DateOnly(today.Year, today.Month, 1).AddMonths(-1);
        var to = from.Day == 1 ? from.AddMonths(1).AddDays(-1) : from.AddMonths(1).AddDays(-1);
        return (from, to);
    }

    /// <summary>Links (or unlinks, with no registration) the old system's sponsors to the company's registrations.</summary>
    public async Task<Result> LinkSponsorsAsync(IReadOnlyList<SponsorLinkInput> links, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(links);
        var entities = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).Select(e => e.Id).ToHashSet();
        var current = await db.Sponsors.ToListAsync(cancellationToken).ConfigureAwait(false);
        foreach (var link in links)
        {
            if (string.IsNullOrWhiteSpace(link.Sponsor) || link.Sponsor.Trim().Length > 100)
            {
                return Result.Failure(PayrollErrors.Sponsor);
            }

            if (link.LegalEntityId is { } le && !entities.Contains(le))
            {
                return Result.Failure(PayrollErrors.LegalEntity);
            }

            var row = current.FirstOrDefault(s => string.Equals(s.Sponsor, link.Sponsor.Trim(), StringComparison.OrdinalIgnoreCase));
            switch (row, link.LegalEntityId)
            {
                case (null, { } target):
                    var added = SponsorRegistration.Create(link.Sponsor, target);
                    db.Sponsors.Add(added);
                    current.Add(added);
                    break;
                case (not null, { } target):
                    row.MoveTo(target);
                    break;
                case (not null, null):
                    db.Sponsors.Remove(row);
                    current.Remove(row);
                    break;
            }
        }

        return await SaveAsync(cancellationToken).ConfigureAwait(false);
    }

    private async Task<Result> CalculateAsync(PayrollRun run, CancellationToken cancellationToken)
    {
        if (!run.IsEditable)
        {
            return Result.Failure(PayrollErrors.NotEditable);
        }

        if (await OverlapsAsync(run.Id, run.LegalEntityId, run.From, run.To, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(PayrollErrors.Overlap);
        }

        var sponsors = (await db.Sponsors.AsNoTracking().Where(s => s.LegalEntityId == run.LegalEntityId).Select(s => s.Sponsor).ToListAsync(cancellationToken).ConfigureAwait(false))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // The company workers' timesheet lines ending in the period, and the approved ones of the last months not paid yet.
        var all = await timesheets.CompanyLinesAsync(run.From.AddDays(-LateDays), run.To, cancellationToken).ConfigureAwait(false);
        var worked = (await ledger.WorkAsync(null, run.From, run.To, cancellationToken).ConfigureAwait(false))
            .Where(s => s.StartsOn <= run.To && (s.EndsOn is null || s.EndsOn > run.From))
            .Select(s => s.WorkerId).ToHashSet();
        var pay = (await salaries.SalariesAsync(all.Select(l => l.WorkerId).Concat(worked).Distinct().ToList(), cancellationToken).ConfigureAwait(false))
            .ToDictionary(s => s.WorkerId);
        bool Ours(Guid workerId) => pay.TryGetValue(workerId, out var s) && s.Sponsor is { } sp && sponsors.Contains(sp.Trim());

        var lines = all.Where(l => Ours(l.WorkerId)).ToList();
        var ids = lines.Select(l => l.LineId).ToList();
        var paidElsewhere = await (from s in db.Sources.AsNoTracking()
                                   join r in db.Runs.AsNoTracking() on s.RunId equals r.Id
                                   where ids.Contains(s.TimesheetLineId) && s.RunId != run.Id
                                   select new { s.TimesheetLineId, r.RunNo })
            .ToDictionaryAsync(x => x.TimesheetLineId, x => x.RunNo, cancellationToken).ConfigureAwait(false);

        var inPeriod = lines.Where(l => l.LineTo >= run.From).ToList();
        var payable = lines.Where(l => l.TimesheetStatus == "Approved" && !paidElsewhere.ContainsKey(l.LineId)).ToList();
        var cards = (await workforce.CardsAsync(payable.Select(l => l.WorkerId).Concat(worked.Where(Ours)).Distinct().ToList(), cancellationToken).ConfigureAwait(false))
            .ToDictionary(c => c.Id);

        var paidLines = new List<PayrollLine>();
        var exceptions = new List<PayrollExclusion>();
        foreach (var worker in payable.GroupBy(l => l.WorkerId).OrderBy(g => g.First().WorkerNo, StringComparer.Ordinal))
        {
            var mine = worker.OrderBy(l => l.LineFrom).ToList();
            var (values, sources) = PayrollCalculator.Worker(mine, pay.GetValueOrDefault(worker.Key), cards.GetValueOrDefault(worker.Key), run.From, run.To);
            if (mine.Any(l => l.LineTo < run.From))
            {
                values = values with { Notes = [.. values.Notes, "late"] };
            }

            paidLines.Add(PayrollLine.Create(run.Id, values, sources));
            if (values.Net <= 0)
            {
                exceptions.Add(PayrollExclusion.Create(run.Id, PayrollExclusionKind.NetNotPositive, values.WorkerId, values.WorkerNo, values.Name, values.ProjectName, null));
            }
        }

        var paid = paidLines.Select(l => l.WorkerId).ToHashSet();
        foreach (var line in inPeriod.Where(l => l.TimesheetStatus != "Approved").GroupBy(l => (l.WorkerId, l.TimesheetId)).Select(g => g.First()))
        {
            exceptions.Add(PayrollExclusion.Create(run.Id, PayrollExclusionKind.TimesheetNotApproved, line.WorkerId, line.WorkerNo, line.Name, line.ProjectName, line.TimesheetNo));
        }

        foreach (var line in inPeriod.Where(l => paidElsewhere.ContainsKey(l.LineId)).GroupBy(l => l.WorkerId).Select(g => g.First()))
        {
            exceptions.Add(PayrollExclusion.Create(run.Id, PayrollExclusionKind.PaidElsewhere, line.WorkerId, line.WorkerNo, line.Name, line.ProjectName, paidElsewhere[line.LineId]));
        }

        var onTimesheets = inPeriod.Select(l => l.WorkerId).ToHashSet();
        foreach (var workerId in worked.Where(w => Ours(w) && !onTimesheets.Contains(w) && !paid.Contains(w)))
        {
            var card = cards.GetValueOrDefault(workerId);
            exceptions.Add(PayrollExclusion.Create(run.Id, PayrollExclusionKind.NoTimesheet, workerId, card?.WorkerNo ?? "—", card?.Name ?? "—", card?.ProjectName, null));
        }

        // The run's old rows go first (deleted in the database, and no longer tracked), so the new ones can take the same timesheet lines.
        foreach (var entry in db.ChangeTracker.Entries().Where(e => e.Entity is PayrollLine l && l.RunId == run.Id
                     || e.Entity is PayrollLineSource s && s.RunId == run.Id || e.Entity is PayrollExclusion x && x.RunId == run.Id).ToList())
        {
            entry.State = EntityState.Detached;
        }

        await db.Sources.Where(s => s.RunId == run.Id).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        await db.Lines.Where(l => l.RunId == run.Id).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        await db.Exclusions.Where(e => e.RunId == run.Id).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        var calculated = run.Calculate(paidLines, exceptions, clock.UtcNow);
        if (calculated.IsSuccess && db.Entry(run).State != EntityState.Added)
        {
            // New rows of a saved run (their keys are set here, so they are added explicitly).
            db.Lines.AddRange(paidLines);
            db.Exclusions.AddRange(exceptions);
        }

        return calculated;
    }

    private Task<bool> OverlapsAsync(Guid? id, Guid legalEntityId, DateOnly from, DateOnly to, CancellationToken cancellationToken) =>
        db.Runs.AnyAsync(r => r.Id != id && r.LegalEntityId == legalEntityId && r.Group == PayrollGroup.CompanyWorkers && r.From <= to && r.To >= from, cancellationToken);

    private Task<PayrollRun?> LoadAsync(Guid id, CancellationToken cancellationToken) =>
        db.Runs.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    private async Task<Result> SaveAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Success();
        }
        catch (DbUpdateException)
        {
            // Another run took one of the timesheet lines meanwhile (the unique key on the line): recalculate.
            return Result.Failure(Error.Conflict("payroll_changed", "Another payroll run took some of these timesheet lines meanwhile: recalculate."));
        }
    }
}
