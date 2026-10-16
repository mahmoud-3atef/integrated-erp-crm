using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace IntegratedErp.Modules.Identity.Domain;

/// <summary>
/// Time-based one-time passwords (RFC 6238 / RFC 4226) as used by Microsoft/Google Authenticator:
/// HMAC-SHA1, 30-second steps, 6 digits, ±1 step tolerance for clock drift.
/// </summary>
public static class Totp
{
    public const int StepSeconds = 30;
    public const int Digits = 6;
    public const int SecretBytes = 20;

    public static byte[] NewSecret() => RandomNumberGenerator.GetBytes(SecretBytes);

    public static long TimeStep(DateTimeOffset at) => at.ToUnixTimeSeconds() / StepSeconds;

    public static string Code(byte[] secret, long timeStep, int digits = Digits)
    {
        ArgumentNullException.ThrowIfNull(secret);

        Span<byte> counter = stackalloc byte[8];
        BinaryPrimitives.WriteInt64BigEndian(counter, timeStep);
#pragma warning disable CA5350 // RFC 6238 authenticator apps use HMAC-SHA1; its use here is not a weakness.
        var hash = HMACSHA1.HashData(secret, counter);
#pragma warning restore CA5350

        var offset = hash[^1] & 0x0F;
        var binary = ((hash[offset] & 0x7F) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
        var modulo = (int)Math.Pow(10, digits);
        return (binary % modulo).ToString(new string('0', digits), System.Globalization.CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Checks a code at <paramref name="at"/> (±1 step). Returns the matched time step, or null.
    /// Callers must reject a step at or before the last accepted one (replay protection).
    /// </summary>
    public static long? Verify(byte[] secret, string code, DateTimeOffset at)
    {
        var normalized = (code ?? string.Empty).Replace(" ", string.Empty, StringComparison.Ordinal);
        if (normalized.Length != Digits || !normalized.All(char.IsAsciiDigit))
        {
            return null;
        }

        var now = TimeStep(at);
        for (var step = now - 1; step <= now + 1; step++)
        {
            if (CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Code(secret, step)), Encoding.ASCII.GetBytes(normalized)))
            {
                return step;
            }
        }

        return null;
    }

    /// <summary>The <c>otpauth://</c> URI an authenticator app scans (as a QR code).</summary>
    public static string ProvisioningUri(byte[] secret, string accountName, string issuer = "IntegratedErp")
    {
        var label = Uri.EscapeDataString($"{issuer}:{accountName}");
        return $"otpauth://totp/{label}?secret={Base32.Encode(secret)}&issuer={Uri.EscapeDataString(issuer)}&algorithm=SHA1&digits={Digits}&period={StepSeconds}";
    }
}

/// <summary>RFC 4648 Base32 (no padding) — the secret format authenticator apps expect.</summary>
public static class Base32
{
    private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    public static string Encode(ReadOnlySpan<byte> data)
    {
        var output = new StringBuilder((data.Length * 8 + 4) / 5);
        int buffer = 0, bits = 0;
        foreach (var b in data)
        {
            buffer = (buffer << 8) | b;
            bits += 8;
            while (bits >= 5)
            {
                output.Append(Alphabet[(buffer >> (bits - 5)) & 31]);
                bits -= 5;
            }
        }

        if (bits > 0)
        {
            output.Append(Alphabet[(buffer << (5 - bits)) & 31]);
        }

        return output.ToString();
    }

    public static byte[] Decode(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        var clean = text.TrimEnd('=').ToUpperInvariant();
        var output = new List<byte>(clean.Length * 5 / 8);
        int buffer = 0, bits = 0;
        foreach (var c in clean)
        {
            var value = Alphabet.IndexOf(c, StringComparison.Ordinal);
            if (value < 0)
            {
                throw new FormatException($"'{c}' is not a Base32 character.");
            }

            buffer = (buffer << 5) | value;
            bits += 5;
            if (bits >= 8)
            {
                output.Add((byte)((buffer >> (bits - 8)) & 0xFF));
                bits -= 8;
            }
        }

        return [.. output];
    }
}
