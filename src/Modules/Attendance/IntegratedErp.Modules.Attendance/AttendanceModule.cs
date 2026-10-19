using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Attendance.Api;
using IntegratedErp.Modules.Attendance.Application;
using IntegratedErp.Modules.Attendance.Contracts;
using IntegratedErp.Modules.Attendance.Infrastructure;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Attendance;

/// <summary>
/// Attendance module (docs/03-migration-plan/08): the staff's attendance — shifts with their Ramadan hours, the holiday
/// calendar, the fingerprint files, and each employee's days calculated from them and corrected by HR.
/// </summary>
public sealed class AttendanceModule : IModule
{
    public string Name => AttendanceContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<AttendanceDbContext>(configuration, AttendanceDbContext.SchemaName);
        services.AddScoped<AttendanceSetup>();
        services.AddScoped<AttendanceQueries>();
        services.AddScoped<AttendanceImporter>();
        services.AddScoped<AttendanceService>();
        services.AddPermissions(AttendancePermissions.All);
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapAttendanceEndpoints();
}

internal static class AttendancePermissions
{
    public const string View = "attendance.view";
    public const string Manage = "attendance.manage";
    public const string Settings = "attendance.settings";

    private const string GroupAr = "الحضور والانصراف";
    private const string GroupEn = "Attendance";

    public static readonly PermissionDefinition[] All =
    [
        new(View, GroupAr, GroupEn, "عرض حضور الموظفين", "View the staff's attendance"),
        new(Manage, GroupAr, GroupEn, "استيراد ملف البصمة وتصحيح الأيام", "Import the fingerprint file and correct days"),
        new(Settings, GroupAr, GroupEn, "إدارة الورديات والتقويم وإعدادات الحضور", "Manage shifts, the calendar and the attendance settings"),
    ];
}
