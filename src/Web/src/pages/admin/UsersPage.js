import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { Box, Button, Autocomplete, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, useMediaQuery, useTheme, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { staffApi } from '../../api/staff';
import { accessApi, localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, EmptyState, Initials, PageHeader, Panel, StatusDot } from '../../components/ui';
const allEntities = 'all';
export function UsersPage() {
    const { t, i18n } = useTranslation();
    const { can, reload: reloadSession } = useSession();
    const [members, setMembers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [entities, setEntities] = useState([]);
    const [editing, setEditing] = useState(null);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState(null);
    const canManage = can('identity.users.manage', true);
    const load = useCallback(async () => {
        try {
            const [m, r, e] = await Promise.all([accessApi.members(), can('identity.roles.view', true) ? accessApi.roles() : Promise.resolve([]), accessApi.legalEntities()]);
            setMembers(m);
            setRoles(r);
            setEntities(e);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [can]);
    useEffect(() => {
        void load();
    }, [load]);
    const roleName = (id) => {
        const role = roles.find((r) => r.id === id);
        return role ? localName(role, i18n.language) : '…';
    };
    const entityCode = (id) => (id ? (entities.find((e) => e.id === id)?.code ?? '…') : null);
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('users.title'), subtitle: t('users.intro'), actions: canManage && (_jsx(Button, { variant: "contained", startIcon: _jsx(PersonAddIcon, {}), onClick: () => setAdding(true), children: t('users.add') })) }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Panel, { children: [_jsx(TableContainer, { sx: { borderRadius: '6px' }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('users.name') }), _jsx(TableCell, { children: t('users.roles') }), _jsx(TableCell, { children: t('common.status') }), canManage && _jsx(TableCell, { align: "center", children: t('common.actions') })] }) }), _jsx(TableBody, { children: members.map((member) => (_jsxs(TableRow, { hover: true, children: [_jsx(TableCell, { children: _jsxs(Stack, { direction: "row", spacing: 1.25, sx: { alignItems: 'center' }, children: [_jsx(Initials, { name: member.displayName, size: 30 }), _jsxs(Box, { children: [_jsx(Typography, { noWrap: true, sx: { fontSize: 13, fontWeight: 500, color: tokens.gray900 }, children: member.displayName }), member.userName && (_jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: member.userName }))] })] }) }), _jsx(TableCell, { sx: { whiteSpace: 'normal' }, children: member.roles.length === 0 ? (_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('users.noRoles') })) : (_jsx(Stack, { direction: "row", sx: { gap: 0.5, flexWrap: 'wrap' }, children: member.roles.map((a) => (_jsx(Badge, { tone: "primary", children: entityCode(a.legalEntityId) ? `${roleName(a.roleId)} · ${entityCode(a.legalEntityId)}` : roleName(a.roleId) }, `${a.roleId}-${a.legalEntityId ?? allEntities}`))) })) }), _jsx(TableCell, { children: _jsx(StatusDot, { tone: member.isActive ? 'success' : 'warning', label: member.isActive ? t('common.active') : t('common.inactive') }) }), canManage && (_jsx(TableCell, { align: "center", children: _jsx(Tooltip, { title: t('common.edit'), children: _jsx(IconButton, { size: "small", onClick: () => setEditing(member), "aria-label": `${t('common.edit')} ${member.displayName}`, children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }) }) }))] }, member.membershipId))) })] }) }), members.length === 0 && _jsx(EmptyState, { text: t('common.empty') })] }), adding && (_jsx(AddMemberDialog, { onClose: () => setAdding(false), onAdded: (member) => {
                    setAdding(false);
                    void load();
                    setEditing(member);
                } })), editing && (_jsx(MemberDialog, { member: editing, roles: roles, entities: entities, onClose: () => setEditing(null), onSaved: () => {
                    setEditing(null);
                    void load();
                    // My own roles may have changed: refresh the menu.
                    void reloadSession();
                } }))] }));
}
function AddMemberDialog({ onClose, onAdded }) {
    const { t } = useTranslation();
    const [userName, setUserName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            onAdded(await accessApi.addMember(userName.trim()));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "xs", children: _jsxs(Box, { component: "form", onSubmit: submit, noValidate: true, children: [_jsx(DialogTitle, { children: t('users.add') }), _jsxs(DialogContent, { children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Typography, { color: "text.secondary", sx: { mb: 2 }, children: t('users.addIntro') }), _jsx(TextField, { label: t('login.userName'), helperText: t('login.userNameHint'), value: userName, onChange: (e) => setUserName(e.target.value), autoFocus: true, fullWidth: true, required: true, slotProps: { htmlInput: { dir: 'ltr', autoComplete: 'off' } } })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { type: "submit", variant: "contained", disabled: busy || !userName.trim(), children: busy ? t('common.loading') : t('users.addSubmit') })] })] }) }));
}
function MemberDialog({ member, roles, entities, onClose, onSaved }) {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const phone = useMediaQuery(theme.breakpoints.down('sm'));
    const [rows, setRows] = useState(member.roles);
    const { can } = useSession();
    const canLink = can('staff.manage', true);
    const [employee, setEmployee] = useState(null);
    const [linked, setLinked] = useState(null);
    const [people, setPeople] = useState([]);
    const [search, setSearch] = useState('');
    useEffect(() => {
        if (!can('staff.view', true))
            return;
        staffApi
            .userLinks()
            .then((links) => {
            const mine = links.find((l) => l.userId === member.userAccountId);
            setEmployee(mine ? { id: mine.employeeId, nameAr: mine.nameAr, nameEn: mine.nameEn } : null);
            setLinked(mine?.employeeId ?? null);
        })
            .catch(() => undefined);
    }, [member.userAccountId, can]);
    useEffect(() => {
        if (!canLink)
            return;
        const timer = setTimeout(() => staffApi.pick(search).then(setPeople).catch(() => setPeople([])), 250);
        return () => clearTimeout(timer);
    }, [search, canLink]);
    const [active, setActive] = useState(member.isActive);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const update = (index, change) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            if (active !== member.isActive) {
                await accessApi.setActive(member.membershipId, active);
            }
            await accessApi.setRoles(member.membershipId, rows.filter((r) => r.roleId));
            if (canLink && (employee?.id ?? null) !== linked) {
                await staffApi.linkUser(member.userAccountId, employee?.id ?? null);
            }
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", fullScreen: phone, children: [_jsx(DialogTitle, { children: member.displayName }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(FormControlLabel, { control: _jsx(Switch, { checked: active, onChange: (e) => setActive(e.target.checked) }), label: t('users.active'), sx: { mb: 2 } }), can('staff.view', true) && (_jsxs(Box, { sx: { mb: 2.5 }, children: [_jsx(Typography, { variant: "subtitle1", children: t('users.employee') }), _jsx(Typography, { variant: "body2", color: "text.secondary", sx: { mb: 1 }, children: t('users.employeeIntro') }), _jsx(Autocomplete, { size: "small", disabled: !canLink, options: people, value: employee, onChange: (_, v) => setEmployee(v), onInputChange: (_, v) => setSearch(v), getOptionLabel: (o) => (i18n.language === 'ar' ? o.nameAr : o.nameEn), isOptionEqualToValue: (a, b) => a.id === b.id, filterOptions: (x) => x, renderInput: (params) => _jsx(TextField, { ...params, label: t('users.employeePick') }) })] })), _jsx(Typography, { variant: "subtitle1", children: t('users.roles') }), _jsx(Typography, { variant: "body2", color: "text.secondary", sx: { mb: 2 }, children: t('users.rolesIntro') }), _jsx(Stack, { spacing: 1.5, children: rows.map((row, index) => (_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 1, sx: { alignItems: { sm: 'center' } }, children: [_jsx(TextField, { select: true, label: t('users.role'), value: row.roleId, onChange: (e) => update(index, { roleId: e.target.value }), sx: { flex: 1 }, size: "small", children: roles.map((r) => (_jsx(MenuItem, { value: r.id, children: localName(r, i18n.language) }, r.id))) }), _jsxs(TextField, { select: true, label: t('users.scope'), value: row.legalEntityId ?? allEntities, onChange: (e) => update(index, { legalEntityId: e.target.value === allEntities ? null : e.target.value }), sx: { flex: 1 }, size: "small", children: [_jsx(MenuItem, { value: allEntities, children: t('users.allEntities') }), entities.map((e) => (_jsx(MenuItem, { value: e.id, children: `${e.code} — ${localName(e, i18n.language)}` }, e.id)))] }), _jsx(IconButton, { "aria-label": t('users.removeRole'), onClick: () => setRows((current) => current.filter((_, i) => i !== index)), sx: { alignSelf: { xs: 'flex-end', sm: 'center' } }, children: _jsx(DeleteIcon, {}) })] }, index))) }), _jsx(Button, { startIcon: _jsx(AddIcon, {}), onClick: () => setRows((current) => [...current, { roleId: roles[0]?.id ?? '', legalEntityId: null }]), sx: { mt: 1.5 }, disabled: roles.length === 0, children: t('users.addRole') })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy, children: busy ? t('common.loading') : t('common.save') })] })] }));
}
