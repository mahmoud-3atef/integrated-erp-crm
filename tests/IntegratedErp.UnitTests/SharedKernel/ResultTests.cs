using IntegratedErp.SharedKernel;

namespace IntegratedErp.UnitTests.SharedKernel;

public sealed class ResultTests
{
    [Fact]
    public void Success_has_no_error()
    {
        var result = Result.Success(42);

        Assert.True(result.IsSuccess);
        Assert.Equal(42, result.Value);
        Assert.Equal(Error.None, result.Error);
    }

    [Fact]
    public void Failure_carries_error_and_hides_value()
    {
        var error = Error.Validation("price_required", "Service price is required.");

        var result = Result.Failure<decimal>(error);

        Assert.True(result.IsFailure);
        Assert.Equal("validation.price_required", result.Error.Code);
        Assert.Throws<InvalidOperationException>(() => result.Value);
    }

    [Fact]
    public void Failure_without_error_is_rejected()
    {
        Assert.Throws<ArgumentException>(() => Result.Failure(Error.None));
    }
}
