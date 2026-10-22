import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import Add from '@mui/icons-material/Add';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CheckIcon from '@mui/icons-material/Check';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Pagination, Skeleton, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { periodOf, shiftPeriod } from '../../../api/attendance';
import { errorKey } from '../../../api/auth';
import { gosiApi, gosiTaskKinds } from '../../../api/gosi';
import { useSession } from '../../../app/session';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrAccents, hrCard } from '../../../components/hr/Hr';
import { useMonthName as usePeriodName } from '../../attendance/AttendanceMonthPage';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { money } from '../payroll';
import { useLegalEntities } from '../RunDialogs';
import { DateField } from '../../../components/DateField';
const taskLook = {
    WageUpdate: { color: '#B45309', tint: '#FEF3C7' },
    Register: { color: '#1D4ED8', tint: '#DBEAFE' },
    Exclude: { color: '#475569', tint: '#E2E8F0' },
};
const today = () => new Date().toISOString().slice(0, 10);
/**
 * GOSI (docs/03-migration-plan/12, 4.9): a registration's monthly statement from its approved runs (staff and
 * workers) with GOSI's invoice reconciled against it, the tasks HR does on GOSI's portal, and Saudization.
 */
export function GosiPage() {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { can } = useSession();
    const periodName = usePeriodName();
    const entities = useLegalEntities();
    const [entity, setEntity] = useState('');
    const [period, setPeriod] = useState(() => shiftPeriod(periodOf(new Date()), -1));
    const [view, setView] = useState('statement');
    const [openTasks, setOpenTasks] = useState(null);
    const [invoicing, setInvoicing] = useState(false);
    const [settings, setSettings] = useState(false);
    const [version, setVersion] = useState(0);
    useEffect(() => {
        if (!entity && entities[0])
            setEntity(entities[0].id);
    }, [entities, entity]);
    useEffect(() => {
        gosiApi
            .tasks('open')
            .then((list) => setOpenTasks(list.length))
            .catch(() => setOpenTasks(null));
    }, [version]);
    const refresh = () => setVersion((v) => v + 1);
    const flip = { transform: (theme) => (theme.direction === 'rtl' ? 'none' : 'scaleX(-1)') };
    if (!can('payroll.gosi.view', true)) {
        return (_jsx(HrScope, { children: _jsx(HrEmptyState, { icon: _jsx(ShieldOutlinedIcon, {}), title: t('gosi.noAccess') }) }));
    }
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(ShieldOutlinedIcon, {}), title: t('gosi.title'), subtitle: t('gosi.intro'), period: _jsxs(Stack, { direction: "row", sx: { gap: 1, alignItems: 'center' }, children: [_jsx(TextField, { select: true, size: "small", value: entity, onChange: (e) => setEntity(e.target.value), sx: { minWidth: 170 }, slotProps: { htmlInput: { 'aria-label': t('gosi.legalEntity') } }, children: entities.map((e) => (_jsx(MenuItem, { value: e.id, children: ar ? e.nameAr : e.nameEn }, e.id))) }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', border: `1px solid ${hr.border}`, borderRadius: '8px', bgcolor: '#fff', height: 36 }, children: [_jsx(IconButton, { size: "small", "aria-label": periodName(shiftPeriod(period, -1)), onClick: () => setPeriod((p) => shiftPeriod(p, -1)), children: _jsx(ChevronRightIcon, { fontSize: "small", sx: flip }) }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, px: 1, whiteSpace: 'nowrap' }, children: periodName(period) }), _jsx(IconButton, { size: "small", "aria-label": periodName(shiftPeriod(period, 1)), disabled: period >= periodOf(new Date()), onClick: () => setPeriod((p) => shiftPeriod(p, 1)), children: _jsx(ChevronLeftIcon, { fontSize: "small", sx: flip }) })] })] }), actions: _jsxs(_Fragment, { children: [can('payroll.settings.manage', true) && (_jsx(Button, { variant: "outlined", startIcon: _jsx(SettingsOutlinedIcon, {}), onClick: () => setSettings(true), children: t('gosi.settings.title') })), can('payroll.gosi.invoice', true) && (_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), disabled: !entity, onClick: () => setInvoicing(true), children: t('gosi.invoice.record') }))] }) }), _jsxs(Box, { sx: { ...hrCard, px: 2, pb: 2 }, children: [_jsxs(Tabs, { value: view, onChange: (_, v) => setView(v), sx: { borderBottom: `1px solid ${hr.border}`, mb: 1.5 }, children: [_jsx(Tab, { value: "statement", label: t('gosi.tabs.statement') }), _jsx(Tab, { value: "tasks", label: openTasks === null ? t('gosi.tabs.tasks') : t('gosi.tabs.tasksCount', { count: openTasks }) }), _jsx(Tab, { value: "saudization", label: t('gosi.tabs.saudization') })] }), view === 'statement' && entity && _jsx(StatementTab, { entity: entity, period: period, onInvoice: () => setInvoicing(true) }, `${entity}-${period}-${version}`), view === 'tasks' && _jsx(TasksTab, { onChanged: refresh }, version), view === 'saudization' && _jsx(SaudizationTab, {}, version)] }), invoicing && entity && (_jsx(InvoiceDialog, { entity: entity, entityName: (ar ? entities.find((e) => e.id === entity)?.nameAr : entities.find((e) => e.id === entity)?.nameEn) ?? '', period: period, onClose: () => setInvoicing(false), onSaved: () => (setInvoicing(false), refresh()) })), settings && _jsx(SaudizationSettingsDialog, { onClose: () => setSettings(false), onSaved: () => (setSettings(false), refresh()) })] }));
}
/** A statement figure: tinted card, round icon, the value in riyals and two parts under it (no trend: none is known). */
function GosiKpi({ label, value, icon, accent, parts, loading }) {
    const { t } = useTranslation();
    const a = hrAccents[accent];
    return (_jsxs(Box, { sx: { ...hrCard, bgcolor: a.tint, p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }, children: [_jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600, color: '#334155' }, children: label }), loading ? (_jsx(Skeleton, { width: 120, height: 36 })) : (_jsxs(Typography, { sx: { fontSize: 24, fontWeight: 700, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }, children: [value === null ? '—' : money(value), " ", _jsx(Box, { component: "span", sx: { fontSize: 12, fontWeight: 500, color: hr.textMuted }, children: t('hr.sar') })] }))] }), _jsx(Box, { sx: { flex: '0 0 auto', width: 38, height: 38, borderRadius: '50%', bgcolor: '#fff', color: a.main, display: 'grid', placeItems: 'center', '& svg': { fontSize: 19 } }, children: icon })] }), _jsx(Stack, { direction: "row", sx: { justifyContent: 'space-between', borderTop: '1px dashed rgba(15,39,71,.12)', pt: 0.75, fontSize: 11.5, color: hr.textMuted }, children: parts.map((p, i) => (_jsxs("span", { style: { textAlign: i === 0 ? 'start' : 'end' }, children: [p.label, _jsx(Box, { component: "b", sx: { display: 'block', color: p.color ?? hr.text, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }, children: loading ? '…' : p.value })] }, p.label))) })] }));
}
/** The registration's month: the figures, the members from the approved runs (paged on the server) and the invoice. */
function StatementTab({ entity, period, onInvoice }) {
    const { t } = useTranslation();
    const { can } = useSession();
    const [search, setSearch] = useState('');
    const [kind, setKind] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [typed, setTyped] = useState('');
    useEffect(() => {
        const h = setTimeout(() => (setSearch(typed.trim()), setPage(1)), 350);
        return () => clearTimeout(h);
    }, [typed]);
    const load = useCallback(() => {
        setError(null);
        gosiApi
            .statement({ legalEntityId: entity, period, search, kind, page, pageSize })
            .then(setData)
            .catch((f) => setError(errorKey(f)));
    }, [entity, period, search, kind, page, pageSize]);
    useEffect(load, [load]);
    if (error) {
        return (_jsxs(Stack, { sx: { gap: 1, alignItems: 'flex-start' }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Button, { size: "small", variant: "outlined", onClick: load, children: t('gosi.retry') })] }));
    }
    const d = data;
    const loading = !d;
    const n = (v) => v.toLocaleString('en-US');
    const flagLook = { not_registered: { color: '#B45309', tint: '#FEF3C7' }, wage_update: { color: '#B45309', tint: '#FEF3C7' } };
    const diffColor = d?.difference ? hr.warning : hr.success;
    return (_jsxs(Stack, { sx: { gap: 1.5 }, children: [_jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' } }, children: [_jsxs(Box, { sx: { ...hrCard, bgcolor: hrAccents.violet.tint, p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between' }, children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600, color: '#334155' }, children: t('gosi.kpi.members') }), loading ? _jsx(Skeleton, { width: 90, height: 36 }) : _jsx(Typography, { sx: { fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }, children: n(d.members) })] }), _jsx(Box, { sx: { width: 38, height: 38, borderRadius: '50%', bgcolor: '#fff', color: hrAccents.violet.main, display: 'grid', placeItems: 'center' }, children: _jsx(GroupsOutlinedIcon, { sx: { fontSize: 19 } }) })] }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', borderTop: '1px dashed rgba(15,39,71,.12)', pt: 0.75, fontSize: 11.5, color: hr.textMuted }, children: [_jsxs("span", { children: [t('gosi.kpi.staff'), _jsx(Box, { component: "b", sx: { display: 'block', color: hr.text, fontSize: 12.5 }, children: loading ? '…' : n(d.staff) })] }), _jsxs("span", { style: { textAlign: 'end' }, children: [t('gosi.kpi.workers'), _jsx(Box, { component: "b", sx: { display: 'block', color: hr.text, fontSize: 12.5 }, children: loading ? '…' : n(d.workers) })] })] })] }), _jsx(GosiKpi, { label: t('gosi.kpi.base'), value: d?.base ?? null, icon: _jsx(AttachMoneyIcon, {}), accent: "blue", loading: loading, parts: [
                            { label: t('gosi.kpi.saudi'), value: d ? money(d.saudiBase) : '' },
                            { label: t('gosi.kpi.nonSaudi'), value: d ? money(d.nonSaudiBase) : '' },
                        ] }), _jsx(GosiKpi, { label: t('gosi.kpi.employee'), value: d?.employee ?? null, icon: _jsx(RemoveIcon, {}), accent: "amber", loading: loading, parts: [{ label: t('gosi.kpi.employeeHint'), value: '' }] }), _jsx(GosiKpi, { label: t('gosi.kpi.employer'), value: d?.employer ?? null, icon: _jsx(ApartmentOutlinedIcon, {}), accent: "green", loading: loading, parts: [{ label: t('gosi.kpi.hazards'), value: d ? money(d.hazards) : '' }] }), _jsx(GosiKpi, { label: t('gosi.kpi.due'), value: d?.due ?? null, icon: _jsx(DragHandleIcon, {}), accent: "rose", loading: loading, parts: [
                            { label: t('gosi.kpi.invoice'), value: d?.invoice == null ? '—' : money(d.invoice) },
                            { label: t('gosi.kpi.difference'), value: d?.difference == null ? '—' : _jsx("bdi", { children: money(d.difference) }), color: d?.difference == null ? undefined : diffColor },
                        ] })] }), d && d.openRuns > 0 && (_jsx(Alert, { severity: "warning", sx: { py: 0 }, children: t('gosi.openRuns', { count: d.openRuns }) })), d && d.approvedRuns === 0 && d.openRuns === 0 && (_jsx(Alert, { severity: "info", sx: { py: 0 }, children: t('gosi.noRuns') })), _jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' }, alignItems: 'start' }, children: [_jsxs(Box, { sx: { minWidth: 0 }, children: [_jsxs(Stack, { direction: "row", sx: { gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }, children: [_jsx(TextField, { size: "small", value: typed, onChange: (e) => setTyped(e.target.value), placeholder: t('gosi.search'), sx: { width: 260 }, slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) }, htmlInput: { 'aria-label': t('gosi.search') } } }), _jsxs(TextField, { select: true, size: "small", value: kind, onChange: (e) => (setKind(e.target.value), setPage(1)), sx: { width: 190 }, slotProps: { select: { displayEmpty: true }, htmlInput: { 'aria-label': t('gosi.kind.label') } }, children: [_jsx(MenuItem, { value: "", children: t('gosi.kind.all') }), _jsx(MenuItem, { value: "Staff", children: t('gosi.kind.Staff') }), _jsx(MenuItem, { value: "Worker", children: t('gosi.kind.Worker') }), _jsx(MenuItem, { value: "flags", children: t('gosi.kind.flags') })] })] }), !d ? (_jsx(Stack, { sx: { gap: 0.75 }, children: Array.from({ length: 6 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: 40 }, i)) })) : d.members === 0 ? (_jsx(HrEmptyState, { icon: _jsx(ShieldOutlinedIcon, {}), title: t('gosi.empty'), hint: t('gosi.emptyHint') })) : d.items.length === 0 ? (_jsx(HrEmptyState, { icon: _jsx(SearchIcon, {}), title: t('gosi.noResults') })) : (_jsxs(_Fragment, { children: [_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 620 }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: {
                                                '& td': { height: 42, fontVariantNumeric: 'tabular-nums', fontSize: 12.5 },
                                                '& th': { fontSize: 11.5 },
                                                '& thead tr:nth-of-type(2) th': { top: 30 },
                                                '& th.grp': { textAlign: 'center' },
                                                '& th.g-emp': { bgcolor: '#FDF1DC', color: '#B45309' },
                                                '& th.g-co': { bgcolor: '#E3F6EC', color: '#047857' },
                                                '& td.g-emp': { backgroundImage: 'linear-gradient(rgba(217,119,6,.05), rgba(217,119,6,.05))' },
                                                '& td.g-co': { backgroundImage: 'linear-gradient(rgba(5,150,105,.045), rgba(5,150,105,.045))' },
                                                '& .gs': { borderInlineStart: `2px solid ${hr.border}` },
                                                '& tfoot td': { position: 'sticky', bottom: 0, bgcolor: '#F8FAFC', fontWeight: 700, color: hr.text, borderTop: `1px solid ${hr.border}` },
                                            }, children: [_jsxs(TableHead, { children: [_jsxs(TableRow, { children: [_jsx(TableCell, { rowSpan: 2, children: t('gosi.cols.member') }), _jsx(TableCell, { rowSpan: 2, children: t('gosi.cols.kind') }), _jsx(TableCell, { rowSpan: 2, children: t('gosi.cols.category') }), _jsx(TableCell, { rowSpan: 2, align: "right", children: t('gosi.cols.base') }), _jsx(TableCell, { rowSpan: 2, children: t('gosi.cols.flag') }), _jsx(TableCell, { className: "grp g-emp gs", children: t('gosi.cols.employee') }), _jsx(TableCell, { className: "grp g-co gs", children: t('gosi.cols.employer') })] }), _jsxs(TableRow, { children: [_jsx(TableCell, { align: "right", className: "g-emp gs", children: t('gosi.cols.amount') }), _jsx(TableCell, { align: "right", className: "g-co gs", children: t('gosi.cols.amount') })] })] }), _jsx(TableBody, { children: d.items.map((l) => (_jsxs(TableRow, { hover: true, children: [_jsx(TableCell, { children: _jsxs(Stack, { direction: "row", sx: { gap: 1, alignItems: 'center' }, children: [_jsx(HrAvatar, { name: l.name, size: 26 }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }, children: l.name }), _jsx(Typography, { sx: { fontSize: 11, color: hr.textMuted }, children: _jsx("bdi", { children: l.no }) })] })] }) }), _jsx(TableCell, { children: t(`gosi.kind.${l.kind}`) }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: l.category ? t(`staffPayroll.gosiCategory.${l.category}`) : '—' }), _jsx(TableCell, { align: "right", children: money(l.base) }), _jsx(TableCell, { children: l.flag ? _jsx(HrStatusBadge, { label: t(`gosi.flags.${l.flag}`), ...flagLook[l.flag] }) : _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: t('gosi.flags.ok') }) }), _jsx(TableCell, { align: "right", className: "g-emp gs", children: money(l.employee) }), _jsx(TableCell, { align: "right", className: "g-co gs", children: money(l.employer) })] }, `${l.kind}-${l.personId}`))) }), _jsx(TableFooter, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { colSpan: 3, children: t('gosi.totalAll', { count: d.members }) }), _jsx(TableCell, { align: "right", children: money(d.base) }), _jsx(TableCell, {}), _jsx(TableCell, { align: "right", className: "gs", children: money(d.employee) }), _jsx(TableCell, { align: "right", className: "gs", children: money(d.employer) })] }) })] }) }), _jsxs(Stack, { direction: "row", sx: { mt: 1, gap: 1, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: t('gosi.shown', { from: (d.page - 1) * d.pageSize + 1, to: Math.min(d.total, d.page * d.pageSize), total: d.total }) }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Pagination, { count: Math.max(1, Math.ceil(d.total / d.pageSize)), page: d.page, onChange: (_, p) => setPage(p), shape: "rounded", color: "primary", size: "small" }), _jsx(TextField, { select: true, size: "small", value: pageSize, onChange: (e) => (setPageSize(Number(e.target.value)), setPage(1)), sx: { width: 150 }, slotProps: { htmlInput: { 'aria-label': t('staffPayroll.perPage', { count: pageSize }) } }, children: [10, 25, 50, 100].map((v) => (_jsx(MenuItem, { value: v, children: t('staffPayroll.perPage', { count: v }) }, v))) })] })] }))] }), _jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 1 }, children: t('gosi.invoice.title') }), [
                                [t('gosi.invoice.due'), d ? money(d.due) : '…', undefined],
                                [t('gosi.invoice.amount'), d?.invoice == null ? '—' : money(d.invoice), undefined],
                                [t('gosi.invoice.difference'), d?.difference == null ? '—' : money(d.difference), d?.difference == null ? undefined : diffColor],
                            ].map(([label, value, color]) => (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', py: 0.9, borderBottom: '1px solid #EEF2F7', fontSize: 13 }, children: [_jsx("span", { children: label }), _jsx(Box, { component: "b", sx: { fontVariantNumeric: 'tabular-nums', color }, children: _jsx("bdi", { children: value }) })] }, label))), d?.invoiceNote && _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 1 }, children: d.invoiceNote }), d?.invoiceBy && _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: t('gosi.invoice.by', { name: d.invoiceBy }) }), d && d.difference != null && d.difference !== 0 && (_jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 1 }, children: t('gosi.invoice.differenceHint') })), d && d.difference === 0 && (_jsxs(Stack, { direction: "row", sx: { gap: 0.5, alignItems: 'center', mt: 1, color: hr.success, fontSize: 12.5 }, children: [_jsx(CheckIcon, { sx: { fontSize: 16 } }), t('gosi.invoice.matches')] })), d?.invoice == null && (_jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 1 }, children: t('gosi.invoice.none') })), can('payroll.gosi.invoice', true) && (_jsx(Button, { size: "small", variant: "outlined", sx: { mt: 1.5 }, startIcon: _jsx(AccountBalanceOutlinedIcon, {}), onClick: onInvoice, children: d?.invoice == null ? t('gosi.invoice.record') : t('gosi.invoice.edit') })), d && d.categories.length > 0 && (_jsxs(Box, { sx: { mt: 2 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 13, mb: 0.5 }, children: t('gosi.byCategory') }), d.categories.map((c) => (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', py: 0.6, fontSize: 12.5, borderBottom: '1px solid #EEF2F7' }, children: [_jsxs("span", { children: [c.category ? t(`staffPayroll.gosiCategory.${c.category}`) : '—', " ", _jsxs(Box, { component: "span", sx: { color: hr.textMuted }, children: ["(", c.members.toLocaleString('en-US'), ")"] })] }), _jsx("b", { style: { fontVariantNumeric: 'tabular-nums' }, children: money(c.employee + c.employer) })] }, c.category)))] }))] })] })] }));
}
/** The tasks on GOSI's portal: open ones by kind, each closed with what was done there; and the done ones. */
function TasksTab({ onChanged }) {
    const { t } = useTranslation();
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const [status, setStatus] = useState('open');
    const [kind, setKind] = useState('');
    const [tasks, setTasks] = useState(null);
    const [error, setError] = useState(null);
    const [closing, setClosing] = useState(null);
    const load = useCallback(() => {
        setTasks(null);
        setError(null);
        gosiApi
            .tasks(status)
            .then(setTasks)
            .catch((f) => setError(errorKey(f)));
    }, [status]);
    useEffect(load, [load]);
    const shown = tasks?.filter((x) => !kind || x.kind === kind) ?? [];
    const count = (k) => tasks?.filter((x) => x.kind === k).length ?? 0;
    return (_jsxs(Stack, { sx: { gap: 1.25 }, children: [_jsxs(Stack, { direction: "row", sx: { gap: 1, flexWrap: 'wrap', alignItems: 'center' }, children: [_jsxs(ToggleButtonGroup, { size: "small", exclusive: true, value: status, onChange: (_, v) => v && setStatus(v), children: [_jsx(ToggleButton, { value: "open", children: t('gosi.tasks.open') }), _jsx(ToggleButton, { value: "done", children: t('gosi.tasks.done') })] }), _jsx(Box, { sx: { width: 8 } }), gosiTaskKinds.map((k) => (_jsx(Chip, { size: "small", label: `${t(`gosi.taskKind.${k}`)} (${count(k)})`, onClick: () => setKind((c) => (c === k ? '' : k)), variant: kind === k ? 'filled' : 'outlined', sx: { fontWeight: 600, color: taskLook[k].color, bgcolor: kind === k ? taskLook[k].tint : undefined, borderColor: taskLook[k].tint } }, k)))] }), error ? (_jsxs(Stack, { sx: { gap: 1, alignItems: 'flex-start' }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Button, { size: "small", variant: "outlined", onClick: load, children: t('gosi.retry') })] })) : !tasks ? (_jsx(Stack, { sx: { gap: 0.75 }, children: Array.from({ length: 4 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: 42 }, i)) })) : shown.length === 0 ? (_jsx(HrEmptyState, { icon: _jsx(CheckIcon, {}), title: status === 'open' ? t('gosi.tasks.none') : t('gosi.tasks.noneDone'), hint: status === 'open' ? t('gosi.tasks.noneHint') : undefined })) : (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 44, fontVariantNumeric: 'tabular-nums', fontSize: 12.5 } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('gosi.tasks.kind') }), _jsx(TableCell, { children: t('gosi.tasks.employee') }), _jsx(TableCell, { align: "right", children: t('gosi.tasks.oldWage') }), _jsx(TableCell, { align: "right", children: t('gosi.tasks.newWage') }), _jsx(TableCell, { children: t('gosi.tasks.eventOn') }), status === 'done' ? (_jsxs(_Fragment, { children: [_jsx(TableCell, { children: t('gosi.tasks.doneOn') }), _jsx(TableCell, { children: t('gosi.tasks.reference') })] })) : (_jsx(TableCell, { children: t('gosi.tasks.action') }))] }) }), _jsx(TableBody, { children: shown.map((x) => (_jsxs(TableRow, { hover: true, children: [_jsx(TableCell, { children: _jsx(HrStatusBadge, { label: t(`gosi.taskKind.${x.kind}`), ...taskLook[x.kind] }) }), _jsxs(TableCell, { children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600 }, children: x.name }), _jsx(Typography, { sx: { fontSize: 11, color: hr.textMuted }, children: _jsx("bdi", { children: x.employeeNo }) })] }), _jsx(TableCell, { align: "right", children: x.oldWage == null ? '—' : money(x.oldWage) }), _jsx(TableCell, { align: "right", children: x.newWage == null ? '—' : money(x.newWage) }), _jsx(TableCell, { children: x.eventOn ? _jsx("bdi", { children: date(x.eventOn) }) : '—' }), status === 'done' ? (_jsxs(_Fragment, { children: [_jsxs(TableCell, { children: [x.doneOn ? _jsx("bdi", { children: date(x.doneOn) }) : '—', x.doneByName && _jsx(Typography, { sx: { fontSize: 11, color: hr.textMuted }, children: x.doneByName })] }), _jsx(TableCell, { children: x.reference ?? '—' })] })) : (_jsx(TableCell, { children: can('payroll.gosi.manage', true) ? (_jsx(Button, { size: "small", variant: "outlined", startIcon: _jsx(CheckIcon, {}), onClick: () => setClosing(x), children: t(`gosi.close.action.${x.kind}`) })) : (_jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: t('gosi.tasks.readOnly') })) }))] }, x.id))) })] }) })), closing && _jsx(CloseTaskDialog, { task: closing, onClose: () => setClosing(null), onDone: () => (setClosing(null), load(), onChanged()) })] }));
}
/** Closing a task with what was done on GOSI's portal. */
function CloseTaskDialog({ task, onClose, onDone }) {
    const { t } = useTranslation();
    const [doneOn, setDoneOn] = useState(today());
    const [wage, setWage] = useState(task.newWage == null ? '' : String(task.newWage));
    const [gosiNo, setGosiNo] = useState('');
    const [since, setSince] = useState(task.eventOn ?? '');
    const [reference, setReference] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const register = task.kind === 'Register';
    const exclude = task.kind === 'Exclude';
    const valid = Boolean(doneOn) && (exclude || Number(wage) > 0) && (!register || gosiNo.trim().length > 0);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await gosiApi.closeTask(task.id, {
                doneOn,
                wage: exclude ? null : Number(wage),
                gosiNo: register ? gosiNo.trim() : null,
                since: register && since ? since : null,
                reference: reference.trim() || null,
            });
            onDone();
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "sm", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t(`gosi.close.title.${task.kind}`, { name: task.name }) }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }, children: [!exclude && (_jsx(TextField, { size: "small", required: true, type: "number", label: t('gosi.close.wage'), value: wage, onChange: (e) => setWage(e.target.value), slotProps: { input: { endAdornment: _jsx(InputAdornment, { position: "end", children: t('hr.sar') }) } } })), _jsx(DateField, { size: "small", required: true, label: t(`gosi.close.doneOn.${task.kind}`), value: doneOn, onChange: (e) => setDoneOn(e.target.value), slotProps: { inputLabel: { shrink: true } } }), register && (_jsxs(_Fragment, { children: [_jsx(TextField, { size: "small", required: true, label: t('gosi.close.gosiNo'), value: gosiNo, onChange: (e) => setGosiNo(e.target.value), slotProps: { htmlInput: { dir: 'ltr', maxLength: 30 } } }), _jsx(DateField, { size: "small", label: t('gosi.close.since'), value: since, onChange: (e) => setSince(e.target.value), slotProps: { inputLabel: { shrink: true } } })] }))] }), _jsx(TextField, { size: "small", label: t('gosi.close.reference'), value: reference, onChange: (e) => setReference(e.target.value), slotProps: { htmlInput: { maxLength: 100 } } }), _jsx(Alert, { severity: "info", sx: { py: 0 }, children: t(`gosi.close.hint.${task.kind}`) }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !valid, onClick: () => void save(), children: t('common.save') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
/** GOSI's invoice for the registration's month, entered by finance; the statement shows the difference. */
function InvoiceDialog({ entity, entityName, period, onClose, onSaved }) {
    const { t } = useTranslation();
    const periodName = usePeriodName();
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        gosiApi
            .statement({ legalEntityId: entity, period, page: 1, pageSize: 1 })
            .then((s) => (s.invoice != null && setAmount(String(s.invoice)), s.invoiceNote && setNote(s.invoiceNote)))
            .catch(() => undefined);
    }, [entity, period]);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await gosiApi.saveInvoice({ legalEntityId: entity, period, amount: Number(amount), note: note.trim() || null });
            onSaved();
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('gosi.invoice.dialog', { entity: entityName, month: periodName(period) }) }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(TextField, { size: "small", required: true, type: "number", label: t('gosi.invoice.amount'), value: amount, onChange: (e) => setAmount(e.target.value), slotProps: { input: { endAdornment: _jsx(InputAdornment, { position: "end", children: t('hr.sar') }) } } }), _jsx(TextField, { size: "small", label: t('gosi.invoice.note'), value: note, onChange: (e) => setNote(e.target.value), slotProps: { htmlInput: { maxLength: 300 } } }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !(Number(amount) >= 0) || amount === '', onClick: () => void save(), children: t('common.save') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
/** Saudization by registration: the counted share against the required one. */
function SaudizationTab() {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [rows, setRows] = useState(null);
    const [fullWage, setFullWage] = useState(null);
    const [error, setError] = useState(null);
    const load = useCallback(() => {
        setError(null);
        Promise.all([gosiApi.saudization(), gosiApi.saudizationSettings()])
            .then(([r, s]) => (setRows(r), setFullWage(s.fullWage)))
            .catch((f) => setError(errorKey(f)));
    }, []);
    useEffect(load, [load]);
    if (error) {
        return (_jsxs(Stack, { sx: { gap: 1, alignItems: 'flex-start' }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Button, { size: "small", variant: "outlined", onClick: load, children: t('gosi.retry') })] }));
    }
    if (!rows) {
        return (_jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }, children: [_jsx(Skeleton, { variant: "rounded", height: 260 }), _jsx(Skeleton, { variant: "rounded", height: 260 })] }));
    }
    if (rows.length === 0)
        return _jsx(HrEmptyState, { icon: _jsx(GroupsOutlinedIcon, {}), title: t('gosi.saudization.none') });
    const below = rows.filter((r) => r.below);
    const wage = money(fullWage ?? 4000);
    return (_jsxs(Stack, { sx: { gap: 1.5 }, children: [_jsx(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }, children: rows.map((r) => {
                    const color = r.requiredPercent == null ? hr.primary : r.below ? hr.danger : hr.success;
                    const share = Math.max(0, Math.min(100, r.percent));
                    const line = (label, value) => (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', py: 0.9, borderBottom: '1px solid #EEF2F7', fontSize: 13 }, children: [_jsx("span", { style: { color: hr.textMuted }, children: label }), _jsx("b", { style: { fontVariantNumeric: 'tabular-nums' }, children: value })] }, label));
                    return (_jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'center', mb: 1 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 16 }, children: ar ? r.nameAr : r.nameEn }), r.requiredPercent == null ? (_jsx(HrStatusBadge, { label: t('gosi.saudization.noTarget'), color: "#475569", tint: "#E2E8F0" })) : r.below ? (_jsx(HrStatusBadge, { label: t('gosi.saudization.below'), color: hr.danger, tint: "#FEE2E2" })) : (_jsx(HrStatusBadge, { label: t('gosi.saudization.meets'), color: hr.success, tint: "#D1FAE5" }))] }), _jsxs(Stack, { direction: "row", sx: { gap: 2, alignItems: 'center', mb: 1 }, children: [_jsx(Box, { role: "img", "aria-label": `${r.percent}%`, sx: { flex: '0 0 auto', width: 108, height: 108, borderRadius: '50%', background: `conic-gradient(${color} 0 ${share}%, #E2E8F0 ${share}% 100%)`, display: 'grid', placeItems: 'center' }, children: _jsx(Box, { sx: { width: 84, height: 84, borderRadius: '50%', bgcolor: '#fff', display: 'grid', placeItems: 'center', fontSize: 19, fontWeight: 700, color }, children: _jsxs("bdi", { children: [r.percent.toFixed(1), "%"] }) }) }), _jsxs(Box, { sx: { fontSize: 13 }, children: [_jsx(Typography, { sx: { fontSize: 13 }, children: t('gosi.saudization.counted', { counted: r.counted.toLocaleString('en-US'), total: r.total.toLocaleString('en-US') }) }), _jsx(Typography, { sx: { fontSize: 13 }, children: r.requiredPercent == null ? t('gosi.saudization.requiredNone') : t('gosi.saudization.required', { percent: r.requiredPercent.toFixed(1) }) })] })] }), line(t('gosi.saudization.staffSaudis'), r.halfCounted > 0 ? t('gosi.saudization.withHalf', { count: r.staffSaudis, half: r.halfCounted, wage }) : r.staffSaudis.toLocaleString('en-US')), line(t('gosi.saudization.workerSaudis'), r.workerSaudis.toLocaleString('en-US')), line(t('gosi.saudization.nonSaudis'), (r.total - r.saudis).toLocaleString('en-US')), r.requiredPercent != null && line(t('gosi.saudization.needed'), r.needed > 0 ? t('gosi.saudization.neededCount', { count: r.needed }) : '—')] }, r.legalEntityId));
                }) }), below.length > 0 && (_jsx(Alert, { severity: "error", sx: { py: 0 }, children: t('gosi.saudization.belowAlert', { names: below.map((r) => (ar ? r.nameAr : r.nameEn)).join('، ') }) })), _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: t('gosi.saudization.rule', { wage }) })] }));
}
/** The full wage and each registration's required share (until HR's figures from Nitaqat are confirmed). */
function SaudizationSettingsDialog({ onClose, onSaved }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [value, setValue] = useState(null);
    const [wage, setWage] = useState('');
    const [targets, setTargets] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        gosiApi
            .saudizationSettings()
            .then((s) => {
            setValue(s);
            setWage(String(s.fullWage));
            setTargets(Object.fromEntries(s.targets.map((x) => [x.legalEntityId, x.requiredPercent == null ? '' : String(x.requiredPercent)])));
        })
            .catch((f) => setError(errorKey(f)));
    }, []);
    const save = async () => {
        if (!value)
            return;
        setBusy(true);
        setError(null);
        try {
            await gosiApi.saveSaudizationSettings({
                fullWage: Number(wage),
                targets: value.targets.map((x) => ({ ...x, requiredPercent: targets[x.legalEntityId] === '' ? null : Number(targets[x.legalEntityId]) })),
            });
            onSaved();
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('gosi.settings.title') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [!value ? (_jsx(Skeleton, { variant: "rounded", height: 120 })) : (_jsxs(_Fragment, { children: [_jsx(TextField, { size: "small", required: true, type: "number", label: t('gosi.settings.fullWage'), helperText: t('gosi.settings.fullWageHint'), value: wage, onChange: (e) => setWage(e.target.value), slotProps: { input: { endAdornment: _jsx(InputAdornment, { position: "end", children: t('hr.sar') }) } } }), _jsx(Typography, { sx: { fontWeight: 700, fontSize: 13 }, children: t('gosi.settings.required') }), value.targets.map((x) => (_jsx(TextField, { size: "small", type: "number", label: (ar ? x.nameAr : x.nameEn) ?? '', value: targets[x.legalEntityId] ?? '', onChange: (e) => setTargets((c) => ({ ...c, [x.legalEntityId]: e.target.value })), slotProps: { input: { endAdornment: _jsx(InputAdornment, { position: "end", children: "%" }) }, htmlInput: { min: 0, max: 100, step: 0.1 } } }, x.legalEntityId))), _jsx(Alert, { severity: "info", sx: { py: 0 }, children: t('gosi.settings.hint') })] })), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !value || !(Number(wage) > 0), onClick: () => void save(), children: t('common.save') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
