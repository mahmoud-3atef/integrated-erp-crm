// The company's staff and organisation (src/Modules/Staff/.../Api/StaffEndpoints.cs).
import { request, upload } from './auth';
export const staffStatuses = ['Active', 'Probation', 'Suspended', 'Left'];
export const actionKinds = ['Promotion', 'Transfer', 'SalaryChange', 'Acting', 'ConfirmProbation', 'ExtendProbation', 'EndProbation', 'RenewContract', 'NotRenew'];
const base = '/api/v1/staff';
const qs = (q) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== false && v !== null)
            p.set(k, String(v));
    });
    return p.toString();
};
export const staffApi = {
    employees: (q) => request('GET', `${base}/employees?${qs(q)}`),
    kpis: () => request('GET', `${base}/employees/kpis`),
    userLinks: () => request('GET', `${base}/user-links`),
    linkUser: (userId, employeeId) => request('PUT', `${base}/user-links/${userId}`, { employeeId }),
    pick: (search) => request('GET', `${base}/employees/pick?search=${encodeURIComponent(search)}`),
    profile: (id) => request('GET', `${base}/employees/${id}`),
    history: (id) => request('GET', `${base}/employees/${id}/history`),
    hire: (input) => request('POST', `${base}/employees`, input),
    importOld: () => request('POST', `${base}/employees/import`),
    setPersonal: (id, input) => request('PUT', `${base}/employees/${id}/personal`, input),
    setJob: (id, input) => request('PUT', `${base}/employees/${id}/job`, input),
    setContract: (id, input) => request('PUT', `${base}/employees/${id}/contract`, input),
    changeSalary: (id, input) => request('POST', `${base}/employees/${id}/salary`, input),
    setPayDetails: (id, input) => request('PUT', `${base}/employees/${id}/pay-details`, input),
    updateTemplateUrl: (lang) => `${base}/employees/update-template?lang=${lang}`,
    bulkUpdate: (file, apply) => {
        const form = new FormData();
        form.append('file', file);
        return upload(`${base}/employees/bulk-update?apply=${apply}`, form);
    },
    nationalities: () => request('GET', `${base}/nationalities`),
    structure: () => request('GET', `${base}/structure`),
    contracts: (id) => request('GET', `${base}/employees/${id}/contracts`),
    requestAction: (id, input) => request('POST', `${base}/employees/${id}/actions`, input),
    actions: (q) => request('GET', `${base}/actions?${new URLSearchParams(Object.entries(q).filter(([, v]) => v)).toString()}`),
    action: (id) => request('GET', `${base}/actions/${id}`),
    resubmit: (id) => request('POST', `${base}/actions/${id}/resubmit`),
    amendAction: (id, input) => request('PUT', `${base}/actions/${id}/amend`, input),
    cancelApprovedAction: (id, reason) => request('POST', `${base}/actions/${id}/cancel-approved`, { reason }),
    catalog: () => request('GET', `${base}/catalog`),
    saveDepartment: (id, input) => request(id ? 'PUT' : 'POST', id ? `${base}/departments/${id}` : `${base}/departments`, input),
    deleteDepartment: (id) => request('DELETE', `${base}/departments/${id}`),
    savePosition: (id, input) => request(id ? 'PUT' : 'POST', id ? `${base}/positions/${id}` : `${base}/positions`, input),
    deletePosition: (id) => request('DELETE', `${base}/positions/${id}`),
    saveJobTitle: (id, input) => request(id ? 'PUT' : 'POST', id ? `${base}/job-titles/${id}` : `${base}/job-titles`, input),
    saveGrade: (id, input) => request(id ? 'PUT' : 'POST', id ? `${base}/grades/${id}` : `${base}/grades`, input),
};
