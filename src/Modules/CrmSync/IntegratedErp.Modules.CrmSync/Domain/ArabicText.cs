using System.Text;

namespace IntegratedErp.Modules.CrmSync.Domain;

/// <summary>Spelling-insensitive comparison of names typed by people in Arabic or English.</summary>
public static class ArabicText
{
    /// <summary>
    /// A key equal for spellings of the same name: no diacritics or tatweel; أ إ آ ٱ → ا, ى ئ → ي, ة → ه, ؤ → و;
    /// Arabic digits → 0-9; Latin lower-case; spaces and punctuation removed.
    /// "مدير إدارة تطوير الأعمال" and "مدير ادارة  تطوير الاعمال" have the same key.
    /// </summary>
    public static string Key(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        var key = new StringBuilder(text.Length);
        foreach (var c in text)
        {
            var mapped = c switch
            {
                'أ' or 'إ' or 'آ' or 'ٱ' => 'ا',
                'ى' or 'ئ' => 'ي',
                'ة' => 'ه',
                'ؤ' => 'و',
                >= '٠' and <= '٩' => (char)('0' + (c - '٠')),
                >= '۰' and <= '۹' => (char)('0' + (c - '۰')),
                _ => char.ToLowerInvariant(c),
            };

            // Diacritics (tashkeel, superscript alef) and tatweel are not part of the name.
            if (mapped is (>= 'ً' and <= 'ٟ') or 'ٰ' or 'ـ')
            {
                continue;
            }

            if (char.IsLetterOrDigit(mapped))
            {
                key.Append(mapped);
            }
        }

        return key.ToString();
    }

    /// <summary>The name as shown: trimmed, with single spaces.</summary>
    public static string Clean(string? text) =>
        string.Join(' ', (text ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    public static bool HasArabic(string? text) => text?.Any(c => c is >= '؀' and <= 'ۿ') == true;

    /// <summary>Cuts a name to a column's length.</summary>
    public static string Fit(string text, int max) => text.Length <= max ? text : text[..max].TrimEnd();

    /// <summary>A CRM code usable as a reference item code (A-Z, 0-9, '-', '_', 1-30), or null.</summary>
    public static string? AsItemCode(string? code)
    {
        var cleaned = Clean(code).ToUpperInvariant().Replace(' ', '_');
        return cleaned.Length is > 0 and <= 30 && cleaned.All(c => c is (>= 'A' and <= 'Z') or (>= '0' and <= '9') or '-' or '_')
            ? cleaned
            : null;
    }
}
