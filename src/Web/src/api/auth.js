// Sign-in API (src/Modules/Identity/.../Api/AuthEndpoints.cs). Same origin: the session lives in an
// HttpOnly cookie the page cannot read; every state change carries the CSRF header.
/** An API failure with a stable code (translated in the UI, never matched on its message). */
export class ApiError extends Error {
    status;
    code;
    constructor(status, code) {
        super(code);
        this.status = status;
        this.code = code;
    }
}
const csrfHeader = { 'X-ERP-CSRF': '1' };
export async function request(method, path, body) {
    let response;
    try {
        response = await fetch(path, {
            method,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', ...(method !== 'GET' ? { 'Content-Type': 'application/json', ...csrfHeader } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    }
    catch {
        throw new ApiError(0, 'network');
    }
    if (response.status === 204) {
        return undefined;
    }
    if (!response.ok) {
        throw new ApiError(response.status, await errorCode(response));
    }
    return (await response.json());
}
/** Multipart upload (files); same CSRF header and error handling as {@link request}. */
export async function upload(path, form) {
    let response;
    try {
        response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', ...csrfHeader }, body: form });
    }
    catch {
        throw new ApiError(0, 'network');
    }
    if (!response.ok) {
        throw new ApiError(response.status, response.status === 413 ? 'validation.file_too_large' : await errorCode(response));
    }
    return (await response.json());
}
async function errorCode(response) {
    if (response.status === 429) {
        // Either the per-user throttle (has a code) or the per-client rate limit (no body).
        const code = await readTitle(response);
        return code ?? 'rate_limited';
    }
    if (response.status === 403) {
        return (await readTitle(response)) ?? 'forbidden';
    }
    if (response.status === 401) {
        return (await readTitle(response)) ?? 'session_expired';
    }
    return (await readTitle(response)) ?? 'unknown';
}
async function readTitle(response) {
    try {
        const problem = (await response.json());
        return problem.title && /^[a-z_]+\.[a-z_]+$/.test(problem.title) ? problem.title : null;
    }
    catch {
        return null;
    }
}
export const authApi = {
    login: (userName, password) => request('POST', '/api/v1/auth/login', { userName, password }),
    confirmMfaSetup: (code) => request('POST', '/api/v1/auth/mfa/setup', { code }),
    verifyMfa: (input) => request('POST', '/api/v1/auth/mfa/verify', input),
    selectCompany: (companyId) => request('POST', '/api/v1/auth/select-company', { companyId }),
    me: () => request('GET', '/api/v1/auth/me'),
    logout: () => request('POST', '/api/v1/auth/logout'),
};
/** Translation key of an error: "validation.invalid_credentials" → "errors.validation_invalid_credentials". */
export function errorKey(error) {
    const code = error instanceof ApiError ? error.code : 'unknown';
    return `errors.${code.replace('.', '_')}`;
}
