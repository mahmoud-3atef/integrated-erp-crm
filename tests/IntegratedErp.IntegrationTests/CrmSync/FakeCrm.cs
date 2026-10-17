using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;

namespace IntegratedErp.IntegrationTests.CrmSync;

/// <summary>An in-memory CRM: records per entity with a modifiedon that moves forward on every change.</summary>
internal sealed class FakeCrm : ICrmSource
{
    private readonly Dictionary<string, Dictionary<Guid, Dictionary<string, object?>>> _entities = [];
    private DateTime _clock = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    public Guid Add(string entity, Dictionary<string, object?> values, DateTime? created = null)
    {
        var id = Guid.NewGuid();
        values["statecode"] = 0;
        values["createdon"] = created ?? _clock;
        values["modifiedon"] = _clock = _clock.AddSeconds(1);
        Records(entity)[id] = values;
        return id;
    }

    public void Touch(Guid id, string field, object? value)
    {
        var record = _entities.Values.Single(e => e.ContainsKey(id))[id];
        record[field] = value;
        record["modifiedon"] = _clock = _clock.AddSeconds(1);
    }

    public void Remove(Guid id) => _entities.Values.Single(e => e.ContainsKey(id)).Remove(id);

    public Task<IReadOnlyList<CrmRow>> ReadPageAsync(CrmEntity entity, DateTime? afterModifiedOn, Guid? afterId, DateTime? createdFrom, int pageSize, CancellationToken cancellationToken)
    {
        // Same order and paging as the SQL source (Guid order differs, but ties never happen here).
        IReadOnlyList<CrmRow> page = Records(entity.Name)
            .Select(r => new CrmRow(r.Key, (DateTime)r.Value["modifiedon"]!, (DateTime)r.Value["createdon"]!, 0, r.Value))
            .Where(r => createdFrom is null || r.CreatedOn >= createdFrom)
            .Where(r => afterModifiedOn is null || r.ModifiedOn > afterModifiedOn || (r.ModifiedOn == afterModifiedOn && r.Id.CompareTo(afterId) > 0))
            .OrderBy(r => r.ModifiedOn).ThenBy(r => r.Id)
            .Take(pageSize)
            .ToList();
        return Task.FromResult(page);
    }

    private Dictionary<Guid, Dictionary<string, object?>> Records(string entity) =>
        _entities.TryGetValue(entity, out var records) ? records : _entities[entity] = [];
}
