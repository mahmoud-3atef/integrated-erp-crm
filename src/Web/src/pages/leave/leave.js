import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { Alert, Autocomplete, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { daysText, leaveApi } from '../../api/leave';
import { staffApi } from '../../api/staff';
import { hm } from '../../api/attendance';
import { PermissionDialog, PermissionsTable } from './permissions';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrScope, HrStatusBadge, hr } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { DateField } from '../../components/DateField';
export const leaveLook = {
    InApproval: { color: hr.primary, tint: '#EFF6FF' },
    Returned: { color: '#B45309', tint: '#FEF3C7' },
    Rejected: { color: '#B91C1C', tint: '#FEE2E2' },
    Approved: { color: hr.success, tint: '#D1FAE5' },
    Cancelled: { color: hr.textMuted, tint: hr.muted },
};
export function LeaveStatusBadge({ status }) {
    const { t } = useTranslation();
    return _jsx(HrStatusBadge, { label: t(`leave.status.${status}`), ...leaveLook[status] });
}
export const typeName = (r, ar) => 'typeAr' in r ? (ar ? r.typeAr : r.typeEn) : ar ? r.nameAr : r.nameEn;
function usePeople(search, enabled = true) {
    const [options, setOptions] = useState([]);
    useEffect(() => {
        if (!enabled)
            return;
        const timer = setTimeout(() => staffApi.pick(search).then(setOptions).catch(() => setOptions([])), 250);
        return () => clearTimeout(timer);
    }, [search, enabled]);
    return options;
}
/**
 * A leave request (or a returned one sent again): employee, type and period, with a live preview — the days as the type
 * counts them, the balance before and after, the return day, the sick tiers, who approves first — before sending.
 */
export function LeaveRequestDialog({ employee, request, onClose, onSent, }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { date } = useCommercialFormat();
    const [types, setTypes] = useState([]);
    const [who, setWho] = useState(employee ?? (request ? { id: request.input.employeeId, nameAr: request.employeeName, nameEn: request.employeeName } : null));
    const [search, setSearch] = useState('');
    const people = usePeople(search, !employee && !request);
    const [typeId, setTypeId] = useState(request?.input.leaveTypeId ?? '');
    const today = new Date().toISOString().slice(0, 10);
    const [from, setFrom] = useState(request?.input.from ?? today);
    const [to, setTo] = useState(request?.input.to ?? today);
    const [reason, setReason] = useState(request?.input.reason ?? '');
    const [substitute, setSubstitute] = useState(null);
    const [subSearch, setSubSearch] = useState('');
    const subs = usePeople(subSearch);
    const [ticket, setTicket] = useState(request?.input.ticket ?? false);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        leaveApi
            .setup()
            .then((s) => {
            const active = s.types.filter((x) => x.isActive);
            setTypes(active);
            setTypeId((v) => v || (active.find((x) => x.code === 'annual')?.id ?? active[0]?.id ?? ''));
        })
            .catch(() => setTypes([]));
    }, []);
    const input = who && typeId && from && to ? { employeeId: who.id, leaveTypeId: typeId, from, to, reason: reason.trim() || null, substituteId: substitute?.id ?? null, ticket } : null;
    const key = input ? `${input.employeeId}|${input.leaveTypeId}|${input.from}|${input.to}` : '';
    useEffect(() => {
        if (!input) {
            setPreview(null);
            return;
        }
        const timer = setTimeout(() => {
            leaveApi
                .preview(input, request?.id)
                .then((p) => (setPreview(p), setError(null)))
                .catch((failure) => (setPreview(null), setError(errorKey(failure))));
        }, 250);
        return () => clearTimeout(timer);
    }, [key]);
    const type = types.find((x) => x.id === typeId);
    const send = async () => {
        if (!input)
            return;
        setBusy(true);
        setError(null);
        try {
            const r = request ? await leaveApi.resubmit(request.id, input) : await leaveApi.send(input);
            onSent(r.id);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "md", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: request ? t('leave.resubmitTitle') : t('leave.new') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }, children: [_jsx(Autocomplete, { size: "small", disabled: Boolean(employee || request), options: people, value: who, onChange: (_, v) => setWho(v), onInputChange: (_, v) => setSearch(v), getOptionLabel: (o) => (ar ? o.nameAr : o.nameEn), isOptionEqualToValue: (a, b) => a.id === b.id, filterOptions: (x) => x, renderInput: (params) => _jsx(TextField, { ...params, required: true, label: t('leave.employee') }) }), _jsx(TextField, { select: true, size: "small", required: true, label: t('leave.type'), value: typeId, onChange: (e) => setTypeId(e.target.value), children: types.map((x) => (_jsxs(MenuItem, { value: x.id, children: [typeName(x, ar), " \u00B7 ", t(`leave.pay.${x.pay}`)] }, x.id))) }), _jsx(DateField, { size: "small", required: true, label: t('leave.from'), value: from, onChange: (e) => (setFrom(e.target.value), to < e.target.value && setTo(e.target.value)), slotProps: { inputLabel: { shrink: true } } }), _jsx(DateField, { size: "small", required: true, label: t('leave.to'), value: to, onChange: (e) => setTo(e.target.value), slotProps: { inputLabel: { shrink: true } } })] }), _jsx(Box, { sx: { bgcolor: '#F8FAFC', border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.5 }, children: !input ? (_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('leave.preview.pick') })) : !preview ? (_jsx(LinearProgress, {})) : (_jsxs(_Fragment, { children: [_jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }, children: [
                                            [t('leave.preview.days'), daysText(preview.days), hr.text],
                                            [t('leave.preview.available'), preview.available === null ? '—' : daysText(preview.available), hr.text],
                                            [t('leave.preview.after'), preview.after === null ? '—' : daysText(preview.after), preview.after !== null && preview.after < 0 ? hr.danger : hr.success],
                                            [t('leave.preview.returns'), date(preview.returnsOn), hr.text],
                                        ].map(([l, v, c]) => (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: l }), _jsx(Typography, { sx: { fontWeight: 700, fontSize: 18, color: c, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: v }) })] }, l))) }), _jsxs(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 0.75 }, children: [t(`leave.preview.counted.${preview.dayCount}`, { days: preview.calendarDays }), preview.sick && ` · ${t('leave.preview.sick', { full: daysText(preview.sick.full), part: daysText(preview.sick.threeQuarters), unpaid: daysText(preview.sick.unpaid) })}`] }), preview.problems.map((p) => (_jsx(Alert, { severity: "error", sx: { mt: 1, py: 0 }, children: t(`leave.problems.${p}`) }, p)))] })) }), _jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }, children: [_jsx(Autocomplete, { size: "small", options: subs.filter((p) => p.id !== who?.id), value: substitute, onChange: (_, v) => setSubstitute(v), onInputChange: (_, v) => setSubSearch(v), getOptionLabel: (o) => (ar ? o.nameAr : o.nameEn), isOptionEqualToValue: (a, b) => a.id === b.id, filterOptions: (x) => x, renderInput: (params) => _jsx(TextField, { ...params, label: t('leave.substitute') }) }), _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: ticket, onChange: (e) => setTicket(e.target.checked) }), label: t('leave.ticket') })] }), _jsx(TextField, { size: "small", multiline: true, minRows: 2, label: t('leave.reason'), value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), type?.needsAttachment && _jsx(Alert, { severity: "warning", sx: { py: 0 }, children: t('leave.attachmentNote') }), preview && (_jsx(Alert, { severity: "info", sx: { py: 0 }, children: preview.managerLinked ? t('leave.route.manager', { name: preview.managerName }) : preview.managerName ? t('leave.route.notLinked', { name: preview.managerName }) : t('leave.route.hr') })), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), disabled: busy || !preview || preview.problems.length > 0, onClick: () => void send(), children: t('leave.send') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
/** An opening balance or an adjustment for an employee and a balance type (an entry, with its reason). */
export function EntryDialog({ employeeId, kind, types, onClose, onSaved }) {
    const { t } = useTranslation();
    const [typeId, setTypeId] = useState(types[0]?.id ?? '');
    const [date, setDate] = useState(kind === 'opening' ? `${new Date().getFullYear()}-01-01` : new Date().toISOString().slice(0, 10));
    const [days, setDays] = useState('');
    const [reason, setReason] = useState(kind === 'opening' ? t('leave.entry.openingReason') : '');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const input = { leaveTypeId: typeId, date, days: Number(days), reason: reason.trim() };
            if (kind === 'opening')
                await leaveApi.opening(employeeId, input);
            else
                await leaveApi.adjustment(employeeId, input);
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t(`leave.entry.${kind}`) }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t(`leave.entry.${kind}Hint`) }), _jsx(TextField, { select: true, size: "small", label: t('leave.type'), value: typeId, onChange: (e) => setTypeId(e.target.value), children: types.map((x) => (_jsx(MenuItem, { value: x.id, children: x.name }, x.id))) }), _jsxs(Stack, { direction: "row", sx: { gap: 1 }, children: [_jsx(DateField, { size: "small", fullWidth: true, label: t(kind === 'opening' ? 'leave.entry.asOf' : 'leave.entry.date'), value: date, onChange: (e) => setDate(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { size: "small", fullWidth: true, type: "number", label: t('leave.entry.days'), value: days, onChange: (e) => setDays(e.target.value), helperText: kind === 'adjustment' ? t('leave.entry.signHint') : ' ', slotProps: { htmlInput: { step: 0.25 } } })] }), _jsx(TextField, { size: "small", required: true, label: t('leave.reason'), value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 300 } } }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !typeId || !days || Number(days) === 0 || !reason.trim(), onClick: () => void save(), children: t('common.save') }), _jsx(Button, { onClick: onClose, children: t('common.cancel') })] })] }) }));
}
/** An employee's leave: each type's balance, the actions (request, opening balance, adjustment), the entries and the requests. */
export function EmployeeLeavePanel({ employee, onChanged }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { date } = useCommercialFormat();
    const { can } = useSession();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [version, setVersion] = useState(0);
    const [dialog, setDialog] = useState(null);
    const canManage = can('leave.manage', true);
    useEffect(() => {
        leaveApi
            .employee(employee.id)
            .then((d) => (setData(d), setError(null)))
            .catch((failure) => setError(errorKey(failure)));
    }, [employee.id, version]);
    const changed = () => {
        setDialog(null);
        setVersion((v) => v + 1);
        onChanged?.();
    };
    if (!data)
        return error ? _jsx(ErrorMessage, { messageKey: error }) : _jsx(LinearProgress, {});
    const balanceTypes = data.balances.filter((b) => b.hasBalance).map((b) => ({ id: b.leaveTypeId, name: typeName(b, ar) }));
    const kindColor = (d) => (d > 0 ? hr.success : d < 0 ? '#B91C1C' : hr.textMuted);
    return (_jsxs(HrScope, { children: [_jsxs(Stack, { sx: { gap: 1.75 }, children: [canManage && (_jsxs(Stack, { direction: "row", sx: { gap: 1, flexWrap: 'wrap' }, children: [_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setDialog('request'), children: t('leave.new') }), _jsx(Button, { variant: "outlined", onClick: () => setDialog('permission'), children: t('permissions.new') }), _jsx(Button, { variant: "outlined", onClick: () => setDialog('opening'), disabled: balanceTypes.length === 0, children: t('leave.entry.opening') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(TuneOutlinedIcon, {}), onClick: () => setDialog('adjustment'), disabled: balanceTypes.length === 0, children: t('leave.entry.adjustment') })] })), _jsxs(Box, { sx: { display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }, children: [data.balances.map((b) => (_jsxs(Box, { sx: { border: `1px solid ${hr.border}`, borderRadius: '12px', p: 1.5, bgcolor: b.hasBalance ? '#ECFDF5' : '#fff' }, children: [_jsx(Typography, { sx: { fontWeight: 700 }, children: typeName(b, ar) }), _jsxs(Typography, { sx: { fontSize: 24, fontWeight: 700, color: b.available < 0 ? hr.danger : b.hasBalance ? hr.success : hr.text, fontVariantNumeric: 'tabular-nums' }, children: [_jsx("bdi", { children: daysText(b.available) }), " ", _jsx(Box, { component: "span", sx: { fontSize: 12, color: hr.textMuted, fontWeight: 500 }, children: t('leave.daysAvailable') })] }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: b.hasBalance
                                            ? t('leave.balanceLine', { perYear: daysText(b.perYear), accrued: daysText(b.accruedThisYear), used: daysText(b.usedThisYear), reserved: daysText(b.reserved) })
                                            : t('leave.limitLine', { limit: daysText(b.yearLimit ?? 0), used: daysText(b.usedThisYear) }) })] }, b.leaveTypeId))), _jsxs(Box, { sx: { border: `1px solid ${hr.border}`, borderRadius: '12px', p: 1.5, bgcolor: '#FFFBEB' }, children: [_jsx(Typography, { sx: { fontWeight: 700 }, children: t('permissions.monthTitle') }), _jsxs(Typography, { sx: { fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }, children: [_jsx("bdi", { children: hm(Math.max(0, data.permissionAllowance - data.permissionUsedThisMonth)) }), " ", _jsx(Box, { component: "span", sx: { fontSize: 12, color: hr.textMuted, fontWeight: 500 }, children: t('permissions.left') })] }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: t('permissions.monthLine', { used: hm(data.permissionUsedThisMonth), allowance: hm(data.permissionAllowance) }) })] })] }), _jsx(Typography, { sx: { fontWeight: 700 }, children: t('leave.requestsTitle') }), _jsx(RequestsTable, { rows: data.requests, showEmployee: false, onOpen: (id) => navigate(`/hr/leave/${id}`) }), _jsx(Typography, { sx: { fontWeight: 700 }, children: t('permissions.listTitle') }), _jsx(PermissionsTable, { rows: data.permissions ?? [], showEmployee: false, onOpen: (id) => navigate(`/hr/permissions/${id}`) }), _jsx(Typography, { sx: { fontWeight: 700 }, children: t('leave.entriesTitle') }), data.entries.length === 0 ? (_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('leave.noEntries') })) : (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 360 }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: { '& td': { fontVariantNumeric: 'tabular-nums' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('leave.cols.date') }), _jsx(TableCell, { children: t('leave.type') }), _jsx(TableCell, { children: t('leave.cols.entry') }), _jsx(TableCell, { children: t('leave.cols.days') }), _jsx(TableCell, { children: t('leave.cols.balance') }), _jsx(TableCell, { children: t('leave.cols.by') })] }) }), _jsx(TableBody, { children: data.entries.map((e) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: date(e.date) }), _jsx(TableCell, { children: balanceTypes.find((x) => x.id === e.leaveTypeId)?.name ?? '—' }), _jsxs(TableCell, { children: [t(`leave.entryKind.${e.kind}`), " \u00B7 ", e.requestNo ? _jsx("bdi", { children: e.requestNo }) : e.reason] }), _jsx(TableCell, { sx: { color: kindColor(e.days), fontWeight: 700 }, children: _jsx("bdi", { children: e.days > 0 ? `+${daysText(e.days)}` : daysText(e.days) }) }), _jsx(TableCell, { children: daysText(e.running) }), _jsx(TableCell, { children: e.createdByName })] }, e.id))) })] }) }))] }), dialog === 'permission' && _jsx(PermissionDialog, { employee: employee, onClose: () => setDialog(null), onSent: (id) => navigate(`/hr/permissions/${id}`) }), dialog === 'request' && _jsx(LeaveRequestDialog, { employee: employee, onClose: () => setDialog(null), onSent: (id) => navigate(`/hr/leave/${id}`) }), (dialog === 'opening' || dialog === 'adjustment') && _jsx(EntryDialog, { employeeId: employee.id, kind: dialog, types: balanceTypes, onClose: () => setDialog(null), onSaved: changed })] }));
}
/** Leave requests as a table. */
export function RequestsTable({ rows, showEmployee = true, onOpen }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { date } = useCommercialFormat();
    if (rows.length === 0)
        return _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('leave.none') });
    return (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [showEmployee && _jsx(TableCell, { children: t('leave.employee') }), _jsx(TableCell, { children: t('leave.cols.no') }), _jsx(TableCell, { children: t('leave.type') }), _jsx(TableCell, { children: t('leave.from') }), _jsx(TableCell, { children: t('leave.to') }), _jsx(TableCell, { children: t('leave.cols.days') }), _jsx(TableCell, { children: t('leave.cols.status') })] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => onOpen(r.id), children: [showEmployee && (_jsxs(TableCell, { children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 13 }, children: r.employeeName }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: (ar ? r.departmentAr : r.departmentEn) ?? '' })] })), _jsx(TableCell, { sx: { fontWeight: 700 }, children: _jsx(RouterLink, { to: `/hr/leave/${r.id}`, onClick: (e) => e.stopPropagation(), style: { color: 'inherit', textDecoration: 'none' }, children: _jsx("bdi", { children: r.requestNo }) }) }), _jsx(TableCell, { children: typeName(r, ar) }), _jsx(TableCell, { children: date(r.from) }), _jsx(TableCell, { children: date(r.to) }), _jsx(TableCell, { children: daysText(r.days) }), _jsx(TableCell, { children: _jsx(LeaveStatusBadge, { status: r.status }) })] }, r.id))) })] }) }));
}
