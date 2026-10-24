# Design unity: one shared look (2026-10-24)

The user asked to apply the page proposals of 2026-10-24 (the home page, the workers table, debt aging) with Claude's review notes, aiming at «وحدة التصميم في النظام». The old design can be restored page by page (below).

## The shared kit

`src/Web/src/components/designKit.tsx` holds the look first made for the workers list (doc 22). `pages/workforce/workforceUi.tsx` now only re-exports it.

- **Tokens (`wf`):** navy with a little gold, white surfaces, neutral borders, and status colours that only mean a status.
- **`card`:** a white card with a light border.
- **`num`:** tabular numerals.
- **`navyHead`:** a table's navy head, its rows and its totals row.
- **`StatusPill`:** a status with a dot and its text.
- **`KpiCard`:** one figure in a card:
  - a skeleton while loading;
  - «—» with a tooltip when the value is unknown, never 0;
  - a danger colour only when the figure calls for attention;
  - clickable when given `onClick`.

The proposal's own teal colour was not taken: the system keeps one palette. HR screens keep their own tokens (CLAUDE.md).

## What changed

### Home (`pages/HomePage.tsx`)

**Removed:**
- the coloured hero band and its floating circles (two endless animations);
- the counting numbers (`CountUp`);
- the staggered entrance.

**Added:**
- a plain header (greeting, company, both dates) with «أمر تسليم جديد» for those allowed;
- four `KpiCard`s that open the workers list filtered;
- «أين العمالة الآن» as a split bar and a list with counts and shares;
- this month's work starts and returns next to the month before (an arrow and words, in a neutral colour), above the 12-month chart;
- projects, nationalities and professions as plain bars with shares. «غير محدد» is grey: missing data, not a category.

**Kept:** the documents waiting (tinted when some are in approval), the latest documents, housing and the data checks.

**Server:** the same three requests as before; nothing new.

### Debt aging (`pages/billing/AgingPage.tsx`)

**The page:**
- three figures: the net owed (with the credit), past due, and over 60 days (with its share of the amount owed);
- the distribution by age as a bar with amounts and shares;
- a table whose cells darken with the delay, under a navy head, with a totals row held at the bottom.

**Rules:**
- The «رصيد دائن» column only shows when some project has credit.
- Amounts show two decimals.
- The figures are the server's totals.
- When a search narrows the table, its totals row says «إجمالي النتائج المعروضة».

**Server:** the same single request.

### Workers list (`pages/workforce/WorkersPage.tsx`)

- **Iqama:** shown as `2605•••526`. The worker's file shows it whole, and the search still finds it by any part.
- **Rows:** alternate rows lightly shaded.
- **Totals row:** when salaries are shown, a row held at the bottom, «إجمالي الصفحة · n», that sums only the page shown.

**Not taken (the user's earlier decisions):**
- the page title with the count;
- the status buttons with their counts, which would be one more request.

## Restoring the old design

Each page's previous version is in the commit before this change (`c6a7919`). Restore one page with:

```bash
git checkout c6a7919 -- src/Web/src/pages/HomePage.tsx src/Web/src/pages/HomePage.js
```

Do the same for `pages/billing/AgingPage` or `pages/workforce/WorkersPage` (both the `.tsx` and its `.js` twin). Leave the shared kit and the translations: they are harmless. Then build and deploy as usual.
