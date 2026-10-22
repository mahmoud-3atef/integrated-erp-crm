// Delivery orders (src/Modules/Operations/.../Api/OperationsEndpoints.cs): written here, or copied from the old system.
import { request } from './auth';
const base = '/api/v1/operations/delivery-orders';
export const operationsApi = {
    list: (q) => {
        const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize), desc: String(q.desc ?? true) });
        if (q.search)
            params.set('search', q.search);
        if (q.status)
            params.set('status', q.status);
        if (q.source)
            params.set('source', q.source);
        if (q.sort)
            params.set('sort', q.sort);
        return request('GET', `${base}?${params.toString()}`);
    },
    get: (id) => request('GET', `${base}/${id}`),
    projects: () => request('GET', `${base}/projects`),
    availableWorkers: (orderId) => request('GET', `${base}/available-workers${orderId ? `?orderId=${orderId}` : ''}`),
    workers: (search) => request('GET', `${base}/workers?search=${encodeURIComponent(search)}`),
    prices: (projectId, workerIds, on, orderId) => request('POST', `${base}/prices`, { projectId, workerIds, on, orderId: orderId ?? null }),
    create: (input) => request('POST', base, input),
    update: (id, input) => request('PUT', `${base}/${id}`, input),
    submit: (id) => request('POST', `${base}/${id}/submit`),
    cancel: (id, comment) => request('POST', `${base}/${id}/cancel`, { comment }),
    amend: (id, input) => request('PUT', `${base}/${id}/amend`, input),
    cancelApproved: (id, reason) => request('POST', `${base}/${id}/cancel-approved`, { comment: reason }),
};
export const returnReasons = ['ClientNoReason', 'WorkerRefuses', 'Sick', 'WorkerAbused', 'ContractCanceled', 'Other'];
const returnsBase = '/api/v1/operations/return-orders';
export const returnsApi = {
    list: (q) => {
        const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize), desc: String(q.desc ?? true) });
        if (q.search)
            params.set('search', q.search);
        if (q.status)
            params.set('status', q.status);
        if (q.source)
            params.set('source', q.source);
        if (q.sort)
            params.set('sort', q.sort);
        return request('GET', `${returnsBase}?${params.toString()}`);
    },
    get: (id) => request('GET', `${returnsBase}/${id}`),
    onJobWorkers: (orderId) => request('GET', `${returnsBase}/on-job-workers${orderId ? `?orderId=${orderId}` : ''}`),
    rooms: () => request('GET', `${returnsBase}/rooms`),
    create: (input) => request('POST', returnsBase, input),
    update: (id, input) => request('PUT', `${returnsBase}/${id}`, input),
    submit: (id) => request('POST', `${returnsBase}/${id}/submit`),
    cancel: (id, comment) => request('POST', `${returnsBase}/${id}/cancel`, { comment }),
    amend: (id, input) => request('PUT', `${returnsBase}/${id}/amend`, input),
    cancelApproved: (id, reason) => request('POST', `${returnsBase}/${id}/cancel-approved`, { comment: reason }),
};
const transfersBase = '/api/v1/operations/transfer-orders';
export const transfersApi = {
    list: (q) => {
        const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize), desc: String(q.desc ?? true) });
        if (q.search)
            params.set('search', q.search);
        if (q.status)
            params.set('status', q.status);
        if (q.sort)
            params.set('sort', q.sort);
        return request('GET', `${transfersBase}?${params.toString()}`);
    },
    get: (id) => request('GET', `${transfersBase}/${id}`),
    projects: () => request('GET', `${transfersBase}/projects`),
    /** The projects the user may move workers to: all with the general permission, else the ones they manage. */
    targetProjects: () => request('GET', `${transfersBase}/target-projects`),
    onJobWorkers: (orderId, fromProjectId) => {
        const q = new URLSearchParams();
        if (orderId)
            q.set('orderId', orderId);
        if (fromProjectId)
            q.set('fromProjectId', fromProjectId);
        return request('GET', `${transfersBase}/on-job-workers${q.size ? `?${q.toString()}` : ''}`);
    },
    prices: (projectId, workerIds, on) => request('POST', `${transfersBase}/prices`, { projectId, workerIds, on, orderId: null }),
    create: (input) => request('POST', transfersBase, input),
    update: (id, input) => request('PUT', `${transfersBase}/${id}`, input),
    submit: (id) => request('POST', `${transfersBase}/${id}/submit`),
    cancel: (id, comment) => request('POST', `${transfersBase}/${id}/cancel`, { comment }),
    amend: (id, input) => request('PUT', `${transfersBase}/${id}/amend`, input),
    cancelApproved: (id, reason) => request('POST', `${transfersBase}/${id}/cancel-approved`, { comment: reason }),
};
