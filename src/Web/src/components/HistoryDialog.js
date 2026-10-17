import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import HistoryIcon from '@mui/icons-material/History';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../api/auth';
import { tokens } from '../app/theme';
import { ErrorMessage } from '../auth/AuthLayout';
import { Badge, EmptyState } from './ui';
/** Technical fields that mean nothing to the reader. */
const hidden = new Set(['Id', 'TenantId', 'ListCode', 'IsSystem']);
const actionTone = { Added: 'success', Modified: 'info', Deleted: 'danger' };
/** Audit trail of one record: who changed what, and when (read from the audit log written with every save). */
export function HistoryDialog({ title, load, formatValue, onClose }) {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const phone = useMediaQuery(theme.breakpoints.down('sm'));
    const [entries, setEntries] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        load().then(setEntries).catch((failure) => setError(errorKey(failure)));
    }, [load]);
    const show = (field, value) => {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const custom = formatValue?.(field, value);
        if (custom) {
            return custom;
        }
        if (typeof value === 'boolean') {
            return value ? t('common.yes') : t('common.no');
        }
        return String(value);
    };
    const fieldName = (field) => (i18n.exists(`fields.${field}`) ? t(`fields.${field}`) : field);
    const when = (value) => new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", fullScreen: phone, children: [_jsxs(DialogTitle, { sx: { display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(HistoryIcon, { sx: { color: tokens.navy700 } }), t('history.title'), " \u2014 ", title] }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), entries?.length === 0 && _jsx(EmptyState, { text: t('history.empty') }), _jsx(Stack, { spacing: 1.5, children: (entries ?? []).map((entry, index) => {
                            const fields = Object.entries(entry.changes).filter(([field]) => !hidden.has(field));
                            return (_jsxs(Box, { sx: { p: 1.75, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px solid ${tokens.border}` }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: fields.length ? 1 : 0 }, children: [_jsx(Badge, { tone: actionTone[entry.action], children: t(`history.${entry.action}`) }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 600, color: tokens.navy800 }, children: entry.userName }), _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500, marginInlineStart: 'auto' }, dir: "ltr", children: when(entry.occurredAt) })] }), fields.map(([field, change]) => (_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' }, gap: { xs: 0, sm: 1 }, py: 0.5, fontSize: 13 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600, color: tokens.gray600 }, children: fieldName(field) }), _jsx(Typography, { sx: { fontSize: 13, color: tokens.gray900 }, children: entry.action === 'Modified' ? (_jsxs(_Fragment, { children: [_jsx(Box, { component: "span", sx: { color: tokens.gray500, textDecoration: 'line-through' }, children: show(field, change.old) }), i18n.dir() === 'rtl' ? ' ← ' : ' → ', _jsx(Box, { component: "span", sx: { fontWeight: 600 }, children: show(field, change.new) })] })) : (show(field, entry.action === 'Deleted' ? change.old : change.new)) })] }, field)))] }, index));
                        }) })] }), _jsx(DialogActions, { children: _jsx(Button, { onClick: onClose, children: t('common.close') }) })] }));
}
