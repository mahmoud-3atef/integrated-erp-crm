// Approval processes, the engine's inbox and requests, and internal requests (src/Modules/Workflow/.../Api/WorkflowEndpoints.cs).
import { request } from './auth';
const base = '/api/v1/workflow';
/** A screen as a process sees it, with the status values the company added (settable by an update step). */
export function withStatusValues(screen, statuses) {
    const added = (statuses?.added ?? []).filter((v) => v.isActive);
    if (added.length === 0)
        return screen;
    return {
        ...screen,
        fields: screen.fields.map((f) => f.key !== 'status'
            ? f
            : {
                ...f,
                updatable: true,
                options: [
                    ...(f.options ?? []).map((o) => (f.updatable ? o : { ...o, settable: false })),
                    ...added.map((v) => ({ value: v.code, nameAr: v.nameAr, nameEn: `${v.nameEn} · In approval`, settable: true })),
                ],
            }),
    };
}
export const workflowApi = {
    statusValues: (screen) => request('GET', `${base}/status-values?screen=${encodeURIComponent(screen)}`),
    createStatusValue: (input) => request('POST', `${base}/status-values`, input),
    updateStatusValue: (id, change) => request('PUT', `${base}/status-values/${id}`, change),
    /** The values a text field of the screen's table (or of a related table) holds, to pick one. */
    fieldValues: (screen, relation, field) => request('GET', `${base}/screens/${encodeURIComponent(screen)}/values?field=${encodeURIComponent(field)}${relation ? `&relation=${encodeURIComponent(relation)}` : ''}`),
    currentStages: (screen, ids) => request('GET', `${base}/current-stages?screen=${encodeURIComponent(screen)}&ids=${ids.join(',')}`),
    screens: () => request('GET', `${base}/screens`),
    processes: () => request('GET', `${base}/processes`),
    startInstance: (screen, recordId, processId, title) => request('POST', `${base}/instances/start`, { screen, recordId, processId, title }),
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
    /** The same idempotency key sent again (a retry, a double click) returns the first result without deciding twice. */
    decide: (workItemId, decision, comment, fields, idempotencyKey) => request('POST', `${base}/work-items/${workItemId}/decision`, { decision, comment, fields }, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined),
    delegate: (workItemId, userId, comment) => request('POST', `${base}/work-items/${workItemId}/delegate`, { userId, comment }),
    reassign: (workItemId, userId, reason) => request('POST', `${base}/work-items/${workItemId}/reassign`, { userId, reason }),
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
