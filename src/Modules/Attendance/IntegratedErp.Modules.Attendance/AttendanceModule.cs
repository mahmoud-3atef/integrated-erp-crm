using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Attendance.Api;
using IntegratedErp.Modules.Attendance.Application;
using IntegratedErp.Modules.Attendance.Contracts;
using IntegratedErp.Modules.Attendance.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
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
    public const string OvertimeSequence = "attendance_overtime";

    public string Name => AttendanceContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<AttendanceDbContext>(configuration, AttendanceDbContext.SchemaName);
        services.AddScoped<AttendanceSetup>();
        services.AddScoped<AttendanceQueries>();
        services.AddScoped<AttendanceImporter>();
        services.AddScoped<AttendanceService>();
        services.AddScoped<MonthClosing>();
        services.AddScoped<OvertimeService>();
        services.AddScoped<IAttendanceMonths, AttendanceMonths>();
        services.AddScoped<IAttendanceCalendar, AttendanceCalendar>();
        services.AddScoped<IApprovalRecordAdapter, MonthAdapter>();
        services.AddScoped<IApprovalRecordAdapter, OvertimeAdapter>();
        services.AddAlertProvider<AttendanceAlerts>();
        services.AddPermissions(AttendancePermissions.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition(OvertimeSequence, AttendanceDbContext.SchemaName, "الحضور والانصراف", "Attendance", "طلبات العمل الإضافي", "Overtime requests", "OT-{YYYY}-{N:5}", NumberReset.Yearly));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapAttendanceEndpoints();
}

internal static class AttendancePermissions
{
    public const string View = "attendance.view";
    public const string Manage = "attendance.manage";
    public const string Settings = "attendance.settings";
    public const string MonthReview = "attendance.month.review";
    public const string MonthClose = "attendance.month.close";
    public const string OvertimeApprove = "attendance.overtime.approve";

    private const string GroupAr = "الحضور والانصراف";
    private const string GroupEn = "Attendance";

    public static readonly PermissionDefinition[] All =
    [
        new(View, GroupAr, GroupEn, "عرض حضور الموظفين", "View the staff's attendance"),
        new(Manage, GroupAr, GroupEn, "استيراد ملف البصمة وتصحيح الأيام", "Import the fingerprint file and correct days"),
        new(Settings, GroupAr, GroupEn, "إدارة الورديات والتقويم وإعدادات الحضور", "Manage shifts, the calendar and the attendance settings"),
        new(MonthReview, GroupAr, GroupEn, "مراجعة حضور الشهر قبل إقفاله", "Review the month's attendance before closing"),
        new(MonthClose, GroupAr, GroupEn, "إقفال حضور الشهر وإعادة فتحه", "Close the month's attendance and reopen it"),
        new(OvertimeApprove, GroupAr, GroupEn, "اعتماد طلبات العمل الإضافي", "Approve overtime requests"),
    ];
}
