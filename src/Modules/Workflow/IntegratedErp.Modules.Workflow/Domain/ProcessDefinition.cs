using System.Globalization;
using System.Text.Json.Serialization;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workflow.Domain;

/// <summary>
/// The steps of an approval process, as in the Dynamics CRM workflow designer: an ordered list where each step is
/// an approval stage, a condition (if / else-if / else), a record update, a notification or a stop. Stages and
/// conditions hold nested step lists, so a definition is a finite tree: it always ends (no loops, no jumps, no code).
/// </summary>
public sealed record ProcessDefinition(ConditionGroup? StartCondition, IReadOnlyList<Step> Steps)
{
    public const int MaxSteps = 60;
    public const int MaxDepth = 6;

    public static ProcessDefinition Empty { get; } = new(null, []);
}

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(ApprovalStep), "approval")]
[JsonDerivedType(typeof(ConditionStep), "condition")]
[JsonDerivedType(typeof(UpdateStep), "update")]
[JsonDerivedType(typeof(ActionStep), "action")]
[JsonDerivedType(typeof(NotifyStep), "notify")]
[JsonDerivedType(typeof(StopStep), "stop")]
public abstract record Step
{
    /// <summary>Stable id within the definition (set by the editor), used by running approvals to know where they are.</summary>
    public required string Id { get; init; }

    /// <summary>A short name the designer gives the step, e.g. "Check the amount" (shown in the editor and history).</summary>
    public string? Label { get; init; }
}

public enum AssigneeKind
{
    /// <summary>A named user.</summary>
    User,

    /// <summary>Anyone holding a company role (within the record's commercial registration).</summary>
    Role,

    /// <summary>The user in a record field (e.g. direct manager, project manager).</summary>
    UserField,

    /// <summary>
    /// The person who submitted the record, to confirm it themselves (e.g. the creator of a delivery order approves
    /// it before it goes on). The only case where someone decides on their own submission.
    /// </summary>
    Submitter,

    /// <summary>Anyone holding a permission through a role (e.g. "approve delivery orders" for operations managers).</summary>
    Permission,
}

public sealed record Assignee(AssigneeKind Kind, Guid? UserId = null, Guid? RoleId = null, string? FieldKey = null, string? Permission = null);

public enum CompletionRule
{
    /// <summary>The first decision of any assignee decides the stage.</summary>
    Any,

    /// <summary>Every assignee must approve; one rejection or return decides at once.</summary>
    All,
}

/// <summary>
/// A stage decided by people (a CRM approval task). After the decision the matching branch runs; with no steps in it,
/// approve continues to the next step, reject ends the process Rejected, and return ends it Returned to the submitter.
/// </summary>
public sealed record ApprovalStep : Step
{
    public required string NameAr { get; init; }

    public required string NameEn { get; init; }

    public required IReadOnlyList<Assignee> Assignees { get; init; }

    public CompletionRule Rule { get; init; } = CompletionRule.Any;

    /// <summary>Hours to decide; past it the task shows as overdue.</summary>
    public int? DueHours { get; init; }

    /// <summary>Updatable fields the approver must fill before approving (like CRM "mandatory fields" on the task).</summary>
    public IReadOnlyList<string> RequiredFields { get; init; } = [];

    public bool AllowReturn { get; init; } = true;

    public bool AllowDelegate { get; init; } = true;

    public IReadOnlyList<Step> OnApprove { get; init; } = [];

    public IReadOnlyList<Step> OnReject { get; init; } = [];

    public IReadOnlyList<Step> OnReturn { get; init; } = [];
}

/// <summary>If / else-if / else: the first branch whose condition holds runs, otherwise <see cref="Else"/>.</summary>
public sealed record ConditionStep : Step
{
    public required IReadOnlyList<ConditionBranch> Branches { get; init; }

    public IReadOnlyList<Step> Else { get; init; } = [];
}

public sealed record ConditionBranch(ConditionGroup Condition, IReadOnlyList<Step> Steps);

/// <summary>
/// Sets updatable fields (a constant, or the value of a field of the record) of the record itself or, with
/// <see cref="Target"/>, of a related table the screen declares.
/// </summary>
public sealed record UpdateStep : Step
{
    /// <summary>Null: the record itself; otherwise the key of a declared related table.</summary>
    public string? Target { get; init; }

    public required IReadOnlyList<FieldChange> Changes { get; init; }
}

public sealed record FieldChange(string FieldKey, string? Value = null, string? FromField = null);

/// <summary>Runs one of the screen's declared actions (its module's code, chosen by name) at this place in the process.</summary>
public sealed record ActionStep : Step
{
    public required string Action { get; init; }
}

public enum RecipientKind
{
    Submitter,
    User,
    Role,
    UserField,
}

public sealed record Recipient(RecipientKind Kind, Guid? UserId = null, Guid? RoleId = null, string? FieldKey = null);

/// <summary>An in-system notification (and email). Texts may use {field-key} placeholders.</summary>
public sealed record NotifyStep : Step
{
    public required IReadOnlyList<Recipient> To { get; init; }

    public required string TitleAr { get; init; }

    public required string TitleEn { get; init; }

    public string BodyAr { get; init; } = string.Empty;

    public string BodyEn { get; init; } = string.Empty;
}

public enum StopOutcome
{
    Approved,
    Rejected,
    Canceled,
}

public sealed record StopStep : Step
{
    public required StopOutcome Outcome { get; init; }
}

public enum ConditionOperator
{
    Equals,
    NotEquals,
    GreaterThan,
    GreaterOrEqual,
    LessThan,
    LessOrEqual,
    In,
    IsEmpty,
    IsNotEmpty,
}

/// <summary>
/// A test on a field of the record (<paramref name="Relation"/> null) or of one of its related tables (the relation's
/// key), against a value — a fixed one (<paramref name="Value"/>, a chosen user for a user field) or, dynamically, the
/// value of another field of the same type (<paramref name="ValueFromField"/>, of the record or of the related table
/// <paramref name="ValueFromRelation"/>), as Dynamics CRM's workflow conditions compare with dynamic values.
/// </summary>
public sealed record ConditionRule(
    string FieldKey,
    ConditionOperator Operator,
    string? Value = null,
    IReadOnlyList<string>? Values = null,
    string? Relation = null,
    string? ValueFromField = null,
    string? ValueFromRelation = null)
{
    /// <summary>The rule compares with another field's value.</summary>
    public bool IsDynamic => ValueFromField is not null;
}

/// <summary>
/// The fields a condition can test: the record's, and each related table's as "relation.field" — the same keys the
/// engine gives their values under.
/// </summary>
public static class ConditionFields
{
    public static string Key(string? relation, string fieldKey) => relation is null ? fieldKey : $"{relation}.{fieldKey}";

    public static string Key(ConditionRule rule)
    {
        ArgumentNullException.ThrowIfNull(rule);
        return Key(rule.Relation, rule.FieldKey);
    }

    /// <summary>The key of the field a dynamic rule compares with (null for a fixed value).</summary>
    public static string? ValueKey(ConditionRule rule)
    {
        ArgumentNullException.ThrowIfNull(rule);
        return rule.ValueFromField is { } field ? Key(rule.ValueFromRelation, field) : null;
    }

    public static Dictionary<string, RecordField> Of(ApprovalScreen screen)
    {
        ArgumentNullException.ThrowIfNull(screen);
        var fields = screen.Fields.ToDictionary(f => f.Key, StringComparer.Ordinal);
        foreach (var relation in screen.RelatedTables)
        {
            foreach (var field in relation.Fields)
            {
                fields[Key(relation.Key, field.Key)] = field;
            }
        }

        return fields;
    }
}

/// <summary>All (AND) or any (OR) of the rules; an empty group is true.</summary>
public sealed record ConditionGroup(bool MatchAll, IReadOnlyList<ConditionRule> Rules);

/// <summary>Checks a definition against the screen's declared fields before it can be published.</summary>
public static class DefinitionRules
{
    public static Result Validate(ProcessDefinition definition, ApprovalScreen screen)
    {
        ArgumentNullException.ThrowIfNull(definition);
        ArgumentNullException.ThrowIfNull(screen);
        var fields = screen.Fields.ToDictionary(f => f.Key, StringComparer.Ordinal);
        var tested = ConditionFields.Of(screen);
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var errors = new List<string>();
        var count = 0;

        if (definition.StartCondition is { } start)
        {
            CheckGroup(start, tested, errors, "start condition");
        }

        if (definition.Steps.Count == 0)
        {
            errors.Add("The process needs at least one step.");
        }

        if (!Walk(definition.Steps, 1).Any(s => s is ApprovalStep))
        {
            errors.Add("The process needs at least one approval stage.");
        }

        CheckList(definition.Steps, 1);

        // The screen's required actions (e.g. a return order's housing) must be somewhere in the process.
        var actions = Walk(definition.Steps, 1).OfType<ActionStep>().Select(a => a.Action).ToHashSet(StringComparer.Ordinal);
        foreach (var required in screen.RecordActions.Where(a => a.Required && !actions.Contains(a.Key)))
        {
            errors.Add($"The process must run the action «{required.NameAr}» ({required.NameEn}).");
        }

        return errors.Count == 0
            ? Result.Success()
            : Result.Failure(Error.Validation("process_invalid", string.Join(" ", errors.Take(5))));

        void CheckList(IReadOnlyList<Step> steps, int depth)
        {
            if (depth > ProcessDefinition.MaxDepth)
            {
                errors.Add("Steps are nested too deeply.");
                return;
            }

            foreach (var step in steps)
            {
                if (++count > ProcessDefinition.MaxSteps)
                {
                    errors.Add($"A process may have at most {ProcessDefinition.MaxSteps} steps.");
                    return;
                }

                if (string.IsNullOrWhiteSpace(step.Id) || step.Id.Length > 40 || !ids.Add(step.Id))
                {
                    errors.Add("Every step needs a unique id.");
                }

                if (step.Label?.Length > 200)
                {
                    errors.Add("A step label is limited to 200 characters.");
                }

                switch (step)
                {
                    case ApprovalStep a:
                        if (string.IsNullOrWhiteSpace(a.NameAr) || string.IsNullOrWhiteSpace(a.NameEn) || a.NameAr.Length > 200 || a.NameEn.Length > 200)
                        {
                            errors.Add("Each stage needs Arabic and English names.");
                        }

                        if (a.Assignees.Count is 0 or > 10)
                        {
                            errors.Add($"Stage \"{a.NameEn}\" needs 1 to 10 assignees.");
                        }

                        foreach (var assignee in a.Assignees)
                        {
                            var ok = assignee.Kind switch
                            {
                                AssigneeKind.User => assignee.UserId is not null,
                                AssigneeKind.Role => assignee.RoleId is not null,
                                AssigneeKind.UserField => IsField(assignee.FieldKey, RecordFieldType.User),
                                AssigneeKind.Submitter => true,
                                AssigneeKind.Permission => !string.IsNullOrWhiteSpace(assignee.Permission),
                                _ => false,
                            };
                            if (!ok)
                            {
                                errors.Add($"Stage \"{a.NameEn}\" has an incomplete assignee.");
                            }
                        }

                        if (a.DueHours is < 1 or > 24 * 90)
                        {
                            errors.Add($"Stage \"{a.NameEn}\": the deadline must be 1 to 2160 hours.");
                        }

                        if (a.RequiredFields.Any(f => !fields.TryGetValue(f, out var field) || !field.Updatable))
                        {
                            errors.Add($"Stage \"{a.NameEn}\": required fields must be updatable fields of the screen.");
                        }

                        CheckList(a.OnApprove, depth + 1);
                        CheckList(a.OnReject, depth + 1);
                        CheckList(a.OnReturn, depth + 1);
                        break;

                    case ConditionStep c:
                        if (c.Branches.Count is 0 or > 10)
                        {
                            errors.Add("A condition needs 1 to 10 branches.");
                        }

                        foreach (var branch in c.Branches)
                        {
                            CheckGroup(branch.Condition, tested, errors, "condition");
                            CheckList(branch.Steps, depth + 1);
                        }

                        CheckList(c.Else, depth + 1);
                        break;

                    case ActionStep act:
                        if (screen.RecordActions.All(a => a.Key != act.Action))
                        {
                            errors.Add($"\"{act.Action}\" is not an action of this screen.");
                        }

                        break;

                    case UpdateStep u:
                        if (u.Changes.Count == 0)
                        {
                            errors.Add("An update step needs at least one field.");
                        }

                        // The table to update: the record, or a related table the screen declares.
                        Dictionary<string, RecordField> targetFields;
                        if (u.Target is null)
                        {
                            targetFields = fields;
                        }
                        else if (screen.RelatedTables.FirstOrDefault(r => r.Key == u.Target) is { } relation)
                        {
                            targetFields = relation.Fields.ToDictionary(f => f.Key, StringComparer.Ordinal);
                        }
                        else
                        {
                            errors.Add($"\"{u.Target}\" is not a table related to this screen.");
                            break;
                        }

                        foreach (var change in u.Changes)
                        {
                            if (!targetFields.TryGetValue(change.FieldKey, out var field) || !field.Updatable)
                            {
                                errors.Add($"Field \"{change.FieldKey}\" cannot be updated by a process.");
                            }
                            else if (change.FromField is { } from)
                            {
                                // From a field of the record or of a related table ("relation.field"), of the same type.
                                if (!tested.TryGetValue(from, out var source) || source.Type != field.Type)
                                {
                                    errors.Add($"Field \"{change.FieldKey}\" can only be copied from a field of the same type.");
                                }
                            }
                            else if (!FieldValues.IsValid(field, change.Value)
                                     || (field.Type == RecordFieldType.Choice && change.Value is not null && field.Options?.First(o => o.Value == change.Value).Settable == false))
                            {
                                errors.Add($"The value for \"{change.FieldKey}\" is not valid.");
                            }
                        }

                        break;

                    case NotifyStep n:
                        if (n.To.Count == 0 || string.IsNullOrWhiteSpace(n.TitleAr) || string.IsNullOrWhiteSpace(n.TitleEn))
                        {
                            errors.Add("A notification needs recipients and Arabic and English titles.");
                        }

                        if (n.To.Any(r => r.Kind switch
                            {
                                RecipientKind.User => r.UserId is null,
                                RecipientKind.Role => r.RoleId is null,
                                RecipientKind.UserField => !IsField(r.FieldKey, RecordFieldType.User),
                                _ => false,
                            }))
                        {
                            errors.Add("A notification has an incomplete recipient.");
                        }

                        break;

                    case StopStep:
                        break;

                    default:
                        errors.Add("Unknown step type.");
                        break;
                }
            }
        }

        bool IsField(string? key, RecordFieldType type) => key is not null && tested.TryGetValue(key, out var f) && f.Type == type;
    }

    /// <summary>Every step in the tree, depth first.</summary>
    public static IEnumerable<Step> Walk(IReadOnlyList<Step> steps, int depth = 1)
    {
        if (depth > ProcessDefinition.MaxDepth + 1)
        {
            yield break;
        }

        foreach (var step in steps)
        {
            yield return step;
            var children = step switch
            {
                ApprovalStep a => a.OnApprove.Concat(a.OnReject).Concat(a.OnReturn).ToList(),
                ConditionStep c => c.Branches.SelectMany(b => b.Steps).Concat(c.Else).ToList(),
                _ => [],
            };
            foreach (var child in Walk(children, depth + 1))
            {
                yield return child;
            }
        }
    }

    private static void CheckGroup(ConditionGroup group, Dictionary<string, RecordField> fields, List<string> errors, string where)
    {
        if (group.Rules.Count > 20)
        {
            errors.Add($"A {where} may have at most 20 rules.");
        }

        foreach (var rule in group.Rules)
        {
            if (!fields.TryGetValue(ConditionFields.Key(rule), out var field))
            {
                errors.Add($"The {where} uses an unknown field \"{ConditionFields.Key(rule)}\".");
                continue;
            }

            var ordered = field.Type is RecordFieldType.Number or RecordFieldType.Money or RecordFieldType.Date;
            if (ConditionFields.ValueKey(rule) is { } other)
            {
                // Against another field: it exists, has the same type, and the operator compares two values.
                if (!fields.TryGetValue(other, out var compared))
                {
                    errors.Add($"The {where} compares with an unknown field \"{other}\".");
                }
                else if (compared.Type != field.Type)
                {
                    errors.Add($"The {where} rule on \"{field.NameEn}\" compares with a field of another type.");
                }
                else if (rule.Operator is ConditionOperator.In or ConditionOperator.IsEmpty or ConditionOperator.IsNotEmpty
                         || (!ordered && rule.Operator is not (ConditionOperator.Equals or ConditionOperator.NotEquals)))
                {
                    errors.Add($"The {where} rule on \"{field.NameEn}\" is not valid for its type.");
                }

                continue;
            }

            var valid = rule.Operator switch
            {
                ConditionOperator.IsEmpty or ConditionOperator.IsNotEmpty => true,
                ConditionOperator.GreaterThan or ConditionOperator.GreaterOrEqual or ConditionOperator.LessThan or ConditionOperator.LessOrEqual
                    => ordered && FieldValues.IsValid(field, rule.Value) && rule.Value is not null,
                ConditionOperator.In => rule.Values is { Count: > 0 } values && values.All(v => FieldValues.IsValid(field, v)),
                _ => FieldValues.IsValid(field, rule.Value),
            };
            if (!valid)
            {
                errors.Add($"The {where} rule on \"{field.NameEn}\" is not valid for its type.");
            }
        }
    }
}

/// <summary>Parsing, checking and comparing field values (always invariant strings).</summary>
public static class FieldValues
{
    public static bool IsValid(RecordField field, string? value)
    {
        ArgumentNullException.ThrowIfNull(field);
        if (value is null)
        {
            return true;
        }

        return field.Type switch
        {
            RecordFieldType.Number or RecordFieldType.Money => decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out _),
            RecordFieldType.Date => DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _),
            RecordFieldType.Boolean => value is "true" or "false",
            RecordFieldType.Choice => field.Options?.Any(o => o.Value == value) == true,
            RecordFieldType.User or RecordFieldType.LegalEntity => Guid.TryParse(value, out _),
            _ => value.Length <= 4000,
        };
    }

    public static bool Matches(ConditionGroup? group, IReadOnlyDictionary<string, RecordField> fields, IReadOnlyDictionary<string, string?> values)
    {
        if (group is null || group.Rules.Count == 0)
        {
            return true;
        }

        bool Check(ConditionRule rule)
        {
            if (!fields.TryGetValue(ConditionFields.Key(rule), out var field))
            {
                return false;
            }

            var actual = values.GetValueOrDefault(ConditionFields.Key(rule));
            // A dynamic rule takes its value from the other field now.
            return ConditionFields.ValueKey(rule) is { } other
                ? Compare(field, actual, rule with { Value = values.GetValueOrDefault(other), Values = null })
                : Compare(field, actual, rule);
        }

        return group.MatchAll ? group.Rules.All(Check) : group.Rules.Any(Check);
    }

    private static bool Compare(RecordField field, string? actual, ConditionRule rule)
    {
        var empty = string.IsNullOrEmpty(actual);
        switch (rule.Operator)
        {
            case ConditionOperator.IsEmpty:
                return empty;
            case ConditionOperator.IsNotEmpty:
                return !empty;
            case ConditionOperator.In:
                return !empty && (rule.Values ?? []).Any(v => Same(field, actual!, v));
            case ConditionOperator.Equals:
                return empty ? string.IsNullOrEmpty(rule.Value) : rule.Value is not null && Same(field, actual!, rule.Value);
            case ConditionOperator.NotEquals:
                return empty ? !string.IsNullOrEmpty(rule.Value) : rule.Value is null || !Same(field, actual!, rule.Value);
            default:
                if (empty || rule.Value is null || Order(field, actual!, rule.Value) is not { } order)
                {
                    return false;
                }

                return rule.Operator switch
                {
                    ConditionOperator.GreaterThan => order > 0,
                    ConditionOperator.GreaterOrEqual => order >= 0,
                    ConditionOperator.LessThan => order < 0,
                    _ => order <= 0,
                };
        }
    }

    private static bool Same(RecordField field, string left, string right) => field.Type switch
    {
        RecordFieldType.Number or RecordFieldType.Money or RecordFieldType.Date => Order(field, left, right) == 0,
        RecordFieldType.User or RecordFieldType.LegalEntity => Guid.TryParse(left, out var a) && Guid.TryParse(right, out var b) && a == b,
        RecordFieldType.Text => string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase),
        _ => string.Equals(left, right, StringComparison.Ordinal),
    };

    private static int? Order(RecordField field, string left, string right)
    {
        if (field.Type == RecordFieldType.Date)
        {
            return DateOnly.TryParseExact(left, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var a)
                   && DateOnly.TryParseExact(right, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var b)
                ? a.CompareTo(b)
                : null;
        }

        return decimal.TryParse(left, NumberStyles.Number, CultureInfo.InvariantCulture, out var x)
               && decimal.TryParse(right, NumberStyles.Number, CultureInfo.InvariantCulture, out var y)
            ? x.CompareTo(y)
            : null;
    }

    /// <summary>Replaces {field-key} placeholders with the record's values (for notification texts).</summary>
    public static string Fill(string template, IReadOnlyDictionary<string, string?> values)
    {
        ArgumentNullException.ThrowIfNull(template);
        ArgumentNullException.ThrowIfNull(values);
        foreach (var (key, value) in values)
        {
            template = template.Replace("{" + key + "}", value ?? string.Empty, StringComparison.Ordinal);
        }

        return template;
    }
}
