import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { setupApi } from '../../api/setup';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { PageHeader, StatusDot } from '../../components/ui';
/** Modules of this installation and whether each is switched on (Modules:{Name}:Enabled in the settings). */
export function ModulesPage() {
    const { t, i18n } = useTranslation();
    const [modules, setModules] = useState([]);
    const [error, setError] = useState(null);
    useEffect(() => {
        setupApi.modules().then(setModules).catch((failure) => setError(errorKey(failure)));
    }, []);
    const text = (name, part) => (i18n.exists(`modules.${name}.${part}`) ? t(`modules.${name}.${part}`) : part === 'name' ? name : '');
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('modules.title'), subtitle: t('modules.intro') }), _jsx(ErrorMessage, { messageKey: error }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: `${tokens.gap}px` }, children: modules.map((module) => (_jsxs(Box, { sx: { display: 'flex', flexDirection: 'column', gap: 0.75, p: 2.5, pb: 1.75, bgcolor: '#fff', borderRadius: `${tokens.radius}px`, boxShadow: tokens.shadowSm }, children: [_jsx(ExtensionOutlinedIcon, { sx: { fontSize: 30, color: tokens.navy700, mb: 1.5 } }), _jsx(Typography, { sx: { fontSize: 14, fontWeight: 700, color: tokens.navy800 }, children: text(module.name, 'name') }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600, flex: 1 }, children: text(module.name, 'description') }), _jsx(Box, { sx: { pt: 1, mt: 0.5, borderTop: `1px solid ${tokens.border}` }, children: _jsx(StatusDot, { tone: module.enabled ? 'success' : 'neutral', label: module.enabled ? t('modules.enabled') : t('modules.disabled') }) })] }, module.name))) })] }));
}
