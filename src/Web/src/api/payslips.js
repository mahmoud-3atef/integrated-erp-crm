// Payslips (4.12) of a staff run or a workers' run (src/Modules/Payroll/.../Application/Payslips.cs).
import { request } from './auth';
export const payslipMax = 300;
/** The query keeps the run grid's filters (search, department or project, note) or names one line. */
export function payslipsApi(kind, runId, query) {
    const base = kind === 'staff' ? `/api/v1/payroll/staff/runs/${runId}` : `/api/v1/payroll/runs/${runId}`;
    const q = query.toString();
    return request('GET', `${base}/payslips${q ? `?${q}` : ''}`);
}
/** The print page's path for a run, a line, or the grid's current filters. */
export function payslipsPath(kind, runId, params = {}) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params))
        if (v)
            p.set(k, v);
    const q = p.toString();
    return `/payroll/${kind === 'staff' ? 'staff' : 'runs'}/${runId}/payslips${q ? `?${q}` : ''}`;
}
/** Emailing a staff run's payslips (4.12b), with the run grid's filters. */
export const payslipEmailApi = {
    preview: (runId, scope) => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(scope))
            if (v)
                p.set(k, v);
        return request('GET', `/api/v1/payroll/staff/runs/${runId}/payslips/email?${p.toString()}`);
    },
    send: (runId, scope, resend) => request('POST', `/api/v1/payroll/staff/runs/${runId}/payslips/email`, { search: scope.search || null, department: scope.department || null, note: scope.note || null, line: null, resend }),
    status: (runId) => request('GET', `/api/v1/payroll/staff/runs/${runId}/payslips/emails`),
};
