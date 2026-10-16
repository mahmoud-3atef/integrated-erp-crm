using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;

namespace IntegratedErp.UnitTests.Workflow;

public sealed class ProcessDefinitionTests
{
    private static readonly ApprovalScreen Screen = new(
        "test.request",
        "طلب",
        "Request",
        "/r/{id}",
        [
            new("amount", "المبلغ", "Amount", RecordFieldType.Money, Updatable: false),
            new("category", "النوع", "Category", RecordFieldType.Choice, Updatable: false, [new("PURCHASE", "شراء", "Purchase"), new("LEAVE", "إجازة", "Leave")]),
            new("manager", "المدير", "Manager", RecordFieldType.User, Updatable: false),
            new("status", "الحالة", "Status", RecordFieldType.Choice, Updatable: true, [new("UnderReview", "قيد المراجعة", "Under review")]),
            new("notes", "ملاحظات", "Notes", RecordFieldType.Text, Updatable: true),
        ]);

    private static readonly Dictionary<string, RecordField> Fields = Screen.Fields.ToDictionary(f => f.Key);

    private static ApprovalStep Stage(string id, params Step[] onApprove) => new()
    {
        Id = id,
        NameAr = "مرحلة " + id,
        NameEn = "Stage " + id,
        Assignees = [new Assignee(AssigneeKind.UserField, FieldKey: "manager")],
        OnApprove = onApprove,
    };

    [Fact]
    public void A_valid_process_passes_and_common_mistakes_are_reported()
    {
        var valid = new ProcessDefinition(
            new ConditionGroup(true, [new ConditionRule("category", ConditionOperator.Equals, "PURCHASE")]),
            [
                new ConditionStep
                {
                    Id = "c1",
                    Branches = [new ConditionBranch(new ConditionGroup(true, [new ConditionRule("amount", ConditionOperator.GreaterThan, "10000")]), [Stage("finance")])],
                },
                Stage("manager", new UpdateStep { Id = "u1", Changes = [new FieldChange("status", "UnderReview")] }),
            ]);
        Assert.True(DefinitionRules.Validate(valid, Screen).IsSuccess);

        Assert.Equal("validation.process_invalid", DefinitionRules.Validate(ProcessDefinition.Empty, Screen).Error.Code);
        AssertInvalid(new ProcessDefinition(null, [new StopStep { Id = "s", Outcome = StopOutcome.Approved }]), "approval stage");
        AssertInvalid(new ProcessDefinition(null, [Stage("a"), Stage("a")]), "unique id");
        AssertInvalid(new ProcessDefinition(null, [Stage("a", new UpdateStep { Id = "u", Changes = [new FieldChange("amount", "5")] })]), "cannot be updated");
        AssertInvalid(new ProcessDefinition(null, [Stage("a", new UpdateStep { Id = "u", Changes = [new FieldChange("status", "Approved")] })]), "not valid");
        AssertInvalid(new ProcessDefinition(new ConditionGroup(true, [new ConditionRule("category", ConditionOperator.GreaterThan, "PURCHASE")]), [Stage("a")]), "not valid for its type");
        AssertInvalid(new ProcessDefinition(null, [Stage("a") with { RequiredFields = ["amount"] }]), "updatable");
    }

    private static void AssertInvalid(ProcessDefinition definition, string expected)
    {
        var result = DefinitionRules.Validate(definition, Screen);
        Assert.True(result.IsFailure);
        Assert.Contains(expected, result.Error.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("15000.50", ConditionOperator.GreaterThan, "10000", true)]
    [InlineData("10000", ConditionOperator.GreaterThan, "10000", false)]
    [InlineData("10000", ConditionOperator.GreaterOrEqual, "10000.00", true)]
    [InlineData(null, ConditionOperator.GreaterThan, "0", false)]
    [InlineData(null, ConditionOperator.IsEmpty, null, true)]
    [InlineData("5", ConditionOperator.LessThan, "10", true)]
    public void Money_conditions_compare_as_numbers(string? actual, ConditionOperator op, string? value, bool expected)
    {
        var group = new ConditionGroup(true, [new ConditionRule("amount", op, value)]);
        Assert.Equal(expected, FieldValues.Matches(group, Fields, new Dictionary<string, string?> { ["amount"] = actual }));
    }

    [Fact]
    public void All_and_any_groups_combine_rules()
    {
        var values = new Dictionary<string, string?> { ["amount"] = "500", ["category"] = "LEAVE" };
        var rules = new List<ConditionRule> { new("amount", ConditionOperator.GreaterThan, "1000"), new("category", ConditionOperator.In, Values: ["LEAVE", "PURCHASE"]) };

        Assert.False(FieldValues.Matches(new ConditionGroup(true, rules), Fields, values));
        Assert.True(FieldValues.Matches(new ConditionGroup(false, rules), Fields, values));
        Assert.True(FieldValues.Matches(null, Fields, values));
    }

    [Fact]
    public void The_cursor_runs_branches_then_continues_after_the_step_that_opened_them()
    {
        var definition = new ProcessDefinition(null,
        [
            new ConditionStep
            {
                Id = "c1",
                Branches = [new ConditionBranch(new ConditionGroup(true, []), [Stage("inner")])],
                Else = [Stage("else")],
            },
            Stage("last", new NotifyStep { Id = "n1", To = [new Recipient(RecipientKind.Submitter)], TitleAr = "ت", TitleEn = "t" }),
        ]);
        var cursor = ProcessCursor.Start();

        var first = cursor.Next(definition)!;
        Assert.Equal("c1", first.Id);
        cursor.Advance(first, "b0", definition);
        var inner = cursor.Next(definition)!;
        Assert.Equal("inner", inner.Id);

        // Survives a restart: the position is plain JSON.
        cursor = ProcessCursor.Parse(cursor.Serialize());
        cursor.Advance(inner, ProcessCursor.Approve, definition);
        var last = cursor.Next(definition)!;
        Assert.Equal("last", last.Id);

        cursor.Advance(last, ProcessCursor.Approve, definition);
        Assert.Equal("n1", cursor.Next(definition)!.Id);
        cursor.Advance(cursor.Next(definition)!, null, definition);
        Assert.Null(cursor.Next(definition));
        Assert.True(cursor.IsFinished);
    }

    [Fact]
    public void Notification_texts_fill_field_placeholders()
    {
        Assert.Equal("طلب REQ-1 بمبلغ 500", FieldValues.Fill("طلب {title} بمبلغ {amount}", new Dictionary<string, string?> { ["title"] = "REQ-1", ["amount"] = "500" }));
    }

    [Fact]
    public void Publishing_creates_a_new_version_and_keeps_the_old_ones()
    {
        var process = new ApprovalProcess("test.request", "عملية", "Process", 0, "{\"steps\":[]}");
        Assert.Equal("validation.process_not_published", process.SetActive(true).Error.Code);

        process.Publish("admin", DateTimeOffset.UtcNow);
        process.SaveDraft("{\"steps\":[1]}");
        Assert.True(process.DraftChanged);
        process.Publish("admin", DateTimeOffset.UtcNow);

        Assert.Equal(2, process.CurrentVersion);
        Assert.Equal("{\"steps\":[]}", process.Versions.Single(v => v.Version == 1).Definition);
        Assert.True(process.IsActive);
        Assert.False(process.DraftChanged);
    }
}
