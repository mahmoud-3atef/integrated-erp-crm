using IntegratedErp.BuildingBlocks.Reference;

namespace IntegratedErp.Modules.Workforce;

/// <summary>The lists of the workers' marketing profile (docs/03-migration-plan/15); companies add their own items.</summary>
internal static class WorkforceReferenceLists
{
    public const string Specialties = "worker_specialties";
    public const string Skills = "worker_skills";
    public const string Languages = "languages";

    // Specialties the showroom suggests from the old system's project names.
    public const string Waiter = "WAITER";
    public const string Housekeeping = "HOUSEKEEPING";
    public const string Hospitality = "HOSPITALITY";
    public const string Cleaner = "CLEANER";
    public const string KitchenHelper = "KITCHEN_HELPER";

    public static readonly ReferenceListDefinition[] All =
    [
        new(
            Specialties,
            "تخصصات العمالة",
            "Worker specialties",
            "ما يُسوَّق به العامل للعملاء (غير مهنة الإقامة).",
            "What a worker is marketed as to customers (not the residence-permit profession).",
            [
                new(Waiter, "نادل", "Waiter"),
                new(Housekeeping, "تدبير فندقي", "Housekeeping"),
                new(Hospitality, "عامل ضيافة", "Hospitality attendant"),
                new(Cleaner, "عامل نظافة", "Cleaner"),
                new(KitchenHelper, "مساعد مطبخ", "Kitchen helper"),
                new("COOK", "طاهٍ", "Cook"),
                new("BARISTA", "باريستا", "Barista"),
                new("RECEPTIONIST", "موظف استقبال", "Receptionist"),
                new("DRIVER", "سائق", "Driver"),
                new("LABORER", "عامل عام", "General laborer"),
            ]),
        new(
            Skills,
            "مهارات العمالة",
            "Worker skills",
            "المهارات التي تظهر في ملف العامل التسويقي.",
            "Skills shown on a worker's marketing profile.",
            [
                new("TABLE_SERVICE", "خدمة الطاولات", "Table service"),
                new("BUFFET", "البوفيه", "Buffet"),
                new("BANQUET", "الحفلات والمناسبات", "Banquets and events"),
                new("ROOM_SERVICE", "خدمة الغرف", "Room service"),
                new("ROOM_CLEANING", "تنظيف الغرف", "Room cleaning"),
                new("LAUNDRY", "الغسيل والكي", "Laundry and ironing"),
                new("COFFEE", "تحضير القهوة", "Coffee preparation"),
                new("FOOD_PREP", "تجهيز الطعام", "Food preparation"),
                new("DISHWASHING", "غسيل الأواني", "Dishwashing"),
                new("CUSTOMER_SERVICE", "خدمة العملاء", "Customer service"),
                new("FIRST_AID", "إسعافات أولية", "First aid"),
            ]),
        new(
            Languages,
            "اللغات",
            "Languages",
            "لغات العمالة والموظفين.",
            "Languages of workers and staff.",
            [
                new("AR", "العربية", "Arabic"),
                new("EN", "الإنجليزية", "English"),
                new("TL", "الفلبينية", "Filipino"),
                new("HI", "الهندية", "Hindi"),
                new("UR", "الأردية", "Urdu"),
                new("BN", "البنغالية", "Bengali"),
                new("NE", "النيبالية", "Nepali"),
                new("SI", "السنهالية", "Sinhala"),
                new("TA", "التاميلية", "Tamil"),
                new("ML", "المالايالامية", "Malayalam"),
                new("SW", "السواحلية", "Swahili"),
                new("ID", "الإندونيسية", "Indonesian"),
                new("FR", "الفرنسية", "French"),
            ]),
    ];
}
