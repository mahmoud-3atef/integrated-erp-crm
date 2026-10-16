import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { authApi, errorKey } from '../api/auth';
import { AuthLayout, ErrorMessage } from '../auth/AuthLayout';
import { pageOf, useSignInFlow } from '../auth/SignInFlow';
import { CodeField } from './CodeField';

export function MfaSetupPage() {
  const { t } = useTranslation();
  const { step, advance, reset } = useSignInFlow();
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uri = step?.mfaSetupUri;

  useEffect(() => {
    // The QR is drawn in the browser: the secret never goes to any other site.
    if (uri) {
      void QRCode.toDataURL(uri, { width: 220, margin: 1, errorCorrectionLevel: 'M' }).then(setQr);
    }
  }, [uri]);

  if (!step?.mfaSetupSecret || !uri) {
    // No setup in progress (or it just finished): go to the page of the current step.
    return <Navigate to={pageOf(step)} replace />;
  }

  const secret = step.mfaSetupSecret;
  const groupedSecret = secret.match(/.{1,4}/g)?.join(' ') ?? secret;

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      advance(await authApi.confirmMfaSetup(code));
    } catch (failure) {
      setError(errorKey(failure));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('mfaSetup.title')} subtitle={t('mfaSetup.intro')}>
      <ErrorMessage messageKey={error} />
      <Stack component="ol" spacing={1} sx={{ ps: 2.5, m: 0, mb: 2 }}>
        <Typography component="li">{t('mfaSetup.step1')}</Typography>
        <Typography component="li">{t('mfaSetup.step2')}</Typography>
        <Typography component="li">{t('mfaSetup.step3')}</Typography>
      </Stack>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        {qr ? <Box component="img" src={qr} alt="QR" sx={{ width: 220, height: 220, border: 1, borderColor: 'divider', borderRadius: 1 }} /> : null}
      </Box>
      <TextField
        label={t('mfaSetup.manualKey')}
        value={groupedSecret}
        multiline
        fullWidth
        sx={{ mb: 3 }}
        slotProps={{
          htmlInput: { readOnly: true, dir: 'ltr', style: { fontFamily: 'monospace' } },
          input: {
            endAdornment: (
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={copySecret}>
                {copied ? t('mfaSetup.copied') : t('mfaSetup.copy')}
              </Button>
            ),
          },
        }}
      />
      <Stack component="form" spacing={2} onSubmit={submit} noValidate>
        <CodeField label={t('mfaSetup.code')} value={code} onChange={setCode} />
        <Button type="submit" variant="contained" size="large" disabled={busy || code.length !== 6}>
          {busy ? t('common.loading') : t('mfaSetup.submit')}
        </Button>
        <Button onClick={reset}>{t('common.startOver')}</Button>
      </Stack>
    </AuthLayout>
  );
}
