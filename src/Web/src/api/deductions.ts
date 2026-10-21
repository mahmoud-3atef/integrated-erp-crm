// The staff's advances, penalties and other deductions (src/Modules/Deductions/.../Api/DeductionEndpoints.cs).
import { request } from './auth';
import type { ApprovalStatus } from './workflow';

export type AdvanceStatus = 'InApproval' | 'Returned' | 'Rejected' | 'Approved' | 'Disbursed' | 'Settled' | 'Cancelled';
export type InstallmentStatus = 'Scheduled' | 'Deferred' | 'Deducted' | 'Postponed' | 'Settled';
export type PenaltyEffect = 'Warning' | 'DeductDays' | 'DeductAmount' | 'Suspension';
export const penaltyEffects: PenaltyEffect[] = ['Warning', 'DeductDays', 'DeductAmount', 'Suspension'];
export type PenaltyCategory = 'Penalty' | 'Other';
export type PenaltyStatus = 'InApproval' | 'Returned' | 'Rejected' | 'Applied' | 'Cancelled';

export interface DeductionSettings {
  advanceCapPercent: number;
  advanceMaxMonths: number;
  advanceAfterProbation: boolean;
  advanceMinServiceMonths: number;
  advanceOneOpen: boolean;
  penaltyMaxDaysPerViolation: number;
  penaltyMaxDaysPerMonth: number;
  suspensionMaxDaysPerMonth: number;
  monthlyCapPercent: number;
}

export interface PenaltyType {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  effect: PenaltyEffect;
  isActive: boolean;
  sortOrder: number;
}

export type PenaltyTypeInput = { nameAr: string; nameEn: string | null; effect: PenaltyEffect; isActive: boolean; sortOrder: number };

export interface DeductionSetup {
  settings: DeductionSettings;
  penaltyTypes: PenaltyType[];
}

export interface AdvanceKpis {
  openBalance: number;
  openEmployees: number;
  pending: number;
  pendingAmount: number;
  toDisburse: number;
  paidThisMonth: number;
  paidThisMonthCount: number;
  dueNextMonth: number;
  nextPeriod: string;
}

export interface AdvanceRow {
  id: string;
  advanceNo: string;
  employeeId: string;
  employeeName: string;
  departmentAr: string | null;
  departmentEn: string | null;
  amount: number;
  months: number;
  firstPeriod: string;
  remaining: number;
  aboveCap: boolean;
  status: AdvanceStatus;
  createdAt: string;
}

export interface Installment {
  id: string;
  period: string;
  amount: number;
  deducted: number;
  status: InstallmentStatus;
  note: string | null;
}

export interface AdvanceDetail {
  advance: AdvanceRow;
  reason: string;
  salaryAtRequest: number | null;
  paidOn: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidBy: string | null;
  createdByName: string;
  lastComment: string | null;
  installments: Installment[];
  approval: ApprovalStatus | null;
  /** Approved and not yet paid or deducted: may be changed or cancelled by the holders of those permissions (with a reason). */
  canAmend: boolean;
  canCancelApproved: boolean;
  amendedAt: string | null;
  amendedByName: string | null;
  amendNote: string | null;
  canceledAt: string | null;
  canceledByName: string | null;
}

export interface AdvanceInput {
  employeeId: string;
  amount: number;
  months: number;
  firstPeriod: string;
  reason: string;
  aboveCap: boolean;
}

export type AdvanceProblem = 'fields' | 'too_many_months' | 'not_employed' | 'on_probation' | 'short_service' | 'open_advance' | 'no_salary' | 'above_cap';

export interface AdvancePreview {
  salary: number | null;
  cap: number | null;
  installment: number;
  monthDeductions: number;
  monthCap: number | null;
  monthShare: number | null;
  maxMonths: number;
  managerName: string | null;
  managerLinked: boolean;
  problems: AdvanceProblem[];
  needsAboveCap: ('advance_cap' | 'month_cap')[];
}

export interface PenaltyRow {
  id: string;
  penaltyNo: string;
  category: PenaltyCategory;
  penaltyTypeId: string | null;
  employeeId: string;
  employeeName: string;
  typeAr: string | null;
  typeEn: string | null;
  effect: PenaltyEffect;
  violationDate: string;
  description: string;
  days: number | null;
  amount: number | null;
  period: string;
  aboveCap: boolean;
  status: PenaltyStatus;
  createdAt: string;
}

export interface PenaltyDetail {
  penalty: PenaltyRow;
  statement: string | null;
  createdByName: string;
  lastComment: string | null;
  approval: ApprovalStatus | null;
  /** Approved and not yet paid or deducted: may be changed or cancelled by the holders of those permissions (with a reason). */
  canAmend: boolean;
  canCancelApproved: boolean;
  amendedAt: string | null;
  amendedByName: string | null;
  amendNote: string | null;
  canceledAt: string | null;
  canceledByName: string | null;
}

export interface PenaltyInput {
  employeeId: string;
  category: PenaltyCategory;
  penaltyTypeId: string | null;
  violationDate: string;
  description: string;
  statement: string | null;
  days: number | null;
  amount: number | null;
  period: string;
  aboveCap: boolean;
}

export type PenaltyProblem = 'fields' | 'not_employed' | 'per_violation' | 'per_month' | 'above_cap';

export interface PenaltyPreview {
  effect: PenaltyEffect;
  maxDaysPerViolation: number;
  maxDaysPerMonth: number;
  daysThisMonth: number;
  monthDeductions: number | null;
  monthCap: number | null;
  problems: PenaltyProblem[];
  needsAboveCap: 'month_cap'[];
}

export interface EmployeeDeductions {
  openAdvances: number;
  warnings: number;
  penaltyDaysThisYear: number;
  advances: AdvanceRow[];
  penalties: PenaltyRow[];
}

const base = '/api/v1/deductions';
const qs = (q: Record<string, string | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const deductionsApi = {
  advanceKpis: () => request<AdvanceKpis>('GET', `${base}/advances/kpis`),
  advances: (q: { tab?: string; employeeId?: string; search?: string }) => request<AdvanceRow[]>('GET', `${base}/advances${qs(q)}`),
  advance: (id: string) => request<AdvanceDetail>('GET', `${base}/advances/${id}`),
  previewAdvance: (input: AdvanceInput, advanceId?: string) => request<AdvancePreview>('POST', `${base}/advances/preview${qs({ advanceId })}`, input),
  sendAdvance: (input: AdvanceInput) => request<{ id: string }>('POST', `${base}/advances`, input),
  resubmitAdvance: (id: string, input: AdvanceInput) => request<{ id: string }>('POST', `${base}/advances/${id}/resubmit`, input),
  amendAdvance: (id: string, input: Omit<AdvanceInput, 'employeeId'> & { amendReason: string }) => request<void>('PUT', `${base}/advances/${id}/amend`, input),
  cancelApprovedAdvance: (id: string, note: string) => request<void>('POST', `${base}/advances/${id}/cancel-approved`, { note }),
  disburse: (id: string, input: { paidOn: string; method: string; reference: string | null }) => request<void>('POST', `${base}/advances/${id}/disburse`, input),
  settle: (id: string, note: string) => request<void>('POST', `${base}/advances/${id}/settle`, { note }),
  postpone: (id: string, installmentId: string, note: string) => request<void>('POST', `${base}/advances/${id}/installments/${installmentId}/postpone`, { note }),
  penalties: (q: { tab?: string; employeeId?: string; search?: string }) => request<PenaltyRow[]>('GET', `${base}/penalties${qs(q)}`),
  penalty: (id: string) => request<PenaltyDetail>('GET', `${base}/penalties/${id}`),
  previewPenalty: (input: PenaltyInput, penaltyId?: string) => request<PenaltyPreview>('POST', `${base}/penalties/preview${qs({ penaltyId })}`, input),
  sendPenalty: (input: PenaltyInput) => request<{ id: string }>('POST', `${base}/penalties`, input),
  resubmitPenalty: (id: string, input: PenaltyInput) => request<{ id: string }>('POST', `${base}/penalties/${id}/resubmit`, input),
  amendPenalty: (id: string, input: Omit<PenaltyInput, 'employeeId' | 'category'> & { amendReason: string }) => request<void>('PUT', `${base}/penalties/${id}/amend`, input),
  cancelApprovedPenalty: (id: string, note: string) => request<void>('POST', `${base}/penalties/${id}/cancel-approved`, { note }),
  employee: (id: string) => request<EmployeeDeductions>('GET', `${base}/employees/${id}`),
  setup: () => request<DeductionSetup>('GET', `${base}/setup`),
  saveSettings: (input: DeductionSettings) => request<void>('PUT', `${base}/settings`, input),
  saveType: (id: string | null, input: PenaltyTypeInput) => (id ? request<{ id: string }>('PUT', `${base}/penalty-types/${id}`, input) : request<{ id: string }>('POST', `${base}/penalty-types`, input)),
};

/** Riyals with two decimals at most, in Latin digits. */
export const sar = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
