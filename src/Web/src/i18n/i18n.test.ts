import ar from './ar.json';
import en from './en.json';
import { errorKey, ApiError } from '../api/auth';

function keys(value: unknown, prefix = ''): string[] {
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe('translations', () => {
  it('Arabic and English have exactly the same keys', () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it('every sign-in error code from the API has a translation', () => {
    const apiCodes = [
      'validation.invalid_credentials',
      'validation.too_many_attempts',
      'validation.account_locked',
      'validation.directory_unavailable',
      'validation.invalid_mfa_code',
      'validation.not_a_member',
      'validation.role_code_invalid',
      'validation.role_name_invalid',
      'validation.role_built_in',
      'validation.permission_unknown',
      'conflict.role_code_taken',
      'not_found.role',
      'not_found.member',
      'validation.user_not_in_directory',
      'validation.legal_entity_unknown',
      'validation.last_administrator',
      'validation.not_yourself',
      'validation.beyond_own_permissions',
      'forbidden',
      'rate_limited',
      'session_expired',
      'network',
      'unknown',
    ];
    const translated = new Set(keys(ar));
    for (const code of apiCodes) {
      expect(translated).toContain(errorKey(new ApiError(401, code)));
    }
  });

  it('unknown failures map to the generic message', () => {
    expect(errorKey(new Error('boom'))).toBe('errors.unknown');
  });
});
