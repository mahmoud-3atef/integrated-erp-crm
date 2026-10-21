// Worker movements: arrival, vacation and return, absconding and return, suspension and lifting, final exit
// (src/Modules/Operations/.../Api/MovementEndpoints.cs).
import { request } from './auth';
import type { ProjectOption, WorkerCard } from './operations';
import type { ApprovalStatus } from './workflow';
import type { WorkerPeriod } from './workforce';

export const movementTypes = ['Arrival', 'VacationDeparture', 'VacationReturn', 'Absconding', 'AbscondingReturn', 'Suspension', 'SuspensionLift', 'FinalExit'] as const;
export type MovementType = (typeof movementTypes)[number];
export type MovementStatus = 'InApproval' | 'Returned' | 'Rejected' | 'Executed' | 'Canceled' | 'CanceledAfterApproval';
export type PeriodKind = 'Housing' | 'Work' | 'Vacation' | 'ClientVacation' | 'Absconded' | 'Suspended' | 'Out';
export type ReturnTarget = 'Housing' | 'SameProject' | 'NewProject';
export const suspensionReasons = ['Sickness', 'Investigation', 'Prison', 'Other'] as const;
export const exitKinds = ['FinalExit', 'EndOfService', 'SponsorshipTransfer'] as const;

export interface MovementRow {
  id: string;
  movementNo: string;
  type: MovementType;
  status: MovementStatus;
  workerId: string;
  workerNo: string;
  workerName: string;
  fromPlacement: string;
  fromProjectName: string | null;
  opensPeriod: PeriodKind;
  projectName: string | null;
  effectiveOn: string;
  vacationKind: 'Regular' | 'Client' | null;
  createdByName: string;
  createdAt: string;
}

export interface MovementList {
  types: { type: MovementType; open: number; total: number }[];
  open: number;
  executed: number;
  rows: MovementRow[];
}

export interface MovementDetail {
  id: string;
  movementNo: string;
  type: MovementType;
  status: MovementStatus;
  awaitingApproval: boolean;
  workerId: string;
  workerNo: string;
  workerName: string;
  iqamaNo: string | null;
  fromPlacement: string;
  fromProjectName: string | null;
  opensPeriod: PeriodKind;
  effectiveOn: string;
  expectedReturnOn: string | null;
  vacationKind: 'Regular' | 'Client' | null;
  returnTo: ReturnTarget | null;
  projectId: string | null;
  projectName: string | null;
  packageNo: string | null;
  salary: number;
  serviceFee: number;
  housing: number;
  transport: number;
  totalPrice: number;
  isSpecialPrice: boolean;
  specialReason: string | null;
  paySalary: boolean;
  suspensionReason: string | null;
  exitKind: string | null;
  place: string | null;
  delayReason: string | null;
  notes: string | null;
  createdByName: string;
  createdAt: string;
  executedAt: string | null;
  executedByName: string | null;
  lastComment: string | null;
  timeline: WorkerPeriod[];
  approval: ApprovalStatus | null;
  canEdit: boolean;
  /** An executed action: may be changed or cancelled by the holders of its type's own permissions (with a reason). */
  canAmend: boolean;
  canCancelApproved: boolean;
  amendedAt: string | null;
  amendedByName: string | null;
  amendNote: string | null;
  canceledAt: string | null;
  canceledByName: string | null;
}

/** What may change on an executed action: its date, the expected return (a vacation), the place and notes, with the reason. */
export interface MovementAmendInput {
  effectiveOn: string;
  expectedReturnOn: string | null;
  place: string | null;
  notes: string | null;
  amendReason: string;
}

export interface MovementOptions {
  worker: WorkerCard;
  allowed: MovementType[];
  busyWith: string | null;
  previousProjectId: string | null;
  previousProjectName: string | null;
  previousPrice: number | null;
}

export interface MovementQuote {
  projectId: string;
  projectName: string;
  packageNo: string | null;
  salary: number;
  serviceFee: number;
  housing: number;
  transport: number;
  totalPrice: number | null;
}

export interface MovementInput {
  type: MovementType;
  workerId: string;
  effectiveOn: string;
  expectedReturnOn: string | null;
  vacationKind: 'Regular' | 'Client' | null;
  returnTo: ReturnTarget | null;
  projectId: string | null;
  specialPrice: number | null;
  specialReason: string | null;
  paySalary: boolean;
  suspensionReason: string | null;
  exitKind: string | null;
  place: string | null;
  delayReason: string | null;
  notes: string | null;
}

const base = '/api/v1/operations/movements';
const qs = (filter: Record<string, string | undefined | null>) => new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]).toString();

export const movementsApi = {
  list: (filter: { type?: string; status?: string; search?: string }) => request<MovementList>('GET', `${base}?${qs(filter)}`),
  get: (id: string) => request<MovementDetail>('GET', `${base}/${id}`),
  workers: (search: string) => request<WorkerCard[]>('GET', `${base}/workers?${qs({ search })}`),
  options: (workerId: string, except?: string) => request<MovementOptions>('GET', `${base}/options/${workerId}?${qs({ except })}`),
  projects: () => request<ProjectOption[]>('GET', `${base}/projects`),
  quote: (workerId: string, projectId: string, on: string) => request<MovementQuote>('GET', `${base}/quote?${qs({ workerId, projectId, on })}`),
  create: (input: MovementInput) => request<{ id: string; submitError: string | null }>('POST', base, input),
  update: (id: string, input: MovementInput) => request<{ id: string; submitError: string | null }>('PUT', `${base}/${id}`, input),
  submit: (id: string) => request<void>('POST', `${base}/${id}/submit`),
  cancel: (id: string, comment: string | null) => request<void>('POST', `${base}/${id}/cancel`, { comment }),
  amend: (id: string, input: MovementAmendInput) => request<void>('PUT', `${base}/${id}/amend`, input),
  cancelApproved: (id: string, reason: string) => request<void>('POST', `${base}/${id}/cancel-approved`, { comment: reason }),
};
