// Delivery orders (src/Modules/Operations/.../Api/OperationsEndpoints.cs): written here, or copied from the old system.
import { request } from './auth';
import type { ContractType } from './commercial';
import type { RoomOption } from './housing';
import type { ApprovalStatus } from './workflow';
import type { Placement } from './workforce';

export type DeliveryStatus = 'UnderPreparation' | 'SentToOperationsManager' | 'InApproval' | 'Returned' | 'Rejected' | 'Delivered' | 'NotDelivered' | 'Canceled';

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
  totals: { all: number; underPreparation: number; withOperations: number; delivered: number; closed: number };
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
  awaitingApproval: boolean;
  canEdit: boolean;
  canSubmit: boolean;
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
  projectJoinedOn: string | null;
  onJob: boolean;
}

/** An available worker for the order form; busyOrderNo: another open order already has them. */
export interface AvailableWorker {
  worker: WorkerCard;
  busyOrderNo: string | null;
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

/** A saved order; approvalError: the error code when its approval could not start. */
export interface SavedOrder {
  id: string;
  approvalError: string | null;
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
  availableWorkers: (orderId?: string) => request<AvailableWorker[]>('GET', `${base}/available-workers${orderId ? `?orderId=${orderId}` : ''}`),
  workers: (search: string) => request<WorkerCard[]>('GET', `${base}/workers?search=${encodeURIComponent(search)}`),
  prices: (projectId: string, workerIds: string[], on: string, orderId?: string) =>
    request<WorkerPriceQuote[]>('POST', `${base}/prices`, { projectId, workerIds, on, orderId: orderId ?? null }),
  create: (input: DeliveryInput) => request<SavedOrder>('POST', base, input),
  update: (id: string, input: DeliveryInput) => request<SavedOrder>('PUT', `${base}/${id}`, input),
  submit: (id: string) => request<void>('POST', `${base}/${id}/submit`),
  cancel: (id: string, comment: string | null) => request<void>('POST', `${base}/${id}/cancel`, { comment }),
};

// ---------------------------------------------------------------- Return orders (worker back to housing)

export type ReturnStatus = 'UnderPreparation' | 'SentToSales' | 'SentToOperationsManager' | 'InApproval' | 'Returned' | 'Rejected' | 'Completed' | 'Canceled';
export const returnReasons = ['ClientNoReason', 'WorkerRefuses', 'Sick', 'WorkerAbused', 'ContractCanceled', 'Other'] as const;

export interface ReturnRow {
  id: string;
  orderNo: string;
  source: 'System' | 'Crm';
  status: ReturnStatus;
  crmStatus: number | null;
  entry: 'ReturnedWorker' | 'NewArrival' | 'BackFromVacation';
  workerId: string | null;
  workerNo: string;
  name: string;
  projectName: string | null;
  arrivedOn: string | null;
  reason: string;
  customerWish: string | null;
  stopSalary: boolean;
  housingName: string | null;
  createdByName: string;
  createdAt: string;
}

export interface ReturnList {
  total: number;
  totals: { all: number; underPreparation: number; inApproval: number; completed: number; closed: number };
  items: ReturnRow[];
}

export interface ReturnDetail {
  summary: ReturnRow;
  professionAr: string | null;
  professionEn: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  iqamaNo: string | null;
  projectId: string | null;
  workStartedOn: string | null;
  reasonNotes: string | null;
  delayReason: string | null;
  notes: string | null;
  lastComment: string | null;
  completedAt: string | null;
  completedByName: string | null;
  approval: ApprovalStatus | null;
  awaitingApproval: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canCancel: boolean;
  roomId: string | null;
}

export interface ReturnInput {
  workerId: string;
  arrivedOn: string;
  reason: string;
  reasonNotes: string | null;
  stopSalary: boolean;
  housingName: string | null;
  delayReason: string | null;
  notes: string | null;
  roomId: string | null;
}

const returnsBase = '/api/v1/operations/return-orders';

export const returnsApi = {
  list: (q: DeliveryQuery) => {
    const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize), desc: String(q.desc ?? true) });
    if (q.search) params.set('search', q.search);
    if (q.status) params.set('status', q.status);
    if (q.source) params.set('source', q.source);
    if (q.sort) params.set('sort', q.sort);
    return request<ReturnList>('GET', `${returnsBase}?${params.toString()}`);
  },
  get: (id: string) => request<ReturnDetail>('GET', `${returnsBase}/${id}`),
  onJobWorkers: (orderId?: string) => request<AvailableWorker[]>('GET', `${returnsBase}/on-job-workers${orderId ? `?orderId=${orderId}` : ''}`),
  rooms: () => request<RoomOption[]>('GET', `${returnsBase}/rooms`),
  create: (input: ReturnInput) => request<SavedOrder>('POST', returnsBase, input),
  update: (id: string, input: ReturnInput) => request<SavedOrder>('PUT', `${returnsBase}/${id}`, input),
  submit: (id: string) => request<void>('POST', `${returnsBase}/${id}/submit`),
  cancel: (id: string, comment: string | null) => request<void>('POST', `${returnsBase}/${id}/cancel`, { comment }),
};

// ---------------------------------------------------------------- Transfer orders (between projects)

export type TransferStatus = 'UnderPreparation' | 'SentToOperationsManager' | 'InApproval' | 'Returned' | 'Rejected' | 'Transferred' | 'Canceled';

export interface TransferRow {
  id: string;
  orderNo: string;
  status: TransferStatus;
  projectId: string;
  projectName: string;
  customerName: string | null;
  /** The projects the workers leave, joined. */
  fromProjects: string | null;
  transferOn: string;
  workers: number;
  totalPrice: number;
  specialPrices: number;
  createdByName: string;
  createdAt: string;
}

export interface TransferList {
  total: number;
  totals: { all: number; underPreparation: number; withOperations: number; transferred: number; closed: number };
  items: TransferRow[];
}

export interface TransferLine {
  id: string;
  lineNo: number;
  workerId: string;
  workerNo: string;
  name: string;
  professionCode: string | null;
  professionAr: string | null;
  professionEn: string | null;
  nationalityCode: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  iqamaNo: string | null;
  fromProjectId: string | null;
  fromProjectName: string | null;
  fromStartedOn: string | null;
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
}

export interface TransferDetail {
  summary: TransferRow;
  projectCode: string;
  contractType: ContractType | null;
  projectManager: string | null;
  receiverName: string | null;
  receiverTitle: string | null;
  delayReason: string | null;
  notes: string | null;
  lastComment: string | null;
  submittedAt: string | null;
  transferredAt: string | null;
  transferredByName: string | null;
  lines: TransferLine[];
  approval: ApprovalStatus | null;
  awaitingApproval: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canCancel: boolean;
}

export interface TransferInput {
  projectId: string;
  transferOn: string;
  receiverName: string | null;
  receiverTitle: string | null;
  delayReason: string | null;
  notes: string | null;
  lines: { workerId: string; specialPrice: number | null; specialReason: string | null }[];
}

const transfersBase = '/api/v1/operations/transfer-orders';

export const transfersApi = {
  list: (q: DeliveryQuery) => {
    const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize), desc: String(q.desc ?? true) });
    if (q.search) params.set('search', q.search);
    if (q.status) params.set('status', q.status);
    if (q.sort) params.set('sort', q.sort);
    return request<TransferList>('GET', `${transfersBase}?${params.toString()}`);
  },
  get: (id: string) => request<TransferDetail>('GET', `${transfersBase}/${id}`),
  projects: () => request<ProjectOption[]>('GET', `${transfersBase}/projects`),
  onJobWorkers: (orderId?: string) => request<AvailableWorker[]>('GET', `${transfersBase}/on-job-workers${orderId ? `?orderId=${orderId}` : ''}`),
  prices: (projectId: string, workerIds: string[], on: string) => request<WorkerPriceQuote[]>('POST', `${transfersBase}/prices`, { projectId, workerIds, on, orderId: null }),
  create: (input: TransferInput) => request<SavedOrder>('POST', transfersBase, input),
  update: (id: string, input: TransferInput) => request<SavedOrder>('PUT', `${transfersBase}/${id}`, input),
  submit: (id: string) => request<void>('POST', `${transfersBase}/${id}/submit`),
  cancel: (id: string, comment: string | null) => request<void>('POST', `${transfersBase}/${id}/cancel`, { comment }),
};
