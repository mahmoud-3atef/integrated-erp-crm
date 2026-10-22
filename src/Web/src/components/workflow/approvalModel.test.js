import { alreadyProcessed, collapse, fit, newIdempotencyKey, pathNodes, stageNodes } from './approvalModel';
const stage = (stepId, state, round = 1) => ({
    stepId,
    nameAr: stepId,
    nameEn: stepId,
    state,
    assignees: ['أحمد'],
    decidedBy: state === 'Current' ? null : 'أحمد',
    onBehalfOf: null,
    openedAt: '2026-10-01T09:00:00Z',
    decidedAt: state === 'Current' ? null : '2026-10-02T09:00:00Z',
    comment: null,
    round,
    rule: 'Any',
});
const status = (stages, planned = [], state = 'InProgress') => ({
    instanceId: 'i',
    processNameAr: 'p',
    processNameEn: 'p',
    processVersion: 1,
    status: state,
    currentStepAr: null,
    currentStepEn: null,
    waitingFor: [],
    submittedBy: 'سارة',
    submittedAt: '2026-10-01T08:00:00Z',
    stages,
    history: [],
    planned: planned.map((id) => ({ stepId: id, nameAr: id, nameEn: id, rule: 'Any' })),
});
describe('approval stages', () => {
    it('lists the submission, the opened stages and the planned ones, numbered in order', () => {
        const nodes = stageNodes(status([stage('hr', 'Done'), stage('finance', 'Current')], ['board']));
        expect(nodes.map((n) => [n.state, n.order])).toEqual([
            ['Submitted', 1],
            ['Done', 2],
            ['Current', 3],
            ['Planned', 4],
        ]);
    });
    it('keeps earlier rounds for the drawer but not on the bar', () => {
        const nodes = stageNodes(status([stage('hr', 'Done'), stage('finance', 'Returned'), stage('hr', 'Current', 2)], ['finance']));
        expect(nodes.filter((n) => n.superseded).map((n) => n.key.split('-')[0])).toEqual(['hr', 'finance']);
        expect(pathNodes(nodes).map((n) => `${n.state}:${n.round}`)).toEqual(['Submitted:1', 'Current:2', 'Planned:1']);
    });
    it('shows no planned stages once the approval ended', () => {
        const nodes = stageNodes(status([stage('hr', 'Done')], ['board'], 'Approved'));
        expect(nodes.some((n) => n.state === 'Planned')).toBe(false);
    });
    it('folds distant stages into chips around the current stage', () => {
        const nodes = pathNodes(stageNodes(status([stage('a', 'Done'), stage('b', 'Done'), stage('c', 'Done'), stage('d', 'Done'), stage('e', 'Current')], ['f', 'g', 'h'])));
        const items = collapse(nodes, 1, 1);
        expect(items.map((i) => (i.kind === 'more' ? `+${i.nodes.length}` : i.node.state))).toEqual(['+4', 'Done', 'Current', 'Planned', '+2']);
    });
    it('never folds a single stage into a chip', () => {
        const nodes = pathNodes(stageNodes(status([stage('a', 'Done'), stage('b', 'Current')], ['c'])));
        expect(collapse(nodes, 1, 1).every((i) => i.kind === 'node')).toBe(true);
    });
    it('folds even a single stage when the bar is too narrow for it (the submission is a stage too)', () => {
        const nodes = pathNodes(stageNodes(status([stage('a', 'Done'), stage('b', 'Done'), stage('c', 'Current')], ['d'])));
        expect(fit(nodes, 0, true, true).map((i) => (i.kind === 'more' ? `+${i.nodes.length}` : i.node.state))).toEqual(['+3', 'Current', '+1']);
    });
    it('focuses on the last stage once the approval ended', () => {
        const nodes = pathNodes(stageNodes(status([stage('a', 'Done'), stage('b', 'Done'), stage('c', 'Done'), stage('d', 'Done')], [], 'Approved')));
        const items = collapse(nodes, 1, 1);
        expect(items[0]).toMatchObject({ kind: 'more', side: 'before' });
        expect(items.at(-1)).toMatchObject({ kind: 'node' });
    });
    it('makes a fresh key for each decision', () => {
        const key = newIdempotencyKey();
        expect(key).toMatch(/^[0-9a-f]{32}$/);
        expect(newIdempotencyKey()).not.toBe(key);
    });
    it('treats a closed or changed task as already processed', () => {
        expect(alreadyProcessed('errors.conflict_approval_task_closed')).toBe(true);
        expect(alreadyProcessed('errors.validation_approval_comment_required')).toBe(false);
    });
});
describe('fitting the bar', () => {
    const nodes = pathNodes(stageNodes(status([stage('a', 'Done'), stage('b', 'Done'), stage('c', 'Done'), stage('d', 'Current')], ['e', 'f'])));
    it('shows every stage when there is room', () => {
        expect(fit(nodes, 3000, true).every((i) => i.kind === 'node')).toBe(true);
    });
    it('folds the distant stages first as the space shrinks, always keeping the current one', () => {
        const narrow = fit(nodes, 900, true);
        expect(narrow.some((i) => i.kind === 'more')).toBe(true);
        expect(narrow.some((i) => i.kind === 'node' && i.node.state === 'Current')).toBe(true);
        const tiny = fit(nodes, 100, true);
        expect(tiny.filter((i) => i.kind === 'node').map((i) => (i.kind === 'node' ? i.node.state : ''))).toEqual(['Current']);
    });
});
