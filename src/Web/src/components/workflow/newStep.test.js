import { newStep } from './StepListEditor';
describe('process editor steps', () => {
    it('creates each step type with a unique id and the shape the server expects', () => {
        const steps = ['approval', 'condition', 'update', 'action', 'notify', 'stop'].map(newStep);
        expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
        expect(steps.map((s) => s.type)).toEqual(['approval', 'condition', 'update', 'action', 'notify', 'stop']);
        const approval = steps[0];
        if (approval?.type !== 'approval')
            throw new Error('expected an approval stage');
        expect(approval.rule).toBe('Any');
        expect(approval.allowReturn).toBe(true);
        expect(approval.onApprove).toEqual([]);
        const condition = steps[1];
        if (condition?.type !== 'condition')
            throw new Error('expected a condition');
        expect(condition.branches).toHaveLength(1);
        expect(condition.else).toEqual([]);
    });
});
