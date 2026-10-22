using System.Globalization;
using System.Text;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace IntegratedErp.BuildingBlocks.Records;

/// <summary>A table a module opens to processes, described from its EF Core model.</summary>
public interface IEntityModel
{
    string Key { get; }

    EntityDefinition Describe(IModel model);

    Task<IReadOnlyDictionary<string, string?>?> ReadAsync(DbContext db, Guid id, CancellationToken cancellationToken);

    /// <summary>The different values of a text field (a column of the table) in its rows, sorted; none for other fields.</summary>
    Task<IReadOnlyList<string>> ValuesAsync(DbContext db, string fieldKey, int max, CancellationToken cancellationToken);
}

/// <summary>
/// One table for the entity catalog (docs/02-target-architecture/17 §3.1): every scalar property of the EF Core entity
/// (and of its owned types, prefixed) becomes a field, keyed in snake_case, typed from its CLR type (an enum is a
/// choice of its names). Ids are hidden unless declared a lookup (to another table) or a user; keys, the tenant and
/// what <see cref="Hide"/> names never show. Labels are English from the property name unless given.
/// </summary>
public sealed class EntityModel<TEntity> : IEntityModel
    where TEntity : class
{
    private static readonly HashSet<string> AlwaysHidden = new(StringComparer.Ordinal) { "Id", "TenantId", "RowVersion", "ConcurrencyStamp" };
    private static readonly string[] MoneyWords = ["Price", "Salary", "Amount", "Fee", "Total", "Housing", "Transport", "Allowance", "Cost", "Basic", "Food", "Mobile", "Deducted", "Net", "Gross", "Vat", "Paid", "Balance"];

    private readonly Dictionary<string, (string Target, string Ar, string En)> lookups = new(StringComparer.Ordinal);
    private readonly HashSet<string> users = new(StringComparer.Ordinal);
    private readonly HashSet<string> hidden = new(StringComparer.Ordinal);
    private readonly HashSet<string> updatable = new(StringComparer.Ordinal);
    private readonly Dictionary<string, (string Ar, string En)> labels = new(StringComparer.Ordinal);
    private readonly Dictionary<string, RecordFieldType> types = new(StringComparer.Ordinal);
    private readonly List<RecordField> computed = [];

    public EntityModel(string key, string nameAr, string nameEn)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        Key = key;
        NameAr = nameAr;
        NameEn = nameEn;
    }

    public string Key { get; }

    public string NameAr { get; }

    public string NameEn { get; }

    /// <summary>The property holds the id of a record of <paramref name="target"/> (a table key), named for its role.</summary>
    public EntityModel<TEntity> Lookup(string property, string target, string nameAr, string nameEn)
    {
        lookups[property] = (target, nameAr, nameEn);
        return this;
    }

    /// <summary>The properties hold user account ids (approvers, recipients, comparisons with other users).</summary>
    public EntityModel<TEntity> User(params string[] properties)
    {
        users.UnionWith(properties);
        return this;
    }

    public EntityModel<TEntity> Hide(params string[] properties)
    {
        hidden.UnionWith(properties);
        return this;
    }

    /// <summary>The properties a process may change (the module's source applies them through its rules).</summary>
    public EntityModel<TEntity> Updatable(params string[] properties)
    {
        updatable.UnionWith(properties);
        return this;
    }

    public EntityModel<TEntity> Label(string property, string nameAr, string nameEn)
    {
        labels[property] = (nameAr, nameEn);
        return this;
    }

    /// <summary>A decimal property that is a quantity (days, hours…) rather than money.</summary>
    public EntityModel<TEntity> Number(params string[] properties)
    {
        foreach (var p in properties)
        {
            types[p] = RecordFieldType.Number;
        }

        return this;
    }

    /// <summary>A field the module's source computes (e.g. the project manager as a user), not a column.</summary>
    public EntityModel<TEntity> Computed(RecordField field)
    {
        computed.Add(field);
        return this;
    }

    public EntityDefinition Describe(IModel model)
    {
        ArgumentNullException.ThrowIfNull(model);
        var type = model.FindEntityType(typeof(TEntity)) ?? throw new InvalidOperationException($"{typeof(TEntity).Name} is not in the model.");
        var fields = new List<RecordField>();
        foreach (var (path, property) in Properties(type, string.Empty))
        {
            if (Field(path, property) is { } field)
            {
                fields.Add(field);
            }
        }

        fields.AddRange(computed);
        var links = lookups.Select(l => new EntityLookup(EntityNames.KeyOf(l.Key), l.Value.Target, l.Value.Ar, l.Value.En)).ToList();
        return new EntityDefinition(Key, NameAr, NameEn, fields, links);
    }

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(DbContext db, Guid id, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(db);
        var entity = await db.Set<TEntity>().AsNoTracking().FirstOrDefaultAsync(e => EF.Property<Guid>(e, "Id") == id, cancellationToken).ConfigureAwait(false);
        if (entity is null)
        {
            return null;
        }

        var type = db.Model.FindEntityType(typeof(TEntity))!;
        var values = new Dictionary<string, string?>(StringComparer.Ordinal);
        Collect(type, entity, string.Empty, values);
        return values;
    }

    public async Task<IReadOnlyList<string>> ValuesAsync(DbContext db, string fieldKey, int max, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(db);
        var type = db.Model.FindEntityType(typeof(TEntity))!;
        var property = type.GetProperties().FirstOrDefault(p => !p.IsShadowProperty() && p.ClrType == typeof(string) && EntityNames.KeyOf(p.Name) == fieldKey && Shown(p.Name, p));
        if (property is null)
        {
            return [];
        }

        var name = property.Name;
        return await db.Set<TEntity>().AsNoTracking()
            .Select(e => EF.Property<string>(e, name))
            .Where(v => v != null && v != string.Empty)
            .Distinct()
            .OrderBy(v => v)
            .Take(Math.Clamp(max, 1, 500))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    private void Collect(IEntityType type, object instance, string prefix, Dictionary<string, string?> values)
    {
        foreach (var property in type.GetProperties())
        {
            var path = prefix + property.Name;
            if (property.IsShadowProperty() || !Shown(path, property))
            {
                continue;
            }

            values[EntityNames.KeyOf(path)] = Format(property.GetGetter().GetClrValue(instance));
        }

        foreach (var navigation in type.GetNavigations().Where(n => n.TargetEntityType.IsOwned() && !n.IsCollection))
        {
            if (navigation.GetGetter().GetClrValue(instance) is { } owned)
            {
                Collect(navigation.TargetEntityType, owned, prefix + navigation.Name, values);
            }
        }
    }

    private static IEnumerable<(string Path, IProperty Property)> Properties(IEntityType type, string prefix)
    {
        foreach (var property in type.GetProperties().Where(p => !p.IsShadowProperty()))
        {
            yield return (prefix + property.Name, property);
        }

        foreach (var navigation in type.GetNavigations().Where(n => n.TargetEntityType.IsOwned() && !n.IsCollection))
        {
            foreach (var inner in Properties(navigation.TargetEntityType, prefix + navigation.Name))
            {
                yield return inner;
            }
        }
    }

    private bool Shown(string path, IProperty property)
    {
        if (AlwaysHidden.Contains(path) || hidden.Contains(path) || property.IsPrimaryKey())
        {
            return false;
        }

        var clr = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
        return clr != typeof(Guid) || lookups.ContainsKey(path) || users.Contains(path);
    }

    private RecordField? Field(string path, IProperty property)
    {
        if (!Shown(path, property) || lookups.ContainsKey(path))
        {
            return null;
        }

        var clr = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
        RecordFieldType? kind = users.Contains(path) ? RecordFieldType.User
            : types.TryGetValue(path, out var given) ? given
            : clr == typeof(string) ? RecordFieldType.Text
            : clr == typeof(bool) ? RecordFieldType.Boolean
            : clr == typeof(DateOnly) || clr == typeof(DateTime) || clr == typeof(DateTimeOffset) ? RecordFieldType.Date
            : clr == typeof(decimal) || clr == typeof(double) ? (MoneyWords.Any(w => path.Contains(w, StringComparison.Ordinal)) ? RecordFieldType.Money : RecordFieldType.Number)
            : clr == typeof(int) || clr == typeof(long) || clr == typeof(short) ? RecordFieldType.Number
            : clr.IsEnum ? RecordFieldType.Choice
            : null;
        if (kind is not { } fieldType)
        {
            return null;
        }

        var (ar, en) = labels.TryGetValue(path, out var label) ? label : (EntityNames.LabelOf(path), EntityNames.LabelOf(path));
        var options = fieldType == RecordFieldType.Choice
            ? Enum.GetNames(clr).Select(n => new RecordFieldOption(n, EntityNames.LabelOf(n), EntityNames.LabelOf(n), Settable: updatable.Contains(path))).ToList()
            : null;
        return new RecordField(EntityNames.KeyOf(path), ar, en, fieldType, updatable.Contains(path), options);
    }

    private static string? Format(object? value) => value switch
    {
        null => null,
        string s => s,
        bool b => b ? "true" : "false",
        DateOnly d => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        DateTime d => DateOnly.FromDateTime(d).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        // Saudi day of an instant.
        DateTimeOffset d => DateOnly.FromDateTime(d.UtcDateTime.AddHours(3)).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        decimal m => m.ToString(CultureInfo.InvariantCulture),
        double m => m.ToString(CultureInfo.InvariantCulture),
        IFormattable f when value.GetType().IsEnum => value.ToString(),
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString(),
    };
}

/// <summary>How a property's name becomes a field key (snake_case) and an English label.</summary>
public static class EntityNames
{
    public static string KeyOf(string property)
    {
        var builder = new StringBuilder(property.Length + 4);
        for (var i = 0; i < property.Length; i++)
        {
            var c = property[i];
            if (char.IsUpper(c) && i > 0 && (char.IsLower(property[i - 1]) || (i + 1 < property.Length && char.IsLower(property[i + 1]))))
            {
                builder.Append('_');
            }

            builder.Append(char.ToLowerInvariant(c));
        }

        return builder.ToString();
    }

    public static string LabelOf(string property)
    {
        var words = KeyOf(property).Replace("_", " ", StringComparison.Ordinal).Trim();
        return words.Length == 0 ? property : char.ToUpperInvariant(words[0]) + words[1..];
    }
}
