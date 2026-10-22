import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Skeleton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { workflowApi } from '../../api/workflow';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { GlassHero, glassPanel } from '../../components/glass';
/**
 * «قيم الحالات» (docs/02-target-architecture/19): a screen's fixed statuses (locked, from the code) and the values the
 * company adds under «in approval» — a process's update step sets them and the record shows them as its status.
 * Added values are renamed, ordered and stopped; never deleted.
 */
export function StatusValuesPage() {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const manage = can('workflow.processes.manage', true);
    const ar = i18n.language === 'ar';
    const [screens, setScreens] = useState([]);
    const [screen, setScreen] = useState('');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(null);
    useEffect(() => {
        workflowApi
            .screens()
            .then((all) => {
            const withStatus = all.filter((s) => s.fields.some((f) => f.key === 'status' && f.type === 'Choice'));
            setScreens(withStatus);
            setScreen((current) => current || withStatus[0]?.code || '');
        })
            .catch((e) => setError(errorKey(e)));
    }, []);
    const load = useCallback(() => {
        if (!screen)
            return;
        setData(null);
        workflowApi
            .statusValues(screen)
            .then(setData)
            .catch((e) => setError(errorKey(e)));
    }, [screen]);
    useEffect(load, [load]);
    const name = (x) => (ar ? x.nameAr : x.nameEn);
    const sorted = useMemo(() => [...(data?.added ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [data]);
    const save = async (value, change) => {
        setError(null);
        try {
            await workflowApi.updateStatusValue(value.id, { nameAr: change.nameAr ?? value.nameAr, nameEn: change.nameEn ?? value.nameEn, sortOrder: change.sortOrder ?? value.sortOrder, isActive: change.isActive ?? value.isActive });
            load();
        }
        catch (e) {
            setError(errorKey(e));
        }
    };
    // Moving a value swaps its order with its neighbour's.
    const move = async (index, by) => {
        const a = sorted[index];
        const b = sorted[index + by];
        if (!a || !b)
            return;
        await save(a, { sortOrder: b.sortOrder });
        await save(b, { sortOrder: a.sortOrder });
    };
    return (_jsxs(Box, { children: [_jsx(GlassHero, { tint: "list", overline: t('statusValues.overline'), title: t('statusValues.title'), subtitle: t('statusValues.subtitle'), actions: manage && (_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), disabled: !data, onClick: () => setEditing('new'), sx: { bgcolor: '#fff', color: tokens.navy800, '&:hover': { bgcolor: '#eef4ff' } }, children: t('statusValues.add') })), children: _jsx(TextField, { select: true, size: "small", label: t('statusValues.screen'), value: screen, onChange: (e) => setScreen(e.target.value), sx: { mt: 2, minWidth: 320, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,.95)', borderRadius: '10px' } }, children: screens.map((s) => (_jsx(MenuItem, { value: s.code, children: name(s) }, s.code))) }) }), _jsx(ErrorMessage, { messageKey: error }), !data ? (_jsx(Skeleton, { variant: "rounded", height: 260, sx: { borderRadius: '16px' } })) : (_jsxs(Stack, { sx: { gap: 2 }, children: [_jsxs(Box, { sx: { ...glassPanel, p: 2.5 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 1 }, children: [_jsx(LockOutlinedIcon, { sx: { fontSize: 19, color: tokens.gray600 } }), _jsx(Typography, { component: "h2", sx: { fontSize: 15, fontWeight: 700, color: tokens.navy800 }, children: t('statusValues.system') })] }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600, mb: 1.5 }, children: t('statusValues.systemHint') }), _jsx(Stack, { direction: "row", sx: { gap: 1, flexWrap: 'wrap' }, children: data.system.map((s) => (_jsx(Chip, { icon: _jsx(LockOutlinedIcon, {}), label: name(s), variant: "outlined", sx: { bgcolor: tokens.gray50 } }, s.value))) })] }), _jsxs(Box, { sx: { ...glassPanel, p: 2.5 }, children: [_jsx(Typography, { component: "h2", sx: { fontSize: 15, fontWeight: 700, color: tokens.navy800 }, children: t('statusValues.added') }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600, mb: 1.5 }, children: t('statusValues.addedHint') }), sorted.length === 0 ? (_jsx(Alert, { severity: "info", sx: { borderRadius: '12px' }, children: t('statusValues.empty') })) : (_jsx(Box, { sx: { overflowX: 'auto' }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('statusValues.nameAr') }), _jsx(TableCell, { children: t('statusValues.nameEn') }), _jsx(TableCell, { children: t('statusValues.code') }), _jsx(TableCell, { children: t('statusValues.under') }), _jsx(TableCell, { align: "center", children: t('statusValues.inUse') }), _jsx(TableCell, { align: "center", children: t('statusValues.active') }), manage && _jsx(TableCell, { align: "center", children: t('statusValues.order') }), manage && _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: sorted.map((v, index) => (_jsxs(TableRow, { sx: { opacity: v.isActive ? 1 : 0.55 }, children: [_jsx(TableCell, { sx: { fontWeight: 700 }, children: v.nameAr }), _jsx(TableCell, { children: _jsx("bdi", { children: v.nameEn }) }), _jsx(TableCell, { children: _jsx(Box, { component: "code", dir: "ltr", sx: { fontSize: 12, color: tokens.gray600 }, children: v.code }) }), _jsx(TableCell, { children: _jsx(Chip, { size: "small", label: t('statusValues.inApproval'), sx: { bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700 } }) }), _jsx(TableCell, { align: "center", children: v.inUse }), _jsx(TableCell, { align: "center", children: _jsx(Switch, { checked: v.isActive, disabled: !manage, onChange: (e) => void save(v, { isActive: e.target.checked }), slotProps: { input: { 'aria-label': t('statusValues.active') } } }) }), manage && (_jsxs(TableCell, { align: "center", sx: { whiteSpace: 'nowrap' }, children: [_jsx(IconButton, { size: "small", disabled: index === 0, onClick: () => void move(index, -1), "aria-label": t('statusValues.up'), children: _jsx(ArrowUpwardIcon, { fontSize: "small" }) }), _jsx(IconButton, { size: "small", disabled: index === sorted.length - 1, onClick: () => void move(index, 1), "aria-label": t('statusValues.down'), children: _jsx(ArrowDownwardIcon, { fontSize: "small" }) })] })), manage && (_jsx(TableCell, { align: "center", children: _jsx(Tooltip, { title: t('statusValues.edit'), children: _jsx(IconButton, { size: "small", onClick: () => setEditing(v), "aria-label": t('statusValues.edit'), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }) }) }))] }, v.id))) })] }) }))] })] })), editing && data && (_jsx(ValueDialog, { value: editing === 'new' ? null : editing, onClose: () => setEditing(null), onSave: async (nameAr, nameEn) => {
                    if (editing === 'new') {
                        await workflowApi.createStatusValue({ screen: data.screen, nameAr, nameEn });
                    }
                    else {
                        await workflowApi.updateStatusValue(editing.id, { nameAr, nameEn, sortOrder: editing.sortOrder, isActive: editing.isActive });
                    }
                    setEditing(null);
                    load();
                } }))] }));
}
function ValueDialog({ value, onClose, onSave }) {
    const { t } = useTranslation();
    const [nameAr, setNameAr] = useState(value?.nameAr ?? '');
    const [nameEn, setNameEn] = useState(value?.nameEn ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const valid = nameAr.trim() && nameEn.trim();
    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            await onSave(nameAr, nameEn);
        }
        catch (e) {
            setError(errorKey(e));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "xs", fullWidth: true, "aria-labelledby": "value-title", children: [_jsx(DialogTitle, { id: "value-title", children: value ? t('statusValues.editTitle') : t('statusValues.addTitle') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { sx: { gap: 2 }, children: [_jsx(Alert, { severity: "info", sx: { py: 0 }, children: t('statusValues.underHint') }), _jsx(TextField, { label: t('statusValues.nameAr'), value: nameAr, onChange: (e) => setNameAr(e.target.value), required: true, autoFocus: true, slotProps: { htmlInput: { maxLength: 100 } } }), _jsx(TextField, { label: t('statusValues.nameEn'), value: nameEn, onChange: (e) => setNameEn(e.target.value), required: true, slotProps: { htmlInput: { maxLength: 100, dir: 'ltr' } } }), value && (_jsxs(Typography, { sx: { fontSize: 12, color: tokens.gray600 }, children: [t('statusValues.codeFixed'), ' ', _jsx(Box, { component: "code", dir: "ltr", children: value.code })] }))] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: !valid || busy, onClick: () => void submit(), children: t('common.save') })] })] }));
}
