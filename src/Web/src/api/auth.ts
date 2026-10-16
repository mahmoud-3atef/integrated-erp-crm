// Sign-in API (src/Modules/Identity/.../Api/AuthEndpoints.cs). Same origin: the session lives in an
// HttpOnly cookie the page cannot read; every state change carries the CSRF header.

export type NextStep = 'mfa_setup' | 'mfa' | 'choose_company' | 'done' | 'no_company';

export interface Company {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

export interface StepResponse {
  next: NextStep;
  displayName: string;
  mfaSetupUri: string | null;
  mfaSetupSecret: string | null;
  recoveryCodes: string[] | null;
  companies: Company[] | null;
  company: Company | null;
}

export interface Me {
  userId: string;
  displayName: string;
  isPlatformAdmin: boolean;
  company: Company | null;
  companies: Company[];
  /** Permission codes in the current company (the server checks them again on every call). */
  permissions: string[];
  /** Granted for every commercial registration (needed for company-wide screens such as users and roles). */
  companyWidePermissions: string[];
}

/** An API failure with a stable code (translated in the UI, never matched on its message). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

const csrfHeader = { 'X-ERP-CSRF': '1' };

export async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(method !== 'GET' ? { 'Content-Type': 'application/json', ...csrfHeader } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    throw new ApiError(response.status, await errorCode(response));
  }

  return (await response.json()) as T;
}

/** Multipart upload (files); same CSRF header and error handling as {@link request}. */
export async function upload<T>(path: string, form: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', ...csrfHeader }, body: form });
  } catch {
    throw new ApiError(0, 'network');
  }

  if (!response.ok) {
    throw new ApiError(response.status, response.status === 413 ? 'validation.file_too_large' : await errorCode(response));
  }

  return (await response.json()) as T;
}

async function errorCode(response: Response): Promise<string> {
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

async function readTitle(response: Response): Promise<string | null> {
  try {
    const problem = (await response.json()) as { title?: string };
    return problem.title && /^[a-z_]+\.[a-z_]+$/.test(problem.title) ? problem.title : null;
  } catch {
    return null;
  }
}

export const authApi = {
  login: (userName: string, password: string) => request<StepResponse>('POST', '/api/v1/auth/login', { userName, password }),
  confirmMfaSetup: (code: string) => request<StepResponse>('POST', '/api/v1/auth/mfa/setup', { code }),
  verifyMfa: (input: { code?: string; recoveryCode?: string }) => request<StepResponse>('POST', '/api/v1/auth/mfa/verify', input),
  selectCompany: (companyId: string) => request<StepResponse>('POST', '/api/v1/auth/select-company', { companyId }),
  me: () => request<Me>('GET', '/api/v1/auth/me'),
  logout: () => request<void>('POST', '/api/v1/auth/logout'),
};

/** Translation key of an error: "validation.invalid_credentials" → "errors.validation_invalid_credentials". */
export function errorKey(error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'unknown';
  return `errors.${code.replace('.', '_')}`;
}
