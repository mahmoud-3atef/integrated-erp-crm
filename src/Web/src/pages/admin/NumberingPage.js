import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey, request } from '../../api/auth';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PageHeader } from '../../components/ui';
const base = '/api/v1/organization/numbering';
const tokensList = ['{YYYY}', '{YY}', '{MM}', '{N:4}', '{N:5}', '{N:6}'];
/** The number a pattern gives (as the server formats it), or null when the pattern is not usable. */
function preview(pattern, value, date = new Date()) {
    if (!/\{N(:\d{1,2})?\}/.test(pattern))
        return null;
    let bad = false;
    const text = pattern.replace(/\{([A-Z]+)(?::(\d{1,2}))?\}/g, (_, token, width) => {
        switch (token) {
            case 'N':
                return String(value).padStart(Number(width ?? 0), '0');
            case 'YYYY':
                return String(date.getFullYear());
            case 'YY':
                return String(date.getFullYear() % 100).padStart(2, '0');
            case 'MM':
                return String(date.getMonth() + 1).padStart(2, '0');
            default:
                bad = true;
                return '';
        }
    });
    return bad ? null : text;
}
/** The company's numbering of its documents: each document type's pattern, when its counter starts again, and where it starts. */
export function NumberingPage() {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const ar = i18n.language === 'ar';
    const canManage = can('organization.settings.manage', true);
    const [rows, setRows] = useState(null);
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState(null);
    const reload = useCallback(async () => {
        try {
            setRows(await request('GET', base));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);
    const groups = useMemo(() => {
        const map = new Map();
        for (const row of rows ?? []) {
            const key = ar ? row.groupAr : row.groupEn;
            map.set(key, [...(map.get(key) ?? []), row]);
        }
        return [...map.entries()];
    }, [rows, ar]);
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('numbering.title'), subtitle: t('numbering.intro') }), _jsx(Alert, { severity: "info", icon: _jsx(InfoOutlinedIcon, {}), sx: { mb: 2 }, children: t('numbering.how') }), _jsx(ErrorMessage, { messageKey: error }), !rows && !error && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(Stack, { spacing: `${tokens.gap}px`, children: groups.map(([group, items]) => (_jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsx(Typography, { sx: { fontSize: 15, fontWeight: 800, color: tokens.navy800, mb: 1 }, children: group }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('numbering.col.document') }), _jsx(TableCell, { children: t('numbering.col.pattern') }), _jsx(TableCell, { children: t('numbering.col.reset') }), _jsx(TableCell, { children: t('numbering.col.next') }), _jsx(TableCell, { children: t('numbering.col.updated') }), canManage && _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: items.map((n) => (_jsxs(TableRow, { hover: true, children: [_jsxs(TableCell, { sx: { minWidth: 200 }, children: [_jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 700, color: tokens.navy800 }, children: ar ? n.nameAr : n.nameEn }), _jsxs(Stack, { direction: "row", sx: { gap: 0.75, mt: 0.25 }, children: [!n.inUse && _jsx(Badge, { tone: "neutral", children: t('numbering.reserved') }), n.customized && _jsx(Badge, { tone: "primary", children: t('numbering.customized') })] })] }), _jsx(TableCell, { dir: "ltr", sx: { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13, textAlign: 'start', whiteSpace: 'nowrap' }, children: n.pattern }), _jsx(TableCell, { children: t(`numbering.resets.${n.reset}`) }), _jsx(TableCell, { children: _jsx(Box, { dir: "ltr", sx: { display: 'inline-block', whiteSpace: 'nowrap', px: 1.25, py: 0.4, borderRadius: '8px', bgcolor: tokens.navy50, color: tokens.navy800, fontWeight: 800, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13 }, children: n.nextNumber }) }), _jsx(TableCell, { sx: { fontSize: 12, color: tokens.gray500 }, children: n.updatedByName ? `${n.updatedByName} · ${new Date(n.updatedAt).toLocaleDateString('en-GB')}` : t('numbering.default') }), canManage && (_jsxs(TableCell, { align: "left", sx: { whiteSpace: 'nowrap' }, children: [_jsx(Tooltip, { title: t('common.edit'), children: _jsx(IconButton, { size: "small", onClick: () => setEditing(n), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }) }), n.customized && (_jsx(Tooltip, { title: t('numbering.backToDefault', { pattern: n.defaultPattern }), children: _jsx(IconButton, { size: "small", onClick: () => void request('DELETE', `${base}/${n.key}`)
                                                                    .then(reload)
                                                                    .catch((failure) => setError(errorKey(failure))), children: _jsx(RestartAltOutlinedIcon, { fontSize: "small" }) }) }))] }))] }, n.key))) })] }) })] }, group))) }), editing && (_jsx(NumberingDialog, { row: editing, onClose: () => setEditing(null), onSaved: () => {
                    setEditing(null);
                    void reload();
                } }))] }));
}
function NumberingDialog({ row, onClose, onSaved }) {
    const { t, i18n } = useTranslation();
    const [pattern, setPattern] = useState(row.pattern);
    const [reset, setReset] = useState(row.reset);
    const [startAt, setStartAt] = useState(String(row.startAt));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const start = Math.max(1, Number(startAt) || 1);
    const next = reset === row.reset ? Math.max(row.nextValue, start) : start;
    const shown = preview(pattern, next);
    const year = pattern.includes('{YYYY}') || pattern.includes('{YY}');
    const problem = !shown
        ? 'numbering.problems.pattern'
        : reset === 'Yearly' && !year
            ? 'numbering.problems.year'
            : reset === 'Monthly' && (!year || !pattern.includes('{MM}'))
                ? 'numbering.problems.month'
                : null;
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await request('PUT', `${base}/${row.key}`, { pattern: pattern.trim(), reset, startAt: start });
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('numbering.edit', { name: i18n.language === 'ar' ? row.nameAr : row.nameEn }) }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { spacing: 2, children: [_jsxs(Box, { children: [_jsx(TextField, { fullWidth: true, label: t('numbering.col.pattern'), value: pattern, onChange: (e) => setPattern(e.target.value.toUpperCase()), slotProps: { htmlInput: { dir: 'ltr', maxLength: 40, style: { fontFamily: 'ui-monospace, Consolas, monospace' } } }, helperText: t('numbering.patternHint') }), _jsx(Stack, { direction: "row", sx: { flexWrap: 'wrap', gap: 0.75, mt: 1 }, children: tokensList.map((token) => (_jsx(Chip, { size: "small", label: token, onClick: () => setPattern((p) => p + token), sx: { fontFamily: 'ui-monospace, Consolas, monospace', direction: 'ltr' } }, token))) })] }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 2, children: [_jsx(TextField, { select: true, sx: { flex: 1 }, label: t('numbering.col.reset'), value: reset, onChange: (e) => setReset(e.target.value), children: ['Never', 'Yearly', 'Monthly'].map((r) => (_jsx(MenuItem, { value: r, children: t(`numbering.resets.${r}`) }, r))) }), _jsx(TextField, { sx: { flex: 1 }, label: t('numbering.startAt'), value: startAt, onChange: (e) => setStartAt(e.target.value.replace(/\D/g, '')), helperText: t('numbering.startHint'), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'numeric' } } })] }), _jsxs(Box, { sx: { p: 2, borderRadius: `${tokens.radius}px`, bgcolor: problem ? '#fdeeee' : tokens.navy50, textAlign: 'center' }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600, mb: 0.5 }, children: t('numbering.preview') }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 24, fontWeight: 800, color: problem ? tokens.danger : tokens.navy800, fontFamily: 'ui-monospace, Consolas, monospace' }, children: shown ?? '—' }), problem && _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.danger, mt: 0.5 }, children: t(problem) })] }), reset !== row.reset && _jsx(Alert, { severity: "warning", children: t('numbering.resetWarning') })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || !!problem, onClick: () => void save(), children: t('common.save') })] })] }));
}
