using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Housing.Contracts;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

public sealed record DeliveryLineInput(Guid WorkerId, DateOnly? StartOn, decimal? SpecialPrice, string? SpecialReason);

public sealed record DeliveryInput(
    Guid ProjectId,
    DateOnly DeliverOn,
    DateOnly StartOn,
    string ReceiverName,
    string? ReceiverTitle,
    string? DelayReason,
    string? Notes,
    IReadOnlyList<DeliveryLineInput> Lines);

/// <summary>A saved order; <paramref name="ApprovalError"/>: why its approval did not start (e.g. no process applies).</summary>
public sealed record SavedOrderDto(Guid Id, string? ApprovalError);

/// <summary>An available worker for the order form; <paramref name="BusyOrderNo"/>: another open order already has them.</summary>
public sealed record AvailableWorkerDto(WorkerCard Worker, string? BusyOrderNo);

/// <summary>A worker's price on a project from the package that applies to them (for the order form).</summary>
public sealed record WorkerPriceDto(
    WorkerCard Worker,
    bool Busy,
    string? BusyOrderNo,
    Guid? PackageId,
    string? PackageNo,
    bool PackageForProject,
    decimal Salary,
    decimal ServiceFee,
    decimal Housing,
    bool HousingBillable,
    decimal Transport,
    bool TransportBillable,
    decimal? TotalPrice);

/// <summary>What may change on a delivered order: the receiver and notes, and the workers' starts and prices, with the reason.</summary>
public sealed record DeliveryAmendInput(string ReceiverName, string? ReceiverTitle, string? Notes, IReadOnlyList<DeliveryLineChange> Lines, string AmendReason);

/// <summary>
/// Delivery orders written in this system: drafted with prices from the price packages, sent through the company's
/// approval process, then confirmed by the delivery officer for the whole order.
/// </summary>
internal sealed class DeliveryOrderService(
    OperationsDbContext db,
    IWorkforceDirectory workforce,
    IProjectDirectory projects,
    IPriceCatalog prices,
    IApprovalService approvals,
    NumberSequenceService numbering,
    IPeriodLedger ledger,
    IHousingRooms housing,
    ICurrentUser user,
    IClock clock)
{
    /// <summary>The old system's lowest accepted service price (MinServicePrice).</summary>
    public const decimal MinimumServicePrice = 1000m;

    /// <summary>A delivery date older than this many days needs a delay reason.</summary>
    public const int DelayDays = 2;

    private static readonly DeliveryStatus[] Open =
        [DeliveryStatus.UnderPreparation, DeliveryStatus.SentToOperationsManager, DeliveryStatus.InApproval, DeliveryStatus.Returned];

    /// <summary>Saves a new order under preparation and starts its approval (the creator's confirmation comes first).</summary>
    public async Task<Result<SavedOrderDto>> CreateAsync(DeliveryInput input, CancellationToken cancellationToken)
    {
        var built = await BuildAsync(null, input, cancellationToken).ConfigureAwait(false);
        if (built.IsFailure)
        {
            return Result.Failure<SavedOrderDto>(built.Error);
        }

        var now = clock.UtcNow;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, "delivery_order", clock.Today, cancellationToken).ConfigureAwait(false);
        var order = DeliveryOrder.Create(
            number, built.Value.Header, built.Value.Lines,
            Guid.TryParse(user.UserId, out var userId) ? userId : null, user.DisplayName, now);
        db.DeliveryOrders.Add(order);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        var started = await SubmitAsync(order.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success(new SavedOrderDto(order.Id, started.IsFailure ? started.Error.Code : null));
    }

    /// <summary>
    /// Saves changes while the order is under preparation (its creator has not confirmed it yet) or returned. A
    /// returned order (or one whose approval did not start) is sent into approval again.
    /// </summary>
    public async Task<Result<SavedOrderDto>> UpdateAsync(Guid id, DeliveryInput input, CancellationToken cancellationToken)
    {
        var order = await db.DeliveryOrders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<SavedOrderDto>(DeliveryErrors.NotFound);
        }

        if (!order.IsEditable)
        {
            return Result.Failure<SavedOrderDto>(DeliveryErrors.NotEditable);
        }

        var built = await BuildAsync(id, input, cancellationToken).ConfigureAwait(false);
        if (built.IsFailure)
        {
            return Result.Failure<SavedOrderDto>(built.Error);
        }

        db.DeliveryLines.RemoveRange(order.Lines);
        var updated = order.Update(built.Value.Header, built.Value.Lines);
        if (updated.IsFailure)
        {
            return Result.Failure<SavedOrderDto>(updated.Error);
        }

        db.DeliveryLines.AddRange(order.Lines);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        if (order.AwaitingApproval)
        {
            return Result.Success(new SavedOrderDto(order.Id, null));
        }

        var started = await SubmitAsync(order.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success(new SavedOrderDto(order.Id, started.IsFailure ? started.Error.Code : null));
    }

    /// <summary>Checks the workers are still available, then starts the company's approval process for delivery orders.</summary>
    public async Task<Result> SubmitAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.DeliveryOrders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(DeliveryErrors.NotFound);
        }

        var check = await CheckWorkersAsync(id, order.Lines.Where(l => l.WorkerId != null).Select(l => l.WorkerId!.Value).ToList(), cancellationToken).ConfigureAwait(false);
        if (check.IsFailure)
        {
            return check;
        }

        var marked = order.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var started = await approvals.SubmitAsync(
            new ApprovalSubmission(DeliveryOrderAdapter.ScreenCode, order.Id, $"{order.OrderNo} — {order.ProjectName}"), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            // No process applies (or it could not start): the order waits under preparation.
            order.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure(started.Error);
        }

        return Result.Success();
    }

    /// <summary>
    /// Changes a delivered order (its own permission and a reason): the receiver and notes, and for each changed worker
    /// the start of work (their work period moves, the period before it ends that day, never overlapping) and the price
    /// (a special price with its reason, on the work period too).
    /// </summary>
    public async Task<Result> AmendAsync(Guid id, DeliveryAmendInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var order = await db.DeliveryOrders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(DeliveryErrors.NotFound);
        }

        if (!order.IsAmendable)
        {
            return Result.Failure(DeliveryErrors.NotAmendable);
        }

        if (string.IsNullOrWhiteSpace(input.AmendReason))
        {
            return Result.Failure(DeliveryErrors.AmendReason);
        }

        var changed = new List<(DeliveryLine Line, DeliveryLineChange Change)>();
        foreach (var change in input.Lines)
        {
            if (order.Lines.FirstOrDefault(l => l.Id == change.LineId) is not { } line)
            {
                return Result.Failure(DeliveryErrors.LineNotFound);
            }

            if (change.StartedOn != line.StartedOn || change.TotalPrice != line.TotalPrice)
            {
                if (change.TotalPrice != line.TotalPrice && (change.TotalPrice <= 0 || string.IsNullOrWhiteSpace(change.SpecialReason)))
                {
                    return Result.Failure(DeliveryErrors.SpecialReason);
                }

                changed.Add((line, change));
            }
        }

        // The work periods first (each worker's), then the order.
        foreach (var (line, change) in changed.Where(c => c.Line.WorkerId is not null))
        {
            var moved = await ledger.AmendAsync(
                new PeriodAmendRequest(line.WorkerId!.Value, order.Id, change.StartedOn, false, null, order.OrderNo, change.TotalPrice != line.TotalPrice ? change.TotalPrice : null),
                cancellationToken).ConfigureAwait(false);
            if (moved.IsFailure)
            {
                return Result.Failure(moved.Error.Code == "conflict.period_overlap" ? DeliveryErrors.PeriodOverlap : moved.Error);
            }
        }

        var amended = order.Amend(input.ReceiverName, input.ReceiverTitle, input.Notes, changed.Select(c => c.Change).ToList(), input.AmendReason, user.DisplayName, clock.UtcNow);
        if (amended.IsFailure)
        {
            return amended;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>
    /// Cancels a delivered order (its own permission and a reason): every worker's work period it opened is taken back —
    /// only when none of them has an action after it (all or none) — the period before it is open again, and the workers
    /// go back to the rooms they left that day.
    /// </summary>
    public async Task<Result> CancelApprovedAsync(Guid id, string? reason, CancellationToken cancellationToken)
    {
        var order = await db.DeliveryOrders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(DeliveryErrors.NotFound);
        }

        if (!order.IsAmendable)
        {
            return Result.Failure(DeliveryErrors.NotAmendable);
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            return Result.Failure(DeliveryErrors.AmendReason);
        }

        var workers = order.Lines.Where(l => l.WorkerId is not null).Select(l => (WorkerId: l.WorkerId!.Value, l.StartedOn)).ToList();
        foreach (var (workerId, _) in workers)
        {
            var timeline = await ledger.PeriodsAsync(workerId, cancellationToken).ConfigureAwait(false);
            if (timeline.Any(p => p.SourceId == order.Id) && timeline[0].SourceId != order.Id)
            {
                return Result.Failure(DeliveryErrors.LaterPeriod);
            }
        }

        foreach (var (workerId, _) in workers)
        {
            var undone = await ledger.UndoAsync(workerId, order.Id, cancellationToken).ConfigureAwait(false);
            if (undone.IsFailure)
            {
                return Result.Failure(undone.Error.Code == "conflict.period_not_last" ? DeliveryErrors.LaterPeriod : undone.Error);
            }
        }

        foreach (var day in workers.Where(w => w.StartedOn is not null).GroupBy(w => w.StartedOn!.Value))
        {
            await housing.ReopenAsync(day.Select(w => w.WorkerId).ToList(), day.Key, cancellationToken).ConfigureAwait(false);
        }

        var canceled = order.CancelApproved(reason, user.DisplayName, clock.UtcNow);
        if (canceled.IsFailure)
        {
            return canceled;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> CancelAsync(Guid id, string? comment, CancellationToken cancellationToken)
    {
        var order = await db.DeliveryOrders.FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(DeliveryErrors.NotFound);
        }

        var canceled = order.Cancel(comment);
        if (canceled.IsFailure)
        {
            return canceled;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>
    /// For the order form: each worker's card, whether another open order already has them, and their price on the
    /// project from the package of their profession and nationality.
    /// </summary>
    public async Task<Result<IReadOnlyList<WorkerPriceDto>>> PriceAsync(Guid projectId, IReadOnlyList<Guid> workerIds, DateOnly on, Guid? exceptOrderId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(workerIds);
        var project = await ProjectAsync(projectId, cancellationToken).ConfigureAwait(false);
        if (project is null)
        {
            return Result.Failure<IReadOnlyList<WorkerPriceDto>>(Errors.Project);
        }

        var cards = await workforce.CardsAsync(workerIds, cancellationToken).ConfigureAwait(false);
        var busy = await BusyAsync(exceptOrderId, workerIds, cancellationToken).ConfigureAwait(false);
        var result = new List<WorkerPriceDto>();
        foreach (var card in cards)
        {
            var package = card.ProfessionCode is { } profession
                ? await prices.FindAsync(projectId, profession, card.NationalityCode, on, cancellationToken).ConfigureAwait(false)
                : null;
            var salary = package is null || project.ContractType == "CostPlus" ? card.TotalSalary : package.Salary;
            result.Add(new WorkerPriceDto(
                card, busy.ContainsKey(card.Id), busy.GetValueOrDefault(card.Id),
                package?.PackageId, package?.PackageNo, package?.ForProject ?? false,
                salary, package?.ServiceFee ?? 0, package?.Housing ?? 0, package?.HousingBillable ?? false,
                package?.Transport ?? 0, package?.TransportBillable ?? false,
                package is null ? null : salary + package.ServiceFee + package.Housing + package.Transport));
        }

        return Result.Success<IReadOnlyList<WorkerPriceDto>>(result);
    }

    /// <summary>Every available worker, with the open order that already has them (if any), for the order form's list.</summary>
    public async Task<IReadOnlyList<AvailableWorkerDto>> AvailableAsync(Guid? exceptOrderId, CancellationToken cancellationToken)
    {
        var cards = await workforce.AvailableAsync(cancellationToken).ConfigureAwait(false);
        var busy = await BusyAsync(exceptOrderId, cards.Select(c => c.Id).ToList(), cancellationToken).ConfigureAwait(false);
        return cards.Select(c => new AvailableWorkerDto(c, busy.GetValueOrDefault(c.Id))).ToList();
    }

    private async Task<Result<(DeliveryHeader Header, List<DeliveryLineValues> Lines)>> BuildAsync(Guid? orderId, DeliveryInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var project = await ProjectAsync(input.ProjectId, cancellationToken).ConfigureAwait(false);
        if (project is null || !project.IsActive)
        {
            return Fail(Errors.Project);
        }

        if (input.StartOn < input.DeliverOn)
        {
            return Fail(DeliveryErrors.StartBeforeDelivery);
        }

        if (string.IsNullOrWhiteSpace(input.ReceiverName))
        {
            return Fail(Errors.Receiver);
        }

        if (input.DeliverOn < clock.Today.AddDays(-DelayDays) && string.IsNullOrWhiteSpace(input.DelayReason))
        {
            return Fail(Errors.DelayReason);
        }

        if (input.Lines is null || input.Lines.Count == 0)
        {
            return Fail(DeliveryErrors.NoWorkers);
        }

        var workerIds = input.Lines.Select(l => l.WorkerId).ToList();
        if (workerIds.Distinct().Count() != workerIds.Count)
        {
            return Fail(Errors.Duplicate);
        }

        var check = await CheckWorkersAsync(orderId, workerIds, cancellationToken).ConfigureAwait(false);
        if (check.IsFailure)
        {
            return Fail(check.Error);
        }

        var priced = await PriceAsync(project.Id, workerIds, input.StartOn, orderId, cancellationToken).ConfigureAwait(false);
        var byWorker = priced.Value.ToDictionary(p => p.Worker.Id);
        var lines = new List<DeliveryLineValues>();
        foreach (var line in input.Lines)
        {
            var p = byWorker[line.WorkerId];
            if (line.StartOn is { } start && start < input.DeliverOn)
            {
                return Fail(DeliveryErrors.StartBeforeDelivery);
            }

            var special = line.SpecialPrice is { } price && price != p.TotalPrice;
            if (!special && p.TotalPrice is null)
            {
                return Fail(Errors.NoPrice);
            }

            if (special && string.IsNullOrWhiteSpace(line.SpecialReason))
            {
                return Fail(Errors.SpecialReason);
            }

            var total = special ? line.SpecialPrice!.Value : p.TotalPrice!.Value;
            if (total < MinimumServicePrice)
            {
                return Fail(Errors.Minimum);
            }

            var fee = total - p.Salary - p.Housing - p.Transport;
            if (fee < 0)
            {
                return Fail(Errors.BelowCost);
            }

            var w = p.Worker;
            lines.Add(new DeliveryLineValues(
                w.Id, w.CrmId, w.WorkerNo, w.Name, w.ProfessionCode, w.NationalityCode, w.IqamaNo, p.PackageId, p.PackageNo,
                p.Salary, fee, p.Housing, p.HousingBillable, p.Transport, p.TransportBillable,
                special, special ? line.SpecialReason!.Trim() : null, line.StartOn));
        }

        var header = new DeliveryHeader(
            project.Id, project.CrmId, project.Code, project.Name, project.CustomerName, project.Manager, project.ContractType,
            input.DeliverOn, input.StartOn, input.ReceiverName, input.ReceiverTitle, input.DelayReason, input.Notes);
        return Result.Success((header, lines));

        static Result<(DeliveryHeader, List<DeliveryLineValues>)> Fail(Error error) => Result.Failure<(DeliveryHeader, List<DeliveryLineValues>)>(error);
    }

    private async Task<ProjectInfo?> ProjectAsync(Guid id, CancellationToken cancellationToken) =>
        await projects.FindAsync([id], [], cancellationToken).ConfigureAwait(false) is [var project, ..] ? project : null;

    /// <summary>Every worker exists, is available (in housing, or new) and is not on another open order.</summary>
    private async Task<Result> CheckWorkersAsync(Guid? orderId, IReadOnlyList<Guid> workerIds, CancellationToken cancellationToken)
    {
        var cards = await workforce.CardsAsync(workerIds, cancellationToken).ConfigureAwait(false);
        if (cards.Count != workerIds.Distinct().Count() || cards.Any(c => !c.Available))
        {
            return Result.Failure(Errors.Unavailable);
        }

        var busy = await BusyAsync(orderId, workerIds, cancellationToken).ConfigureAwait(false);
        return busy.Count > 0 ? Result.Failure(Errors.Busy) : Result.Success();
    }

    /// <summary>Workers already on another open order of this system, with that order's number.</summary>
    private async Task<Dictionary<Guid, string>> BusyAsync(Guid? exceptOrderId, IReadOnlyCollection<Guid> workerIds, CancellationToken cancellationToken)
    {
        var ids = workerIds.ToList();
        var rows = await db.DeliveryLines.AsNoTracking()
            .Where(l => l.WorkerId != null && ids.Contains(l.WorkerId.Value))
            .Join(db.DeliveryOrders, l => l.OrderId, o => o.Id, (l, o) => new { l.WorkerId, o.Id, o.OrderNo, o.Status, o.Source })
            .Where(x => x.Source == DocumentSource.System && x.Id != exceptOrderId && Open.Contains(x.Status))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.GroupBy(r => r.WorkerId!.Value).ToDictionary(g => g.Key, g => g.First().OrderNo);
    }

    private static class Errors
    {
        public static readonly Error Project = Error.Validation("delivery_project", "Choose an active project.");
        public static readonly Error Receiver = Error.Validation("delivery_receiver", "The receiver's name is required.");
        public static readonly Error DelayReason = Error.Validation("delivery_delay_reason", "The delivery date is more than two days ago: write the reason for the delay.");
        public static readonly Error Duplicate = Error.Validation("delivery_worker_duplicate", "A worker is on the order twice.");
        public static readonly Error Unavailable = Error.Validation("delivery_worker_unavailable", "A worker is not available for delivery (not in housing).");
        public static readonly Error Busy = Error.Conflict("delivery_worker_busy", "A worker is already on another open delivery order.");
        public static readonly Error NoPrice = Error.Validation("delivery_no_price", "A worker has no package for their profession and nationality: enter a special price with a reason.");
        public static readonly Error SpecialReason = Error.Validation("delivery_special_reason", "A special price needs a reason.");
        public static readonly Error Minimum = Error.Validation("delivery_price_minimum", "The service price cannot be less than 1,000.");
        public static readonly Error BelowCost = Error.Validation("delivery_price_below_cost", "The service price is less than the salary, housing and transport.");
    }
}
