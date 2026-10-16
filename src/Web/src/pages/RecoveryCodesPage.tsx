import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, Button, Stack } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../auth/AuthLayout';
import { pageOf, routeOf, useSignInFlow } from '../auth/SignInFlow';

export function RecoveryCodesPage() {
  const { t } = useTranslation();
  const { step } = useSignInFlow();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!step?.recoveryCodes?.length) {
    return <Navigate to={pageOf(step)} replace />;
  }

  const codes = step.recoveryCodes;
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <AuthLayout title={t('recovery.title')} subtitle={t('recovery.intro')}>
      <Box
        component="ul"
        dir="ltr"
        sx={{ listStyle: 'none', p: 2, m: 0, mb: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, bgcolor: 'grey.100', borderRadius: 1, fontFamily: 'monospace', fontSize: '1.05rem', textAlign: 'center' }}
      >
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </Box>
      <Stack spacing={1.5}>
        <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={copyAll}>
          {copied ? t('mfaSetup.copied') : t('recovery.copyAll')}
        </Button>
        <Button variant="contained" size="large" onClick={() => navigate(routeOf[step.next], { replace: true })}>
          {t('recovery.confirm')}
        </Button>
      </Stack>
    </AuthLayout>
  );
}
