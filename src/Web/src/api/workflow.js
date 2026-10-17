// Approval processes, the engine's inbox and requests, and internal requests (src/Modules/Workflow/.../Api/WorkflowEndpoints.cs).
import { request } from './auth';
const base = '/api/v1/workflow';
export const workflowApi = {
    screens: () => request('GET', `${base}/screens`),
    processes: () => request('GET', `${base}/processes`),
    process: (id) => request('GET', `${base}/processes/${id}`),
    createProcess: (input) => request('POST', `${base}/processes`, input),
    saveDraft: (id, input) => request('PUT', `${base}/processes/${id}/draft`, input),
    validate: (id) => request('POST', `${base}/processes/${id}/validate`),
    publish: (id) => request('POST', `${base}/processes/${id}/publish`),
    setActive: (id, isActive) => request('PUT', `${base}/processes/${id}/active`, { isActive }),
    approverOptions: () => request('GET', `${base}/approver-options`),
    inbox: (scope) => request('GET', `${base}/inbox?scope=${scope}`),
    inboxCount: () => request('GET', `${base}/inbox/count`),
    myRequests: () => request('GET', `${base}/my-requests`),
    instances: (status) => request('GET', `${base}/instances${status ? `?status=${status}` : ''}`),
    instance: (id) => request('GET', `${base}/instances/${id}`),
    decide: (workItemId, decision, comment, fields) => request('POST', `${base}/work-items/${workItemId}/decision`, { decision, comment, fields }),
    delegate: (workItemId, userId, comment) => request('POST', `${base}/work-items/${workItemId}/delegate`, { userId, comment }),
    cancel: (instanceId, reason) => request('POST', `${base}/instances/${instanceId}/cancel`, { reason }),
    retry: (instanceId) => request('POST', `${base}/instances/${instanceId}/retry`),
    people: () => request('GET', `${base}/people`),
    requests: (all) => request('GET', `${base}/requests?all=${all}`),
    request: (id) => request('GET', `${base}/requests/${id}`),
    createRequest: (input) => request('POST', `${base}/requests`, input),
    updateRequest: (id, input) => request('PUT', `${base}/requests/${id}`, input),
    submitRequest: (id) => request('POST', `${base}/requests/${id}/submit`),
};
/** A new unique step id for the editor. */
export const newStepId = () => `s${Math.random().toString(36).slice(2, 10)}`;
