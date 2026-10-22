import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { authApi, errorKey } from '../api/auth';
import { AuthLayout, ErrorMessage } from '../auth/AuthLayout';
import { pageOf, useSignInFlow } from '../auth/SignInFlow';
import { CodeField } from './CodeField';
export function MfaSetupPage() {
    const { t } = useTranslation();
    const { step, advance, reset } = useSignInFlow();
    const [qr, setQr] = useState(null);
    const [code, setCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const uri = step?.mfaSetupUri;
    useEffect(() => {
        // The QR is drawn in the browser: the secret never goes to any other site.
        if (uri) {
            void QRCode.toDataURL(uri, { width: 220, margin: 1, errorCorrectionLevel: 'M' }).then(setQr);
        }
    }, [uri]);
    if (!step?.mfaSetupSecret || !uri) {
        // No setup in progress (or it just finished): go to the page of the current step.
        return _jsx(Navigate, { to: pageOf(step), replace: true });
    }
    const secret = step.mfaSetupSecret;
    const groupedSecret = secret.match(/.{1,4}/g)?.join(' ') ?? secret;
    const copySecret = async () => {
        try {
            await navigator.clipboard.writeText(secret);
            setCopied(true);
        }
        catch {
            setCopied(false);
        }
    };
    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            advance(await authApi.confirmMfaSetup(code));
        }
        catch (failure) {
            setError(errorKey(failure));
            setCode('');
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(AuthLayout, { title: t('mfaSetup.title'), subtitle: t('mfaSetup.intro'), children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { component: "ol", spacing: 1, sx: { pl: 2.5, m: 0, mb: 2 }, children: [_jsx(Typography, { component: "li", children: t('mfaSetup.step1') }), _jsx(Typography, { component: "li", children: t('mfaSetup.step2') }), _jsx(Typography, { component: "li", children: t('mfaSetup.step3') })] }), _jsx(Box, { sx: { display: 'flex', justifyContent: 'center', mb: 2 }, children: qr ? _jsx(Box, { component: "img", src: qr, alt: "QR", sx: { width: 220, height: 220, border: 1, borderColor: 'divider', borderRadius: 1 } }) : null }), _jsx(TextField, { label: t('mfaSetup.manualKey'), value: groupedSecret, multiline: true, fullWidth: true, sx: { mb: 3 }, slotProps: {
                    htmlInput: { readOnly: true, dir: 'ltr', style: { fontFamily: 'monospace' } },
                    input: {
                        endAdornment: (_jsx(Button, { size: "small", startIcon: _jsx(ContentCopyIcon, {}), onClick: copySecret, children: copied ? t('mfaSetup.copied') : t('mfaSetup.copy') })),
                    },
                } }), _jsxs(Stack, { component: "form", spacing: 2, onSubmit: submit, noValidate: true, children: [_jsx(CodeField, { label: t('mfaSetup.code'), value: code, onChange: setCode }), _jsx(Button, { type: "submit", variant: "contained", size: "large", disabled: busy || code.length !== 6, children: busy ? t('common.loading') : t('mfaSetup.submit') }), _jsx(Button, { onClick: reset, children: t('common.startOver') })] })] }));
}
