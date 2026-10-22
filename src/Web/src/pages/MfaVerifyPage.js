import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button, Stack, TextField } from '@mui/material';
import { useState } from 'react';
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
    const [error, setError] = useState(null);
    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            advance(await authApi.verifyMfa(useRecovery ? { recoveryCode: recoveryCode.trim() } : { code }));
        }
        catch (failure) {
            const key = errorKey(failure);
            if (key === 'errors.session_expired') {
                reset();
                return;
            }
            setError(key);
            setCode('');
        }
        finally {
            setBusy(false);
        }
    };
    const ready = useRecovery ? recoveryCode.trim().length >= 10 : code.length === 6;
    return (_jsxs(AuthLayout, { title: t('mfa.title'), subtitle: useRecovery ? undefined : t('mfa.intro'), children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { component: "form", spacing: 2, onSubmit: submit, noValidate: true, children: [useRecovery ? (_jsx(TextField, { label: t('mfa.recoveryCode'), helperText: t('mfa.recoveryHint'), value: recoveryCode, onChange: (e) => setRecoveryCode(e.target.value.toUpperCase()), autoFocus: true, slotProps: { htmlInput: { dir: 'ltr', spellCheck: false, style: { fontFamily: 'monospace', textAlign: 'center' } } } })) : (_jsx(CodeField, { label: t('mfa.code'), value: code, onChange: setCode })), _jsx(Button, { type: "submit", variant: "contained", size: "large", disabled: busy || !ready, children: busy ? t('common.loading') : t('mfa.submit') }), _jsx(Button, { onClick: () => { setUseRecovery((v) => !v); setError(null); }, children: useRecovery ? t('mfa.useCode') : t('mfa.useRecovery') }), _jsx(Button, { color: "inherit", onClick: reset, children: t('common.startOver') })] })] }));
}
