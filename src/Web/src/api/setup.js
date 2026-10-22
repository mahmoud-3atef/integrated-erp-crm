// Company setup (src/Modules/Organization/.../Api/CompanySetupEndpoints.cs). Always the current company.
import { request } from './auth';
const base = '/api/v1/organization';
export const setupApi = {
    legalEntities: () => request('GET', `${base}/legal-entities`),
    createLegalEntity: (input) => request('POST', `${base}/legal-entities`, input),
    updateLegalEntity: (id, input) => request('PUT', `${base}/legal-entities/${id}`, input),
    legalEntityHistory: (id) => request('GET', `${base}/legal-entities/${id}/history`),
    branches: () => request('GET', `${base}/branches`),
    createBranch: (input) => request('POST', `${base}/branches`, input),
    updateBranch: (id, input) => request('PUT', `${base}/branches/${id}`, input),
    branchHistory: (id) => request('GET', `${base}/branches/${id}/history`),
    referenceLists: () => request('GET', `${base}/reference-lists`),
    items: (list) => request('GET', `${base}/reference-lists/${list}/items`),
    createItem: (list, input) => request('POST', `${base}/reference-lists/${list}/items`, input),
    updateItem: (list, id, input) => request('PUT', `${base}/reference-lists/${list}/items/${id}`, input),
    itemHistory: (list, id) => request('GET', `${base}/reference-lists/${list}/items/${id}/history`),
    modules: () => request('GET', `${base}/modules`),
};
