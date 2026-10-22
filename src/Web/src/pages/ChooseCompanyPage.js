import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import BusinessIcon from '@mui/icons-material/Business';
import { List, ListItemButton, ListItemIcon, ListItemText, Button } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi, errorKey } from '../api/auth';
import { AuthLayout, ErrorMessage } from '../auth/AuthLayout';
import { useSignInFlow } from '../auth/SignInFlow';
export function companyName(company, language) {
    return language === 'ar' ? company.nameAr : company.nameEn;
}
/** After MFA (several companies), or from the home page to switch company. */
export function ChooseCompanyPage() {
    const { t, i18n } = useTranslation();
    const { step, advance, reset } = useSignInFlow();
    const [companies, setCompanies] = useState(step?.companies ?? []);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        // Switching from an existing session: the list comes from /me.
        if (!step?.companies) {
            authApi.me().then((me) => setCompanies(me.companies)).catch(() => reset());
        }
    }, [step, reset]);
    const choose = async (company) => {
        setBusy(true);
        setError(null);
        try {
            advance(await authApi.selectCompany(company.id));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(AuthLayout, { title: t('company.title'), subtitle: t('company.intro'), children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(List, { sx: { border: 1, borderColor: 'divider', borderRadius: 1, mb: 2, py: 0 }, children: companies.map((company) => (_jsxs(ListItemButton, { disabled: busy, onClick: () => void choose(company), divider: true, children: [_jsx(ListItemIcon, { children: _jsx(BusinessIcon, { color: "primary" }) }), _jsx(ListItemText, { primary: companyName(company, i18n.language), secondary: company.code })] }, company.id))) }), _jsx(Button, { fullWidth: true, color: "inherit", onClick: reset, children: t('common.startOver') })] }));
}
