import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SyncIcon from '@mui/icons-material/Sync';
import { Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, Link, ListItemIcon, Menu, MenuItem, Pagination, Skeleton, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { payrollApi, payrollNotes } from '../../api/payroll';
import { useCrumb } from '../../app/breadcrumbs';
import { payslipsPath } from '../../api/payslips';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrCoverageCard, HrDrawer, HrEmptyState, HrKpiCard, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { exclusionLook, money, noteLook, RunStatusBadge, useMonthName } from './payroll';
import { SponsorsDialog } from './RunDialogs';
import { ColumnsButton, useHiddenColumns } from '../../components/hr/ColumnsMenu';
const workerOptional = ['project', 'status', 'housing', 'transport', 'food', 'other'];
const workerAllowanceColumns = [
    { key: 'housing', value: (l) => l.housing, sum: (s) => s.housing },
    { key: 'transport', value: (l) => l.transport, sum: (s) => s.transport },
    { key: 'food', value: (l) => l.food, sum: (s) => s.food },
    { key: 'other', value: (l) => l.otherAllowances + l.overtime + l.additions, sum: (s) => s.otherAllowances + s.overtime + s.additions },
];
/**
 * A payroll run (docs/02-target-architecture/15 §6): the header with the period and the actions, the approval bar,
 * five KPI cards from the run's own totals, then the workers' grid (paged, filtered and sorted on the server), the
 * financial summary and the exclusions; a worker's pay opens in a drawer.
 */
export function PayrollRunPage() {
    const { id = '' } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const monthName = useMonthName();
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') ?? 'workers';
    const [run, setRun] = useState(null);
    const [siblings, setSiblings] = useState([]);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(null);
    const [moreAnchor, setMoreAnchor] = useState(null);
    const [sponsors, setSponsors] = useState(false);
    const [exclusions, setExclusions] = useState(null);
    const [scope, setScope] = useState({});
    const [version, setVersion] = useState(0);
    const approval = useRecordApproval(run?.approval?.instanceId);
    useCrumb(run ? `${monthName(run.to)} · ${run.runNo}` : undefined, `/payroll/runs/${id}`);
    const reload = useCallback(async () => {
        try {
            const loaded = await payrollApi.get(id);
            setRun(loaded);
            setError(null);
            setExclusions(await payrollApi.exclusions(id));
            setSiblings(await payrollApi.runs(loaded.legalEntityId));
            setVersion((v) => v + 1);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    const act = async (work, done) => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await work();
            if (done)
                setNotice(done);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    if (!run) {
        return (_jsxs(HrScope, { children: [_jsx(ErrorMessage, { messageKey: error }), !error && _jsx(LinearProgress, {})] }));
    }
    // The runs of the registration in order: the period selector moves to the run before or after.
    const ordered = [...siblings].sort((a, b) => a.from.localeCompare(b.from));
    const at = ordered.findIndex((r) => r.id === run.id);
    const before = at > 0 ? ordered[at - 1] : null;
    const after = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null;
    const trend = (pick) => [...run.trend.map((p) => pick(p.totals)), pick(run.totals)];
    const comparison = run.previous ? monthName(run.previous.to) : null;
    const canManage = run.canEdit;
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(RequestQuoteOutlinedIcon, {}), title: `${t('payroll.runTitle')} · ${monthName(run.to)}`, status: _jsx(RunStatusBadge, { status: run.status }), reference: run.runNo, subtitle: _jsxs(_Fragment, { children: [t('payroll.group'), " \u00B7 ", run.legalEntityName, " \u00B7 ", _jsx("bdi", { children: t('payroll.period', { from: date(run.from), to: date(run.to) }) }), " \u00B7 ", t('payroll.calculatedAt', { at: `${date(run.calculatedAt.slice(0, 10))} ${new Date(run.calculatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` })] }), period: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', border: `1px solid ${hr.border}`, borderRadius: '8px', bgcolor: '#fff', height: 36 }, children: [_jsx(IconButton, { size: "small", "aria-label": before ? monthName(before.to) : undefined, disabled: !before, onClick: () => before && navigate(`/payroll/runs/${before.id}`), children: _jsx(ChevronRightIcon, { fontSize: "small", sx: { transform: (theme) => (theme.direction === 'rtl' ? 'none' : 'scaleX(-1)') } }) }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, px: 1, whiteSpace: 'nowrap' }, children: monthName(run.to) }), _jsx(IconButton, { size: "small", "aria-label": after ? monthName(after.to) : undefined, disabled: !after, onClick: () => after && navigate(`/payroll/runs/${after.id}`), children: _jsx(ChevronLeftIcon, { fontSize: "small", sx: { transform: (theme) => (theme.direction === 'rtl' ? 'none' : 'scaleX(-1)') } }) })] }), actions: _jsxs(_Fragment, { children: [canManage && (_jsx(Button, { variant: "outlined", startIcon: _jsx(SyncIcon, {}), disabled: busy, onClick: () => void act(async () => { await payrollApi.recalculate(run.id); await reload(); }, t('payroll.recalculated')), children: t('payroll.recalculate') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(FileDownloadOutlinedIcon, {}), component: "a", href: payrollApi.excelUrl(run.id, scope), download: true, children: t('payroll.excel') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(ReceiptOutlinedIcon, {}), component: "a", href: payslipsPath('workers', run.id, { search: scope.search, note: scope.note, project: scope.project }), target: "_blank", rel: "noopener", title: t('payslip.printAllHint'), children: t('payslip.printAll') }), _jsx(Button, { variant: "outlined", endIcon: _jsx(ArrowDropDownIcon, {}), onClick: (e) => setMoreAnchor(e.currentTarget), children: t('payroll.more') }), canManage && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), disabled: busy || run.totals.workers === 0, onClick: () => setConfirm('submit'), children: t('payroll.submit') })), _jsxs(Menu, { anchorEl: moreAnchor, open: Boolean(moreAnchor), onClose: () => setMoreAnchor(null), children: [can('payroll.settings.manage', true) && (_jsxs(MenuItem, { onClick: () => { setMoreAnchor(null); setSponsors(true); }, children: [_jsx(ListItemIcon, { children: _jsx(LinkOutlinedIcon, { fontSize: "small" }) }), t('payroll.sponsors')] })), run.canDelete && (_jsxs(MenuItem, { onClick: () => { setMoreAnchor(null); setConfirm('delete'); }, sx: { color: hr.danger }, children: [_jsx(ListItemIcon, { children: _jsx(DeleteOutlineIcon, { fontSize: "small", sx: { color: hr.danger } }) }), t('payroll.delete')] }))] })] }) }), _jsx(ErrorMessage, { messageKey: error }), notice && (_jsx(Alert, { severity: "success", sx: { mb: 1.5 }, onClose: () => setNotice(null), children: notice })), run.approval && (_jsx(ApprovalBar, { status: run.approval, detail: approval.detail, onChanged: () => {
                    void reload();
                    void approval.reload();
                } })), _jsxs(Box, { sx: { display: 'grid', gap: 1.5, mb: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))' }, children: [_jsx(HrCoverageCard, { label: t('payroll.kpi.workers'), value: run.coverage.paid, unit: t('payroll.kpi.workersUnit'), of: t('payroll.kpi.of', { count: run.coverage.eligible }), parts: [
                            { label: t('payroll.kpi.paid'), value: run.coverage.paid },
                            { label: t('payroll.kpi.notApproved'), value: run.coverage.timesheetNotApproved },
                            { label: t('payroll.kpi.noTimesheet'), value: run.coverage.noTimesheet },
                            { label: t('payroll.kpi.paidElsewhere'), value: run.coverage.paidElsewhere },
                        ] }), _jsx(HrKpiCard, { label: t('payroll.kpi.base'), value: run.totals.base, unit: t('hr.sar'), icon: _jsx(AttachMoneyIcon, {}), accent: "blue", trend: trend((x) => x.base), previous: run.previous?.totals.base ?? null, comparisonLabel: comparison }), _jsx(HrKpiCard, { label: t('payroll.kpi.allowances'), value: run.totals.allowances, unit: t('hr.sar'), icon: _jsx(AddCircleOutlineIcon, {}), accent: "green", trend: trend((x) => x.allowances), previous: run.previous?.totals.allowances ?? null, comparisonLabel: comparison }), _jsx(HrKpiCard, { label: t('payroll.kpi.deductions'), value: run.totals.deductions, unit: t('hr.sar'), icon: _jsx(RemoveCircleOutlineIcon, {}), accent: "amber", trend: trend((x) => x.deductions), previous: run.previous?.totals.deductions ?? null, comparisonLabel: comparison }), _jsx(HrKpiCard, { label: t('payroll.kpi.net'), value: run.totals.net, unit: t('hr.sar'), icon: _jsx(CheckCircleOutlineIcon, {}), accent: "rose", trend: trend((x) => x.net), previous: run.previous?.totals.net ?? null, comparisonLabel: comparison })] }), _jsxs(Box, { sx: { ...hrCard, px: 2, pb: 2 }, children: [_jsxs(Tabs, { value: tab, onChange: (_, v) => setParams((p) => { p.set('tab', v); return p; }, { replace: true }), sx: { borderBottom: `1px solid ${hr.border}`, mb: 1.5 }, children: [_jsx(Tab, { value: "workers", label: t('payroll.tabs.workers') }), _jsx(Tab, { value: "summary", label: t('payroll.tabs.summary') }), _jsx(Tab, { value: "exclusions", label: t('payroll.tabs.exclusions', { count: exclusions?.length ?? 0 }) })] }), tab === 'workers' && _jsx(WorkersTab, { run: run, version: version, onScope: setScope }), tab === 'summary' && _jsx(SummaryTab, { run: run }), tab === 'exclusions' && _jsx(ExclusionsTab, { list: exclusions })] }), _jsx(ConfirmDialog, { open: confirm === 'submit', title: t('payroll.submit'), text: t('payroll.submitConfirm', { no: run.runNo, workers: run.totals.workers, net: money(run.totals.net) }), busy: busy, onCancel: () => setConfirm(null), onConfirm: () => void act(async () => { await payrollApi.submit(run.id); setConfirm(null); await reload(); }) }), _jsx(ConfirmDialog, { open: confirm === 'delete', title: t('payroll.delete'), text: t('payroll.deleteConfirm', { no: run.runNo }), busy: busy, danger: true, onCancel: () => setConfirm(null), onConfirm: () => void act(async () => { await payrollApi.remove(run.id); navigate('/payroll/runs'); }) }), _jsx(SponsorsDialog, { open: sponsors, onClose: () => setSponsors(false) })] }));
}
function ConfirmDialog({ open, title, text, busy, danger, onCancel, onConfirm }) {
    const { t } = useTranslation();
    return (_jsxs(Dialog, { open: open, onClose: busy ? undefined : onCancel, maxWidth: "xs", fullWidth: true, slotProps: { paper: { sx: { borderRadius: `${hr.radius}px` } } }, children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: title }), _jsx(DialogContent, { children: _jsx(Typography, { sx: { fontSize: 14 }, children: text }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onCancel, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", color: danger ? 'error' : 'primary', onClick: onConfirm, disabled: busy, children: title })] })] }));
}
/** The workers of the run: search, note and project filters, server pages, the grouped head and the scope's total. */
function WorkersTab({ run, version, onScope }) {
    const { t, i18n } = useTranslation();
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [note, setNote] = useState('');
    const [project, setProject] = useState('');
    const [sort, setSort] = useState({ key: '', desc: false });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [dense, setDense] = useState(true);
    const { shown, toggle } = useHiddenColumns('payroll.workers.hiddenColumns', workerOptional);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [open, setOpen] = useState(null);
    const latest = useRef(0);
    // Search waits for the typing to pause; a newer request wins over a slower older one.
    useEffect(() => {
        const timer = setTimeout(() => setQuery(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    const q = useMemo(() => ({ search: query, note: note || undefined, project: project || undefined, sort: sort.key || undefined, desc: sort.desc, page, pageSize }), [query, note, project, sort, page, pageSize]);
    useEffect(() => {
        onScope({ ...q, page: undefined, pageSize: undefined });
        const ticket = ++latest.current;
        payrollApi
            .lines(run.id, q)
            .then((d) => {
            if (ticket === latest.current) {
                setData(d);
                setError(null);
            }
        })
            .catch((failure) => ticket === latest.current && setError(errorKey(failure)));
    }, [run.id, q, version, onScope]);
    useEffect(() => setPage(1), [query, note, project, pageSize]);
    const filtered = Boolean(query.trim() || note || project);
    const sortBy = (key) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' && key !== 'project' }));
    const head = (key, label, align = 'left', className) => (_jsx(TableCell, { align: align, rowSpan: 2, className: className, sortDirection: sort.key === key ? (sort.desc ? 'desc' : 'asc') : false, children: _jsxs(ButtonBase, { onClick: () => sortBy(key), sx: { font: 'inherit', fontWeight: 600, color: 'inherit', gap: 0.25 }, "aria-label": label, children: [label, sort.key === key && _jsx("span", { "aria-hidden": true, children: sort.desc ? '↓' : '↑' })] }) }));
    const rowHeight = dense ? 40 : 50;
    const allowanceCols = workerAllowanceColumns.filter((c) => shown(c.key));
    const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
    const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
    return (_jsxs(Box, { children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1, mb: 1.5, alignItems: { md: 'center' } }, children: [_jsx(TextField, { size: "small", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('payroll.filters.search'), sx: { width: { md: 300 }, flex: { md: '0 0 300px' } }, slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) }, htmlInput: { 'aria-label': t('payroll.filters.search') } } }), _jsxs(TextField, { select: true, size: "small", label: t('payroll.filters.notes'), value: note, onChange: (e) => setNote(e.target.value), sx: { minWidth: 190 }, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('payroll.filters.allNotes') }), _jsx(MenuItem, { value: "any", children: t('payroll.filters.anyNote') }), _jsx(MenuItem, { value: "none", children: t('payroll.filters.noNote') }), payrollNotes.map((n) => (_jsxs(MenuItem, { value: n, children: [t(`payroll.notes.${n}`), " ", run.notes[n] ? `(${run.notes[n]})` : ''] }, n)))] }), _jsxs(TextField, { select: true, size: "small", label: t('payroll.filters.project'), value: project, onChange: (e) => setProject(e.target.value), sx: { minWidth: 220 }, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('payroll.filters.allProjects') }), run.projects.map((p) => (_jsxs(MenuItem, { value: p.projectCrmId, children: [p.projectName, " (", p.workers, ")"] }, p.projectCrmId)))] }), filtered && (_jsx(Button, { size: "small", startIcon: _jsx(FilterAltOffOutlinedIcon, {}), onClick: () => { setSearch(''); setQuery(''); setNote(''); setProject(''); }, children: t('payroll.clearFilters') })), _jsx(Box, { sx: { flex: 1 } }), _jsx(ColumnsButton, { columns: workerOptional.map((key) => ({ key, label: t(`payroll.cols.${key === 'status' ? 'workerStatus' : key}`), group: ['housing', 'transport', 'food', 'other'].includes(key) ? t('payroll.cols.allowancesGroup') : undefined })), shown: shown, toggle: toggle }), _jsxs(ToggleButtonGroup, { size: "small", exclusive: true, value: dense ? 'compact' : 'comfortable', onChange: (_, v) => v && setDense(v === 'compact'), "aria-label": t('payroll.filters.density'), children: [_jsx(ToggleButton, { value: "compact", children: t('payroll.filters.compact') }), _jsx(ToggleButton, { value: "comfortable", children: t('payroll.filters.comfortable') })] })] }), _jsx(ErrorMessage, { messageKey: error }), !data ? (_jsx(Stack, { sx: { gap: 1 }, children: Array.from({ length: 6 }, (_, i) => (_jsx(Skeleton, { variant: "rounded", height: rowHeight }, i))) })) : data.total === 0 ? (_jsx(HrEmptyState, { icon: _jsx(PersonSearchOutlinedIcon, {}), title: filtered ? t('payroll.noResults') : t('payroll.exclusionsEmpty') })) : (_jsxs(_Fragment, { children: [_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 640 }, children: _jsxs(Table, { stickyHeader: true, size: "small", sx: {
                                '& th, & td': { px: 0.75 },
                                '& th': { bgcolor: hr.muted, color: '#475569', fontWeight: 600, fontSize: 11.5, lineHeight: 1.3, py: 0.6, verticalAlign: 'bottom' },
                                '& th.grp': { textAlign: 'center', borderBottom: '1px solid #DBE3EE', verticalAlign: 'middle' },
                                '& thead tr:nth-of-type(2) th': { top: 30 },
                                '& td': { height: rowHeight, whiteSpace: 'nowrap', fontSize: 12, borderBottomColor: '#EEF2F7' },
                                '& .num': { fontVariantNumeric: 'tabular-nums' },
                                '& .pin': { position: 'sticky', insetInlineStart: 0, zIndex: 2, bgcolor: '#fff', boxShadow: `inset -1px 0 0 ${hr.border}` },
                                '& th.pin': { zIndex: 4, bgcolor: hr.muted },
                                '& tfoot td': { position: 'sticky', bottom: 0, bgcolor: '#F8FAFC', fontWeight: 700, borderTop: `1px solid ${hr.border}`, zIndex: 1 },
                                '& tbody tr': { cursor: 'pointer' },
                                '& th.g-allow': { bgcolor: '#E3F6EC', color: '#047857' },
                                '& th.g-allow.grp': { bgcolor: '#C9EEDB' },
                                '& th.g-ded': { bgcolor: '#FDF1DC', color: '#B45309' },
                                '& th.g-ded.grp': { bgcolor: '#FBE2B8' },
                                '& td.g-allow': { backgroundImage: 'linear-gradient(rgba(5,150,105,.045), rgba(5,150,105,.045))' },
                                '& td.g-ded': { backgroundImage: 'linear-gradient(rgba(217,119,6,.05), rgba(217,119,6,.05))' },
                                '& .gs': { borderInlineStart: `2px solid ${hr.border}` },
                            }, children: [_jsxs(TableHead, { children: [_jsxs(TableRow, { children: [_jsx(TableCell, { rowSpan: 2, className: "pin", sx: { minWidth: 170 }, children: _jsxs(ButtonBase, { onClick: () => sortBy('name'), sx: { font: 'inherit', fontWeight: 600, color: 'inherit' }, children: [t('payroll.cols.worker'), " ", sort.key === 'name' && (sort.desc ? '↓' : '↑')] }) }), shown('project') && head('project', t('payroll.cols.project')), shown('status') && _jsx(TableCell, { rowSpan: 2, children: t('payroll.cols.workerStatus') }), head('days', t('payroll.cols.days'), 'right'), head('base', t('payroll.cols.base'), 'right'), _jsx(TableCell, { colSpan: allowanceCols.length + 1, className: "grp g-allow gs", children: t('payroll.cols.allowancesGroup') }), head('deductions', t('payroll.cols.deductions'), 'right', 'g-ded gs'), head('net', t('payroll.cols.net'), 'right')] }), _jsxs(TableRow, { children: [allowanceCols.map((c, i) => (_jsx(TableCell, { align: "right", className: i === 0 ? 'g-allow gs' : 'g-allow', children: t(`payroll.cols.${c.key}`) }, c.key))), _jsx(TableCell, { align: "right", className: allowanceCols.length === 0 ? 'g-allow gs' : 'g-allow', sortDirection: sort.key === 'allowances' ? (sort.desc ? 'desc' : 'asc') : false, children: _jsxs(ButtonBase, { onClick: () => sortBy('allowances'), sx: { font: 'inherit', fontWeight: 600, color: 'inherit' }, children: [t('payroll.cols.allowances'), " ", sort.key === 'allowances' && (sort.desc ? '↓' : '↑')] }) })] })] }), _jsx(TableBody, { children: data.items.map((l) => (_jsxs(TableRow, { hover: true, onClick: () => setOpen(l), tabIndex: 0, onKeyDown: (e) => e.key === 'Enter' && setOpen(l), children: [_jsx(TableCell, { className: "pin", children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75 }, children: [_jsx(HrAvatar, { name: l.name, size: 26 }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.5 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }, title: l.name, children: l.name }), l.notes.length > 0 && (_jsx(Tooltip, { title: l.notes.map((n) => t(`payroll.notes.${n}`)).join('، '), children: _jsx(Box, { component: "span", "aria-label": l.notes.map((n) => t(`payroll.notes.${n}`)).join('، '), sx: { flex: '0 0 auto', width: 8, height: 8, borderRadius: '50%', bgcolor: noteLook[l.notes[0]].color } }) }))] }), _jsxs(Typography, { sx: { fontSize: 10.5, color: hr.textMuted, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis' }, children: [_jsx("bdi", { children: l.workerNo }), " \u00B7 ", (i18n.language === 'ar' ? l.professionAr : l.professionEn) ?? l.professionCode ?? '—'] })] })] }) }), shown('project') && (_jsxs(TableCell, { sx: { maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }, title: l.projectName, children: [l.projectName, l.projects > 1 && _jsxs(Box, { component: "span", sx: { color: hr.textMuted }, children: [" +", l.projects - 1] })] })), shown('status') && (_jsx(TableCell, { children: (i18n.language === 'ar' ? l.statusAr : l.statusEn) && _jsx(HrStatusBadge, { label: (i18n.language === 'ar' ? l.statusAr : l.statusEn), color: hr.success, tint: "#D1FAE5" }) })), _jsx(TableCell, { align: "right", className: "num", children: money(l.paidDays) }), _jsx(TableCell, { align: "right", className: "num", children: money(l.base) }), allowanceCols.map((c, i) => (_jsx(TableCell, { align: "right", className: i === 0 ? 'num g-allow gs' : 'num g-allow', children: money(c.value(l)) }, c.key))), _jsx(TableCell, { align: "right", className: allowanceCols.length === 0 ? 'num g-allow gs' : 'num g-allow', sx: { fontWeight: 600 }, children: money(l.allowances) }), _jsx(TableCell, { align: "right", className: "num g-ded gs", sx: { color: l.deductions ? '#B45309' : undefined }, children: money(l.deductions) }), _jsx(TableCell, { align: "right", className: "num", sx: { fontWeight: 700, color: l.net <= 0 ? hr.danger : hr.text }, children: money(l.net) })] }, l.id))) }), _jsx(TableFooter, { children: _jsxs(TableRow, { children: [_jsxs(TableCell, { className: "pin", children: [t('payroll.total'), _jsx(Typography, { component: "span", sx: { display: 'block', fontSize: 10.5, color: hr.textMuted, fontWeight: 500 }, children: filtered ? t('payroll.totalScopeShort', { count: data.sums.workers }) : t('payroll.totalAllShort', { count: data.sums.workers }) })] }), (shown('project') || shown('status')) && _jsx(TableCell, { colSpan: (shown('project') ? 1 : 0) + (shown('status') ? 1 : 0) }), _jsx(TableCell, { align: "right", className: "num", children: money(data.sums.paidDays) }), _jsx(TableCell, { align: "right", className: "num", sx: { color: hr.primary }, children: money(data.sums.base) }), allowanceCols.map((c, i) => (_jsx(TableCell, { align: "right", className: i === 0 ? 'num g-allow gs' : 'num g-allow', children: money(c.sum(data.sums)) }, c.key))), _jsx(TableCell, { align: "right", className: allowanceCols.length === 0 ? 'num g-allow gs' : 'num g-allow', children: money(data.sums.allowances) }), _jsx(TableCell, { align: "right", className: "num g-ded gs", sx: { color: '#B45309' }, children: money(data.sums.deductions) }), _jsx(TableCell, { align: "right", className: "num", sx: { color: hr.success }, children: money(data.sums.net) })] }) })] }) }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { alignItems: 'center', gap: 1.5, mt: 1.5, '& .MuiPagination-ul': { flexWrap: 'nowrap' } }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: t('payroll.shown', { from, to, total: data.total }) }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Pagination, { count: Math.max(1, Math.ceil(data.total / data.pageSize)), page: data.page, onChange: (_, p) => setPage(p), shape: "rounded", color: "primary", size: "small" }), _jsx(TextField, { select: true, size: "small", value: pageSize, onChange: (e) => setPageSize(Number(e.target.value)), sx: { width: 150, flex: '0 0 auto' }, slotProps: { htmlInput: { 'aria-label': t('payroll.perPage', { count: pageSize }) } }, children: [10, 25, 50, 100].map((n) => (_jsx(MenuItem, { value: n, children: t('payroll.perPage', { count: n }) }, n))) })] })] })), open && _jsx(WorkerDrawer, { runId: run.id, line: open, onClose: () => setOpen(null) })] }));
}
/** One worker's pay in the run: each amount with how it is made, and the approved timesheets it comes from. */
function WorkerDrawer({ runId, line, onClose }) {
    const { t, i18n } = useTranslation();
    const { date } = useCommercialFormat();
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        payrollApi.line(runId, line.id).then(setDetail).catch((failure) => setError(errorKey(failure)));
    }, [runId, line.id]);
    const row = (label, value, hint, color) => (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 1, py: 0.9, borderBottom: '1px solid #EEF2F7', fontSize: 13 }, children: [_jsxs("span", { children: [label, hint && _jsx(Box, { component: "span", sx: { color: hr.textMuted, fontSize: 12, marginInlineStart: 0.75 }, children: hint })] }), _jsx(Box, { component: "b", sx: { fontVariantNumeric: 'tabular-nums', color }, children: money(value) })] }, label));
    const sourceNet = detail?.sources.reduce((s, x) => s + x.net, 0) ?? 0;
    return (_jsxs(HrDrawer, { open: true, onClose: onClose, avatar: _jsx(HrAvatar, { name: line.name, size: 46 }), title: line.name, subtitle: _jsxs(_Fragment, { children: [_jsx("bdi", { children: line.workerNo }), " \u00B7 ", (i18n.language === 'ar' ? line.professionAr : line.professionEn) ?? '—', " \u00B7 ", line.projectName] }), children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Button, { size: "small", variant: "outlined", startIcon: _jsx(ReceiptOutlinedIcon, {}), component: "a", href: payslipsPath('workers', runId, { line: line.id }), target: "_blank", rel: "noopener", sx: { alignSelf: 'flex-start' }, children: t('payslip.open') }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }, children: [
                    [t('payroll.drawer.days'), `${money(line.paidDays)} / 30`, hr.text],
                    [t('payroll.drawer.monthly'), money(line.monthlySalary), hr.text],
                    [t('payroll.drawer.net'), `${money(line.net)} ${t('hr.sar')}`, hr.success],
                ].map(([label, value, color]) => (_jsxs(Box, { sx: { ...hrCard, p: 1.25 }, children: [_jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: label }), _jsx(Typography, { sx: { fontSize: 17, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: value }) })] }, label))) }), line.notes.length > 0 && (_jsx(Stack, { direction: "row", sx: { gap: 0.5, flexWrap: 'wrap' }, children: line.notes.map((n) => (_jsx(HrStatusBadge, { label: t(`payroll.notes.${n}`), ...noteLook[n] }, n))) })), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 0.5 }, children: t('payroll.drawer.earnings') }), row(t('payroll.drawer.base'), line.base), line.housing !== 0 && row(t('payroll.drawer.housing'), line.housing), line.transport !== 0 && row(t('payroll.drawer.transport'), line.transport), line.food !== 0 && row(t('payroll.drawer.food'), line.food), line.otherAllowances !== 0 && row(t('payroll.drawer.other'), line.otherAllowances), line.overtime !== 0 && row(t('payroll.drawer.overtime'), line.overtime), detail && detail.clientAdditions !== 0 && row(t('payroll.drawer.clientAdditions'), detail.clientAdditions), detail && detail.internalAdditions !== 0 && row(t('payroll.drawer.internalAdditions'), detail.internalAdditions)] }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 0.5 }, children: t('payroll.drawer.deductions') }), detail && detail.clientDeductions + detail.customerLoans + detail.internalDeductions + line.gosiEmployee === 0 && _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('payroll.drawer.none') }), detail && detail.clientDeductions !== 0 && row(t('payroll.drawer.clientDeductions'), detail.clientDeductions, undefined, '#B45309'), detail && detail.customerLoans !== 0 && row(t('payroll.drawer.customerLoans'), detail.customerLoans, undefined, '#B45309'), detail && detail.internalDeductions !== 0 && row(t('payroll.drawer.internalDeductions'), detail.internalDeductions, undefined, '#B45309'), line.gosiEmployee !== 0 && row(t('payroll.drawer.gosi'), line.gosiEmployee, t('payroll.drawer.gosiHint', { base: money(line.gosiBase), category: t(`staffPayroll.gosiCategory.${line.gosiCategory}`) }), '#B45309'), line.gosiEmployer !== 0 && _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 0.75 }, children: t('payroll.drawer.gosiEmployer', { amount: money(line.gosiEmployer) }) }), line.absenceDays > 0 && _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 0.75 }, children: t('payroll.drawer.absenceNote', { days: money(line.absenceDays), paid: money(line.paidDays) }) })] }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', bgcolor: '#ECFDF5', borderRadius: '10px', p: 1.5, fontWeight: 700 }, children: [_jsx("span", { children: t('payroll.drawer.net') }), _jsxs(Box, { component: "span", sx: { color: hr.success, fontVariantNumeric: 'tabular-nums' }, children: [money(line.net), " ", t('hr.sar')] })] }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 0.75 }, children: t('payroll.drawer.sources') }), !detail ? (_jsx(Skeleton, { variant: "rounded", height: 52 })) : (_jsxs(Stack, { sx: { gap: 0.75 }, children: [detail.sources.map((s) => (_jsxs(Box, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.25 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 1 }, children: [_jsx(Link, { component: RouterLink, to: `/billing/timesheets/${s.timesheetId}`, sx: { fontWeight: 700, color: hr.primary }, children: _jsx("bdi", { children: s.timesheetNo }) }), _jsx(Box, { component: "b", sx: { fontVariantNumeric: 'tabular-nums' }, children: money(s.net) })] }), _jsxs(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: [s.projectName, " \u00B7 ", _jsx("bdi", { children: t('payroll.drawer.source', { days: money(s.workDays), from: date(s.lineFrom), to: date(s.lineTo) }) })] })] }, s.timesheetLineId))), Math.abs(sourceNet - line.gosiEmployee - line.net) < 0.005 && (_jsxs(Typography, { sx: { fontSize: 12.5, color: hr.success, display: 'flex', alignItems: 'center', gap: 0.5 }, children: [_jsx(CheckCircleOutlineIcon, { sx: { fontSize: 16 } }), line.gosiEmployee ? t('payroll.drawer.matchesAfterGosi') : t('payroll.drawer.matches')] }))] }))] })] }));
}
/** The run's elements and its net by project. */
function SummaryTab({ run }) {
    const { t } = useTranslation();
    const x = run.totals;
    const items = [
        [t('payroll.summary.base'), x.base],
        [t('payroll.summary.housing'), x.housing],
        [t('payroll.summary.transport'), x.transport],
        [t('payroll.summary.food'), x.food],
        [t('payroll.summary.other'), x.otherAllowances],
        [t('payroll.summary.overtime'), x.overtime],
        [t('payroll.summary.additions'), x.additions],
    ];
    const gross = items.reduce((s, [, v]) => s + v, 0) || 1;
    const colours = [hr.primary, '#0E7490', '#7C3AED', '#059669', '#64748B', '#D97706', '#DB2777'];
    const maxProject = Math.max(...run.projects.map((p) => p.net), 1);
    return (_jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }, children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 1 }, children: t('payroll.summary.elements') }), items.map(([label, value], i) => (_jsxs(Box, { sx: { mb: 1.1 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', fontSize: 13 }, children: [_jsx("span", { children: label }), _jsx("b", { style: { fontVariantNumeric: 'tabular-nums' }, children: money(value) })] }), _jsx(Box, { sx: { height: 6, borderRadius: 99, bgcolor: '#EEF2F7', mt: 0.5, overflow: 'hidden' }, children: _jsx(Box, { sx: { height: '100%', width: `${Math.max(0, (value / gross) * 100)}%`, bgcolor: colours[i] } }) })] }, label))), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', borderTop: `1px solid ${hr.border}`, pt: 1, mt: 1, fontSize: 13.5 }, children: [_jsx("span", { children: t('payroll.summary.deductions') }), _jsxs("b", { style: { color: '#B45309', fontVariantNumeric: 'tabular-nums' }, children: ["\u2212", money(x.deductions)] })] }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', mt: 0.75, fontSize: 15, fontWeight: 700 }, children: [_jsx("span", { children: t('payroll.summary.net') }), _jsx("span", { style: { color: hr.success, fontVariantNumeric: 'tabular-nums' }, children: money(x.net) })] }), _jsxs(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 0.5 }, children: [t('payroll.summary.paidDays'), ": ", _jsx("bdi", { children: money(x.paidDays) })] })] }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 1 }, children: t('payroll.summary.byProject') }), run.projects.map((p) => (_jsxs(Box, { sx: { mb: 1.1 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', fontSize: 13, gap: 1 }, children: [_jsxs("span", { children: [p.projectName, " ", _jsxs(Box, { component: "span", sx: { color: hr.textMuted }, children: ["\u00B7 ", t('payroll.summary.workers', { count: p.workers })] })] }), _jsx("b", { style: { fontVariantNumeric: 'tabular-nums' }, children: money(p.net) })] }), _jsx(Box, { sx: { height: 6, borderRadius: 99, bgcolor: '#EEF2F7', mt: 0.5, overflow: 'hidden' }, children: _jsx(Box, { sx: { height: '100%', width: `${(p.net / maxProject) * 100}%`, bgcolor: hr.primary } }) })] }, p.projectCrmId)))] })] }));
}
/** The registration's workers the run does not pay, and why. */
function ExclusionsTab({ list }) {
    const { t } = useTranslation();
    if (!list) {
        return _jsx(LinearProgress, {});
    }
    if (list.length === 0) {
        return _jsx(HrEmptyState, { icon: _jsx(CheckCircleOutlineIcon, {}), title: t('payroll.exclusionsEmpty') });
    }
    return (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted, mb: 1.25 }, children: t('payroll.exclusionsHint') }), _jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 560 }, children: _jsxs(Table, { stickyHeader: true, size: "small", sx: { '& th': { bgcolor: hr.muted, color: '#475569', fontWeight: 600 }, '& td': { height: 42 } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('payroll.cols.worker') }), _jsx(TableCell, { children: t('payroll.cols.number') }), _jsx(TableCell, { children: t('payroll.cols.project') }), _jsx(TableCell, { children: t('payroll.cols.status') }), _jsx(TableCell, { children: t('payroll.reference') })] }) }), _jsx(TableBody, { children: list.map((e) => (_jsxs(TableRow, { hover: true, children: [_jsx(TableCell, { children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(HrAvatar, { name: e.name, size: 26 }), _jsx("b", { children: e.name })] }) }), _jsx(TableCell, { children: _jsx("bdi", { children: e.workerNo }) }), _jsx(TableCell, { children: e.projectName ?? '—' }), _jsx(TableCell, { children: _jsx(HrStatusBadge, { label: t(`payroll.exclusion.${e.kind}`), ...exclusionLook[e.kind] }) }), _jsx(TableCell, { children: _jsx("bdi", { children: e.reference ?? '—' }) })] }, e.id))) })] }) })] }));
}
