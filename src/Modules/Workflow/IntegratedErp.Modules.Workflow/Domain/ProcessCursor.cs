using System.Text.Json;

namespace IntegratedErp.Modules.Workflow.Domain;

/// <summary>A nested step list: which step it hangs from and which of its branches ("approve", "reject", "return", "b0"…, "else").</summary>
public sealed record PathSegment(string StepId, string Branch);

/// <summary>A position: the step list (by path from the root) and the index of the next step to run in it.</summary>
public sealed record Frame(IReadOnlyList<PathSegment> Path, int Index);

/// <summary>
/// Where a running approval stands in its step tree: a stack of frames, the innermost last. When a nested list
/// finishes, its frame is dropped and the outer list continues after the step that opened it.
/// </summary>
public sealed class ProcessCursor
{
    public const string Approve = "approve";
    public const string Reject = "reject";
    public const string Return = "return";
    public const string Else = "else";

    private readonly List<Frame> _frames;

    private ProcessCursor(List<Frame> frames) => _frames = frames;

    public static ProcessCursor Start() => new([new Frame([], 0)]);

    public static ProcessCursor Parse(string json) =>
        new(JsonSerializer.Deserialize<List<Frame>>(json) ?? []);

    public string Serialize() => JsonSerializer.Serialize(_frames);

    public bool IsFinished => _frames.Count == 0;

    /// <summary>The next step to run, dropping finished lists; null when the whole process has run.</summary>
    public Step? Next(ProcessDefinition definition)
    {
        while (_frames.Count > 0)
        {
            var frame = _frames[^1];
            var list = Resolve(definition, frame.Path);
            if (frame.Index < list.Count)
            {
                return list[frame.Index];
            }

            _frames.RemoveAt(_frames.Count - 1);
        }

        return null;
    }

    /// <summary>Moves past the current step; when <paramref name="branch"/> has steps, runs them first.</summary>
    public void Advance(Step current, string? branch, ProcessDefinition definition)
    {
        ArgumentNullException.ThrowIfNull(current);
        var frame = _frames[^1];
        _frames[^1] = frame with { Index = frame.Index + 1 };
        if (branch is not null && BranchOf(current, branch).Count > 0)
        {
            _frames.Add(new Frame([.. frame.Path, new PathSegment(current.Id, branch)], 0));
        }
    }

    /// <summary>The step list at a path (empty when the path no longer exists in this definition).</summary>
    public static IReadOnlyList<Step> Resolve(ProcessDefinition definition, IReadOnlyList<PathSegment> path)
    {
        ArgumentNullException.ThrowIfNull(definition);
        IReadOnlyList<Step> list = definition.Steps;
        foreach (var segment in path)
        {
            var owner = list.FirstOrDefault(s => s.Id == segment.StepId);
            if (owner is null)
            {
                return [];
            }

            list = BranchOf(owner, segment.Branch);
        }

        return list;
    }

    public static IReadOnlyList<Step> BranchOf(Step step, string branch) => step switch
    {
        ApprovalStep a => branch switch
        {
            Approve => a.OnApprove,
            Reject => a.OnReject,
            Return => a.OnReturn,
            _ => [],
        },
        ConditionStep c when branch == Else => c.Else,
        ConditionStep c when branch.StartsWith('b') && int.TryParse(branch.AsSpan(1), out var i) && i >= 0 && i < c.Branches.Count => c.Branches[i].Steps,
        _ => [],
    };
}
