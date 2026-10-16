using IntegratedErp.Modules.Identity.Domain;

namespace IntegratedErp.UnitTests.Identity;

public sealed class UserAccountTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 16, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Five_failures_lock_the_account_for_fifteen_minutes()
    {
        var account = UserAccount.Create("Mahmoud", null);
        for (var i = 0; i < UserAccount.MaxFailedAttempts; i++)
        {
            account.RegisterFailure(Now);
        }

        Assert.True(account.IsLockedOut(Now.AddMinutes(14)));
        Assert.False(account.IsLockedOut(Now.AddMinutes(16)));
    }

    [Fact]
    public void Recovery_codes_are_one_time_and_stored_hashed()
    {
        var account = UserAccount.Create("Mahmoud", null);
        account.BeginMfaEnrollment("protected-secret");
        var codes = account.CompleteMfaEnrollment(acceptedStep: 100);

        Assert.Equal(8, codes.Count);
        Assert.DoesNotContain(account.RecoveryCodes, c => codes.Contains(c.CodeHash));
        Assert.True(account.TryUseRecoveryCode(codes[0].ToLowerInvariant(), Now));
        Assert.False(account.TryUseRecoveryCode(codes[0], Now));
        Assert.False(account.TryUseRecoveryCode("AAAAA-BBBBB", Now));
    }

    [Fact]
    public void A_totp_step_cannot_be_reused()
    {
        var account = UserAccount.Create("Mahmoud", null);
        account.BeginMfaEnrollment("protected-secret");
        account.CompleteMfaEnrollment(acceptedStep: 100);

        Assert.False(account.TryAcceptStep(100));
        Assert.False(account.TryAcceptStep(99));
        Assert.True(account.TryAcceptStep(101));
    }
}
