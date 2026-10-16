namespace IntegratedErp.SharedKernel;

/// <summary>
/// A business or validation error with a stable code. The code is what logic and clients
/// match on; the message is for display only (never match on message text).
/// </summary>
public sealed record Error(string Code, string Message)
{
    public static readonly Error None = new(string.Empty, string.Empty);

    public static Error Validation(string code, string message) => new($"validation.{code}", message);

    public static Error NotFound(string code, string message) => new($"not_found.{code}", message);

    public static Error Conflict(string code, string message) => new($"conflict.{code}", message);
}
