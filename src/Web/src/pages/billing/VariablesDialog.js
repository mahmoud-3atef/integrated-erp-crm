import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddTaskOutlinedIcon from '@mui/icons-material/AddTaskOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { billingApi } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { sar } from '../operations/delivery';
/** The variables a worker's month can carry, in the groups the window shows (what each one changes). */
const groups = [
    { key: 'days', types: ['Absence', 'FeeDays'] },
    { key: 'overtime', types: ['Overtime', 'OvertimeAmount'] },
    { key: 'customer', types: ['ClientAddition', 'ClientDeduction', 'CustomerLoan'] },
    { key: 'company', types: ['InternalAddition', 'InternalDeduction'] },
    { key: 'invoice', types: ['OtherCost', 'OtherDeduction'] },
];
const toBody = (staged) => staged.flatMap((s) => Object.entries(s.totals).map(([type, total]) => ({ workerId: s.workerId, type, total: total ?? 0, reason: s.reason })));
/**
 * «إضافة متغيرات»: the timesheet's invoice and salaries on top, recalculated with every variable entered; a search for
 * a worker opens all their variables; «إضافة المتغيرات» keeps them in the list below and the search goes on to the
 * next worker; «حفظ في التحضير» saves them all at once. Every figure comes from the server's own timesheet formulas.
 */
export function VariablesDialog({ sheet, onClose, onSaved }) {
    const { t } = useTranslation();
    const workers = useMemo(() => {
        const seen = new Map();
        for (const l of sheet.lines) {
            const w = seen.get(l.workerId);
            if (w)
                w.workDays += l.workDays;
            else
                seen.set(l.workerId, { workerId: l.workerId, workerNo: l.workerNo, name: l.name, iqamaNo: l.iqamaNo, workDays: l.workDays });
        }
        return [...seen.values()];
    }, [sheet.lines]);
    // The worker's saved totals of each variable.
    const saved = (workerId) => {
        const totals = {};
        for (const a of sheet.adjustments.filter((x) => x.workerId === workerId))
            totals[a.type] = (totals[a.type] ?? 0) + a.value;
        return totals;
    };
    const [staged, setStaged] = useState([]);
    const [worker, setWorker] = useState(null);
    const [draft, setDraft] = useState({});
    const [reason, setReason] = useState('');
    const [preview, setPreview] = useState(null);
    const [problem, setProblem] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const open = (w) => {
        setWorker(w);
        setProblem(null);
        if (!w)
            return;
        const kept = staged.find((s) => s.workerId === w.workerId);
        const base = { ...saved(w.workerId), ...(kept?.totals ?? {}) };
        setDraft(Object.fromEntries(groups.flatMap((g) => g.types).map((type) => [type, base[type] ? String(base[type]) : ''])));
        setReason(kept?.reason ?? '');
    };
    // The draft worker's changed totals (against what is saved).
    const changes = useMemo(() => {
        if (!worker)
            return {};
        const old = saved(worker.workerId);
        const out = {};
        for (const [type, text] of Object.entries(draft)) {
            const value = text === '' || text === '-' ? 0 : Number(text);
            if (!Number.isNaN(value) && value !== (old[type] ?? 0))
                out[type] = value;
        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft, worker]);
    // Everything waiting plus the worker being entered, previewed on the server (debounced).
    const body = useMemo(() => {
        const others = staged.filter((s) => s.workerId !== worker?.workerId);
        return toBody(worker && Object.keys(changes).length ? [...others, { workerId: worker.workerId, totals: changes, reason: '' }] : others);
    }, [staged, worker, changes]);
    useEffect(() => {
        const handle = setTimeout(() => {
            billingApi
                .previewVariables(sheet.id, body)
                .then((p) => (setPreview(p), setProblem(null)))
                .catch((e) => setProblem(errorKey(e)));
        }, 300);
        return () => clearTimeout(handle);
    }, [sheet.id, body]);
    const workerPreview = worker ? preview?.workers.find((x) => x.workerId === worker.workerId) : undefined;
    const add = () => {
        if (!worker)
            return;
        setStaged((list) => [...list.filter((s) => s.workerId !== worker.workerId), ...(Object.keys(changes).length ? [{ workerId: worker.workerId, totals: changes, reason: reason.trim() }] : [])]);
        setWorker(null);
    };
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await billingApi.saveVariables(sheet.id, toBody(staged));
            onSaved();
        }
        catch (e) {
            setError(errorKey(e));
            setBusy(false);
        }
    };
    const nameOf = (id) => workers.find((w) => w.workerId === id);
    const canAdd = !!worker && Object.keys(changes).length > 0 && reason.trim().length > 0 && !problem;
    return (_jsxs(Dialog, { open: true, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "lg", "aria-labelledby": "variables-title", children: [_jsxs(DialogTitle, { id: "variables-title", sx: { fontWeight: 800, color: tokens.navy800 }, children: [t('timesheets.variables.title'), " \u00B7 ", _jsx("bdi", { children: sheet.timesheetNo })] }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Summary, { before: preview?.before, after: preview?.after }), _jsx(Autocomplete, { sx: { my: 2 }, options: workers, value: worker, onChange: (_, w) => open(w), getOptionLabel: (w) => `${w.workerNo} · ${w.name}${w.iqamaNo ? ` · ${w.iqamaNo}` : ''}`, isOptionEqualToValue: (a, b) => a.workerId === b.workerId, renderInput: (params) => _jsx(TextField, { ...params, label: t('timesheets.variables.search'), placeholder: t('timesheets.variables.searchHint') }) }), worker && (_jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.3fr) minmax(0,1fr)' }, border: `1px solid ${tokens.gray200}`, borderRadius: '14px', p: 2, mb: 2 }, children: [_jsxs(Box, { children: [_jsxs(Typography, { sx: { fontWeight: 800, color: tokens.navy800, mb: 1 }, children: [_jsx("bdi", { children: worker.name }), " \u00B7 ", _jsx("bdi", { children: worker.workerNo }), " \u00B7 ", t('timesheets.variables.workDays', { days: worker.workDays })] }), groups.map((g) => (_jsxs(Box, { sx: { border: `1px solid ${tokens.gray200}`, borderRadius: '10px', p: 1.25, mb: 1 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', mb: 0.75 }, children: [_jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy800, fontSize: 13 }, children: t(`timesheets.variables.groups.${g.key}`) }), _jsx(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: t(`timesheets.variables.effects.${g.key}`) })] }), _jsx(Box, { sx: { display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' } }, children: g.types.map((type) => {
                                                    const changed = type in changes;
                                                    return (_jsx(TextField, { size: "small", label: `${t(`timesheets.adjustments.${type}`)} (${t(`timesheets.units.${type}`)})`, value: draft[type] ?? '', onChange: (e) => setDraft((d) => ({ ...d, [type]: e.target.value.replace(type === 'FeeDays' ? /[^\d.-]/g : /[^\d.]/g, '') })), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal' } }, sx: changed ? { '& .MuiOutlinedInput-root': { bgcolor: tokens.navy50, fontWeight: 700 } } : undefined }, type));
                                                }) })] }, g.key)))] }), _jsxs(Box, { sx: { bgcolor: tokens.gray50, borderRadius: '12px', p: 1.5 }, children: [_jsx(Typography, { sx: { fontWeight: 800, color: tokens.navy800, mb: 1 }, children: t('timesheets.variables.result') }), problem && _jsx(ErrorMessage, { messageKey: problem }), _jsx(Compare, { label: t('timesheets.variables.net'), before: workerPreview?.before.net, after: workerPreview?.after.net }), _jsx(Compare, { label: t('timesheets.variables.invoice'), before: workerPreview?.before.invoice, after: workerPreview?.after.invoice }), _jsx(Compare, { label: t('timesheets.variables.invoiceTotal'), before: workerPreview?.before.invoiceTotal, after: workerPreview?.after.invoiceTotal }), workerPreview && _jsx(Breakdown, { totals: workerPreview.after }), _jsx(TextField, { fullWidth: true, size: "small", sx: { mt: 1.5 }, label: t('timesheets.variables.reason'), required: true, value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 300 } } }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'flex-end', gap: 1, mt: 1.5 }, children: [_jsx(Button, { onClick: () => setWorker(null), children: t('common.cancel') }), _jsx(Button, { variant: "contained", startIcon: _jsx(AddTaskOutlinedIcon, {}), disabled: !canAdd, onClick: add, children: t('timesheets.variables.add') })] })] })] })), _jsx(Typography, { sx: { fontWeight: 800, color: tokens.navy800, mb: 1 }, children: t('timesheets.variables.list', { count: staged.length }) }), staged.length === 0 ? (_jsx(Alert, { severity: "info", sx: { borderRadius: '12px' }, children: t('timesheets.variables.empty') })) : (_jsx(Stack, { sx: { gap: 1 }, children: staged.map((s) => {
                            const w = nameOf(s.workerId);
                            const p = preview?.workers.find((x) => x.workerId === s.workerId);
                            return (_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, p: 1.25, borderRadius: '12px', border: `1px solid ${tokens.gray200}` }, children: [_jsxs(Box, { sx: { minWidth: 200 }, children: [_jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy800 }, children: _jsx("bdi", { children: w?.name }) }), _jsxs(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: [_jsx("bdi", { children: w?.workerNo }), " \u00B7 ", s.reason] })] }), _jsx(Typography, { sx: { flex: 1, fontSize: 12.5, color: tokens.gray600 }, children: Object.entries(s.totals)
                                            .map(([type, v]) => `${t(`timesheets.adjustments.${type}`)}: ${sar(v ?? 0)}`)
                                            .join(' · ') }), _jsx(Delta, { label: t('timesheets.variables.net'), value: p ? p.after.net - p.before.net : null }), _jsx(Delta, { label: t('timesheets.variables.invoice'), value: p ? p.after.invoice - p.before.invoice : null }), _jsxs(Stack, { direction: "row", children: [_jsx(IconButton, { size: "small", "aria-label": t('common.edit'), onClick: () => open(w ?? null), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }), _jsx(IconButton, { size: "small", "aria-label": t('timesheets.variables.remove'), onClick: () => setStaged((list) => list.filter((x) => x.workerId !== s.workerId)), children: _jsx(DeleteOutlineIcon, { fontSize: "small" }) })] })] }, s.workerId));
                        }) }))] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || staged.length === 0 || !!problem, onClick: () => void save(), children: busy ? t('timesheets.variables.saving') : t('timesheets.variables.save', { count: staged.length }) })] })] }));
}
/** The timesheet's invoice and salaries, as saved and with the variables entered. */
function Summary({ before, after }) {
    const { t } = useTranslation();
    const items = [
        ['invoice', 'invoice'],
        ['vat', 'vat'],
        ['invoiceTotal', 'invoiceTotal'],
        ['dueSalary', 'dueSalary'],
        ['net', 'net'],
    ];
    return (_jsx(Box, { sx: { display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(5, minmax(0,1fr))' } }, children: items.map(([label, key]) => {
            const diff = before && after ? after[key] - before[key] : 0;
            return (_jsxs(Box, { sx: { p: 1.25, borderRadius: '12px', bgcolor: tokens.navy50 }, children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray600 }, children: t(`timesheets.variables.sheet.${label}`) }), _jsx(Typography, { sx: { fontSize: 18, fontWeight: 800, color: tokens.navy800, fontVariantNumeric: 'tabular-nums' }, children: after ? sar(after[key]) : '—' }), Math.abs(diff) >= 0.005 && (_jsx(Typography, { sx: { fontSize: 11.5, fontWeight: 700, color: diff < 0 ? tokens.danger : tokens.success }, children: _jsx("bdi", { children: `${diff > 0 ? '+' : '−'}${sar(Math.abs(diff))}` }) }))] }, key));
        }) }));
}
function Compare({ label, before, after }) {
    const changed = before !== undefined && after !== undefined && Math.abs(after - before) >= 0.005;
    return (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'baseline', py: 0.5 }, children: [_jsx(Typography, { sx: { fontSize: 13 }, children: label }), _jsxs(Typography, { component: "div", sx: { fontVariantNumeric: 'tabular-nums' }, children: [changed && (_jsx(Box, { component: "s", sx: { color: tokens.gray500, fontSize: 12.5, marginInlineEnd: 1 }, children: sar(before) })), _jsx(Box, { component: "b", sx: { fontSize: 16, color: tokens.navy800 }, children: after === undefined ? '—' : sar(after) })] })] }));
}
function Breakdown({ totals }) {
    const { t } = useTranslation();
    const rows = [
        ['dueSalary', totals.dueSalary],
        ['absence', -totals.absence],
        ['overtime', totals.overtime],
        ['fees', totals.fees],
        ['gosi', totals.gosi],
    ];
    return (_jsx(Box, { sx: { mt: 1 }, children: rows
            .filter(([, v]) => v !== 0)
            .map(([key, v]) => (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', fontSize: 12, py: 0.4, borderBottom: `1px dashed ${tokens.gray200}` }, children: [_jsx("span", { children: t(`timesheets.variables.parts.${key}`) }), _jsx("bdi", { children: sar(v) })] }, key))) }));
}
function Delta({ label, value }) {
    return (_jsxs(Box, { sx: { minWidth: 110, textAlign: 'end' }, children: [_jsx(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: label }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 800, color: value === null || Math.abs(value) < 0.005 ? tokens.gray600 : value < 0 ? tokens.danger : tokens.success }, children: _jsx("bdi", { children: value === null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${sar(Math.abs(value))}` }) })] }));
}
