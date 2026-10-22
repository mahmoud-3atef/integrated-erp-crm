// The staff's leave (src/Modules/Leave/.../Api/LeaveEndpoints.cs).
import { request, upload } from './auth';
export const leavePays = ['Full', 'SickTiers', 'Unpaid'];
export const permissionKinds = ['LateArrival', 'EarlyLeave', 'During', 'Mission'];
const base = '/api/v1/leave';
const qs = (q) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q))
        if (v !== undefined && v !== null && v !== '')
            p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
};
export const leaveApi = {
    kpis: () => request('GET', `${base}/kpis`),
    requests: (q) => request('GET', `${base}/requests${qs(q)}`),
    calendar: (period) => request('GET', `${base}/calendar/${period}`),
    request: (id) => request('GET', `${base}/requests/${id}`),
    preview: (input, requestId) => request('POST', `${base}/requests/preview${qs({ requestId })}`, input),
    send: (input) => request('POST', `${base}/requests`, input),
    resubmit: (id, input) => request('POST', `${base}/requests/${id}/resubmit`, input),
    cancel: (id, reason) => request('POST', `${base}/requests/${id}/cancel`, { reason }),
    amend: (id, input) => request('PUT', `${base}/requests/${id}/amend`, input),
    cancelApproved: (id, reason) => request('POST', `${base}/requests/${id}/cancel-approved`, { reason }),
    confirmReturn: (id, returnedOn, note) => request('POST', `${base}/requests/${id}/return`, { returnedOn, note }),
    permissions: (q) => request('GET', `${base}/permissions${qs(q)}`),
    permission: (id) => request('GET', `${base}/permissions/${id}`),
    previewPermission: (input, requestId) => request('POST', `${base}/permissions/preview${qs({ requestId })}`, input),
    sendPermission: (input) => request('POST', `${base}/permissions`, input),
    resubmitPermission: (id, input) => request('POST', `${base}/permissions/${id}/resubmit`, input),
    amendPermission: (id, input) => request('PUT', `${base}/permissions/${id}/amend`, input),
    cancelApprovedPermission: (id, reason) => request('POST', `${base}/permissions/${id}/cancel-approved`, { reason }),
    employee: (id) => request('GET', `${base}/employees/${id}`),
    opening: (id, input) => request('POST', `${base}/employees/${id}/opening`, input),
    adjustment: (id, input) => request('POST', `${base}/employees/${id}/adjustment`, input),
    balances: (q) => request('GET', `${base}/balances${qs(q)}`),
    accrue: (period) => request('POST', `${base}/balances/accrual/${period}`),
    carryOver: (year) => request('POST', `${base}/balances/carry-over/${year}`),
    importOpenings: (file, typeId, asOf, apply) => {
        const form = new FormData();
        form.append('file', file);
        return upload(`${base}/balances/openings${qs({ typeId, asOf, apply })}`, form);
    },
    setup: () => request('GET', `${base}/setup`),
    saveSettings: (input) => request('PUT', `${base}/settings`, input),
    saveType: (id, input) => (id ? request('PUT', `${base}/types/${id}`, input) : request('POST', `${base}/types`, input)),
};
export const daysText = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
