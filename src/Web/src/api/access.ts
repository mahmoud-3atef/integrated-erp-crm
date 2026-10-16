// Company access administration (src/Modules/Identity/.../Api/AccessEndpoints.cs). Always the current company.
import { request } from './auth';

export type RoleKind = 'Custom' | 'Administrator' | 'ReadOnly';

export interface Permission {
  code: string;
  groupAr: string;
  groupEn: string;
  nameAr: string;
  nameEn: string;
}

export interface Role {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  kind: RoleKind;
  isActive: boolean;
  permissions: string[];
}

/** A role for all commercial registrations (legalEntityId null) or for one. */
export interface Assignment {
  roleId: string;
  legalEntityId: string | null;
}

export interface Member {
  membershipId: string;
  userAccountId: string;
  displayName: string;
  userName: string | null;
  email: string | null;
  isActive: boolean;
  roles: Assignment[];
}

export interface LegalEntity {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
}

export interface RoleInput {
  code?: string;
  nameAr: string;
  nameEn: string;
  permissions: string[];
}

export const accessApi = {
  permissions: () => request<Permission[]>('GET', '/api/v1/access/permissions'),
  roles: () => request<Role[]>('GET', '/api/v1/access/roles'),
  createRole: (input: RoleInput) => request<Role>('POST', '/api/v1/access/roles', input),
  updateRole: (id: string, input: RoleInput) => request<Role>('PUT', `/api/v1/access/roles/${id}`, input),
  members: () => request<Member[]>('GET', '/api/v1/access/members'),
  addMember: (userName: string) => request<Member>('POST', '/api/v1/access/members', { userName }),
  setRoles: (membershipId: string, roles: Assignment[]) => request<void>('PUT', `/api/v1/access/members/${membershipId}/roles`, { roles }),
  setActive: (membershipId: string, isActive: boolean) => request<void>('PUT', `/api/v1/access/members/${membershipId}/active`, { isActive }),
  legalEntities: () => request<LegalEntity[]>('GET', '/api/v1/access/legal-entities'),
};

/** Arabic or English name of anything that carries both. */
export const localName = (item: { nameAr: string; nameEn: string }, language: string) => (language === 'ar' ? item.nameAr : item.nameEn);
