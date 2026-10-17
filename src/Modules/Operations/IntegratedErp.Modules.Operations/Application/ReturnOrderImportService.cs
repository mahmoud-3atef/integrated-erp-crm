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
/// Copies the old system's housing orders (CRM mw_lodginorderdetails: nearly all are returned workers) after every sync,
/// read-only, so the return orders list shows them with the orders written here. Only what changed is copied again.
/// </summary>
internal sealed class ReturnOrderImportService(
    OperationsDbContext db,
    ICrmStaging staging,
    IWorkforceDirectory workforce,
    IProjectDirectory projects) : ICrmStagingConsumer
{
    private static readonly TimeSpan Riyadh = TimeSpan.FromHours(3);

    public string Name => "housing orders";

    /// <summary>The old status of a housing order and what it means here.</summary>
    public static ReturnStatus StatusOf(int? code) => code switch
    {
        100000009 => ReturnStatus.Completed,
        100000004 or 100000005 or 2 => ReturnStatus.Canceled,
        100000003 => ReturnStatus.Returned,
        100000000 or 100000006 => ReturnStatus.SentToSales,
        _ => ReturnStatus.InApproval,
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

        var changes = await staging.ChangedSinceAsync("mw_lodginorderdetails", state.HousingOrdersWatermark, cancellationToken).ConfigureAwait(false);
        if (changes.Count == 0)
        {
            return "no changes";
        }

        var parsed = new List<(Guid CrmId, bool Deleted, CrmReturnOrder? Order, Guid? Worker, Guid? Project, string? ProjectName)>();
        foreach (var record in changes)
        {
            if (record.IsDeleted)
            {
                parsed.Add((record.CrmId, true, null, null, null, null));
                continue;
            }

            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            var code = Int(row, "statuscode");
            parsed.Add((record.CrmId, false,
                new CrmReturnOrder(
                    Fit(Text(row, "mw_name"), 30) ?? record.CrmId.ToString("N")[..8], code, StatusOf(code),
                    Int(row, "new_entertype") switch { 100000000 => HousingEntry.NewArrival, 100000002 => HousingEntry.BackFromVacation, _ => HousingEntry.ReturnedWorker },
                    ReturnReasons.FromCrm(Int(row, "new_backreason")), Date(row, "mw_arrivedate"),
                    Fit(string.Join(" — ", new[] { Text(row, "mw_housingname"), Text(row, "mw_housingapartmentsname") }.Where(x => x is not null)), 200) is { Length: > 0 } housing ? housing : null,
                    Fit(Text(row, "new_delayreason"), 500), Fit(Text(row, "createdbyname"), 200) ?? "—",
                    Stamp(row, "createdon") ?? record.LastSyncedAt, Stamp(row, "modifiedon")),
                Id(row, "mw_empid") ?? Id(row, "new_workerid"), Id(row, "new_projectid"), Fit(Text(row, "new_projectidname"), 300)));
        }

        var cards = (await workforce.CardsByCrmAsync([], parsed.Where(p => p.Worker is not null).Select(p => p.Worker!.Value).ToList(), cancellationToken).ConfigureAwait(false))
            .ToDictionary(c => c.CrmId);
        var projectByCrm = (await projects.FindAsync([], parsed.Where(p => p.Project is not null).Select(p => p.Project!.Value).ToList(), cancellationToken).ConfigureAwait(false))
            .ToDictionary(p => p.CrmId);
        var crmIds = parsed.Select(p => p.CrmId).ToList();
        var existing = await db.ReturnOrders.Where(o => o.CrmId != null && crmIds.Contains(o.CrmId.Value)).ToDictionaryAsync(o => o.CrmId!.Value, cancellationToken).ConfigureAwait(false);
        int added = 0, updated = 0, removed = 0;
        foreach (var (crmId, deleted, crmOrder, workerCrmId, projectCrmId, projectName) in parsed)
        {
            existing.TryGetValue(crmId, out var order);
            if (deleted)
            {
                if (order is not null)
                {
                    db.ReturnOrders.Remove(order);
                    removed++;
                }

                continue;
            }

            var card = workerCrmId is { } w ? cards.GetValueOrDefault(w) : null;
            var project = projectCrmId is { } p ? projectByCrm.GetValueOrDefault(p) : null;
            var worker = new ReturnWorker(
                card?.Id, workerCrmId, Fit(card?.WorkerNo, 50) ?? "—", Fit(card?.Name, 300) ?? "—", card?.ProfessionCode, card?.NationalityCode, card?.IqamaNo,
                project?.Id, projectCrmId, project?.Name ?? projectName, null);
            if (order is null)
            {
                order = ReturnOrder.FromCrm(crmId);
                db.ReturnOrders.Add(order);
                added++;
            }
            else
            {
                updated++;
            }

            order.UpdateFromCrm(crmOrder!, worker);
        }

        state.AdvanceHousing(changes.Max(r => r.LastSyncedAt));
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return $"{added} added, {updated} updated, {removed} removed in the CRM";
    }

    private static string? Text(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString()!.Trim() : null;

    private static Guid? Id(JsonElement row, string field) => Guid.TryParse(Text(row, field), out var id) ? id : null;

    private static int? Int(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static DateOnly? Date(JsonElement row, string field) =>
        Stamp(row, field) is { } at ? DateOnly.FromDateTime(at.ToOffset(Riyadh).DateTime) : null;

    private static DateTimeOffset? Stamp(JsonElement row, string field) =>
        DateTimeOffset.TryParse(Text(row, field), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at) ? at : null;

    private static string? Fit(string? text, int max) => text is null ? null : text.Length <= max ? text : text[..max];
}
