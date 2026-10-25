import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Link, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { staffApi } from '../../api/staff';
import { ErrorMessage } from '../../auth/AuthLayout';
import { DateField } from '../../components/DateField';
import { wf } from '../../components/designKit';
const today = () => new Date().toISOString().slice(0, 10);
const empty = () => ({
    nameEn: null,
    nameAr: null,
    nationality: null,
    idNumber: null,
    hireDate: today(),
    probationDays: 90,
    legalEntity: null,
    department: null,
    position: null,
    basic: null,
    housing: null,
    food: null,
    transport: null,
    mobile: null,
    project: null,
    other: null,
    mobileNumber: null,
    email: null,
});
const nz = (value) => (value.trim() === '' ? null : value);
const nn = (value) => (value.trim() === '' ? null : Number(value));
/**
 * Adding employees (the user's request, 2026-10-25), like the workers but with an employee's data: no sponsor and no
 * border number; the job (registration, department, position with a free seat), the nationality and the salary. One
 * from the form, or many from the template, checked first; «اعتماد وإنشاء» creates the whole set when every row is clean.
 */
export function AddStaffDialog({ initialMode = 'one', onClose, onCreated }) {
    const { t } = useTranslation();
    const [mode, setMode] = useState(initialMode);
    const [options, setOptions] = useState(null);
    const [result, setResult] = useState(null);
    useEffect(() => {
        staffApi.newOptions().then(setOptions).catch(() => setOptions({ nationalities: [], legalEntities: [], departments: [], nextNumber: '' }));
    }, []);
    const done = (created) => {
        setResult(created);
        onCreated(created.created.map((c) => c.id));
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: mode === 'sheet' ? 'xl' : 'md', slotProps: { paper: { sx: { borderRadius: '18px' } } }, children: [_jsxs(DialogTitle, { sx: { fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }, children: [t('staff.create.title'), !result && (_jsxs(ToggleButtonGroup, { size: "small", exclusive: true, value: mode, onChange: (_, v) => v && setMode(v), children: [_jsx(ToggleButton, { value: "one", children: t('staff.create.one') }), _jsx(ToggleButton, { value: "sheet", children: t('staff.create.sheet') })] }))] }), result ? (_jsx(Created, { result: result, onClose: onClose })) : !options ? (_jsx(DialogContent, { children: _jsx(LinearProgress, {}) })) : mode === 'one' ? (_jsx(OneEmployee, { options: options, onClose: onClose, onCreated: done })) : (_jsx(FromSheet, { options: options, onClose: onClose, onCreated: done }))] }));
}
function useIssue() {
    const { t } = useTranslation();
    return (field, code) => `${t(`staff.create.fields.${field}`)}: ${t(`staff.create.issues.${code}`)}`;
}
/** The positions of a department, with their free seats. */
function positionsOf(options, department, ar, t) {
    return (options.departments.find((d) => d.id === department)?.positions ?? []).map((p) => ({ id: p.id, label: t('staff.create.positionLabel', { title: ar ? p.jobTitleAr : p.jobTitleEn, free: p.free }), free: p.free }));
}
function OneEmployee({ options, onClose, onCreated }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const issue = useIssue();
    const [e, setE] = useState({ ...empty(), legalEntity: options.legalEntities.length === 1 ? options.legalEntities[0].id : null });
    const [issues, setIssues] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const set = (key, value) => setE((x) => ({ ...x, [key]: value }));
    const errorOf = (field) => issues.find((i) => i.field === field);
    const helper = (field) => (errorOf(field) ? t(`staff.create.issues.${errorOf(field).code}`) : undefined);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const result = await staffApi.createNew([e]);
            if (result.created.length > 0)
                onCreated(result);
            else
                setIssues(result.rows[0]?.issues ?? []);
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    const select = (field, list, onPick) => (_jsxs(TextField, { select: true, size: "small", required: true, label: t(`staff.create.fields.${field}`), value: e[field] ?? '', onChange: (ev) => {
            set(field, nz(ev.target.value));
            onPick?.();
        }, error: !!errorOf(field), helperText: helper(field), children: [_jsx(MenuItem, { value: "", children: "\u2014" }), list.map((o) => (_jsx(MenuItem, { value: o.id, children: ar ? o.nameAr : o.nameEn }, o.id)))] }));
    const text = (field, ltr = false, required = false) => (_jsx(TextField, { size: "small", required: required, label: t(`staff.create.fields.${field}`), value: e[field] ?? '', onChange: (ev) => set(field, nz(ev.target.value)), error: !!errorOf(field), helperText: helper(field), slotProps: { htmlInput: { maxLength: field.startsWith('name') ? 300 : 200, dir: ltr ? 'ltr' : undefined } } }));
    const money = (field, required = false) => (_jsx(TextField, { size: "small", type: "number", required: required, label: t(`staff.create.fields.${field}`), value: e[field] ?? '', onChange: (ev) => set(field, nn(ev.target.value)), error: !!errorOf(field), helperText: helper(field), slotProps: { htmlInput: { min: 0, step: 'any' } } }));
    const grid = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.5 };
    const title = (key) => _jsx(Typography, { sx: { fontWeight: 700, color: wf.navy, mt: 0.5 }, children: t(key) });
    const total = ['basic', 'housing', 'food', 'transport', 'mobile', 'project', 'other'].reduce((s, k) => s + (Number(e[k]) || 0), 0);
    return (_jsxs(_Fragment, { children: [_jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 1.5, pt: 1 }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Alert, { severity: "info", children: t('staff.create.numberHint', { number: options.nextNumber }) }), issues.length > 0 && _jsx(Alert, { severity: "warning", children: issues.map((i) => issue(i.field, i.code)).join(' · ') }), title('staff.profile.boxes.basic'), _jsxs(Box, { sx: grid, children: [text('nameEn', true, true), text('nameAr'), select('nationality', options.nationalities), text('idNumber', true), text('mobileNumber', true), text('email', true)] }), title('staff.profile.boxes.job'), _jsxs(Box, { sx: grid, children: [select('legalEntity', options.legalEntities), select('department', options.departments, () => set('position', null)), _jsxs(TextField, { select: true, size: "small", required: true, label: t('staff.create.fields.position'), value: e.position ?? '', onChange: (ev) => set('position', nz(ev.target.value)), disabled: !e.department, error: !!errorOf('position'), helperText: helper('position'), children: [_jsx(MenuItem, { value: "", children: "\u2014" }), positionsOf(options, e.department, ar, t).map((p) => (_jsx(MenuItem, { value: p.id, disabled: p.free <= 0, children: p.label }, p.id)))] }), _jsx(DateField, { size: "small", required: true, label: t('staff.create.fields.hireDate'), value: e.hireDate ?? '', onChange: (ev) => set('hireDate', nz(ev.target.value)), error: !!errorOf('hireDate'), helperText: helper('hireDate'), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { size: "small", type: "number", label: t('staff.create.fields.probationDays'), value: e.probationDays ?? '', onChange: (ev) => set('probationDays', nn(ev.target.value)), error: !!errorOf('probationDays'), helperText: helper('probationDays'), slotProps: { htmlInput: { min: 0, max: 180 } } })] }), title('staff.profile.boxes.salary'), _jsxs(Box, { sx: grid, children: [money('basic', true), money('housing'), money('food'), money('transport'), money('mobile'), money('project'), money('other')] }), _jsxs(Typography, { sx: { fontWeight: 700, color: '#1f9d55' }, children: [t('staff.profile.fields.total'), ": ", _jsx("bdi", { children: total.toLocaleString('en-US') })] })] }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy, sx: { bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }, children: t('staff.create.save') })] })] }));
}
function FromSheet({ options, onClose, onCreated }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const issue = useIssue();
    const [rows, setRows] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [dirty, setDirty] = useState(false);
    const input = useRef(null);
    const run = async (work) => {
        setBusy(true);
        setError(null);
        try {
            await work();
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    const read = (file) => void run(async () => {
        setRows(await staffApi.readNew(file));
        setDirty(false);
    });
    const check = () => void run(async () => {
        setRows(await staffApi.checkNew(rows.map((r) => r.input)));
        setDirty(false);
    });
    const create = () => void run(async () => {
        const result = await staffApi.createNew(rows.map((r) => r.input));
        if (result.created.length > 0)
            onCreated(result);
        else
            setRows(result.rows);
    });
    const edit = (index, change) => {
        setRows((list) => list.map((r, i) => (i === index ? { ...r, input: { ...r.input, ...change } } : r)));
        setDirty(true);
    };
    const wrong = rows?.filter((r) => r.issues.length > 0).length ?? 0;
    const columns = ['nameEn', 'nationality', 'legalEntity', 'department', 'position', 'hireDate', 'basic'];
    const shown = new Set(columns);
    const cellIssue = (r, field) => r.issues.find((i) => i.field === field);
    const typed = (r, field) => (cellIssue(r, field)?.code === 'unknown' ? String(r.input[field] ?? '') : '');
    const pick = (r, index, field, list) => (_jsx(Tooltip, { title: typed(r, field) ? t('staff.create.typed', { value: typed(r, field) }) : '', children: _jsxs(TextField, { select: true, size: "small", fullWidth: true, value: list.some((o) => o.id === r.input[field]) ? r.input[field] : '', onChange: (ev) => edit(index, field === 'department' ? { department: ev.target.value, position: null } : { [field]: ev.target.value }), error: !!cellIssue(r, field), children: [_jsx(MenuItem, { value: "", children: "\u2014" }), list.map((o) => (_jsx(MenuItem, { value: o.id, children: ar ? o.nameAr : o.nameEn }, o.id)))] }) }));
    return (_jsxs(_Fragment, { children: [_jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 1.5, pt: 1 }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' } }, children: [_jsxs(Box, { sx: { flex: 1 }, children: [_jsx(Typography, { sx: { fontWeight: 700, color: wf.navy }, children: t('workforce.create.step1') }), _jsx(Typography, { sx: { fontSize: 13, color: wf.textSecondary }, children: t('staff.create.step1Hint') })] }), _jsx(Button, { variant: "outlined", startIcon: _jsx(FileDownloadOutlinedIcon, {}), component: "a", href: staffApi.newTemplateUrl, children: t('workforce.create.template') }), _jsx(Button, { variant: "contained", startIcon: _jsx(FileUploadOutlinedIcon, {}), onClick: () => input.current?.click(), disabled: busy, sx: { bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }, children: rows ? t('workforce.create.uploadAgain') : t('workforce.create.upload') }), _jsx("input", { ref: input, type: "file", hidden: true, accept: ".xlsx", onChange: (ev) => {
                                        const file = ev.target.files?.[0];
                                        ev.target.value = '';
                                        if (file)
                                            read(file);
                                    } })] }), busy && _jsx(LinearProgress, {}), rows && (_jsxs(_Fragment, { children: [_jsx(Alert, { severity: wrong > 0 ? 'warning' : 'success', icon: wrong > 0 ? _jsx(ErrorOutlineIcon, {}) : _jsx(CheckCircleOutlineIcon, {}), children: wrong > 0 ? t('workforce.create.summaryWrong', { total: rows.length, wrong }) : t('workforce.create.summaryOk', { total: rows.length }) }), _jsx(TableContainer, { sx: { maxHeight: '55vh', border: `1px solid ${wf.border}`, borderRadius: wf.control }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: { '& th': { bgcolor: `${wf.navy} !important`, color: '#fff', fontSize: 12.5, whiteSpace: 'nowrap' }, '& td': { fontSize: 13, verticalAlign: 'top' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: "#" }), columns.map((f) => (_jsx(TableCell, { children: t(`staff.create.fields.${f}`) }, f))), _jsx(TableCell, { children: t('workforce.create.notes') })] }) }), _jsx(TableBody, { children: rows.map((r, index) => (_jsxs(TableRow, { sx: r.issues.length > 0 ? { '& td': { bgcolor: `${wf.warning.bg} !important` } } : undefined, children: [_jsx(TableCell, { children: r.row }), _jsx(TableCell, { sx: { minWidth: 170 }, children: _jsx(TextField, { size: "small", fullWidth: true, value: r.input.nameEn ?? r.input.nameAr ?? '', onChange: (ev) => edit(index, { nameEn: nz(ev.target.value) }), error: !!cellIssue(r, 'nameEn') }) }), _jsx(TableCell, { sx: { minWidth: 140 }, children: pick(r, index, 'nationality', options.nationalities) }), _jsx(TableCell, { sx: { minWidth: 140 }, children: pick(r, index, 'legalEntity', options.legalEntities) }), _jsx(TableCell, { sx: { minWidth: 140 }, children: pick(r, index, 'department', options.departments) }), _jsx(TableCell, { sx: { minWidth: 160 }, children: _jsx(Tooltip, { title: typed(r, 'position') ? t('staff.create.typed', { value: typed(r, 'position') }) : '', children: _jsxs(TextField, { select: true, size: "small", fullWidth: true, value: positionsOf(options, r.input.department, ar, t).some((p) => p.id === r.input.position) ? r.input.position : '', onChange: (ev) => edit(index, { position: ev.target.value }), error: !!cellIssue(r, 'position'), disabled: !r.input.department, children: [_jsx(MenuItem, { value: "", children: "\u2014" }), positionsOf(options, r.input.department, ar, t).map((p) => (_jsx(MenuItem, { value: p.id, children: p.label }, p.id)))] }) }) }), _jsx(TableCell, { sx: { minWidth: 150 }, children: _jsx(DateField, { size: "small", value: r.input.hireDate ?? '', onChange: (ev) => edit(index, { hireDate: nz(ev.target.value) }), error: !!cellIssue(r, 'hireDate') }) }), _jsx(TableCell, { sx: { minWidth: 110 }, children: _jsx(TextField, { size: "small", fullWidth: true, type: "number", value: r.input.basic ?? '', onChange: (ev) => edit(index, { basic: nn(ev.target.value) }), error: !!cellIssue(r, 'basic'), slotProps: { htmlInput: { min: 0, step: 'any' } } }) }), _jsx(TableCell, { sx: { minWidth: 220 }, children: r.issues.length === 0 ? (_jsx(Box, { component: "span", sx: { color: wf.success.fg, fontWeight: 600 }, children: t('workforce.create.rowOk') })) : (_jsx(Stack, { sx: { gap: 0.25 }, children: r.issues.map((i) => (_jsxs(Typography, { sx: { fontSize: 12, color: shown.has(i.field) ? wf.danger.fg : wf.warning.fg }, children: [issue(i.field, i.code), !shown.has(i.field) && ` ${t('workforce.create.fixInSheet')}`] }, `${i.field}${i.code}`))) })) })] }, r.row))) })] }) })] }))] }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, gap: 1 }, children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), rows && (_jsx(Button, { variant: "outlined", onClick: check, disabled: busy, children: t('workforce.create.check') })), rows && (_jsx(Tooltip, { title: wrong > 0 || dirty ? t('workforce.create.fixFirst') : '', children: _jsx("span", { children: _jsx(Button, { variant: "contained", onClick: create, disabled: busy || wrong > 0 || dirty, sx: { bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }, children: t('workforce.create.approve', { count: rows.length }) }) }) }))] })] }));
}
function Created({ result, onClose }) {
    const { t } = useTranslation();
    return (_jsxs(_Fragment, { children: [_jsxs(DialogContent, { children: [_jsx(Alert, { severity: "success", sx: { mb: 1.5 }, children: t('staff.create.done', { count: result.created.length }) }), _jsx(Stack, { sx: { gap: 0.5, maxHeight: '50vh', overflow: 'auto' }, children: result.created.map((c) => (_jsxs(Link, { component: RouterLink, to: `/hr/employees/${c.id}`, onClick: onClose, children: [_jsx("bdi", { children: c.employeeNo }), " \u2014 ", _jsx("bdi", { children: c.name })] }, c.id))) })] }), _jsx(DialogActions, { sx: { px: 3, pb: 2 }, children: _jsx(Button, { variant: "contained", onClick: onClose, sx: { bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }, children: t('common.close') }) })] }));
}
