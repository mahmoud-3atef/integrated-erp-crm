// The staff payroll runs (src/Modules/Payroll/.../Api/StaffPayrollEndpoints.cs).
import { request } from './auth';
export const staffNotes = ['joined', 'left', 'no_iban', 'no_attendance', 'salary_changed', 'deferred', 'above_cap', 'no_gosi_rate', 'net_not_positive'];
export const gosiCategories = ['SaudiLegacy', 'SaudiNew', 'NonSaudi'];
const base = '/api/v1/payroll/staff';
const query = (q) => {
    const p = new URLSearchParams();
    if (q.search?.trim())
        p.set('search', q.search.trim());
    if (q.department)
        p.set('department', q.department);
    if (q.note)
        p.set('note', q.note);
    if (q.sort)
        p.set('sort', q.sort);
    if (q.desc)
        p.set('desc', 'true');
    if (q.page)
        p.set('page', String(q.page));
    if (q.pageSize)
        p.set('pageSize', String(q.pageSize));
    return p.toString();
};
export const staffPayrollApi = {
    checks: (legalEntityId, period) => request('GET', `${base}/checks?legalEntityId=${legalEntityId}&period=${period}`),
    runs: (q = {}) => {
        const p = new URLSearchParams();
        if (q.legalEntityId)
            p.set('legalEntityId', q.legalEntityId);
        if (q.tab)
            p.set('tab', q.tab);
        return request('GET', `${base}/runs?${p.toString()}`);
    },
    create: (input) => request('POST', `${base}/runs`, input),
    get: (id) => request('GET', `${base}/runs/${id}`),
    lines: (id, q) => request('GET', `${base}/runs/${id}/lines?${query(q)}`),
    line: (id, lineId) => request('GET', `${base}/runs/${id}/lines/${lineId}`),
    deferred: (id) => request('GET', `${base}/runs/${id}/deferred`),
    excelUrl: (id, q) => `${base}/runs/${id}/excel?${query({ ...q, page: undefined, pageSize: undefined })}`,
    recalculate: (id) => request('POST', `${base}/runs/${id}/recalculate`),
    submit: (id) => request('POST', `${base}/runs/${id}/submit`),
    remove: (id) => request('DELETE', `${base}/runs/${id}`),
    addAdjustment: (id, input) => request('POST', `${base}/runs/${id}/adjustments`, input),
    removeAdjustment: (id, adjustmentId) => request('DELETE', `${base}/runs/${id}/adjustments/${adjustmentId}`),
    employeeLines: (employeeId) => request('GET', `${base}/employees/${employeeId}/lines`),
    settings: () => request('GET', `${base}/settings`),
    saveSettings: (input) => request('PUT', `${base}/settings`, input),
    gosiRates: () => request('GET', `${base}/gosi-rates`),
    saveGosiRate: (id, input) => (id ? request('PUT', `${base}/gosi-rates/${id}`, input) : request('POST', `${base}/gosi-rates`, input)),
};
