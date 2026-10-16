using IntegratedErp.Modules.Workflow.Domain;

namespace IntegratedErp.UnitTests.Workflow;

public sealed class ApprovalTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 16, 9, 0, 0, TimeSpan.Zero);
    private static readonly Guid Submitter = Guid.NewGuid();
    private static readonly Guid Reviewer1 = Guid.NewGuid();
    private static readonly Guid Reviewer2 = Guid.NewGuid();
    private static readonly Guid Manager = Guid.NewGuid();

    private static ApprovalInstance TwoStages()
    {
        var instance = new ApprovalInstance("workflow.internal_request", Guid.NewGuid(), "REQ-1", Guid.NewGuid(), 2, null, "{}", Submitter, "Submitter", Now);
        instance.OpenStage(1, "مراجعة", "Review", [(Reviewer1, "R1"), (Reviewer2, "R2"), (Submitter, "Self")], escalated: false);
        return instance;
    }

    private static Guid TaskOf(ApprovalInstance instance, Guid user) => instance.Tasks.Single(t => t.AssigneeUserId == user && t.Status == ApprovalTaskStatus.Pending).Id;

    [Fact]
    public void The_submitter_never_gets_a_task_on_their_own_document()
    {
        var instance = TwoStages();
        Assert.DoesNotContain(instance.Tasks, t => t.AssigneeUserId == Submitter);
        Assert.Equal(2, instance.Tasks.Count);
    }

    [Fact]
    public void First_approver_decides_the_stage_and_the_others_are_closed()
    {
        var instance = TwoStages();

        var result = instance.Decide(TaskOf(instance, Reviewer1), Reviewer1, Decision.Approve, null, Now);

        Assert.True(result.Value); // a next stage must be opened
        Assert.Equal(2, instance.CurrentStage);
        Assert.Equal(ApprovalTaskStatus.Closed, instance.Tasks.Single(t => t.AssigneeUserId == Reviewer2).Status);
        var late = instance.Decide(instance.Tasks.Single(t => t.AssigneeUserId == Reviewer2).Id, Reviewer2, Decision.Approve, null, Now);
        Assert.Equal("conflict.approval_task_closed", late.Error.Code);
    }

    [Fact]
    public void Approving_the_last_stage_completes_the_instance()
    {
        var instance = TwoStages();
        instance.Decide(TaskOf(instance, Reviewer1), Reviewer1, Decision.Approve, null, Now);
        instance.OpenStage(2, "اعتماد المدير", "Manager approval", [(Manager, "M")], escalated: false);

        var result = instance.Decide(TaskOf(instance, Manager), Manager, Decision.Approve, "ok", Now);

        Assert.False(result.Value);
        Assert.Equal(InstanceStatus.Approved, instance.Status);
        Assert.Equal(Now, instance.CompletedAt);
    }

    [Fact]
    public void Reject_and_return_need_a_reason_and_end_the_instance()
    {
        var instance = TwoStages();
        Assert.Equal("validation.approval_comment_required", instance.Decide(TaskOf(instance, Reviewer1), Reviewer1, Decision.Reject, "  ", Now).Error.Code);

        instance.Decide(TaskOf(instance, Reviewer1), Reviewer1, Decision.Return, "أرفق عرض السعر", Now);

        Assert.Equal(InstanceStatus.Returned, instance.Status);
        Assert.Equal("أرفق عرض السعر", instance.Tasks.Single(t => t.Status == ApprovalTaskStatus.Returned).Comment);
    }

    [Fact]
    public void Only_the_assignee_can_decide_a_task()
    {
        var instance = TwoStages();
        Assert.Equal("not_found.approval_task", instance.Decide(TaskOf(instance, Reviewer1), Reviewer2, Decision.Approve, null, Now).Error.Code);
    }

    [Fact]
    public void Each_route_change_is_a_new_version_and_stages_are_validated()
    {
        var route = new ApprovalRoute("workflow.internal_request");
        string[] keys = ["direct_manager"];

        Assert.Equal("validation.route_stage_count", route.Publish([], keys, "admin", Now).Error.Code);
        Assert.Equal("validation.route_stage_invalid", route.Publish([new StageInput("مراجعة", "Review", ApproverKind.Role, null, null, null)], keys, "admin", Now).Error.Code);
        Assert.Equal("validation.route_stage_invalid", route.Publish([new StageInput("مدير", "Manager", ApproverKind.Dynamic, null, null, "ceo")], keys, "admin", Now).Error.Code);

        route.Publish([new StageInput("المدير المباشر", "Direct manager", ApproverKind.Dynamic, null, null, "direct_manager")], keys, "admin", Now);
        route.Publish([new StageInput("مراجعة", "Review", ApproverKind.User, Reviewer1, null, null), new StageInput("مدير", "Manager", ApproverKind.User, Manager, null, null)], keys, "admin", Now);

        Assert.Equal(2, route.CurrentVersion);
        Assert.Equal(2, route.Current!.Stages.Count);
        Assert.Single(route.Versions.Single(v => v.Version == 1).Stages);
    }
}
