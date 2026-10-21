import type { WorkerPeriod } from '../../api/workforce';
import type { WorkerDocument } from '../../api/workerFile';
import { documentOf, periodDays } from './WorkerActions';

const period = (p: Partial<WorkerPeriod>): WorkerPeriod => ({
  id: 'p', kind: 'Work', projectId: null, projectName: 'P', startsOn: '2026-09-13', endsOn: '2026-09-20', sourceType: 'empwork', sourceId: 'crm-1', sourceNo: 'SW1',
  closedByNo: null, packageNo: null, salary: null, serviceFee: null, housing: null, transport: null, totalPrice: null, isSpecialPrice: false, paySalary: false, fromOldSystem: true,
  ...p,
});
const doc = (d: Partial<WorkerDocument>): WorkerDocument => ({ type: 'delivery_order', id: 'd', no: 'DO-1', status: 'Delivered', crmId: null, workStartNo: null, reason: null, createdByName: null, createdAt: null, ...d });

describe('worker actions', () => {
  it('opens the document each period came from', () => {
    const docs = [doc({ id: 'do', workStartNo: 'SW1' }), doc({ type: 'return_order', id: 'ro', crmId: 'crm-h' })];

    // The old system's work start: its delivery line here; its housing order: the return order copied here.
    expect(documentOf(period({}), docs)?.id).toBe('do');
    expect(documentOf(period({ kind: 'Housing', sourceType: 'housing_order', sourceId: 'crm-h' }), docs)?.id).toBe('ro');
    // Recorded here: the period's own document, even when not in the list.
    expect(documentOf(period({ sourceType: 'transfer_order', sourceId: 'tr', sourceNo: 'TR-1', fromOldSystem: false }), docs)).toMatchObject({ id: 'tr', no: 'TR-1' });
    // Nothing to open: a vacation of the old system, a work start not copied here.
    expect(documentOf(period({ kind: 'Vacation', sourceType: 'vacation' }), docs)).toBeNull();
    expect(documentOf(period({ sourceNo: 'SW2' }), docs)).toBeNull();
  });

  it('counts the days of a period, its end being the first day after it', () => {
    expect(periodDays(period({ startsOn: '2026-09-13', endsOn: '2026-09-21' }))).toBe(8);
    expect(periodDays(period({ startsOn: '2026-09-13', endsOn: '2026-09-13' }))).toBe(0);
  });
});
