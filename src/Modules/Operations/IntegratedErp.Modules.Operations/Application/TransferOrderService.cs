using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

public sealed record TransferLineInput(Guid WorkerId, decimal? SpecialPrice, string? SpecialReason);

public sealed record TransferInput(
    Guid ProjectId,
    DateOnly TransferOn,
    string? ReceiverName,
    string? ReceiverTitle,
    string? DelayReason,
    string? Notes,
    IReadOnlyList<TransferLineInput> Lines);

/// <summary>
/// Transfer orders: workers on the job moved to another project with the new project's package price. Saved under
/// preparation and sent through the company's approval process at once (the creator's confirmation comes first).
/// </summary>
internal sealed class TransferOrderService(
    OperationsDbContext db,
    IWorkforceDirectory workforce,
    IProjectDirectory projects,
    DeliveryOrderService delivery,
    IApprovalService approvals,
    NumberSequenceService numbering,
    ICurrentUser user,
    IClock clock)
{
    internal static readonly TransferStatus[] Open =
        [TransferStatus.UnderPreparation, TransferStatus.SentToOperationsManager, TransferStatus.InApproval, TransferStatus.Returned];

    /// <summary>Every worker on the job, with the open transfer or return order that already has them (if any), for the form's list.</summary>
    public async Task<IReadOnlyList<OnJobWorkerDto>> OnJobAsync(Guid? exceptOrderId, CancellationToken cancellationToken)
    {
        var cards = await workforce.OnJobAsync(cancellationToken).ConfigureAwait(false);
        var busy = await BusyAsync(db, exceptOrderId, cards.Select(c => c.Id).ToList(), cancellationToken).ConfigureAwait(false);
        return cards.Select(c => new OnJobWorkerDto(c, busy.GetValueOrDefault(c.Id))).ToList();
    }

    public async Task<Result<SavedOrderDto>> CreateAsync(TransferInput input, CancellationToken cancellationToken)
    {
        var built = await BuildAsync(null, input, cancellationToken).ConfigureAwait(false);
        if (built.IsFailure)
        {
            return Result.Failure<SavedOrderDto>(built.Error);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, "transfer_order", clock.Today, cancellationToken).ConfigureAwait(false);
        var order = TransferOrder.Create(
            number, built.Value.Header, built.Value.Lines,
            Guid.TryParse(user.UserId, out var userId) ? userId : null, user.DisplayName, clock.UtcNow);
        db.TransferOrders.Add(order);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        var started = await SubmitAsync(order.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success(new SavedOrderDto(order.Id, started.IsFailure ? started.Error.Code : null));
    }

    /// <summary>Saves changes while the order is under preparation or returned; a returned order goes into approval again.</summary>
    public async Task<Result<SavedOrderDto>> UpdateAsync(Guid id, TransferInput input, CancellationToken cancellationToken)
    {
        var order = await db.TransferOrders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<SavedOrderDto>(TransferErrors.NotFound);
        }

        if (!order.IsEditable)
        {
            return Result.Failure<SavedOrderDto>(TransferErrors.NotEditable);
        }

        var built = await BuildAsync(id, input, cancellationToken).ConfigureAwait(false);
        if (built.IsFailure)
        {
            return Result.Failure<SavedOrderDto>(built.Error);
        }

        db.TransferLines.RemoveRange(order.Lines);
        var updated = order.Update(built.Value.Header, built.Value.Lines);
        if (updated.IsFailure)
        {
            return Result.Failure<SavedOrderDto>(updated.Error);
        }

        db.TransferLines.AddRange(order.Lines);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        if (order.AwaitingApproval)
        {
            return Result.Success(new SavedOrderDto(order.Id, null));
        }

        var started = await SubmitAsync(order.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success(new SavedOrderDto(order.Id, started.IsFailure ? started.Error.Code : null));
    }

    /// <summary>Checks the workers are still on the job and free, then starts the company's approval process for transfer orders.</summary>
    public async Task<Result> SubmitAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.TransferOrders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(TransferErrors.NotFound);
        }

        var check = await CheckWorkersAsync(id, order.ProjectCrmId, order.TransferOn, order.Lines.Select(l => l.WorkerId).ToList(), cancellationToken).ConfigureAwait(false);
        if (check.IsFailure)
        {
            return Result.Failure(check.Error);
        }

        var marked = order.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var started = await approvals.SubmitAsync(
            new ApprovalSubmission(TransferOrderAdapter.ScreenCode, order.Id, $"{order.OrderNo} — {order.ProjectName}"), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            order.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure(started.Error);
        }

        return Result.Success();
    }

    public async Task<Result> CancelAsync(Guid id, string? comment, CancellationToken cancellationToken)
    {
        var order = await db.TransferOrders.FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(TransferErrors.NotFound);
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
    /// Workers already on another open transfer or return order of this system, with that order's number: a worker
    /// cannot be moved twice at once.
    /// </summary>
    internal static async Task<Dictionary<Guid, string>> BusyAsync(OperationsDbContext db, Guid? exceptOrderId, IReadOnlyCollection<Guid> workerIds, CancellationToken cancellationToken)
    {
        var ids = workerIds.ToList();
        var transfers = await db.TransferLines.AsNoTracking()
            .Where(l => ids.Contains(l.WorkerId))
            .Join(db.TransferOrders, l => l.OrderId, o => o.Id, (l, o) => new { l.WorkerId, o.Id, o.OrderNo, o.Status })
            .Where(x => x.Id != exceptOrderId && Open.Contains(x.Status))
            .Select(x => new { x.WorkerId, x.OrderNo })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var returns = await db.ReturnOrders.AsNoTracking()
            .Where(o => o.WorkerId != null && ids.Contains(o.WorkerId.Value) && o.Source == DocumentSource.System && o.Id != exceptOrderId
                && ReturnOrderService.Open.Contains(o.Status))
            .Select(o => new { WorkerId = o.WorkerId!.Value, o.OrderNo })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return transfers.Concat(returns).GroupBy(r => r.WorkerId).ToDictionary(g => g.Key, g => g.First().OrderNo);
    }

    private async Task<Result<(TransferHeader Header, List<TransferLineValues> Lines)>> BuildAsync(Guid? orderId, TransferInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var project = await projects.FindAsync([input.ProjectId], [], cancellationToken).ConfigureAwait(false) is [var p, ..] ? p : null;
        if (project is null || !project.IsActive)
        {
            return Fail(Errors.Project);
        }

        if (input.TransferOn < clock.Today.AddDays(-DeliveryOrderService.DelayDays) && string.IsNullOrWhiteSpace(input.DelayReason))
        {
            return Fail(Errors.DelayReason);
        }

        if (input.Lines is null || input.Lines.Count == 0)
        {
            return Fail(TransferErrors.NoWorkers);
        }

        var workerIds = input.Lines.Select(l => l.WorkerId).ToList();
        if (workerIds.Distinct().Count() != workerIds.Count)
        {
            return Fail(Errors.Duplicate);
        }

        var check = await CheckWorkersAsync(orderId, project.CrmId, input.TransferOn, workerIds, cancellationToken).ConfigureAwait(false);
        if (check.IsFailure)
        {
            return Fail(check.Error);
        }

        var priced = await delivery.PriceAsync(project.Id, workerIds, input.TransferOn, null, cancellationToken).ConfigureAwait(false);
        var byWorker = priced.Value.ToDictionary(x => x.Worker.Id);
        var from = check.Value.Where(c => c.ProjectCrmId is not null).Select(c => c.ProjectCrmId!.Value).Distinct().ToList();
        var fromProjects = (await projects.FindAsync([], from, cancellationToken).ConfigureAwait(false)).ToDictionary(x => x.CrmId);
        var lines = new List<TransferLineValues>();
        foreach (var line in input.Lines)
        {
            var quote = byWorker[line.WorkerId];
            var special = line.SpecialPrice is { } price && price != quote.TotalPrice;
            if (!special && quote.TotalPrice is null)
            {
                return Fail(Errors.NoPrice);
            }

            if (special && string.IsNullOrWhiteSpace(line.SpecialReason))
            {
                return Fail(Errors.SpecialReason);
            }

            var total = special ? line.SpecialPrice!.Value : quote.TotalPrice!.Value;
            if (total < DeliveryOrderService.MinimumServicePrice)
            {
                return Fail(Errors.Minimum);
            }

            var fee = total - quote.Salary - quote.Housing - quote.Transport;
            if (fee < 0)
            {
                return Fail(Errors.BelowCost);
            }

            var w = quote.Worker;
            var old = w.ProjectCrmId is { } crm ? fromProjects.GetValueOrDefault(crm) : null;
            lines.Add(new TransferLineValues(
                w.Id, w.CrmId, w.WorkerNo, w.Name, w.ProfessionCode, w.NationalityCode, w.IqamaNo,
                old?.Id, w.ProjectCrmId, old?.Name ?? w.ProjectName, w.ProjectJoinedOn,
                quote.PackageId, quote.PackageNo, quote.Salary, fee, quote.Housing, quote.HousingBillable, quote.Transport, quote.TransportBillable,
                special, special ? line.SpecialReason!.Trim() : null));
        }

        var header = new TransferHeader(
            project.Id, project.CrmId, project.Code, project.Name, project.CustomerName, project.Manager, project.ContractType,
            input.TransferOn, input.ReceiverName, input.ReceiverTitle, input.DelayReason, input.Notes);
        return Result.Success((header, lines));

        static Result<(TransferHeader, List<TransferLineValues>)> Fail(Error error) => Result.Failure<(TransferHeader, List<TransferLineValues>)>(error);
    }

    /// <summary>
    /// Every worker exists, is on the job on another project since before the transfer date, and is not on another open
    /// transfer or return order.
    /// </summary>
    private async Task<Result<IReadOnlyList<WorkerCard>>> CheckWorkersAsync(Guid? orderId, Guid projectCrmId, DateOnly transferOn, IReadOnlyList<Guid> workerIds, CancellationToken cancellationToken)
    {
        var cards = await workforce.CardsAsync(workerIds, cancellationToken).ConfigureAwait(false);
        if (cards.Count != workerIds.Distinct().Count() || cards.Any(c => !c.OnJob))
        {
            return Result.Failure<IReadOnlyList<WorkerCard>>(Errors.NotOnJob);
        }

        if (cards.Any(c => c.ProjectCrmId == projectCrmId))
        {
            return Result.Failure<IReadOnlyList<WorkerCard>>(Errors.SameProject);
        }

        if (cards.Any(c => c.ProjectJoinedOn is { } started && transferOn <= started))
        {
            return Result.Failure<IReadOnlyList<WorkerCard>>(Errors.BeforeWork);
        }

        var busy = await BusyAsync(db, orderId, workerIds, cancellationToken).ConfigureAwait(false);
        return busy.Count > 0 ? Result.Failure<IReadOnlyList<WorkerCard>>(Errors.Busy) : Result.Success(cards);
    }

    private static class Errors
    {
        public static readonly Error Project = Error.Validation("transfer_project", "Choose an active project.");
        public static readonly Error DelayReason = Error.Validation("transfer_delay_reason", "The transfer date is more than two days ago: write the reason for the delay.");
        public static readonly Error Duplicate = Error.Validation("transfer_worker_duplicate", "A worker is on the order twice.");
        public static readonly Error NotOnJob = Error.Validation("transfer_not_on_job", "A worker is not on the job.");
        public static readonly Error SameProject = Error.Validation("transfer_same_project", "A worker is already on this project.");
        public static readonly Error BeforeWork = Error.Validation("transfer_before_work", "The transfer date must be after the worker's start of work on their current project.");
        public static readonly Error Busy = Error.Conflict("transfer_worker_busy", "A worker is already on another open transfer or return order.");
        public static readonly Error NoPrice = Error.Validation("transfer_no_price", "A worker has no package on the new project for their profession and nationality: enter a special price with a reason.");
        public static readonly Error SpecialReason = Error.Validation("transfer_special_reason", "A special price needs a reason.");
        public static readonly Error Minimum = Error.Validation("transfer_price_minimum", "The service price cannot be less than 1,000.");
        public static readonly Error BelowCost = Error.Validation("transfer_price_below_cost", "The service price is less than the salary, housing and transport.");
    }
}
