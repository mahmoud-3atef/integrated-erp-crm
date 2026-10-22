import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
        return _jsx(Navigate, { to: pageOf(step), replace: true });
    }
    const codes = step.recoveryCodes;
    const copyAll = async () => {
        try {
            await navigator.clipboard.writeText(codes.join('\n'));
            setCopied(true);
        }
        catch {
            setCopied(false);
        }
    };
    return (_jsxs(AuthLayout, { title: t('recovery.title'), subtitle: t('recovery.intro'), children: [_jsx(Box, { component: "ul", dir: "ltr", sx: { listStyle: 'none', p: 2, m: 0, mb: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, bgcolor: 'grey.100', borderRadius: 1, fontFamily: 'monospace', fontSize: '1.05rem', textAlign: 'center' }, children: codes.map((c) => (_jsx("li", { children: c }, c))) }), _jsxs(Stack, { spacing: 1.5, children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(ContentCopyIcon, {}), onClick: copyAll, children: copied ? t('mfaSetup.copied') : t('recovery.copyAll') }), _jsx(Button, { variant: "contained", size: "large", onClick: () => navigate(routeOf[step.next], { replace: true }), children: t('recovery.confirm') })] })] }));
}
