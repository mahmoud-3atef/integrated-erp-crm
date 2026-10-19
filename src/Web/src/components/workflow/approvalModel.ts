import type { ApprovalStage, ApprovalStatus, PlannedStage } from '../../api/workflow';

/** How one stage reads on the bar and in the drawer (never by colour alone: each has its own icon and label). */
export type StageState = 'Submitted' | 'Done' | 'Current' | 'Rejected' | 'Returned' | 'Canceled' | 'Planned';

export interface StageNode {
  key: string;
  /** 1-based position on the path shown (the submission is 1). */
  order: number;
  state: StageState;
  nameAr: string;
  nameEn: string;
  /** Who it is with (open) or was with; empty for a planned stage (not known until it opens). */
  assignees: string[];
  decidedBy: string | null;
  onBehalfOf: string | null;
  openedAt: string | null;
  decidedAt: string | null;
  comment: string | null;
  round: number;
  rule: 'Any' | 'All';
  /** An earlier round of the path, replaced by a later opening (after a return): kept for the drawer only. */
  superseded: boolean;
}

/** One item on the bar: a stage, or a chip standing for several stages folded away. */
export type BarItem = { kind: 'node'; node: StageNode } | { kind: 'more'; side: 'before' | 'after'; nodes: StageNode[] };

const stageState = (stage: ApprovalStage): StageState => stage.state;

/**
 * Every stage of the approval in order: the submission, each opening of a stage (earlier rounds marked superseded),
 * then the stages still planned. A stage is superseded when it opens again later, and a returned stage is superseded
 * once the path went on after it.
 */
export function stageNodes(status: ApprovalStatus): StageNode[] {
  const opened = status.stages.map((stage, index) => {
    const reopened = status.stages.slice(index + 1).some((later) => later.stepId === stage.stepId);
    const returnedThenMoved = stage.state === 'Returned' && index < status.stages.length - 1;
    return { stage, superseded: reopened || returnedThenMoved };
  });
  const planned: PlannedStage[] = status.status === 'InProgress' ? (status.planned ?? []) : [];

  const nodes: Omit<StageNode, 'order'>[] = [
    {
      key: 'submitted',
      state: 'Submitted',
      nameAr: '',
      nameEn: '',
      assignees: [status.submittedBy],
      decidedBy: status.submittedBy,
      onBehalfOf: null,
      openedAt: status.submittedAt,
      decidedAt: status.submittedAt,
      comment: null,
      round: 1,
      rule: 'Any',
      superseded: false,
    },
    ...opened.map(({ stage, superseded }, index) => ({
      key: `${stage.stepId}-${stage.round ?? 1}-${index}`,
      state: stageState(stage),
      nameAr: stage.nameAr,
      nameEn: stage.nameEn,
      assignees: stage.assignees,
      decidedBy: stage.decidedBy,
      onBehalfOf: stage.onBehalfOf,
      openedAt: stage.openedAt,
      decidedAt: stage.decidedAt,
      comment: stage.comment,
      round: stage.round ?? 1,
      rule: stage.rule ?? 'Any',
      superseded,
    })),
    ...planned.map((stage, index) => ({
      key: `planned-${stage.stepId}-${index}`,
      state: 'Planned' as const,
      nameAr: stage.nameAr,
      nameEn: stage.nameEn,
      assignees: [],
      decidedBy: null,
      onBehalfOf: null,
      openedAt: null,
      decidedAt: null,
      comment: null,
      round: 1,
      rule: stage.rule,
      superseded: false,
    })),
  ];

  // The path as it stands: earlier rounds are left out of the numbering.
  let order = 0;
  return nodes.map((node) => ({ ...node, order: node.superseded ? 0 : ++order }));
}

/** The stages the bar shows: the current path, without earlier rounds. */
export const pathNodes = (nodes: StageNode[]) => nodes.filter((n) => !n.superseded);

/**
 * Folds the stages far from the focus (the current stage, or the last one when the approval ended) into chips such
 * as «+3 مراحل», keeping <paramref name="before"/> stages before it and <paramref name="after"/> after it. A chip
 * never stands for a single stage (that stage is shown instead), unless <paramref name="single"/>: the last resort of a
 * bar too narrow for even that.
 */
export function collapse(nodes: StageNode[], before: number, after: number, single = false): BarItem[] {
  const current = nodes.findIndex((n) => n.state === 'Current');
  const focus = current >= 0 ? current : nodes.length - 1;
  let from = Math.max(0, focus - before);
  let to = Math.min(nodes.length - 1, focus + after);
  if (from === 1 && !single) {
    from = 0;
  }
  if (to === nodes.length - 2 && !single) {
    to = nodes.length - 1;
  }

  const items: BarItem[] = [];
  if (from > 0) {
    items.push({ kind: 'more', side: 'before', nodes: nodes.slice(0, from) });
  }
  nodes.slice(from, to + 1).forEach((node) => items.push({ kind: 'node', node }));
  if (to < nodes.length - 1) {
    items.push({ kind: 'more', side: 'after', nodes: nodes.slice(to + 1) });
  }
  return items;
}

/** A unique key for one decision, also where crypto.randomUUID is missing (plain http on the company network). */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** API failures meaning the task was already decided (by this user elsewhere, or by another approver). */
export const alreadyProcessed = (errorKey: string) =>
  ['errors.conflict_approval_task_closed', 'errors.conflict_approval_changed', 'errors.conflict_approval_finished', 'errors.not_found_approval_task'].includes(errorKey);

/** Rough widths (px) of the bar's parts, to fold just enough stages to fit one row. */
const widths = { node: 205, planned: 150, current: 300, chip: 100, connector: 32, actions: 300 };

const estimate = (items: BarItem[], withActions: boolean) =>
  items.reduce((sum, item) => sum + (item.kind === 'more' ? widths.chip : item.node.state === 'Current' ? widths.current : item.node.state === 'Planned' ? widths.planned : widths.node), 0) +
  Math.max(0, items.length - 1) * widths.connector +
  (withActions ? widths.actions : 0);

/**
 * The widest fold that fits the space the stages have: as many stages around the focus as fit, the farthest folded
 * first (spec 16 §3.1: collapse distant stages first). At least the focus itself is shown.
 */
export function fit(nodes: StageNode[], space: number, withActions: boolean, single = false): BarItem[] {
  const folds: [number, number][] = [
    [nodes.length, nodes.length],
    [3, 3],
    [2, 2],
    [2, 1],
    [1, 1],
    [1, 0],
  ];
  for (const [before, after] of folds) {
    const items = collapse(nodes, before, after);
    if (estimate(items, withActions) <= space) {
      return items;
    }
  }
  return collapse(nodes, 0, 0, single);
}
