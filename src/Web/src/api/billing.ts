// Monthly project timesheets (src/Modules/Billing/.../Api/TimesheetEndpoints.cs).
import { request } from './auth';
import type { ApprovalStatus } from './workflow';

export type TimesheetStatus = 'Draft' | 'InApproval' | 'Returned' | 'Approved';
export type WorkerSource = 'Company' | 'Supplier' | 'Unknown';
export const adjustmentTypes = ['Absence', 'Overtime', 'ClientAddition', 'ClientDeduction', 'CustomerLoan', 'FeeDays', 'OtherCost'] as const;
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
}

export interface TimesheetMonth {
  month: string;
  totals: { projects: number; generated: number; inApproval: number; approved: number; invoiceAmount: number };
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
