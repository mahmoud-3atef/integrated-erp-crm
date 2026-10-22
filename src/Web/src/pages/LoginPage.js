import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Button, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi, errorKey } from '../api/auth';
import { tokens } from '../app/theme';
import { AuthLayout, ErrorMessage } from '../auth/AuthLayout';
import { useSignInFlow } from '../auth/SignInFlow';
/** The portal's large sign-in inputs: label above, icon inside, soft background. */
export const signInInput = {
    '& .MuiOutlinedInput-root': { height: 54, borderRadius: '14px', bgcolor: '#f9fbfd', fontSize: 15, fontWeight: 600 },
    '& .MuiOutlinedInput-notchedOutline': { borderWidth: '1.5px', borderColor: '#dfe7ee' },
    '& .MuiInputAdornment-positionStart svg': { color: '#9aabbb' },
    '& .Mui-focused .MuiInputAdornment-positionStart svg': { color: tokens.navy700 },
};
export function FieldLabel({ htmlFor, children }) {
    return (_jsx(Typography, { component: "label", htmlFor: htmlFor, sx: { display: 'block', mb: 0.9, fontSize: 13.5, fontWeight: 700, color: '#2c4054' }, children: children }));
}
export function LoginPage() {
    const { t } = useTranslation();
    const { advance } = useSignInFlow();
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            advance(await authApi.login(userName.trim(), password));
        }
        catch (failure) {
            setError(errorKey(failure));
            setPassword('');
        }
        finally {
            setBusy(false);
        }
    };
    const watchCaps = (event) => setCapsLock(event.getModifierState('CapsLock'));
    return (_jsxs(AuthLayout, { title: t('login.title'), subtitle: t('login.subtitle'), children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { component: "form", spacing: 1.75, onSubmit: submit, noValidate: true, children: [_jsxs(Box, { children: [_jsx(FieldLabel, { htmlFor: "login-user", children: t('login.userName') }), _jsx(TextField, { id: "login-user", placeholder: t('login.userNamePlaceholder'), value: userName, onChange: (e) => setUserName(e.target.value), autoComplete: "username", autoFocus: true, required: true, sx: signInInput, slotProps: {
                                    htmlInput: { dir: 'ltr', spellCheck: false, 'aria-describedby': 'login-user-hint' },
                                    input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(PersonOutlinedIcon, {}) }) },
                                } }), _jsx(Typography, { id: "login-user-hint", sx: { mt: 0.5, fontSize: 12, color: tokens.gray500 }, children: t('login.userNameHint') })] }), _jsxs(Box, { children: [_jsx(FieldLabel, { htmlFor: "login-password", children: t('login.password') }), _jsx(TextField, { id: "login-password", type: showPassword ? 'text' : 'password', placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value), onKeyDown: watchCaps, onKeyUp: watchCaps, onBlur: () => setCapsLock(false), autoComplete: "current-password", required: true, sx: signInInput, slotProps: {
                                    htmlInput: { dir: 'ltr' },
                                    input: {
                                        startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(LockOutlinedIcon, {}) }),
                                        endAdornment: (_jsx(InputAdornment, { position: "end", children: _jsx(IconButton, { onClick: () => setShowPassword((v) => !v), "aria-label": showPassword ? t('login.hidePassword') : t('login.showPassword'), edge: "end", children: showPassword ? _jsx(VisibilityOff, {}) : _jsx(Visibility, {}) }) })),
                                    },
                                } }), capsLock && (_jsxs(Typography, { role: "status", sx: { mt: 0.75, display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12.5, fontWeight: 700, color: '#8a5a00', '& svg': { fontSize: 16 } }, children: [_jsx(WarningAmberIcon, {}), t('login.capsLock')] }))] }), _jsx(Button, { type: "submit", variant: "contained", size: "large", disabled: busy || !userName.trim() || !password, sx: { minHeight: 52, fontSize: 16, fontWeight: 700, mt: 0.5 }, children: busy ? t('common.loading') : t('login.submit') }), _jsxs(Typography, { sx: { display: 'flex', gap: 1, fontSize: 12.5, lineHeight: 1.7, color: tokens.gray500, '& svg': { fontSize: 17, mt: 0.25, color: tokens.navy400 } }, children: [_jsx(InfoOutlinedIcon, {}), t('login.hint')] })] })] }));
}
