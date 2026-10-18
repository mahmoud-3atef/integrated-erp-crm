// Monthly project timesheets (src/Modules/Billing/.../Api/TimesheetEndpoints.cs).
import { request } from './auth';
import type { ApprovalStatus } from './workflow';

export type TimesheetStatus = 'Draft' | 'InApproval' | 'Returned' | 'Approved';
export type WorkerSource = 'Company' | 'Supplier' | 'Unknown';
export const adjustmentTypes = ['Absence', 'Overtime', 'ClientAddition', 'ClientDeduction', 'CustomerLoan', 'FeeDays', 'OtherCost', 'InternalAddition', 'InternalDeduction'] as const;
export type AdjustmentType = (typeof adjustmentTypes)[number];

export interface MonthProject {
  projectId: string | null;
  projectCrmId: string;
  projectName: string;
  customerName: string | null;
  projectManager: string | null;
  ledgerWorkers: number;
  timesheetId: string | null;
  timesheetNo: string | null;
  status: TimesheetStatus | null;
  workers: number | null;
  workDays: number | null;
  invoiceAmount: number | null;
  invoiceTotal: number | null;
  invoiceDoc: InvoiceRef | null;
}

export interface TimesheetMonth {
  month: string;
  totals: { projects: number; generated: number; inApproval: number; approved: number; invoiceAmount: number; invoiced: number };
  projects: MonthProject[];
}

export interface TimesheetLine {
  id: string;
  workerId: string;
  workerNo: string;
  name: string;
  iqamaNo: string | null;
  professionAr: string | null;
  professionEn: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  source: WorkerSource;
  supplierName: string | null;
  lineFrom: string;
  lineTo: string;
  workDays: number;
  packageNo: string | null;
  billSalary: number;
  totalPrice: number;
  housing: number;
  housingBillable: boolean;
  transport: number;
  transportBillable: boolean;
  isSpecialPrice: boolean;
  paySalary: number;
  sourceNo: string;
  fromOldSystem: boolean;
  absenceDays: number;
  overtimeHours: number;
  clientAdditions: number;
  clientDeductions: number;
  customerLoans: number;
  feeDays: number;
  otherCosts: number;
  internalAdditions: number;
  internalDeductions: number;
  dueSalary: number;
  absenceAmount: number;
  dueFees: number;
  dueHousing: number;
  dueTransport: number;
  overtime: number;
  gosi: number;
  invoiceAmount: number;
  vat: number;
  invoiceTotal: number;
  payDueSalary: number;
  payAbsence: number;
  workerNet: number;
}

export interface Adjustment {
  id: string;
  workerId: string;
  type: AdjustmentType;
  value: number;
  reason: string;
  createdByName: string;
  createdAt: string;
}

export interface InvoicePreview {
  dueSalary: number;
  absenceAmount: number;
  dueFees: number;
  dueHousing: number;
  dueTransport: number;
  overtime: number;
  clientAdditions: number;
  clientDeductions: number;
  customerLoans: number;
  otherCosts: number;
  gosi: number;
  amount: number;
  vat: number;
  total: number;
}

export interface WorkerPay {
  workerId: string;
  workerNo: string;
  name: string;
  iqamaNo: string | null;
  paySalary: number;
  workDays: number;
  absenceDays: number;
  overtimeHours: number;
  payDueSalary: number;
  payAbsence: number;
  overtime: number;
  clientAdditions: number;
  clientDeductions: number;
  customerLoans: number;
  internalAdditions: number;
  internalDeductions: number;
  net: number;
}

export interface SupplierStatement {
  supplierName: string;
  workers: number;
  workDays: number;
  net: number;
  items: WorkerPay[];
}

export interface BillingSettings {
  cycleStartDay: number;
  dayBasis: 'Thirty' | 'ActualDays';
  overtimeMultiplier: number;
  monthlyHours: number;
  overtimeHourlyRate: number | null;
  maxOvertimeHours: number;
  gosiRate: number;
  vatRate: number;
}

export interface TimesheetDetail {
  id: string;
  timesheetNo: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  customerName: string | null;
  contractType: string | null;
  month: string;
  from: string;
  to: string;
  dayBasis: string;
  status: TimesheetStatus;
  awaitingApproval: boolean;
  generatedAt: string;
  generatedByName: string;
  approvedAt: string | null;
  approvedByName: string | null;
  lastComment: string | null;
  settings: BillingSettings;
  lines: TimesheetLine[];
  adjustments: Adjustment[];
  invoice: InvoicePreview;
  payroll: WorkerPay[];
  suppliers: SupplierStatement[];
  unknownSource: WorkerPay[];
  approval: ApprovalStatus | null;
  canEdit: boolean;
  canSubmit: boolean;
  invoiceDoc: InvoiceRef | null;
  canInvoice: boolean;
}

const base = '/api/v1/billing';

export const billingApi = {
  month: (month: string) => request<TimesheetMonth>('GET', `${base}/timesheets?month=${month}`),
  get: (id: string) => request<TimesheetDetail>('GET', `${base}/timesheets/${id}`),
  generate: (projectId: string, month: string) => request<{ id: string }>('POST', `${base}/timesheets/generate`, { projectId, month }),
  adjust: (id: string, input: { workerId: string; type: AdjustmentType; value: number; reason: string }) => request<void>('POST', `${base}/timesheets/${id}/adjustments`, input),
  removeAdjustment: (id: string, adjustmentId: string) => request<void>('DELETE', `${base}/timesheets/${id}/adjustments/${adjustmentId}`),
  submit: (id: string) => request<void>('POST', `${base}/timesheets/${id}/submit`),
  settings: (projectId: string) => request<BillingSettings>('GET', `${base}/projects/${projectId}/settings`),
  saveSettings: (projectId: string, input: BillingSettings) => request<void>('PUT', `${base}/projects/${projectId}/settings`, input),
};

// Customer invoices and notes (src/Modules/Billing/.../Api/InvoiceEndpoints.cs).
export type InvoiceKind = 'Invoice' | 'CreditNote' | 'DebitNote';
export type InvoiceStatus = 'Draft' | 'ProjectReview' | 'FinanceReview' | 'Returned' | 'Issued';
export const noteComponents = ['Salary', 'ServiceFee', 'Housing', 'Transport', 'Overtime', 'ClientAddition', 'OtherCost', 'Gosi'] as const;
export type InvoiceComponent = (typeof noteComponents)[number] | 'Discount';

export interface InvoiceRef {
  id: string;
  invoiceNo: string | null;
  status: InvoiceStatus;
}

export interface InvoiceRow {
  id: string;
  kind: InvoiceKind;
  invoiceNo: string | null;
  status: InvoiceStatus;
  awaitingApproval: boolean;
  projectName: string;
  customerName: string;
  month: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  vat: number;
  total: number;
  timesheetNo: string | null;
  originalInvoiceNo: string | null;
  createdByName: string;
}

export interface InvoiceList {
  totals: { drafts: number; inReview: number; issued: number; issuedTotal: number; credits: number; debits: number };
  rows: InvoiceRow[];
}

export interface Party {
  name: string;
  nameEn: string | null;
  vatNumber: string | null;
  commercialRegistration: string | null;
  city: string | null;
}

export interface InvoiceWorker {
  workerId: string;
  workerNo: string;
  name: string;
  iqamaNo: string | null;
  professionAr: string | null;
  professionEn: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  lineFrom: string;
  lineTo: string;
  workDays: number;
  monthlyPrice: number;
  dueSalary: number;
  absenceDays: number;
  absenceAmount: number;
  dueFees: number;
  overtimeHours: number;
  overtime: number;
  clientAdditions: number;
  clientDeductions: number;
  customerLoans: number;
  otherCosts: number;
  gosi: number;
  amount: number;
  vat: number;
  total: number;
}

export interface InvoiceDetail {
  id: string;
  kind: InvoiceKind;
  invoiceNo: string | null;
  status: InvoiceStatus;
  awaitingApproval: boolean;
  timesheetId: string | null;
  timesheetNo: string | null;
  originalInvoiceId: string | null;
  originalInvoiceNo: string | null;
  projectId: string;
  projectCode: string;
  projectName: string;
  contractType: string | null;
  customer: Party;
  seller: Party | null;
  month: string;
  periodFrom: string;
  periodTo: string;
  invoiceDate: string;
  paymentTermDays: number | null;
  dueDate: string;
  vatRate: number;
  amount: number;
  vat: number;
  total: number;
  reason: string | null;
  remarks: string | null;
  createdAt: string;
  createdByName: string;
  issuedAt: string | null;
  issuedByName: string | null;
  lastComment: string | null;
  items: { lineNo: number; component: InvoiceComponent; description: string | null; amount: number }[];
  workers: InvoiceWorker[];
  notes: InvoiceRow[];
  netAmount: number;
  creditable: number;
  paid: number;
  outstanding: number;
  warnings: string[];
  approval: ApprovalStatus | null;
  canEdit: boolean;
  canSubmit: boolean;
  canDelete: boolean;
  canNote: boolean;
}

export interface NoteDraft {
  kind: Exclude<InvoiceKind, 'Invoice'>;
  date: string;
  reason: string;
  items: { component: InvoiceComponent; description: string | null; amount: number }[];
}

const invoices = `${base}/invoices`;

export const invoiceApi = {
  list: (filter: { month?: string; status?: string; kind?: string; search?: string }) => {
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]);
    return request<InvoiceList>('GET', `${invoices}?${q.toString()}`);
  },
  get: (id: string) => request<InvoiceDetail>('GET', `${invoices}/${id}`),
  attachmentUrl: (id: string) => `${invoices}/${id}/attachment`,
  fromTimesheet: (timesheetId: string) => request<{ id: string }>('POST', `${base}/timesheets/${timesheetId}/invoice`),
  edit: (id: string, input: { invoiceDate: string; paymentTermDays: number | null; remarks: string | null }) => request<void>('PUT', `${invoices}/${id}`, input),
  remove: (id: string) => request<void>('DELETE', `${invoices}/${id}`),
  note: (id: string, input: NoteDraft) => request<{ id: string }>('POST', `${invoices}/${id}/notes`, input),
  submit: (id: string) => request<void>('POST', `${invoices}/${id}/submit`),
};

// Collection: receipt vouchers, project accounts, debt ages, bank accounts (src/Modules/Billing/.../Api/ReceivableEndpoints.cs).
export type ReceiptStatus = 'Draft' | 'AccountantReview' | 'FinanceReview' | 'Returned' | 'Approved';
export const paymentMethods = ['BankTransfer', 'Cash', 'Card'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export type ReceivableKind = 'Invoice' | 'DebitNote' | 'OpeningBalance';

export interface ReceiptRow {
  id: string;
  receiptNo: string | null;
  status: ReceiptStatus;
  projectId: string;
  projectName: string;
  customerName: string | null;
  receiptDate: string;
  amount: number;
  method: PaymentMethod;
  bankAccountName: string | null;
  allocated: number;
  createdByName: string;
}

export interface ReceiptList {
  totals: { drafts: number; inReview: number; approved: number; approvedAmount: number; unallocated: number };
  rows: ReceiptRow[];
}

export interface OpenItem {
  kind: ReceivableKind;
  id: string;
  number: string;
  date: string;
  dueDate: string;
  total: number;
  credited: number;
  paid: number;
  outstanding: number;
  available: number;
  daysOverdue: number;
}

export interface ProjectOpen {
  projectId: string;
  projectName: string;
  outstanding: number;
  credit: number;
  items: OpenItem[];
}

export interface ReceiptDetail {
  id: string;
  receiptNo: string | null;
  status: ReceiptStatus;
  awaitingApproval: boolean;
  projectId: string;
  projectCode: string;
  projectName: string;
  customerName: string | null;
  receiptDate: string;
  amount: number;
  method: PaymentMethod;
  bankAccountId: string | null;
  bankAccountName: string | null;
  reference: string | null;
  notes: string | null;
  allocated: number;
  unallocated: number;
  createdAt: string;
  createdByName: string;
  approvedAt: string | null;
  approvedByName: string | null;
  lastComment: string | null;
  allocations: { kind: ReceivableKind; targetId: string; number: string; dueDate: string | null; amount: number }[];
  approval: ApprovalStatus | null;
  canEdit: boolean;
  canAllocate: boolean;
}

export interface ReceiptInput {
  projectId: string;
  receiptDate: string;
  amount: number;
  method: PaymentMethod;
  bankAccountId: string | null;
  reference: string | null;
  notes: string | null;
  allocations: { kind: ReceivableKind; targetId: string; amount: number }[];
}

export interface ReceiptProject {
  id: string;
  crmId: string;
  code: string;
  name: string;
  customerName: string | null;
  manager: string | null;
  isActive: boolean;
  outstanding: number;
}

export interface AgingRow {
  projectCrmId: string;
  projectId: string | null;
  projectName: string;
  customerName: string | null;
  manager: string | null;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days180: number;
  over180: number;
  total: number;
  credit: number;
  net: number;
  items: number;
}

export interface Aging {
  asOf: string;
  totals: AgingRow;
  rows: AgingRow[];
}

export interface StatementEntry {
  date: string;
  kind: 'OpeningBalance' | 'Invoice' | 'DebitNote' | 'CreditNote' | 'Receipt';
  documentId: string | null;
  number: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface Statement {
  projectCrmId: string;
  projectId: string | null;
  projectName: string;
  customerName: string | null;
  from: string;
  to: string;
  opening: number;
  debits: number;
  credits: number;
  closing: number;
  entries: StatementEntry[];
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNo: string;
  iban: string | null;
  label: string | null;
  display: string;
  isActive: boolean;
}

export type BankAccountInput = Omit<BankAccount, 'id' | 'display'>;

const qs = (filter: Record<string, string | undefined | null>) => new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]).toString();

export const receivablesApi = {
  receipts: (filter: { from?: string; to?: string; status?: string; search?: string }) => request<ReceiptList>('GET', `${base}/receipts?${qs(filter)}`),
  receipt: (id: string) => request<ReceiptDetail>('GET', `${base}/receipts/${id}`),
  create: (input: ReceiptInput) => request<{ id: string }>('POST', `${base}/receipts`, input),
  update: (id: string, input: ReceiptInput) => request<void>('PUT', `${base}/receipts/${id}`, input),
  remove: (id: string) => request<void>('DELETE', `${base}/receipts/${id}`),
  submit: (id: string) => request<void>('POST', `${base}/receipts/${id}/submit`),
  allocate: (id: string) => request<void>('POST', `${base}/receipts/${id}/allocate`, { allocations: null }),
  projects: () => request<ReceiptProject[]>('GET', `${base}/receipt-projects`),
  open: (projectId: string, exceptReceipt?: string) => request<ProjectOpen>('GET', `${base}/projects/${projectId}/open-items?${qs({ exceptReceipt })}`),
  aging: (asOf?: string) => request<Aging>('GET', `${base}/aging?${qs({ asOf })}`),
  statement: (projectCrmId: string, from?: string, to?: string) => request<Statement>('GET', `${base}/statements/${projectCrmId}?${qs({ from, to })}`),
  bankAccounts: () => request<BankAccount[]>('GET', `${base}/bank-accounts`),
  addBankAccount: (input: BankAccountInput) => request<{ id: string }>('POST', `${base}/bank-accounts`, input),
  saveBankAccount: (id: string, input: BankAccountInput) => request<void>('PUT', `${base}/bank-accounts/${id}`, input),
};
