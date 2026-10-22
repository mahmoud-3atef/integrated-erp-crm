# 20 — The old system's invoices as draft timesheets

Approved by the user on 2026-10-22: bring the old system's invoices from June 2026 into the new system, all as drafts with the old number. Try it on the test copy first, and rely on the old system's amounts.

## What is brought

- Each **project invoice** (`new_invoice`) whose period ends on or after **2026-06-01** and that is **not cancelled** (status 279640007) becomes one draft timesheet.
- Its lines (`new_invoicdetail`) become the timesheet's lines, with these values from the old line:
  - work days and month days;
  - the bill salary and the price;
  - housing and transport;
  - the pay.
- The old line's variables become timesheet variables, each with the reason «من فاتورة النظام القديم {number}»:

  | Old line field | Variable |
  |---|---|
  | absence | Absence |
  | Mawarid days | FeeDays |
  | overtime | OvertimeAmount |
  | other earning | ClientAddition |
  | other deduction | ClientDeduction |
  | customer loan | CustomerLoan |
  | other commission | OtherCost |
  | internal addition | InternalAddition |
  | internal deduction + loan | InternalDeduction |

- The timesheet keeps the old invoice's id, number and status (`legacy_invoice_crm_id`, `legacy_invoice_no`, `legacy_status`). The pages show them as a badge: «منقولة من النظام القديم · INV… · status».

## Balancing

- Some old lines were edited by hand, so the formulas give a different amount than the old line. Where they differ, the worker gets variables for the difference, so the draft equals the old invoice exactly:
  - the invoice difference becomes «تكاليف أخرى» or «خصومات أخرى»;
  - the pay difference becomes an internal addition or an internal deduction.
- Their reason is «فرق عن فاتورة النظام القديم {number}».

## Rules

- **One timesheet per invoice.** A project the old system invoiced more than once in a month gets a timesheet for each invoice (the user's decision, 2026-10-22). The «one timesheet per project and month» index now excludes the brought timesheets, and the month page shows a row for each.
- **Never twice.** An invoice that was already brought is not brought again. A unique index on `(tenant_id, legacy_invoice_crm_id)` enforces this.
- **Skipped invoices.** These are reported with a reason and not brought:
  - the project is unknown (for example HeadOffice);
  - the new system made a timesheet for the project that month;
  - the invoice has no lines;
  - none of its workers are known.
- **Not regenerated.** A brought timesheet is never generated again from the ledger (`conflict.timesheet_legacy`).
- **No second invoice.** When the old invoice was already sent to the customer, no invoice is issued from the draft (`conflict.timesheet_legacy_issued`). This covers the old statuses 279640002 sent, 279640003 partial, 279640004 collected and 279640008 awaiting payment.
- **Running it.** «نقل فواتير النظام القديم» on the monthly timesheets page calls `POST /api/v1/billing/timesheets/import-legacy`. The user needs `billing.timesheets.manage` and `billing.invoices.manage`.

## Trial run (test copy, 2026-10-22)

- **Brought:** 489 invoices, with 6,606 lines and 1,915 workers, totalling 28,077,012.82 before VAT.
- **Balanced:** 111 invoices. No worker was missing.
- **Skipped:** 31 invoices:
  - 4 because the project is unknown (HeadOffice);
  - 27 because the project already had a timesheet that month. Most of these are a project's second or third invoice in the same month.
- **Checked by SQL against the old lines:**
  - Every draft equals the sum of its old lines, both the invoice amount and the net.
  - Two old invoice headers differ from their own lines by a few halalas (0.09 and 0.07): BVP00302 and BVP00620.

## Second run (2026-10-22, after the user's decisions)

- The two test timesheets TS-2026-00008 and TS-2026-00001 were deleted from the test copy, with the test invoice INV00001, their approvals and the draft test payroll run PR-2026-00001 that was built on TS-2026-00008.
- The import ran again and brought the **27** invoices it had skipped (309 lines, 1,278,582.26 before VAT; 8 balanced). In all: **516** invoices.
- Only the 4 HeadOffice invoices remain outside.
