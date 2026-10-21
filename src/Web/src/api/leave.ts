// The staff's leave (src/Modules/Leave/.../Api/LeaveEndpoints.cs).
import { request, upload } from './auth';
import type { ApprovalStatus } from './workflow';

export type LeavePay = 'Full' | 'SickTiers' | 'Unpaid';
export const leavePays: LeavePay[] = ['Full', 'SickTiers', 'Unpaid'];
export type DayCount = 'Calendar' | 'Working';
export type RequestStatus = 'InApproval' | 'Returned' | 'Rejected' | 'Approved' | 'Cancelled';
export type EntryKind = 'Opening' | 'Accrual' | 'Consumption' | 'CarryOver' | 'Adjustment' | 'Reversal' | 'AccrualReversal';

export interface LeaveType {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  pay: LeavePay;
  hasBalance: boolean;
  daysPerYear: number | null;
  seniorDaysPerYear: number | null;
  seniorAfterYears: number | null;
  maxDaysPerRequest: number | null;
  oncePerService: boolean;
  dayCount: DayCount;
  needsAttachment: boolean;
  isActive: boolean;
  sortOrder: number;
}

export type LeaveTypeInput = Omit<LeaveType, 'id' | 'code'>;

export interface LeaveSettings {
  carryOverLimit: number | null;
  permissionMinutesPerMonth: number;
}

export interface LeaveSetup {
  settings: LeaveSettings;
  types: LeaveType[];
}

export interface LeaveKpis {
  onLeaveToday: number;
  todayAnnual: number;
  todaySick: number;
  todayOther: number;
  pending: number;
  upcoming: number;
  upcomingDays: number;
  returned: number;
  permissionsThisMonth: number;
  permissionMinutesThisMonth: number;
  permissionsPending: number;
  returnsToConfirm: number;
}

export type PermissionKind = 'LateArrival' | 'EarlyLeave' | 'During' | 'Mission';
export const permissionKinds: PermissionKind[] = ['LateArrival', 'EarlyLeave', 'During', 'Mission'];

export interface Permission {
  id: string;
  requestNo: string;
  employeeId: string;
  employeeName: string;
  date: string;
  from: string;
  to: string;
  minutes: number;
  kind: PermissionKind;
  reason: string | null;
  status: RequestStatus;
  createdByName: string;
  createdAt: string;
  decidedAt: string | null;
  lastComment: string | null;
  approval: ApprovalStatus | null;
}

export interface PermissionInput {
  employeeId: string;
  date: string;
  from: string;
  to: string;
  kind: PermissionKind;
  reason: string | null;
}

export interface PermissionPreview {
  minutes: number;
  allowance: number;
  usedThisMonth: number;
  remaining: number;
  overAllowance: number;
  mission: boolean;
  managerName: string | null;
  managerLinked: boolean;
  problems: ('times' | 'not_employed' | 'on_leave' | 'month_locked')[];
}

export interface LeaveRow {
  id: string;
  requestNo: string;
  employeeId: string;
  employeeName: string;
  departmentAr: string | null;
  departmentEn: string | null;
  leaveTypeId: string;
  typeAr: string;
  typeEn: string;
  pay: LeavePay;
  from: string;
  to: string;
  days: number;
  status: RequestStatus;
  hasBalance: boolean;
  createdByName: string;
  createdAt: string;
}

export interface LeaveDetail {
  request: LeaveRow;
  reason: string | null;
  substituteName: string | null;
  ticket: boolean;
  lastComment: string | null;
  decidedAt: string | null;
  available: number | null;
  canCancel: boolean;
  approval: ApprovalStatus | null;
  returnedOn: string | null;
  returnNote: string | null;
  expectedReturn: string | null;
  canConfirmReturn: boolean;
  /** An approved leave: may be changed or cancelled by the holders of those permissions (with a reason). */
  canAmend: boolean;
  canCancelApproved: boolean;
  amendedAt: string | null;
  amendedByName: string | null;
  amendNote: string | null;
  canceledAt: string | null;
  canceledByName: string | null;
}

/** What may change on an approved leave: its days, the reason and the ticket, with the reason for the change. */
export interface LeaveAmendInput {
  from: string;
  to: string;
  reason: string | null;
  substituteId: string | null;
  ticket: boolean;
  amendReason: string;
}

export interface LeaveInput {
  employeeId: string;
  leaveTypeId: string;
  from: string;
  to: string;
  reason: string | null;
  substituteId: string | null;
  ticket: boolean;
}

export type PreviewProblem = 'no_days' | 'not_employed' | 'too_long' | 'overlap' | 'once' | 'year_limit' | 'balance' | 'month_locked';

export interface LeavePreview {
  days: number;
  calendarDays: number;
  dayCount: DayCount;
  available: number | null;
  after: number | null;
  returnsOn: string;
  sick: { full: number; threeQuarters: number; unpaid: number } | null;
  managerName: string | null;
  managerLinked: boolean;
  problems: PreviewProblem[];
}

export interface TypeBalance {
  leaveTypeId: string;
  typeAr: string;
  typeEn: string;
  hasBalance: boolean;
  perYear: number;
  opening: number;
  accruedThisYear: number;
  usedThisYear: number;
  reserved: number;
  available: number;
  yearLimit: number | null;
}

export interface Entry {
  id: string;
  leaveTypeId: string;
  date: string;
  kind: EntryKind;
  days: number;
  reason: string;
  requestNo: string | null;
  createdByName: string;
  running: number;
}

export interface EmployeeLeave {
  employeeId: string;
  name: string;
  hireDate: string | null;
  yearsOfService: number;
  balances: TypeBalance[];
  entries: Entry[];
  requests: LeaveRow[];
  permissionAllowance: number;
  permissionUsedThisMonth: number;
  permissions: Permission[] | null;
}

export interface BalanceRow {
  employeeId: string;
  employeeNo: string;
  name: string;
  departmentAr: string | null;
  departmentEn: string | null;
  perYear: number;
  opening: number;
  accruedThisYear: number;
  usedThisYear: number;
  reserved: number;
  available: number;
  sickUsedThisYear: number;
}

export interface OpeningImport {
  rows: number;
  accepted: number;
  rejected: number;
  applied: boolean;
  problems: { row: number; key: string; name: string | null; days: number | null; problem: 'unknown_employee' | 'bad_days' | 'opening_exists' }[];
}

const base = '/api/v1/leave';
const qs = (q: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const leaveApi = {
  kpis: () => request<LeaveKpis>('GET', `${base}/kpis`),
  requests: (q: { tab?: string; typeId?: string; employeeId?: string; search?: string; page?: number; pageSize?: number }) => request<{ rows: LeaveRow[]; total: number }>('GET', `${base}/requests${qs(q)}`),
  calendar: (period: string) => request<LeaveRow[]>('GET', `${base}/calendar/${period}`),
  request: (id: string) => request<LeaveDetail>('GET', `${base}/requests/${id}`),
  preview: (input: LeaveInput, requestId?: string) => request<LeavePreview>('POST', `${base}/requests/preview${qs({ requestId })}`, input),
  send: (input: LeaveInput) => request<{ id: string }>('POST', `${base}/requests`, input),
  resubmit: (id: string, input: LeaveInput) => request<{ id: string }>('POST', `${base}/requests/${id}/resubmit`, input),
  cancel: (id: string, reason: string) => request<void>('POST', `${base}/requests/${id}/cancel`, { reason }),
  amend: (id: string, input: LeaveAmendInput) => request<void>('PUT', `${base}/requests/${id}/amend`, input),
  cancelApproved: (id: string, reason: string) => request<void>('POST', `${base}/requests/${id}/cancel-approved`, { reason }),
  confirmReturn: (id: string, returnedOn: string, note: string | null) => request<void>('POST', `${base}/requests/${id}/return`, { returnedOn, note }),
  permissions: (q: { employeeId?: string; period?: string; tab?: string }) => request<Permission[]>('GET', `${base}/permissions${qs(q)}`),
  permission: (id: string) => request<Permission>('GET', `${base}/permissions/${id}`),
  previewPermission: (input: PermissionInput, requestId?: string) => request<PermissionPreview>('POST', `${base}/permissions/preview${qs({ requestId })}`, input),
  sendPermission: (input: PermissionInput) => request<{ id: string }>('POST', `${base}/permissions`, input),
  resubmitPermission: (id: string, input: PermissionInput) => request<{ id: string }>('POST', `${base}/permissions/${id}/resubmit`, input),
  employee: (id: string) => request<EmployeeLeave>('GET', `${base}/employees/${id}`),
  opening: (id: string, input: { leaveTypeId: string; date: string; days: number; reason: string }) => request<void>('POST', `${base}/employees/${id}/opening`, input),
  adjustment: (id: string, input: { leaveTypeId: string; date: string; days: number; reason: string }) => request<void>('POST', `${base}/employees/${id}/adjustment`, input),
  balances: (q: { typeId?: string; search?: string; departmentId?: string }) => request<BalanceRow[]>('GET', `${base}/balances${qs(q)}`),
  accrue: (period: string) => request<{ period: string; employees: number; days: number; skipped: number }>('POST', `${base}/balances/accrual/${period}`),
  carryOver: (year: number) => request<{ year: number; employees: number; days: number }>('POST', `${base}/balances/carry-over/${year}`),
  importOpenings: (file: File, typeId: string, asOf: string, apply: boolean) => {
    const form = new FormData();
    form.append('file', file);
    return upload<OpeningImport>(`${base}/balances/openings${qs({ typeId, asOf, apply })}`, form);
  },
  setup: () => request<LeaveSetup>('GET', `${base}/setup`),
  saveSettings: (input: LeaveSettings) => request<void>('PUT', `${base}/settings`, input),
  saveType: (id: string | null, input: LeaveTypeInput) => (id ? request<{ id: string }>('PUT', `${base}/types/${id}`, input) : request<{ id: string }>('POST', `${base}/types`, input)),
};

export const daysText = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
