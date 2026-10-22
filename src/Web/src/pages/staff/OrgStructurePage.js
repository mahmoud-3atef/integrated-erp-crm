import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, LinearProgress, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { staffApi } from '../../api/staff';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrPageHeader, HrScope, hr, hrCard } from '../../components/hr/Hr';
const colors = ['#2563EB', '#059669', '#7C3AED', '#D97706', '#0E7490', '#DB2777', '#475569'];
/** The organisation: the departments (by level) as cards with their manager and positions, seats taken and vacant. */
export function OrgStructurePage() {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const [data, setData] = useState(null);
    const [catalog, setCatalog] = useState(null);
    const [error, setError] = useState(null);
    const [department, setDepartment] = useState(null);
    const [position, setPosition] = useState(null);
    const canManage = can('staff.structure.manage', true);
    const ar = i18n.language === 'ar';
    const reload = useCallback(async () => {
        try {
            const [s, c] = await Promise.all([staffApi.structure(), staffApi.catalog()]);
            setData(s);
            setCatalog(c);
            setError(null);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);
    const remove = async (work) => {
        try {
            await work();
            await reload();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    };
    // Departments in tree order (each followed by its sections), with their depth.
    const ordered = [];
    const walk = (parent, depth) => data?.departments.filter((d) => d.parentId === parent).forEach((d) => {
        ordered.push({ d, depth });
        walk(d.id, depth + 1);
    });
    walk(null, 0);
    const nameOf = (id) => data?.departments.find((d) => d.id === id);
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(AccountTreeOutlinedIcon, {}), title: t('org.title'), subtitle: t('org.intro'), actions: canManage && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(Add, {}), disabled: !data?.departments.length || !catalog?.jobTitles.length, onClick: () => setPosition({ position: null, departmentId: data.departments[0].id }), children: t('org.newPosition') }), _jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setDepartment('new'), children: t('org.newDepartment') })] })) }), _jsx(ErrorMessage, { messageKey: error }), !data ? (_jsx(LinearProgress, {})) : (_jsxs(_Fragment, { children: [_jsxs(Box, { sx: { ...hrCard, p: 2, mb: 1.75, display: 'flex', alignItems: 'center', gap: 1.75, flexWrap: 'wrap' }, children: [_jsx(Box, { sx: { width: 50, height: 50, borderRadius: '14px', background: `linear-gradient(135deg, ${hr.navy}, ${hr.primary})`, color: '#fff', display: 'grid', placeItems: 'center' }, children: _jsx(AccountTreeOutlinedIcon, {}) }), _jsxs(Box, { sx: { flex: 1 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 16 }, children: t('org.top') }), _jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: t('org.topSub', { departments: data.departments.length, employees: data.employees, vacancies: data.vacancies }) })] }), data.unassigned > 0 && _jsx(Chip, { component: RouterLink, to: "/hr/employees?tab=incomplete", clickable: true, label: t('org.unassigned', { count: data.unassigned }), sx: { bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 600 } })] }), ordered.length === 0 ? (_jsx(Box, { sx: { ...hrCard }, children: _jsx(HrEmptyState, { icon: _jsx(AccountTreeOutlinedIcon, {}), title: t('org.empty'), hint: t('org.emptyHint') }) })) : (_jsx(Box, { sx: { display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }, children: ordered.map(({ d, depth }, n) => {
                            const color = colors[n % colors.length];
                            const parent = nameOf(d.parentId);
                            return (_jsxs(Box, { sx: { ...hrCard, p: 1.75, borderTop: `3px solid ${color}`, opacity: d.isActive ? 1 : 0.6 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 14.5 }, children: ar ? d.nameAr : d.nameEn }), _jsxs(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: [d.manager ? t('org.manager', { name: d.manager.nameAr }) : t('org.noManager'), d.costCenter && ` · ${t('org.costCenter', { code: d.costCenter })}`, depth > 0 && parent && ` · ${t('org.sub', { name: ar ? parent.nameAr : parent.nameEn })}`] })] }), _jsx(Chip, { size: "small", label: t('org.employees', { count: d.employees }), sx: { bgcolor: hr.muted, color: '#475569', fontWeight: 600 } }), canManage && (_jsxs(_Fragment, { children: [_jsx(Tooltip, { title: t('staff.profile.edit'), children: _jsx(IconButton, { size: "small", onClick: () => setDepartment(d), "aria-label": t('staff.profile.edit'), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: t('org.delete'), children: _jsx(IconButton, { size: "small", onClick: () => void remove(() => staffApi.deleteDepartment(d.id)), "aria-label": t('org.delete'), children: _jsx(DeleteOutlineOutlinedIcon, { fontSize: "small" }) }) })] }))] }), _jsxs(Stack, { sx: { gap: 0.75, mt: 1.25 }, children: [d.positions.map((p) => {
                                                const free = Math.max(0, p.seats - p.occupants.length);
                                                const first = p.occupants[0];
                                                return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, px: 1.25, py: 0.75, borderRadius: '8px', bgcolor: '#F8FAFC', fontSize: 12.5, opacity: p.isActive ? 1 : 0.6 }, children: [first ? _jsx(HrAvatar, { name: first.nameEn, size: 24 }) : _jsx(Box, { sx: { width: 24, textAlign: 'center', color: hr.textMuted }, children: "\uFF0B" }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx("b", { children: ar ? p.jobTitleAr : p.jobTitleEn }), p.grade && _jsxs("span", { style: { color: hr.textMuted }, children: [" \u00B7 ", p.grade] })] }), _jsx(Typography, { component: "span", sx: { fontSize: 12, color: free ? '#B45309' : hr.textMuted, whiteSpace: 'nowrap' }, children: p.seats === 1 ? (first ? _jsx(RouterLink, { to: `/hr/employees/${first.id}`, children: first.nameAr }) : t('org.vacant')) : t('org.seats', { taken: p.occupants.length, seats: p.seats }) }), canManage && (_jsx(IconButton, { size: "small", onClick: () => setPosition({ position: p, departmentId: d.id }), "aria-label": t('staff.profile.edit'), children: _jsx(EditOutlinedIcon, { sx: { fontSize: 16 } }) }))] }, p.id));
                                            }), canManage && catalog && catalog.jobTitles.length > 0 && (_jsx(Button, { size: "small", startIcon: _jsx(Add, {}), onClick: () => setPosition({ position: null, departmentId: d.id }), sx: { alignSelf: 'flex-start', border: `1.5px dashed #CBD5E1`, borderRadius: '8px', px: 1.5, color: hr.textMuted }, children: t('org.newPosition') }))] })] }, d.id));
                        }) }))] })), department && data && (_jsx(DepartmentDialog, { department: department === 'new' ? null : department, departments: data.departments, onClose: () => setDepartment(null), onSaved: () => {
                    setDepartment(null);
                    void reload();
                } })), position && data && catalog && (_jsx(PositionDialog, { position: position.position, departmentId: position.departmentId, departments: data.departments, catalog: catalog, onClose: () => setPosition(null), onDelete: position.position ? () => void remove(() => staffApi.deletePosition(position.position.id)).then(() => setPosition(null)) : undefined, onSaved: () => {
                    setPosition(null);
                    void reload();
                } }))] }));
}
function DepartmentDialog({ department, departments, onClose, onSaved }) {
    const { t, i18n } = useTranslation();
    const [v, setV] = useState({ nameAr: department?.nameAr ?? '', nameEn: department?.nameEn ?? '', parentId: department?.parentId ?? '', costCenter: department?.costCenter ?? '', sortOrder: department?.sortOrder ?? departments.length + 1, isActive: department?.isActive ?? true });
    const [manager, setManager] = useState(department?.manager ?? null);
    const [options, setOptions] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const search = (text) => staffApi.pick(text).then(setOptions).catch(() => setOptions([]));
    useEffect(() => {
        void search('');
    }, []);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await staffApi.saveDepartment(department?.id ?? null, { nameAr: v.nameAr, nameEn: v.nameEn || null, parentId: v.parentId || null, costCenter: v.costCenter || null, managerId: manager?.id ?? null, sortOrder: Number(v.sortOrder), isActive: v.isActive });
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "sm", slotProps: { paper: { sx: { borderRadius: `${hr.radius}px` } } }, children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('org.department.title') }), _jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 2, pt: 1 }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [_jsx(TextField, { label: t('org.department.nameAr'), value: v.nameAr, onChange: (e) => setV({ ...v, nameAr: e.target.value }), fullWidth: true, required: true }), _jsx(TextField, { label: t('org.department.nameEn'), value: v.nameEn, onChange: (e) => setV({ ...v, nameEn: e.target.value }), fullWidth: true })] }), _jsxs(TextField, { select: true, label: t('org.department.parent'), value: v.parentId, onChange: (e) => setV({ ...v, parentId: e.target.value }), slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('org.department.none') }), departments.filter((d) => d.id !== department?.id).map((d) => (_jsx(MenuItem, { value: d.id, children: i18n.language === 'ar' ? d.nameAr : d.nameEn }, d.id)))] }), _jsx(Autocomplete, { options: options, value: manager, onChange: (_, value) => setManager(value), onInputChange: (_, text) => void search(text), getOptionLabel: (o) => o.nameAr, isOptionEqualToValue: (a, b) => a.id === b.id, filterOptions: (x) => x, renderInput: (params) => _jsx(TextField, { ...params, label: t('org.department.manager') }) }), _jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [_jsx(TextField, { label: t('org.department.costCenter'), value: v.costCenter, onChange: (e) => setV({ ...v, costCenter: e.target.value }), fullWidth: true }), _jsx(TextField, { type: "number", label: t('org.department.sortOrder'), value: v.sortOrder, onChange: (e) => setV({ ...v, sortOrder: Number(e.target.value) }), fullWidth: true })] }), department && _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: v.isActive, onChange: (e) => setV({ ...v, isActive: e.target.checked }) }), label: t('org.department.active') })] }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy || !v.nameAr.trim(), children: t('common.save') })] })] }));
}
function PositionDialog({ position, departmentId, departments, catalog, onClose, onSaved, onDelete }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [v, setV] = useState({ departmentId: position?.departmentId ?? departmentId, jobTitleId: position?.jobTitleId ?? catalog.jobTitles[0]?.id ?? '', gradeId: position?.gradeId ?? '', reportsToId: position?.reportsToId ?? '', seats: position?.seats ?? 1, isActive: position?.isActive ?? true });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const peers = departments.flatMap((d) => d.positions.filter((p) => p.id !== position?.id).map((p) => ({ id: p.id, label: `${ar ? p.jobTitleAr : p.jobTitleEn} — ${ar ? d.nameAr : d.nameEn}` })));
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await staffApi.savePosition(position?.id ?? null, { departmentId: v.departmentId, jobTitleId: v.jobTitleId, gradeId: v.gradeId || null, reportsToId: v.reportsToId || null, seats: Number(v.seats), isActive: v.isActive });
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "sm", slotProps: { paper: { sx: { borderRadius: `${hr.radius}px` } } }, children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('org.position.title') }), _jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 2, pt: 1 }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(TextField, { select: true, label: t('org.position.department'), value: v.departmentId, onChange: (e) => setV({ ...v, departmentId: e.target.value }), children: departments.map((d) => (_jsx(MenuItem, { value: d.id, children: ar ? d.nameAr : d.nameEn }, d.id))) }), _jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [_jsx(TextField, { select: true, label: t('org.position.jobTitle'), value: v.jobTitleId, onChange: (e) => setV({ ...v, jobTitleId: e.target.value }), fullWidth: true, children: catalog.jobTitles.filter((j) => j.isActive || j.id === v.jobTitleId).map((j) => (_jsx(MenuItem, { value: j.id, children: ar ? j.nameAr : j.nameEn }, j.id))) }), _jsxs(TextField, { select: true, label: t('org.position.grade'), value: v.gradeId, onChange: (e) => setV({ ...v, gradeId: e.target.value }), fullWidth: true, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: "\u2014" }), catalog.grades.filter((g) => g.isActive || g.id === v.gradeId).map((g) => (_jsxs(MenuItem, { value: g.id, children: [g.code, " \u00B7 ", g.nameAr] }, g.id)))] })] }), _jsxs(TextField, { select: true, label: t('org.position.reportsTo'), value: v.reportsToId, onChange: (e) => setV({ ...v, reportsToId: e.target.value }), slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('org.position.none') }), peers.map((p) => (_jsx(MenuItem, { value: p.id, children: p.label }, p.id)))] }), _jsxs(Stack, { direction: "row", sx: { gap: 1.5, alignItems: 'center' }, children: [_jsx(TextField, { type: "number", label: t('org.position.seats'), value: v.seats, onChange: (e) => setV({ ...v, seats: Number(e.target.value) }), sx: { width: 160 }, slotProps: { htmlInput: { min: 1, max: 500 } } }), position && _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: v.isActive, onChange: (e) => setV({ ...v, isActive: e.target.checked }) }), label: t('org.position.active') })] })] }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [onDelete && (_jsx(Button, { color: "error", onClick: onDelete, disabled: busy, sx: { marginInlineEnd: 'auto' }, children: t('org.delete') })), _jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy || !v.jobTitleId, children: t('common.save') })] })] }));
}
