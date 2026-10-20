// The staff's attendance (src/Modules/Attendance/.../Api/AttendanceEndpoints.cs).
import { request, upload } from './auth';
import type { ApprovalStatus } from './workflow';

export interface NamedRef {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface ImportInfo {
  id: string;
  fileName: string;
  from: string;
  to: string;
  rows: number;
  accepted: number;
  rejected: number;
  employees: number;
  createdByName: string;
  createdAt: string;
}

export interface MonthKpis {
  employees: number;
  withFullPunches: number;
  withoutPunches: number;
  onLeaveAllMonth: number;
  absenceDays: number;
  deductionDays: number;
  excusedDays: number;
  lateMinutes: number;
  lateEmployees: number;
  earlyMinutes: number;
  missingPunches: number;
  openExceptions: number;
  overtimeMinutes: number;
  overtimePending: number;
}

export type MonthStatus = 'Open' | 'InApproval' | 'Closed';

export interface AttendanceMonth {
  period: string;
  from: string;
  to: string;
  cycleStartDay: number;
  monthId: string | null;
  status: MonthStatus;
  submittedByName: string | null;
  submittedAt: string | null;
  closedAt: string | null;
  lastComment: string | null;
  approval: ApprovalStatus | null;
  hasData: boolean;
  lastImport: ImportInfo | null;
  kpis: MonthKpis;
  shifts: NamedRef[];
  departments: NamedRef[];
  legalEntities: NamedRef[];
}

export type RowState = 'Complete' | 'Exceptions' | 'NoPunches' | 'NoWorkDays';
export const rowStates: RowState[] = ['Complete', 'Exceptions', 'NoPunches'];

export interface MonthRow {
  employeeId: string;
  employeeNo: string;
  nameAr: string | null;
  nameEn: string;
  departmentAr: string | null;
  departmentEn: string | null;
  shiftAr: string | null;
  shiftEn: string | null;
  workDays: number;
  present: number;
  absent: number;
  leave: number;
  lateMinutes: number;
  earlyMinutes: number;
  missingPunches: number;
  deduction: number;
  overtimeMinutes: number;
  state: RowState;
}

export interface MonthTotals {
  employees: number;
  workDays: number;
  present: number;
  absent: number;
  leave: number;
  lateMinutes: number;
  earlyMinutes: number;
  missingPunches: number;
  deduction: number;
  overtimeMinutes: number;
}

export interface MonthPage {
  rows: MonthRow[];
  total: number;
  totals: MonthTotals;
}

export type DayStatus = 'NoData' | 'Present' | 'MissingPunch' | 'Absent' | 'Rest' | 'Holiday' | 'Leave' | 'Mission' | 'Excused' | 'Exempt';
export type ManualStatus = 'Present' | 'Excused' | 'Leave' | 'Mission' | 'Absent';
export const manualStatuses: ManualStatus[] = ['Present', 'Excused', 'Leave', 'Mission', 'Absent'];

export interface Day {
  date: string;
  status: DayStatus;
  isWorkingDay: boolean;
  holidayAr: string | null;
  holidayEn: string | null;
  ramadan: boolean;
  shiftStartsAt: string;
  shiftEndsAt: string;
  in: string | null;
  out: string | null;
  deviceIn: string | null;
  deviceOut: string | null;
  deviceStatus: string | null;
  permissionMinutes: number;
  deviceLateMinutes: number | null;
  deviceEarlyMinutes: number | null;
  manualStatus: ManualStatus | null;
  note: string | null;
  deductionSet: number | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
  deduction: number;
  editedByName: string | null;
  editedAt: string | null;
  leaveTypeAr: string | null;
  leaveTypeEn: string | null;
  leaveRequestNo: string | null;
  deviceLeaveWithoutRequest: boolean;
}

export interface EmployeeMonth {
  employeeId: string;
  employeeNo: string;
  nameAr: string | null;
  nameEn: string;
  idNumber: string | null;
  departmentAr: string | null;
  departmentEn: string | null;
  shiftAr: string | null;
  shiftEn: string | null;
  shiftStartsAt: string | null;
  shiftEndsAt: string | null;
  graceMinutes: number | null;
  badgeNo: string | null;
  exempt: boolean;
  summary: MonthRow;
  days: Day[];
}

export interface AttendanceException {
  employeeId: string;
  employeeNo: string;
  nameAr: string | null;
  nameEn: string;
  departmentAr: string | null;
  departmentEn: string | null;
  date: string;
  status: DayStatus | 'DeviceLeave';
  in: string | null;
  out: string | null;
  deviceStatus: string | null;
}

export interface FileColumn {
  header: string;
  samples: string[];
}

export type FileField = 'key' | 'name' | 'date' | 'status' | 'in' | 'out' | 'permission' | 'late' | 'early';
export const fileFields: FileField[] = ['key', 'name', 'date', 'status', 'in', 'out', 'late', 'early', 'permission'];

export interface ImportProblem {
  row: number;
  key: string;
  name: string | null;
  date: string;
  in: string | null;
  out: string | null;
  code: 'unknown_employee' | 'not_employed' | 'month_closed' | 'duplicate' | 'bad_time';
  rejected: boolean;
}

export interface ImportPreview {
  matchBy: MatchBy;
  columns: FileColumn[];
  mapping: Partial<Record<FileField, string>>;
  rows: number;
  accepted: number;
  rejected: number;
  warnings: number;
  skipped: number;
  employees: number;
  from: string | null;
  to: string | null;
  problems: ImportProblem[];
  unmatched: { key: string; name: string | null; rows: number }[];
  importId: string | null;
}

export type MatchBy = 'IdNumber' | 'EmployeeNo' | 'BadgeNo';
export const matchBys: MatchBy[] = ['IdNumber', 'EmployeeNo', 'BadgeNo'];
export type LateFrom = 'GraceEnd' | 'ShiftStart';
export type MinutesSource = 'Company' | 'Device' | 'Shift';
export const minutesSources: MinutesSource[] = ['Company', 'Device', 'Shift'];

export type OvertimeStatus = 'InApproval' | 'Returned' | 'Rejected' | 'Approved';

export interface Overtime {
  id: string;
  requestNo: string;
  employeeId: string;
  employeeName: string;
  date: string;
  minutes: number;
  reason: string;
  status: OvertimeStatus;
  awaitingApproval: boolean;
  createdByName: string;
  createdAt: string;
  decidedAt: string | null;
  lastComment: string | null;
  approval: ApprovalStatus | null;
}

export interface Assignment {
  id: string;
  shiftId: string;
  departmentId: string | null;
  employeeId: string | null;
  nameAr: string | null;
  nameEn: string | null;
  from: string;
  to: string | null;
}

export interface Shift {
  id: string;
  nameAr: string;
  nameEn: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  graceMinutes: number;
  lateFrom: LateFrom;
  restDays: number[];
  ramadanStartsAt: string | null;
  ramadanEndsAt: string | null;
  isActive: boolean;
  isDefault: boolean;
  minutesSource: MinutesSource;
  employees: number;
  assignments: Assignment[];
}

export type ShiftInput = Omit<Shift, 'id' | 'employees' | 'assignments'>;

export type HolidayKind = 'Official' | 'Ramadan';

export interface Holiday {
  id: string;
  nameAr: string;
  nameEn: string;
  from: string;
  to: string;
  kind: HolidayKind;
  days: number;
}

export interface AttendanceSetupData {
  settings: { matchBy: MatchBy; cycleStartDay: number; useDeviceMinutes: boolean };
  shifts: Shift[];
  holidays: Holiday[];
}

const base = '/api/v1/attendance';
const qs = (q: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

function fileForm(file: File, mapping?: Partial<Record<FileField, string>>) {
  const form = new FormData();
  form.append('file', file);
  if (mapping) form.append('mapping', JSON.stringify(mapping));
  return form;
}

export const attendanceApi = {
  month: (period: string, legalEntityId?: string) => request<AttendanceMonth>('GET', `${base}/months/${period}${qs({ legalEntityId })}`),
  employees: (period: string, q: { legalEntityId?: string; search?: string; departmentId?: string; shiftId?: string; state?: string; sort?: string; desc?: boolean; page: number; pageSize: number }) =>
    request<MonthPage>('GET', `${base}/months/${period}/employees${qs(q)}`),
  exceptions: (period: string, legalEntityId?: string) => request<AttendanceException[]>('GET', `${base}/months/${period}/exceptions${qs({ legalEntityId })}`),
  employee: (period: string, id: string) => request<EmployeeMonth>('GET', `${base}/months/${period}/employees/${id}`),
  correct: (id: string, date: string, input: { in: string | null; out: string | null; status: ManualStatus | null; note: string | null; deduction: number | null }) =>
    request<void>('PUT', `${base}/employees/${id}/days/${date}`, input),
  saveEmployee: (id: string, input: { badgeNo: string | null; exempt: boolean }) => request<void>('PUT', `${base}/employees/${id}/setting`, input),
  imports: () => request<ImportInfo[]>('GET', `${base}/imports`),
  preview: (file: File, mapping?: Partial<Record<FileField, string>>) => upload<ImportPreview>(`${base}/imports/preview`, fileForm(file, mapping)),
  apply: (file: File, mapping?: Partial<Record<FileField, string>>) => upload<ImportPreview>(`${base}/imports`, fileForm(file, mapping)),
  setup: (year: number) => request<AttendanceSetupData>('GET', `${base}/setup${qs({ year })}`),
  saveSettings: (input: { matchBy: MatchBy; cycleStartDay: number; useDeviceMinutes: boolean }) => request<void>('PUT', `${base}/settings`, input),
  saveShift: (id: string | null, input: ShiftInput) => (id ? request<{ id: string }>('PUT', `${base}/shifts/${id}`, input) : request<{ id: string }>('POST', `${base}/shifts`, input)),
  deleteShift: (id: string) => request<void>('DELETE', `${base}/shifts/${id}`),
  assign: (input: { shiftId: string; departmentId: string | null; employeeId: string | null; from: string; to: string | null }) => request<{ id: string }>('POST', `${base}/assignments`, input),
  unassign: (id: string) => request<void>('DELETE', `${base}/assignments/${id}`),
  saveHoliday: (id: string | null, input: { nameAr: string; nameEn: string | null; from: string; to: string; kind: HolidayKind }) =>
    id ? request<{ id: string }>('PUT', `${base}/holidays/${id}`, input) : request<{ id: string }>('POST', `${base}/holidays`, input),
  deleteHoliday: (id: string) => request<void>('DELETE', `${base}/holidays/${id}`),
  monthPeriod: (id: string) => request<{ period: string }>('GET', `${base}/months/by-id/${id}`),
  submitMonth: (period: string) => request<{ id: string }>('POST', `${base}/months/${period}/submit`),
  reopenMonth: (period: string, reason: string) => request<void>('POST', `${base}/months/${period}/reopen`, { reason }),
  overtimeOf: (period: string) => request<Overtime[]>('GET', `${base}/months/${period}/overtime`),
  overtime: (id: string) => request<Overtime>('GET', `${base}/overtime/${id}`),
  requestOvertime: (input: { employeeId: string; date: string; minutes: number; reason: string }) => request<{ id: string }>('POST', `${base}/overtime`, input),
  resubmitOvertime: (id: string, input: { employeeId: string; date: string; minutes: number; reason: string }) => request<{ id: string }>('POST', `${base}/overtime/${id}/resubmit`, input),
};

/** "2026-09" for a date; the month before/after. */
export const periodOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const shiftPeriod = (period: string, by: number) => {
  const [y = 2026, m = 1] = period.split('-').map(Number);
  return periodOf(new Date(y, m - 1 + by, 1));
};

/** Minutes as h:mm (90 → 1:30). */
export const hm = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

/** "09:00:00" → "09:00". */
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
