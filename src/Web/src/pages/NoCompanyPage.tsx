import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/auth';
import { AuthLayout } from '../auth/AuthLayout';
import { useSignInFlow } from '../auth/SignInFlow';

export function NoCompanyPage() {
  const { t } = useTranslation();
  const { reset } = useSignInFlow();

  return (
    <AuthLayout title={t('noCompany.title')} subtitle={t('noCompany.intro')}>
      <Button fullWidth variant="outlined" onClick={() => void authApi.logout().finally(reset)}>
        {t('common.back')}
      </Button>
    </AuthLayout>
  );
}
