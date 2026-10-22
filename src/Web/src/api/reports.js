// The executive report (src/Modules/Reports/.../Api/ReportsEndpoints.cs).
import { request } from './auth';
const base = '/api/v1/reports/executive';
function query(from, to, extra = {}) {
    const p = new URLSearchParams({ from, to });
    for (const [k, v] of Object.entries(extra))
        if (v !== null && v !== undefined && v !== '')
            p.set(k, String(v));
    return p.toString();
}
export const reportsApi = {
    overview: (from, to) => request('GET', `${base}/overview?${query(from, to)}`),
    finance: (from, to, project) => request('GET', `${base}/finance?${query(from, to, { project })}`),
    invoices: (from, to, drill) => request('GET', `${base}/invoices?${query(from, to, { ...drill })}`),
    moves: (from, to, drill) => request('GET', `${base}/moves?${query(from, to, { ...drill })}`),
    invoicesExcel: (from, to, drill) => `${base}/invoices?${query(from, to, { ...drill, excel: true })}`,
    movesExcel: (from, to, drill) => `${base}/moves?${query(from, to, { ...drill, excel: true })}`,
};
// The workforce movement report (the same endpoints file, /api/v1/reports/movement).
const movementBase = '/api/v1/reports/movement';
export const movementApi = {
    overview: (from, to) => request('GET', `${movementBase}?${query(from, to)}`),
    list: (list, from, to, drill) => request('GET', `${movementBase}/${list}?${query(from, to, { ...drill })}`),
    excel: (list, from, to, drill) => `${movementBase}/${list}?${query(from, to, { ...drill, excel: true })}`,
};
// The CEO report (/api/v1/reports/ceo): an invoiced month's profit and loss.
const ceoBase = '/api/v1/reports/ceo';
function ceoQuery(month, extra = {}) {
    const p = new URLSearchParams();
    if (month)
        p.set('month', month);
    for (const [k, v] of Object.entries(extra))
        if (v !== null && v !== undefined && v !== '' && v !== false)
            p.set(k, String(v));
    return p.toString();
}
export const ceoApi = {
    overview: (month) => request('GET', `${ceoBase}?${ceoQuery(month)}`),
    profit: (month) => request('GET', `${ceoBase}/profit?${ceoQuery(month)}`),
    workers: (month, q) => request('GET', `${ceoBase}/workers?${ceoQuery(month, { ...q })}`),
    workersExcel: (month, q) => `${ceoBase}/workers?${ceoQuery(month, { ...q, excel: true })}`,
};
