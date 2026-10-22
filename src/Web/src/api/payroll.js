// The company workers' payroll runs (src/Modules/Payroll/.../Api/PayrollEndpoints.cs).
import { request } from './auth';
export const payrollNotes = ['absence', 'joined', 'left', 'multi_project', 'salary_split', 'late', 'net_not_positive'];
const base = '/api/v1/payroll';
const query = (q) => {
    const p = new URLSearchParams();
    if (q.search?.trim())
        p.set('search', q.search.trim());
    if (q.note)
        p.set('note', q.note);
    if (q.project)
        p.set('project', q.project);
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
export const payrollApi = {
    runs: (legalEntityId) => request('GET', `${base}/runs${legalEntityId ? `?legalEntityId=${legalEntityId}` : ''}`),
    nextPeriod: (legalEntityId) => request('GET', `${base}/runs/next-period?legalEntityId=${legalEntityId}`),
    create: (input) => request('POST', `${base}/runs`, input),
    get: (id) => request('GET', `${base}/runs/${id}`),
    lines: (id, q) => request('GET', `${base}/runs/${id}/lines?${query(q)}`),
    line: (id, lineId) => request('GET', `${base}/runs/${id}/lines/${lineId}`),
    exclusions: (id) => request('GET', `${base}/runs/${id}/exclusions`),
    excelUrl: (id, q) => `${base}/runs/${id}/excel?${query({ ...q, page: undefined, pageSize: undefined })}`,
    recalculate: (id) => request('POST', `${base}/runs/${id}/recalculate`),
    submit: (id) => request('POST', `${base}/runs/${id}/submit`),
    remove: (id) => request('DELETE', `${base}/runs/${id}`),
    sponsors: () => request('GET', `${base}/sponsors`),
    linkSponsors: (links) => request('PUT', `${base}/sponsors`, links),
};
