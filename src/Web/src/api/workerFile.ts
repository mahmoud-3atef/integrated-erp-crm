import { request } from './auth';

// The worker's file beyond the worker's own data: the documents the worker is on (Operations, for the actions
// timeline), and the worker's invoice lines in this system (Billing) and in the old one (Reports, read-only).

/** A document the worker is on; type is a period's source type (delivery_order, return_order…). */
export interface WorkerDocument {
  type: string;
  id: string;
  no: string;
  status: string;
  crmId: string | null;
  /** A delivery line's old-system work start number (a period's source number when it came from the old system). */
  workStartNo: string | null;
  reason: string | null;
  createdByName: string | null;
  createdAt: string | null;
}

export interface WorkerInvoiceLine {
  invoiceId: string;
  invoiceNo: string | null;
  kind: string;
  status: string;
  projectName: string;
  from: string;
  to: string;
  invoiceDate: string;
  workDays: number;
  monthlyPrice: number;
  amount: number;
}

export interface LegacyInvoiceLine {
  invoiceNo: string;
  projectName: string;
  from: string | null;
  to: string;
  invoiceDate: string | null;
  statusAr: string;
  statusEn: string;
  workDays: number;
  monthlyPrice: number;
  amount: number;
}

export const workerFileApi = {
  documents: (workerId: string) => request<WorkerDocument[]>('GET', `/api/v1/operations/workers/${workerId}/documents`),
  invoiceLines: (workerId: string) => request<WorkerInvoiceLine[]>('GET', `/api/v1/billing/workers/${workerId}/invoice-lines`),
  legacyInvoices: (workerId: string) => request<LegacyInvoiceLine[]>('GET', `/api/v1/reports/workers/${workerId}/legacy-invoices`),
};

/** Where each document opens. */
export const documentRoute: Record<string, string> = {
  delivery_order: '/operations/delivery-orders/',
  return_order: '/operations/return-orders/',
  transfer_order: '/operations/transfer-orders/',
  worker_movement: '/operations/movements/',
};
