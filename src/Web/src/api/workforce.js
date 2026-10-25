// Workers and staff (src/Modules/Workforce/.../Api/WorkforceEndpoints.cs). A worker's data and salary can be changed by
// those allowed to (2026-10-25); in the parallel phase the old system's next change of the record brings its values back.
import { request, upload } from './auth';
const base = '/api/v1/workforce';
/** Workers and company staff are separate lists (and permissions) on the server. */
export const kindPath = (kind) => (kind === 'Staff' ? 'staff' : 'workers');
export const workforceApi = {
    list: (kind, q) => {
        const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
        if (q.search)
            params.set('search', q.search);
        if (q.placement)
            params.set('placement', q.placement);
        if (q.sort)
            params.set('sort', q.sort);
        if (q.desc)
            params.set('desc', 'true');
        return request('GET', `${base}/${kindPath(kind)}?${params.toString()}`);
    },
    get: (kind, id) => request('GET', `${base}/${kindPath(kind)}/${id}`),
    invoiceCheck: (q) => {
        const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
        if (q.month)
            params.set('month', q.month);
        if (q.result)
            params.set('result', q.result);
        if (q.search)
            params.set('search', q.search);
        return request('GET', `${base}/invoice-check?${params.toString()}`);
    },
    historyIssues: (q) => {
        const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
        if (q.code)
            params.set('code', q.code);
        if (q.search)
            params.set('search', q.search);
        if (q.workerId)
            params.set('workerId', q.workerId);
        return request('GET', `${base}/history/issues?${params.toString()}`);
    },
    periods: (kind, id) => request('GET', `${base}/${kindPath(kind)}/${id}/periods`),
    newOptions: () => request('GET', `${base}/workers/new/options`),
    newTemplateUrl: `${base}/workers/new/template`,
    readNew: (file) => {
        const form = new FormData();
        form.append('file', file);
        return upload(`${base}/workers/new/read`, form);
    },
    checkNew: (rows) => request('POST', `${base}/workers/new/check`, rows),
    createNew: (rows) => request('POST', `${base}/workers/new`, rows),
    editOptions: () => request('GET', `${base}/edit-options`),
    saveData: (id, input) => request('PUT', `${base}/workers/${id}/data`, input),
    saveSalary: (id, input) => request('PUT', `${base}/workers/${id}/salary`, input),
    requestSalaryChange: (id, input) => request('POST', `${base}/workers/${id}/salary-changes`, input),
    salaryChanges: (id) => request('GET', `${base}/workers/${id}/salary-changes`),
    salaryChange: (id) => request('GET', `${base}/salary-changes/${id}`),
};
export const historyIssueCodes = ['SameDay', 'Gap', 'EndBeforeStart', 'EndAfterNext', 'WorkWithoutPrice', 'ReturnWithoutWork', 'OnJobWithoutWorkStart', 'StatusMismatch', 'ProjectMismatch'];
export const invoiceCheckResults = ['Match', 'DaysDiff', 'PriceDiff', 'DaysAndPriceDiff', 'NotInLedger', 'NotInvoiced', 'ProjectNotInvoiced'];
