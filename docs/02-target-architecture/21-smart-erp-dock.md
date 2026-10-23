# 21 — Smart ERP Dock Navigation

| | |
|---|---|
| **Status** | Built on 23 October 2026, from the specification the user gave in chat («Smart ERP Dock Navigation — Full Implementation Specification»). |
| **Replaces** | The old side menu (`Sidebar` in `AppShell.tsx`), which was a folded rail opening on hover, with a pin. |

## Phase 1 — what was found

| Concern | How it works |
|---|---|
| Framework | React 19 + TypeScript, Vite, MUI 9 (Emotion, Stylis RTL), React Router 7. |
| Menu configuration | `menu` in `src/app/AppShell.tsx`: sections (`titleKey`, `icon`, `items`) with items (`path`, `labelKey`, `icon`, `permission` / `anyOf` / `companyWide`, `showTaskCount`). |
| Permissions | `useSession().can()` filters the items. The server still protects every page. |
| Active route | The longest menu path that covers `location.pathname`. |
| Icons | `@mui/icons-material` (kept: no new library). |
| Localization | i18next (`menu.*` keys in `ar.json` / `en.json`). RTL comes from the theme's direction. |
| Badges | `useTaskCount`: the approval tasks waiting for the user. |
| Tests | Vitest + jsdom, pure-logic tests. |

## Architecture

- **`src/components/nav/dockModel.ts`** holds the pure logic, with tests in `dockModel.test.ts`:
  - the module and item model (`DockModule`, `DockItem`, which may nest);
  - the current page and its module;
  - the nested items to open after a refresh;
  - the magnification factor by distance.
- **`src/components/nav/SmartDock.tsx`** is the component:
  - `SmartDock` holds the layout, the compact or expanded mode, the temporary opening in compact mode, the sync with the route, the accordion state, the magnification and the arrow keys;
  - `Module` is one primary module: its icon, title, badge, chevron, active states, and its accordion;
  - `Accordion` animates with `grid-template-rows: 0fr → 1fr`, so `height: auto` is never animated, and is `inert` when closed;
  - `SubList` lists the items with the gold connector, the selected item, and nested items, recursively.
- **`AppShell.tsx`** still owns the menu and the permission filter. It turns the sections into modules (`toModules`): the home items become one module each, and every section becomes a module of its items.

## Decisions

- **Colours.** These are the specification's tokens, collected in the `dock` object of `SmartDock.tsx`:
  - the navy background `#0B2D43`;
  - the open module `#665124`, with a gold icon `#D6A849` and gold title `#F5D48B`;
  - the items in gold `#D8B976`;
  - the selected item `#34627C` with white text.
  - All the text pairs pass AA. The lowest is about 5:1, the gold title on the open module.
- **States.** The **open** module shows a gold row, gold icon, gold title, gold edge line, and a turned chevron. The module **holding the current page**, when closed, keeps a gold ring on its icon and a gold title. In compact mode, its icon is gold. Hover only lightens the icon.
- **Magnification.**
  - Only the primary icons grow, by `1 + 0.35 / (1 + (d/42)²)`, where `d` is the cursor's distance to the icon's centre. That gives about 1.35 under the cursor, 1.15 one row away and 1.05 two rows away, and nothing beyond 150px.
  - The icon positions are measured once per hover and again only after a scroll, an accordion change, a mode change or a resize. Scaling is applied directly to the element in `requestAnimationFrame`, with no React rendering.
  - It uses `transform: scale()` only (180ms, `cubic-bezier(0.22, 1, 0.36, 1)`), so the rows, the width and the page never move.
  - It is off on touch screens and when the system asks for reduced motion.
  - **Windows Server turns animations off by default.** Seen from this server, the Dock does not magnify. To see the effect there, turn on Settings → Accessibility → Visual effects → Animation effects.
- **Accordion.** Only one module is open at a time. Clicking an open module closes it. A page change (click, Back or Forward, refresh) opens the module and the nested items of the current page.
- **Compact mode.**
  - The button at the top switches between 260px and 76px. The choice is kept in this browser (`erp.sidebarCompact`); the old pin's choice carries over the first time.
  - In compact mode, the icons have tooltips and the badges sit on the icons.
  - A module with items opens the full Dock over the page, without moving it, with that module open. Choosing a page, clicking outside or Escape folds it back. This is the user's earlier request that the menu close as soon as an item is chosen.
  - As the old rail did, the mouse resting on the rail a moment (140ms) also opens the full Dock over the page, and leaving it folds it (the user's request, 2026-10-23). Just after a page is chosen it stays folded until the mouse leaves. Clicking still opens it, so nothing depends on hover alone.
- **Phone.** A drawer with the full Dock and no magnification, which closes after a page is chosen.
- **Keyboard and accessibility.**
  - The menu is a `nav` with lists. The modules are buttons with `aria-expanded` and `aria-controls`; the pages are links with `aria-current="page"`.
  - Up and Down arrows, Home and End move between the visible entries. Enter and Space work.
  - Focus is shown with a gold outline, and every target is at least 40px.
- **RTL and LTR.** Only logical properties are used, so the connector and indentation sit on the start side. The Dock is on the right in Arabic and on the left in English.

## Not changed

Routes, permissions, the menu's content, the breadcrumbs, the server and authorization.
