import { request } from './auth';
export const workerFileApi = {
    documents: (workerId) => request('GET', `/api/v1/operations/workers/${workerId}/documents`),
    invoiceLines: (workerId) => request('GET', `/api/v1/billing/workers/${workerId}/invoice-lines`),
    legacyInvoices: (workerId) => request('GET', `/api/v1/reports/workers/${workerId}/legacy-invoices`),
};
/** Where each document opens. */
export const documentRoute = {
    delivery_order: '/operations/delivery-orders/',
    return_order: '/operations/return-orders/',
    transfer_order: '/operations/transfer-orders/',
    worker_movement: '/operations/movements/',
};
