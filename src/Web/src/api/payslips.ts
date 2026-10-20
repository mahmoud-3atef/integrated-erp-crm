// Payslips (4.12) of a staff run or a workers' run (src/Modules/Payroll/.../Application/Payslips.cs).
import { request } from './auth';
import type { GosiCategory } from './staffPayroll';

export type PayslipKind = 'staff' | 'workers';

export interface PayslipItem {
  code: string;
  amount: number;
  reference: string | null;
  quantity: number | null;
  note: string | null;
}

export interface Payslip {
  lineId: string;
  personId: string;
  no: string;
  name: string;
  idLast4: string | null;
  departmentAr: string | null;
  departmentEn: string | null;
  jobAr: string | null;
  jobEn: string | null;
  projectName: string | null;
  statusAr: string | null;
  statusEn: string | null;
  gosiNo: string | null;
  gosiCategory: GosiCategory | '';
  serviceDays: number;
  paidDays: number;
  absenceDays: number;
  bankName: string | null;
  iban: string | null;
  earnings: PayslipItem[];
  deductions: PayslipItem[];
  totalEarnings: number;
  totalDeductions: number;
  net: number;
  gosiEmployer: number;
  advances: { advanceNo: string; remaining: number; installments: number }[];
  leaveBalance: number | null;
  leaveTaken: number | null;
  sources: { timesheetNo: string; projectName: string; from: string; to: string; days: number }[];
}

export interface PayslipBatch {
  kind: 'Staff' | 'Workers';
  runId: string;
  runNo: string;
  status: string;
  draft: boolean;
  legalEntityNameAr: string;
  legalEntityNameEn: string;
  commercialRegistrationNo: string | null;
  from: string;
  to: string;
  approvedAt: string | null;
  approvedByName: string | null;
  printedAt: string;
  printedBy: string;
  total: number;
  items: Payslip[];
}

export const payslipMax = 300;

/** The query keeps the run grid's filters (search, department or project, note) or names one line. */
export function payslipsApi(kind: PayslipKind, runId: string, query: URLSearchParams) {
  const base = kind === 'staff' ? `/api/v1/payroll/staff/runs/${runId}` : `/api/v1/payroll/runs/${runId}`;
  const q = query.toString();
  return request<PayslipBatch>('GET', `${base}/payslips${q ? `?${q}` : ''}`);
}

/** The print page's path for a run, a line, or the grid's current filters. */
export function payslipsPath(kind: PayslipKind, runId: string, params: Record<string, string | undefined | null> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const q = p.toString();
  return `/payroll/${kind === 'staff' ? 'staff' : 'runs'}/${runId}/payslips${q ? `?${q}` : ''}`;
}
