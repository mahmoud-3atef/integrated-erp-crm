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

export interface Screen {
  code: string;
  nameAr: string;
  nameEn: string;
  linkTemplate: string;
  fields: RecordField[];
}

// ---------------------------------------------------------------- Process definition (same JSON as the server)

export type Operator = 'Equals' | 'NotEquals' | 'GreaterThan' | 'GreaterOrEqual' | 'LessThan' | 'LessOrEqual' | 'In' | 'IsEmpty' | 'IsNotEmpty';

export interface ConditionRule {
  fieldKey: string;
  operator: Operator;
  value?: string | null;
  values?: string[] | null;
}

export interface ConditionGroup {
  matchAll: boolean;
  rules: ConditionRule[];
}

export type AssigneeKind = 'User' | 'Role' | 'UserField';
export type RecipientKind = 'Submitter' | 'User' | 'Role' | 'UserField';

export interface Assignee {
  kind: AssigneeKind;
  userId?: string | null;
  roleId?: string | null;
  fieldKey?: string | null;
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
  branches: { condition: ConditionGroup; steps: Step[] }[];
  else: Step[];
}

export interface UpdateStep {
  type: 'update';
  id: string;
  changes: { fieldKey: string; value?: string | null; fromField?: string | null }[];
}

export interface NotifyStep {
  type: 'notify';
  id: string;
  to: Recipient[];
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
}

export interface StopStep {
  type: 'stop';
  id: string;
  outcome: 'Approved' | 'Rejected' | 'Canceled';
}

export type Step = ApprovalStep | ConditionStep | UpdateStep | NotifyStep | StopStep;

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

export interface ApproverOptions {
  roles: RoleOption[];
  members: MemberOption[];
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
  history: HistoryEntry[];
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

export const workflowApi = {
  screens: () => request<Screen[]>('GET', `${base}/screens`),
  processes: () => request<ProcessSummary[]>('GET', `${base}/processes`),
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
  decide: (workItemId: string, decision: Decision, comment: string, fields: Record<string, string | null>) =>
    request<void>('POST', `${base}/work-items/${workItemId}/decision`, { decision, comment, fields }),
  delegate: (workItemId: string, userId: string, comment: string) => request<void>('POST', `${base}/work-items/${workItemId}/delegate`, { userId, comment }),
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
