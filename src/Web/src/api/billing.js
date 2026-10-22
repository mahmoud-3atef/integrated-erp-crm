// Monthly project timesheets (src/Modules/Billing/.../Api/TimesheetEndpoints.cs).
import { request } from './auth';
export const adjustmentTypes = ['Absence', 'Overtime', 'OvertimeAmount', 'ClientAddition', 'ClientDeduction', 'CustomerLoan', 'FeeDays', 'OtherCost', 'OtherDeduction', 'InternalAddition', 'InternalDeduction'];
const base = '/api/v1/billing';
export const billingApi = {
    month: (month) => request('GET', `${base}/timesheets?month=${month}`),
    get: (id) => request('GET', `${base}/timesheets/${id}`),
    generate: (projectId, month) => request('POST', `${base}/timesheets/generate`, { projectId, month }),
    adjust: (id, input) => request('POST', `${base}/timesheets/${id}/adjustments`, input),
    previewVariables: (id, totals) => request('POST', `${base}/timesheets/${id}/variables/preview`, totals),
    saveVariables: (id, totals) => request('POST', `${base}/timesheets/${id}/variables`, totals),
    removeAdjustment: (id, adjustmentId) => request('DELETE', `${base}/timesheets/${id}/adjustments/${adjustmentId}`),
    submit: (id) => request('POST', `${base}/timesheets/${id}/submit`),
    settings: (projectId) => request('GET', `${base}/projects/${projectId}/settings`),
    saveSettings: (projectId, input) => request('PUT', `${base}/projects/${projectId}/settings`, input),
};
export const noteComponents = ['Salary', 'ServiceFee', 'Housing', 'Transport', 'Overtime', 'ClientAddition', 'OtherCost', 'Gosi'];
const invoices = `${base}/invoices`;
export const invoiceApi = {
    list: (filter) => {
        const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
        return request('GET', `${invoices}?${q.toString()}`);
    },
    get: (id) => request('GET', `${invoices}/${id}`),
    attachmentUrl: (id) => `${invoices}/${id}/attachment`,
    fromTimesheet: (timesheetId) => request('POST', `${base}/timesheets/${timesheetId}/invoice`),
    edit: (id, input) => request('PUT', `${invoices}/${id}`, input),
    remove: (id) => request('DELETE', `${invoices}/${id}`),
    note: (id, input) => request('POST', `${invoices}/${id}/notes`, input),
    submit: (id) => request('POST', `${invoices}/${id}/submit`),
};
export const paymentMethods = ['BankTransfer', 'Cash', 'Card'];
const qs = (filter) => new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();
export const receivablesApi = {
    receipts: (filter) => request('GET', `${base}/receipts?${qs(filter)}`),
    receipt: (id) => request('GET', `${base}/receipts/${id}`),
    create: (input) => request('POST', `${base}/receipts`, input),
    update: (id, input) => request('PUT', `${base}/receipts/${id}`, input),
    remove: (id) => request('DELETE', `${base}/receipts/${id}`),
    submit: (id) => request('POST', `${base}/receipts/${id}/submit`),
    allocate: (id, allocations) => request('POST', `${base}/receipts/${id}/allocate`, { allocations }),
    projects: () => request('GET', `${base}/receipt-projects`),
    open: (projectId, exceptReceipt) => request('GET', `${base}/projects/${projectId}/open-items?${qs({ exceptReceipt })}`),
    aging: (asOf) => request('GET', `${base}/aging?${qs({ asOf })}`),
    statement: (projectCrmId, from, to) => request('GET', `${base}/statements/${projectCrmId}?${qs({ from, to })}`),
    bankAccounts: () => request('GET', `${base}/bank-accounts`),
    addBankAccount: (input) => request('POST', `${base}/bank-accounts`, input),
    saveBankAccount: (id, input) => request('PUT', `${base}/bank-accounts/${id}`, input),
};
