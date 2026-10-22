# 20 — Live updates (pages that refresh by themselves)

| | |
|---|---|
| **Status** | Built on 22 October 2026. The first page is «لوحة الإدارة التنفيذية». |
| **Asked for by the user** | «عملت امر تسليم لكن الشاشة محدثتش غير لما عملت ريفريش … محتاج طريقة تكون الشاشة dynamic اي تحديث يسمع فيها» |

## How it works

1. **On the server, every save is noticed.** `LiveChangesInterceptor` is added to every module DbContext through `AddModuleDbContext`, so it needs nothing per module.
   - **What it notes:** for each saved change, it records the company (the row's `TenantId`) and the module (its schema, e.g. `operations`). Audit, outbox and numbering rows are ignored.
   - **Outside a transaction:** the change is announced at once.
   - **Inside a transaction:** the change is announced when the transaction commits, and never when it rolls back.
2. **`LiveChanges` (a singleton) hands each announcement to that company's open pages.** Each page has a bounded queue: a slow page loses its oldest items, and it refreshes anyway.
3. **`GET /api/v1/system/live`** is a server-sent event stream (`text/event-stream`):
   - it needs a signed-in company user (`company-user`);
   - each event is `event: change` with `data: operations,housing`, which is only module names, never data;
   - a heartbeat is sent every 25 seconds;
   - each stream lasts 10 minutes, and then the browser opens the next one by itself and signs in again;
   - a page that is signed out stops getting events.
4. **In the browser**, `api/live.ts` keeps one `EventSource` per tab, open only while a page is listening.
   - `useLiveTick(areas?)` returns a number that grows after a change. Changes close together count once, after about 1.2 seconds.
   - A hidden tab refreshes when it is shown again.
   - A page adds the number to its loaders' dependencies. With `useFreshKey`, a live refresh is quiet: no skeleton, and the filters and the chosen employee stay. A change of period starts over.

## Why this design

- **Safety:** the stream carries no figures. The page reads them again through its own endpoints, with its own permissions and company. Nothing is exposed that the page could not already read.
- **No polling:** pages fetch only when something has changed.
- **Changes from the old system count too:** the CRM sync's imports save through the same DbContexts, so a sync that brings changes refreshes the dashboard as well.

## Limits and next steps

- **One server:** the broadcaster lives in the server's memory, which fits the single on-prem server. Several servers (the cloud later) would need a backplane, such as Redis or SQL Server polling.
- **IIS:** the stream turns off response buffering. IIS dynamic compression does not compress `text/event-stream` by default, so leave it that way.
- **Other pages:** other pages can use the same thing in a few lines, such as lists, the delivery orders, the showroom and timesheets. Each page is added when the user asks for it.
