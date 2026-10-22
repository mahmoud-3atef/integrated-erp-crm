// The staff's advances, penalties and other deductions (src/Modules/Deductions/.../Api/DeductionEndpoints.cs).
import { request } from './auth';
export const penaltyEffects = ['Warning', 'DeductDays', 'DeductAmount', 'Suspension'];
const base = '/api/v1/deductions';
const qs = (q) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q))
        if (v)
            p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : '';
};
export const deductionsApi = {
    advanceKpis: () => request('GET', `${base}/advances/kpis`),
    advances: (q) => request('GET', `${base}/advances${qs(q)}`),
    advance: (id) => request('GET', `${base}/advances/${id}`),
    previewAdvance: (input, advanceId) => request('POST', `${base}/advances/preview${qs({ advanceId })}`, input),
    sendAdvance: (input) => request('POST', `${base}/advances`, input),
    resubmitAdvance: (id, input) => request('POST', `${base}/advances/${id}/resubmit`, input),
    amendAdvance: (id, input) => request('PUT', `${base}/advances/${id}/amend`, input),
    cancelApprovedAdvance: (id, note) => request('POST', `${base}/advances/${id}/cancel-approved`, { note }),
    disburse: (id, input) => request('POST', `${base}/advances/${id}/disburse`, input),
    settle: (id, note) => request('POST', `${base}/advances/${id}/settle`, { note }),
    postpone: (id, installmentId, note) => request('POST', `${base}/advances/${id}/installments/${installmentId}/postpone`, { note }),
    penalties: (q) => request('GET', `${base}/penalties${qs(q)}`),
    penalty: (id) => request('GET', `${base}/penalties/${id}`),
    previewPenalty: (input, penaltyId) => request('POST', `${base}/penalties/preview${qs({ penaltyId })}`, input),
    sendPenalty: (input) => request('POST', `${base}/penalties`, input),
    resubmitPenalty: (id, input) => request('POST', `${base}/penalties/${id}/resubmit`, input),
    amendPenalty: (id, input) => request('PUT', `${base}/penalties/${id}/amend`, input),
    cancelApprovedPenalty: (id, note) => request('POST', `${base}/penalties/${id}/cancel-approved`, { note }),
    employee: (id) => request('GET', `${base}/employees/${id}`),
    setup: () => request('GET', `${base}/setup`),
    saveSettings: (input) => request('PUT', `${base}/settings`, input),
    saveType: (id, input) => (id ? request('PUT', `${base}/penalty-types/${id}`, input) : request('POST', `${base}/penalty-types`, input)),
};
/** Riyals with two decimals at most, in Latin digits. */
export const sar = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
