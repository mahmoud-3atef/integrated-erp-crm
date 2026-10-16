using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.Modules.Organization.Domain.Settings;
using IntegratedErp.Modules.Organization.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Organization.Application.Settings;

/// <summary>Reads and writes effective-dated settings.</summary>
internal sealed class SettingsService(OrganizationDbContext db, ITenantContext tenant)
{
    /// <summary>Raw JSON of the value that applies on <paramref name="asOf"/> for the context, or null.</summary>
    public async Task<string?> GetEffectiveValueAsync(string key, SettingContext context, DateOnly asOf, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (!tenant.IsSystem && context.TenantId != tenant.TenantId)
        {
            throw new UnauthorizedAccessException("Settings of another tenant cannot be read.");
        }

        var normalizedKey = Setting.NormalizeKey(key);
        var tenantId = context.TenantId;

        // All versions of the key for this tenant (plus System); the timeline picks the scope and date.
        var candidates = await db.Settings
            .AsNoTracking()
            .Where(s => s.Key == normalizedKey && (s.TenantId == null || s.TenantId == tenantId))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return SettingTimeline.Resolve(candidates, context, asOf)?.Value;
    }

    public async Task<T?> GetEffectiveAsync<T>(string key, SettingContext context, DateOnly asOf, CancellationToken cancellationToken)
    {
        var json = await GetEffectiveValueAsync(key, context, asOf, cancellationToken).ConfigureAwait(false);
        return json is null ? default : JsonSerializer.Deserialize<T>(json);
    }

    /// <summary>Sets the value effective from <paramref name="effectiveFrom"/>; the previous version is closed that day.</summary>
    public async Task<Result> SetValueAsync(string key, SettingScope scope, string jsonValue, DateOnly effectiveFrom, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(scope);

        // System-wide values are changed by system operations only; scoped values by their own tenant only.
        var allowed = tenant.IsSystem || (scope.TenantId is { } owner && owner == tenant.TenantId);
        if (!allowed)
        {
            return Result.Failure(Error.Validation("setting_scope_forbidden", "This setting scope belongs to another tenant or to the system."));
        }

        if (!IsValidJson(jsonValue))
        {
            return Result.Failure(Error.Validation("setting_value_not_json", "The setting value must be valid JSON."));
        }

        var normalizedKey = Setting.NormalizeKey(key);
        var versions = await db.Settings
            .Where(s => s.Key == normalizedKey
                && s.ScopeType == scope.Type
                && s.TenantId == scope.TenantId
                && s.ScopeId == scope.ScopeId)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var result = SettingTimeline.SetValue(versions, normalizedKey, scope, jsonValue, effectiveFrom);
        if (result.IsFailure)
        {
            return result;
        }

        if (db.Entry(result.Value).State == EntityState.Detached)
        {
            db.Settings.Add(result.Value);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    private static bool IsValidJson(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        try
        {
            using var _ = JsonDocument.Parse(value);
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
