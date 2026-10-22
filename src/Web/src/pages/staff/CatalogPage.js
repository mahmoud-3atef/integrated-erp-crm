import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { staffApi } from '../../api/staff';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrPageHeader, HrScope, hr, hrCard } from '../../components/hr/Hr';
/** The job titles and the grades with their basic band (the positions of the organisation use them). */
export function CatalogPage() {
    const { t } = useTranslation();
    const { can } = useSession();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [title, setTitle] = useState(null);
    const [grade, setGrade] = useState(null);
    const canManage = can('staff.structure.manage', true);
    const reload = useCallback(async () => {
        try {
            setData(await staffApi.catalog());
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);
    const money = (n) => (n === null ? '—' : n.toLocaleString('en-US'));
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(CategoryOutlinedIcon, {}), title: t('catalog.title'), subtitle: t('catalog.intro') }), _jsx(ErrorMessage, { messageKey: error }), !data ? (_jsx(LinearProgress, {})) : (_jsxs(Box, { sx: { display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, alignItems: 'start' }, children: [_jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', mb: 1.25 }, children: [_jsx(Typography, { sx: { fontWeight: 700, flex: 1 }, children: t('catalog.jobTitles') }), canManage && (_jsx(Button, { size: "small", variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setTitle('new'), children: t('catalog.newTitle') }))] }), _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('catalog.nameAr') }), _jsx(TableCell, { children: t('catalog.nameEn') }), _jsx(TableCell, { children: t('catalog.occupation') }), _jsx(TableCell, { align: "right", children: t('catalog.positions') }), _jsx(TableCell, {})] }) }), _jsxs(TableBody, { children: [data.jobTitles.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 5, sx: { color: hr.textMuted }, children: t('catalog.empty') }) })), data.jobTitles.map((j) => (_jsxs(TableRow, { hover: true, sx: { opacity: j.isActive ? 1 : 0.55 }, children: [_jsx(TableCell, { sx: { fontWeight: 600 }, children: j.nameAr }), _jsx(TableCell, { children: j.nameEn }), _jsx(TableCell, { children: _jsx("bdi", { children: j.occupationCode ?? '—' }) }), _jsx(TableCell, { align: "right", children: j.positions }), _jsx(TableCell, { align: "right", children: canManage && (_jsx(IconButton, { size: "small", onClick: () => setTitle(j), "aria-label": t('staff.profile.edit'), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) })) })] }, j.id)))] })] })] }), _jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', mb: 1.25 }, children: [_jsx(Typography, { sx: { fontWeight: 700, flex: 1 }, children: t('catalog.grades') }), canManage && (_jsx(Button, { size: "small", variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setGrade('new'), children: t('catalog.newGrade') }))] }), _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('catalog.code') }), _jsx(TableCell, { children: t('catalog.nameAr') }), _jsx(TableCell, { children: t('catalog.band') }), _jsx(TableCell, { align: "right", children: t('catalog.positions') }), _jsx(TableCell, {})] }) }), _jsxs(TableBody, { children: [data.grades.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 5, sx: { color: hr.textMuted }, children: t('catalog.empty') }) })), data.grades.map((g) => (_jsxs(TableRow, { hover: true, sx: { opacity: g.isActive ? 1 : 0.55 }, children: [_jsx(TableCell, { sx: { fontWeight: 700 }, children: _jsx("bdi", { children: g.code }) }), _jsx(TableCell, { children: g.nameAr }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums' }, children: _jsxs("bdi", { children: [money(g.minBasic), " \u2013 ", money(g.maxBasic)] }) }), _jsx(TableCell, { align: "right", children: g.positions }), _jsx(TableCell, { align: "right", children: canManage && (_jsx(IconButton, { size: "small", onClick: () => setGrade(g), "aria-label": t('staff.profile.edit'), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) })) })] }, g.id)))] })] })] })] })), title && _jsx(TitleDialog, { title: title === 'new' ? null : title, onClose: () => setTitle(null), onSaved: () => (setTitle(null), void reload()) }), grade && _jsx(GradeDialog, { grade: grade === 'new' ? null : grade, onClose: () => setGrade(null), onSaved: () => (setGrade(null), void reload()) })] }));
}
function useSave(onSaved) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const run = async (work) => {
        setBusy(true);
        setError(null);
        try {
            await work();
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return { busy, error, run };
}
function TitleDialog({ title, onClose, onSaved }) {
    const { t } = useTranslation();
    const [v, setV] = useState({ nameAr: title?.nameAr ?? '', nameEn: title?.nameEn ?? '', occupationCode: title?.occupationCode ?? '', isActive: title?.isActive ?? true });
    const { busy, error, run } = useSave(onSaved);
    return (_jsxs(Dialog, { open: true, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "xs", slotProps: { paper: { sx: { borderRadius: `${hr.radius}px` } } }, children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('catalog.newTitle') }), _jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 2, pt: 1 }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(TextField, { label: t('catalog.nameAr'), value: v.nameAr, onChange: (e) => setV({ ...v, nameAr: e.target.value }), required: true }), _jsx(TextField, { label: t('catalog.nameEn'), value: v.nameEn, onChange: (e) => setV({ ...v, nameEn: e.target.value }) }), _jsx(TextField, { label: t('catalog.occupation'), value: v.occupationCode, onChange: (e) => setV({ ...v, occupationCode: e.target.value }) }), title && _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: v.isActive, onChange: (e) => setV({ ...v, isActive: e.target.checked }) }), label: t('catalog.active') })] }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || !v.nameAr.trim(), onClick: () => void run(() => staffApi.saveJobTitle(title?.id ?? null, { nameAr: v.nameAr, nameEn: v.nameEn || null, occupationCode: v.occupationCode || null, isActive: v.isActive })), children: t('common.save') })] })] }));
}
function GradeDialog({ grade, onClose, onSaved }) {
    const { t } = useTranslation();
    const [v, setV] = useState({ code: grade?.code ?? '', nameAr: grade?.nameAr ?? '', minBasic: grade?.minBasic?.toString() ?? '', maxBasic: grade?.maxBasic?.toString() ?? '', isActive: grade?.isActive ?? true });
    const { busy, error, run } = useSave(onSaved);
    const num = (s) => (s.trim() === '' ? null : Number(s));
    return (_jsxs(Dialog, { open: true, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "xs", slotProps: { paper: { sx: { borderRadius: `${hr.radius}px` } } }, children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('catalog.newGrade') }), _jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 2, pt: 1 }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [_jsx(TextField, { label: t('catalog.code'), value: v.code, onChange: (e) => setV({ ...v, code: e.target.value }), required: true, sx: { width: 110 } }), _jsx(TextField, { label: t('catalog.nameAr'), value: v.nameAr, onChange: (e) => setV({ ...v, nameAr: e.target.value }), required: true, fullWidth: true })] }), _jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [_jsx(TextField, { type: "number", label: t('catalog.min'), value: v.minBasic, onChange: (e) => setV({ ...v, minBasic: e.target.value }), fullWidth: true }), _jsx(TextField, { type: "number", label: t('catalog.max'), value: v.maxBasic, onChange: (e) => setV({ ...v, maxBasic: e.target.value }), fullWidth: true })] }), grade && _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: v.isActive, onChange: (e) => setV({ ...v, isActive: e.target.checked }) }), label: t('catalog.active') })] }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || !v.code.trim() || !v.nameAr.trim(), onClick: () => void run(() => staffApi.saveGrade(grade?.id ?? null, { code: v.code, nameAr: v.nameAr, minBasic: num(v.minBasic), maxBasic: num(v.maxBasic), isActive: v.isActive })), children: t('common.save') })] })] }));
}
