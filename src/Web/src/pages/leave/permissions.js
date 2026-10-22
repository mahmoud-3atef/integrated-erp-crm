import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { hm } from '../../api/attendance';
import { errorKey } from '../../api/auth';
import { leaveApi, permissionKinds } from '../../api/leave';
import { staffApi } from '../../api/staff';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrPageHeader, HrScope, hr, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval, ShownStatus } from '../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { LeaveStatusBadge } from './leave';
import { DateField } from '../../components/DateField';
const hhmm = (t) => t.slice(0, 5);
/** A permission (or a returned one sent again): employee, day, from and to, kind, with the month's allowance shown. */
export function PermissionDialog({ employee, request, onClose, onSent }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [who, setWho] = useState(employee ?? (request ? { id: request.employeeId, nameAr: request.employeeName, nameEn: request.employeeName } : null));
    const [people, setPeople] = useState([]);
    const [search, setSearch] = useState('');
    const [day, setDay] = useState(request?.date ?? new Date().toISOString().slice(0, 10));
    const [from, setFrom] = useState(request ? hhmm(request.from) : '09:00');
    const [to, setTo] = useState(request ? hhmm(request.to) : '10:00');
    const [kind, setKind] = useState(request?.kind ?? 'LateArrival');
    const [reason, setReason] = useState(request?.reason ?? '');
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (employee || request)
            return;
        const timer = setTimeout(() => staffApi.pick(search).then(setPeople).catch(() => setPeople([])), 250);
        return () => clearTimeout(timer);
    }, [search, employee, request]);
    const input = who && day && from && to ? { employeeId: who.id, date: day, from, to, kind, reason: reason.trim() || null } : null;
    const key = input ? `${input.employeeId}|${day}|${from}|${to}|${kind}` : '';
    useEffect(() => {
        if (!input) {
            setPreview(null);
            return;
        }
        const timer = setTimeout(() => {
            leaveApi
                .previewPermission(input, request?.id)
                .then((p) => (setPreview(p), setError(null)))
                .catch((f) => (setPreview(null), setError(errorKey(f))));
        }, 250);
        return () => clearTimeout(timer);
    }, [key]);
    const send = async () => {
        if (!input)
            return;
        setBusy(true);
        setError(null);
        try {
            const r = request ? await leaveApi.resubmitPermission(request.id, input) : await leaveApi.sendPermission(input);
            onSent(r.id);
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "sm", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: request ? request.requestNo : t('permissions.new') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Autocomplete, { size: "small", disabled: Boolean(employee || request), options: people, value: who, onChange: (_, v) => setWho(v), onInputChange: (_, v) => setSearch(v), getOptionLabel: (o) => (ar ? o.nameAr : o.nameEn), isOptionEqualToValue: (a, b) => a.id === b.id, filterOptions: (x) => x, renderInput: (params) => _jsx(TextField, { ...params, required: true, label: t('leave.employee') }) }), _jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }, children: [_jsx(TextField, { select: true, size: "small", label: t('permissions.kind'), value: kind, onChange: (e) => setKind(e.target.value), children: permissionKinds.map((k) => (_jsx(MenuItem, { value: k, children: t(`permissions.kinds.${k}`) }, k))) }), _jsx(DateField, { size: "small", label: t('permissions.date'), value: day, onChange: (e) => setDay(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { size: "small", type: "time", label: t('permissions.from'), value: from, onChange: (e) => setFrom(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { size: "small", type: "time", label: t('permissions.to'), value: to, onChange: (e) => setTo(e.target.value), slotProps: { inputLabel: { shrink: true } } })] }), _jsx(Box, { sx: { bgcolor: '#F8FAFC', border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.5 }, children: !input ? (_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('permissions.pick') })) : !preview ? (_jsx(LinearProgress, {})) : (_jsxs(_Fragment, { children: [_jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }, children: [
                                            [t('permissions.duration'), hm(preview.minutes)],
                                            [t('permissions.usedThisMonth'), `${hm(preview.usedThisMonth)} / ${hm(preview.allowance)}`],
                                            [t('permissions.remaining'), preview.mission ? '—' : hm(preview.remaining)],
                                        ].map(([l, v]) => (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: l }), _jsx(Typography, { sx: { fontWeight: 700, fontSize: 17, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: v }) })] }, l))) }), preview.mission && _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 0.75 }, children: t('permissions.missionNote') }), preview.overAllowance > 0 && (_jsx(Alert, { severity: "warning", sx: { mt: 1, py: 0 }, children: t('permissions.over', { minutes: hm(preview.overAllowance) }) })), preview.problems.map((p) => (_jsx(Alert, { severity: "error", sx: { mt: 1, py: 0 }, children: t(`permissions.problems.${p}`) }, p)))] })) }), _jsx(TextField, { size: "small", multiline: true, minRows: 2, label: t('leave.reason'), value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), preview && _jsx(Alert, { severity: "info", sx: { py: 0 }, children: preview.managerLinked ? t('permissions.route.manager', { name: preview.managerName }) : t('permissions.route.hr') }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), disabled: busy || !preview || preview.problems.length > 0, onClick: () => void send(), children: t('leave.send') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
export function PermissionsTable({ rows, showEmployee = true, onOpen }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    if (rows.length === 0)
        return _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('permissions.none') });
    return (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [showEmployee && _jsx(TableCell, { children: t('leave.employee') }), _jsx(TableCell, { children: t('leave.cols.no') }), _jsx(TableCell, { children: t('permissions.kind') }), _jsx(TableCell, { children: t('permissions.date') }), _jsx(TableCell, { children: t('permissions.time') }), _jsx(TableCell, { children: t('permissions.duration') }), _jsx(TableCell, { children: t('leave.cols.status') })] }) }), _jsx(TableBody, { children: rows.map((p) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => onOpen(p.id), children: [showEmployee && _jsx(TableCell, { sx: { fontWeight: 700 }, children: p.employeeName }), _jsx(TableCell, { sx: { fontWeight: 700 }, children: _jsx("bdi", { children: p.requestNo }) }), _jsx(TableCell, { children: t(`permissions.kinds.${p.kind}`) }), _jsx(TableCell, { children: date(p.date) }), _jsx(TableCell, { children: _jsx("bdi", { dir: "ltr", children: `${hhmm(p.from)} – ${hhmm(p.to)}` }) }), _jsx(TableCell, { children: _jsx("bdi", { children: hm(p.minutes) }) }), _jsx(TableCell, { children: _jsx(LeaveStatusBadge, { status: p.status }) })] }, p.id))) })] }) }));
}
/** A permission: its approval bar, its details, and «send again» once returned. */
export function PermissionPage() {
    const { id = '' } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const [p, setP] = useState(null);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(false);
    const [amending, setAmending] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const approval = useRecordApproval(p?.approval?.instanceId);
    useCrumb(p?.requestNo, `/hr/permissions/${id}`);
    const reload = useCallback(async () => {
        try {
            setP(await leaveApi.permission(id));
            setError(null);
        }
        catch (f) {
            setError(errorKey(f));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    if (!p) {
        return (_jsxs(HrScope, { children: [_jsx(ErrorMessage, { messageKey: error }), !error && _jsx(LinearProgress, {})] }));
    }
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(TimerOutlinedIcon, {}), title: t('permissions.title', { kind: t(`permissions.kinds.${p.kind}`) }), status: _jsx(ShownStatus, { approval: approval.detail, children: _jsx(LeaveStatusBadge, { status: p.status }) }), reference: p.requestNo, subtitle: _jsxs(_Fragment, { children: [_jsx(RouterLink, { to: `/hr/employees/${p.employeeId}`, children: p.employeeName }), " \u00B7 ", _jsx("bdi", { children: date(p.date) }), " \u00B7 ", _jsx("bdi", { dir: "ltr", children: `${hhmm(p.from)} – ${hhmm(p.to)}` })] }), actions: _jsxs(_Fragment, { children: [p.status === 'Returned' && can('leave.manage', true) && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), onClick: () => setEditing(true), children: t('leave.resubmit') })), p.canAmend && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditNoteOutlinedIcon, {}), onClick: () => setAmending(true), children: t('permissions.amend.action') })), p.canCancelApproved && (_jsx(Button, { variant: "outlined", color: "error", startIcon: _jsx(CancelOutlinedIcon, {}), onClick: () => setCancelling(true), children: t('permissions.amend.cancelAction') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') } }), onClick: () => navigate(-1), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), p.approval && (_jsx(ApprovalBar, { status: p.approval, detail: approval.detail, onChanged: () => {
                    void reload();
                    void approval.reload();
                } })), p.amendedAt && p.status === 'Approved' && (_jsxs(Alert, { severity: "info", sx: { mb: 1.5 }, children: [t('permissions.amend.amendedBy', { by: p.amendedByName, date: date(p.amendedAt) }), " \u2014 ", p.amendNote] })), p.canceledAt && (_jsx(Alert, { severity: "warning", sx: { mb: 1.5 }, children: t('permissions.amend.canceledBy', { by: p.canceledByName, date: date(p.canceledAt) }) })), p.lastComment && p.status !== 'Approved' && _jsx(Alert, { severity: p.status === 'Rejected' ? 'error' : 'warning', sx: { mb: 1.5 }, children: p.lastComment }), _jsxs(Box, { sx: { ...hrCard, p: 2, display: 'grid', gap: 1.25, maxWidth: 760 }, children: [[
                        [t('leave.employee'), p.employeeName],
                        [t('permissions.kind'), t(`permissions.kinds.${p.kind}`)],
                        [t('permissions.date'), _jsx("bdi", { children: date(p.date) }, "d")],
                        [t('permissions.time'), _jsx("bdi", { dir: "ltr", children: `${hhmm(p.from)} – ${hhmm(p.to)}` }, "t")],
                        [t('permissions.duration'), _jsx("bdi", { children: hm(p.minutes) }, "m")],
                        [t('leave.reason'), p.reason ?? '—'],
                        [t('leave.requested'), _jsxs("span", { children: [p.createdByName, " \u00B7 ", _jsx("bdi", { children: date(p.createdAt) })] }, "r")],
                    ].map(([k, v]) => (_jsxs(Stack, { direction: "row", sx: { gap: 2, borderBottom: `1px solid #EEF2F7`, pb: 1 }, children: [_jsx(Typography, { sx: { width: 140, flex: '0 0 auto', color: hr.textMuted, fontSize: 13 }, children: k }), _jsx(Typography, { sx: { fontWeight: 600, fontSize: 13.5 }, children: v })] }, k))), _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: t('permissions.effect') })] }), amending && (_jsx(PermissionAmendDialog, { permission: p, onClose: () => setAmending(false), onSaved: () => {
                    setAmending(false);
                    void reload();
                } })), cancelling && (_jsx(PermissionCancelDialog, { onClose: () => setCancelling(false), onCancel: async (reason) => {
                    await leaveApi.cancelApprovedPermission(p.id, reason);
                    setCancelling(false);
                    await reload();
                } })), editing && (_jsx(PermissionDialog, { request: p, onClose: () => setEditing(false), onSent: () => {
                    setEditing(false);
                    void reload();
                    void approval.reload();
                } }))] }));
}
/** Changing an approved permission (its own permission): its day, times, kind and reason, with the reason for the change. */
function PermissionAmendDialog({ permission: p, onClose, onSaved }) {
    const { t } = useTranslation();
    const [day, setDay] = useState(p.date);
    const [from, setFrom] = useState(hhmm(p.from));
    const [to, setTo] = useState(hhmm(p.to));
    const [kind, setKind] = useState(p.kind);
    const [reason, setReason] = useState(p.reason ?? '');
    const [why, setWhy] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await leaveApi.amendPermission(p.id, { date: day, from, to, kind, reason: reason.trim() || null, amendReason: why.trim() });
            onSaved();
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: onClose, maxWidth: "sm", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('permissions.amend.title', { no: p.requestNo }) }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Alert, { severity: "info", children: t('permissions.amend.hint') }), _jsx(TextField, { size: "small", select: true, label: t('permissions.kind'), value: kind, onChange: (e) => setKind(e.target.value), children: permissionKinds.map((k) => (_jsx(MenuItem, { value: k, children: t(`permissions.kinds.${k}`) }, k))) }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 1.5 }, children: [_jsx(DateField, { size: "small", label: t('permissions.date'), value: day, onChange: (e) => setDay(e.target.value), slotProps: { inputLabel: { shrink: true } }, sx: { flex: 1 } }), _jsx(TextField, { size: "small", type: "time", label: t('permissions.from'), value: from, onChange: (e) => setFrom(e.target.value), slotProps: { inputLabel: { shrink: true } }, sx: { flex: 1 } }), _jsx(TextField, { size: "small", type: "time", label: t('permissions.to'), value: to, onChange: (e) => setTo(e.target.value), slotProps: { inputLabel: { shrink: true } }, sx: { flex: 1 } })] }), _jsx(TextField, { size: "small", multiline: true, minRows: 2, label: t('leave.reason'), value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), _jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('permissions.amend.reason'), value: why, onChange: (e) => setWhy(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !why.trim() || !day || !from || !to, onClick: () => void save(), children: t('permissions.amend.save') }), _jsx(Button, { onClick: onClose, children: t('common.back') })] })] }) }));
}
function PermissionCancelDialog({ onClose, onCancel }) {
    const { t } = useTranslation();
    const [reason, setReason] = useState('');
    const [error, setError] = useState(null);
    return (_jsx(Dialog, { open: true, onClose: onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('permissions.amend.cancelAction') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Typography, { sx: { fontSize: 13 }, children: t('permissions.amend.cancelHint') }), _jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('permissions.amend.reason'), value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", color: "error", disabled: !reason.trim(), onClick: () => void onCancel(reason.trim()).catch((f) => setError(errorKey(f))), children: t('permissions.amend.cancelAction') }), _jsx(Button, { onClick: onClose, children: t('common.back') })] })] }) }));
}
