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
        ],
        [
            new("project", "المشروع", "Project", [
                new("phase", "المرحلة", "Phase", RecordFieldType.Text, Updatable: true),
                new("budget", "الميزانية", "Budget", RecordFieldType.Money, Updatable: false),
            ]),
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

    [Fact]
    public void An_action_step_runs_only_a_declared_action_and_a_required_one_must_be_in_the_process()
    {
        var screen = Screen with
        {
            Actions =
            [
                new RecordAction("house_worker", "تسكين العامل", "House the worker", "يفتح فترة السكن", "Opens the housing period", Required: true),
                new RecordAction("notify_sales", "إبلاغ المبيعات", "Tell sales", "—", "—"),
            ],
        };
        static ProcessDefinition With(params Step[] onApprove) => new(null, [Stage("a", onApprove)]);
        var house = new ActionStep { Id = "x", Action = "house_worker" };

        Assert.True(DefinitionRules.Validate(With(house), screen).IsSuccess);
        Assert.Contains("not an action", DefinitionRules.Validate(With(house, new ActionStep { Id = "y", Action = "delete_all" }), screen).Error.Message, StringComparison.Ordinal);
        Assert.Contains("must run the action", DefinitionRules.Validate(With(new ActionStep { Id = "y", Action = "notify_sales" }), screen).Error.Message, StringComparison.Ordinal);

        // A process published before the action existed gets it on its last stage's approval (once).
        var old = With();
        var upgraded = IntegratedErp.Modules.Workflow.Application.RequiredActions.WithRequired(old, screen);
        var added = Assert.IsType<ActionStep>(Assert.Single(Assert.IsType<ApprovalStep>(Assert.Single(upgraded.Steps)).OnApprove));
        Assert.Equal("house_worker", added.Action);
        Assert.True(DefinitionRules.Validate(upgraded, screen).IsSuccess);
        Assert.Same(upgraded, IntegratedErp.Modules.Workflow.Application.RequiredActions.WithRequired(upgraded, screen));
    }

    [Fact]
    public void An_update_step_may_change_only_a_declared_related_table()
    {
        static ProcessDefinition With(UpdateStep update) => new(null, [Stage("a", update)]);

        Assert.True(DefinitionRules.Validate(With(new UpdateStep { Id = "u", Label = "تحديث المشروع", Target = "project", Changes = [new FieldChange("phase", "Closed")] }), Screen).IsSuccess);
        Assert.True(DefinitionRules.Validate(With(new UpdateStep { Id = "u", Target = "project", Changes = [new FieldChange("phase", null, FromField: "notes")] }), Screen).IsSuccess);
        AssertInvalid(With(new UpdateStep { Id = "u", Target = "warehouse", Changes = [new FieldChange("phase", "Closed")] }), "not a table related");
        AssertInvalid(With(new UpdateStep { Id = "u", Target = "project", Changes = [new FieldChange("budget", "5")] }), "cannot be updated");
        AssertInvalid(With(new UpdateStep { Id = "u", Target = "project", Changes = [new FieldChange("status", "UnderReview")] }), "cannot be updated");
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
    public void A_condition_can_test_a_field_of_a_related_table()
    {
        // The project's budget (a related table's field): valid, and tested on the engine's "relation.field" values.
        var rule = new ConditionRule("budget", ConditionOperator.GreaterThan, "100000", Relation: "project");
        Assert.True(DefinitionRules.Validate(new ProcessDefinition(new ConditionGroup(true, [rule]), [Stage("a")]), Screen).IsSuccess);
        AssertInvalid(new ProcessDefinition(new ConditionGroup(true, [rule with { FieldKey = "unknown" }]), [Stage("a")]), "unknown field");
        AssertInvalid(new ProcessDefinition(new ConditionGroup(true, [rule with { Relation = "customer" }]), [Stage("a")]), "unknown field");

        var fields = ConditionFields.Of(Screen);
        Assert.True(FieldValues.Matches(new ConditionGroup(true, [rule]), fields, new Dictionary<string, string?> { ["project.budget"] = "250000" }));
        Assert.False(FieldValues.Matches(new ConditionGroup(true, [rule]), fields, new Dictionary<string, string?> { ["project.budget"] = "50000", ["budget"] = "250000" }));
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
