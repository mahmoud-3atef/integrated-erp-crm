import { jsx as _jsx } from "react/jsx-runtime";
import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/auth';
import { AuthLayout } from '../auth/AuthLayout';
import { useSignInFlow } from '../auth/SignInFlow';
export function NoCompanyPage() {
    const { t } = useTranslation();
    const { reset } = useSignInFlow();
    return (_jsx(AuthLayout, { title: t('noCompany.title'), subtitle: t('noCompany.intro'), children: _jsx(Button, { fullWidth: true, variant: "outlined", onClick: () => void authApi.logout().finally(reset), children: t('common.back') }) }));
}
