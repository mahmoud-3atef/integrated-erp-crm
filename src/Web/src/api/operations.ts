// Delivery orders (src/Modules/Operations/.../Api/OperationsEndpoints.cs): written here, or copied from the old system.
import { request } from './auth';
import type { ContractType } from './commercial';
import type { ApprovalStatus } from './workflow';
import type { Placement } from './workforce';

export type DeliveryStatus = 'Draft' | 'InApproval' | 'Returned' | 'Approved' | 'Rejected' | 'Delivered' | 'NotDelivered' | 'Canceled';

export interface DeliveryRow {
  id: string;
  orderNo: string;
  source: 'System' | 'Crm';
  status: DeliveryStatus;
  crmStatus: number | null;
  projectId: string | null;
  projectName: string;
  customerName: string | null;
  projectManager: string | null;
  deliverOn: string | null;
  startOn: string | null;
  workers: number;
  totalPrice: number;
  specialPrices: number;
  receiverName: string;
  createdByName: string;
  createdAt: string;
}

export interface DeliveryList {
  total: number;
  totals: { all: number; pending: number; approved: number; delivered: number; drafts: number };
  items: DeliveryRow[];
}

export interface DeliveryLine {
  id: string;
  lineNo: number;
  workerId: string | null;
  workerNo: string;
  name: string;
  professionCode: string | null;
  professionAr: string | null;
  professionEn: string | null;
  nationalityCode: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  iqamaNo: string | null;
  packageId: string | null;
  packageNo: string | null;
  salary: number;
  serviceFee: number;
  housing: number;
  housingBillable: boolean;
  transport: number;
  transportBillable: boolean;
  totalPrice: number;
  isSpecialPrice: boolean;
  specialReason: string | null;
  startOn: string | null;
  startedOn: string | null;
  workStartNo: string | null;
}

export interface DeliveryDetail {
  summary: DeliveryRow;
  projectCode: string | null;
  contractType: ContractType | null;
  receiverTitle: string | null;
  delayReason: string | null;
  notes: string | null;
  lastComment: string | null;
  submittedAt: string | null;
  deliveredAt: string | null;
  deliveredByName: string | null;
  lines: DeliveryLine[];
  approval: ApprovalStatus | null;
  canEdit: boolean;
  canSubmit: boolean;
  canConfirm: boolean;
  canCancel: boolean;
}

export interface ProjectOption {
  id: string;
  crmId: string;
  code: string;
  name: string;
  customerName: string | null;
  manager: string | null;
  contractType: ContractType | null;
  isActive: boolean;
}

export interface WorkerCard {
  id: string;
  crmId: string;
  workerNo: string;
  name: string;
  placement: Placement;
  available: boolean;
  statusAr: string | null;
  statusEn: string | null;
  professionCode: string | null;
  professionAr: string | null;
  professionEn: string | null;
  nationalityCode: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  iqamaNo: string | null;
  iqamaExpiresOn: string | null;
  totalSalary: number;
  projectCrmId: string | null;
  projectName: string | null;
}

/** A worker's price on the project from their package (the form shows it before saving). */
export interface WorkerPriceQuote {
  worker: WorkerCard;
  busy: boolean;
  busyOrderNo: string | null;
  packageId: string | null;
  packageNo: string | null;
  packageForProject: boolean;
  salary: number;
  serviceFee: number;
  housing: number;
  housingBillable: boolean;
  transport: number;
  transportBillable: boolean;
  totalPrice: number | null;
}

export interface DeliveryLineInput {
  workerId: string;
  startOn: string | null;
  specialPrice: number | null;
  specialReason: string | null;
}

export interface DeliveryInput {
  projectId: string;
  deliverOn: string;
  startOn: string;
  receiverName: string;
  receiverTitle: string | null;
  delayReason: string | null;
  notes: string | null;
  lines: DeliveryLineInput[];
}

export interface DeliveryQuery {
  search?: string;
  status?: string;
  source?: string;
  sort?: string;
  desc?: boolean;
  page: number;
  pageSize: number;
}

const base = '/api/v1/operations/delivery-orders';

export const operationsApi = {
  list: (q: DeliveryQuery) => {
    const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize), desc: String(q.desc ?? true) });
    if (q.search) params.set('search', q.search);
    if (q.status) params.set('status', q.status);
    if (q.source) params.set('source', q.source);
    if (q.sort) params.set('sort', q.sort);
    return request<DeliveryList>('GET', `${base}?${params.toString()}`);
  },
  get: (id: string) => request<DeliveryDetail>('GET', `${base}/${id}`),
  projects: () => request<ProjectOption[]>('GET', `${base}/projects`),
  workers: (search: string) => request<WorkerCard[]>('GET', `${base}/workers?search=${encodeURIComponent(search)}`),
  prices: (projectId: string, workerIds: string[], on: string, orderId?: string) =>
    request<WorkerPriceQuote[]>('POST', `${base}/prices`, { projectId, workerIds, on, orderId: orderId ?? null }),
  create: (input: DeliveryInput) => request<{ id: string }>('POST', base, input),
  update: (id: string, input: DeliveryInput) => request<void>('PUT', `${base}/${id}`, input),
  submit: (id: string) => request<void>('POST', `${base}/${id}/submit`),
  confirm: (id: string, lines: { lineId: string; startedOn: string }[]) => request<void>('POST', `${base}/${id}/confirm`, { lines }),
  cancel: (id: string, comment: string | null) => request<void>('POST', `${base}/${id}/cancel`, { comment }),
};
