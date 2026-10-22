import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import Add from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { Alert, Autocomplete, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, InputAdornment, LinearProgress, MenuItem, Skeleton, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { periodOf } from '../../api/attendance';
import { errorKey } from '../../api/auth';
import { deductionsApi } from '../../api/deductions';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useMonthName } from '../attendance/AttendanceMonthPage';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { Money, NoteDialog, usePeople, usePeriods } from './advances';
import { DateField } from '../../components/DateField';
const look = {
    InApproval: { color: hr.primary, tint: '#EFF6FF' },
    Returned: { color: '#B45309', tint: '#FEF3C7' },
    Rejected: { color: '#B91C1C', tint: '#FEE2E2' },
    Applied: { color: hr.success, tint: '#D1FAE5' },
    Cancelled: { color: '#B91C1C', tint: '#FEE2E2' },
};
export function PenaltyStatusBadge({ status }) {
    const { t } = useTranslation();
    return _jsx(HrStatusBadge, { label: t(`deductions.penaltyStatus.${status}`), ...look[status] });
}
/** What the penalty takes: a warning, days of wage, an amount, or days of suspension. */
export function PenaltyValue({ row }) {
    const { t } = useTranslation();
    if (row.effect === 'Warning')
        return _jsx(_Fragment, { children: t('deductions.penalty.noDeduction') });
    if (row.effect === 'DeductAmount')
        return _jsx(Money, { value: row.amount, strong: true });
    return _jsx("bdi", { children: t(row.effect === 'Suspension' ? 'deductions.penalty.suspensionValue' : 'deductions.penalty.daysValue', { days: row.days ?? 0 }) });
}
const kindName = (r, t, ar) => (r.category === 'Other' ? t('deductions.other.kind') : ((ar ? r.typeAr : r.typeEn) ?? t(`deductions.effects.${r.effect}`)));
/**
 * A violation and its penalty (the type gives the effect: a warning, days of wage, an amount, a suspension) or another
 * deduction (damage, lost custody): the employee, the date, the description and the employee's statement, the payroll
 * month, with the legal limits and the month's deductions shown before sending.
 */
/** A new penalty or deduction, a returned one sent again, or (amend) an applied one changed before it is deducted, with the reason. */
export function PenaltyDialog({ category, employee, penalty, amend = false, onClose, onSent, }) {
    const [amendReason, setAmendReason] = useState('');
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const monthName = useMonthName();
    const p = penalty?.penalty;
    const other = category === 'Other';
    const [who, setWho] = useState(employee ?? (p ? { id: p.employeeId, nameAr: p.employeeName, nameEn: p.employeeName } : null));
    const [search, setSearch] = useState('');
    const people = usePeople(search, !employee && !penalty);
    const [types, setTypes] = useState([]);
    const [typeId, setTypeId] = useState('');
    const [day, setDay] = useState(p?.violationDate ?? new Date().toISOString().slice(0, 10));
    const [description, setDescription] = useState(p?.description ?? '');
    const [statement, setStatement] = useState(penalty?.statement ?? '');
    const [days, setDays] = useState(p?.days ? String(p.days) : '1');
    const [amount, setAmount] = useState(p?.amount ? String(p.amount) : '');
    const periods = usePeriods(p?.period);
    const [period, setPeriod] = useState(p?.period ?? periodOf(new Date()));
    const [aboveCap, setAboveCap] = useState(p?.aboveCap ?? false);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (other)
            return;
        deductionsApi
            .setup()
            .then((s) => {
            const active = s.penaltyTypes.filter((x) => x.isActive);
            setTypes(active);
            const current = p ? active.find((x) => x.id === p.penaltyTypeId) : undefined;
            setTypeId((current ?? active.find((x) => x.effect === 'DeductDays') ?? active[0])?.id ?? '');
        })
            .catch(() => setTypes([]));
    }, [other]);
    const effect = other ? 'DeductAmount' : (types.find((x) => x.id === typeId)?.effect ?? null);
    const needsDays = effect === 'DeductDays' || effect === 'Suspension';
    const needsAmount = effect === 'DeductAmount';
    const input = who && day && effect
        ? {
            employeeId: who.id,
            category,
            penaltyTypeId: other ? null : typeId,
            violationDate: day,
            description: description.trim(),
            statement: statement.trim() || null,
            days: needsDays ? Number(days) || null : null,
            amount: needsAmount ? Number(amount) || null : null,
            period,
            aboveCap,
        }
        : null;
    const key = input ? JSON.stringify({ ...input, description: input.description !== '', statement: null }) : '';
    useEffect(() => {
        if (!input) {
            setPreview(null);
            return;
        }
        const timer = setTimeout(() => {
            deductionsApi
                .previewPenalty({ ...input, description: input.description || '—' }, p?.id)
                .then((x) => (setPreview(x), setError(null)))
                .catch((f) => (setPreview(null), setError(errorKey(f))));
        }, 300);
        return () => clearTimeout(timer);
    }, [key]);
    const send = async () => {
        if (!input)
            return;
        setBusy(true);
        setError(null);
        try {
            if (p && amend) {
                const { employeeId: _employee, category: _category, ...fields } = input;
                await deductionsApi.amendPenalty(p.id, { ...fields, amendReason: amendReason.trim() });
                onSent(p.id);
                return;
            }
            const r = p ? await deductionsApi.resubmitPenalty(p.id, input) : await deductionsApi.sendPenalty(input);
            onSent(r.id);
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    const blocking = preview?.problems.filter((x) => x !== 'above_cap') ?? [];
    const canSend = Boolean(input && description.trim() && preview && blocking.length === 0 && (preview.needsAboveCap.length === 0 || aboveCap));
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "sm", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: p ? (amend ? t('deductions.amend.penaltyTitle', { no: p.penaltyNo }) : p.penaltyNo) : other ? t('deductions.other.new') : t('deductions.penalty.new') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }, children: [_jsx(Autocomplete, { size: "small", disabled: Boolean(employee || penalty), options: people, value: who, onChange: (_, v) => setWho(v), onInputChange: (_, v) => setSearch(v), getOptionLabel: (o) => (ar ? o.nameAr : o.nameEn), isOptionEqualToValue: (x, y) => x.id === y.id, filterOptions: (x) => x, renderInput: (params) => _jsx(TextField, { ...params, required: true, label: t('deductions.employee') }) }), _jsx(DateField, { size: "small", required: true, label: other ? t('deductions.other.date') : t('deductions.penalty.date'), value: day, onChange: (e) => setDay(e.target.value), slotProps: { inputLabel: { shrink: true } } })] }), _jsx(TextField, { size: "small", required: true, label: other ? t('deductions.other.description') : t('deductions.penalty.description'), value: description, onChange: (e) => setDescription(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), !other && _jsx(TextField, { size: "small", multiline: true, minRows: 2, label: t('deductions.penalty.statement'), value: statement, onChange: (e) => setStatement(e.target.value), slotProps: { htmlInput: { maxLength: 1000 } } }), _jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: other ? '1fr 1fr' : '1fr 1fr 1fr' } }, children: [!other && (_jsx(TextField, { select: true, size: "small", required: true, label: t('deductions.penalty.type'), value: typeId, onChange: (e) => setTypeId(e.target.value), children: types.map((x) => (_jsx(MenuItem, { value: x.id, children: ar ? x.nameAr : x.nameEn }, x.id))) })), needsDays && (_jsx(TextField, { size: "small", required: true, type: "number", label: effect === 'Suspension' ? t('deductions.penalty.suspensionDays') : t('deductions.penalty.daysLabel'), value: days, onChange: (e) => setDays(e.target.value), slotProps: { htmlInput: { min: 0.5, step: 0.5, dir: 'ltr' } } })), needsAmount && (_jsx(TextField, { size: "small", required: true, type: "number", label: t('deductions.penalty.amount'), value: amount, onChange: (e) => setAmount(e.target.value), slotProps: { htmlInput: { min: 1, step: '0.01', dir: 'ltr' }, input: { endAdornment: _jsx(InputAdornment, { position: "end", children: t('deductions.sar') }) } } })), effect !== 'Warning' && (_jsx(TextField, { select: true, size: "small", label: t('deductions.penalty.period'), value: period, onChange: (e) => setPeriod(e.target.value), children: periods.map((x) => (_jsx(MenuItem, { value: x, children: monthName(x) }, x))) }))] }), input && (_jsx(Box, { sx: { bgcolor: '#F8FAFC', border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.5 }, children: !preview ? (_jsx(LinearProgress, {})) : (_jsxs(_Fragment, { children: [_jsx(Typography, { sx: { fontSize: 12.5 }, children: effect === 'Warning'
                                            ? t('deductions.penalty.warningNote')
                                            : effect === 'DeductDays'
                                                ? t('deductions.penalty.limits', { perViolation: preview.maxDaysPerViolation, perMonth: preview.maxDaysPerMonth, used: preview.daysThisMonth, month: monthName(period) })
                                                : t('deductions.penalty.inMonth', { month: monthName(period) }) }), preview.monthCap !== null && preview.monthDeductions !== null && effect !== 'Warning' && (_jsxs(Typography, { component: "div", sx: { fontSize: 12, color: hr.textMuted, mt: 0.5 }, children: [t('deductions.penalty.monthTotal'), " ", _jsx(Money, { value: preview.monthDeductions }), " / ", _jsx(Money, { value: preview.monthCap })] })), blocking.map((x) => (_jsx(Alert, { severity: "error", sx: { mt: 1, py: 0 }, children: t(`deductions.penalty.problems.${x}`) }, x))), preview.needsAboveCap.length > 0 && (_jsxs(Alert, { severity: "warning", sx: { mt: 1, py: 0, '& .MuiAlert-message': { width: '100%' } }, children: [t('deductions.aboveCap.month_cap'), _jsx(FormControlLabel, { sx: { display: 'flex', mt: 0.25 }, control: _jsx(Checkbox, { size: "small", checked: aboveCap, onChange: (e) => setAboveCap(e.target.checked) }), label: t('deductions.aboveCap.ask') })] }))] })) })), _jsx(Alert, { severity: "info", sx: { py: 0 }, children: amend ? t('deductions.amend.penaltyHint') : other ? t('deductions.other.route') : t('deductions.penalty.route') }), amend && (_jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('deductions.amend.reason'), value: amendReason, onChange: (e) => setAmendReason(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } })), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", startIcon: amend ? _jsx(EditNoteOutlinedIcon, {}) : _jsx(SendOutlinedIcon, {}), disabled: busy || !canSend || (amend && !amendReason.trim()), onClick: () => void send(), children: amend ? t('deductions.amend.save') : t('deductions.send') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
export function PenaltiesTable({ rows, showEmployee = true, onOpen }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { date } = useCommercialFormat();
    const monthName = useMonthName();
    if (rows.length === 0)
        return _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('deductions.penalty.none') });
    return (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 46, fontVariantNumeric: 'tabular-nums' }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700, color: '#334155' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [showEmployee && _jsx(TableCell, { children: t('deductions.employee') }), _jsx(TableCell, { children: t('deductions.cols.no') }), _jsx(TableCell, { children: t('deductions.penalty.kind') }), _jsx(TableCell, { children: t('deductions.penalty.description') }), _jsx(TableCell, { children: t('deductions.cols.date') }), _jsx(TableCell, { children: t('deductions.penalty.value') }), _jsx(TableCell, { children: t('deductions.penalty.period') }), _jsx(TableCell, { children: t('deductions.cols.status') })] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => onOpen(r.id), children: [showEmployee && (_jsx(TableCell, { children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(HrAvatar, { name: r.employeeName }), _jsx(Typography, { sx: { fontWeight: 700, fontSize: 13.5 }, children: r.employeeName })] }) })), _jsx(TableCell, { sx: { fontWeight: 700 }, children: _jsx(RouterLink, { to: `/hr/penalties/${r.id}`, onClick: (e) => e.stopPropagation(), style: { color: 'inherit', textDecoration: 'none' }, children: _jsx("bdi", { children: r.penaltyNo }) }) }), _jsx(TableCell, { children: kindName(r, t, ar) }), _jsx(TableCell, { sx: { maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.description, children: r.description }), _jsx(TableCell, { children: date(r.violationDate) }), _jsx(TableCell, { children: _jsx(PenaltyValue, { row: r }) }), _jsx(TableCell, { children: r.effect === 'Warning' ? '—' : monthName(r.period) }), _jsx(TableCell, { children: _jsx(PenaltyStatusBadge, { status: r.status }) })] }, r.id))) })] }) }));
}
/** Penalties and other deductions: the tabs (all, waiting for approval, warnings, deductions) and the table. */
export function PenaltiesPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const [view, setView] = useState('all');
    const [rows, setRows] = useState(null);
    const [pending, setPending] = useState(null);
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [error, setError] = useState(null);
    const [asking, setAsking] = useState(null);
    useEffect(() => {
        const timer = setTimeout(() => setQuery(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    useEffect(() => {
        deductionsApi
            .penalties({ tab: 'pending' })
            .then((r) => setPending(r.length))
            .catch(() => setPending(null));
    }, []);
    const load = useCallback(() => {
        setRows(null);
        setError(null);
        deductionsApi
            .penalties({ tab: view, search: query })
            .then(setRows)
            .catch((f) => setError(errorKey(f)));
    }, [view, query]);
    useEffect(load, [load]);
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(BalanceOutlinedIcon, {}), title: t('deductions.penalty.title'), subtitle: t('deductions.penalty.intro'), actions: _jsxs(_Fragment, { children: [can('deductions.view', true) && (_jsx(Button, { variant: "outlined", startIcon: _jsx(SettingsOutlinedIcon, {}), onClick: () => navigate('/hr/deductions-settings'), children: t('deductions.settings.titleLimits') })), can('deductions.manage', true) && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(Add, {}), onClick: () => setAsking('Other'), children: t('deductions.other.new') }), _jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setAsking('Penalty'), children: t('deductions.penalty.new') })] }))] }) }), _jsxs(Box, { sx: { ...hrCard, px: 2, pb: 2 }, children: [_jsxs(Tabs, { value: view, onChange: (_, v) => setView(v), variant: "scrollable", sx: { borderBottom: `1px solid ${hr.border}`, mb: 1.5 }, children: [_jsx(Tab, { value: "all", label: t('deductions.penalty.tabs.all') }), _jsx(Tab, { value: "pending", label: t('deductions.penalty.tabs.pending', { count: pending ?? 0 }) }), _jsx(Tab, { value: "warnings", label: t('deductions.penalty.tabs.warnings') }), _jsx(Tab, { value: "deductions", label: t('deductions.penalty.tabs.deductions') })] }), _jsx(TextField, { size: "small", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('deductions.search'), sx: { width: { xs: '100%', md: 300 }, mb: 1.5 }, slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) }, htmlInput: { 'aria-label': t('deductions.search') } } }), error ? (_jsxs(Stack, { sx: { gap: 1, alignItems: 'flex-start' }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Button, { variant: "outlined", size: "small", onClick: load, children: t('deductions.retry') })] })) : !rows ? (_jsx(Stack, { sx: { gap: 0.75 }, children: Array.from({ length: 4 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: 42 }, i)) })) : rows.length === 0 ? (_jsx(HrEmptyState, { icon: _jsx(BalanceOutlinedIcon, {}), title: query ? t('deductions.noResults') : t('deductions.penalty.none'), hint: query ? undefined : t('deductions.penalty.noneHint') })) : (_jsx(PenaltiesTable, { rows: rows, onOpen: (id) => navigate(`/hr/penalties/${id}`) }))] }), asking && _jsx(PenaltyDialog, { category: asking, onClose: () => setAsking(null), onSent: (id) => navigate(`/hr/penalties/${id}`) })] }));
}
function Row({ label, children }) {
    return (_jsxs(Stack, { direction: "row", sx: { gap: 2, borderBottom: `1px solid #EEF2F7`, pb: 1 }, children: [_jsx(Typography, { sx: { width: 150, flex: '0 0 auto', color: hr.textMuted, fontSize: 13 }, children: label }), _jsx(Typography, { component: "div", sx: { fontWeight: 600, fontSize: 13.5, whiteSpace: 'pre-wrap' }, children: children })] }));
}
/** A penalty or another deduction: its approval bar, the violation, the statement and the decision, and «send again» once returned. */
export function PenaltyPage() {
    const { id = '' } = useParams();
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const navigate = useNavigate();
    const monthName = useMonthName();
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const [d, setD] = useState(null);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(false);
    const [amending, setAmending] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const approval = useRecordApproval(d?.approval?.instanceId);
    useCrumb(d?.penalty.penaltyNo, `/hr/penalties/${id}`);
    const reload = useCallback(async () => {
        try {
            setD(await deductionsApi.penalty(id));
            setError(null);
        }
        catch (f) {
            setError(errorKey(f));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    if (!d) {
        return (_jsxs(HrScope, { children: [_jsx(ErrorMessage, { messageKey: error }), !error && _jsx(LinearProgress, {})] }));
    }
    const p = d.penalty;
    const other = p.category === 'Other';
    const done = () => {
        setEditing(false);
        setAmending(false);
        setCancelling(false);
        void reload();
        void approval.reload();
    };
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(BalanceOutlinedIcon, {}), title: kindName(p, t, ar), status: _jsx(PenaltyStatusBadge, { status: p.status }), reference: p.penaltyNo, subtitle: _jsxs(_Fragment, { children: [_jsx(RouterLink, { to: `/hr/employees/${p.employeeId}`, children: p.employeeName }), " \u00B7 ", _jsx("bdi", { children: date(p.violationDate) })] }), actions: _jsxs(_Fragment, { children: [p.status === 'Returned' && can('deductions.manage', true) && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), onClick: () => setEditing(true), children: t('deductions.resubmit') })), d.canAmend && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditNoteOutlinedIcon, {}), onClick: () => setAmending(true), children: t('deductions.amend.action') })), d.canCancelApproved && (_jsx(Button, { variant: "outlined", color: "error", startIcon: _jsx(CancelOutlinedIcon, {}), onClick: () => setCancelling(true), children: other ? t('deductions.amend.cancelOther') : t('deductions.amend.cancelPenalty') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') } }), onClick: () => navigate(-1), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), d.approval && _jsx(ApprovalBar, { status: d.approval, detail: approval.detail, onChanged: done }), d.amendedAt && p.status === 'Applied' && (_jsxs(Alert, { severity: "info", sx: { mb: 1.5 }, children: [t('deductions.amend.amendedBy', { by: d.amendedByName, date: date(d.amendedAt) }), " \u2014 ", d.amendNote] })), d.canceledAt && (_jsxs(Alert, { severity: "warning", sx: { mb: 1.5 }, children: [t('deductions.amend.canceledBy', { by: d.canceledByName, date: date(d.canceledAt) }), " \u2014 ", d.lastComment] })), d.lastComment && (p.status === 'Returned' || p.status === 'Rejected') && (_jsx(Alert, { severity: p.status === 'Rejected' ? 'error' : 'warning', sx: { mb: 1.5 }, children: d.lastComment })), _jsxs(Box, { sx: { ...hrCard, p: 2, display: 'grid', gap: 1.25, maxWidth: 820 }, children: [_jsx(Row, { label: t('deductions.employee'), children: p.employeeName }), _jsx(Row, { label: other ? t('deductions.other.description') : t('deductions.penalty.description'), children: p.description }), !other && _jsx(Row, { label: t('deductions.penalty.statement'), children: d.statement ?? '—' }), _jsx(Row, { label: t('deductions.penalty.kind'), children: kindName(p, t, ar) }), _jsx(Row, { label: t('deductions.penalty.value'), children: _jsx(PenaltyValue, { row: p }) }), p.effect !== 'Warning' && _jsx(Row, { label: t('deductions.penalty.period'), children: monthName(p.period) }), p.aboveCap && _jsx(Row, { label: t('deductions.aboveCap.badge'), children: t('deductions.aboveCap.approved') }), _jsxs(Row, { label: t('deductions.requested'), children: [d.createdByName, " \u00B7 ", _jsx("bdi", { children: date(p.createdAt) })] }), _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: p.effect === 'Warning' ? t('deductions.penalty.warningNote') : t('deductions.penalty.effectNote') })] }), editing && _jsx(PenaltyDialog, { category: p.category, penalty: d, onClose: () => setEditing(false), onSent: done }), amending && _jsx(PenaltyDialog, { category: p.category, penalty: d, amend: true, onClose: () => setAmending(false), onSent: done }), cancelling && (_jsx(NoteDialog, { title: other ? t('deductions.amend.cancelOther') : t('deductions.amend.cancelPenalty'), hint: t('deductions.amend.cancelPenaltyHint'), onClose: () => setCancelling(false), onSave: async (note) => {
                    await deductionsApi.cancelApprovedPenalty(p.id, note);
                    done();
                } }))] }));
}
