import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { costsApi } from '../../api/costs';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard } from '../../components/KpiCard';
import { Badge, PageHeader, PillTabs } from '../../components/ui';
import { DateField } from '../../components/DateField';
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
/**
 * What each worker of a supplier costs the company (docs/03-migration-plan/16): the suppliers' packages (by profession
 * and nationality), the workers with their cost today, and an Excel round trip to enter the costs at once.
 */
export function SupplierCostsPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const ar = i18n.language === 'ar';
    const manage = can('workforce.costs.manage', true);
    const [tab, setTab] = useState('workers');
    const [overview, setOverview] = useState(null);
    const [options, setOptions] = useState(null);
    const [workers, setWorkers] = useState(null);
    const [packages, setPackages] = useState(null);
    const [supplier, setSupplier] = useState(null);
    const [missing, setMissing] = useState(null);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(null);
    const [imported, setImported] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const file = useRef(null);
    const money = (v) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { maximumFractionDigits: 2 }).format(v);
    const load = useCallback(() => {
        setError(null);
        costsApi.overview().then(setOverview).catch((f) => setError(errorKey(f)));
        costsApi.packages().then(setPackages).catch((f) => setError(errorKey(f)));
    }, []);
    useEffect(() => {
        load();
        costsApi.options().then(setOptions).catch((f) => setError(errorKey(f)));
    }, [load]);
    useEffect(() => {
        setWorkers(null);
        const id = setTimeout(() => costsApi.workers({ supplier, missing, search }).then(setWorkers).catch((f) => setError(errorKey(f))), search ? 300 : 0);
        return () => clearTimeout(id);
    }, [supplier, missing, search, overview]);
    if (!can('workforce.costs.view', true))
        return _jsx(Alert, { severity: "warning", children: t('costs.noAccess') });
    const save = async () => {
        if (!editing)
            return;
        setBusy(true);
        setError(null);
        try {
            if (editing.kind === 'card')
                await costsApi.addCard(editing.worker.workerId, editing.input);
            else if (editing.id)
                await costsApi.savePackage(editing.id, editing.input);
            else
                await costsApi.addPackage(editing.input);
            setEditing(null);
            load();
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    const upload = async (picked) => {
        if (!picked)
            return;
        setBusy(true);
        setError(null);
        try {
            setImported(await costsApi.import(picked));
            load();
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    const method = (m) => (m ? t(`costs.method.${m}`) : '—');
    const name = (ar_, en) => (ar ? ar_ : en) ?? '—';
    const newInput = (s) => ({ supplier: s, professionCode: null, nationalityCode: null, monthlyCost: 0, method: 'MonthlyFixed', effectiveFrom: monthStart(), notes: null });
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('costs.title'), subtitle: t('costs.intro'), actions: _jsxs(Stack, { direction: "row", sx: { gap: 1, flexWrap: 'wrap' }, children: [_jsx(Button, { startIcon: _jsx(FileDownloadOutlinedIcon, {}), component: "a", href: costsApi.templateUrl(supplier), children: t('costs.template') }), manage && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(FileUploadOutlinedIcon, {}), disabled: busy, onClick: () => file.current?.click(), children: t('costs.upload') }), _jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setEditing({ kind: 'package', id: null, input: newInput(supplier) }), children: t('costs.addPackage') })] })), _jsx("input", { ref: file, type: "file", hidden: true, accept: ".xlsx", onChange: (e) => { void upload(e.target.files?.[0]); e.target.value = ''; } })] }) }), _jsx(ErrorMessage, { messageKey: editing ? null : error }), busy && _jsx(LinearProgress, { sx: { mb: 1 } }), _jsxs(Box, { sx: { display: 'grid', gap: `${tokens.gap}px`, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mt: 3.5, mb: `${tokens.gap}px` }, children: [_jsx(KpiCard, { label: t('costs.kpi.workers'), value: overview?.supplierWorkers ?? '—', foot: t('costs.kpi.workersFoot', { count: overview?.suppliers.length ?? 0 }), icon: _jsx(GroupsOutlinedIcon, {}), tone: tokens.navy600, active: missing === null, onClick: () => setMissing(null) }), _jsx(KpiCard, { label: t('costs.kpi.card'), value: overview?.withCard ?? '—', foot: t('costs.kpi.cardFoot'), icon: _jsx(PersonOutlineOutlinedIcon, {}), tone: tokens.success }), _jsx(KpiCard, { label: t('costs.kpi.package'), value: overview?.byPackage ?? '—', foot: t('costs.kpi.packageFoot'), icon: _jsx(Inventory2OutlinedIcon, {}), tone: tokens.info }), _jsx(KpiCard, { label: t('costs.kpi.missing'), value: overview?.missing ?? '—', foot: t('costs.kpi.missingFoot'), icon: _jsx(ReportProblemOutlinedIcon, {}), tone: tokens.danger, active: missing === true, onClick: () => setMissing(missing === true ? null : true) })] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, mb: 2, alignItems: { md: 'center' } }, children: [_jsx(PillTabs, { value: tab, onChange: setTab, options: [{ value: 'workers', label: t('costs.tabs.workers') }, { value: 'packages', label: t('costs.tabs.packages', { count: packages?.length ?? 0 }) }] }), _jsxs(Stack, { direction: "row", sx: { gap: 0.75, flexWrap: 'wrap', flex: 1 }, children: [_jsx(SupplierChip, { on: supplier === null, label: t('costs.allSuppliers'), onClick: () => setSupplier(null) }), overview?.suppliers.map((s) => (_jsx(SupplierChip, { on: supplier === s.supplier, label: s.supplier, count: s.workers, warn: s.missing, onClick: () => setSupplier(supplier === s.supplier ? null : s.supplier) }, s.supplier)))] })] }), tab === 'workers' ? (_jsxs(_Fragment, { children: [_jsx(TextField, { size: "small", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('costs.search'), sx: { mb: 1.5, maxWidth: 420 }, slotProps: { input: { startAdornment: (_jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, {}) })) } } }), !workers ? (_jsx(LinearProgress, {})) : workers.length === 0 ? (_jsx(Typography, { sx: { p: 3, textAlign: 'center', color: tokens.gray500 }, children: t('costs.empty') })) : (_jsx(TableContainer, { sx: { maxHeight: 'calc(100vh - 360px)' }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('costs.col.worker') }), _jsx(TableCell, { children: t('costs.col.supplier') }), _jsx(TableCell, { children: t('costs.col.profession') }), _jsx(TableCell, { children: t('costs.col.nationality') }), _jsx(TableCell, { children: t('costs.col.status') }), _jsx(TableCell, { align: "right", children: t('costs.col.cost') }), _jsx(TableCell, { children: t('costs.col.method') }), _jsx(TableCell, { children: t('costs.col.source') }), _jsx(TableCell, { children: t('costs.col.from') }), manage && _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: workers.map((w) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/workforce/workers/${w.workerId}?tab=cost`), children: [_jsxs(TableCell, { children: [_jsx(Typography, { dir: "auto", sx: { fontSize: 12.5, fontWeight: 600, unicodeBidi: 'plaintext', textAlign: 'start' }, children: w.name }), _jsx(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: _jsx("bdi", { children: w.workerNo }) })] }), _jsx(TableCell, { children: _jsx("bdi", { children: w.supplier }) }), _jsx(TableCell, { children: name(w.professionAr, w.professionEn) }), _jsx(TableCell, { children: name(w.nationalityAr, w.nationalityEn) }), _jsx(TableCell, { children: t(`workforce.placement.${w.placement}`) }), _jsx(TableCell, { align: "right", sx: { fontWeight: 800, fontVariantNumeric: 'tabular-nums' }, children: w.monthlyCost !== null ? money(w.monthlyCost) : '—' }), _jsx(TableCell, { children: method(w.method) }), _jsx(TableCell, { children: w.costSource ? _jsx(Badge, { tone: w.costSource === 'Card' ? 'success' : 'info', children: t(`costs.source.${w.costSource}`) }) : _jsx(Badge, { tone: "danger", children: t('costs.source.none') }) }), _jsx(TableCell, { children: _jsx("bdi", { children: w.effectiveFrom?.replaceAll('-', '/') ?? '—' }) }), manage && (_jsx(TableCell, { onClick: (e) => e.stopPropagation(), children: _jsx(Tooltip, { title: t('costs.setCost'), children: _jsx(IconButton, { size: "small", onClick: () => setEditing({ kind: 'card', worker: w, input: { ...newInput(w.supplier), monthlyCost: w.monthlyCost ?? 0, method: w.method ?? 'MonthlyFixed' } }), "aria-label": t('costs.setCost'), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }) }) }))] }, w.workerId))) })] }) }))] })) : !packages ? (_jsx(LinearProgress, {})) : (_jsxs(_Fragment, { children: [_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500, mb: 1.5 }, children: t('costs.packagesHint') }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('costs.col.supplier') }), _jsx(TableCell, { children: t('costs.col.profession') }), _jsx(TableCell, { children: t('costs.col.nationality') }), _jsx(TableCell, { align: "right", children: t('costs.col.cost') }), _jsx(TableCell, { children: t('costs.col.method') }), _jsx(TableCell, { children: t('costs.col.from') }), _jsx(TableCell, { children: t('costs.col.covered') }), manage && _jsx(TableCell, {})] }) }), _jsxs(TableBody, { children: [packages
                                                    .filter((p) => supplier === null || p.supplier === supplier)
                                                    .map((p) => (_jsxs(TableRow, { hover: true, children: [_jsx(TableCell, { sx: { fontWeight: 700 }, children: _jsx("bdi", { children: p.supplier }) }), _jsx(TableCell, { children: p.professionCode ? name(p.professionAr, p.professionEn) : t('costs.any') }), _jsx(TableCell, { children: p.nationalityCode ? name(p.nationalityAr, p.nationalityEn) : t('costs.any') }), _jsx(TableCell, { align: "right", sx: { fontWeight: 800 }, children: money(p.monthlyCost) }), _jsx(TableCell, { children: method(p.method) }), _jsx(TableCell, { children: _jsx("bdi", { children: p.effectiveFrom.replaceAll('-', '/') }) }), _jsx(TableCell, { children: t('costs.workersCount', { count: p.workers }) }), manage && (_jsxs(TableCell, { sx: { whiteSpace: 'nowrap' }, children: [_jsx(IconButton, { size: "small", "aria-label": t('common.edit'), onClick: () => setEditing({ kind: 'package', id: p.id, input: { supplier: p.supplier, professionCode: p.professionCode, nationalityCode: p.nationalityCode, monthlyCost: p.monthlyCost, method: p.method, effectiveFrom: p.effectiveFrom, notes: p.notes } }), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }), _jsx(IconButton, { size: "small", "aria-label": t('costs.deletePackage'), onClick: () => window.confirm(t('costs.deleteConfirm')) && costsApi.deletePackage(p.id).then(load).catch((f) => setError(errorKey(f))), children: _jsx(DeleteOutlineOutlinedIcon, { fontSize: "small" }) })] }))] }, p.id))), packages.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 8, sx: { textAlign: 'center', color: tokens.gray500, py: 3 }, children: t('costs.noPackages') }) }))] })] }) })] }))] }), editing && (_jsx(CostDialog, { title: editing.kind === 'card' ? t('costs.cardTitle', { name: editing.worker.name }) : editing.id ? t('costs.editPackage') : t('costs.addPackage'), input: editing.input, options: options, package: editing.kind === 'package', error: error, busy: busy, onChange: (input) => setEditing({ ...editing, input }), onClose: () => { setEditing(null); setError(null); }, onSave: save })), imported && (_jsxs(Dialog, { open: true, onClose: () => setImported(null), maxWidth: "sm", fullWidth: true, children: [_jsx(DialogTitle, { sx: { fontWeight: 800 }, children: t('costs.imported.title') }), _jsxs(DialogContent, { children: [_jsx(Alert, { severity: imported.failed ? 'warning' : 'success', sx: { mb: 1.5 }, children: t('costs.imported.summary', { added: imported.added, failed: imported.failed }) }), imported.errors.map((e) => (_jsxs(Typography, { sx: { fontSize: 12.5 }, children: [t('costs.imported.row', { row: e.row, no: e.workerNo ?? '—' }), ": ", e.error ? t(e.error) : ''] }, e.row)))] }), _jsx(DialogActions, { children: _jsx(Button, { onClick: () => setImported(null), children: t('common.close') }) })] }))] }));
}
function SupplierChip({ on, label, count, warn, onClick }) {
    const { t } = useTranslation();
    return (_jsxs(ButtonBase, { onClick: onClick, "aria-pressed": on, sx: { gap: 0.75, px: 1.25, py: 0.5, borderRadius: 99, border: `1px solid ${on ? tokens.navy700 : tokens.gray200}`, bgcolor: on ? tokens.navy700 : '#fff', color: on ? '#fff' : tokens.navy800, fontSize: 12.5, fontWeight: 700 }, children: [_jsx("bdi", { children: label }), count !== undefined && _jsx(Box, { component: "span", sx: { px: 0.75, borderRadius: 99, fontSize: 11.5, bgcolor: on ? 'rgba(255,255,255,.2)' : tokens.gray100 }, children: count }), !!warn && (_jsx(Tooltip, { title: t('costs.missingTip', { count: warn }), children: _jsx(Box, { component: "span", sx: { width: 8, height: 8, borderRadius: '50%', bgcolor: tokens.danger } }) }))] }));
}
/** A package's or a worker's cost: the supplier, the monthly cost, how it is charged and from when. */
export function CostDialog({ title, input, options, package: isPackage, error, busy, onChange, onClose, onSave, }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    return (_jsxs(Dialog, { open: true, onClose: onClose, maxWidth: "sm", fullWidth: true, children: [_jsx(DialogTitle, { sx: { fontWeight: 800 }, children: title }), _jsxs(DialogContent, { children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, pt: 1 }, children: [_jsxs(TextField, { select: true, label: t('costs.col.supplier'), value: input.supplier ?? '', disabled: !isPackage, onChange: (e) => onChange({ ...input, supplier: e.target.value }), required: true, children: [(options?.suppliers ?? (input.supplier ? [input.supplier] : [])).map((s) => (_jsx(MenuItem, { value: s, children: _jsx("bdi", { children: s }) }, s))), input.supplier && options && !options.suppliers.includes(input.supplier) && _jsx(MenuItem, { value: input.supplier, children: input.supplier })] }), _jsx(TextField, { type: "number", label: t('costs.col.cost'), value: input.monthlyCost || '', onChange: (e) => onChange({ ...input, monthlyCost: Number(e.target.value) }), required: true, slotProps: { htmlInput: { min: 0, step: 50 }, input: { endAdornment: _jsx(InputAdornment, { position: "end", children: t('workforce.sar') }) } } }), isPackage && (_jsxs(_Fragment, { children: [_jsxs(TextField, { select: true, label: t('costs.col.profession'), value: input.professionCode ?? '', onChange: (e) => onChange({ ...input, professionCode: e.target.value || null }), helperText: t('costs.anyHelp'), children: [_jsx(MenuItem, { value: "", children: t('costs.any') }), options?.professions.map((o) => (_jsx(MenuItem, { value: o.code, children: ar ? o.nameAr : o.nameEn }, o.code)))] }), _jsxs(TextField, { select: true, label: t('costs.col.nationality'), value: input.nationalityCode ?? '', onChange: (e) => onChange({ ...input, nationalityCode: e.target.value || null }), helperText: t('costs.anyHelp'), children: [_jsx(MenuItem, { value: "", children: t('costs.any') }), options?.nationalities.map((o) => (_jsx(MenuItem, { value: o.code, children: ar ? o.nameAr : o.nameEn }, o.code)))] })] })), _jsxs(TextField, { select: true, label: t('costs.col.method'), value: input.method, onChange: (e) => onChange({ ...input, method: e.target.value }), helperText: t(`costs.methodHelp.${input.method}`), children: [_jsx(MenuItem, { value: "MonthlyFixed", children: t('costs.method.MonthlyFixed') }), _jsx(MenuItem, { value: "ByWorkingDays", children: t('costs.method.ByWorkingDays') })] }), _jsx(DateField, { label: t('costs.col.from'), value: input.effectiveFrom, onChange: (e) => onChange({ ...input, effectiveFrom: e.target.value }), slotProps: { inputLabel: { shrink: true } }, required: true }), _jsx(TextField, { label: t('costs.notes'), value: input.notes ?? '', onChange: (e) => onChange({ ...input, notes: e.target.value || null }), sx: { gridColumn: '1 / -1' }, slotProps: { htmlInput: { maxLength: 300 } } })] })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: onSave, disabled: busy || !input.supplier || !(input.monthlyCost > 0) || !input.effectiveFrom, children: t('common.save') })] })] }));
}
