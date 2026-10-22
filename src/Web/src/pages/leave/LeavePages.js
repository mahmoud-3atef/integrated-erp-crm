import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, LinearProgress, MenuItem, Pagination, Skeleton, Stack, Tab, Tabs, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { periodOf, shiftPeriod } from '../../api/attendance';
import { errorKey } from '../../api/auth';
import { daysText, leaveApi } from '../../api/leave';
import { hm } from '../../api/attendance';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrEmptyState, HrPageHeader, HrScope, hr, hrAccents, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useMonthName } from '../attendance/AttendanceMonthPage';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { LeaveRequestDialog, LeaveStatusBadge, RequestsTable, leaveLook, typeName } from './leave';
import { PermissionDialog, PermissionsTable } from './permissions';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { DateField } from '../../components/DateField';
function Kpi({ accent, icon, label, value, unit, parts }) {
    const a = hrAccents[accent];
    return (_jsxs(Box, { sx: { ...hrCard, bgcolor: a.tint, p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'flex-start' }, children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600, color: '#334155' }, children: label }), _jsxs(Typography, { sx: { fontSize: 24, fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }, children: [value.toLocaleString('en-US'), " ", _jsx(Box, { component: "span", sx: { fontSize: 12, fontWeight: 500, color: hr.textMuted }, children: unit })] })] }), _jsx(Box, { sx: { width: 38, height: 38, borderRadius: '50%', bgcolor: '#fff', color: a.main, display: 'grid', placeItems: 'center', '& svg': { fontSize: 19 } }, children: icon })] }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: `repeat(${parts.length}, 1fr)`, gap: 1, borderTop: '1px dashed rgba(15,39,71,.12)', pt: 0.75 }, children: parts.map(([l, v]) => (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: l }), _jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums' }, children: v })] }, l))) })] }));
}
/** Leave and permissions: the cards, the requests (all, waiting, current) and the month's leave calendar. */
export function LeavePage() {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const navigate = useNavigate();
    const { can } = useSession();
    const [view, setView] = useState('all');
    const [kpis, setKpis] = useState(null);
    const [types, setTypes] = useState([]);
    const [rows, setRows] = useState(null);
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [typeId, setTypeId] = useState('');
    const [page, setPage] = useState(1);
    const [error, setError] = useState(null);
    const [asking, setAsking] = useState(false);
    const [permitting, setPermitting] = useState(false);
    const [permissions, setPermissions] = useState(null);
    useEffect(() => {
        const timer = setTimeout(() => setQuery(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    useEffect(() => setPage(1), [query, typeId, view]);
    useEffect(() => {
        leaveApi.kpis().then(setKpis).catch((f) => setError(errorKey(f)));
        leaveApi
            .setup()
            .then((s) => setTypes(s.types))
            .catch(() => setTypes([]));
    }, []);
    useEffect(() => {
        if (view === 'permissions') {
            setPermissions(null);
            leaveApi.permissions({}).then(setPermissions).catch((f) => setError(errorKey(f)));
            return;
        }
        if (view === 'calendar')
            return;
        setRows(null);
        leaveApi
            .requests({ tab: view, typeId: typeId || undefined, search: query, page, pageSize: 25 })
            .then(setRows)
            .catch((f) => setError(errorKey(f)));
    }, [view, typeId, query, page]);
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(BeachAccessOutlinedIcon, {}), title: t('leave.title'), subtitle: t('leave.intro'), actions: can('leave.manage', true) && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(TimerOutlinedIcon, {}), onClick: () => setPermitting(true), children: t('permissions.new') }), _jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setAsking(true), children: t('leave.new') })] })) }), _jsx(ErrorMessage, { messageKey: error }), _jsx(Box, { sx: { display: 'grid', gap: 1.5, mb: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }, children: kpis ? (_jsxs(_Fragment, { children: [_jsx(Kpi, { accent: "green", icon: _jsx(BeachAccessOutlinedIcon, {}), label: t('leave.kpi.today'), value: kpis.onLeaveToday, unit: t('leave.kpi.employees'), parts: [[t('leave.kpi.annual'), kpis.todayAnnual], [t('leave.kpi.sick'), kpis.todaySick], [t('leave.kpi.other'), kpis.todayOther]] }), _jsx(Kpi, { accent: "blue", icon: _jsx(HourglassEmptyOutlinedIcon, {}), label: t('leave.kpi.pending'), value: kpis.pending, unit: t('leave.kpi.requests'), parts: [[t('leave.kpi.returned'), kpis.returned]] }), _jsx(Kpi, { accent: "violet", icon: _jsx(EventAvailableOutlinedIcon, {}), label: t('leave.kpi.upcoming'), value: kpis.upcoming, unit: t('leave.kpi.requests'), parts: [[t('leave.kpi.days'), daysText(kpis.upcomingDays)], [t('leave.kpi.returns'), kpis.returnsToConfirm]] }), _jsx(Kpi, { accent: "amber", icon: _jsx(TimerOutlinedIcon, {}), label: t('leave.kpi.permissions'), value: kpis.permissionsThisMonth, unit: t('leave.kpi.permissionsUnit'), parts: [[t('leave.kpi.hours'), hm(kpis.permissionMinutesThisMonth)], [t('leave.kpi.pending'), kpis.permissionsPending]] })] })) : (Array.from({ length: 4 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: 118 }, i))) }), _jsxs(Box, { sx: { ...hrCard, px: 2, pb: 2 }, children: [_jsxs(Tabs, { value: view, onChange: (_, v) => setView(v), variant: "scrollable", sx: { borderBottom: `1px solid ${hr.border}`, mb: 1.5 }, children: [_jsx(Tab, { value: "all", label: t('leave.tabs.all') }), _jsx(Tab, { value: "pending", label: t('leave.tabs.pending', { count: kpis?.pending ?? 0 }) }), _jsx(Tab, { value: "current", label: t('leave.tabs.current') }), _jsx(Tab, { value: "permissions", label: t('leave.tabs.permissions') }), _jsx(Tab, { value: "calendar", label: t('leave.tabs.calendar') })] }), view === 'permissions' ? (!permissions ? _jsx(LinearProgress, {}) : _jsx(PermissionsTable, { rows: permissions, onOpen: (id) => navigate(`/hr/permissions/${id}`) })) : view === 'calendar' ? (_jsx(LeaveCalendar, { onOpen: (id) => navigate(`/hr/leave/${id}`) })) : (_jsxs(_Fragment, { children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1, mb: 1.5 }, children: [_jsx(TextField, { size: "small", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('leave.search'), sx: { width: { md: 300 } }, slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) }, htmlInput: { 'aria-label': t('leave.search') } } }), _jsxs(TextField, { select: true, size: "small", label: t('leave.type'), value: typeId, onChange: (e) => setTypeId(e.target.value), sx: { width: { md: 220 } }, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('leave.allTypes') }), types.map((x) => (_jsx(MenuItem, { value: x.id, children: typeName(x, ar) }, x.id)))] })] }), !rows ? (_jsx(LinearProgress, {})) : rows.total === 0 ? (_jsx(HrEmptyState, { icon: _jsx(EventBusyOutlinedIcon, {}), title: t('leave.none'), hint: t('leave.noneHint') })) : (_jsxs(_Fragment, { children: [_jsx(RequestsTable, { rows: rows.rows, onOpen: (id) => navigate(`/hr/leave/${id}`) }), rows.total > 25 && (_jsx(Stack, { direction: "row", sx: { justifyContent: 'center', mt: 1.5 }, children: _jsx(Pagination, { count: Math.ceil(rows.total / 25), page: page, onChange: (_, p) => setPage(p), shape: "rounded", color: "primary", size: "small" }) }))] }))] }))] }), asking && _jsx(LeaveRequestDialog, { onClose: () => setAsking(false), onSent: (id) => navigate(`/hr/leave/${id}`) }), permitting && _jsx(PermissionDialog, { onClose: () => setPermitting(false), onSent: (id) => navigate(`/hr/permissions/${id}`) })] }));
}
/** The month's leaves (approved and in approval), one row per employee, a bar per leave. */
function LeaveCalendar({ onOpen }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const monthName = useMonthName();
    const [period, setPeriod] = useState(periodOf(new Date()));
    const [list, setList] = useState(null);
    useEffect(() => {
        setList(null);
        leaveApi.calendar(period).then(setList).catch(() => setList([]));
    }, [period]);
    const [y, m] = period.split('-').map(Number);
    const daysIn = new Date(y, m, 0).getDate();
    const people = [...new Map((list ?? []).map((r) => [r.employeeId, r.employeeName])).entries()];
    const colours = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0E7490'];
    return (_jsxs(Box, { children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 1.5 }, children: [_jsx(IconButton, { size: "small", "aria-label": t('attendance.prevMonth'), onClick: () => setPeriod(shiftPeriod(period, -1)), children: ar ? _jsx(ChevronRightIcon, {}) : _jsx(ChevronLeftIcon, {}) }), _jsx(Typography, { sx: { fontWeight: 700, minWidth: 120, textAlign: 'center' }, children: monthName(period) }), _jsx(IconButton, { size: "small", "aria-label": t('attendance.nextMonth'), onClick: () => setPeriod(shiftPeriod(period, 1)), children: ar ? _jsx(ChevronLeftIcon, {}) : _jsx(ChevronRightIcon, {}) })] }), !list ? (_jsx(LinearProgress, {})) : people.length === 0 ? (_jsx(HrEmptyState, { icon: _jsx(EventBusyOutlinedIcon, {}), title: t('leave.calendarEmpty') })) : (_jsxs(Box, { sx: { overflowX: 'auto' }, children: [_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: `200px repeat(${daysIn}, minmax(22px, 1fr))`, minWidth: 900, fontSize: 11 }, children: [_jsx(Box, {}), Array.from({ length: daysIn }, (_, i) => (_jsx(Box, { sx: { textAlign: 'center', color: hr.textMuted, fontVariantNumeric: 'tabular-nums', py: 0.5 }, children: i + 1 }, i))), people.map(([id, name], row) => (_jsxs(Box, { sx: { display: 'contents' }, children: [_jsx(Box, { sx: { fontWeight: 700, fontSize: 12.5, py: 0.75, borderTop: `1px solid #EEF2F7`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: name }), Array.from({ length: daysIn }, (_, i) => {
                                        const day = `${period}-${String(i + 1).padStart(2, '0')}`;
                                        const leave = list.find((r) => r.employeeId === id && r.from <= day && r.to >= day);
                                        return (_jsx(Box, { sx: { borderTop: `1px solid #EEF2F7`, display: 'flex', alignItems: 'center', px: '1px' }, children: leave && (_jsx(Box, { component: "button", type: "button", title: `${leave.requestNo} · ${typeName(leave, ar)}`, onClick: () => onOpen(leave.id), sx: { all: 'unset', cursor: 'pointer', display: 'block', width: '100%', height: 14, borderRadius: '4px', bgcolor: leave.status === 'Approved' ? colours[row % colours.length] : leaveLook.InApproval.tint, border: leave.status === 'Approved' ? 'none' : `1px dashed ${hr.primary}` } })) }, i));
                                    })] }, id)))] }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted, mt: 1 }, children: t('leave.calendarHint') })] }))] }));
}
/** A leave request: its approval bar, its details and balance, «send again» once returned, «cancel» before it starts. */
export function LeaveRequestPage() {
    const { id = '' } = useParams();
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const navigate = useNavigate();
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const [d, setD] = useState(null);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [returning, setReturning] = useState(false);
    const [amending, setAmending] = useState(false);
    const [cancellingApproved, setCancellingApproved] = useState(false);
    const approval = useRecordApproval(d?.approval?.instanceId);
    useCrumb(d?.request.requestNo, `/hr/leave/${id}`);
    const reload = useCallback(async () => {
        try {
            setD(await leaveApi.request(id));
            setError(null);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    if (!d) {
        return (_jsxs(HrScope, { children: [_jsx(ErrorMessage, { messageKey: error }), !error && _jsx(LinearProgress, {})] }));
    }
    const r = d.request;
    const manage = can('leave.manage', true);
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(BeachAccessOutlinedIcon, {}), title: t('leave.requestTitle', { type: typeName(r, ar) }), status: _jsx(LeaveStatusBadge, { status: r.status }), reference: r.requestNo, subtitle: _jsxs(_Fragment, { children: [_jsx(RouterLink, { to: `/hr/employees/${r.employeeId}`, children: r.employeeName }), " \u00B7 ", _jsx("bdi", { children: date(r.from) }), " \u2013 ", _jsx("bdi", { children: date(r.to) }), " \u00B7 ", t('leave.daysCount', { days: daysText(r.days) })] }), actions: _jsxs(_Fragment, { children: [r.status === 'Returned' && manage && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), onClick: () => setEditing(true), children: t('leave.resubmit') })), d.canConfirmReturn && manage && (_jsx(Button, { variant: "contained", startIcon: _jsx(LoginOutlinedIcon, {}), onClick: () => setReturning(true), children: t('leave.return.confirm') })), d.canAmend && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditNoteOutlinedIcon, {}), onClick: () => setAmending(true), children: t('leave.amend.action') })), d.canCancelApproved ? (_jsx(Button, { variant: "outlined", color: "error", startIcon: _jsx(ReplayOutlinedIcon, {}), onClick: () => setCancellingApproved(true), children: t('leave.amend.cancelAction') })) : (d.canCancel &&
                            manage && (_jsx(Button, { variant: "outlined", color: "error", startIcon: _jsx(ReplayOutlinedIcon, {}), onClick: () => setCancelling(true), children: t('leave.cancel') }))), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') } }), onClick: () => navigate(-1), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), d.approval && (_jsx(ApprovalBar, { status: d.approval, detail: approval.detail, onChanged: () => {
                    void reload();
                    void approval.reload();
                } })), d.amendedAt && r.status === 'Approved' && (_jsxs(Alert, { severity: "info", sx: { mb: 1.5 }, children: [t('leave.amend.amendedBy', { by: d.amendedByName, date: date(d.amendedAt) }), " \u2014 ", d.amendNote] })), d.canceledAt && (_jsx(Alert, { severity: "warning", sx: { mb: 1.5 }, children: t('leave.amend.canceledBy', { by: d.canceledByName, date: date(d.canceledAt) }) })), d.lastComment && r.status !== 'Approved' && (_jsx(Alert, { severity: r.status === 'Rejected' ? 'error' : 'warning', sx: { mb: 1.5 }, children: d.lastComment })), d.returnedOn && (_jsxs(Alert, { severity: d.expectedReturn && d.returnedOn > d.expectedReturn ? 'warning' : 'success', sx: { mb: 1.5 }, children: [t(d.expectedReturn && d.returnedOn > d.expectedReturn ? 'leave.return.late' : 'leave.return.done', { date: date(d.returnedOn), expected: date(d.expectedReturn) }), d.returnNote ? ` · ${d.returnNote}` : ''] })), _jsx(Box, { sx: { ...hrCard, p: 2, display: 'grid', gap: 1.25, maxWidth: 820 }, children: [
                    [t('leave.employee'), r.employeeName],
                    [t('leave.type'), `${typeName(r, ar)} · ${t(`leave.pay.${r.pay}`)}`],
                    [t('leave.period'), _jsxs(_Fragment, { children: [_jsx("bdi", { children: date(r.from) }), " \u2013 ", _jsx("bdi", { children: date(r.to) })] })],
                    [t('leave.cols.days'), daysText(r.days)],
                    ...(r.hasBalance && d.available !== null ? [[t('leave.preview.available'), daysText(d.available)]] : []),
                    [t('leave.substitute'), d.substituteName ?? '—'],
                    [t('leave.ticket'), d.ticket ? t('leave.yes') : t('leave.no')],
                    [t('leave.reason'), d.reason ?? '—'],
                    [t('leave.requested'), _jsxs(_Fragment, { children: [r.createdByName, " \u00B7 ", _jsx("bdi", { children: date(r.createdAt) })] })],
                ].map(([k, v]) => (_jsxs(Stack, { direction: "row", sx: { gap: 2, borderBottom: `1px solid #EEF2F7`, pb: 1 }, children: [_jsx(Typography, { sx: { width: 150, flex: '0 0 auto', color: hr.textMuted, fontSize: 13 }, children: k }), _jsx(Typography, { sx: { fontWeight: 600, fontSize: 13.5 }, children: v })] }, k))) }), editing && (_jsx(LeaveRequestDialog, { request: { id: r.id, employeeName: r.employeeName, input: { employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, from: r.from, to: r.to, reason: d.reason, substituteId: null, ticket: d.ticket } }, onClose: () => setEditing(false), onSent: () => {
                    setEditing(false);
                    void reload();
                    void approval.reload();
                } })), returning && (_jsx(ReturnDialog, { expected: d.expectedReturn, onClose: () => setReturning(false), onConfirm: async (on, note) => {
                    await leaveApi.confirmReturn(r.id, on, note);
                    setReturning(false);
                    await reload();
                } })), amending && (_jsx(LeaveAmendDialog, { detail: d, onClose: () => setAmending(false), onSaved: () => {
                    setAmending(false);
                    void reload();
                } })), cancellingApproved && (_jsx(CancelDialog, { title: t('leave.amend.cancelAction'), hint: t('leave.amend.cancelHint'), onClose: () => setCancellingApproved(false), onCancel: async (reason) => {
                    await leaveApi.cancelApproved(r.id, reason);
                    setCancellingApproved(false);
                    await reload();
                } })), cancelling && (_jsx(CancelDialog, { onClose: () => setCancelling(false), onCancel: async (reason) => {
                    await leaveApi.cancel(r.id, reason);
                    setCancelling(false);
                    await reload();
                } }))] }));
}
function ReturnDialog({ expected, onClose, onConfirm }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const [on, setOn] = useState(expected ?? new Date().toISOString().slice(0, 10));
    const [note, setNote] = useState('');
    const [error, setError] = useState(null);
    return (_jsx(Dialog, { open: true, onClose: onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('leave.return.confirm') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Typography, { sx: { fontSize: 13 }, children: t('leave.return.hint', { expected: date(expected) }) }), _jsx(DateField, { size: "small", label: t('leave.return.on'), value: on, onChange: (e) => setOn(e.target.value), slotProps: { inputLabel: { shrink: true } } }), expected && on < expected && _jsx(Alert, { severity: "info", sx: { py: 0 }, children: t('leave.return.earlyNote') }), expected && on > expected && _jsx(Alert, { severity: "warning", sx: { py: 0 }, children: t('leave.return.lateNote') }), _jsx(TextField, { size: "small", label: t('leave.reason'), value: note, onChange: (e) => setNote(e.target.value) }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: !on, onClick: () => void onConfirm(on, note.trim() || null).catch((f) => setError(errorKey(f))), children: t('leave.return.confirm') }), _jsx(Button, { onClick: onClose, children: t('common.cancel') })] })] }) }));
}
function CancelDialog({ title, hint, onClose, onCancel }) {
    const { t } = useTranslation();
    const [reason, setReason] = useState('');
    const [error, setError] = useState(null);
    return (_jsx(Dialog, { open: true, onClose: onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: title ?? t('leave.cancel') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Typography, { sx: { fontSize: 13 }, children: hint ?? t('leave.cancelHint') }), _jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('leave.reason'), value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", color: "error", disabled: !reason.trim(), onClick: () => void onCancel(reason.trim()).catch((f) => setError(errorKey(f))), children: title ?? t('leave.cancel') }), _jsx(Button, { onClick: onClose, children: t('common.back') })] })] }) }));
}
/**
 * Changing an approved leave (its own permission): its days (counted again by its type; the balance follows), the
 * reason and the ticket, with the reason for the change. Not while its attendance month is closing or closed, nor while
 * a settlement made from it stands.
 */
function LeaveAmendDialog({ detail, onClose, onSaved }) {
    const { t } = useTranslation();
    const r = detail.request;
    const [from, setFrom] = useState(r.from);
    const [to, setTo] = useState(r.to);
    const [reason, setReason] = useState(detail.reason ?? '');
    const [ticket, setTicket] = useState(detail.ticket);
    const [why, setWhy] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await leaveApi.amend(r.id, { from, to, reason: reason.trim() || null, substituteId: null, ticket, amendReason: why.trim() });
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: onClose, maxWidth: "sm", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('leave.amend.title', { no: r.requestNo }) }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Alert, { severity: "info", children: t('leave.amend.hint') }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 1.5 }, children: [_jsx(DateField, { size: "small", label: t('leave.from'), value: from, onChange: (e) => setFrom(e.target.value), slotProps: { inputLabel: { shrink: true } }, sx: { flex: 1 } }), _jsx(DateField, { size: "small", label: t('leave.to'), value: to, onChange: (e) => setTo(e.target.value), slotProps: { inputLabel: { shrink: true } }, sx: { flex: 1 } })] }), _jsx(TextField, { size: "small", multiline: true, minRows: 2, label: t('leave.reason'), value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: ticket, onChange: (e) => setTicket(e.target.checked) }), label: t('leave.ticket') }), _jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('leave.amend.reason'), value: why, onChange: (e) => setWhy(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !why.trim() || !from || !to, onClick: () => void save(), children: t('leave.amend.save') }), _jsx(Button, { onClick: onClose, children: t('common.back') })] })] }) }));
}
