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
import { workforceApi } from '../../api/workforce';
import { ErrorMessage } from '../../auth/AuthLayout';
import { DateField } from '../../components/DateField';
import { wf } from '../../components/designKit';
const empty = {
    nameEn: null,
    nameAr: null,
    nationality: null,
    profession: null,
    iqamaProfession: null,
    sponsor: null,
    iqama: null,
    iqamaExpiresOn: null,
    borderNumber: null,
    passport: null,
    arrivedOn: null,
    recruitmentAgent: null,
    basic: null,
    housing: null,
    food: null,
    transport: null,
    other: null,
    supplierMonthlyCost: null,
    costMethod: null,
};
// A worker on another sponsor than the company's (Care-Pro) comes from a supplier: their monthly cost is required.
const isSupplier = (sponsor) => !!sponsor && !sponsor.trim().toLowerCase().startsWith('care-pro');
const nz = (value) => (value.trim() === '' ? null : value);
const nn = (value) => (value.trim() === '' ? null : Number(value));
/**
 * Adding workers (the user's request, 2026-10-25): one from a form whose lists are picked, not typed; or many from the
 * template, which is read and checked first. Each wrong value is shown on its row to fix here (or in the sheet, then
 * uploaded again), and «اعتماد وإنشاء» creates the whole set only when every row is clean.
 */
export function AddWorkersDialog({ onClose, onCreated }) {
    const { t } = useTranslation();
    const [mode, setMode] = useState('one');
    const [options, setOptions] = useState(null);
    const [result, setResult] = useState(null);
    useEffect(() => {
        workforceApi.newOptions().then(setOptions).catch(() => setOptions({ nationalities: [], professions: [], sponsors: [], nextNumber: '' }));
    }, []);
    const done = (created) => {
        setResult(created);
        onCreated();
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: mode === 'sheet' ? 'xl' : 'md', slotProps: { paper: { sx: { borderRadius: '18px' } } }, children: [_jsxs(DialogTitle, { sx: { fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }, children: [t('workforce.create.title'), !result && (_jsxs(ToggleButtonGroup, { size: "small", exclusive: true, value: mode, onChange: (_, v) => v && setMode(v), children: [_jsx(ToggleButton, { value: "one", children: t('workforce.create.one') }), _jsx(ToggleButton, { value: "sheet", children: t('workforce.create.sheet') })] }))] }), result ? (_jsx(Created, { result: result, onClose: onClose })) : !options ? (_jsx(DialogContent, { children: _jsx(LinearProgress, {}) })) : mode === 'one' ? (_jsx(OneWorker, { options: options, onClose: onClose, onCreated: done })) : (_jsx(FromSheet, { options: options, onClose: onClose, onCreated: done }))] }));
}
/** The issue of a field in words: «الجنسية: غير موجودة في القائمة». */
function useIssue() {
    const { t } = useTranslation();
    return (field, code) => `${t(`workforce.create.fields.${field}`)}: ${t(`workforce.create.issues.${code}`)}`;
}
function OneWorker({ options, onClose, onCreated }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const issue = useIssue();
    const [w, setW] = useState({ ...empty, costMethod: 'MonthlyFixed' });
    const [issues, setIssues] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const set = (key, value) => setW((x) => ({ ...x, [key]: value }));
    const errorOf = (field) => issues.find((i) => i.field === field);
    const helper = (field) => (errorOf(field) ? t(`workforce.create.issues.${errorOf(field).code}`) : undefined);
    const supplier = isSupplier(w.sponsor);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const result = await workforceApi.createNew([{ ...w, supplierMonthlyCost: supplier ? w.supplierMonthlyCost : null }]);
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
    const pick = (field, list, required) => (_jsxs(TextField, { select: true, size: "small", required: required, label: t(`workforce.create.fields.${field}`), value: w[field] ?? '', onChange: (e) => set(field, nz(e.target.value)), error: !!errorOf(field), helperText: helper(field), children: [_jsx(MenuItem, { value: "", children: "\u2014" }), list.map((o) => (_jsx(MenuItem, { value: o.code, children: ar ? o.nameAr : o.nameEn }, o.code)))] }));
    const text = (field, required = false, ltr = false) => (_jsx(TextField, { size: "small", required: required, label: t(`workforce.create.fields.${field}`), value: w[field] ?? '', onChange: (e) => set(field, nz(e.target.value)), error: !!errorOf(field), helperText: helper(field), slotProps: { htmlInput: { maxLength: field.startsWith('name') ? 300 : 50, dir: ltr ? 'ltr' : undefined } } }));
    const money = (field, required = false) => (_jsx(TextField, { size: "small", type: "number", required: required, label: t(`workforce.create.fields.${field === 'supplierMonthlyCost' ? 'cost' : field}`), value: w[field] ?? '', onChange: (e) => set(field, nn(e.target.value)), error: !!errorOf(field === 'supplierMonthlyCost' ? 'cost' : field), helperText: helper(field === 'supplierMonthlyCost' ? 'cost' : field), slotProps: { htmlInput: { min: 0, step: 'any' } } }));
    const grid = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.5 };
    const title = (key) => _jsx(Typography, { sx: { fontWeight: 700, color: wf.navy, mt: 0.5 }, children: t(key) });
    return (_jsxs(_Fragment, { children: [_jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 1.5, pt: 1 }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Alert, { severity: "info", children: t('workforce.create.numberHint', { number: options.nextNumber }) }), issues.length > 0 && _jsx(Alert, { severity: "warning", children: issues.map((i) => issue(i.field, i.code)).join(' · ') }), title('workforce.sections.basic'), _jsxs(Box, { sx: grid, children: [text('nameEn', true, true), text('nameAr'), pick('nationality', options.nationalities, true), text('iqama', false, true), _jsx(DateField, { size: "small", label: t('workforce.create.fields.iqamaExpiresOn'), value: w.iqamaExpiresOn ?? '', onChange: (e) => set('iqamaExpiresOn', nz(e.target.value)), slotProps: { inputLabel: { shrink: true } } }), text('borderNumber', false, true), text('passport', false, true), _jsx(DateField, { size: "small", required: true, label: t('workforce.create.fields.arrivedOn'), value: w.arrivedOn ?? '', onChange: (e) => set('arrivedOn', nz(e.target.value)), error: !!errorOf('arrivedOn'), helperText: helper('arrivedOn'), slotProps: { inputLabel: { shrink: true } } })] }), _jsx(Typography, { sx: { fontSize: 12.5, color: wf.textSecondary }, children: t('workforce.create.identityHint') }), title('workforce.sections.job'), _jsxs(Box, { sx: grid, children: [pick('profession', options.professions, true), pick('iqamaProfession', options.professions, false), _jsxs(TextField, { select: true, size: "small", required: true, label: t('workforce.create.fields.sponsor'), value: w.sponsor ?? '', onChange: (e) => set('sponsor', nz(e.target.value)), error: !!errorOf('sponsor'), helperText: helper('sponsor'), children: [_jsx(MenuItem, { value: "", children: "\u2014" }), options.sponsors.map((s) => (_jsx(MenuItem, { value: s, children: _jsx("bdi", { children: s }) }, s)))] }), text('recruitmentAgent')] }), supplier && (_jsxs(_Fragment, { children: [title('workforce.create.supplierCost'), _jsxs(Box, { sx: grid, children: [money('supplierMonthlyCost', true), _jsxs(TextField, { select: true, size: "small", label: t('workforce.create.fields.method'), value: w.costMethod ?? 'MonthlyFixed', onChange: (e) => set('costMethod', e.target.value), children: [_jsx(MenuItem, { value: "MonthlyFixed", children: t('workforce.create.methods.MonthlyFixed') }), _jsx(MenuItem, { value: "ByWorkingDays", children: t('workforce.create.methods.ByWorkingDays') })] })] })] })), title('workforce.sections.salary'), _jsxs(Box, { sx: grid, children: [money('basic'), money('housing'), money('food'), money('transport'), money('other')] })] }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy, sx: { bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }, children: t('workforce.create.save') })] })] }));
}
/** The sheet: download the template, upload it, fix what is wrong on its rows, then create them all. */
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
        setRows(await workforceApi.readNew(file));
        setDirty(false);
    });
    const check = () => void run(async () => {
        setRows(await workforceApi.checkNew(rows.map((r) => r.input)));
        setDirty(false);
    });
    const create = () => void run(async () => {
        const result = await workforceApi.createNew(rows.map((r) => r.input));
        if (result.created.length > 0)
            onCreated(result);
        else
            setRows(result.rows);
    });
    const edit = (index, change) => {
        setRows((list) => list.map((r, i) => (i === index ? { ...r, input: { ...r.input, ...change }, isSupplier: isSupplier(change.sponsor ?? r.input.sponsor) } : r)));
        setDirty(true);
    };
    const wrong = rows?.filter((r) => r.issues.length > 0).length ?? 0;
    const shown = new Set(['nameEn', 'nationality', 'profession', 'sponsor', 'iqama', 'borderNumber', 'arrivedOn', 'cost']);
    const cellIssue = (r, field) => r.issues.find((i) => i.field === field);
    const typed = (r, field) => (cellIssue(r, field)?.code === 'unknown' ? r.input[field] : null);
    const select = (r, index, field, list) => {
        const known = list.some((o) => o.code === r.input[field]);
        return (_jsx(Tooltip, { title: typed(r, field) ? t('workforce.create.typed', { value: typed(r, field) }) : '', children: _jsxs(TextField, { select: true, size: "small", fullWidth: true, value: known ? r.input[field] : '', onChange: (e) => edit(index, { [field]: e.target.value }), error: !!cellIssue(r, field), children: [_jsx(MenuItem, { value: "", children: "\u2014" }), list.map((o) => (_jsx(MenuItem, { value: o.code, children: ar ? o.nameAr : o.nameEn }, o.code)))] }) }));
    };
    return (_jsxs(_Fragment, { children: [_jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 1.5, pt: 1 }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' } }, children: [_jsxs(Box, { sx: { flex: 1 }, children: [_jsx(Typography, { sx: { fontWeight: 700, color: wf.navy }, children: t('workforce.create.step1') }), _jsx(Typography, { sx: { fontSize: 13, color: wf.textSecondary }, children: t('workforce.create.step1Hint') })] }), _jsx(Button, { variant: "outlined", startIcon: _jsx(FileDownloadOutlinedIcon, {}), component: "a", href: workforceApi.newTemplateUrl, children: t('workforce.create.template') }), _jsx(Button, { variant: "contained", startIcon: _jsx(FileUploadOutlinedIcon, {}), onClick: () => input.current?.click(), disabled: busy, sx: { bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }, children: rows ? t('workforce.create.uploadAgain') : t('workforce.create.upload') }), _jsx("input", { ref: input, type: "file", hidden: true, accept: ".xlsx", onChange: (e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = '';
                                        if (file)
                                            read(file);
                                    } })] }), busy && _jsx(LinearProgress, {}), rows && (_jsxs(_Fragment, { children: [_jsx(Alert, { severity: wrong > 0 ? 'warning' : 'success', icon: wrong > 0 ? _jsx(ErrorOutlineIcon, {}) : _jsx(CheckCircleOutlineIcon, {}), children: wrong > 0 ? t('workforce.create.summaryWrong', { total: rows.length, wrong }) : t('workforce.create.summaryOk', { total: rows.length }) }), _jsx(TableContainer, { sx: { maxHeight: '55vh', border: `1px solid ${wf.border}`, borderRadius: wf.control }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: { '& th': { bgcolor: `${wf.navy} !important`, color: '#fff', fontSize: 12.5, whiteSpace: 'nowrap' }, '& td': { fontSize: 13, verticalAlign: 'top' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: "#" }), ['nameEn', 'nationality', 'profession', 'sponsor', 'iqama', 'borderNumber', 'arrivedOn', 'cost'].map((f) => (_jsx(TableCell, { children: t(`workforce.create.fields.${f}`) }, f))), _jsx(TableCell, { children: t('workforce.create.notes') })] }) }), _jsx(TableBody, { children: rows.map((r, index) => (_jsxs(TableRow, { sx: r.issues.length > 0 ? { '& td': { bgcolor: `${wf.warning.bg} !important` } } : undefined, children: [_jsx(TableCell, { children: r.row }), _jsx(TableCell, { sx: { minWidth: 170 }, children: _jsx(TextField, { size: "small", fullWidth: true, value: r.input.nameEn ?? '', onChange: (e) => edit(index, { nameEn: nz(e.target.value) }), error: !!cellIssue(r, 'nameEn'), slotProps: { htmlInput: { dir: 'ltr' } } }) }), _jsx(TableCell, { sx: { minWidth: 140 }, children: select(r, index, 'nationality', options.nationalities) }), _jsx(TableCell, { sx: { minWidth: 140 }, children: select(r, index, 'profession', options.professions) }), _jsx(TableCell, { sx: { minWidth: 140 }, children: _jsx(Tooltip, { title: typed(r, 'sponsor') ? t('workforce.create.typed', { value: typed(r, 'sponsor') }) : '', children: _jsxs(TextField, { select: true, size: "small", fullWidth: true, value: options.sponsors.includes(r.input.sponsor ?? '') ? r.input.sponsor : '', onChange: (e) => edit(index, { sponsor: e.target.value }), error: !!cellIssue(r, 'sponsor'), children: [_jsx(MenuItem, { value: "", children: "\u2014" }), options.sponsors.map((s) => (_jsx(MenuItem, { value: s, children: _jsx("bdi", { children: s }) }, s)))] }) }) }), _jsx(TableCell, { sx: { minWidth: 120 }, children: _jsx(TextField, { size: "small", fullWidth: true, value: r.input.iqama ?? '', onChange: (e) => edit(index, { iqama: nz(e.target.value) }), error: !!cellIssue(r, 'iqama'), slotProps: { htmlInput: { dir: 'ltr' } } }) }), _jsx(TableCell, { sx: { minWidth: 120 }, children: _jsx(TextField, { size: "small", fullWidth: true, value: r.input.borderNumber ?? '', onChange: (e) => edit(index, { borderNumber: nz(e.target.value) }), error: !!cellIssue(r, 'borderNumber'), slotProps: { htmlInput: { dir: 'ltr' } } }) }), _jsx(TableCell, { sx: { minWidth: 150 }, children: _jsx(DateField, { size: "small", value: r.input.arrivedOn ?? '', onChange: (e) => edit(index, { arrivedOn: nz(e.target.value) }), error: !!cellIssue(r, 'arrivedOn') }) }), _jsx(TableCell, { sx: { minWidth: 110 }, children: isSupplier(r.input.sponsor) ? (_jsx(TextField, { size: "small", fullWidth: true, type: "number", value: r.input.supplierMonthlyCost ?? '', onChange: (e) => edit(index, { supplierMonthlyCost: nn(e.target.value) }), error: !!cellIssue(r, 'cost'), slotProps: { htmlInput: { min: 0, step: 'any' } } })) : (_jsx(Typography, { sx: { fontSize: 12, color: wf.textSecondary, pt: 1 }, children: t('workforce.create.companySponsor') })) }), _jsx(TableCell, { sx: { minWidth: 220 }, children: r.issues.length === 0 ? (_jsx(Box, { component: "span", sx: { color: wf.success.fg, fontWeight: 600 }, children: t('workforce.create.rowOk') })) : (_jsx(Stack, { sx: { gap: 0.25 }, children: r.issues.map((i) => (_jsxs(Typography, { sx: { fontSize: 12, color: shown.has(i.field) ? wf.danger.fg : wf.warning.fg }, children: [issue(i.field, i.code), !shown.has(i.field) && ` ${t('workforce.create.fixInSheet')}`] }, `${i.field}${i.code}`))) })) })] }, r.row))) })] }) })] }))] }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, gap: 1 }, children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), rows && (_jsx(Button, { variant: "outlined", onClick: check, disabled: busy, children: t('workforce.create.check') })), rows && (_jsx(Tooltip, { title: wrong > 0 || dirty ? t('workforce.create.fixFirst') : '', children: _jsx("span", { children: _jsx(Button, { variant: "contained", onClick: create, disabled: busy || wrong > 0 || dirty, sx: { bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }, children: t('workforce.create.approve', { count: rows.length }) }) }) }))] })] }));
}
/** What was created: each new worker with a link to their file. */
function Created({ result, onClose }) {
    const { t } = useTranslation();
    return (_jsxs(_Fragment, { children: [_jsxs(DialogContent, { children: [_jsx(Alert, { severity: "success", sx: { mb: 1.5 }, children: t('workforce.create.done', { count: result.created.length }) }), _jsx(Stack, { sx: { gap: 0.5, maxHeight: '50vh', overflow: 'auto' }, children: result.created.map((c) => (_jsxs(Link, { component: RouterLink, to: `/workforce/workers/${c.id}`, onClick: onClose, children: [_jsx("bdi", { children: c.workerNo }), " \u2014 ", _jsx("bdi", { children: c.name })] }, c.id))) })] }), _jsx(DialogActions, { sx: { px: 3, pb: 2 }, children: _jsx(Button, { variant: "contained", onClick: onClose, sx: { bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }, children: t('common.close') }) })] }));
}
