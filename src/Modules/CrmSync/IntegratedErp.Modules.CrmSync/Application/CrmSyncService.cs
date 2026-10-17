using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.CrmSync.Application;

/// <summary>Wakes the sync worker when someone asks for a run.</summary>
internal sealed class CrmSyncSignal
{
    private readonly Channel<bool> _channel = Channel.CreateBounded<bool>(new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropWrite });

    public void Wake() => _channel.Writer.TryWrite(true);

    public async Task WaitAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        using var timer = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timer.CancelAfter(timeout);
        try
        {
            await _channel.Reader.ReadAsync(timer.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // Timed out: time for a scheduled run.
        }
    }
}

public sealed record EntityStatusDto(
    string Entity,
    string NameAr,
    string NameEn,
    int Records,
    int Deleted,
    DateTime? LastChangeCopied,
    DateTimeOffset? LastSucceededAt,
    DateTimeOffset? LastFailedAt,
    string? LastError);

public sealed record SyncRunDto(
    Guid Id,
    string Mode,
    string Status,
    string RequestedBy,
    DateTimeOffset RequestedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    IReadOnlyList<EntitySyncResult> Results,
    string? Error);

public sealed record SyncStatusDto(
    bool Configured,
    string Company,
    bool IsThisCompany,
    int IntervalMinutes,
    IReadOnlyList<EntityStatusDto> Entities,
    IReadOnlyList<SyncRunDto> Runs);

/// <summary>
/// Copies the CRM entities phase 1 needs into staging: page by page in (modifiedon, id) order, so an incremental run
/// reads only what changed since the last one; a full run reads everything and marks records no longer in the CRM
/// as deleted. Each entity is independent: one failing does not stop the others.
/// </summary>
internal sealed class CrmSyncService(
    CrmSyncDbContext db,
    ICrmSource crm,
    IClock clock,
    IOptions<CrmSyncOptions> options,
    ITenantContext tenant,
    ITenantDirectory tenants,
    CrmSyncSignal signal)
{
    public static readonly Error NotConfigured = Error.Validation("crm_sync_not_configured", "The CRM connection is not configured.");
    public static readonly Error OtherCompany = Error.Validation("crm_sync_other_company", "The CRM's data belongs to another company.");
    public static readonly Error AlreadyRunning = Error.Conflict("crm_sync_running", "A sync is already queued or running.");

    private static readonly JsonSerializerOptions PayloadJson = new() { WriteIndented = false };

    /// <summary>Whether the current company is the one the CRM's data belongs to.</summary>
    public async Task<bool> IsThisCompanyAsync(CancellationToken cancellationToken)
    {
        var company = await tenants.FindByCodeAsync(options.Value.Company, cancellationToken).ConfigureAwait(false);
        return company is not null && company.Id == tenant.TenantId;
    }

    public async Task<SyncStatusDto> StatusAsync(CancellationToken cancellationToken)
    {
        var counts = await db.Records.AsNoTracking()
            .GroupBy(r => r.Entity)
            .Select(g => new { g.Key, Live = g.Count(r => !r.IsDeleted), Deleted = g.Count(r => r.IsDeleted) })
            .ToDictionaryAsync(x => x.Key, cancellationToken).ConfigureAwait(false);
        var states = await db.States.AsNoTracking().ToDictionaryAsync(s => s.Entity, cancellationToken).ConfigureAwait(false);
        var entities = CrmEntities.All.Select(e =>
        {
            var count = counts.GetValueOrDefault(e.Name);
            var state = states.GetValueOrDefault(e.Name);
            return new EntityStatusDto(
                e.Name, e.NameAr, e.NameEn, count?.Live ?? 0, count?.Deleted ?? 0,
                state?.WatermarkModifiedOn, state?.LastSucceededAt, state?.LastFailedAt, state?.LastError);
        }).ToList();
        var runs = await db.Runs.AsNoTracking().OrderByDescending(r => r.RequestedAt).Take(10)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        return new SyncStatusDto(
            !string.IsNullOrWhiteSpace(options.Value.ConnectionString),
            options.Value.Company,
            await IsThisCompanyAsync(cancellationToken).ConfigureAwait(false),
            options.Value.IntervalMinutes,
            entities,
            runs.Select(ToDto).ToList());
    }

    /// <summary>Queues a run for the worker (one at a time).</summary>
    public async Task<Result<SyncRunDto>> RequestAsync(SyncMode mode, string requestedBy, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(options.Value.ConnectionString))
        {
            return Result.Failure<SyncRunDto>(NotConfigured);
        }

        if (!await IsThisCompanyAsync(cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<SyncRunDto>(OtherCompany);
        }

        if (await db.Runs.AnyAsync(r => r.Status == SyncRunStatus.Queued || r.Status == SyncRunStatus.Running, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<SyncRunDto>(AlreadyRunning);
        }

        var run = new SyncRun(mode, requestedBy, clock.UtcNow);
        db.Runs.Add(run);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        signal.Wake();
        return Result.Success(ToDto(run));
    }

    /// <summary>Runs the oldest queued run, if any (called by the worker in the company's context).</summary>
    public async Task<bool> RunNextAsync(CancellationToken cancellationToken)
    {
        var run = await db.Runs.Where(r => r.Status == SyncRunStatus.Queued).OrderBy(r => r.RequestedAt)
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return false;
        }

        await RunAsync(run, cancellationToken).ConfigureAwait(false);
        return true;
    }

    /// <summary>Queues a scheduled incremental run unless one is already waiting or running.</summary>
    public async Task QueueScheduledAsync(CancellationToken cancellationToken)
    {
        if (!await db.Runs.AnyAsync(r => r.Status == SyncRunStatus.Queued || r.Status == SyncRunStatus.Running, cancellationToken).ConfigureAwait(false))
        {
            db.Runs.Add(new SyncRun(SyncMode.Incremental, "scheduled", clock.UtcNow));
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    /// <summary>A run left "running" by a stopped server is marked failed so the next one can start.</summary>
    public async Task RecoverInterruptedAsync(CancellationToken cancellationToken)
    {
        foreach (var run in await db.Runs.Where(r => r.Status == SyncRunStatus.Running).ToListAsync(cancellationToken).ConfigureAwait(false))
        {
            run.Finish(SyncRunStatus.Failed, "[]", "Interrupted: the server stopped during the run.", clock.UtcNow);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    internal async Task RunAsync(SyncRun run, CancellationToken cancellationToken)
    {
        run.Start(clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var results = new List<EntitySyncResult>();
        foreach (var entity in CrmEntities.All)
        {
            try
            {
                results.Add(await SyncEntityAsync(entity, run, cancellationToken).ConfigureAwait(false));
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
            {
                DetachStaged();
                var state = await StateAsync(entity.Name, cancellationToken).ConfigureAwait(false);
                state.Failed(ex.Message, clock.UtcNow);
                await db.SaveChangesAsync(CancellationToken.None).ConfigureAwait(false);
                results.Add(new EntitySyncResult(entity.Name, 0, 0, 0, 0, ex.Message));
            }
        }

        var failed = results.Count(r => r.Error is not null);
        var status = failed == 0 ? SyncRunStatus.Succeeded : failed == results.Count ? SyncRunStatus.Failed : SyncRunStatus.PartlyFailed;
        run.Finish(status, JsonSerializer.Serialize(results), failed == 0 ? null : results.First(r => r.Error is not null).Error, clock.UtcNow);
        await db.SaveChangesAsync(CancellationToken.None).ConfigureAwait(false);
    }

    private async Task<EntitySyncResult> SyncEntityAsync(CrmEntity entity, SyncRun run, CancellationToken cancellationToken)
    {
        var state = await StateAsync(entity.Name, cancellationToken).ConfigureAwait(false);
        if (run.Mode == SyncMode.Full)
        {
            state.Restart();
        }

        var pageSize = Math.Clamp(options.Value.PageSize, 50, 5000);
        int read = 0, inserted = 0, updated = 0;
        while (true)
        {
            var page = await crm.ReadPageAsync(entity, state.WatermarkModifiedOn, state.WatermarkId, pageSize, cancellationToken).ConfigureAwait(false);
            if (page.Count == 0)
            {
                break;
            }

            var ids = page.Select(r => r.Id).ToList();
            var existing = await db.Records.Where(r => r.Entity == entity.Name && ids.Contains(r.CrmId))
                .ToDictionaryAsync(r => r.CrmId, cancellationToken).ConfigureAwait(false);
            var now = clock.UtcNow;
            foreach (var row in page)
            {
                var payload = JsonSerializer.Serialize(row.Values, PayloadJson);
                var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload)));
                if (existing.TryGetValue(row.Id, out var record))
                {
                    updated += record.Refresh(row.ModifiedOn, row.StateCode, payload, hash, run.Id, now) ? 1 : 0;
                }
                else
                {
                    db.Records.Add(new StagedRecord(entity.Name, row.Id, row.ModifiedOn, row.StateCode, payload, hash, run.Id, now));
                    inserted++;
                }
            }

            read += page.Count;
            state.Advance(page[^1].ModifiedOn, page[^1].Id);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            DetachStaged();
            if (page.Count < pageSize)
            {
                break;
            }
        }

        var deleted = 0;
        if (run.Mode == SyncMode.Full)
        {
            deleted = await db.Records
                .Where(r => r.Entity == entity.Name && r.LastSeenRunId != run.Id && !r.IsDeleted)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.IsDeleted, true), cancellationToken).ConfigureAwait(false);
        }

        state.Succeeded(clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return new EntitySyncResult(entity.Name, read, inserted, updated, deleted, null);
    }

    private async Task<SyncState> StateAsync(string entity, CancellationToken cancellationToken)
    {
        var state = await db.States.FirstOrDefaultAsync(s => s.Entity == entity, cancellationToken).ConfigureAwait(false);
        if (state is null)
        {
            state = new SyncState(entity);
            db.States.Add(state);
        }

        return state;
    }

    // Staged records are many and large: keep the change tracker small between pages.
    private void DetachStaged()
    {
        foreach (var entry in db.ChangeTracker.Entries<StagedRecord>().ToList())
        {
            entry.State = EntityState.Detached;
        }
    }

    private static SyncRunDto ToDto(SyncRun r) => new(
        r.Id, r.Mode.ToString(), r.Status.ToString(), r.RequestedBy, r.RequestedAt, r.StartedAt, r.FinishedAt,
        r.Results is null ? [] : JsonSerializer.Deserialize<List<EntitySyncResult>>(r.Results) ?? [],
        r.Error);
}
