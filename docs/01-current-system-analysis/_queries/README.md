# استعلامات وسكربتات التحليل (قراءة فقط)

كل الملفات هنا **SELECT فقط** على `SQLCRM` / `Care_Pro_MSCRM` (Windows auth)، ومفيش أي UPDATE/INSERT/DELETE.

| الملف | الغرض |
|---|---|
| `q0.sql` | قائمة الكيانات الـ custom وعدد السجلات |
| `q1.sql` | الحقول (النوع، الاسم العربي/الإنجليزي، الـ lookup target) للكيانات المستخدمة |
| `q2.sql` | الـ option sets (StringMap 1025/1033) |
| `q3.sql` | الـ workflows النشطة وخطوات الـ plugins والـ assemblies |
| `q6.sql`, `q7.sql`, `q8.sql` | إحصائيات الحالات وجودة البيانات ومهام الاعتماد |
| `dumpxaml.ps1` | تنزيل XAML الـ workflows (SELECT) لملفات محلية |
| `xaml.py` | تلخيص كل workflow (ينشئ/يحدّث/يغيّر حالة/يقرأ) ⇒ `workflow-summary.txt` |
| `labels.py` | حصر المطابقة بنص الـ label في الكود |
| `gen.py` | توليد جداول الحقول والـ option sets في 02 و 03 |

التشغيل: `sqlcmd -S SQLCRM -d Care_Pro_MSCRM -E -f 65001 -W -s"|" -i qX.sql -o out.txt` (من مجلد بمسار بسيط مثل `C:\Cl\anl`). السكربتات بتفترض مسارات `C:\Cl\anl` ومسار كود النظام الحالي.
