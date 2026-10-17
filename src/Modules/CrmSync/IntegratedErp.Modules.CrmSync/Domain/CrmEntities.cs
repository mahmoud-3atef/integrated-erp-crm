using System.Text.RegularExpressions;

namespace IntegratedErp.Modules.CrmSync.Domain;

/// <summary>
/// One CRM entity copied to staging: its logical name (the CRM view <c>dbo.{Name}</c>, key column <c>{Name}id</c>,
/// change column <c>modifiedon</c>) and how people call it.
/// </summary>
public sealed partial record CrmEntity(string Name, string NameAr, string NameEn)
{
    public string IdColumn => Name + "id";

    /// <summary>CRM logical names are lower-case letters, digits and '_' only; anything else is never put in SQL.</summary>
    public static bool IsValidName(string name) => NamePattern().IsMatch(name);

    [GeneratedRegex("^[a-z][a-z0-9_]{1,60}$", RegexOptions.CultureInvariant)]
    private static partial Regex NamePattern();
}

/// <summary>The CRM entities phase 1 needs (docs/03-migration-plan/03 slice 0.9), in the order they are synced.</summary>
public static class CrmEntities
{
    public const string Country = "new_country";
    public const string Profession = "new_profession";
    public const string Employee = "new_employee";

    public static readonly IReadOnlyList<CrmEntity> All =
    [
        new(Country, "الدول والجنسيات", "Countries and nationalities"),
        new(Profession, "المهن", "Professions"),
        new("systemuser", "مستخدمو النظام", "System users"),
        new("team", "الفرق", "Teams"),
        new("account", "العملاء", "Customers"),
        new("new_project", "المشاريع", "Projects"),
        new(Employee, "الموظفون والعمالة", "Employees and workers"),
        new("new_empwork", "مباشرات العمل", "Work starts"),
        new("new_deliverorder", "أوامر التسليم", "Delivery orders"),
        new("mw_lodginorderdetails", "تفاصيل أوامر السكن", "Housing order lines"),
        new("new_ajeercontract", "الأسرّة", "Beds"),
        new("new_thijridate", "تسكين الأسرّة", "Bed assignments"),
        new("hr_vicrequest", "طلبات الإجازات", "Vacation requests"),
        new("new_invoice", "فواتير المشاريع", "Project invoices"),
        new("new_invoicdetail", "تفاصيل الفواتير", "Invoice lines"),
    ];

    public static CrmEntity? Find(string name) => All.FirstOrDefault(e => e.Name == name);
}
