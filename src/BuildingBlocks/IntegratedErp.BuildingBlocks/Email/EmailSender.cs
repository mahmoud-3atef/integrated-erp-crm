using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.BuildingBlocks.Email;

public sealed record EmailMessage(string To, string Subject, string HtmlBody, string TextBody);

public interface IEmailSender
{
    /// <summary>True when email is configured; otherwise messages stay in-system only.</summary>
    bool IsEnabled { get; }

    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

/// <summary>
/// <c>Email:*</c> settings. The SMTP password is a secret (DPAPI secrets file, <c>Email:Password</c>), never appsettings.
/// With <see cref="PickupDirectory"/> set (development), messages are written there as .eml files instead of sent.
/// </summary>
public sealed class EmailOptions
{
    public const string Section = "Email";

    public string? Host { get; set; }

    public int Port { get; set; } = 587;

    public bool EnableSsl { get; set; } = true;

    public string? UserName { get; set; }

    public string? Password { get; set; }

    public string? FromAddress { get; set; }

    public string FromName { get; set; } = "Integrated ERP";

    public string? PickupDirectory { get; set; }
}

public sealed class SmtpEmailSender(IOptions<EmailOptions> options) : IEmailSender
{
    private readonly EmailOptions _options = options.Value;

    public bool IsEnabled => _options.FromAddress is { Length: > 0 } && (_options.Host is { Length: > 0 } || _options.PickupDirectory is { Length: > 0 });

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);
        if (!IsEnabled)
        {
            throw new InvalidOperationException("Email is not configured.");
        }

        using var mail = new MailMessage
        {
            From = new MailAddress(_options.FromAddress!, _options.FromName, Encoding.UTF8),
            Subject = message.Subject,
            SubjectEncoding = Encoding.UTF8,
            Body = message.TextBody,
            BodyEncoding = Encoding.UTF8,
        };
        mail.To.Add(new MailAddress(message.To));
        mail.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(message.HtmlBody, Encoding.UTF8, "text/html"));

        using var client = new SmtpClient();
        if (_options.PickupDirectory is { Length: > 0 } folder)
        {
            // Environment variables are allowed (e.g. %LOCALAPPDATA%\IntegratedErp\mail) so the setting is not tied to one machine.
            var path = Path.GetFullPath(Environment.ExpandEnvironmentVariables(folder));
            Directory.CreateDirectory(path);
            client.DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory;
            client.PickupDirectoryLocation = path;
        }
        else
        {
            client.Host = _options.Host!;
            client.Port = _options.Port;
            client.EnableSsl = _options.EnableSsl;
            if (_options.UserName is { Length: > 0 })
            {
                client.Credentials = new NetworkCredential(_options.UserName, _options.Password);
            }
        }

        await client.SendMailAsync(mail, cancellationToken).ConfigureAwait(false);
    }
}

public static class EmailExtensions
{
    public static IServiceCollection AddEmail(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<EmailOptions>().Bind(configuration.GetSection(EmailOptions.Section));
        services.AddSingleton<IEmailSender, SmtpEmailSender>();
        return services;
    }
}
