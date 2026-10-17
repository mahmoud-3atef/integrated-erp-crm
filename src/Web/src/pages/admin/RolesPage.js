import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, useMediaQuery, useTheme, } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accessApi, localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PageHeader, Panel } from '../../components/ui';
export function RolesPage() {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const [roles, setRoles] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState(null);
    const canManage = can('identity.roles.manage', true);
    const load = useCallback(async () => {
        try {
            const [r, p] = await Promise.all([accessApi.roles(), accessApi.permissions()]);
            setRoles(r);
            setPermissions(p);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('roles.title'), subtitle: t('roles.intro'), actions: canManage && (_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => setEditing('new'), children: t('roles.new') })) }), _jsx(ErrorMessage, { messageKey: error }), _jsx(Panel, { children: _jsx(TableContainer, { sx: { borderRadius: '6px' }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('roles.name') }), _jsx(TableCell, { children: t('roles.type') }), _jsx(TableCell, { children: t('roles.permissions') }), _jsx(TableCell, { align: "center", children: t('common.actions') })] }) }), _jsx(TableBody, { children: (roles ?? []).map((role) => (_jsxs(TableRow, { hover: true, children: [_jsx(TableCell, { sx: { fontWeight: 500, color: tokens.gray900 }, children: localName(role, i18n.language) }), _jsx(TableCell, { children: role.kind === 'Custom' ? _jsx(Badge, { tone: "neutral", children: t('roles.custom') }) : _jsx(Badge, { tone: "primary", icon: _jsx(LockOutlinedIcon, {}), children: t('roles.builtIn') }) }), _jsx(TableCell, { children: t('roles.permissionCount', { count: role.permissions.length }) }), _jsx(TableCell, { align: "center", children: _jsx(Tooltip, { title: canManage && role.kind === 'Custom' ? t('common.edit') : t('roles.permissions'), children: _jsx(IconButton, { size: "small", onClick: () => setEditing(role), "aria-label": `${t('common.edit')} ${localName(role, i18n.language)}`, children: canManage && role.kind === 'Custom' ? _jsx(EditOutlinedIcon, { fontSize: "small" }) : _jsx(VisibilityOutlinedIcon, { fontSize: "small" }) }) }) })] }, role.id))) })] }) }) }), editing && (_jsx(RoleDialog, { role: editing === 'new' ? null : editing, permissions: permissions, readOnly: !canManage || (editing !== 'new' && editing.kind !== 'Custom'), onClose: () => setEditing(null), onSaved: () => {
                    setEditing(null);
                    void load();
                } }))] }));
}
function RoleDialog({ role, permissions, readOnly, onClose, onSaved }) {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const phone = useMediaQuery(theme.breakpoints.down('sm'));
    const [code, setCode] = useState(role?.code ?? '');
    const [nameAr, setNameAr] = useState(role?.nameAr ?? '');
    const [nameEn, setNameEn] = useState(role?.nameEn ?? '');
    const [selected, setSelected] = useState(new Set(role?.permissions ?? []));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const groups = useMemo(() => {
        const byGroup = new Map();
        for (const p of permissions) {
            const key = i18n.language === 'ar' ? p.groupAr : p.groupEn;
            byGroup.set(key, [...(byGroup.get(key) ?? []), p]);
        }
        return [...byGroup.entries()];
    }, [permissions, i18n.language]);
    const toggle = (codes, on) => setSelected((current) => {
        const next = new Set(current);
        codes.forEach((c) => (on ? next.add(c) : next.delete(c)));
        return next;
    });
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const input = { code, nameAr, nameEn, permissions: [...selected] };
            await (role ? accessApi.updateRole(role.id, input) : accessApi.createRole(input));
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", fullScreen: phone, children: [_jsx(DialogTitle, { children: role ? localName(role, i18n.language) : t('roles.new') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), readOnly && role?.kind !== 'Custom' && role && (_jsx(Alert, { severity: "info", sx: { mb: 2 }, children: t(role.kind === 'Administrator' ? 'roles.builtInAdmin' : 'roles.builtInReadOnly') })), _jsxs(Stack, { spacing: 2, sx: { mb: 2 }, children: [!role && (_jsx(TextField, { label: t('roles.code'), helperText: t('roles.codeHint'), value: code, onChange: (e) => setCode(e.target.value), required: true, slotProps: { htmlInput: { dir: 'ltr', maxLength: 50 } } })), _jsx(TextField, { label: t('roles.nameAr'), value: nameAr, onChange: (e) => setNameAr(e.target.value), required: true, disabled: readOnly, slotProps: { htmlInput: { dir: 'rtl', lang: 'ar' } } }), _jsx(TextField, { label: t('roles.nameEn'), value: nameEn, onChange: (e) => setNameEn(e.target.value), required: true, disabled: readOnly, slotProps: { htmlInput: { dir: 'ltr', lang: 'en' } } })] }), _jsx(Typography, { variant: "subtitle1", gutterBottom: true, children: t('roles.permissions') }), groups.map(([group, items]) => {
                        const codes = items.map((p) => p.code);
                        const count = codes.filter((c) => selected.has(c)).length;
                        return (_jsxs(Box, { sx: { mb: 1.5 }, children: [_jsx(FormControlLabel, { label: _jsx(Typography, { sx: { fontWeight: 600 }, children: group }), control: _jsx(Checkbox, { checked: count === codes.length, indeterminate: count > 0 && count < codes.length, onChange: (e) => toggle(codes, e.target.checked), disabled: readOnly }) }), _jsx(Stack, { sx: { pl: 4 }, children: items.map((p) => (_jsx(FormControlLabel, { label: localName(p, i18n.language), control: _jsx(Checkbox, { checked: selected.has(p.code), onChange: (e) => toggle([p.code], e.target.checked), disabled: readOnly, size: "small" }) }, p.code))) })] }, group));
                    })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: readOnly ? t('common.close') : t('common.cancel') }), !readOnly && (_jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy || !nameAr.trim() || !nameEn.trim() || (!role && !code.trim()), children: busy ? t('common.loading') : t('common.save') }))] })] }));
}
