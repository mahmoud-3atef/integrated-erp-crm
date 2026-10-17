using System.Globalization;
using System.Text.Json;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>
/// Copies the old system's delivery orders (CRM new_deliverorder) after every sync, read-only, so the list shows them
/// with the orders written here. Workers come from the order's worker numbers (new_laborsnumber) and from the work
/// starts made from it (new_empwork), with their prices. Only what changed is copied again.
/// </summary>
internal sealed class DeliveryOrderImportService(
    OperationsDbContext db,
    ICrmStaging staging,
    IWorkforceDirectory workforce,
    IProjectDirectory projects) : ICrmStagingConsumer
{
    private static readonly TimeSpan Riyadh = TimeSpan.FromHours(3);

    public string Name => "delivery orders";

    /// <summary>The old status of a delivery order and what it means here.</summary>
    public static DeliveryStatus StatusOf(int? code) => code switch
    {
        279640001 => DeliveryStatus.Delivered,
        279640003 => DeliveryStatus.NotDelivered,
        279640000 => DeliveryStatus.UnderPreparation,
        279640011 => DeliveryStatus.SentToOperationsManager,
        279640007 => DeliveryStatus.Returned,
        2 => DeliveryStatus.Canceled,
        _ => DeliveryStatus.InApproval,
    };

    public async Task<string> ApplyAsync(CancellationToken cancellationToken)
    {
        // Shared by the delivery and housing order imports (one scope): reuse the one already loaded or added.
        var state = db.Imports.Local.FirstOrDefault() ?? await db.Imports.FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (state is null)
        {
            state = new OperationsImport();
            db.Imports.Add(state);
        }

        var orderChanges = await staging.ChangedSinceAsync("new_deliverorder", state.OrdersWatermark, cancellationToken).ConfigureAwait(false);
        var workStartChanges = await staging.ChangedSinceAsync("new_empwork", state.WorkStartsWatermark, cancellationToken).ConfigureAwait(false);
        if (orderChanges.Count == 0 && workStartChanges.Count == 0)
        {
            return "no changes";
        }

        // The work starts of every order (a work start made later changes its order's lines).
        var allWorkStarts = state.WorkStartsWatermark is null ? workStartChanges : await staging.ChangedSinceAsync("new_empwork", null, cancellationToken).ConfigureAwait(false);
        var startsByOrder = new Dictionary<Guid, List<WorkStart>>();
        foreach (var record in allWorkStarts.Where(r => !r.IsDeleted))
        {
            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            if (Id(row, "new_deliverorderid") is { } orderId && Id(row, "new_employeeid") is { } worker && Int(row, "statecode") is null or 0)
            {
                if (!startsByOrder.TryGetValue(orderId, out var list))
                {
                    startsByOrder[orderId] = list = [];
                }

                list.Add(new WorkStart(worker, Text(row, "new_number"), Date(row, "new_startdate"),
                    Money(row, "new_serviceprice") ?? Money(row, "new_totalservices"),
                    Money(row, "new_housing") ?? Money(row, "new_phallaowance") ?? 0,
                    Money(row, "new_transportation") ?? Money(row, "new_transportationallowance") ?? 0));
            }
        }

        var affected = orderChanges.Select(r => r.CrmId)
            .Concat(workStartChanges.Select(r => ParseOrderId(r.Payload)).Where(id => id is not null).Select(id => id!.Value))
            .ToHashSet();
        var orderRecords = state.OrdersWatermark is null && orderChanges.Count > 0
            ? orderChanges
            : (await staging.ChangedSinceAsync("new_deliverorder", null, cancellationToken).ConfigureAwait(false)).Where(r => affected.Contains(r.CrmId)).ToList();

        // Read every affected order first, to look up its workers and project in one go.
        var parsed = new List<(Guid CrmId, bool Deleted, CrmDeliveryOrder? Order, List<string> Numbers, decimal? Price, decimal Housing, decimal Transport)>();
        foreach (var record in orderRecords)
        {
            if (record.IsDeleted)
            {
                parsed.Add((record.CrmId, true, null, [], null, 0, 0));
                continue;
            }

            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            var numbers = (Text(row, "new_laborsnumber") ?? string.Empty)
                .Split(['\r', '\n', ' ', ',', '،', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(n => n.ToUpperInvariant()).Distinct().ToList();
            var code = Int(row, "statuscode");
            var number = Fit(Text(row, "new_number"), 30) ?? record.CrmId.ToString("N")[..8];
            parsed.Add((record.CrmId, false,
                new CrmDeliveryOrder(
                    number, code, StatusOf(code), null, Id(row, "new_projectid"), string.Empty,
                    Fit(Text(row, "new_projectidname"), 300) ?? "—", null, null, null,
                    Date(row, "new_deliverdate"), Date(row, "new_startworkdate"),
                    Fit(Text(row, "new_receicename"), 200) ?? "—", Fit(Text(row, "new_receivejob"), 200),
                    Fit(Text(row, "createdbyname"), 200) ?? "—", Stamp(row, "createdon") ?? record.LastSyncedAt, Stamp(row, "modifiedon")),
                numbers, Money(row, "new_serviceprice"), Money(row, "new_housing") ?? 0, Money(row, "new_transportation") ?? 0));
        }

        var workerNos = parsed.SelectMany(p => p.Numbers).ToList();
        var workerCrmIds = parsed.SelectMany(p => startsByOrder.GetValueOrDefault(p.CrmId) ?? []).Select(s => s.Worker).ToList();
        var cards = await workforce.CardsByCrmAsync(workerNos, workerCrmIds, cancellationToken).ConfigureAwait(false);
        var byNumber = cards.GroupBy(c => c.WorkerNo.ToUpperInvariant()).ToDictionary(g => g.Key, g => g.First());
        var byCrm = cards.ToDictionary(c => c.CrmId);
        var projectCrmIds = parsed.Where(p => p.Order?.ProjectCrmId is not null).Select(p => p.Order!.ProjectCrmId!.Value).ToList();
        var projectByCrm = (await projects.FindAsync([], projectCrmIds, cancellationToken).ConfigureAwait(false)).ToDictionary(p => p.CrmId);

        var crmIds = parsed.Select(p => p.CrmId).ToList();
        var existing = await db.DeliveryOrders.Include(o => o.Lines).Where(o => o.CrmId != null && crmIds.Contains(o.CrmId.Value))
            .ToDictionaryAsync(o => o.CrmId!.Value, cancellationToken).ConfigureAwait(false);
        int added = 0, updated = 0, removed = 0;
        foreach (var (crmId, deleted, crmOrder, numbers, price, housing, transport) in parsed)
        {
            existing.TryGetValue(crmId, out var order);
            if (deleted)
            {
                if (order is not null)
                {
                    db.DeliveryOrders.Remove(order);
                    removed++;
                }

                continue;
            }

            var o = crmOrder!;
            if (o.ProjectCrmId is { } projectCrmId && projectByCrm.TryGetValue(projectCrmId, out var project))
            {
                o = o with
                {
                    ProjectId = project.Id, ProjectCode = project.Code, ProjectName = project.Name, CustomerName = project.CustomerName,
                    ProjectManager = project.Manager, ContractType = project.ContractType,
                };
            }

            // Workers: the order's numbers, then anyone with a work start from it; the work start's price when it has one.
            var starts = (startsByOrder.GetValueOrDefault(crmId) ?? []).GroupBy(s => s.Worker).ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.StartedOn).First());
            var workers = new List<(WorkerCard? Card, string Number)>();
            foreach (var n in numbers)
            {
                workers.Add((byNumber.GetValueOrDefault(n), n));
            }

            foreach (var worker in starts.Keys.Where(w => byCrm.ContainsKey(w) && !workers.Any(x => x.Card?.CrmId == w)))
            {
                workers.Add((byCrm[worker], byCrm[worker].WorkerNo));
            }

            var lines = workers.Select(w =>
                {
                    var start = w.Card is { } c ? starts.GetValueOrDefault(c.CrmId) : null;
                    var total = start?.Price is > 0 ? start.Price.Value : price ?? 0;
                    var h = start?.Price is > 0 ? start.Housing : housing;
                    var t = start?.Price is > 0 ? start.Transport : transport;
                    var salary = w.Card?.TotalSalary ?? 0;
                    return new DeliveryLineValues(
                        w.Card?.Id, w.Card?.CrmId, Fit(w.Card?.WorkerNo ?? w.Number, 50)!, Fit(w.Card?.Name ?? w.Number, 300)!,
                        w.Card?.ProfessionCode, w.Card?.NationalityCode, w.Card?.IqamaNo, null, null,
                        salary, total - salary - h - t, h, false, t, false, false, null,
                        start?.StartedOn ?? o.StartOn, start?.Number, o.Status == DeliveryStatus.Delivered ? start?.StartedOn ?? o.StartOn : null);
                })
                .ToList();

            if (order is null)
            {
                order = DeliveryOrder.FromCrm(crmId);
                db.DeliveryOrders.Add(order);
                added++;
            }
            else
            {
                db.DeliveryLines.RemoveRange(order.Lines);
                updated++;
            }

            order.UpdateFromCrm(o, lines);
            db.DeliveryLines.AddRange(order.Lines.Where(l => db.Entry(l).State == EntityState.Detached));
        }

        state.Advance(
            orderChanges.Count > 0 ? orderChanges.Max(r => r.LastSyncedAt) : null,
            workStartChanges.Count > 0 ? workStartChanges.Max(r => r.LastSyncedAt) : null);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return $"{added} added, {updated} updated, {removed} removed in the CRM";
    }

    private static Guid? ParseOrderId(string payload)
    {
        using var document = JsonDocument.Parse(payload);
        return Id(document.RootElement, "new_deliverorderid");
    }

    private sealed record WorkStart(Guid Worker, string? Number, DateOnly? StartedOn, decimal? Price, decimal Housing, decimal Transport);

    private static string? Text(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString()!.Trim() : null;

    private static Guid? Id(JsonElement row, string field) => Guid.TryParse(Text(row, field), out var id) ? id : null;

    private static int? Int(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static decimal? Money(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) ? v.ValueKind switch
        {
            JsonValueKind.Number when v.TryGetDecimal(out var d) => Math.Round(d, 2),
            JsonValueKind.String when decimal.TryParse(v.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) => Math.Round(d, 2),
            _ => null,
        } : null;

    private static DateOnly? Date(JsonElement row, string field) =>
        Stamp(row, field) is { } at ? DateOnly.FromDateTime(at.ToOffset(Riyadh).DateTime) : null;

    private static DateTimeOffset? Stamp(JsonElement row, string field) =>
        DateTimeOffset.TryParse(Text(row, field), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at) ? at : null;

    private static string? Fit(string? text, int max) => text is null ? null : text.Length <= max ? text : text[..max];
}
