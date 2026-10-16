// Approval routes, tasks and internal requests (src/Modules/Workflow/.../Api/WorkflowEndpoints.cs).
import { request } from './auth';

export type ApproverKind = 'User' | 'Role' | 'Dynamic';
export type Decision = 'Approve' | 'Reject' | 'Return';
export type RequestStatus = 'Draft' | 'InApproval' | 'Approved' | 'Rejected' | 'Returned';

export interface DynamicKey {
  key: string;
  nameAr: string;
  nameEn: string;
}

export interface Stage {
  order?: number;
  nameAr: string;
  nameEn: string;
  kind: ApproverKind;
  userId: string | null;
  roleId: string | null;
  dynamicKey: string | null;
}

export interface RouteSummary {
  documentType: string;
  nameAr: string;
  nameEn: string;
  dynamicApprovers: DynamicKey[];
  hasRoute: boolean;
  isActive: boolean;
  version: number;
  publishedBy: string | null;
  publishedAt: string | null;
  stages: Stage[];
}

export interface RouteVersion {
  version: number;
  publishedBy: string;
  publishedAt: string;
  stages: Stage[];
}

export interface RoleOption {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
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

export interface Task {
  id: string;
  instanceId: string;
  documentType: string;
  documentTypeNameAr: string;
  documentTypeNameEn: string;
  documentId: string;
  title: string;
  link: string | null;
  stageOrder: number;
  stageCount: number;
  stageNameAr: string;
  stageNameEn: string;
  submittedBy: string;
  submittedAt: string;
  status: string;
  isEscalated: boolean;
  decidedAt: string | null;
  comment: string | null;
}

export interface TimelineStep {
  stageOrder: number;
  stageNameAr: string;
  stageNameEn: string;
  status: 'Waiting' | 'Pending' | 'Approved' | 'Rejected' | 'Returned';
  assignees: string[];
  decidedBy: string | null;
  decidedAt: string | null;
  comment: string | null;
}

export interface Timeline {
  instanceId: string;
  status: 'InProgress' | 'Approved' | 'Rejected' | 'Returned';
  currentStage: number;
  stageCount: number;
  submittedBy: string;
  submittedAt: string;
  steps: TimelineStep[];
}

export interface InternalRequest {
  id: string;
  number: string;
  subject: string;
  details: string;
  amount: number | null;
  legalEntityId: string | null;
  createdByName: string;
  createdAt: string;
  status: RequestStatus;
  lastComment: string | null;
  isMine: boolean;
  approval: Timeline | null;
}

export interface RequestInput {
  subject: string;
  details: string;
  amount: number | null;
  legalEntityId: string | null;
}

const base = '/api/v1/workflow';

export const workflowApi = {
  routes: () => request<RouteSummary[]>('GET', `${base}/routes`),
  versions: (documentType: string) => request<RouteVersion[]>('GET', `${base}/routes/${documentType}/versions`),
  publish: (documentType: string, stages: Stage[], isActive: boolean) => request<RouteSummary>('PUT', `${base}/routes/${documentType}`, { stages, isActive }),
  approverOptions: () => request<ApproverOptions>('GET', `${base}/approver-options`),

  tasks: (scope: 'pending' | 'done') => request<Task[]>('GET', `${base}/tasks?scope=${scope}`),
  taskCount: () => request<{ pending: number }>('GET', `${base}/tasks/count`),
  decide: (taskId: string, decision: Decision, comment: string) => request<void>('POST', `${base}/tasks/${taskId}/decision`, { decision, comment }),

  requests: (all: boolean) => request<InternalRequest[]>('GET', `${base}/requests?all=${all}`),
  request: (id: string) => request<InternalRequest>('GET', `${base}/requests/${id}`),
  createRequest: (input: RequestInput) => request<InternalRequest>('POST', `${base}/requests`, input),
  updateRequest: (id: string, input: RequestInput) => request<InternalRequest>('PUT', `${base}/requests/${id}`, input),
  submitRequest: (id: string, directManagerUserId: string | null) => request<InternalRequest>('POST', `${base}/requests/${id}/submit`, { directManagerUserId }),
  people: () => request<MemberOption[]>('GET', `${base}/requests/people`),
};
