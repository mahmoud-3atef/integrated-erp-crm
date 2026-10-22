// The staff's attendance (src/Modules/Attendance/.../Api/AttendanceEndpoints.cs).
import { request, upload } from './auth';
export const rowStates = ['Complete', 'Exceptions', 'NoPunches'];
export const manualStatuses = ['Present', 'Excused', 'Leave', 'Mission', 'Absent'];
export const fileFields = ['key', 'name', 'date', 'status', 'in', 'out', 'late', 'early', 'permission'];
export const matchBys = ['IdNumber', 'EmployeeNo', 'BadgeNo'];
export const minutesSources = ['Company', 'Device', 'Shift'];
const base = '/api/v1/attendance';
const qs = (q) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q))
        if (v !== undefined && v !== null && v !== '')
            p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
};
function fileForm(file, mapping) {
    const form = new FormData();
    form.append('file', file);
    if (mapping)
        form.append('mapping', JSON.stringify(mapping));
    return form;
}
export const attendanceApi = {
    month: (period, legalEntityId) => request('GET', `${base}/months/${period}${qs({ legalEntityId })}`),
    employees: (period, q) => request('GET', `${base}/months/${period}/employees${qs(q)}`),
    exceptions: (period, legalEntityId) => request('GET', `${base}/months/${period}/exceptions${qs({ legalEntityId })}`),
    employee: (period, id) => request('GET', `${base}/months/${period}/employees/${id}`),
    correct: (id, date, input) => request('PUT', `${base}/employees/${id}/days/${date}`, input),
    saveEmployee: (id, input) => request('PUT', `${base}/employees/${id}/setting`, input),
    imports: () => request('GET', `${base}/imports`),
    preview: (file, mapping) => upload(`${base}/imports/preview`, fileForm(file, mapping)),
    apply: (file, mapping) => upload(`${base}/imports`, fileForm(file, mapping)),
    setup: (year) => request('GET', `${base}/setup${qs({ year })}`),
    saveSettings: (input) => request('PUT', `${base}/settings`, input),
    saveShift: (id, input) => (id ? request('PUT', `${base}/shifts/${id}`, input) : request('POST', `${base}/shifts`, input)),
    deleteShift: (id) => request('DELETE', `${base}/shifts/${id}`),
    assign: (input) => request('POST', `${base}/assignments`, input),
    unassign: (id) => request('DELETE', `${base}/assignments/${id}`),
    saveHoliday: (id, input) => id ? request('PUT', `${base}/holidays/${id}`, input) : request('POST', `${base}/holidays`, input),
    deleteHoliday: (id) => request('DELETE', `${base}/holidays/${id}`),
    monthPeriod: (id) => request('GET', `${base}/months/by-id/${id}`),
    submitMonth: (period) => request('POST', `${base}/months/${period}/submit`),
    reopenMonth: (period, reason) => request('POST', `${base}/months/${period}/reopen`, { reason }),
    overtimeOf: (period) => request('GET', `${base}/months/${period}/overtime`),
    overtime: (id) => request('GET', `${base}/overtime/${id}`),
    requestOvertime: (input) => request('POST', `${base}/overtime`, input),
    resubmitOvertime: (id, input) => request('POST', `${base}/overtime/${id}/resubmit`, input),
    amendOvertime: (id, input) => request('PUT', `${base}/overtime/${id}/amend`, input),
    cancelApprovedOvertime: (id, reason) => request('POST', `${base}/overtime/${id}/cancel-approved`, { reason }),
};
/** "2026-09" for a date; the month before/after. */
export const periodOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const shiftPeriod = (period, by) => {
    const [y = 2026, m = 1] = period.split('-').map(Number);
    return periodOf(new Date(y, m - 1 + by, 1));
};
/** Minutes as h:mm (90 → 1:30). */
export const hm = (minutes) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
/** "09:00:00" → "09:00". */
export const hhmm = (t) => (t ? t.slice(0, 5) : null);
