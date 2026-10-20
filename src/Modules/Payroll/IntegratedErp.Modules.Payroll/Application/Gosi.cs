using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

public sealed record GosiStatementLine(string Kind, Guid PersonId, string No, string Name, string Category, decimal Base, decimal Employee, decimal Employer, string? Flag);

public sealed record GosiCategorySum(string Category, int Members, decimal Base, decimal Employee, decimal Employer);

public sealed record GosiStatementDto(
    Guid LegalEntityId,
    string Period,
    int Members,
    int Staff,
    int Workers,
    decimal Base,
    decimal SaudiBase,
    decimal NonSaudiBase,
    decimal Employee,
    decimal Employer,
    decimal Hazards,
    decimal Due,
    decimal? Invoice,
    string? InvoiceNote,
    string? InvoiceBy,
    decimal? Difference,
    int ApprovedRuns,
    int OpenRuns,
    IReadOnlyList<GosiCategorySum> Categories,
    IReadOnlyList<GosiStatementLine> Items,
    int Total,
    int Page,
    int PageSize);

public sealed record GosiTaskDto(Guid Id, string Kind, string Status, Guid EmployeeId, string EmployeeNo, string Name, decimal? OldWage, decimal? NewWage, DateOnly? EventOn, DateTimeOffset CreatedAt, DateOnly? DoneOn, string? DoneByName, string? Reference);

public sealed record GosiTaskCloseInput(DateOnly DoneOn, decimal? Wage, string? GosiNo, DateOnly? Since, string? Reference);

public sealed record GosiInvoiceInput(Guid LegalEntityId, string Period, decimal Amount, string? Note);

public sealed record SaudizationRow(
    Guid LegalEntityId,
    string NameAr,
    string NameEn,
    int Total,
    int Saudis,
    int StaffSaudis,
    int WorkerSaudis,
    int HalfCounted,
    decimal Counted,
    decimal Percent,
    decimal? RequiredPercent,
    int Needed,
    bool Below);

public sealed record SaudizationSettingsDto(decimal FullWage, IReadOnlyList<SaudizationTargetDto> Targets);

public sealed record SaudizationTargetDto(Guid LegalEntityId, string? NameAr, string? NameEn, decimal? RequiredPercent);

/// <summary>
/// GOSI's side of the payroll (docs/03-migration-plan/12, 4.9): the tasks HR does on GOSI's portal, opened from the
/// staff's files and closed with the transaction; the monthly statement of a registration from the approved runs and
/// its reconciliation with GOSI's invoice; and Saudization by registration.
/// </summary>
internal sealed class GosiService(
    PayrollDbContext db,
    IStaffPayroll staff,
    IWorkforceDirectory workforce,
    IWorkerSalaries salaries,
    ILegalEntityDirectory legalEntities,
    ICurrentUser user,
    IClock clock)
{
    /// <summary>
    /// Opens the tasks the staff's files call for (and resolves those no longer needed): a new employee without a GOSI
    /// number, a contributory wage changed from the one registered, an employee who left. The wage registered is taken
    /// from the file the first time an employee with a GOSI number is seen.
    /// </summary>
    public async Task RefreshTasksAsync(CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var infos = await staff.PayInfoAsync(today.AddMonths(-3), today, cancellationToken).ConfigureAwait(false);
        var members = await db.GosiMembers.Where(m => m.Kind == GosiPersonKind.Staff).ToDictionaryAsync(m => m.PersonId, cancellationToken).ConfigureAwait(false);
        var open = (await db.GosiTasks.Where(t => t.Status == GosiTaskStatus.Open).ToListAsync(cancellationToken).ConfigureAwait(false))
            .GroupBy(t => (t.EmployeeId, t.Kind)).ToDictionary(g => g.Key, g => g.First());
        var now = clock.UtcNow;

        void Ensure(StaffPayInfo e, GosiTaskKind kind, decimal? oldWage, decimal? newWage, DateOnly? on)
        {
            if (open.TryGetValue((e.EmployeeId, kind), out var task))
            {
                task.Refresh(newWage, e.LegalEntityId);
                return;
            }

            var created = GosiTask.Open(kind, e.EmployeeId, e.EmployeeNo, e.Name, e.LegalEntityId, oldWage, newWage, on, now);
            db.GosiTasks.Add(created);
            open[(e.EmployeeId, kind)] = created;
        }

        void Resolve(Guid employeeId, GosiTaskKind kind)
        {
            if (open.Remove((employeeId, kind), out var task))
            {
                task.Resolve(now);
            }
        }

        foreach (var e in infos)
        {
            var active = e.Status != "Left" && (e.EndedOn is null || e.EndedOn >= today) && (e.HireDate is null || e.HireDate <= today);
            var wage = e.Salary is { } s ? s.Basic + s.Housing : (decimal?)null;
            members.TryGetValue(e.EmployeeId, out var member);
            if (active && wage is { } w)
            {
                Resolve(e.EmployeeId, GosiTaskKind.Exclude);
                if (string.IsNullOrWhiteSpace(e.GosiNo))
                {
                    Ensure(e, GosiTaskKind.Register, null, w, e.HireDate);
                    continue;
                }

                Resolve(e.EmployeeId, GosiTaskKind.Register);
                if (member is null)
                {
                    member = GosiMember.Create(GosiPersonKind.Staff, e.EmployeeId, w, today);
                    db.GosiMembers.Add(member);
                    members[e.EmployeeId] = member;
                }
                else if (member.ExcludedOn is not null || member.RegisteredWage is null)
                {
                    member.Register(w, today);
                }
                else if (member.RegisteredWage != w)
                {
                    Ensure(e, GosiTaskKind.WageUpdate, member.RegisteredWage, w, today);
                }
                else
                {
                    Resolve(e.EmployeeId, GosiTaskKind.WageUpdate);
                }
            }
            else if (!active)
            {
                Resolve(e.EmployeeId, GosiTaskKind.Register);
                Resolve(e.EmployeeId, GosiTaskKind.WageUpdate);
                if (!string.IsNullOrWhiteSpace(e.GosiNo) && member is { ExcludedOn: null })
                {
                    Ensure(e, GosiTaskKind.Exclude, member.RegisteredWage, null, e.EndedOn);
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<GosiTaskDto>> TasksAsync(string? status, CancellationToken cancellationToken)
    {
        await RefreshTasksAsync(cancellationToken).ConfigureAwait(false);
        var q = db.GosiTasks.AsNoTracking();
        q = status == "done" ? q.Where(t => t.Status == GosiTaskStatus.Done) : q.Where(t => t.Status == GosiTaskStatus.Open);
        return await q.OrderBy(t => t.Kind).ThenBy(t => t.CreatedAt).Take(1000)
            .Select(t => new GosiTaskDto(t.Id, t.Kind.ToString(), t.Status.ToString(), t.EmployeeId, t.EmployeeNo, t.Name, t.OldWage, t.NewWage, t.EventOn, t.CreatedAt, t.DoneOn, t.DoneByName, t.Reference))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Closes a task with what was done on GOSI's portal: the registration's number, the new wage, or the exclusion.</summary>
    public async Task<Result> CloseTaskAsync(Guid id, GosiTaskCloseInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var task = await db.GosiTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken).ConfigureAwait(false);
        if (task is null)
        {
            return Result.Failure(PayrollErrors.GosiTaskNotFound);
        }

        if (task.Status != GosiTaskStatus.Open)
        {
            return Result.Failure(PayrollErrors.GosiTask);
        }

        // Validated before anything is tracked, so a refused close leaves nothing behind.
        var wage = input.Wage ?? task.NewWage;
        if (task.Kind != GosiTaskKind.Exclude && wage is not > 0)
        {
            return Result.Failure(PayrollErrors.GosiWage);
        }

        if (task.Kind == GosiTaskKind.Register
            && (string.IsNullOrWhiteSpace(input.GosiNo) || !await staff.SetGosiAsync(task.EmployeeId, input.GosiNo, input.Since ?? task.EventOn, cancellationToken).ConfigureAwait(false)))
        {
            return Result.Failure(PayrollErrors.GosiWage);
        }

        var member = await db.GosiMembers.FirstOrDefaultAsync(m => m.Kind == GosiPersonKind.Staff && m.PersonId == task.EmployeeId, cancellationToken).ConfigureAwait(false);
        if (member is null)
        {
            member = GosiMember.Create(GosiPersonKind.Staff, task.EmployeeId, null, null);
            db.GosiMembers.Add(member);
        }

        if (task.Kind == GosiTaskKind.Exclude)
        {
            member.Exclude(input.DoneOn);
        }
        else
        {
            member.Register(wage!.Value, input.DoneOn);
        }

        var done = task.Done(input.DoneOn, input.Reference, user.DisplayName, clock.UtcNow);
        if (done.IsFailure)
        {
            return done;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> SaveInvoiceAsync(GosiInvoiceInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!Periods.Valid(input.Period))
        {
            return Result.Failure(PayrollErrors.Period);
        }

        if (!(await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).Any(e => e.Id == input.LegalEntityId))
        {
            return Result.Failure(PayrollErrors.LegalEntity);
        }

        var invoice = await db.GosiInvoices.FirstOrDefaultAsync(i => i.LegalEntityId == input.LegalEntityId && i.Period == input.Period, cancellationToken).ConfigureAwait(false);
        if (invoice is null)
        {
            invoice = GosiInvoice.Create(input.LegalEntityId, input.Period);
            db.GosiInvoices.Add(invoice);
        }

        var set = invoice.Set(input.Amount, input.Note, user.DisplayName, clock.UtcNow);
        if (set.IsSuccess)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return set;
    }

    /// <summary>A registration's GOSI for a month, from its approved staff and workers' runs, page by page, with the invoice.</summary>
    public async Task<GosiStatementDto> StatementAsync(Guid legalEntityId, string period, string? search, string? kind, int page, int pageSize, CancellationToken cancellationToken)
    {
        var staffLines = await (from l in db.StaffLines.AsNoTracking()
                                join r in db.StaffRuns.AsNoTracking() on l.RunId equals r.Id
                                where r.LegalEntityId == legalEntityId && r.Period == period && r.Status == PayrollStatus.Approved
                                select new { l.EmployeeId, l.EmployeeNo, l.Name, l.GosiCategory, l.GosiBase, l.GosiEmployee, l.GosiEmployer })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var (start, end) = Periods.Range(period);
        var workerLines = await (from l in db.Lines.AsNoTracking()
                                 join r in db.Runs.AsNoTracking() on l.RunId equals r.Id
                                 where r.LegalEntityId == legalEntityId && r.Status == PayrollStatus.Approved && r.To >= start && r.To <= end && l.GosiCategory != ""
                                 select new { l.WorkerId, l.WorkerNo, l.Name, l.GosiCategory, l.GosiBase, l.GosiEmployee, l.GosiEmployer })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var approvedRuns = await db.StaffRuns.CountAsync(r => r.LegalEntityId == legalEntityId && r.Period == period && r.Status == PayrollStatus.Approved, cancellationToken).ConfigureAwait(false)
            + await db.Runs.CountAsync(r => r.LegalEntityId == legalEntityId && r.Status == PayrollStatus.Approved && r.To >= start && r.To <= end, cancellationToken).ConfigureAwait(false);
        var openRuns = await db.StaffRuns.CountAsync(r => r.LegalEntityId == legalEntityId && r.Period == period && r.Status != PayrollStatus.Approved, cancellationToken).ConfigureAwait(false)
            + await db.Runs.CountAsync(r => r.LegalEntityId == legalEntityId && r.Status != PayrollStatus.Approved && r.To >= start && r.To <= end, cancellationToken).ConfigureAwait(false);

        var unregistered = (await staff.PayInfoAsync(start, end, cancellationToken).ConfigureAwait(false)).Where(e => string.IsNullOrWhiteSpace(e.GosiNo)).Select(e => e.EmployeeId).ToHashSet();
        var wageTasks = await db.GosiTasks.AsNoTracking().Where(t => t.Status == GosiTaskStatus.Open && t.Kind == GosiTaskKind.WageUpdate).Select(t => t.EmployeeId).ToListAsync(cancellationToken).ConfigureAwait(false);
        var lines = staffLines.Select(l => new GosiStatementLine("Staff", l.EmployeeId, l.EmployeeNo, l.Name, l.GosiCategory, l.GosiBase, l.GosiEmployee, l.GosiEmployer,
                unregistered.Contains(l.EmployeeId) ? "not_registered" : wageTasks.Contains(l.EmployeeId) ? "wage_update" : null))
            .Concat(workerLines.Select(l => new GosiStatementLine("Worker", l.WorkerId, l.WorkerNo, l.Name, l.GosiCategory, l.GosiBase, l.GosiEmployee, l.GosiEmployer, null)))
            .ToList();
        var invoice = await db.GosiInvoices.AsNoTracking().FirstOrDefaultAsync(i => i.LegalEntityId == legalEntityId && i.Period == period, cancellationToken).ConfigureAwait(false);
        var employee = lines.Sum(l => l.Employee);
        var employer = lines.Sum(l => l.Employer);
        var due = employee + employer;
        var saudiBase = lines.Where(l => l.Category != nameof(GosiCategory.NonSaudi)).Sum(l => l.Base);

        var scoped = lines.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            scoped = scoped.Where(l => l.Name.Contains(s, StringComparison.OrdinalIgnoreCase) || l.No.Contains(s, StringComparison.OrdinalIgnoreCase));
        }

        if (kind is "Staff" or "Worker")
        {
            scoped = scoped.Where(l => l.Kind == kind);
        }
        else if (kind == "flags")
        {
            scoped = scoped.Where(l => l.Flag is not null);
        }

        var filtered = scoped.OrderBy(l => l.Kind, StringComparer.Ordinal).ThenBy(l => l.No, StringComparer.Ordinal).ToList();
        var size = Math.Clamp(pageSize, 1, 100);
        var at = Math.Max(1, page);
        return new GosiStatementDto(
            legalEntityId, period, lines.Count, staffLines.Count, workerLines.Count, lines.Sum(l => l.Base), saudiBase, lines.Sum(l => l.Base) - saudiBase,
            employee, employer, decimal.Round(lines.Sum(l => l.Base) * 0.02m, 2), due, invoice?.Amount, invoice?.Note, invoice?.EnteredByName,
            invoice is null ? null : invoice.Amount - due, approvedRuns, openRuns,
            lines.GroupBy(l => l.Category).OrderBy(g => g.Key, StringComparer.Ordinal).Select(g => new GosiCategorySum(g.Key, g.Count(), g.Sum(l => l.Base), g.Sum(l => l.Employee), g.Sum(l => l.Employer))).ToList(),
            filtered.Skip((at - 1) * size).Take(size).ToList(), filtered.Count, at, size);
    }

    public async Task<SaudizationSetting> SaudizationSettingAsync(CancellationToken cancellationToken)
    {
        var setting = await db.SaudizationSettings.FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (setting is null)
        {
            setting = SaudizationSetting.Default();
            db.SaudizationSettings.Add(setting);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return setting;
    }

    public async Task<SaudizationSettingsDto> SaudizationSettingsAsync(CancellationToken cancellationToken)
    {
        var setting = await SaudizationSettingAsync(cancellationToken).ConfigureAwait(false);
        var targets = await db.SaudizationTargets.AsNoTracking().ToDictionaryAsync(t => t.LegalEntityId, cancellationToken).ConfigureAwait(false);
        var entities = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).Where(e => e.IsActive).ToList();
        return new SaudizationSettingsDto(setting.FullWage, entities.Select(e => new SaudizationTargetDto(e.Id, e.NameAr, e.NameEn, targets.GetValueOrDefault(e.Id)?.RequiredPercent)).ToList());
    }

    public async Task<Result> SaveSaudizationSettingsAsync(SaudizationSettingsDto input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var setting = await SaudizationSettingAsync(cancellationToken).ConfigureAwait(false);
        var set = setting.Set(input.FullWage);
        if (set.IsFailure)
        {
            return set;
        }

        var targets = await db.SaudizationTargets.ToDictionaryAsync(t => t.LegalEntityId, cancellationToken).ConfigureAwait(false);
        foreach (var t in input.Targets)
        {
            if (!targets.TryGetValue(t.LegalEntityId, out var target))
            {
                if (t.RequiredPercent is null)
                {
                    continue;
                }

                target = SaudizationTarget.Create(t.LegalEntityId);
                db.SaudizationTargets.Add(target);
            }

            // A cleared share means no target for the registration, not a target of zero.
            if (t.RequiredPercent is null)
            {
                db.SaudizationTargets.Remove(target);
                continue;
            }

            var r = target.Set(t.RequiredPercent.Value);
            if (r.IsFailure)
            {
                return r;
            }
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>
    /// Saudization by registration: the active staff and the company's workers on its sponsorship; a Saudi whose
    /// contributory wage is at or above the full wage counts as one, below it as half; the Saudis still needed are
    /// those that bring the counted share up to the required one.
    /// </summary>
    public async Task<IReadOnlyList<SaudizationRow>> SaudizationAsync(CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var setting = await SaudizationSettingAsync(cancellationToken).ConfigureAwait(false);
        var targets = await db.SaudizationTargets.AsNoTracking().ToDictionaryAsync(t => t.LegalEntityId, t => t.RequiredPercent, cancellationToken).ConfigureAwait(false);
        var registered = await db.GosiMembers.AsNoTracking().Where(m => m.RegisteredWage != null && m.ExcludedOn == null)
            .ToDictionaryAsync(m => (m.Kind, m.PersonId), m => m.RegisteredWage!.Value, cancellationToken).ConfigureAwait(false);
        var people = (await staff.PayInfoAsync(today, today, cancellationToken).ConfigureAwait(false))
            .Where(e => e.LegalEntityId is not null && e.Status != "Left" && (e.EndedOn is null || e.EndedOn >= today))
            .Select(e => (Entity: e.LegalEntityId!.Value, Staff: true, Saudi: GosiRules.IsSaudi(e.NationalityCode),
                Wage: registered.TryGetValue((GosiPersonKind.Staff, e.EmployeeId), out var w) ? w : e.Salary is { } s ? s.Basic + s.Housing : 0m))
            .ToList();

        var sponsors = (await db.Sponsors.AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false))
            .GroupBy(s => s.Sponsor.Trim(), StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.First().LegalEntityId, StringComparer.OrdinalIgnoreCase);
        var cards = (await workforce.AvailableAsync(cancellationToken).ConfigureAwait(false)).Concat(await workforce.OnJobAsync(cancellationToken).ConfigureAwait(false))
            .GroupBy(c => c.Id).Select(g => g.First())
            .Where(c => c.Sponsor is { } sp && sponsors.ContainsKey(sp.Trim())).ToList();
        var saudiWorkers = cards.Where(c => GosiRules.IsSaudi(c.NationalityCode)).Select(c => c.Id).ToList();
        var pay = saudiWorkers.Count == 0 ? [] : (await salaries.SalariesAsync(saudiWorkers, cancellationToken).ConfigureAwait(false)).ToDictionary(s => s.WorkerId);
        people.AddRange(cards.Select(c => (Entity: sponsors[c.Sponsor!.Trim()], Staff: false, Saudi: GosiRules.IsSaudi(c.NationalityCode),
            Wage: registered.TryGetValue((GosiPersonKind.Worker, c.Id), out var w) ? w : pay.TryGetValue(c.Id, out var p) ? p.Basic + p.Housing : c.BasicSalary)));

        var entities = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).Where(e => e.IsActive).ToList();
        return entities.Select(e =>
        {
            var mine = people.Where(p => p.Entity == e.Id).ToList();
            var saudis = mine.Where(p => p.Saudi).ToList();
            var half = saudis.Count(p => p.Wage < setting.FullWage);
            var counted = saudis.Count - (half / 2m);
            var total = mine.Count;
            var percent = total == 0 ? 0 : decimal.Round(counted / total * 100, 2);
            decimal? required = targets.TryGetValue(e.Id, out var r) ? r : null;
            var needed = 0;
            if (required is { } req && req > 0 && req < 100 && percent < req)
            {
                needed = (int)Math.Ceiling(((req / 100m * total) - counted) / (1 - (req / 100m)));
            }

            return new SaudizationRow(e.Id, e.NameAr, e.NameEn, total, saudis.Count, saudis.Count(p => p.Staff), saudis.Count(p => !p.Staff), half, counted, percent, required, needed,
                required is { } q && percent < q);
        }).Where(r => r.Total > 0 || r.RequiredPercent is not null).ToList();
    }
}

/// <summary>Payroll months as "2026-10".</summary>
internal static class Periods
{
    public static bool Valid(string? period) =>
        period is { Length: 7 } && int.TryParse(period[..4], out var y) && period[4] == '-' && int.TryParse(period[5..], out var m) && y is >= 2025 and <= 2100 && m is >= 1 and <= 12;

    public static (DateOnly From, DateOnly To) Range(string period)
    {
        var from = new DateOnly(int.Parse(period[..4], System.Globalization.CultureInfo.InvariantCulture), int.Parse(period[5..], System.Globalization.CultureInfo.InvariantCulture), 1);
        return (from, from.AddMonths(1).AddDays(-1));
    }
}

/// <summary>GOSI's alerts: tasks left open, and registrations under their required Saudization.</summary>
internal sealed class GosiAlerts(PayrollDbContext db, GosiService gosi) : IAlertProvider
{
    public const string OpenTasks = "payroll.gosi_task_open";
    public const string SaudizationBelow = "payroll.saudization_below";

    private const string GroupAr = "الرواتب";
    private const string GroupEn = "Payroll";

    public IReadOnlyList<AlertDefinition> Definitions { get; } =
    [
        new(OpenTasks, GroupAr, GroupEn, "مهمة تأمينات اجتماعية مفتوحة", "A GOSI task left open",
            "أيام بعد فتح المهمة", "Days after the task opened", 7, PayrollPermissions.GosiView, PayrollPermissions.GosiManage),
        new(SaudizationBelow, GroupAr, GroupEn, "سجل تجاري تحت نسبة السعودة المطلوبة", "A registration under its required Saudization",
            "", "", 0, PayrollPermissions.GosiView, PayrollPermissions.GosiManage),
    ];

    public async Task<IReadOnlyList<AlertItem>> AlertsAsync(AlertQuery query, IReadOnlySet<string> codes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(codes);
        var alerts = new List<AlertItem>();
        if (codes.Contains(OpenTasks))
        {
            var before = query.Today.AddDays(-query.DaysOf(Definitions[0]));
            var tasks = await db.GosiTasks.AsNoTracking().Where(t => t.Status == GosiTaskStatus.Open).ToListAsync(cancellationToken).ConfigureAwait(false);
            alerts.AddRange(tasks.Where(t => DateOnly.FromDateTime(t.CreatedAt.UtcDateTime) <= before).Select(t => new AlertItem(
                OpenTasks, t.Id.ToString("N"), AlertSeverity.Warning,
                $"{t.Name}: {Kind(t.Kind, true)} في التأمينات لم تتم", $"{t.Name}: {Kind(t.Kind, false)} with GOSI not done",
                t.EmployeeNo, t.EmployeeNo, "/payroll/gosi?tab=tasks", query.Today)));
        }

        if (codes.Contains(SaudizationBelow))
        {
            alerts.AddRange((await gosi.SaudizationAsync(cancellationToken).ConfigureAwait(false)).Where(r => r.Below).Select(r => new AlertItem(
                SaudizationBelow, r.LegalEntityId.ToString("N"), AlertSeverity.Critical,
                $"{r.NameAr}: السعودة {r.Percent}% تحت المطلوبة {r.RequiredPercent}%", $"{r.NameEn}: Saudization {r.Percent}% under the required {r.RequiredPercent}%",
                $"يلزم {r.Needed} سعوديًا", $"{r.Needed} Saudis needed", "/payroll/gosi?tab=saudization", query.Today)));
        }

        return alerts;
    }

    private static string Kind(GosiTaskKind kind, bool ar) => kind switch
    {
        GosiTaskKind.Register => ar ? "التسجيل" : "Registration",
        GosiTaskKind.WageUpdate => ar ? "تحديث الأجر" : "Wage update",
        _ => ar ? "الاستبعاد" : "Exclusion",
    };
}
