# Workflow — Fields a Process May Update (proposal for review)
Version: 0.1 — 2026-10-22
Status: Proposal. Nothing is implemented until the user approves the list.
Follows: [17-workflow-engine.md](17-workflow-engine.md) §7 milestone 3.

## 1. Rules
A field is proposed as updatable only when all of these hold:
1. **It drives no calculation.** It doesn't drive money, days, periods, balances, VAT or payroll.
2. **It is not a document's state.** Statuses change only through the screen's own code steps (approve, execute, close…).
3. **It is not an identity or an audit stamp.** Numbers, the employee, worker, project, created/amended/canceled stamps stay locked.
4. **It is not synced from the CRM.** Projects, customers, contracts and workers would be overwritten by the next sync. They stay locked until the CRM is retired.
5. **It is not personal or banking data.** IBAN, ID number, mobile and e-mail stay locked.

Every update goes through the module's command, not a direct column write. The module checks that the record is still in approval, and that the value is valid (length, allowed options). The change is written to the record's audit trail and to the approval history.

## 2. Proposed list
| Table | Proposed updatable fields | Stays locked (examples) |
|---|---|---|
| Internal request (`workflow.internal_request`) | status (settable values only), approver_notes — **already today** | subject, amount, category |
| Delivery order (`operations.delivery_order`) | notes, delay_reason, receiver_name, receiver_title | start_on, prices, workers, status |
| Return order (`operations.return_order`) | notes, reason_notes, delay_reason, customer_wish (**already today**) | arrived_on, reason, stop_salary, status |
| Transfer order (`operations.transfer_order`) | notes, delay_reason, receiver_name, receiver_title | transfer_on, projects, prices |
| Worker action (`operations.movement`) | notes, delay_reason, special_reason | effective_on, salary, fees, type |
| Monthly timesheet (`billing.timesheet`) | — | everything (a locked document) |
| Invoice (`billing.invoice`) | remarks, **before issue only** | amounts, VAT, dates (ZATCA) |
| Receipt (`billing.receipt`) | notes, reference, before approval | amount, method, allocation |
| Payroll runs (`payroll.run`, `payroll.staff`) | — | everything |
| Settlements (`payroll.settlement*`) | notes | every amount, days, payment |
| Employment action (`staff.action`) | reason | salaries, dates, contract |
| Attendance month (`attendance.month`) | — | everything |
| Overtime (`attendance.overtime`) | reason | date, hours |
| Leave request (`leave.request`) | reason, return_note | dates, days, type, pay |
| Permission (`leave.permission`) | reason | date, minutes, kind |
| Advance (`deduction.advance`) | reason | amount, months, payment |
| Penalty / other deduction (`deduction.penalty`, `deduction.other`) | description, statement | amount, days, category, effect |
| Related tables (project, customer, contract, worker, employee, department, position, job title, leave type, penalty type) | — | everything (CRM-synced or master data) |

## 3. Questions for the user
1. **Return order «stop_salary»:** it changes payroll, so it is proposed locked. Should a stage be able to set it?
2. **Leave request «substitute»:** should a stage (e.g. the manager) be able to choose the substitute employee?
3. Should any other field be updatable in the processes you plan?
