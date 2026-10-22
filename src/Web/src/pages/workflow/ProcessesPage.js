import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { workflowApi } from '../../api/workflow';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, EmptyState, PageHeader, Panel, StatusDot } from '../../components/ui';
/** Approval processes of the company, like the CRM list of workflow processes. */
export function ProcessesPage() {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [screens, setScreens] = useState([]);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);
    const canManage = can('workflow.processes.manage', true);
    const load = useCallback(async () => {
        try {
            const [p, s] = await Promise.all([workflowApi.processes(), workflowApi.screens()]);
            setRows(p);
            setScreens(s);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    const ar = i18n.language === 'ar';
    const when = (value) => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(value));
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('process.listTitle'), subtitle: t('process.listIntro'), actions: canManage && (_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => setCreating(true), children: t('process.new') })) }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Panel, { children: [_jsx(TableContainer, { sx: { borderRadius: '6px' }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('process.name') }), _jsx(TableCell, { children: t('process.screen') }), _jsx(TableCell, { children: t('process.priority') }), _jsx(TableCell, { children: t('process.version') }), _jsx(TableCell, { children: t('common.status') }), _jsx(TableCell, { align: "center", children: t('common.actions') })] }) }), _jsx(TableBody, { children: rows.map((row) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/workflow/processes/${row.id}`), children: [_jsx(TableCell, { sx: { fontWeight: 600, color: tokens.navy800 }, children: localName(row, i18n.language) }), _jsx(TableCell, { children: ar ? row.screenNameAr : row.screenNameEn }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums' }, children: row.priority }), _jsxs(TableCell, { children: [_jsxs(Stack, { direction: "row", sx: { gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }, children: [row.currentVersion > 0 ? _jsx(Badge, { tone: "primary", children: t('routes.version', { version: row.currentVersion }) }) : '—', row.hasUnpublishedChanges && _jsx(Badge, { tone: "warning", children: t('process.unpublished') })] }), row.publishedAt && _jsx(Box, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: `${row.publishedBy} — ${when(row.publishedAt)}` })] }), _jsx(TableCell, { children: _jsx(StatusDot, { tone: row.isActive ? 'success' : 'neutral', label: row.isActive ? t('process.activeStatus') : t('process.draftStatus') }) }), _jsx(TableCell, { align: "center", children: _jsx(Tooltip, { title: t('common.edit'), children: _jsx(IconButton, { size: "small", "aria-label": `${t('common.edit')} ${localName(row, i18n.language)}`, children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }) }) })] }, row.id))) })] }) }), rows.length === 0 && _jsx(EmptyState, { text: t('process.empty') })] }), creating && (_jsx(NewProcessDialog, { screens: screens, onClose: () => setCreating(false), onCreated: (id) => navigate(`/workflow/processes/${id}`) }))] }));
}
function NewProcessDialog({ screens, onClose, onCreated }) {
    const { t, i18n } = useTranslation();
    const [screen, setScreen] = useState(screens[0]?.code ?? '');
    const [nameAr, setNameAr] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [priority, setPriority] = useState('10');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const create = async () => {
        setBusy(true);
        setError(null);
        try {
            const created = await workflowApi.createProcess({ screen, nameAr, nameEn, priority: Number(priority) || 0 });
            onCreated(created.process.id);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('process.new') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { spacing: 2, children: [_jsx(TextField, { select: true, label: t('process.screen'), helperText: t('process.screenHint'), value: screen, onChange: (e) => setScreen(e.target.value), children: screens.map((s) => (_jsx(MenuItem, { value: s.code, children: localName(s, i18n.language) }, s.code))) }), _jsx(TextField, { label: t('fields.NameAr'), value: nameAr, onChange: (e) => setNameAr(e.target.value), required: true, slotProps: { htmlInput: { dir: 'rtl', maxLength: 200 } } }), _jsx(TextField, { label: t('fields.NameEn'), value: nameEn, onChange: (e) => setNameEn(e.target.value), required: true, slotProps: { htmlInput: { dir: 'ltr', maxLength: 200 } } }), _jsx(TextField, { label: t('process.priority'), helperText: t('process.priorityHint'), value: priority, onChange: (e) => setPriority(e.target.value.replace(/\D/g, '').slice(0, 4)), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'numeric' } } })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void create(), disabled: busy || !screen || !nameAr.trim() || !nameEn.trim(), children: busy ? t('common.loading') : t('process.create') })] })] }));
}
