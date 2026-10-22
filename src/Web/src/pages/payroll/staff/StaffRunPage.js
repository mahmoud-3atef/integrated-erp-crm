import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import MailOutlineIcon from '@mui/icons-material/EmailOutlined';
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
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SyncIcon from '@mui/icons-material/Sync';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import { Alert, Box, Button, ButtonBase, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, ListItemIcon, Menu, MenuItem, Pagination, Skeleton, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { staffNotes, staffPayrollApi } from '../../../api/staffPayroll';
import { payslipsPath } from '../../../api/payslips';
import { useCrumb } from '../../../app/breadcrumbs';
import { useSession } from '../../../app/session';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { HrAvatar, HrCoverageCard, HrDrawer, HrEmptyState, HrKpiCard, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../../components/hr/Hr';
import { ApprovalBar, useRecordApproval, ShownStatus } from '../../../components/workflow/RecordApproval';
import { useMonthName as usePeriodName } from '../../attendance/AttendanceMonthPage';
import { PayslipEmailDialog } from './PayslipEmailDialog';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { money, RunStatusBadge } from '../payroll';
// The grid's optional columns (the totals, days, basic and net always show); the viewer's choice is kept in their browser.
const hiddenKey = 'staffPayroll.hiddenColumns';
const optionalColumns = ['department', 'housing', 'other', 'overtime', 'absence', 'penalties', 'advances', 'otherDeductions', 'gosi'];
const detailColumns = [
    { key: 'housing', label: 'housing', group: 'allowances', value: (l) => l.housing, sum: (s) => s.housing },
    { key: 'other', label: 'other', group: 'allowances', value: (l) => l.otherAllowances + l.additions, sum: (s) => s.otherAllowances },
    { key: 'overtime', label: 'overtime', group: 'allowances', value: (l) => l.overtime, sum: (s) => s.overtime },
    { key: 'absence', label: 'absence', group: 'deductions', value: (l) => l.absence, sum: (s) => s.absence },
    { key: 'penalties', label: 'penalties', group: 'deductions', value: (l) => l.penalties, sum: (s) => s.penalties },
    { key: 'advances', label: 'advances', group: 'deductions', value: (l) => l.advances, sum: (s) => s.advances },
    { key: 'otherDeductions', label: 'otherDeductions', group: 'deductions', value: (l) => l.otherDeductions, sum: (s) => s.otherDeductions },
    { key: 'gosi', label: 'gosi', group: 'deductions', value: (l) => l.gosiEmployee, sum: (s) => s.gosiEmployee },
];
export const staffNoteLook = {
    joined: { color: hr.primary, tint: '#EFF6FF' },
    left: { color: '#475569', tint: '#F1F5F9' },
    no_iban: { color: '#B45309', tint: '#FEF3C7' },
    no_attendance: { color: '#B91C1C', tint: '#FEE2E2' },
    salary_changed: { color: '#6D28D9', tint: '#EDE9FE' },
    deferred: { color: '#B45309', tint: '#FEF3C7' },
    above_cap: { color: '#0E7490', tint: '#CFFAFE' },
    no_gosi_rate: { color: '#B91C1C', tint: '#FEE2E2' },
    net_not_positive: { color: hr.danger, tint: '#FEE2E2' },
};
/**
 * A staff payroll run (docs/03-migration-plan/11, the payroll page's anatomy of 15 §6): the header with the attendance
 * month and the actions, the approval bar, five KPI cards from the run's own totals, then the employees' grid (paged,
 * filtered and sorted on the server), the summary by department, GOSI and what the month's cap deferred; an
 * employee's pay opens in a drawer, where an adjustment is added with its reason while the run is open.
 */
export function StaffRunPage() {
    const { id = '' } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { date } = useCommercialFormat();
    const { can } = useSession();
    const periodName = usePeriodName();
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') ?? 'employees';
    const [run, setRun] = useState(null);
    const [siblings, setSiblings] = useState([]);
    const [deferred, setDeferred] = useState(null);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(null);
    const [emailing, setEmailing] = useState(false);
    const [moreAnchor, setMoreAnchor] = useState(null);
    const [scope, setScope] = useState({});
    const [version, setVersion] = useState(0);
    const approval = useRecordApproval(run?.approval?.instanceId);
    useCrumb(run ? `${periodName(run.period)} · ${run.runNo}` : undefined, `/payroll/staff/${id}`);
    const reload = useCallback(async () => {
        try {
            const loaded = await staffPayrollApi.get(id);
            setRun(loaded);
            setError(null);
            setDeferred(await staffPayrollApi.deferred(id));
            setSiblings(await staffPayrollApi.runs({ legalEntityId: loaded.legalEntityId }));
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
    const ordered = [...siblings].sort((a, b) => a.period.localeCompare(b.period));
    const at = ordered.findIndex((r) => r.id === run.id);
    const before = at > 0 ? ordered[at - 1] : null;
    const after = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null;
    const trend = (pick) => [...run.trend.map((p) => pick(p.totals)), pick(run.totals)];
    const comparison = run.previous ? periodName(run.previous.period) : null;
    const x = run.totals;
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(RequestQuoteOutlinedIcon, {}), title: `${t('staffPayroll.runTitle')} · ${periodName(run.period)}`, status: _jsx(ShownStatus, { approval: approval.detail, children: _jsx(RunStatusBadge, { status: run.status }) }), reference: run.runNo, subtitle: _jsxs(_Fragment, { children: [run.legalEntityName, " \u00B7 ", _jsx("bdi", { children: t('staffPayroll.periodLine', { from: date(run.from), to: date(run.to) }) }), " \u00B7 ", t('staffPayroll.calculatedAt', { at: `${date(run.calculatedAt.slice(0, 10))} ${new Date(run.calculatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` })] }), period: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', border: `1px solid ${hr.border}`, borderRadius: '8px', bgcolor: '#fff', height: 36 }, children: [_jsx(IconButton, { size: "small", "aria-label": before ? periodName(before.period) : undefined, disabled: !before, onClick: () => before && navigate(`/payroll/staff/${before.id}`), children: _jsx(ChevronRightIcon, { fontSize: "small", sx: { transform: (theme) => (theme.direction === 'rtl' ? 'none' : 'scaleX(-1)') } }) }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, px: 1, whiteSpace: 'nowrap' }, children: periodName(run.period) }), _jsx(IconButton, { size: "small", "aria-label": after ? periodName(after.period) : undefined, disabled: !after, onClick: () => after && navigate(`/payroll/staff/${after.id}`), children: _jsx(ChevronLeftIcon, { fontSize: "small", sx: { transform: (theme) => (theme.direction === 'rtl' ? 'none' : 'scaleX(-1)') } }) })] }), actions: _jsxs(_Fragment, { children: [run.canEdit && (_jsx(Button, { variant: "outlined", startIcon: _jsx(SyncIcon, {}), disabled: busy, onClick: () => void act(async () => { await staffPayrollApi.recalculate(run.id); await reload(); }, t('staffPayroll.recalculated')), children: t('staffPayroll.recalculate') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(FileDownloadOutlinedIcon, {}), component: "a", href: staffPayrollApi.excelUrl(run.id, scope), download: true, children: t('staffPayroll.excel') }), can('staff.salaries.view') && (_jsx(Button, { variant: "outlined", startIcon: _jsx(ReceiptOutlinedIcon, {}), component: "a", href: payslipsPath('staff', run.id, { search: scope.search, department: scope.department, note: scope.note }), target: "_blank", rel: "noopener", title: t('payslip.printAllHint'), children: t('payslip.printAll') })), run.status === 'Approved' && can('payroll.payslips.send', true) && can('staff.salaries.view') && (_jsx(Button, { variant: "outlined", startIcon: _jsx(MailOutlineIcon, {}), onClick: () => setEmailing(true), children: t('payslip.email.open') })), run.canEdit && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", endIcon: _jsx(ArrowDropDownIcon, {}), onClick: (e) => setMoreAnchor(e.currentTarget), children: t('staffPayroll.more') }), _jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), disabled: busy || x.employees === 0, onClick: () => setConfirm('submit'), children: t('staffPayroll.submit') }), _jsx(Menu, { anchorEl: moreAnchor, open: Boolean(moreAnchor), onClose: () => setMoreAnchor(null), children: _jsxs(MenuItem, { onClick: () => { setMoreAnchor(null); setConfirm('delete'); }, sx: { color: hr.danger }, children: [_jsx(ListItemIcon, { children: _jsx(DeleteOutlineIcon, { fontSize: "small", sx: { color: hr.danger } }) }), t('staffPayroll.delete')] }) })] }))] }) }), _jsx(ErrorMessage, { messageKey: error }), notice && (_jsx(Alert, { severity: "success", sx: { mb: 1.5 }, onClose: () => setNotice(null), children: notice })), emailing && _jsx(PayslipEmailDialog, { runId: run.id, scope: { search: scope.search, department: scope.department, note: scope.note }, onClose: () => setEmailing(false) }), run.lastComment && run.status === 'Returned' && (_jsx(Alert, { severity: "warning", sx: { mb: 1.5 }, children: run.lastComment })), run.approval && _jsx(ApprovalBar, { status: run.approval, detail: approval.detail, onChanged: () => { void reload(); void approval.reload(); } }), _jsxs(Box, { sx: { display: 'grid', gap: 1.5, mb: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))' }, children: [_jsx(HrCoverageCard, { label: t('staffPayroll.kpi.employees'), value: x.employees, unit: t('staffPayroll.kpi.employeesUnit'), of: `${t('staffPayroll.kpi.of', { count: x.employees + x.noSalary })} · ${t('staffPayroll.kpi.noIban')} ${x.withoutIban} · ${t('staffPayroll.kpi.joiners')} ${x.joiners}`, parts: [
                            { label: t('staffPayroll.kpi.inRun'), value: x.employees },
                            { label: t('staffPayroll.kpi.noSalary'), value: x.noSalary },
                        ] }), _jsx(HrKpiCard, { label: t('staffPayroll.kpi.basic'), value: x.basic, unit: t('hr.sar'), icon: _jsx(AttachMoneyIcon, {}), accent: "blue", trend: trend((v) => v.basic), previous: run.previous?.totals.basic ?? null, comparisonLabel: comparison }), _jsx(HrKpiCard, { label: t('staffPayroll.kpi.allowances'), value: x.allowances, unit: t('hr.sar'), icon: _jsx(AddCircleOutlineIcon, {}), accent: "green", trend: trend((v) => v.allowances), previous: run.previous?.totals.allowances ?? null, comparisonLabel: comparison }), _jsx(HrKpiCard, { label: t('staffPayroll.kpi.deductions'), value: x.deductions, unit: t('hr.sar'), icon: _jsx(RemoveCircleOutlineIcon, {}), accent: "amber", trend: trend((v) => v.deductions), previous: run.previous?.totals.deductions ?? null, comparisonLabel: comparison }), _jsx(HrKpiCard, { label: t('staffPayroll.kpi.net'), value: x.net, unit: t('hr.sar'), icon: _jsx(CheckCircleOutlineIcon, {}), accent: "rose", trend: trend((v) => v.net), previous: run.previous?.totals.net ?? null, comparisonLabel: comparison })] }), _jsxs(Box, { sx: { ...hrCard, px: 2, pb: 2 }, children: [_jsxs(Tabs, { value: tab, variant: "scrollable", onChange: (_, v) => setParams((p) => { p.set('tab', v); return p; }, { replace: true }), sx: { borderBottom: `1px solid ${hr.border}`, mb: 1.5 }, children: [_jsx(Tab, { value: "employees", label: t('staffPayroll.tabs.employees') }), _jsx(Tab, { value: "summary", label: t('staffPayroll.tabs.summary') }), _jsx(Tab, { value: "gosi", label: t('staffPayroll.tabs.gosi') }), _jsx(Tab, { value: "deferred", label: t('staffPayroll.tabs.deferred', { count: deferred?.length ?? 0 }) })] }), tab === 'employees' && _jsx(EmployeesTab, { run: run, version: version, onScope: setScope, onChanged: reload }), tab === 'summary' && _jsx(SummaryTab, { run: run }), tab === 'gosi' && _jsx(GosiTab, { run: run }), tab === 'deferred' && _jsx(DeferredTab, { list: deferred })] }), _jsx(ConfirmDialog, { open: confirm === 'submit', title: t('staffPayroll.submit'), text: t('staffPayroll.submitConfirm', { no: run.runNo, count: x.employees, net: money(x.net) }), busy: busy, onCancel: () => setConfirm(null), onConfirm: () => void act(async () => { await staffPayrollApi.submit(run.id); setConfirm(null); await reload(); }) }), _jsx(ConfirmDialog, { open: confirm === 'delete', title: t('staffPayroll.delete'), text: t('staffPayroll.deleteConfirm', { no: run.runNo }), busy: busy, danger: true, onCancel: () => setConfirm(null), onConfirm: () => void act(async () => { await staffPayrollApi.remove(run.id); navigate('/payroll/staff'); }) })] }));
}
function ConfirmDialog({ open, title, text, busy, danger, onCancel, onConfirm }) {
    const { t } = useTranslation();
    return (_jsxs(Dialog, { open: open, onClose: busy ? undefined : onCancel, maxWidth: "xs", fullWidth: true, slotProps: { paper: { sx: { borderRadius: `${hr.radius}px` } } }, children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: title }), _jsx(DialogContent, { children: _jsx(Typography, { sx: { fontSize: 14 }, children: text }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onCancel, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", color: danger ? 'error' : 'primary', onClick: onConfirm, disabled: busy, children: title })] })] }));
}
/** The run's employees: search, department and note filters, server pages, the grouped head and the scope's total. */
function EmployeesTab({ run, version, onScope, onChanged }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [note, setNote] = useState('');
    const [department, setDepartment] = useState('');
    const [sort, setSort] = useState({ key: '', desc: false });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [dense, setDense] = useState(true);
    const [hidden, setHidden] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(hiddenKey) ?? '[]');
            return Array.isArray(saved) ? saved.filter((k) => optionalColumns.includes(k)) : [];
        }
        catch {
            return [];
        }
    });
    const [columnsAnchor, setColumnsAnchor] = useState(null);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [open, setOpen] = useState(null);
    const latest = useRef(0);
    useEffect(() => {
        const timer = setTimeout(() => setQuery(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    const q = useMemo(() => ({ search: query, note: note || undefined, department: department || undefined, sort: sort.key || undefined, desc: sort.desc, page, pageSize }), [query, note, department, sort, page, pageSize]);
    useEffect(() => {
        onScope({ ...q, page: undefined, pageSize: undefined });
        const ticket = ++latest.current;
        staffPayrollApi
            .lines(run.id, q)
            .then((d) => {
            if (ticket === latest.current) {
                setData(d);
                setError(null);
            }
        })
            .catch((failure) => ticket === latest.current && setError(errorKey(failure)));
    }, [run.id, q, version, onScope]);
    useEffect(() => setPage(1), [query, note, department, pageSize]);
    const filtered = Boolean(query.trim() || note || department);
    const sortBy = (key) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' && key !== 'department' }));
    const head = (key, label, align = 'left', rowSpan = 2, className) => (_jsx(TableCell, { align: align, rowSpan: rowSpan, className: className, sortDirection: sort.key === key ? (sort.desc ? 'desc' : 'asc') : false, children: _jsxs(ButtonBase, { onClick: () => sortBy(key), sx: { font: 'inherit', fontWeight: 600, color: 'inherit', gap: 0.25 }, children: [label, sort.key === key && _jsx("span", { "aria-hidden": true, children: sort.desc ? '↓' : '↑' })] }) }));
    const rowHeight = dense ? 40 : 50;
    const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
    const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
    const num = (v, sx, key, group) => (_jsx(TableCell, { align: "right", className: group ? `num ${group}` : 'num', sx: sx, children: money(v) }, key));
    const shown = (key) => !hidden.includes(key);
    const allowanceCols = detailColumns.filter((c) => c.group === 'allowances' && shown(c.key));
    const deductionCols = detailColumns.filter((c) => c.group === 'deductions' && shown(c.key));
    const toggle = (key) => {
        const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
        setHidden(next);
        try {
            localStorage.setItem(hiddenKey, JSON.stringify(next));
        }
        catch {
            // A private window or blocked storage: the choice lasts for this page only.
        }
    };
    return (_jsxs(Box, { children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1, mb: 1.5, alignItems: { md: 'center' } }, children: [_jsx(TextField, { size: "small", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('staffPayroll.filters.search'), sx: { width: { md: 280 }, flex: { md: '0 0 280px' } }, slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) }, htmlInput: { 'aria-label': t('staffPayroll.filters.search') } } }), _jsxs(TextField, { select: true, size: "small", label: t('staffPayroll.cols.department'), value: department, onChange: (e) => setDepartment(e.target.value), sx: { minWidth: 200 }, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staffPayroll.filters.allDepartments') }), run.departments.filter((d) => d.departmentId).map((d) => (_jsxs(MenuItem, { value: d.departmentId, children: [(ar ? d.nameAr : d.nameEn) ?? '—', " (", d.employees, ")"] }, d.departmentId)))] }), _jsxs(TextField, { select: true, size: "small", label: t('staffPayroll.filters.notes'), value: note, onChange: (e) => setNote(e.target.value), sx: { minWidth: 190 }, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staffPayroll.filters.allNotes') }), _jsx(MenuItem, { value: "any", children: t('staffPayroll.filters.anyNote') }), staffNotes.filter((n) => run.notes[n]).map((n) => (_jsxs(MenuItem, { value: n, children: [t(`staffPayroll.notes.${n}`), " (", run.notes[n], ")"] }, n)))] }), filtered && (_jsx(Button, { size: "small", startIcon: _jsx(FilterAltOffOutlinedIcon, {}), onClick: () => { setSearch(''); setQuery(''); setNote(''); setDepartment(''); }, children: t('staffPayroll.clearFilters') })), _jsx(Box, { sx: { flex: 1 } }), _jsx(Button, { variant: "outlined", size: "small", startIcon: _jsx(ViewColumnOutlinedIcon, {}), onClick: (e) => setColumnsAnchor(e.currentTarget), sx: { height: 34 }, children: t('staffPayroll.filters.columns') }), _jsx(Menu, { anchorEl: columnsAnchor, open: Boolean(columnsAnchor), onClose: () => setColumnsAnchor(null), children: optionalColumns.map((key) => (_jsxs(MenuItem, { dense: true, onClick: () => toggle(key), children: [_jsx(Checkbox, { size: "small", checked: shown(key), sx: { p: 0.25, marginInlineEnd: 1 } }), t(`staffPayroll.cols.${key === 'department' ? 'department' : detailColumns.find((c) => c.key === key).label}`), key !== 'department' && _jsxs(Box, { component: "span", sx: { color: hr.textMuted, fontSize: 12, marginInlineStart: 0.75 }, children: ["\u00B7 ", t(`staffPayroll.cols.${detailColumns.find((c) => c.key === key).group}Group`)] })] }, key))) }), _jsxs(ToggleButtonGroup, { size: "small", exclusive: true, value: dense ? 'compact' : 'comfortable', onChange: (_, v) => v && setDense(v === 'compact'), "aria-label": t('staffPayroll.filters.density'), children: [_jsx(ToggleButton, { value: "compact", children: t('staffPayroll.filters.compact') }), _jsx(ToggleButton, { value: "comfortable", children: t('staffPayroll.filters.comfortable') })] })] }), _jsx(ErrorMessage, { messageKey: error }), !data ? (_jsx(Stack, { sx: { gap: 1 }, children: Array.from({ length: 6 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: rowHeight }, i)) })) : data.total === 0 ? (_jsx(HrEmptyState, { icon: _jsx(PersonSearchOutlinedIcon, {}), title: filtered ? t('staffPayroll.noResults') : t('staffPayroll.empty') })) : (_jsxs(_Fragment, { children: [_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 640 }, children: _jsxs(Table, { stickyHeader: true, size: "small", sx: {
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
                            }, children: [_jsxs(TableHead, { children: [_jsxs(TableRow, { children: [_jsx(TableCell, { rowSpan: 2, className: "pin", sx: { minWidth: 170 }, children: _jsxs(ButtonBase, { onClick: () => sortBy('name'), sx: { font: 'inherit', fontWeight: 600, color: 'inherit' }, children: [t('staffPayroll.cols.employee'), " ", sort.key === 'name' && (sort.desc ? '↓' : '↑')] }) }), shown('department') && head('department', t('staffPayroll.cols.department')), head('days', t('staffPayroll.cols.days'), 'right'), head('basic', t('staffPayroll.cols.basic'), 'right'), _jsx(TableCell, { colSpan: allowanceCols.length + 1, className: "grp g-allow gs", children: t('staffPayroll.cols.allowancesGroup') }), _jsx(TableCell, { colSpan: deductionCols.length + 1, className: "grp g-ded gs", children: t('staffPayroll.cols.deductionsGroup') }), head('net', t('staffPayroll.cols.net'), 'right')] }), _jsxs(TableRow, { children: [allowanceCols.map((c, i) => (_jsx(TableCell, { align: "right", className: i === 0 ? 'g-allow gs' : 'g-allow', children: t(`staffPayroll.cols.${c.label}`) }, c.key))), head('allowances', t('staffPayroll.cols.total'), 'right', 1, allowanceCols.length === 0 ? 'g-allow gs' : 'g-allow'), deductionCols.map((c, i) => (_jsx(TableCell, { align: "right", className: i === 0 ? 'g-ded gs' : 'g-ded', children: t(`staffPayroll.cols.${c.label}`) }, c.key))), head('deductions', t('staffPayroll.cols.total'), 'right', 1, deductionCols.length === 0 ? 'g-ded gs' : 'g-ded')] })] }), _jsx(TableBody, { children: data.items.map((l) => (_jsxs(TableRow, { hover: true, onClick: () => setOpen(l), tabIndex: 0, onKeyDown: (e) => e.key === 'Enter' && setOpen(l), children: [_jsx(TableCell, { className: "pin", children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75 }, children: [_jsx(HrAvatar, { name: l.name, size: 26 }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.5 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }, title: l.name, children: l.name }), l.notes.length > 0 && (_jsx(Tooltip, { title: l.notes.map((n) => t(`staffPayroll.notes.${n}`)).join('، '), children: _jsx(Box, { component: "span", "aria-label": l.notes.map((n) => t(`staffPayroll.notes.${n}`)).join('، '), sx: { flex: '0 0 auto', width: 8, height: 8, borderRadius: '50%', bgcolor: staffNoteLook[l.notes[0]].color } }) }))] }), _jsxs(Typography, { sx: { fontSize: 10.5, color: hr.textMuted, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }, children: [_jsx("bdi", { children: l.employeeNo }), (ar ? l.jobTitleAr : l.jobTitleEn) && ` · ${ar ? l.jobTitleAr : l.jobTitleEn}`] })] })] }) }), shown('department') && (_jsx(TableCell, { sx: { maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }, title: (ar ? l.departmentAr : l.departmentEn) ?? undefined, children: (ar ? l.departmentAr : l.departmentEn) ?? '—' })), num(l.paidDays), num(l.basic), allowanceCols.map((c, i) => num(c.value(l), undefined, c.key, i === 0 ? 'g-allow gs' : 'g-allow')), num(l.allowances, { fontWeight: 600 }, undefined, allowanceCols.length === 0 ? 'g-allow gs' : 'g-allow'), deductionCols.map((c, i) => num(c.value(l), undefined, c.key, i === 0 ? 'g-ded gs' : 'g-ded')), num(l.deductions, { fontWeight: 600, color: l.deductions ? '#B45309' : undefined }, undefined, deductionCols.length === 0 ? 'g-ded gs' : 'g-ded'), num(l.net, { fontWeight: 700, color: l.net <= 0 ? hr.danger : hr.text })] }, l.id))) }), _jsx(TableFooter, { children: _jsxs(TableRow, { children: [_jsxs(TableCell, { className: "pin", children: [t('staffPayroll.total'), _jsx(Typography, { component: "span", sx: { display: 'block', fontSize: 10.5, color: hr.textMuted, fontWeight: 500 }, children: filtered ? t('staffPayroll.totalScopeShort', { count: data.sums.employees }) : t('staffPayroll.totalAllShort', { count: data.sums.employees }) })] }), _jsx(TableCell, { colSpan: shown('department') ? 2 : 1 }), num(data.sums.basic, { color: hr.primary }), allowanceCols.map((c, i) => num(c.sum(data.sums), undefined, c.key, i === 0 ? 'g-allow gs' : 'g-allow')), num(data.sums.allowances, undefined, undefined, allowanceCols.length === 0 ? 'g-allow gs' : 'g-allow'), deductionCols.map((c, i) => num(c.sum(data.sums), undefined, c.key, i === 0 ? 'g-ded gs' : 'g-ded')), num(data.sums.deductions, { color: '#B45309' }, undefined, deductionCols.length === 0 ? 'g-ded gs' : 'g-ded'), num(data.sums.net, { color: hr.success })] }) })] }) }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { alignItems: 'center', gap: 1.5, mt: 1.5, '& .MuiPagination-ul': { flexWrap: 'nowrap' } }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: t('staffPayroll.shown', { from, to, total: data.total }) }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Pagination, { count: Math.max(1, Math.ceil(data.total / data.pageSize)), page: data.page, onChange: (_, p) => setPage(p), shape: "rounded", color: "primary", size: "small" }), _jsx(TextField, { select: true, size: "small", value: pageSize, onChange: (e) => setPageSize(Number(e.target.value)), sx: { width: 150, flex: '0 0 auto' }, slotProps: { htmlInput: { 'aria-label': t('staffPayroll.perPage', { count: pageSize }) } }, children: [10, 25, 50, 100].map((n) => (_jsx(MenuItem, { value: n, children: t('staffPayroll.perPage', { count: n }) }, n))) })] })] })), open && (_jsx(LineDrawer, { run: run, line: open, onClose: () => setOpen(null), onChanged: async () => {
                    await onChanged();
                } }))] }));
}
/** One employee's pay: each amount with how it is made and where it comes from, GOSI, the cap, the bank, and the adjustments. */
function LineDrawer({ run, line, onClose, onChanged }) {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const ar = i18n.language === 'ar';
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState(null);
    const [adding, setAdding] = useState(null);
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const load = useCallback(() => {
        staffPayrollApi
            .line(run.id, line.id)
            .then((d) => (setDetail(d), setError(null)))
            .catch((failure) => setError(errorKey(failure)));
    }, [run.id, line.id]);
    useEffect(load, [load]);
    const row = (label, value, hint, color) => (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 1, py: 0.9, borderBottom: '1px solid #EEF2F7', fontSize: 13 }, children: [_jsxs("span", { children: [label, hint && _jsx(Box, { component: "span", sx: { color: hr.textMuted, fontSize: 12, marginInlineStart: 0.75 }, children: hint })] }), _jsx(Box, { component: "b", sx: { fontVariantNumeric: 'tabular-nums', color }, children: money(value) })] }, label + (typeof hint === 'string' ? hint : '')));
    const save = async () => {
        if (!adding)
            return;
        setBusy(true);
        setError(null);
        try {
            await staffPayrollApi.addAdjustment(run.id, { employeeId: line.employeeId, kind: adding, amount: Number(amount), reason: reason.trim() });
            setAdding(null);
            setAmount('');
            setReason('');
            await onChanged();
            onClose();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const remove = async (adjustmentId) => {
        setBusy(true);
        try {
            await staffPayrollApi.removeAdjustment(run.id, adjustmentId);
            await onChanged();
            onClose();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const d = detail;
    const l = d?.line ?? line;
    const deductionItems = d?.items.filter((i) => i.kind !== 'Addition') ?? [];
    return (_jsxs(HrDrawer, { open: true, onClose: onClose, avatar: _jsx(HrAvatar, { name: line.name, size: 46 }), title: line.name, subtitle: _jsxs(_Fragment, { children: [_jsx("bdi", { children: line.employeeNo }), " \u00B7 ", (ar ? line.jobTitleAr : line.jobTitleEn) ?? '—', " \u00B7 ", (ar ? line.departmentAr : line.departmentEn) ?? '—'] }), children: [_jsx(ErrorMessage, { messageKey: error }), can('staff.salaries.view') && (_jsx(Button, { size: "small", variant: "outlined", startIcon: _jsx(ReceiptOutlinedIcon, {}), component: "a", href: payslipsPath('staff', run.id, { line: line.id }), target: "_blank", rel: "noopener", sx: { alignSelf: 'flex-start' }, children: t('payslip.open') })), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }, children: [
                    [t('staffPayroll.drawer.days'), `${money(l.paidDays)} / 30`, hr.text],
                    [t('staffPayroll.drawer.monthly'), money(l.monthlySalary), hr.text],
                    [t('staffPayroll.drawer.net'), `${money(l.net)} ${t('hr.sar')}`, hr.success],
                ].map(([label, value, color]) => (_jsxs(Box, { sx: { ...hrCard, p: 1.25 }, children: [_jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: label }), _jsx(Typography, { sx: { fontSize: 17, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: value }) })] }, label))) }), l.notes.length > 0 && (_jsx(Stack, { direction: "row", sx: { gap: 0.5, flexWrap: 'wrap' }, children: l.notes.map((n) => (_jsx(HrStatusBadge, { label: t(`staffPayroll.notes.${n}`), ...staffNoteLook[n] }, n))) })), !d ? (_jsx(Skeleton, { variant: "rounded", height: 260 })) : (_jsxs(_Fragment, { children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 0.5 }, children: t('staffPayroll.drawer.earnings') }), row(t('staffPayroll.drawer.basic'), l.basic, t('staffPayroll.drawer.share', { monthly: money(d.monthlyBasic), days: money(l.serviceDays) })), l.housing !== 0 && row(t('staffPayroll.drawer.housing'), l.housing), l.otherAllowances !== 0 && row(t('staffPayroll.drawer.other'), l.otherAllowances), l.overtime !== 0 && row(t('staffPayroll.drawer.overtime', { hours: money(d.overtimeHours) }), l.overtime, t('staffPayroll.drawer.overtimeHint')), d.items.filter((i) => i.kind === 'Addition').map((i) => row(t('staffPayroll.drawer.addition'), i.deducted, i.description))] }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 0.5 }, children: t('staffPayroll.drawer.deductions') }), d.absenceOnly !== 0 && row(t('staffPayroll.drawer.absence', { days: money(d.unpaidDays) }), d.absenceOnly, t('staffPayroll.drawer.dayWage', { wage: money(l.monthlySalary / 30) }), '#B45309'), d.late !== 0 && row(t('staffPayroll.drawer.late', { minutes: d.lateMinutes }), d.late, undefined, '#B45309'), d.sickPart !== 0 && row(t('staffPayroll.drawer.sick', { days: money(d.sickPartDays) }), d.sickPart, undefined, '#B45309'), deductionItems.filter((i) => i.kind !== 'Suspension').map((i) => row(t(`staffPayroll.items.${i.kind}`), i.deducted, _jsxs(_Fragment, { children: [_jsx("bdi", { children: i.reference === 'adjustment' ? i.description : i.reference }), i.deferred && ` · ${t('staffPayroll.drawer.deferredPart', { amount: money(i.due - i.deducted) })}`] }), '#B45309')), l.gosiEmployee !== 0 && row(t('staffPayroll.drawer.gosi'), l.gosiEmployee, t('staffPayroll.drawer.gosiHint', { base: money(d.gosiBase), employer: money(d.gosiEmployer) }), '#B45309'), l.deductions === 0 && _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('staffPayroll.drawer.none') }), _jsxs(Box, { sx: { mt: 1, bgcolor: '#FFFBEB', borderRadius: '8px', p: 1, fontSize: 12.5 }, children: [t('staffPayroll.drawer.cap', { cap: money(d.capLimit), used: money(l.penalties + l.advances + deductionItems.filter((i) => i.kind === 'Other').reduce((s, i) => s + i.deducted, 0)) }), l.deferred > 0 && ` ${t('staffPayroll.drawer.deferred', { amount: money(l.deferred) })}`] })] }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', bgcolor: '#ECFDF5', borderRadius: '10px', p: 1.5, fontWeight: 700 }, children: [_jsx("span", { children: t('staffPayroll.drawer.net') }), _jsxs(Box, { component: "span", sx: { color: hr.success, fontVariantNumeric: 'tabular-nums' }, children: [money(l.net), " ", t('hr.sar')] })] }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 0.5 }, children: t('staffPayroll.drawer.payment') }), _jsx(Typography, { sx: { fontSize: 13, color: d.iban ? hr.text : '#B45309' }, children: d.iban ? (_jsxs(_Fragment, { children: [t('staffPayroll.drawer.transfer'), " \u00B7 ", d.bankName ?? '—', " \u00B7 ", _jsx("bdi", { dir: "ltr", children: d.iban.replace(/(.{4})/g, '$1 ').trim() })] })) : (t('staffPayroll.drawer.noIban')) })] }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 0.5 }, children: t('staffPayroll.drawer.adjustments') }), d.adjustments.length === 0 && _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('staffPayroll.drawer.noAdjustments') }), d.adjustments.map((a) => (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, py: 0.5, borderBottom: '1px solid #EEF2F7', fontSize: 13 }, children: [_jsxs(Box, { sx: { flex: 1 }, children: [t(`staffPayroll.adjustment.${a.kind}`), " \u00B7 ", a.reason, _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: a.createdByName })] }), _jsxs("b", { style: { fontVariantNumeric: 'tabular-nums', color: a.kind === 'Deduction' ? '#B45309' : hr.success }, children: [a.kind === 'Deduction' ? '−' : '+', money(a.amount)] }), run.canEdit && (_jsx(IconButton, { size: "small", "aria-label": t('staffPayroll.adjustment.remove'), disabled: busy, onClick: () => void remove(a.id), children: _jsx(DeleteOutlineIcon, { fontSize: "small" }) }))] }, a.id))), run.canEdit &&
                                (adding ? (_jsxs(Box, { sx: { display: 'grid', gap: 1, mt: 1 }, children: [_jsx(TextField, { size: "small", type: "number", label: t(`staffPayroll.adjustment.${adding}`), value: amount, onChange: (e) => setAmount(e.target.value), slotProps: { htmlInput: { min: 1, step: '0.01', dir: 'ltr' }, input: { endAdornment: _jsx(InputAdornment, { position: "end", children: t('hr.sar') }) } } }), _jsx(TextField, { size: "small", required: true, label: t('staffPayroll.adjustment.reason'), value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), _jsxs(Stack, { direction: "row", sx: { gap: 1 }, children: [_jsx(Button, { variant: "contained", size: "small", disabled: busy || !(Number(amount) > 0) || !reason.trim(), onClick: () => void save(), children: t('common.save') }), _jsx(Button, { size: "small", disabled: busy, onClick: () => setAdding(null), children: t('common.cancel') })] })] })) : (_jsxs(Stack, { direction: "row", sx: { gap: 1, mt: 1 }, children: [_jsx(Button, { size: "small", variant: "outlined", onClick: () => setAdding('Addition'), children: t('staffPayroll.adjustment.addAddition') }), _jsx(Button, { size: "small", variant: "outlined", onClick: () => setAdding('Deduction'), children: t('staffPayroll.adjustment.addDeduction') })] }))), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted, mt: 0.75 }, children: t('staffPayroll.adjustment.hint') })] })] }))] }));
}
/** The run's elements and its net by department. */
function SummaryTab({ run }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const x = run.totals;
    const items = [
        [t('staffPayroll.summary.basic'), x.basic],
        [t('staffPayroll.summary.housing'), x.housing],
        [t('staffPayroll.summary.other'), x.otherAllowances],
        [t('staffPayroll.summary.overtime'), x.overtime],
        [t('staffPayroll.summary.additions'), x.additions],
    ];
    const cuts = [
        [t('staffPayroll.summary.absence'), x.absence],
        [t('staffPayroll.summary.penalties'), x.penalties],
        [t('staffPayroll.summary.advances'), x.advances],
        [t('staffPayroll.summary.otherDeductions'), x.otherDeductions],
        [t('staffPayroll.summary.gosi'), x.gosiEmployee],
    ];
    const gross = items.reduce((s, [, v]) => s + v, 0) || 1;
    const maxDept = Math.max(...run.departments.map((d) => d.net), 1);
    return (_jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }, children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 1 }, children: t('staffPayroll.summary.elements') }), items.map(([label, value]) => (_jsxs(Box, { sx: { mb: 1.1 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', fontSize: 13 }, children: [_jsx("span", { children: label }), _jsx("b", { style: { fontVariantNumeric: 'tabular-nums' }, children: money(value) })] }), _jsx(Box, { sx: { height: 6, borderRadius: 99, bgcolor: '#EEF2F7', mt: 0.5, overflow: 'hidden' }, children: _jsx(Box, { sx: { height: '100%', width: `${Math.max(0, (value / gross) * 100)}%`, bgcolor: hr.primary } }) })] }, label))), cuts.map(([label, value]) => (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', fontSize: 13, py: 0.5, borderTop: '1px solid #EEF2F7' }, children: [_jsx("span", { children: label }), _jsxs("b", { style: { color: '#B45309', fontVariantNumeric: 'tabular-nums' }, children: ["\u2212", money(value)] })] }, label))), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', mt: 0.75, fontSize: 15, fontWeight: 700, borderTop: `1px solid ${hr.border}`, pt: 1 }, children: [_jsx("span", { children: t('staffPayroll.summary.net') }), _jsx("span", { style: { color: hr.success, fontVariantNumeric: 'tabular-nums' }, children: money(x.net) })] }), x.deferred > 0 && _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 0.5 }, children: t('staffPayroll.summary.deferred', { amount: money(x.deferred) }) })] }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 1 }, children: t('staffPayroll.summary.byDepartment') }), run.departments.map((d) => (_jsxs(Box, { sx: { mb: 1.1 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', fontSize: 13, gap: 1 }, children: [_jsxs("span", { children: [(ar ? d.nameAr : d.nameEn) ?? t('staffPayroll.summary.noDepartment'), " ", _jsxs(Box, { component: "span", sx: { color: hr.textMuted }, children: ["\u00B7 ", t('staffPayroll.summary.employees', { count: d.employees })] })] }), _jsx("b", { style: { fontVariantNumeric: 'tabular-nums' }, children: money(d.net) })] }), _jsx(Box, { sx: { height: 6, borderRadius: 99, bgcolor: '#EEF2F7', mt: 0.5, overflow: 'hidden' }, children: _jsx(Box, { sx: { height: '100%', width: `${(d.net / maxDept) * 100}%`, bgcolor: hr.primary } }) })] }, d.departmentId ?? 'none')))] })] }));
}
/** GOSI by category: the wage it is on, the employees' share (deducted) and the company's (a cost outside the net). */
function GosiTab({ run }) {
    const { t } = useTranslation();
    return (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted, mb: 1.25 }, children: t('staffPayroll.gosi.hint') }), _jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& th': { bgcolor: hr.muted, color: '#475569', fontWeight: 600 }, '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('staffPayroll.gosi.category') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.cols.employees') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.gosi.base') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.gosi.employee') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.gosi.employer') })] }) }), _jsx(TableBody, { children: run.gosi.map((g) => (_jsxs(TableRow, { children: [_jsx(TableCell, { sx: { fontWeight: 600 }, children: t(`staffPayroll.gosiCategory.${g.category}`) }), _jsx(TableCell, { align: "right", children: g.employees }), _jsx(TableCell, { align: "right", children: money(g.base) }), _jsx(TableCell, { align: "right", children: money(g.employee) }), _jsx(TableCell, { align: "right", children: money(g.employer) })] }, g.category))) }), _jsx(TableFooter, { children: _jsxs(TableRow, { sx: { '& td': { fontWeight: 700, color: hr.text } }, children: [_jsx(TableCell, { children: t('staffPayroll.gosi.total') }), _jsx(TableCell, { align: "right", children: run.gosi.reduce((s, g) => s + g.employees, 0) }), _jsx(TableCell, { align: "right", children: money(run.gosi.reduce((s, g) => s + g.base, 0)) }), _jsx(TableCell, { align: "right", children: money(run.totals.gosiEmployee) }), _jsx(TableCell, { align: "right", children: money(run.totals.gosiEmployer) })] }) })] }) })] }));
}
/** What the month's cap left for the next payroll month. */
function DeferredTab({ list }) {
    const { t } = useTranslation();
    if (!list)
        return _jsx(LinearProgress, {});
    if (list.length === 0)
        return _jsx(HrEmptyState, { icon: _jsx(CheckCircleOutlineIcon, {}), title: t('staffPayroll.deferredEmpty') });
    return (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted, mb: 1.25 }, children: t('staffPayroll.deferredHint') }), _jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 560 }, children: _jsxs(Table, { stickyHeader: true, size: "small", sx: { '& th': { bgcolor: hr.muted, color: '#475569', fontWeight: 600 }, '& td': { height: 42, fontVariantNumeric: 'tabular-nums' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('staffPayroll.cols.employee') }), _jsx(TableCell, { children: t('staffPayroll.deferredCols.kind') }), _jsx(TableCell, { children: t('staffPayroll.deferredCols.reference') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.deferredCols.due') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.deferredCols.deducted') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.deferredCols.deferred') })] }) }), _jsx(TableBody, { children: list.map((d) => (_jsxs(TableRow, { hover: true, children: [_jsxs(TableCell, { children: [_jsx("b", { children: d.name }), " \u00B7 ", _jsx("bdi", { children: d.employeeNo })] }), _jsx(TableCell, { children: t(`staffPayroll.items.${d.kind}`) }), _jsx(TableCell, { children: _jsx("bdi", { children: d.reference }) }), _jsx(TableCell, { align: "right", children: money(d.due) }), _jsx(TableCell, { align: "right", children: money(d.deducted) }), _jsx(TableCell, { align: "right", sx: { fontWeight: 700, color: '#B45309' }, children: money(d.deferred) })] }, `${d.lineId}-${d.reference}`))) })] }) })] }));
}
