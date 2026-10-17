// Company access administration (src/Modules/Identity/.../Api/AccessEndpoints.cs). Always the current company.
import { request } from './auth';
export const accessApi = {
    permissions: () => request('GET', '/api/v1/access/permissions'),
    roles: () => request('GET', '/api/v1/access/roles'),
    createRole: (input) => request('POST', '/api/v1/access/roles', input),
    updateRole: (id, input) => request('PUT', `/api/v1/access/roles/${id}`, input),
    members: () => request('GET', '/api/v1/access/members'),
    addMember: (userName) => request('POST', '/api/v1/access/members', { userName }),
    setRoles: (membershipId, roles) => request('PUT', `/api/v1/access/members/${membershipId}/roles`, { roles }),
    setActive: (membershipId, isActive) => request('PUT', `/api/v1/access/members/${membershipId}/active`, { isActive }),
    legalEntities: () => request('GET', '/api/v1/access/legal-entities'),
};
/** Arabic or English name of anything that carries both. */
export const localName = (item, language) => (language === 'ar' ? item.nameAr : item.nameEn);
