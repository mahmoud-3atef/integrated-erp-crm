using IntegratedErp.Modules.Payroll.Application;

namespace IntegratedErp.UnitTests.Payroll;

public sealed class PayslipTests
{
    [Theory]
    [InlineData("1087654321", "4321")]
    [InlineData(" 2418871203 ", "1203")]
    [InlineData("123", "123")]
    [InlineData(null, null)]
    [InlineData("  ", null)]
    public void The_ID_number_shows_its_last_four_digits_only(string? id, string? expected) => Assert.Equal(expected, PayslipService.Last4(id));

    [Fact]
    public void The_IBAN_shows_its_country_and_last_four_digits_only()
    {
        Assert.Equal("SA•• •••• 4471", PayslipService.MaskIban("SA0380000000608010164471"));
        Assert.Null(PayslipService.MaskIban(null));
        Assert.Null(PayslipService.MaskIban("SA03"));
    }
}

public sealed class PayslipEmailTests
{
    [Theory]
    [InlineData("sara@example.test", "sara@example.test")]
    [InlineData(" sara@example.test ", "sara@example.test")]
    [InlineData("sara@localhost", null)]
    [InlineData("not an address", null)]
    [InlineData("Sara <sara@example.test>", null)]
    [InlineData(null, null)]
    public void Only_a_plain_address_is_used(string? email, string? expected) => Assert.Equal(expected, PayslipMailer.Valid(email));

    [Fact]
    public void A_confidential_email_keeps_no_body_once_sent_or_given_up()
    {
        var at = new DateTimeOffset(2026, 10, 20, 8, 0, 0, TimeSpan.Zero);
        var sent = new IntegratedErp.Modules.Documents.Domain.OutgoingEmail(null, "a@example.test", "Payslip", "<b>9,992.22</b>", "9,992.22", at, confidential: true);
        sent.MarkSent(at);
        Assert.Equal((string.Empty, string.Empty, "Payslip"), (sent.HtmlBody, sent.TextBody, sent.Subject));

        var failed = new IntegratedErp.Modules.Documents.Domain.OutgoingEmail(null, "a@example.test", "Payslip", "<b>1</b>", "1", at, confidential: true);
        for (var i = 0; i < IntegratedErp.Modules.Documents.Domain.OutgoingEmail.MaxAttempts; i++)
        {
            Assert.NotEqual(string.Empty, failed.HtmlBody);
            failed.MarkFailed("down", at);
        }

        Assert.Equal(string.Empty, failed.HtmlBody);

        var notice = new IntegratedErp.Modules.Documents.Domain.OutgoingEmail(null, "a@example.test", "Notice", "<b>hi</b>", "hi", at);
        notice.MarkSent(at);
        Assert.Equal("<b>hi</b>", notice.HtmlBody);
    }

    [Fact]
    public void The_email_lists_each_item_with_its_reference()
    {
        Assert.Equal(("قسط السلفة ADV-2026-00003", "Advance installment ADV-2026-00003"), PayslipEmailTemplate.Label(new PayslipItem("installment", 1000, "ADV-2026-00003")));
        Assert.Equal(("إضافة — مكافأة", "Addition — مكافأة"), PayslipEmailTemplate.Label(new PayslipItem("addition", 500, Note: "مكافأة")));
    }
}
