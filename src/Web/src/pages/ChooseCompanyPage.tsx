import BusinessIcon from '@mui/icons-material/Business';
import { List, ListItemButton, ListItemIcon, ListItemText, Button } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi, errorKey, type Company } from '../api/auth';
import { AuthLayout, ErrorMessage } from '../auth/AuthLayout';
import { useSignInFlow } from '../auth/SignInFlow';

export function companyName(company: Company, language: string) {
  return language === 'ar' ? company.nameAr : company.nameEn;
}

/** After MFA (several companies), or from the home page to switch company. */
export function ChooseCompanyPage() {
  const { t, i18n } = useTranslation();
  const { step, advance, reset } = useSignInFlow();
  const [companies, setCompanies] = useState<Company[]>(step?.companies ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Switching from an existing session: the list comes from /me.
    if (!step?.companies) {
      authApi.me().then((me) => setCompanies(me.companies)).catch(() => reset());
    }
  }, [step, reset]);

  const choose = async (company: Company) => {
    setBusy(true);
    setError(null);
    try {
      advance(await authApi.selectCompany(company.id));
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('company.title')} subtitle={t('company.intro')}>
      <ErrorMessage messageKey={error} />
      <List sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 2, py: 0 }}>
        {companies.map((company) => (
          <ListItemButton key={company.id} disabled={busy} onClick={() => void choose(company)} divider>
            <ListItemIcon>
              <BusinessIcon color="primary" />
            </ListItemIcon>
            <ListItemText primary={companyName(company, i18n.language)} secondary={company.code} />
          </ListItemButton>
        ))}
      </List>
      <Button fullWidth color="inherit" onClick={reset}>
        {t('common.startOver')}
      </Button>
    </AuthLayout>
  );
}
