# 22 — Redesigning the workers pages: study before building

| | |
|---|---|
| **Status** | Built on 23 October 2026, after the user approved it («موافق طبقه والسيرفر بعدين»). It is applied to the workers' list and file, and to staff (the same pages). The three server items in §2 are deferred. |
| **Request** | The user's proposal (in chat) to redesign `/workforce/workers` and the worker file. The goal: «الا يتم اضافة او تعديل شيئ يؤثر علي اداء النظام». |

## 1. What the two pages are today

| | The list: `WorkersPage.tsx` (346 lines) | The file: `WorkerDetailPage.tsx` (541 lines) |
|---|---|---|
| Routes | `/workforce/workers` **and** `/workforce/staff` (the same page with `kind="Staff"`). | `/workforce/workers/:id` and `/workforce/staff/:id`. |
| Data | One request per page: `GET /workforce/workers?search&placement&sort&desc&page&pageSize`. The server does the paging, sorting, search and the status counts. | On opening: the worker, their periods, and their photo (workers only). For those allowed: the last month's profit, through one call to the CEO report. Each tab loads its own data only when opened (invoices, cost, marketing profile, actions). |
| Kept in the URL | The search, the status and the page. | The tab (`?tab=`). |
| Not kept | The sort, the direction and the page size: lost after opening a worker and coming back. | — |
| Design | Six status cards, with a round icon sticking out of each card's top. Two info strips (read only; workers on inactive projects). The salary columns in green. | A hero with the facts, the dark «ملخص عام» card, pill tabs, and `FieldBox` boxes with an icon for every field. |

**Shared components to be careful with**
- `FieldBox` / `FieldSection` are used in 7 places: customers, projects, internal requests, and the worker's cost and profile tabs.
- `PillTabs` is used in 16.
- `PageHeader`, `Initials` and `ColumnsMenu` are used across the system.
- **So the new look must be local to the two pages** (their own variants), not a change to the shared components.

## 2. Performance: what each part of the proposal costs

| Part of the proposal | Cost | Verdict |
|---|---|---|
| Colours, sizes, cards, badges, tabs, sections | Styling only | ✅ No effect. |
| Sticky worker column and sticky table header | CSS (`position: sticky`) on ≤ 100 rows a page | ✅ No noticeable effect. |
| Neutral salary columns, light group dividers, row hover | CSS | ✅ |
| The applied filter shown as chips with «مسح الكل» | Local state | ✅ |
| Keeping the sort and the page size after coming back from a worker | Moving them into the URL, like the search | ✅ No new requests. |
| Search | Already sent only on «بحث» or Enter, never per key | ✅ Keep as is. |
| Copying the number or the iqama | `navigator.clipboard`, local | ✅ |
| Small round progress indicator in the summary | SVG | ✅ |
| **Filters by project, nationality and supplier** | The list request does not take them today. They need **new parameters on the server**, and an index check on the workers table. | ⚠️ A separate step: building them on the current page only would filter that page alone (wrong). |
| **«آخر مزامنة» under the title** | The time is known only to the sync page (permission `crm_sync.view`). Showing it to everyone needs **a new field or call**. | ⚠️ Optional. Also, after cutover (doc 21) there is no sync at all. |
| A photo in every row | One request per row (25–100 a page) | ❌ Do not add. Keep the initials. |
| Virtualising the table or a new table library | — | ❌ Not needed (server paging). |

**Conclusion.** Everything except the three marked rows can be built in the frontend only, with no new request and no change to the server, the data or the calculations.

## 3. The list page: what would change

- **Title.** «العمالة», with a small «للعرض فقط · من مزامنة النظام القديم» chip next to it. This replaces the info strip and shortens the space above the table.
- **Cards.**
  - Six white cards, about 90px high, each with a small 32px icon inside and the number in navy.
  - The status colour shows in the icon only; the large round icons sticking out go.
  - The active card gets a gold border and a `#F7F1E5` background. The cards keep filtering the table, as today, and work from the keyboard.
- **Inactive-projects note.** One short line with «عرض» / «إلغاء», instead of a strip.
- **Toolbar.** Search, then the status filter as a chip (the card's), columns, and the count, with «مسح الكل» when a filter is on.
- **Table.**
  - The worker (initials, name, number) in a sticky column, and a sticky navy header.
  - The «الراتب» group in the same navy as the header, its cells neutral and the total in bold.
  - Row hover `#F1F5F9`. Sorting and paging stay as they are.
  - **Not a «financial / operational» view switch:** the current column picker already does this, without adding complexity.
- **States.** Loading (a line, then skeleton rows on the first load), empty, error with «إعادة المحاولة».

## 4. The worker file: what would change

- **Identity header.**
  - A white card: photo, name, number and iqama (with copy) and the status badge on one side; «إجراء جديد» and «رجوع» on the other.
  - The length of service is a line of text, not a button.
- **Project and facts strip.**
  - A neutral strip: the current project, its start date and its days.
  - Then one simple grid: profession, nationality, supplier, agent, iqama expiry, service price, with «غير مسجل» for missing values.
- **Operational summary.**
  - A white card instead of the dark gradient one: a small navy ring with «نسبة أيام العمل بالمشاريع» and a short explanation.
  - Below it: the project days, housing days and number of projects.
  - The last invoiced month's profit, for those who may see it, with its period only if the server sends it.
  - The ratio's formula does not change.
- **Tabs.** Underlined tabs with a gold line, about 44px high, with counts. They scroll sideways on small screens. Each still loads its data only when opened.
- **Data sections.**
  - Navy titles and light neutral borders: label above, value below.
  - No input-like boxes when viewing, and no icon on every field.
  - The salary total stands out.

## 5. Notes from the study

1. **The cards and the table total are not the same thing, on purpose (the server's rules).**
   - The cards count every status of the current search, whatever card is chosen.
   - Workers on inactive projects are left out of the table and its total unless they are asked for (their filter or a search).
   - So the cards' sum can be larger than the table's total. The new design will say so in a short line; the calculations do not change.
2. **«نسبة أيام العمل بالمشاريع».** The page computes it from the periods: project days (work, including the customer's vacation) ÷ (project days + housing days). The label will say exactly that; please confirm the meaning.
3. **The profit has no period today.** The CEO report call returns the last invoiced month's profit without its month. Showing the month needs it from the server; otherwise it shows «آخر شهر مفوتر» as now.
4. **The proposal's §5 (side menu) is already done:** the Smart ERP Dock (doc 21).
5. **The images.** The proposal mentions screenshots of the current pages and a proposed image. Only the text arrived.

## 6. Decisions needed before building

1. **The worker file's look.** On 19 October the user decided that the employee file follows the old system's latest employee screen: the hero, the dark «ملخص عام» card, pill tabs, and boxes titled on their border (CLAUDE.md, decision 8). This page was built that way. The proposal replaces that with white cards, underlined tabs and plain sections.
   - (a) Apply the proposal to the workers' file only.
   - (b) Apply it to the staff file too (`/workforce/staff/:id`, the same page).
   - (c) Keep decision 8.
2. **Scope of the list.** Should the same look apply to `/workforce/staff` (the same page)? Recommended: yes, it is one page.
3. **The three items in §2 that need the server:** the filters by project, nationality and supplier, and the last-sync time. Build them now, or later, or not at all?
4. **The images:** send them if they are meant as the visual reference.

## 7. After review (23 October 2026)

The user's changes after trying it:

- **The list.** No status cards and no notes: only the title, the toolbar and the table.
  - The toolbar keeps the search, the status filter (including the workers of inactive projects), the columns, the total, and the applied filters with «مسح الكل».
- **The worker file is back to its earlier design:** the hero, the dark «ملخص عام» card and pill tabs (as CLAUDE.md decision 8).
  - §4 above no longer applies.

