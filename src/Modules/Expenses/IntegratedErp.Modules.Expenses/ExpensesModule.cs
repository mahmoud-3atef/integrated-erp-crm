using IntegratedErp.BuildingBlocks.Attachments;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Reference;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Expenses.Api;
using IntegratedErp.Modules.Expenses.Application;
using IntegratedErp.Modules.Expenses.Contracts;
using IntegratedErp.Modules.Expenses.Infrastructure;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Expenses;

/// <summary>
/// Expenses module (docs/03-migration-plan/16): what the company spends on its workers, its projects and in general,
/// for the profitability of the workers and the projects.
/// </summary>
public sealed class ExpensesModule : IModule
{
    public const string Sequence = "expense";
    public const string OwnerType = "expenses.expense";

    public string Name => ExpensesContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<ExpensesDbContext>(configuration, ExpensesDbContext.SchemaName);
        services.AddScoped<ExpenseService>();
        services.AddScoped<IExpenseLedger>(sp => sp.GetRequiredService<ExpenseService>());
        services.AddPermissions(ExpensePermissions.All);
        services.AddReferenceLists(ExpenseCategories.List);
        services.AddAttachmentOwners<ExpenseOwnerCheck>(new AttachmentOwnerDefinition(OwnerType, ExpensePermissions.View, ExpensePermissions.Manage, true));
        services.AddNumberSequences(
            new NumberSequenceDefinition(Sequence, ExpensesDbContext.SchemaName, "المالية", "Finance", "المصاريف", "Expenses", "EXP-{YYYY}-{N:5}", NumberReset.Yearly));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapExpenseEndpoints();
}

internal static class ExpensePermissions
{
    public const string View = "expenses.view";
    public const string Manage = "expenses.manage";

    private const string GroupAr = "المصاريف";
    private const string GroupEn = "Expenses";

    public static readonly PermissionDefinition[] All =
    [
        new(View, GroupAr, GroupEn, "عرض المصاريف", "View expenses"),
        new(Manage, GroupAr, GroupEn, "تسجيل المصاريف وتعديلها وإلغاؤها", "Record, edit and cancel expenses"),
    ];
}

/// <summary>What the company spends on; companies add their own.</summary>
internal static class ExpenseCategories
{
    public const string ListCode = "expense_categories";

    public static readonly ReferenceListDefinition List = new(
        ListCode,
        "تصنيفات المصاريف",
        "Expense categories",
        "على ماذا تُصرف المصاريف: العمالة والمشاريع والمصاريف العامة.",
        "What expenses are spent on: workers, projects and general.",
        [
            new("IQAMA_RENEWAL", "تجديد إقامة", "Residence permit renewal"),
            new("WORK_PERMIT", "رخصة عمل", "Work permit"),
            new("VISA_FEE", "سداد تأشيرة", "Visa fee"),
            new("EXIT_REENTRY", "تأشيرة خروج وعودة", "Exit and re-entry visa"),
            new("MEDICAL_INSURANCE", "تأمين طبي", "Medical insurance"),
            new("MEDICAL_CHECK", "فحص طبي", "Medical check"),
            new("TRAVEL_TICKET", "تذاكر سفر وانتقال", "Travel tickets"),
            new("TRANSPORT", "مواصلات ونقل", "Transport"),
            new("ACCOMMODATION", "سكن وإعاشة", "Accommodation and food"),
            new("UNIFORM", "زي العمل", "Uniforms"),
            new("GOVERNMENT_FEE", "رسوم حكومية أخرى", "Other government fees"),
            new("OTHER", "أخرى", "Other"),
        ]);
}
