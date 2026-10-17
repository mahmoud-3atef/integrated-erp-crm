namespace IntegratedErp.Modules.CrmSync.Domain;

/// <summary>A country with its ISO 3166 alpha-3 code: the nationality item code in the new system.</summary>
public sealed record Country(string Code, string NameAr, string NameEn, IReadOnlyList<string> Aliases);

/// <summary>
/// The countries nationalities are matched to: ISO 3166 alpha-3 codes with standard Arabic and English names, plus
/// the other spellings found in the old CRM (aliases), so each nationality exists once whatever way it was typed.
/// </summary>
public static class Countries
{
    // Code|Arabic|English|aliases separated by ';' (Arabic or English, any spelling the CRM used).
    private const string Data = """
        AFG|أفغانستان|Afghanistan|
        ALB|ألبانيا|Albania|
        DZA|الجزائر|Algeria|
        ASM|ساموا الأمريكية|American Samoa|سامواالأمريكية
        AND|أندورا|Andorra|
        AGO|أنغولا|Angola|انغولا
        ATG|أنتيغوا وباربودا|Antigua and Barbuda|
        ARG|الأرجنتين|Argentina|
        ARM|أرمينيا|Armenia|
        AUS|أستراليا|Australia|استراليا
        AUT|النمسا|Austria|
        AZE|أذربيجان|Azerbaijan|ازيربيجان;أذربيجان
        BHS|جزر البهاما|Bahamas|
        BHR|البحرين|Bahrain|
        BGD|بنغلاديش|Bangladesh|بنجلاديش;بنجلادش;بنغلادش;Bangladeshi
        BRB|باربادوس|Barbados|بربادوس
        BLR|بيلاروسيا|Belarus|روسيا البيضاء
        BEL|بلجيكا|Belgium|
        BLZ|بليز|Belize|بيليز
        BEN|بنين|Benin|بينين
        BTN|بوتان|Bhutan|
        BOL|بوليفيا|Bolivia|
        BIH|البوسنة والهرسك|Bosnia and Herzegovina|البوسنة
        BWA|بوتسوانا|Botswana|
        BRA|البرازيل|Brazil|
        BRN|بروناي|Brunei|
        BGR|بلغاريا|Bulgaria|
        BFA|بوركينا فاسو|Burkina Faso|
        BDI|بوروندي|Burundi|
        KHM|كمبوديا|Cambodia|كامبوديا
        CMR|الكاميرون|Cameroon|
        CAN|كندا|Canada|
        CPV|الرأس الأخضر|Cape Verde|
        CYM|جزر كايمان|Cayman Islands|جزر سيمان
        CAF|جمهورية أفريقيا الوسطى|Central African Republic|
        TCD|تشاد|Chad|
        CHL|تشيلي|Chile|شيلي
        CHN|الصين|China|
        COL|كولومبيا|Colombia|
        COM|جزر القمر|Comoros|
        COG|الكونغو|Congo|
        COD|جمهورية الكونغو الديمقراطية|Democratic Republic of the Congo|
        CRI|كوستاريكا|Costa Rica|
        CIV|ساحل العاج|Côte d'Ivoire|Ivorian;Ivory Coast;كوت ديفوار
        HRV|كرواتيا|Croatia|
        CUB|كوبا|Cuba|
        CUW|كوراساو|Curaçao|
        CYP|قبرص|Cyprus|
        CZE|التشيك|Czechia|Czech Republic;جمهورية التشيك
        DNK|الدنمارك|Denmark|الدانمارك
        DJI|جيبوتي|Djibouti|
        DMA|دومينيكا|Dominica|
        DOM|جمهورية الدومينيكان|Dominican Republic|ج الدومينيكان
        ECU|الإكوادور|Ecuador|
        EGY|مصر|Egypt|
        SLV|السلفادور|El Salvador|
        GNQ|غينيا الاستوائية|Equatorial Guinea|
        ERI|إريتريا|Eritrea|ارتيريا;Eritrean
        EST|إستونيا|Estonia|ايستونيا
        SWZ|إسواتيني|Eswatini|سوازيلاند;Swaziland
        ETH|إثيوبيا|Ethiopia|
        FJI|فيجي|Fiji|
        FIN|فنلندا|Finland|
        FRA|فرنسا|France|
        GAB|الغابون|Gabon|
        GMB|غامبيا|Gambia|
        GEO|جورجيا|Georgia|
        DEU|ألمانيا|Germany|
        GHA|غانا|Ghana|
        GRC|اليونان|Greece|
        GRD|غرينادا|Grenada|
        GTM|غواتيمالا|Guatemala|جواتيمالا
        GIN|غينيا|Guinea|
        GNB|غينيا بيساو|Guinea-Bissau|
        GUY|غيانا|Guyana|غويان
        HTI|هايتي|Haiti|هاييتي
        VAT|الفاتيكان|Holy See (Vatican)|Vatican City
        HND|هندوراس|Honduras|
        HKG|هونغ كونغ|Hong Kong|هونج كونج;Hong Kong SAR
        HUN|المجر|Hungary|
        ISL|آيسلندا|Iceland|
        IND|الهند|India|Indian
        IDN|إندونيسيا|Indonesia|
        IRN|إيران|Iran|
        IRQ|العراق|Iraq|
        IRL|أيرلندا|Ireland|ايرلاندا;Irland
        ITA|إيطاليا|Italy|
        JAM|جامايكا|Jamaica|
        JPN|اليابان|Japan|
        JOR|الأردن|Jordan|
        KAZ|كازاخستان|Kazakhstan|
        KEN|كينيا|Kenya|
        KIR|كيريباتي|Kiribati|
        PRK|كوريا الشمالية|North Korea|
        KOR|كوريا الجنوبية|South Korea|Korea
        KWT|الكويت|Kuwait|
        KGZ|قيرغيزستان|Kyrgyzstan|كيرجستان
        LAO|لاوس|Laos|
        LVA|لاتفيا|Latvia|
        LBN|لبنان|Lebanon|
        LSO|ليسوتو|Lesotho|
        LBR|ليبيريا|Liberia|ليبريا
        LBY|ليبيا|Libya|
        LIE|ليختنشتاين|Liechtenstein|
        LTU|ليتوانيا|Lithuania|
        LUX|لوكسمبورغ|Luxembourg|لوكسمبورج
        MAC|ماكاو|Macao|ما كاو;Macao SAR
        MDG|مدغشقر|Madagascar|
        MWI|ملاوي|Malawi|
        MYS|ماليزيا|Malaysia|
        MDV|جزر المالديف|Maldives|المالديف
        MLI|مالي|Mali|
        MLT|مالطا|Malta|
        MHL|جزر مارشال|Marshall Islands|
        MRT|موريتانيا|Mauritania|
        MUS|موريشيوس|Mauritius|
        MEX|المكسيك|Mexico|
        FSM|ميكرونيزيا|Micronesia|
        MDA|مولدوفا|Moldova|
        MCO|موناكو|Monaco|
        MNG|منغوليا|Mongolia|
        MNE|الجبل الأسود|Montenegro|
        MAR|المغرب|Morocco|
        MOZ|موزمبيق|Mozambique|
        MMR|ميانمار|Myanmar|
        NAM|ناميبيا|Namibia|
        NRU|ناورو|Nauru|
        NPL|نيبال|Nepal|النيبال
        NLD|هولندا|Netherlands|
        ANT|جزر الأنتيل الهولندية|Netherlands Antilles|هولانده انتيلاس
        NZL|نيوزيلندا|New Zealand|نيو زيلندا
        NIC|نيكاراغوا|Nicaragua|نيكاراجوا
        NER|النيجر|Niger|
        NGA|نيجيريا|Nigeria|
        MKD|مقدونيا الشمالية|North Macedonia|مقدونيا;Macedonia, Former Yugoslav Republic of
        NOR|النرويج|Norway|
        OMN|عُمان|Oman|عمان
        PAK|باكستان|Pakistan|اسلام اباد;إسلام آباد
        PLW|بالاو|Palau|
        PSE|فلسطين|Palestine|Palestinian Authority
        PAN|بنما|Panama|
        PNG|بابوا غينيا الجديدة|Papua New Guinea|
        PRY|باراغواي|Paraguay|
        PER|بيرو|Peru|
        PHL|الفلبين|Philippines|Filipino
        POL|بولندا|Poland|
        PRT|البرتغال|Portugal|
        PRI|بورتوريكو|Puerto Rico|
        QAT|قطر|Qatar|
        ROU|رومانيا|Romania|
        RUS|روسيا|Russia|
        RWA|رواندا|Rwanda|
        KNA|سانت كيتس ونيفيس|Saint Kitts and Nevis|
        LCA|سانت لوسيا|Saint Lucia|
        VCT|سانت فنسنت والغرينادين|Saint Vincent and the Grenadines|
        WSM|ساموا|Samoa|
        SMR|سان مارينو|San Marino|سان مار
        STP|ساو تومي وبرينسيب|Sao Tome and Principe|
        SAU|السعودية|Saudi Arabia|المملكة العربية السعودية;KSA;Saudi;RIYADH;الرياض
        SEN|السنغال|Senegal|
        SRB|صربيا|Serbia|
        SYC|سيشل|Seychelles|سيشيل
        SLE|سيراليون|Sierra Leone|
        SGP|سنغافورة|Singapore|
        SVK|سلوفاكيا|Slovakia|جمهورية سلوفاكيا
        SVN|سلوفينيا|Slovenia|
        SLB|جزر سليمان|Solomon Islands|
        SOM|الصومال|Somalia|
        ZAF|جنوب أفريقيا|South Africa|
        SSD|جنوب السودان|South Sudan|
        ESP|إسبانيا|Spain|أسبانيا
        LKA|سريلانكا|Sri Lanka|Srilanka;سيرلانكا
        SDN|السودان|Sudan|
        SUR|سورينام|Suriname|
        SWE|السويد|Sweden|
        CHE|سويسرا|Switzerland|
        SYR|سوريا|Syria|سورية
        TWN|تايوان|Taiwan|
        TJK|طاجيكستان|Tajikistan|تاجاكستان
        TZA|تنزانيا|Tanzania|
        THA|تايلاند|Thailand|
        TLS|تيمور الشرقية|Timor-Leste|
        TGO|توغو|Togo|
        TON|تونغا|Tonga|التونجو
        TTO|ترينيداد وتوباغو|Trinidad and Tobago|
        TUN|تونس|Tunisia|
        TUR|تركيا|Türkiye|Turkey
        TKM|تركمانستان|Turkmenistan|تركمينستان
        TUV|توفالو|Tuvalu|
        UGA|أوغندا|Uganda|
        UKR|أوكرانيا|Ukraine|
        ARE|الإمارات العربية المتحدة|United Arab Emirates|الإمارات
        GBR|المملكة المتحدة|United Kingdom|بريطانيا
        USA|الولايات المتحدة الأمريكية|United States|الولايات المتحدة;امريكا;أمريكا
        URY|الأوروغواي|Uruguay|أورغواي
        UZB|أوزبكستان|Uzbekistan|اوزبيكستان
        VUT|فانواتو|Vanuatu|
        VEN|فنزويلا|Venezuela|
        VNM|فيتنام|Vietnam|فييتنام
        ESH|الصحراء الغربية|Western Sahara|
        YEM|اليمن|Yemen|
        ZMB|زامبيا|Zambia|
        ZWE|زيمبابوي|Zimbabwe|
        """;

    /// <summary>Values typed into the CRM's country list that are not countries (e.g. "Block", "عام", "All Countries").</summary>
    private static readonly string[] NotCountries =
    [
        "Block", "عام", "مفتوح", "جميع الدول", "All Countries", "All", "القبائل النازحة", "Tribes displaced",
    ];

    public static readonly IReadOnlyList<Country> All = Data
        .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(line => line.Split('|'))
        .Select(p => new Country(p[0], p[1], p[2], p[3].Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)))
        .ToList();

    private static readonly Dictionary<string, Country> ByCode = All.ToDictionary(c => c.Code, StringComparer.Ordinal);

    // Key of a name or alias → the country, and whether the key is the country's own name (not an alias).
    private static readonly Dictionary<string, (Country Country, bool Own)> ByKey = BuildIndex();

    private static readonly HashSet<string> NotCountryKeys = NotCountries.Select(ArabicText.Key).ToHashSet(StringComparer.Ordinal);

    public static Country? Find(string code) => ByCode.GetValueOrDefault(code);

    /// <summary>The country a typed name refers to (any spelling or known alias), and whether it is its own name.</summary>
    public static (Country? Country, bool Own) Lookup(string? name) =>
        ByKey.TryGetValue(ArabicText.Key(name), out var found) ? found : (null, false);

    public static bool IsNotACountry(string? name) => NotCountryKeys.Contains(ArabicText.Key(name));

    private static Dictionary<string, (Country, bool)> BuildIndex()
    {
        var index = new Dictionary<string, (Country, bool)>(StringComparer.Ordinal);
        foreach (var country in All)
        {
            foreach (var own in new[] { country.NameAr, country.NameEn })
            {
                index.TryAdd(ArabicText.Key(own), (country, true));
            }
        }

        foreach (var country in All)
        {
            foreach (var alias in country.Aliases)
            {
                index.TryAdd(ArabicText.Key(alias), (country, false));
            }
        }

        return index;
    }
}

/// <summary>
/// Turns the CRM's countries into nationality items: each record is matched to one ISO country by its Arabic name,
/// else its English name, else its nationality text, so a country typed several ways becomes one item. Records that
/// are not countries ("Block", "عام") are left unmapped for review.
/// </summary>
public static class NationalityPlanner
{
    private const int UnusedSortOrder = 1000;

    public static ReferencePlan Plan(IReadOnlyList<CrmLookup> all)
    {
        var (records, kept) = ManualMappings.Split(all);
        var matched = new List<(CrmLookup Record, Country? Country, MatchRule Rule)>();
        foreach (var record in records)
        {
            matched.Add(Match(record));
        }

        // Several CRM records of one country: the most used keeps its rule, exact copies of it are duplicates.
        var mappings = new List<PlannedMapping>(kept);
        foreach (var group in matched.GroupBy(m => m.Country?.Code))
        {
            var ordered = group.OrderByDescending(m => m.Record.Usage).ThenByDescending(m => m.Record.IsActive).ThenBy(m => m.Record.Id).ToList();
            var firstKey = ArabicText.Key(ordered[0].Record.Name);
            for (var i = 0; i < ordered.Count; i++)
            {
                var (record, country, rule) = ordered[i];
                if (country is not null && i > 0 && rule == MatchRule.Name)
                {
                    rule = ArabicText.Key(record.Name) == firstKey ? MatchRule.Duplicate : MatchRule.Spelling;
                }

                mappings.Add(new(record.Id, ArabicText.Clean(record.Name), record.Code, country?.Code, rule, record.Usage));
            }
        }

        var rank = 0;
        var items = matched.Where(m => m.Country is not null)
            .GroupBy(m => m.Country!)
            .Select(g => (Country: g.Key, Usage: g.Sum(m => m.Record.Usage)))
            .OrderByDescending(x => x.Usage)
            .ThenBy(x => x.Country.NameEn, StringComparer.Ordinal)
            .Select(x => new PlannedItem(x.Country.Code, x.Country.NameAr, x.Country.NameEn, x.Usage > 0 ? ++rank : UnusedSortOrder, NeedsReview: false))
            .ToList();
        return new ReferencePlan(items, mappings);
    }

    private static (CrmLookup, Country?, MatchRule) Match(CrmLookup record)
    {
        if (Countries.IsNotACountry(record.Name) || ArabicText.Key(record.Name).Length == 0)
        {
            return (record, null, MatchRule.Unmapped);
        }

        var (arabic, arabicOwn) = Countries.Lookup(record.Name);
        var (english, englishOwn) = Countries.Lookup(record.EnglishName);
        if (arabic is not null)
        {
            if (english is not null && english != arabic)
            {
                return (record, arabic, MatchRule.Conflict);
            }

            return (record, arabic, arabicOwn ? MatchRule.Name : MatchRule.Alias);
        }

        if (english is not null)
        {
            return (record, english, englishOwn ? MatchRule.EnglishName : MatchRule.Alias);
        }

        var (byNationality, _) = Countries.Lookup(record.Nationality);
        return byNationality is not null ? (record, byNationality, MatchRule.Alias) : (record, null, MatchRule.Unmapped);
    }
}
