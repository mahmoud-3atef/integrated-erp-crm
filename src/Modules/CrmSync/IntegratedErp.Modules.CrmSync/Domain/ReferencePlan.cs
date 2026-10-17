namespace IntegratedErp.Modules.CrmSync.Domain;

/// <summary>
/// A CRM lookup record (a country or a profession) as the reference import sees it.
/// <paramref name="Usage"/>: how many CRM employees use it. <paramref name="PreviousItemCode"/>: the item it was
/// mapped to by an earlier import (kept, so importing again never changes codes or creates duplicates).
/// </summary>
public sealed record CrmLookup(
    Guid Id,
    string? Name,
    string? Code,
    string? EnglishName,
    string? Nationality,
    bool IsActive,
    DateTime? CreatedOn,
    int Usage,
    string? PreviousItemCode = null,
    bool ChosenByPerson = false);

/// <summary>Records a person mapped by hand keep that mapping; the planners only plan the others.</summary>
public static class ManualMappings
{
    public static (IReadOnlyList<CrmLookup> Others, IReadOnlyList<PlannedMapping> Kept) Split(IReadOnlyList<CrmLookup> records)
    {
        ArgumentNullException.ThrowIfNull(records);
        var kept = records.Where(r => r.ChosenByPerson && r.PreviousItemCode is not null)
            .Select(r => new PlannedMapping(r.Id, ArabicText.Clean(r.Name), r.Code, r.PreviousItemCode, MatchRule.Manual, r.Usage))
            .ToList();
        return (records.Where(r => !(r.ChosenByPerson && r.PreviousItemCode is not null)).ToList(), kept);
    }
}

/// <summary>A reference item to create (if its code does not exist yet).</summary>
public sealed record PlannedItem(string Code, string NameAr, string NameEn, int SortOrder, bool NeedsReview);

/// <summary>What one CRM record becomes.</summary>
public sealed record PlannedMapping(Guid CrmId, string CrmName, string? CrmCode, string? ItemCode, MatchRule Rule, int Usage);

public sealed record ReferencePlan(IReadOnlyList<PlannedItem> Items, IReadOnlyList<PlannedMapping> Mappings);

/// <summary>
/// Turns the CRM's professions into one reference item per profession: records with the same name (in any spelling)
/// become one item; a record with only an English name joins the Arabic one with that English name. The item code is
/// the CRM code when it is a valid, unused code (usually the Ministry of Labour occupation code), else a stable code
/// made from the CRM id.
/// </summary>
public static class ProfessionPlanner
{
    public const int NameMaxLength = 200;

    private const int UnusedSortOrder = 1000;

    public static ReferencePlan Plan(IReadOnlyList<CrmLookup> all)
    {
        var (records, kept) = ManualMappings.Split(all);
        var mappings = new List<PlannedMapping>(kept);
        foreach (var blank in records.Where(r => ArabicText.Key(r.Name).Length == 0))
        {
            mappings.Add(new(blank.Id, ArabicText.Clean(blank.Name), blank.Code, null, MatchRule.Unmapped, blank.Usage));
        }

        var groups = records.Where(r => ArabicText.Key(r.Name).Length > 0)
            .GroupBy(r => ArabicText.Key(r.Name))
            .Select(g => new Group(g.Key, [.. g]))
            .ToList();

        // A group named only in English joins the single Arabic group that has that English name.
        var byEnglish = groups.Where(g => g.Members.Any(m => ArabicText.HasArabic(m.Name)))
            .SelectMany(g => g.Members.Select(m => (Key: ArabicText.Key(m.EnglishName), Group: g)))
            .Where(x => x.Key.Length > 0)
            .GroupBy(x => x.Key)
            .Where(x => x.Select(y => y.Group).Distinct().Count() == 1)
            .ToDictionary(x => x.Key, x => x.First().Group);
        foreach (var latin in groups.Where(g => !g.Members.Any(m => ArabicText.HasArabic(m.Name))).ToList())
        {
            if (byEnglish.TryGetValue(latin.Key, out var target))
            {
                target.Joined.AddRange(latin.Members);
                groups.Remove(latin);
            }
        }

        var ordered = groups
            .OrderByDescending(g => g.All.Sum(m => m.Usage))
            .ThenByDescending(g => g.All.Any(m => m.PreviousItemCode is not null))
            .ThenBy(g => g.Key, StringComparer.Ordinal)
            .ToList();

        var taken = new HashSet<string>(StringComparer.Ordinal);
        var items = new List<PlannedItem>();
        var rank = 0;
        foreach (var group in ordered)
        {
            var canonical = group.Members
                .OrderByDescending(m => m.Usage)
                .ThenByDescending(m => m.IsActive)
                .ThenByDescending(m => !string.IsNullOrWhiteSpace(m.EnglishName))
                .ThenByDescending(m => ArabicText.AsItemCode(m.Code) is not null)
                .ThenBy(m => m.CreatedOn ?? DateTime.MaxValue)
                .ThenBy(m => m.Id)
                .First();
            var code = ChooseCode(group, canonical, taken);
            taken.Add(code);

            var nameAr = ArabicText.Fit(ArabicText.Clean(canonical.Name), NameMaxLength);
            var english = group.All.Select(m => ArabicText.Clean(m.EnglishName)).FirstOrDefault(e => e.Length > 0 && !ArabicText.HasArabic(e));
            var needsReview = false;
            if (english is null)
            {
                // No English name in the CRM: a Latin name stands for itself, an Arabic one is shown until someone translates it.
                english = nameAr;
                needsReview = ArabicText.HasArabic(nameAr);
            }

            needsReview |= !ArabicText.HasArabic(nameAr);
            var usage = group.All.Sum(m => m.Usage);
            items.Add(new PlannedItem(code, nameAr, ArabicText.Fit(english, NameMaxLength), usage > 0 ? ++rank : UnusedSortOrder, needsReview));

            var canonicalName = ArabicText.Clean(canonical.Name);
            foreach (var member in group.Members)
            {
                var rule = member == canonical ? MatchRule.Name
                    : ArabicText.Clean(member.Name) == canonicalName ? MatchRule.Duplicate
                    : MatchRule.Spelling;
                mappings.Add(new(member.Id, ArabicText.Clean(member.Name), member.Code, code, rule, member.Usage));
            }

            foreach (var member in group.Joined)
            {
                mappings.Add(new(member.Id, ArabicText.Clean(member.Name), member.Code, code, MatchRule.EnglishName, member.Usage));
            }
        }

        return new ReferencePlan(items, mappings);
    }

    /// <summary>
    /// The code an earlier import gave the group, else the canonical record's CRM code, else another member's,
    /// else "CRM-" and the start of the canonical record's id.
    /// </summary>
    private static string ChooseCode(Group group, CrmLookup canonical, HashSet<string> taken)
    {
        var previous = group.All.Where(m => m.PreviousItemCode is not null)
            .GroupBy(m => m.PreviousItemCode!)
            .OrderByDescending(g => g.Count())
            .Select(g => g.Key)
            .FirstOrDefault(c => !taken.Contains(c));
        if (previous is not null)
        {
            return previous;
        }

        var fromCrm = new[] { canonical }.Concat(group.All.OrderByDescending(m => m.Usage))
            .Select(m => ArabicText.AsItemCode(m.Code))
            .FirstOrDefault(c => c is not null && !taken.Contains(c));
        if (fromCrm is not null)
        {
            return fromCrm;
        }

        var id = canonical.Id.ToString("N").ToUpperInvariant();
        for (var length = 8; length <= 26; length += 2)
        {
            var generated = "CRM-" + id[..length];
            if (!taken.Contains(generated))
            {
                return generated;
            }
        }

        return "CRM-" + id[..26];
    }

    private sealed class Group(string key, List<CrmLookup> members)
    {
        public string Key { get; } = key;

        /// <summary>Records with this name (in any spelling).</summary>
        public List<CrmLookup> Members { get; } = members;

        /// <summary>English-only records that joined by English name.</summary>
        public List<CrmLookup> Joined { get; } = [];

        public IEnumerable<CrmLookup> All => Members.Concat(Joined);
    }
}
