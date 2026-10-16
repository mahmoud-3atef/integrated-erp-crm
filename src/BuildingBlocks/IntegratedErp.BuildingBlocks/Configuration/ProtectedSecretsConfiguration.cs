using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace IntegratedErp.BuildingBlocks.Configuration;

/// <summary>
/// Secrets for on-prem Windows hosts, kept out of appsettings and out of Git: a JSON dictionary of
/// configuration keys (e.g. <c>Identity:Ldap:BindPassword</c>) encrypted with Windows DPAPI.
/// Only the Windows account (CurrentUser scope) or machine (LocalMachine scope) that wrote it can read it.
/// Written by <c>tools/Set-ErpSecret.ps1</c>. Replaced by a vault (Key Vault) when moving to the cloud.
/// </summary>
public static class ProtectedSecretsConfiguration
{
    /// <summary>Override the file location (e.g. on a server running under a service account).</summary>
    public const string PathVariable = "ERP_SECRETS_FILE";

    /// <summary>Extra entropy shared with the PowerShell tool, so other DPAPI blobs can't be swapped in.</summary>
    internal static readonly byte[] Entropy = Encoding.UTF8.GetBytes("IntegratedErp.Secrets.v1");

    public static string DefaultPath =>
        Environment.GetEnvironmentVariable(PathVariable) is { Length: > 0 } configured
            ? configured
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "IntegratedErp", "secrets.dat");

    public static IConfigurationBuilder AddProtectedSecretsFile(this IConfigurationBuilder builder, string? path = null)
    {
        ArgumentNullException.ThrowIfNull(builder);

        if (!OperatingSystem.IsWindows())
        {
            return builder;
        }

        var values = Read(path ?? DefaultPath);
        return values.Count == 0 ? builder : builder.AddInMemoryCollection(values);
    }

    [SupportedOSPlatform("windows")]
    internal static Dictionary<string, string?> Read(string path)
    {
        if (!File.Exists(path))
        {
            return [];
        }

        var protectedBytes = File.ReadAllBytes(path);
        var json = Unprotect(protectedBytes);
        return JsonSerializer.Deserialize<Dictionary<string, string?>>(json) ?? [];
    }

    [SupportedOSPlatform("windows")]
    internal static void Write(string path, IReadOnlyDictionary<string, string?> values, DataProtectionScope scope)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var json = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(values));
        File.WriteAllBytes(path, ProtectedData.Protect(json, Entropy, scope));
    }

    [SupportedOSPlatform("windows")]
    private static string Unprotect(byte[] protectedBytes)
    {
        try
        {
            return Encoding.UTF8.GetString(ProtectedData.Unprotect(protectedBytes, Entropy, DataProtectionScope.CurrentUser));
        }
        catch (CryptographicException)
        {
            // Written with machine scope (server installs).
            return Encoding.UTF8.GetString(ProtectedData.Unprotect(protectedBytes, Entropy, DataProtectionScope.LocalMachine));
        }
    }
}
