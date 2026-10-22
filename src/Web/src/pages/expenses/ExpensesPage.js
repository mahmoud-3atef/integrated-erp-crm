import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Alert, Autocomplete, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, LinearProgress, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography, } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { expensesApi } from '../../api/expenses';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { AttachmentsDialog } from '../../components/AttachmentsDialog';
import { KpiCard } from '../../components/KpiCard';
import { Badge, PageHeader } from '../../components/ui';
import { DateField } from '../../components/DateField';
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthRange = (month) => {
    const [y, m] = month.split('-').map(Number);
    return [`${month}-01`, iso(new Date(y, m, 0))];
};
export const scopeIcon = {
    Project: _jsx(AccountTreeOutlinedIcon, {}),
    Worker: _jsx(EngineeringOutlinedIcon, {}),
    General: _jsx(BusinessOutlinedIcon, {}),
};
/**
 * The company's expenses (docs/03-migration-plan/16): on a project (its cost), a worker (their cost) or the company;
 * by month, category and whom they are charged to, with the month's totals. A cost of several months (a year's
 * residence renewal) is spread over them in the profitability.
 */
export function ExpensesPage({ workerId, compact } = {}) {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const ar = i18n.language === 'ar';
    const manage = can('expenses.manage', true);
    const [month, setMonth] = useState(compact ? '' : iso(new Date()).slice(0, 7));
    const [scope, setScope] = useState('');
    const [category, setCategory] = useState('');
    const [search, setSearch] = useState('');
    const [withCancelled, setWithCancelled] = useState(false);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const [data, setData] = useState(null);
    const [categories, setCategories] = useState([]);
    const [projects, setProjects] = useState([]);
    const [editing, setEditing] = useState(null);
    const [cancelling, setCancelling] = useState(null);
    const [files, setFiles] = useState(null);
    const [error, setError] = useState(null);
    const money = useMemo(() => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [ar]);
    const load = useCallback(() => {
        setData(null);
        const [from, to] = month ? monthRange(month) : [undefined, undefined];
        expensesApi
            .list({ from, to, scope, category, search, withCancelled, workerId, page: page + 1, pageSize })
            .then(setData)
            .catch((f) => setError(errorKey(f)));
    }, [month, scope, category, search, withCancelled, workerId, page, pageSize]);
    useEffect(() => {
        const id = setTimeout(load, search ? 300 : 0);
        return () => clearTimeout(id);
    }, [load, search]);
    useEffect(() => {
        expensesApi.categories().then(setCategories).catch(() => undefined);
        expensesApi.projects().then(setProjects).catch(() => undefined);
    }, []);
    if (!can('expenses.view', true))
        return _jsx(Alert, { severity: compact ? 'info' : 'warning', children: t('expenses.noAccess') });
    const name = (c) => (ar ? c.nameAr : c.nameEn);
    const blank = () => ({ spentOn: iso(new Date()), category: categories[0]?.code ?? '', workerId: workerId ?? null, projectCrmId: null, amount: 0, vat: 0, months: 1, paidTo: null, reference: null, notes: null });
    const sum = (key) => data?.byScope.find((s) => s.key === key);
    return (_jsxs(Box, { children: [!compact && (_jsx(PageHeader, { title: t('expenses.title'), subtitle: t('expenses.intro'), actions: manage ? (_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setEditing({ id: null, input: blank(), worker: null }), children: t('expenses.add') })) : undefined })), compact && manage && (_jsx(Stack, { direction: "row", sx: { justifyContent: 'flex-end', mb: 1.5 }, children: _jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setEditing({ id: null, input: blank(), worker: null }), children: t('expenses.add') }) })), _jsx(ErrorMessage, { messageKey: editing || cancelling ? null : error }), !compact && (_jsxs(Box, { sx: { display: 'grid', gap: `${tokens.gap}px`, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mt: 3.5, mb: `${tokens.gap}px` }, children: [_jsx(KpiCard, { label: t('expenses.kpi.total'), value: data ? money.format(data.amount) : '—', foot: t('expenses.kpi.totalFoot', { count: data?.total ?? 0, vat: data ? money.format(data.vat) : '—' }), icon: _jsx(ReceiptLongOutlinedIcon, {}), tone: tokens.navy600, active: scope === '', onClick: () => setScope('') }), ['Project', 'Worker', 'General'].map((k, i) => (_jsx(KpiCard, { label: t(`expenses.scope.${k}`), value: data ? money.format(sum(k)?.amount ?? 0) : '—', foot: t(`expenses.scopeFoot.${k}`, { count: sum(k)?.count ?? 0 }), icon: scopeIcon[k], tone: [tokens.info, tokens.warning, tokens.gray600][i], active: scope === k, onClick: () => setScope(scope === k ? '' : k) }, k)))] })), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: compact ? 'none' : tokens.shadowSm, p: compact ? 0 : 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1, mb: 1.5, alignItems: { md: 'center' } }, children: [_jsx(TextField, { size: "small", type: "month", label: t('expenses.month'), value: month, onChange: (e) => { setMonth(e.target.value); setPage(0); }, slotProps: { inputLabel: { shrink: true } }, sx: { flex: { md: '0 0 180px' } } }), _jsxs(TextField, { size: "small", select: true, label: t('expenses.category'), value: category, onChange: (e) => { setCategory(e.target.value); setPage(0); }, sx: { flex: { md: '0 0 220px' } }, children: [_jsx(MenuItem, { value: "", children: t('expenses.all') }), categories.map((c) => (_jsx(MenuItem, { value: c.code, children: name(c) }, c.code)))] }), !compact && (_jsx(TextField, { size: "small", value: search, onChange: (e) => { setSearch(e.target.value); setPage(0); }, placeholder: t('expenses.search'), sx: { flex: { md: '1 1 260px' } }, slotProps: { input: { startAdornment: (_jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, {}) })) } } })), _jsx(FormControlLabel, { control: _jsx(Switch, { checked: withCancelled, onChange: (e) => setWithCancelled(e.target.checked) }), label: t('expenses.withCancelled'), sx: { whiteSpace: 'nowrap' } })] }), data && data.byCategory.length > 0 && !compact && (_jsx(Stack, { direction: "row", sx: { gap: 0.75, flexWrap: 'wrap', mb: 1.5 }, children: data.byCategory.map((c) => (_jsxs(ButtonBase, { onClick: () => setCategory(category === c.key ? '' : c.key), sx: { gap: 0.75, px: 1.25, py: 0.4, borderRadius: 99, border: `1px solid ${category === c.key ? tokens.navy700 : tokens.gray200}`, bgcolor: category === c.key ? tokens.navy700 : '#fff', color: category === c.key ? '#fff' : tokens.navy800, fontSize: 12.5, fontWeight: 700 }, children: [name(c), _jsx(Box, { component: "span", sx: { fontWeight: 800 }, children: money.format(c.amount) })] }, c.key))) })), !data ? (_jsx(LinearProgress, {})) : data.items.length === 0 ? (_jsx(Typography, { sx: { p: 3, textAlign: 'center', color: tokens.gray500 }, children: t('expenses.empty') })) : (_jsxs(_Fragment, { children: [_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('expenses.col.no') }), _jsx(TableCell, { children: t('expenses.col.date') }), _jsx(TableCell, { children: t('expenses.category') }), _jsx(TableCell, { children: t('expenses.col.chargedTo') }), _jsx(TableCell, { align: "right", children: t('expenses.col.amount') }), _jsx(TableCell, { children: t('expenses.col.months') }), _jsx(TableCell, { children: t('expenses.col.paidTo') }), _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: data.items.map((e) => (_jsxs(TableRow, { hover: true, sx: e.status === 'Cancelled' ? { opacity: 0.55 } : undefined, children: [_jsxs(TableCell, { children: [_jsx("bdi", { children: e.expenseNo }), e.status === 'Cancelled' && (_jsx(Tooltip, { title: e.cancelReason ?? '', children: _jsxs("span", { children: [' ', _jsx(Badge, { tone: "danger", children: t('expenses.cancelled') })] }) }))] }), _jsx(TableCell, { children: _jsx("bdi", { children: e.spentOn.replaceAll('-', '/') }) }), _jsx(TableCell, { children: ar ? e.categoryAr : e.categoryEn }), _jsx(TableCell, { children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75, '& svg': { fontSize: 17, color: tokens.navy600 } }, children: [scopeIcon[e.scope], _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { noWrap: true, sx: { fontSize: 12.5, fontWeight: 600 }, children: e.scope === 'General' ? t('expenses.scope.General') : e.projectName ?? e.workerName }), e.workerName && e.scope === 'Project' && (_jsxs(Typography, { noWrap: true, sx: { fontSize: 11, color: tokens.gray500 }, children: [e.workerName, " \u00B7 ", _jsx("bdi", { children: e.workerNo })] })), e.scope === 'Worker' && (_jsx(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: _jsx("bdi", { children: e.workerNo }) }))] })] }) }), _jsxs(TableCell, { align: "right", sx: { fontWeight: 800, fontVariantNumeric: 'tabular-nums' }, children: [money.format(e.amount), e.vat > 0 && _jsx(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: t('expenses.vatOf', { vat: money.format(e.vat) }) })] }), _jsx(TableCell, { children: e.months > 1 ? t('expenses.spread', { count: e.months }) : '—' }), _jsx(TableCell, { children: e.paidTo ?? '—' }), _jsxs(TableCell, { sx: { whiteSpace: 'nowrap' }, children: [_jsx(IconButton, { size: "small", "aria-label": t('expenses.files'), onClick: () => setFiles(e), children: _jsx(AttachFileOutlinedIcon, { fontSize: "small" }) }), manage && e.status === 'Active' && (_jsxs(_Fragment, { children: [_jsx(IconButton, { size: "small", "aria-label": t('common.edit'), onClick: () => setEditing({
                                                                            id: e.id,
                                                                            input: { spentOn: e.spentOn, category: e.category, workerId: e.workerId, projectCrmId: e.projectCrmId, amount: e.amount, vat: e.vat, months: e.months, paidTo: e.paidTo, reference: e.reference, notes: e.notes },
                                                                            worker: e.workerId ? { id: e.workerId, workerNo: e.workerNo ?? '', name: e.workerName ?? '', projectName: null } : null,
                                                                        }), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }), _jsx(IconButton, { size: "small", "aria-label": t('expenses.cancel'), onClick: () => setCancelling(e), children: _jsx(BlockOutlinedIcon, { fontSize: "small" }) })] }))] })] }, e.id))) })] }) }), _jsx(TablePagination, { component: "div", count: data.total, page: page, rowsPerPage: pageSize, rowsPerPageOptions: [25, 50, 100], onPageChange: (_, p) => setPage(p), onRowsPerPageChange: (e) => { setPageSize(Number(e.target.value)); setPage(0); }, labelRowsPerPage: t('workforce.perPage'), labelDisplayedRows: ({ from, to, count }) => t('workforce.rows', { from, to, count }) })] }))] }), editing && (_jsx(ExpenseDialog, { editing: editing, categories: categories, projects: projects, lockWorker: !!workerId, onClose: () => setEditing(null), onSaved: () => { setEditing(null); load(); } })), cancelling && _jsx(CancelDialog, { expense: cancelling, onClose: () => setCancelling(null), onDone: () => { setCancelling(null); load(); } }), files && _jsx(AttachmentsDialog, { title: files.expenseNo, ownerType: "expenses.expense", ownerId: files.id, canManage: manage && files.status === 'Active', onClose: () => setFiles(null) })] }));
}
function ExpenseDialog({ editing, categories, projects, lockWorker, onClose, onSaved, }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [v, setV] = useState(editing.input);
    const [worker, setWorker] = useState(editing.worker);
    const [options, setOptions] = useState(editing.worker ? [editing.worker] : []);
    const [text, setText] = useState('');
    const [chargeTo, setChargeTo] = useState(editing.input.projectCrmId ? 'Project' : editing.input.workerId ? 'Worker' : editing.id ? 'General' : 'Project');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (text.trim().length < 2)
            return;
        const id = setTimeout(() => expensesApi.workers(text).then(setOptions).catch(() => undefined), 250);
        return () => clearTimeout(id);
    }, [text]);
    const input = {
        ...v,
        workerId: chargeTo === 'General' ? null : worker?.id ?? v.workerId,
        projectCrmId: chargeTo === 'Project' ? v.projectCrmId : null,
    };
    const ready = input.spentOn && input.category && input.amount > 0 && (chargeTo !== 'Worker' || input.workerId) && (chargeTo !== 'Project' || input.projectCrmId);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            if (editing.id)
                await expensesApi.update(editing.id, input);
            else
                await expensesApi.create(input);
            onSaved();
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, maxWidth: "md", fullWidth: true, children: [_jsx(DialogTitle, { sx: { fontWeight: 800 }, children: editing.id ? t('expenses.edit') : t('expenses.add') }), _jsxs(DialogContent, { children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, mt: 1, mb: 1 }, children: t('expenses.chargeTo') }), _jsx(Stack, { direction: "row", sx: { gap: 1, mb: 2, flexWrap: 'wrap' }, children: ['Project', 'Worker', 'General'].map((k) => (_jsxs(ButtonBase, { onClick: () => setChargeTo(k), "aria-pressed": chargeTo === k, disabled: lockWorker && k === 'General', sx: { flex: '1 1 160px', gap: 1, justifyContent: 'flex-start', p: 1.5, borderRadius: '12px', textAlign: 'start', border: `1.5px solid ${chargeTo === k ? tokens.navy700 : tokens.gray200}`, bgcolor: chargeTo === k ? tokens.navy50 : '#fff', '& svg': { color: tokens.navy700 } }, children: [scopeIcon[k], _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 800 }, children: t(`expenses.scope.${k}`) }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t(`expenses.scopeHint.${k}`) })] })] }, k))) }), _jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }, children: [chargeTo === 'Project' && (_jsx(Autocomplete, { options: projects, value: projects.find((p) => p.crmId === v.projectCrmId) ?? null, onChange: (_, p) => setV({ ...v, projectCrmId: p?.crmId ?? null }), getOptionLabel: (p) => `${p.name} (${p.code})`, isOptionEqualToValue: (a, b) => a.crmId === b.crmId, renderInput: (p) => _jsx(TextField, { ...p, label: t('expenses.project'), required: true }) })), chargeTo !== 'General' && (_jsx(Autocomplete, { options: options, value: worker, disabled: lockWorker, filterOptions: (x) => x, onInputChange: (_, value) => setText(value), onChange: (_, w) => setWorker(w), getOptionLabel: (w) => `${w.name} · ${w.workerNo}`, isOptionEqualToValue: (a, b) => a.id === b.id, noOptionsText: t('expenses.typeToSearch'), renderInput: (p) => _jsx(TextField, { ...p, label: chargeTo === 'Project' ? t('expenses.workerOptional') : t('expenses.worker'), required: chargeTo === 'Worker' }) })), _jsx(TextField, { select: true, label: t('expenses.category'), value: v.category, onChange: (e) => setV({ ...v, category: e.target.value }), required: true, children: categories.map((c) => (_jsx(MenuItem, { value: c.code, children: ar ? c.nameAr : c.nameEn }, c.code))) }), _jsx(DateField, { label: t('expenses.col.date'), value: v.spentOn, onChange: (e) => setV({ ...v, spentOn: e.target.value }), slotProps: { inputLabel: { shrink: true } }, required: true }), _jsx(TextField, { type: "number", label: t('expenses.amount'), value: v.amount || '', onChange: (e) => setV({ ...v, amount: Number(e.target.value) }), required: true, slotProps: { htmlInput: { min: 0, step: 0.01 }, input: { endAdornment: _jsx(InputAdornment, { position: "end", children: t('workforce.sar') }) } } }), _jsx(TextField, { type: "number", label: t('expenses.vat'), value: v.vat || '', onChange: (e) => setV({ ...v, vat: Number(e.target.value) }), slotProps: { htmlInput: { min: 0, step: 0.01 }, input: { endAdornment: _jsx(InputAdornment, { position: "end", children: t('workforce.sar') }) } } }), _jsx(TextField, { type: "number", label: t('expenses.months'), value: v.months, onChange: (e) => setV({ ...v, months: Math.max(1, Math.min(36, Number(e.target.value) || 1)) }), helperText: v.months > 1 ? t('expenses.monthsHelpSpread', { count: v.months, share: (v.amount / v.months).toFixed(2) }) : t('expenses.monthsHelp'), slotProps: { htmlInput: { min: 1, max: 36 } } }), _jsx(TextField, { label: t('expenses.col.paidTo'), value: v.paidTo ?? '', onChange: (e) => setV({ ...v, paidTo: e.target.value || null }), slotProps: { htmlInput: { maxLength: 200 } } }), _jsx(TextField, { label: t('expenses.reference'), value: v.reference ?? '', onChange: (e) => setV({ ...v, reference: e.target.value || null }), slotProps: { htmlInput: { maxLength: 100, dir: 'ltr' } } }), _jsx(TextField, { label: t('expenses.notes'), value: v.notes ?? '', onChange: (e) => setV({ ...v, notes: e.target.value || null }), multiline: true, minRows: 2, sx: { gridColumn: '1 / -1' }, slotProps: { htmlInput: { maxLength: 1000 } } })] }), _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500, mt: 1.5 }, children: t('expenses.filesHint') })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: save, disabled: busy || !ready, children: t('common.save') })] })] }));
}
function CancelDialog({ expense, onClose, onDone }) {
    const { t } = useTranslation();
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    return (_jsxs(Dialog, { open: true, onClose: onClose, maxWidth: "xs", fullWidth: true, children: [_jsx(DialogTitle, { sx: { fontWeight: 800 }, children: t('expenses.cancelTitle', { no: expense.expenseNo }) }), _jsxs(DialogContent, { children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(TextField, { autoFocus: true, fullWidth: true, multiline: true, minRows: 2, label: t('expenses.cancelReason'), value: reason, onChange: (e) => setReason(e.target.value), sx: { mt: 1 }, slotProps: { htmlInput: { maxLength: 500 } } })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onClose, children: t('common.back') }), _jsx(Button, { color: "error", variant: "contained", disabled: busy || !reason.trim(), onClick: async () => {
                            setBusy(true);
                            try {
                                await expensesApi.cancel(expense.id, reason.trim());
                                onDone();
                            }
                            catch (f) {
                                setError(errorKey(f));
                                setBusy(false);
                            }
                        }, children: t('expenses.cancel') })] })] }));
}
