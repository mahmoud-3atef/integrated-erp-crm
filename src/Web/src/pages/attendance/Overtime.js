import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreTimeOutlinedIcon from '@mui/icons-material/MoreTimeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { attendanceApi, hm } from '../../api/attendance';
import { staffApi } from '../../api/staff';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval, ShownStatus } from '../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { localRef } from './AttendanceMonthPage';
import { DateField } from '../../components/DateField';
export const overtimeLook = {
    InApproval: { color: hr.primary, tint: '#EFF6FF' },
    Returned: { color: '#B45309', tint: '#FEF3C7' },
    Rejected: { color: '#B91C1C', tint: '#FEE2E2' },
    Approved: { color: hr.success, tint: '#D1FAE5' },
    Cancelled: { color: '#B91C1C', tint: '#FEE2E2' },
};
export function OvertimeBadge({ status }) {
    const { t } = useTranslation();
    return _jsx(HrStatusBadge, { label: t(`overtime.status.${status}`), ...overtimeLook[status] });
}
/** Requesting overtime, sending a returned request again, or (amend) changing an approved one with the reason. */
export function OvertimeDialog({ request, amend = false, onClose, onSent }) {
    const [amendReason, setAmendReason] = useState('');
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [employee, setEmployee] = useState(request ? { id: request.employeeId, nameAr: request.employeeName, nameEn: request.employeeName } : null);
    const [options, setOptions] = useState([]);
    const [search, setSearch] = useState('');
    const [day, setDay] = useState(request?.date ?? new Date().toISOString().slice(0, 10));
    const [hours, setHours] = useState(request ? String(request.minutes / 60) : '2');
    const [reason, setReason] = useState(request?.reason ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (request)
            return;
        const timer = setTimeout(() => staffApi.pick(search).then(setOptions).catch(() => setOptions([])), 250);
        return () => clearTimeout(timer);
    }, [search, request]);
    const minutes = Math.round(Number(hours) * 60);
    const send = async () => {
        if (!employee)
            return;
        setBusy(true);
        setError(null);
        try {
            const input = { employeeId: employee.id, date: day, minutes, reason: reason.trim() };
            if (request && amend) {
                await attendanceApi.amendOvertime(request.id, { date: day, minutes, reason: reason.trim(), amendReason: amendReason.trim() });
                onSent(request.id);
                return;
            }
            const r = request ? await attendanceApi.resubmitOvertime(request.id, input) : await attendanceApi.requestOvertime(input);
            onSent(r.id);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: request ? (amend ? t('overtime.amend.title', { no: request.requestNo }) : request.requestNo) : t('overtime.new') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Autocomplete, { size: "small", disabled: Boolean(request), options: options, value: employee, onChange: (_, v) => setEmployee(v), onInputChange: (_, v) => setSearch(v), getOptionLabel: (o) => localRef(o, ar), isOptionEqualToValue: (a, b) => a.id === b.id, filterOptions: (x) => x, renderInput: (params) => _jsx(TextField, { ...params, required: true, label: t('overtime.employee') }) }), _jsxs(Stack, { direction: "row", sx: { gap: 1 }, children: [_jsx(DateField, { size: "small", fullWidth: true, label: t('overtime.date'), value: day, onChange: (e) => setDay(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { size: "small", fullWidth: true, type: "number", label: t('overtime.hours'), value: hours, onChange: (e) => setHours(e.target.value), slotProps: { htmlInput: { min: 0.25, max: 12, step: 0.25 } } })] }), _jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('overtime.reason'), value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), _jsx(Alert, { severity: "info", sx: { py: 0 }, children: amend ? t('overtime.amend.hint') : t('overtime.hint') }), amend && (_jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('overtime.amend.reason'), value: amendReason, onChange: (e) => setAmendReason(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } })), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", startIcon: amend ? _jsx(EditNoteOutlinedIcon, {}) : _jsx(SendOutlinedIcon, {}), disabled: busy || !employee || !reason.trim() || !(minutes >= 15) || (amend && !amendReason.trim()), onClick: () => void send(), children: amend ? t('overtime.amend.save') : t('overtime.send') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
/** The month's overtime requests (the month page's tab). */
export function OvertimeList({ list, onOpen }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    if (!list)
        return _jsx(LinearProgress, {});
    if (list.length === 0)
        return _jsx(HrEmptyState, { icon: _jsx(MoreTimeOutlinedIcon, {}), title: t('overtime.none'), hint: t('overtime.noneHint') });
    return (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('overtime.cols.no') }), _jsx(TableCell, { children: t('overtime.employee') }), _jsx(TableCell, { children: t('overtime.date') }), _jsx(TableCell, { children: t('overtime.hours') }), _jsx(TableCell, { children: t('overtime.reason') }), _jsx(TableCell, { children: t('overtime.cols.status') }), _jsx(TableCell, { children: t('overtime.cols.by') })] }) }), _jsx(TableBody, { children: list.map((o) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => onOpen(o.id), children: [_jsx(TableCell, { sx: { fontWeight: 700 }, children: _jsx("bdi", { children: o.requestNo }) }), _jsx(TableCell, { children: o.employeeName }), _jsx(TableCell, { children: date(o.date) }), _jsx(TableCell, { children: _jsx("bdi", { children: hm(o.minutes) }) }), _jsx(TableCell, { sx: { maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: o.reason }), _jsx(TableCell, { children: _jsx(OvertimeBadge, { status: o.status }) }), _jsx(TableCell, { children: o.createdByName })] }, o.id))) })] }) }));
}
/** An overtime request: its approval bar, its details, and «send again» once returned. */
export function OvertimePage() {
    const { id = '' } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const [o, setO] = useState(null);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(false);
    const [amending, setAmending] = useState(false);
    const [cancelling, setCancelling] = useState(null);
    const approval = useRecordApproval(o?.approval?.instanceId);
    useCrumb(o?.requestNo, `/hr/overtime/${id}`);
    const reload = useCallback(async () => {
        try {
            setO(await attendanceApi.overtime(id));
            setError(null);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    if (!o) {
        return (_jsxs(HrScope, { children: [_jsx(ErrorMessage, { messageKey: error }), !error && _jsx(LinearProgress, {})] }));
    }
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(MoreTimeOutlinedIcon, {}), title: t('overtime.title'), status: _jsx(ShownStatus, { approval: approval.detail, children: _jsx(OvertimeBadge, { status: o.status }) }), reference: o.requestNo, subtitle: _jsxs(_Fragment, { children: [o.employeeName, " \u00B7 ", _jsx("bdi", { children: date(o.date) }), " \u00B7 ", _jsx("bdi", { children: hm(o.minutes) })] }), actions: _jsxs(_Fragment, { children: [o.status === 'Returned' && can('attendance.manage', true) && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), onClick: () => setEditing(true), children: t('overtime.resubmit') })), o.canAmend && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditNoteOutlinedIcon, {}), onClick: () => setAmending(true), children: t('overtime.amend.action') })), o.canCancelApproved && (_jsx(Button, { variant: "outlined", color: "error", startIcon: _jsx(CancelOutlinedIcon, {}), onClick: () => setCancelling(''), children: t('overtime.amend.cancelAction') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') } }), onClick: () => navigate(-1), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), o.approval && (_jsx(ApprovalBar, { status: o.approval, detail: approval.detail, onChanged: () => {
                    void reload();
                    void approval.reload();
                } })), o.amendedAt && o.status === 'Approved' && (_jsxs(Alert, { severity: "info", sx: { mb: 1.5 }, children: [t('overtime.amend.amendedBy', { by: o.amendedByName, date: date(o.amendedAt) }), " \u2014 ", o.amendNote] })), o.canceledAt && (_jsx(Alert, { severity: "warning", sx: { mb: 1.5 }, children: t('overtime.amend.canceledBy', { by: o.canceledByName, date: date(o.canceledAt) }) })), o.lastComment && o.status !== 'Approved' && (_jsx(Alert, { severity: o.status === 'Rejected' ? 'error' : 'warning', sx: { mb: 1.5 }, children: o.lastComment })), _jsxs(Box, { sx: { ...hrCard, p: 2, display: 'grid', gap: 1.25, maxWidth: 760 }, children: [[
                        [t('overtime.employee'), o.employeeName],
                        [t('overtime.date'), date(o.date)],
                        [t('overtime.hours'), hm(o.minutes)],
                        [t('overtime.reason'), o.reason],
                        [t('overtime.requested'), _jsxs(_Fragment, { children: [o.createdByName, " \u00B7 ", _jsx("bdi", { children: date(o.createdAt) })] })],
                    ].map(([k, v]) => (_jsxs(Stack, { direction: "row", sx: { gap: 2, borderBottom: `1px solid #EEF2F7`, pb: 1 }, children: [_jsx(Typography, { sx: { width: 140, flex: '0 0 auto', color: hr.textMuted, fontSize: 13 }, children: k }), _jsx(Typography, { sx: { fontWeight: 600, fontSize: 13.5 }, children: typeof v === 'string' ? _jsx("bdi", { children: v }) : v })] }, k))), _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: t('overtime.factor') })] }), amending && (_jsx(OvertimeDialog, { request: o, amend: true, onClose: () => setAmending(false), onSent: () => {
                    setAmending(false);
                    void reload();
                } })), cancelling !== null && (_jsx(Dialog, { open: true, onClose: () => setCancelling(null), maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('overtime.amend.cancelAction') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Typography, { sx: { fontSize: 13 }, children: t('overtime.amend.cancelHint') }), _jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('overtime.amend.reason'), value: cancelling, onChange: (e) => setCancelling(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", color: "error", disabled: !cancelling.trim(), onClick: () => void attendanceApi
                                        .cancelApprovedOvertime(o.id, cancelling.trim())
                                        .then(() => (setCancelling(null), reload()))
                                        .catch((f) => (setCancelling(null), setError(errorKey(f)))), children: t('overtime.amend.cancelAction') }), _jsx(Button, { onClick: () => setCancelling(null), children: t('common.back') })] })] }) })), editing && (_jsx(OvertimeDialog, { request: o, onClose: () => setEditing(false), onSent: () => {
                    setEditing(false);
                    void reload();
                    void approval.reload();
                } }))] }));
}
/** /hr/attendance/months/:id (the approval inbox's link): to the month's page. */
export function AttendanceMonthLink() {
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    useEffect(() => {
        attendanceApi
            .monthPeriod(id)
            .then((r) => navigate(`/hr/attendance?period=${r.period}`, { replace: true }))
            .catch((failure) => setError(errorKey(failure)));
    }, [id, navigate]);
    return (_jsxs(HrScope, { children: [_jsx(ErrorMessage, { messageKey: error }), !error && _jsx(LinearProgress, {})] }));
}
