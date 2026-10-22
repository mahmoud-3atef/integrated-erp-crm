import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MoreTimeOutlinedIcon from '@mui/icons-material/MoreTimeOutlined';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import SearchIcon from '@mui/icons-material/Search';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, MenuItem, Pagination, Skeleton, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Tabs, TextField, Typography, } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { attendanceApi, hhmm, hm, periodOf, rowStates, shiftPeriod, } from '../../api/attendance';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrAccents, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { DaysDrawer } from './DaysDrawer';
import { ImportDialog } from './ImportDialog';
import { OvertimeDialog, OvertimeList } from './Overtime';
export const monthLook = {
    Open: { color: hr.success, tint: '#D1FAE5' },
    InApproval: { color: hr.primary, tint: '#EFF6FF' },
    Closed: { color: hr.textMuted, tint: hr.muted },
};
export const stateLook = {
    Complete: { color: hr.success, tint: '#D1FAE5' },
    Exceptions: { color: hr.primary, tint: '#EFF6FF' },
    NoPunches: { color: '#B91C1C', tint: '#FEE2E2' },
    NoWorkDays: { color: hr.textMuted, tint: hr.muted },
};
export function useMonthName() {
    const { i18n } = useTranslation();
    return (period) => new Date(`${period}-01T00:00:00`).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' });
}
export const localRef = (r, ar) => (ar ? (r.nameAr ?? r.nameEn) : (r.nameEn ?? r.nameAr)) ?? '';
/** The attendance month: the header and its period, the cards, the employees (server paging and totals), the exceptions and the imported files. */
export function AttendanceMonthPage() {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const monthName = useMonthName();
    const [params, setParams] = useSearchParams();
    const period = params.get('period') ?? periodOf(new Date());
    const [entity, setEntity] = useState('');
    const [view, setView] = useState('employees');
    const [month, setMonth] = useState(null);
    const [rows, setRows] = useState(null);
    const [exceptions, setExceptions] = useState(null);
    const [imports, setImports] = useState(null);
    const [overtime, setOvertime] = useState(null);
    const [asking, setAsking] = useState(false);
    const [closing, setClosing] = useState(null);
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [department, setDepartment] = useState('');
    const [shift, setShift] = useState('');
    const [state, setState] = useState('');
    const [sort, setSort] = useState({ key: 'name', desc: false });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [importing, setImporting] = useState(false);
    const [drawer, setOpen] = useState(null);
    const [version, setVersion] = useState(0);
    const latest = useRef(0);
    const canManage = can('attendance.manage', true);
    const approval = useRecordApproval(month?.approval?.instanceId);
    const open = month?.status === 'Open';
    const editable = canManage && open;
    useEffect(() => {
        const timer = setTimeout(() => setQuery(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    useEffect(() => setPage(1), [query, department, shift, state, entity, period, pageSize, sort]);
    useEffect(() => {
        setMonth(null);
        attendanceApi
            .month(period, entity || undefined)
            .then((m) => (setMonth(m), setError(null)))
            .catch((failure) => setError(errorKey(failure)));
        attendanceApi.exceptions(period, entity || undefined).then(setExceptions).catch(() => setExceptions([]));
        attendanceApi.overtimeOf(period).then(setOvertime).catch(() => setOvertime([]));
    }, [period, entity, version]);
    useEffect(() => {
        if (view === 'imports')
            attendanceApi.imports().then(setImports).catch(() => setImports([]));
    }, [view, version]);
    const q = useMemo(() => ({ legalEntityId: entity || undefined, search: query, departmentId: department || undefined, shiftId: shift || undefined, state: state || undefined, sort: sort.key, desc: sort.desc, page, pageSize }), [entity, query, department, shift, state, sort, page, pageSize]);
    useEffect(() => {
        const ticket = ++latest.current;
        attendanceApi
            .employees(period, q)
            .then((d) => ticket === latest.current && setRows(d))
            .catch((failure) => ticket === latest.current && setError(errorKey(failure)));
    }, [period, q, version]);
    const go = (by) => setParams((p) => (p.set('period', shiftPeriod(period, by)), p), { replace: true });
    const k = month?.kpis;
    const filtered = Boolean(query || department || shift || state);
    const from = rows && rows.total > 0 ? (page - 1) * pageSize + 1 : 0;
    const to = rows ? Math.min(rows.total, page * pageSize) : 0;
    const sortable = (key, label) => (_jsx(TableSortLabel, { active: sort.key === key, direction: sort.key === key && sort.desc ? 'desc' : 'asc', onClick: () => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'name' && key !== 'no' })), children: label }));
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(AccessTimeOutlinedIcon, {}), title: t('attendance.title'), status: month && _jsx(HrStatusBadge, { label: t(`attendance.monthStatus.${month.status}`), ...monthLook[month.status] }), reference: `ATT-${period}`, subtitle: month ? (_jsxs(_Fragment, { children: [_jsx("bdi", { children: t('attendance.period', { from: date(month.from), to: date(month.to) }) }), ' · ', month.lastImport ? (_jsxs(_Fragment, { children: [t('attendance.lastImport'), " ", _jsx("bdi", { children: month.lastImport.fileName }), " \u00B7 ", date(month.lastImport.createdAt), " \u00B7 ", month.lastImport.createdByName] })) : (t('attendance.noImport'))] })) : (t('attendance.intro')), period: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', border: `1px solid ${hr.border}`, borderRadius: '8px', bgcolor: '#fff', height: 36 }, children: [_jsx(IconButton, { size: "small", "aria-label": t('attendance.prevMonth'), onClick: () => go(-1), children: ar ? _jsx(ChevronRightIcon, { fontSize: "small" }) : _jsx(ChevronLeftIcon, { fontSize: "small" }) }), _jsx(Typography, { sx: { fontWeight: 700, fontSize: 13, px: 1, minWidth: 110, textAlign: 'center' }, children: monthName(period) }), _jsx(IconButton, { size: "small", "aria-label": t('attendance.nextMonth'), onClick: () => go(1), children: ar ? _jsx(ChevronLeftIcon, { fontSize: "small" }) : _jsx(ChevronRightIcon, { fontSize: "small" }) })] }), actions: _jsxs(_Fragment, { children: [_jsxs(TextField, { select: true, size: "small", value: entity, onChange: (e) => setEntity(e.target.value), sx: { width: 210, bgcolor: '#fff' }, slotProps: { select: { displayEmpty: true }, htmlInput: { 'aria-label': t('attendance.allEntities') } }, children: [_jsx(MenuItem, { value: "", children: t('attendance.allEntities') }), (month?.legalEntities ?? []).map((e) => (_jsx(MenuItem, { value: e.id, children: localRef(e, ar) }, e.id)))] }), editable && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(UploadFileOutlinedIcon, {}), onClick: () => setImporting(true), children: t('attendance.import') }), _jsx(Button, { variant: "contained", startIcon: _jsx(LockOutlinedIcon, {}), disabled: !month?.hasData, onClick: () => setClosing('submit'), children: t('attendance.close.submit') })] })), month?.status === 'Closed' && can('attendance.month.reopen', true) && (_jsx(Button, { variant: "outlined", startIcon: _jsx(LockOpenOutlinedIcon, {}), onClick: () => setClosing('reopen'), children: t('attendance.close.reopen') }))] }) }), _jsx(ErrorMessage, { messageKey: error }), month?.approval && (_jsx(ApprovalBar, { status: month.approval, detail: approval.detail, onChanged: () => {
                    setVersion((v) => v + 1);
                    void approval.reload();
                } })), month && !open && (_jsx(Alert, { severity: "info", icon: _jsx(LockOutlinedIcon, {}), sx: { mb: 1.5 }, children: month.status === 'Closed' ? t('attendance.close.closedNote', { date: date(month.closedAt) }) : t('attendance.close.inApprovalNote', { by: month.submittedByName ?? '', date: date(month.submittedAt) }) })), month && open && month.lastComment && (_jsx(Alert, { severity: "warning", sx: { mb: 1.5 }, children: t('attendance.close.comment', { comment: month.lastComment }) })), notice && (_jsx(Alert, { severity: "success", sx: { mb: 1.5 }, onClose: () => setNotice(null), children: notice })), _jsx(Box, { sx: { display: 'grid', gap: 1.5, mb: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }, children: k ? (_jsxs(_Fragment, { children: [_jsx(Kpi, { accent: "violet", icon: _jsx(GroupsOutlinedIcon, {}), label: t('attendance.kpi.employees'), value: k.employees, unit: t('attendance.kpi.employeesUnit'), parts: [[t('attendance.kpi.full'), k.withFullPunches], [t('attendance.kpi.none'), k.withoutPunches], [t('attendance.kpi.allLeave'), k.onLeaveAllMonth]] }), _jsx(Kpi, { accent: "rose", icon: _jsx(EventBusyOutlinedIcon, {}), label: t('attendance.kpi.absence'), value: k.absenceDays, unit: t('attendance.kpi.days'), parts: [[t('attendance.kpi.deduction'), k.deductionDays], [t('attendance.kpi.excused'), k.excusedDays]] }), _jsx(Kpi, { accent: "amber", icon: _jsx(TimerOutlinedIcon, {}), label: t('attendance.kpi.late'), value: k.lateMinutes, unit: t('attendance.kpi.minutes'), parts: [[t('attendance.kpi.lateEmployees'), k.lateEmployees], [t('attendance.kpi.early'), k.earlyMinutes]] }), _jsx(Kpi, { accent: "blue", icon: _jsx(PriorityHighIcon, {}), label: t('attendance.kpi.exceptions'), value: k.openExceptions, unit: t('attendance.kpi.exceptionsUnit'), parts: [[t('attendance.kpi.missing'), k.missingPunches], [t('attendance.kpi.unexcused'), k.openExceptions - k.missingPunches]] }), _jsx(Kpi, { accent: "green", icon: _jsx(MoreTimeOutlinedIcon, {}), label: t('attendance.kpi.overtime'), value: Math.round(k.overtimeMinutes / 6) / 10, unit: t('attendance.kpi.hours'), parts: [[t('attendance.kpi.overtimePending'), k.overtimePending], [t('attendance.kpi.overtimeRequests'), overtime?.length ?? 0]] })] })) : (Array.from({ length: 5 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: 118 }, i))) }), _jsxs(Box, { sx: { ...hrCard, px: 2, pb: 2 }, children: [_jsxs(Tabs, { value: view, onChange: (_, v) => setView(v), variant: "scrollable", sx: { borderBottom: `1px solid ${hr.border}`, mb: 1.5 }, children: [_jsx(Tab, { value: "employees", label: t('attendance.tabs.employees', { count: k?.employees ?? 0 }) }), _jsx(Tab, { value: "exceptions", label: t('attendance.tabs.exceptions', { count: exceptions?.length ?? 0 }) }), _jsx(Tab, { value: "overtime", label: t('attendance.tabs.overtime', { count: overtime?.length ?? 0 }) }), _jsx(Tab, { value: "imports", label: t('attendance.tabs.imports') })] }), view === 'employees' && (_jsxs(_Fragment, { children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1, mb: 1.5 }, children: [_jsx(TextField, { size: "small", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('attendance.filters.search'), sx: { width: { md: 300 } }, slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) }, htmlInput: { 'aria-label': t('attendance.filters.search') } } }), _jsx(Filter, { label: t('attendance.filters.department'), all: t('attendance.filters.allDepartments'), value: department, onChange: setDepartment, options: (month?.departments ?? []).map((d) => [d.id, localRef(d, ar)]) }), _jsx(Filter, { label: t('attendance.filters.shift'), all: t('attendance.filters.allShifts'), value: shift, onChange: setShift, options: (month?.shifts ?? []).map((s) => [s.id, localRef(s, ar)]) }), _jsx(Filter, { label: t('attendance.filters.state'), all: t('attendance.filters.allStates'), value: state, onChange: setState, options: rowStates.map((s) => [s, t(`attendance.state.${s}`)]) })] }), !rows ? (_jsx(LinearProgress, {})) : rows.total === 0 ? (_jsx(HrEmptyState, { icon: _jsx(FactCheckOutlinedIcon, {}), title: filtered ? t('attendance.noResults') : t('attendance.empty'), hint: filtered ? undefined : t('attendance.emptyHint'), action: !filtered && canManage ? _jsx(Button, { variant: "outlined", startIcon: _jsx(UploadFileOutlinedIcon, {}), onClick: () => setImporting(true), children: t('attendance.import') }) : undefined })) : (_jsxs(_Fragment, { children: [_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: { '& td': { height: 46, fontVariantNumeric: 'tabular-nums' } }, children: [_jsxs(TableHead, { children: [_jsxs(TableRow, { children: [_jsx(TableCell, { rowSpan: 2, children: sortable('name', t('attendance.cols.employee')) }), _jsx(TableCell, { rowSpan: 2, children: t('attendance.cols.shift') }), _jsx(TableCell, { colSpan: 4, align: "center", children: t('attendance.cols.days') }), _jsx(TableCell, { colSpan: 3, align: "center", children: t('attendance.cols.minutes') }), _jsx(TableCell, { rowSpan: 2, children: sortable('deduction', t('attendance.cols.deduction')) }), _jsx(TableCell, { rowSpan: 2, children: sortable('overtime', t('attendance.cols.overtime')) }), _jsx(TableCell, { rowSpan: 2, children: t('attendance.cols.state') }), _jsx(TableCell, { rowSpan: 2 })] }), _jsxs(TableRow, { sx: { '& th': { top: 37 } }, children: [_jsx(TableCell, { children: t('attendance.cols.workDays') }), _jsx(TableCell, { children: sortable('present', t('attendance.cols.present')) }), _jsx(TableCell, { children: sortable('absent', t('attendance.cols.absent')) }), _jsx(TableCell, { children: t('attendance.cols.leave') }), _jsx(TableCell, { children: sortable('late', t('attendance.cols.late')) }), _jsx(TableCell, { children: sortable('early', t('attendance.cols.early')) }), _jsx(TableCell, { children: sortable('missing', t('attendance.cols.missing')) })] })] }), _jsxs(TableBody, { children: [rows.rows.map((r) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => setOpen({ id: r.employeeId }), children: [_jsx(TableCell, { sx: { minWidth: 230 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(HrAvatar, { name: r.nameEn || r.nameAr || '?' }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 13 }, children: ar ? (r.nameAr ?? r.nameEn) : r.nameEn }), _jsxs(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: [_jsx("bdi", { children: r.employeeNo }), (ar ? r.departmentAr : r.departmentEn) ? ` · ${ar ? r.departmentAr : r.departmentEn}` : ''] })] })] }) }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: localRef({ nameAr: r.shiftAr, nameEn: r.shiftEn }, ar) || '—' }), _jsx(TableCell, { children: r.workDays }), _jsx(TableCell, { children: r.present }), _jsx(TableCell, { sx: { color: r.absent ? '#BE123C' : undefined, fontWeight: r.absent ? 700 : undefined }, children: r.absent }), _jsx(TableCell, { children: r.leave }), _jsx(TableCell, { children: r.lateMinutes ? _jsx("bdi", { children: hm(r.lateMinutes) }) : 0 }), _jsx(TableCell, { children: r.earlyMinutes ? _jsx("bdi", { children: hm(r.earlyMinutes) }) : 0 }), _jsx(TableCell, { children: r.missingPunches }), _jsx(TableCell, { sx: { fontWeight: 700 }, children: r.deduction || '—' }), _jsx(TableCell, { children: r.overtimeMinutes ? _jsx("bdi", { children: hm(r.overtimeMinutes) }) : '—' }), _jsx(TableCell, { children: _jsx(HrStatusBadge, { label: t(`attendance.state.${r.state}`), ...stateLook[r.state] }) }), _jsx(TableCell, { children: _jsx(Button, { size: "small", sx: { fontWeight: 600 }, children: t('attendance.days') }) })] }, r.employeeId))), _jsxs(TableRow, { sx: { '& td': { bgcolor: '#F8FAFC !important', fontWeight: 700, borderTop: `1px solid ${hr.border}` } }, children: [_jsx(TableCell, { colSpan: 2, children: t('attendance.totalAll', { count: rows.totals.employees }) }), _jsx(TableCell, { children: rows.totals.workDays.toLocaleString('en-US') }), _jsx(TableCell, { children: rows.totals.present.toLocaleString('en-US') }), _jsx(TableCell, { children: rows.totals.absent }), _jsx(TableCell, { children: rows.totals.leave }), _jsx(TableCell, { children: _jsx("bdi", { children: hm(rows.totals.lateMinutes) }) }), _jsx(TableCell, { children: _jsx("bdi", { children: hm(rows.totals.earlyMinutes) }) }), _jsx(TableCell, { children: rows.totals.missingPunches }), _jsx(TableCell, { children: rows.totals.deduction }), _jsx(TableCell, { children: _jsx("bdi", { children: hm(rows.totals.overtimeMinutes) }) }), _jsx(TableCell, { colSpan: 2 })] })] })] }) }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { alignItems: 'center', gap: 1.5, mt: 1.5 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: t('attendance.shown', { from, to, total: rows.total }) }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Pagination, { count: Math.max(1, Math.ceil(rows.total / pageSize)), page: page, onChange: (_, p) => setPage(p), shape: "rounded", color: "primary", size: "small" }), _jsx(TextField, { select: true, size: "small", value: pageSize, onChange: (e) => setPageSize(Number(e.target.value)), sx: { width: 150 }, children: [10, 25, 50, 100].map((n) => (_jsx(MenuItem, { value: n, children: t('attendance.perPage', { count: n }) }, n))) })] })] }))] })), view === 'exceptions' &&
                        (!exceptions ? (_jsx(LinearProgress, {})) : exceptions.length === 0 ? (_jsx(HrEmptyState, { icon: _jsx(FactCheckOutlinedIcon, {}), title: t('attendance.noExceptions') })) : (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 640 }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: { '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('attendance.cols.date') }), _jsx(TableCell, { children: t('attendance.cols.employee') }), _jsx(TableCell, { children: t('attendance.cols.status') }), _jsx(TableCell, { children: t('attendance.cols.in') }), _jsx(TableCell, { children: t('attendance.cols.out') }), _jsx(TableCell, { children: t('attendance.cols.device') }), _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: exceptions.map((e) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => setOpen({ id: e.employeeId, date: e.date }), children: [_jsx(TableCell, { children: date(e.date) }), _jsxs(TableCell, { children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 13 }, children: ar ? (e.nameAr ?? e.nameEn) : e.nameEn }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: _jsx("bdi", { children: e.employeeNo }) })] }), _jsx(TableCell, { children: _jsx(HrStatusBadge, { label: t(`attendance.status.${e.status}`), ...(e.status === 'Absent' ? { color: '#BE123C', tint: '#FFF1F2' } : e.status === 'DeviceLeave' ? { color: '#B45309', tint: '#FEF3C7' } : { color: hr.primary, tint: '#EFF6FF' }) }) }), _jsx(TableCell, { children: _jsx("bdi", { children: hhmm(e.in) ?? '—' }) }), _jsx(TableCell, { children: _jsx("bdi", { children: hhmm(e.out) ?? '—' }) }), _jsx(TableCell, { sx: { color: hr.textMuted }, children: e.deviceStatus ?? '—' }), _jsx(TableCell, { children: _jsx(Button, { size: "small", sx: { fontWeight: 600 }, children: t('attendance.days') }) })] }, `${e.employeeId}-${e.date}`))) })] }) }))), view === 'overtime' && (_jsxs(_Fragment, { children: [editable && (_jsx(Box, { sx: { mb: 1.5 }, children: _jsx(Button, { variant: "outlined", startIcon: _jsx(MoreTimeOutlinedIcon, {}), onClick: () => setAsking(true), children: t('overtime.new') }) })), _jsx(OvertimeList, { list: overtime, onOpen: (id) => navigate(`/hr/overtime/${id}`) })] })), view === 'imports' &&
                        (!imports ? (_jsx(LinearProgress, {})) : imports.length === 0 ? (_jsx(HrEmptyState, { icon: _jsx(UploadFileOutlinedIcon, {}), title: t('attendance.noImports') })) : (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('attendance.cols.file') }), _jsx(TableCell, { children: t('attendance.cols.range') }), _jsx(TableCell, { children: t('attendance.cols.rows') }), _jsx(TableCell, { children: t('attendance.cols.accepted') }), _jsx(TableCell, { children: t('attendance.cols.rejected') }), _jsx(TableCell, { children: t('attendance.kpi.employees') }), _jsx(TableCell, { children: t('attendance.cols.by') })] }) }), _jsx(TableBody, { children: imports.map((i) => (_jsxs(TableRow, { children: [_jsx(TableCell, { sx: { fontWeight: 600 }, children: _jsx("bdi", { children: i.fileName }) }), _jsx(TableCell, { children: _jsx("bdi", { children: t('attendance.period', { from: date(i.from), to: date(i.to) }) }) }), _jsx(TableCell, { children: i.rows.toLocaleString('en-US') }), _jsx(TableCell, { sx: { color: hr.success, fontWeight: 700 }, children: i.accepted.toLocaleString('en-US') }), _jsx(TableCell, { sx: { color: i.rejected ? '#B91C1C' : undefined }, children: i.rejected }), _jsx(TableCell, { children: i.employees }), _jsxs(TableCell, { children: [i.createdByName, " \u00B7 ", date(i.createdAt)] })] }, i.id))) })] }) })))] }), importing && (_jsx(ImportDialog, { onClose: () => setImporting(false), onDone: (message, range) => {
                    setImporting(false);
                    setNotice(message);
                    if (range && range.slice(0, 7) !== period)
                        setParams((p) => (p.set('period', range.slice(0, 7)), p), { replace: true });
                    setVersion((v) => v + 1);
                } })), asking && _jsx(OvertimeDialog, { onClose: () => setAsking(false), onSent: (id) => navigate(`/hr/overtime/${id}`) }), closing && month && (_jsx(CloseDialog, { kind: closing, period: period, month: month, onClose: () => setClosing(null), onDone: () => {
                    setClosing(null);
                    setVersion((v) => v + 1);
                } })), drawer && (_jsx(DaysDrawer, { period: period, employeeId: drawer.id, initialDate: drawer.date, canManage: editable, onClose: () => setOpen(null), onChanged: () => setVersion((v) => v + 1) }))] }));
}
function Kpi({ accent, icon, label, value, unit, parts }) {
    const a = hrAccents[accent];
    return (_jsxs(Box, { sx: { ...hrCard, bgcolor: a.tint, p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'flex-start' }, children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600, color: '#334155' }, children: label }), _jsxs(Typography, { sx: { fontSize: 24, fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }, children: [value.toLocaleString('en-US'), " ", _jsx(Box, { component: "span", sx: { fontSize: 12, fontWeight: 500, color: hr.textMuted }, children: unit })] })] }), _jsx(Box, { sx: { width: 38, height: 38, borderRadius: '50%', bgcolor: '#fff', color: a.main, display: 'grid', placeItems: 'center', '& svg': { fontSize: 19 } }, children: icon })] }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: `repeat(${parts.length}, 1fr)`, gap: 1, borderTop: '1px dashed rgba(15,39,71,.12)', pt: 0.75 }, children: parts.map(([l, v]) => (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: l }), _jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums' }, children: v.toLocaleString('en-US') })] }, l))) })] }));
}
function Filter({ label, all, value, onChange, options }) {
    return (_jsxs(TextField, { select: true, size: "small", label: label, value: value, onChange: (e) => onChange(e.target.value), sx: { width: { md: 210 } }, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: all }), options.map(([v, l]) => (_jsx(MenuItem, { value: v, children: l }, v)))] }));
}
/** Sending the month for closing (its figures frozen), or reopening a closed month with the reason. */
function CloseDialog({ kind, period, month, onClose, onDone }) {
    const { t } = useTranslation();
    const monthName = useMonthName();
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const k = month.kpis;
    const run = async () => {
        setBusy(true);
        setError(null);
        try {
            if (kind === 'submit')
                await attendanceApi.submitMonth(period);
            else
                await attendanceApi.reopenMonth(period, reason.trim());
            onDone();
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "sm", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t(kind === 'submit' ? 'attendance.close.submitTitle' : 'attendance.close.reopenTitle', { month: monthName(period) }) }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5 }, children: [kind === 'submit' ? (_jsxs(_Fragment, { children: [_jsx(Typography, { sx: { fontSize: 13.5 }, children: t('attendance.close.submitHint') }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }, children: [
                                        [t('attendance.kpi.employees'), k.employees],
                                        [t('attendance.kpi.deduction'), k.deductionDays],
                                        [t('attendance.kpi.late'), hm(k.lateMinutes)],
                                        [t('attendance.kpi.overtime'), hm(k.overtimeMinutes)],
                                    ].map(([l, v]) => (_jsxs(Box, { sx: { bgcolor: hr.muted, borderRadius: '10px', p: 1.25 }, children: [_jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: l }), _jsx(Typography, { sx: { fontWeight: 700, fontSize: 17, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: v }) })] }, l))) }), k.openExceptions > 0 && _jsx(Alert, { severity: "warning", children: t('attendance.close.openExceptions', { count: k.openExceptions }) }), k.overtimePending > 0 && _jsx(Alert, { severity: "warning", children: t('attendance.close.pendingOvertime', { count: k.overtimePending }) })] })) : (_jsxs(_Fragment, { children: [_jsx(Typography, { sx: { fontSize: 13.5 }, children: t('attendance.close.reopenHint') }), _jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('attendance.close.reason'), value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 400 } } })] })), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || (kind === 'reopen' && !reason.trim()), onClick: () => void run(), children: t(kind === 'submit' ? 'attendance.close.submit' : 'attendance.close.reopen') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
