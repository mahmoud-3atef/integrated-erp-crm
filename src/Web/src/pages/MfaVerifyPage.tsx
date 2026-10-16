import { Button, Stack, TextField } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi, errorKey } from '../api/auth';
import { AuthLayout, ErrorMessage } from '../auth/AuthLayout';
import { useSignInFlow } from '../auth/SignInFlow';
import { CodeField } from './CodeField';

export function MfaVerifyPage() {
  const { t } = useTranslation();
  const { advance, reset } = useSignInFlow();
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      advance(await authApi.verifyMfa(useRecovery ? { recoveryCode: recoveryCode.trim() } : { code }));
    } catch (failure) {
      const key = errorKey(failure);
      if (key === 'errors.session_expired') {
        reset();
        return;
      }

      setError(key);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const ready = useRecovery ? recoveryCode.trim().length >= 10 : code.length === 6;

  return (
    <AuthLayout title={t('mfa.title')} subtitle={useRecovery ? undefined : t('mfa.intro')}>
      <ErrorMessage messageKey={error} />
      <Stack component="form" spacing={2} onSubmit={submit} noValidate>
        {useRecovery ? (
          <TextField
            label={t('mfa.recoveryCode')}
            helperText={t('mfa.recoveryHint')}
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
            autoFocus
            slotProps={{ htmlInput: { dir: 'ltr', spellCheck: false, style: { fontFamily: 'monospace', textAlign: 'center' } } }}
          />
        ) : (
          <CodeField label={t('mfa.code')} value={code} onChange={setCode} />
        )}
        <Button type="submit" variant="contained" size="large" disabled={busy || !ready}>
          {busy ? t('common.loading') : t('mfa.submit')}
        </Button>
        <Button onClick={() => { setUseRecovery((v) => !v); setError(null); }}>
          {useRecovery ? t('mfa.useCode') : t('mfa.useRecovery')}
        </Button>
        <Button color="inherit" onClick={reset}>
          {t('common.startOver')}
        </Button>
      </Stack>
    </AuthLayout>
  );
}
