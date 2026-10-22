// Approval processes, the engine's inbox and requests, and internal requests (src/Modules/Workflow/.../Api/WorkflowEndpoints.cs).
import { request } from './auth';

// ---------------------------------------------------------------- Screens and fields

export type FieldType = 'Text' | 'Number' | 'Money' | 'Date' | 'Boolean' | 'Choice' | 'User' | 'LegalEntity';

export interface FieldOption {
  value: string;
  nameAr: string;
  nameEn: string;
  /** Whether a process may set this value (others are for display and conditions). */
  settable: boolean;
}

export interface RecordField {
  key: string;
  nameAr: string;
  nameEn: string;
  type: FieldType;
  updatable: boolean;
  options: FieldOption[] | null;
}

/** A table related to the screen's record: its fields can be tested by conditions, and the updatable ones changed. */
export interface RecordRelation {
  key: string;
  nameAr: string;
  nameEn: string;
  fields: RecordField[];
}

/** A named piece of the module's own work a process runs at its place («تنفيذ إجراء»); a required one must be in the process. */
export interface RecordAction {
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  required: boolean;
}

export interface Screen {
  code: string;
  nameAr: string;
  nameEn: string;
  linkTemplate: string;
  fields: RecordField[];
  relations: RecordRelation[] | null;
  actions?: RecordAction[] | null;
}

// ---------------------------------------------------------------- Process definition (same JSON as the server)

export type Operator = 'Equals' | 'NotEquals' | 'GreaterThan' | 'GreaterOrEqual' | 'LessThan' | 'LessOrEqual' | 'In' | 'IsEmpty' | 'IsNotEmpty';

export interface ConditionRule {
  fieldKey: string;
  operator: Operator;
  value?: string | null;
  values?: string[] | null;
  /** The related table the field belongs to (its key); none: the record itself. */
  relation?: string | null;
  /** Dynamic value: compare with this field (of the same type) instead of a fixed value… */
  valueFromField?: string | null;
  /** …of this related table (none: the record itself). */
  valueFromRelation?: string | null;
}

export interface ConditionGroup {
  matchAll: boolean;
  rules: ConditionRule[];
}

export type AssigneeKind = 'User' | 'Role' | 'UserField' | 'Submitter' | 'Permission';
export type RecipientKind = 'Submitter' | 'User' | 'Role' | 'UserField';

export interface Assignee {
  kind: AssigneeKind;
  userId?: string | null;
  roleId?: string | null;
  fieldKey?: string | null;
  permission?: string | null;
}

export interface Recipient {
  kind: RecipientKind;
  userId?: string | null;
  roleId?: string | null;
  fieldKey?: string | null;
}

export interface ApprovalStep {
  type: 'approval';
  id: string;
  label?: string | null;
  nameAr: string;
  nameEn: string;
  assignees: Assignee[];
  rule: 'Any' | 'All';
  dueHours?: number | null;
  requiredFields: string[];
  allowReturn: boolean;
  allowDelegate: boolean;
  onApprove: Step[];
  onReject: Step[];
  onReturn: Step[];
}

export interface ConditionStep {
  type: 'condition';
  id: string;
  label?: string | null;
  branches: { condition: ConditionGroup; steps: Step[] }[];
  else: Step[];
}

export interface UpdateStep {
  type: 'update';
  id: string;
  label?: string | null;
  /** Null: the record itself; otherwise the key of a related table. */
  target?: string | null;
  changes: { fieldKey: string; value?: string | null; fromField?: string | null }[];
}

export interface ActionStep {
  type: 'action';
  id: string;
  label?: string | null;
  /** The key of one of the screen's actions. */
  action: string;
}

export interface NotifyStep {
  type: 'notify';
  id: string;
  label?: string | null;
  to: Recipient[];
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
}

export interface StopStep {
  type: 'stop';
  id: string;
  label?: string | null;
  outcome: 'Approved' | 'Rejected' | 'Canceled';
}

export type Step = ApprovalStep | ConditionStep | UpdateStep | ActionStep | NotifyStep | StopStep;

export interface ProcessDefinition {
  startCondition: ConditionGroup | null;
  steps: Step[];
}

export interface ProcessSummary {
  id: string;
  screen: string;
  screenNameAr: string;
  screenNameEn: string;
  nameAr: string;
  nameEn: string;
  priority: number;
  isActive: boolean;
  currentVersion: number;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
}

export interface ProcessVersion {
  version: number;
  publishedBy: string;
  publishedAt: string;
  definition: ProcessDefinition;
}

export interface ProcessDetail {
  process: ProcessSummary;
  draft: ProcessDefinition;
  versions: ProcessVersion[];
}

export interface RoleOption {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  isAdministrator: boolean;
}

export interface MemberOption {
  userAccountId: string;
  displayName: string;
  userName: string | null;
}

export interface PermissionOption {
  code: string;
  groupAr: string;
  groupEn: string;
  nameAr: string;
  nameEn: string;
}

export interface ApproverOptions {
  roles: RoleOption[];
  members: MemberOption[];
  permissions: PermissionOption[];
}

// ---------------------------------------------------------------- Running approvals

export type Decision = 'Approve' | 'Reject' | 'Return';
export type InstanceStatus = 'InProgress' | 'Approved' | 'Rejected' | 'Returned' | 'Canceled' | 'Failed';

export interface WorkItem {
  id: string;
  instanceId: string;
  screen: string;
  screenNameAr: string;
  screenNameEn: string;
  processNameAr: string;
  processNameEn: string;
  title: string;
  link: string | null;
  stepNameAr: string;
  stepNameEn: string;
  submittedBy: string;
  submittedAt: string;
  assignedAt: string;
  dueAt: string | null;
  isOverdue: boolean;
  isDelegated: boolean;
  status: string;
  decidedAt: string | null;
  comment: string | null;
}

export interface InstanceSummary {
  id: string;
  screen: string;
  screenNameAr: string;
  screenNameEn: string;
  processNameAr: string;
  processNameEn: string;
  version: number;
  title: string;
  link: string | null;
  status: InstanceStatus;
  waitingStepAr: string | null;
  waitingStepEn: string | null;
  submittedBy: string;
  submittedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface HistoryEntry {
  sequence: number;
  kind: string;
  stepNameAr: string | null;
  stepNameEn: string | null;
  actor: string | null;
  onBehalfOf: string | null;
  outcome: string | null;
  comment: string | null;
  changes: Record<string, string | null> | null;
  at: string;
}

export interface ApprovalStage {
  stepId: string;
  nameAr: string;
  nameEn: string;
  state: 'Done' | 'Rejected' | 'Returned' | 'Current' | 'Canceled';
  assignees: string[];
  decidedBy: string | null;
  onBehalfOf: string | null;
  openedAt: string;
  decidedAt: string | null;
  comment: string | null;
  /** 2 and up: the stage opened again (after a return). */
  round: number;
  /** Any: one approver decides; All: everyone must approve. */
  rule: 'Any' | 'All';
}

/** A stage not reached yet: its approvers and dates are known only when it opens. */
export interface PlannedStage {
  stepId: string;
  nameAr: string;
  nameEn: string;
  rule: 'Any' | 'All';
}

export interface ApprovalStatus {
  instanceId: string;
  processNameAr: string;
  processNameEn: string;
  processVersion: number;
  status: InstanceStatus;
  currentStepAr: string | null;
  currentStepEn: string | null;
  waitingFor: string[];
  submittedBy: string;
  submittedAt: string;
  stages: ApprovalStage[];
  history: HistoryEntry[];
  /** The stages ahead if everything is approved (a forecast); empty once the approval ended. */
  planned?: PlannedStage[] | null;
}

export interface FieldValue {
  field: RecordField;
  value: string | null;
}

export interface AvailableActions {
  workItemId: string | null;
  canApprove: boolean;
  canReject: boolean;
  canReturn: boolean;
  canDelegate: boolean;
  canCancel: boolean;
  canRetry: boolean;
  requiredFields: FieldValue[];
  /** Open tasks of the current stage an administrator of the tasks may give to someone else. */
  reassignable?: { workItemId: string; assigneeUserId: string; assigneeName: string }[] | null;
}

export interface InstanceDetail {
  summary: InstanceSummary;
  status: ApprovalStatus;
  record: FieldValue[];
  actions: AvailableActions;
}

// ---------------------------------------------------------------- Internal requests

export type RequestStatus = 'Draft' | 'InApproval' | 'Approved' | 'Rejected' | 'Returned' | 'UnderReview' | 'OnHold' | 'Canceled';

export interface InternalRequest {
  id: string;
  number: string;
  subject: string;
  details: string;
  amount: number | null;
  legalEntityId: string | null;
  category: string;
  directManagerId: string | null;
  approverNotes: string | null;
  createdByName: string;
  createdAt: string;
  status: RequestStatus;
  lastComment: string | null;
  isMine: boolean;
  canEdit: boolean;
  approval: ApprovalStatus | null;
}

export interface RequestInput {
  subject: string;
  details: string;
  amount: number | null;
  legalEntityId: string | null;
  category: string;
  directManagerId: string | null;
}

const base = '/api/v1/workflow';

/** Where a listed record's approval waits, since when, and for whom. */
export interface CurrentStage {
  recordId: string;
  stepAr: string | null;
  stepEn: string | null;
  since: string | null;
  waitingFor: string[];
}

export const workflowApi = {
  /** The values a text field of the screen's table (or of a related table) holds, to pick one. */
  fieldValues: (screen: string, relation: string | null | undefined, field: string) =>
    request<string[]>('GET', `${base}/screens/${encodeURIComponent(screen)}/values?field=${encodeURIComponent(field)}${relation ? `&relation=${encodeURIComponent(relation)}` : ''}`),
  currentStages: (screen: string, ids: string[]) => request<CurrentStage[]>('GET', `${base}/current-stages?screen=${encodeURIComponent(screen)}&ids=${ids.join(',')}`),
  screens: () => request<Screen[]>('GET', `${base}/screens`),
  processes: () => request<ProcessSummary[]>('GET', `${base}/processes`),
  startInstance: (screen: string, recordId: string, processId: string, title: string) =>
    request<{ id: string }>('POST', `${base}/instances/start`, { screen, recordId, processId, title }),
  process: (id: string) => request<ProcessDetail>('GET', `${base}/processes/${id}`),
  createProcess: (input: { screen: string; nameAr: string; nameEn: string; priority: number }) => request<ProcessDetail>('POST', `${base}/processes`, input),
  saveDraft: (id: string, input: { nameAr: string; nameEn: string; priority: number; definition: ProcessDefinition }) =>
    request<ProcessDetail>('PUT', `${base}/processes/${id}/draft`, input),
  validate: (id: string) => request<void>('POST', `${base}/processes/${id}/validate`),
  publish: (id: string) => request<ProcessDetail>('POST', `${base}/processes/${id}/publish`),
  setActive: (id: string, isActive: boolean) => request<ProcessDetail>('PUT', `${base}/processes/${id}/active`, { isActive }),
  approverOptions: () => request<ApproverOptions>('GET', `${base}/approver-options`),

  inbox: (scope: 'pending' | 'done') => request<WorkItem[]>('GET', `${base}/inbox?scope=${scope}`),
  inboxCount: () => request<{ pending: number }>('GET', `${base}/inbox/count`),
  myRequests: () => request<InstanceSummary[]>('GET', `${base}/my-requests`),
  instances: (status: string) => request<InstanceSummary[]>('GET', `${base}/instances${status ? `?status=${status}` : ''}`),
  instance: (id: string) => request<InstanceDetail>('GET', `${base}/instances/${id}`),
  /** The same idempotency key sent again (a retry, a double click) returns the first result without deciding twice. */
  decide: (workItemId: string, decision: Decision, comment: string, fields: Record<string, string | null>, idempotencyKey?: string) =>
    request<void>('POST', `${base}/work-items/${workItemId}/decision`, { decision, comment, fields }, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined),
  delegate: (workItemId: string, userId: string, comment: string) => request<void>('POST', `${base}/work-items/${workItemId}/delegate`, { userId, comment }),
  reassign: (workItemId: string, userId: string, reason: string) => request<void>('POST', `${base}/work-items/${workItemId}/reassign`, { userId, reason }),
  cancel: (instanceId: string, reason: string) => request<void>('POST', `${base}/instances/${instanceId}/cancel`, { reason }),
  retry: (instanceId: string) => request<void>('POST', `${base}/instances/${instanceId}/retry`),
  people: () => request<MemberOption[]>('GET', `${base}/people`),

  requests: (all: boolean) => request<InternalRequest[]>('GET', `${base}/requests?all=${all}`),
  request: (id: string) => request<InternalRequest>('GET', `${base}/requests/${id}`),
  createRequest: (input: RequestInput) => request<InternalRequest>('POST', `${base}/requests`, input),
  updateRequest: (id: string, input: RequestInput) => request<InternalRequest>('PUT', `${base}/requests/${id}`, input),
  submitRequest: (id: string) => request<InternalRequest>('POST', `${base}/requests/${id}/submit`),
};

/** A new unique step id for the editor. */
export const newStepId = () => `s${Math.random().toString(36).slice(2, 10)}`;
