import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import Add from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import UpcomingOutlinedIcon from '@mui/icons-material/UpcomingOutlined';
import { Alert, Autocomplete, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, InputAdornment, LinearProgress, MenuItem, Skeleton, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { periodOf, shiftPeriod } from '../../api/attendance';
import { errorKey } from '../../api/auth';
import { deductionsApi, sar, } from '../../api/deductions';
import { staffApi } from '../../api/staff';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrAccents, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useMonthName } from '../attendance/AttendanceMonthPage';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { DateField } from '../../components/DateField';
const look = {
    Cancelled: { color: '#B91C1C', tint: '#FEE2E2' },
    InApproval: { color: hr.primary, tint: '#EFF6FF' },
    Returned: { color: '#B45309', tint: '#FEF3C7' },
    Rejected: { color: '#B91C1C', tint: '#FEE2E2' },
    Approved: { color: hr.violet, tint: '#F5F3FF' },
    Disbursed: { color: hr.success, tint: '#D1FAE5' },
    Settled: { color: hr.textMuted, tint: hr.muted },
};
const installmentLook = {
    Scheduled: { color: hr.primary, tint: '#EFF6FF' },
    Deferred: { color: '#B45309', tint: '#FEF3C7' },
    Deducted: { color: hr.success, tint: '#D1FAE5' },
    Postponed: { color: hr.textMuted, tint: hr.muted },
    Settled: { color: hr.textMuted, tint: hr.muted },
};
export function AdvanceStatusBadge({ status }) {
    const { t } = useTranslation();
    return _jsx(HrStatusBadge, { label: t(`deductions.advanceStatus.${status}`), ...look[status] });
}
/** Money with the riyal sign after it, in tabular digits. */
export function Money({ value, strong = false }) {
    const { t } = useTranslation();
    if (value === null || value === undefined)
        return _jsx(_Fragment, { children: "\u2014" });
    return (_jsxs(Box, { component: "span", sx: { fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 700 : undefined, whiteSpace: 'nowrap' }, children: [_jsx("bdi", { children: sar(value) }), " ", _jsx(Box, { component: "span", sx: { fontSize: '0.8em', color: hr.textMuted, fontWeight: 500 }, children: t('deductions.sar') })] }));
}
export function usePeople(search, enabled = true) {
    const [options, setOptions] = useState([]);
    useEffect(() => {
        if (!enabled)
            return;
        const timer = setTimeout(() => staffApi.pick(search).then(setOptions).catch(() => setOptions([])), 250);
        return () => clearTimeout(timer);
    }, [search, enabled]);
    return options;
}
/** The next payroll months to start deducting from (this month and the five after it). */
export function usePeriods(current) {
    const now = periodOf(new Date());
    const list = Array.from({ length: 6 }, (_, i) => shiftPeriod(now, i));
    return current && !list.includes(current) ? [current, ...list] : list;
}
export function Kpi({ accent, icon, label, value, parts }) {
    const a = hrAccents[accent];
    return (_jsxs(Box, { sx: { ...hrCard, bgcolor: a.tint, p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'flex-start' }, children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600, color: '#334155' }, children: label }), _jsx(Typography, { component: "div", sx: { fontSize: 25, fontWeight: 700, color: hr.text, lineHeight: 1.3 }, children: value })] }), _jsx(Box, { sx: { width: 38, height: 38, borderRadius: '50%', bgcolor: '#fff', color: a.main, display: 'grid', placeItems: 'center', '& svg': { fontSize: 19 } }, children: icon })] }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: `repeat(${parts.length}, 1fr)`, gap: 1, borderTop: '1px dashed rgba(15,39,71,.12)', pt: 0.75 }, children: parts.map(([l, v]) => (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: l }), _jsx(Typography, { component: "div", sx: { fontSize: 12.5, fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums' }, children: v })] }, l))) })] }));
}
/**
 * An advance request (or a returned one sent again): employee, amount, months and the first payroll month, with a live
 * preview — the salary and the cap (for those who may see salaries), the installment, the month's deductions, the
 * conditions — and «above the cap» for the approvers to decide when the cap is passed.
 */
/** A new advance, a returned one sent again, or (amend) an approved one changed before it is paid, with the reason. */
export function AdvanceDialog({ employee, advance, amend = false, onClose, onSent }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const monthName = useMonthName();
    const a = advance?.advance;
    const [who, setWho] = useState(employee ?? (a ? { id: a.employeeId, nameAr: a.employeeName, nameEn: a.employeeName } : null));
    const [search, setSearch] = useState('');
    const people = usePeople(search, !employee && !advance);
    const [amount, setAmount] = useState(a ? String(a.amount) : '');
    const [months, setMonths] = useState(a?.months ?? 1);
    const [maxMonths, setMaxMonths] = useState(3);
    const [capPercent, setCapPercent] = useState(null);
    const periods = usePeriods(a?.firstPeriod);
    const [first, setFirst] = useState(a?.firstPeriod ?? shiftPeriod(periodOf(new Date()), 1));
    const [reason, setReason] = useState(advance?.reason ?? '');
    const [amendReason, setAmendReason] = useState('');
    const [aboveCap, setAboveCap] = useState(a?.aboveCap ?? false);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        deductionsApi
            .setup()
            .then((s) => (setMaxMonths(s.settings.advanceMaxMonths), setCapPercent(s.settings.advanceCapPercent)))
            .catch(() => undefined);
    }, []);
    const value = Number(amount);
    const input = who && value > 0 ? { employeeId: who.id, amount: value, months, firstPeriod: first, reason: reason.trim(), aboveCap } : null;
    const key = input ? `${input.employeeId}|${value}|${months}|${first}|${aboveCap}|${reason.trim() !== ''}` : '';
    useEffect(() => {
        if (!input) {
            setPreview(null);
            return;
        }
        const timer = setTimeout(() => {
            deductionsApi
                .previewAdvance({ ...input, reason: input.reason || '—' }, a?.id)
                .then((p) => (setPreview(p), setError(null)))
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
            if (a && amend) {
                await deductionsApi.amendAdvance(a.id, { amount: input.amount, months: input.months, firstPeriod: input.firstPeriod, reason: input.reason, aboveCap: input.aboveCap, amendReason: amendReason.trim() });
                onSent(a.id);
                return;
            }
            const r = a ? await deductionsApi.resubmitAdvance(a.id, input) : await deductionsApi.sendAdvance(input);
            onSent(r.id);
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    const blocking = preview?.problems.filter((p) => p !== 'above_cap') ?? [];
    const canSend = Boolean(input && reason.trim() && preview && blocking.length === 0 && (preview.needsAboveCap.length === 0 || aboveCap));
    const checks = preview
        ? [
            [t('deductions.advance.checks.probation'), !preview.problems.includes('on_probation')],
            [t('deductions.advance.checks.service'), !preview.problems.includes('short_service')],
            [t('deductions.advance.checks.open'), !preview.problems.includes('open_advance')],
            [t('deductions.advance.checks.months', { max: preview.maxMonths }), !preview.problems.includes('too_many_months')],
        ]
        : [];
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "sm", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: a ? (amend ? t('deductions.amend.advanceTitle', { no: a.advanceNo }) : a.advanceNo) : t('deductions.advance.new') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }, children: [_jsx(Autocomplete, { size: "small", disabled: Boolean(employee || advance), options: people, value: who, onChange: (_, v) => setWho(v), onInputChange: (_, v) => setSearch(v), getOptionLabel: (o) => (ar ? o.nameAr : o.nameEn), isOptionEqualToValue: (x, y) => x.id === y.id, filterOptions: (x) => x, renderInput: (params) => _jsx(TextField, { ...params, required: true, label: t('deductions.employee') }) }), _jsx(TextField, { size: "small", required: true, type: "number", label: t('deductions.advance.amount'), value: amount, onChange: (e) => setAmount(e.target.value), slotProps: { htmlInput: { min: 1, step: '0.01', dir: 'ltr' }, input: { endAdornment: _jsx(InputAdornment, { position: "end", children: t('deductions.sar') }) } } }), _jsx(TextField, { select: true, size: "small", label: t('deductions.advance.months'), value: months, onChange: (e) => setMonths(Number(e.target.value)), children: Array.from({ length: Math.max(maxMonths, months) }, (_, i) => i + 1).map((n) => (_jsx(MenuItem, { value: n, children: n }, n))) }), _jsx(TextField, { select: true, size: "small", label: t('deductions.advance.firstPeriod'), value: first, onChange: (e) => setFirst(e.target.value), children: periods.map((p) => (_jsx(MenuItem, { value: p, children: monthName(p) }, p))) })] }), _jsx(Box, { sx: { bgcolor: '#F8FAFC', border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.5 }, children: !input ? (_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('deductions.advance.pick') })) : !preview ? (_jsx(LinearProgress, {})) : (_jsxs(_Fragment, { children: [_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }, children: [[
                                                [t('deductions.advance.salary'), preview.salary],
                                                [t('deductions.advance.cap', { percent: capPercent ?? '—' }), preview.cap],
                                                [t('deductions.advance.installment'), preview.installment],
                                            ].map(([l, v]) => (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: l }), _jsx(Typography, { component: "div", sx: { fontWeight: 700, fontSize: 17 }, title: v === null ? t('deductions.advance.hidden') : undefined, children: _jsx(Money, { value: v }) })] }, l))), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: t('deductions.advance.monthShare') }), _jsx(Typography, { sx: { fontWeight: 700, fontSize: 17, color: preview.needsAboveCap.includes('month_cap') ? hr.warning : hr.text }, title: preview.monthShare === null ? t('deductions.advance.hidden') : undefined, children: _jsx("bdi", { children: preview.monthShare === null ? '—' : `${preview.monthShare}%` }) })] })] }), _jsx(Stack, { direction: "row", sx: { flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.25, mt: 1 }, children: checks.map(([l, ok]) => (_jsxs(Typography, { sx: { fontSize: 12, color: ok ? hr.success : hr.danger, display: 'flex', alignItems: 'center', gap: 0.25 }, children: [ok ? _jsx(CheckIcon, { sx: { fontSize: 14 } }) : '✕', " ", l] }, l))) }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted, mt: 0.5 }, children: t('deductions.monthCapNote') }), blocking.map((p) => (_jsx(Alert, { severity: "error", sx: { mt: 1, py: 0 }, children: t(`deductions.advance.problems.${p}`) }, p))), preview.needsAboveCap.length > 0 && (_jsxs(Alert, { severity: "warning", sx: { mt: 1, py: 0, '& .MuiAlert-message': { width: '100%' } }, children: [preview.needsAboveCap.map((c) => t(`deductions.aboveCap.${c}`)).join(' '), _jsx(FormControlLabel, { sx: { display: 'flex', mt: 0.25 }, control: _jsx(Checkbox, { size: "small", checked: aboveCap, onChange: (e) => setAboveCap(e.target.checked) }), label: t('deductions.aboveCap.ask') })] }))] })) }), _jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('deductions.advance.reason'), value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), preview && !amend && _jsx(Alert, { severity: "info", sx: { py: 0 }, children: preview.managerLinked ? t('deductions.advance.route.manager', { name: preview.managerName }) : t('deductions.advance.route.hr') }), amend && _jsx(Alert, { severity: "info", sx: { py: 0 }, children: t('deductions.amend.advanceHint') }), amend && (_jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('deductions.amend.reason'), value: amendReason, onChange: (e) => setAmendReason(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } })), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", startIcon: amend ? _jsx(EditNoteOutlinedIcon, {}) : _jsx(SendOutlinedIcon, {}), disabled: busy || !canSend || (amend && !amendReason.trim()), onClick: () => void send(), children: amend ? t('deductions.amend.save') : t('deductions.send') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
export function AdvancesTable({ rows, showEmployee = true, onOpen }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const monthName = useMonthName();
    if (rows.length === 0)
        return _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('deductions.advance.none') });
    return (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 46, fontVariantNumeric: 'tabular-nums' }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700, color: '#334155' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [showEmployee && _jsx(TableCell, { children: t('deductions.employee') }), _jsx(TableCell, { children: t('deductions.cols.no') }), _jsx(TableCell, { children: t('deductions.advance.amount') }), _jsx(TableCell, { children: t('deductions.advance.months') }), _jsx(TableCell, { children: t('deductions.advance.firstPeriod') }), _jsx(TableCell, { children: t('deductions.advance.remaining') }), _jsx(TableCell, { children: t('deductions.cols.status') })] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => onOpen(r.id), children: [showEmployee && (_jsx(TableCell, { children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(HrAvatar, { name: r.employeeName }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 13.5 }, children: r.employeeName }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: (ar ? r.departmentAr : r.departmentEn) ?? '—' })] })] }) })), _jsx(TableCell, { sx: { fontWeight: 700 }, children: _jsx(RouterLink, { to: `/hr/advances/${r.id}`, onClick: (e) => e.stopPropagation(), style: { color: 'inherit', textDecoration: 'none' }, children: _jsx("bdi", { children: r.advanceNo }) }) }), _jsxs(TableCell, { children: [_jsx(Money, { value: r.amount, strong: true }), r.aboveCap && _jsx(Typography, { sx: { fontSize: 11, color: hr.warning }, children: t('deductions.aboveCap.badge') })] }), _jsx(TableCell, { children: r.months }), _jsx(TableCell, { children: monthName(r.firstPeriod) }), _jsx(TableCell, { children: _jsx(Money, { value: r.status === 'Rejected' ? null : r.remaining }) }), _jsx(TableCell, { children: _jsx(AdvanceStatusBadge, { status: r.status }) })] }, r.id))) })] }) }));
}
/** Advances: the cards, the tabs (all, waiting for approval, to be paid, open) and the table. */
export function AdvancesPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const monthName = useMonthName();
    const { can } = useSession();
    const [view, setView] = useState('all');
    const [kpis, setKpis] = useState(null);
    const [rows, setRows] = useState(null);
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [error, setError] = useState(null);
    const [asking, setAsking] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setQuery(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    const loadKpis = useCallback(() => deductionsApi.advanceKpis().then(setKpis).catch((f) => setError(errorKey(f))), []);
    useEffect(() => {
        void loadKpis();
    }, [loadKpis]);
    const load = useCallback(() => {
        setRows(null);
        setError(null);
        deductionsApi
            .advances({ tab: view, search: query })
            .then(setRows)
            .catch((f) => setError(errorKey(f)));
    }, [view, query]);
    useEffect(load, [load]);
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(CreditCardOutlinedIcon, {}), title: t('deductions.advance.title'), subtitle: t('deductions.advance.intro'), actions: _jsxs(_Fragment, { children: [can('deductions.view', true) && (_jsx(Button, { variant: "outlined", startIcon: _jsx(SettingsOutlinedIcon, {}), onClick: () => navigate('/hr/deductions-settings'), children: t('deductions.settings.title') })), can('deductions.manage', true) && (_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setAsking(true), children: t('deductions.advance.new') }))] }) }), _jsx(Box, { sx: { display: 'grid', gap: 1.5, mb: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }, children: kpis ? (_jsxs(_Fragment, { children: [_jsx(Kpi, { accent: "violet", icon: _jsx(SavingsOutlinedIcon, {}), label: t('deductions.kpi.open'), value: _jsx(Money, { value: kpis.openBalance }), parts: [[t('deductions.kpi.employees'), kpis.openEmployees]] }), _jsx(Kpi, { accent: "blue", icon: _jsx(HourglassEmptyOutlinedIcon, {}), label: t('deductions.kpi.pending'), value: kpis.pending, parts: [[t('deductions.kpi.amount'), _jsx(Money, { value: kpis.pendingAmount }, "a")], [t('deductions.kpi.toDisburse'), kpis.toDisburse]] }), _jsx(Kpi, { accent: "green", icon: _jsx(PaymentsOutlinedIcon, {}), label: t('deductions.kpi.paid'), value: _jsx(Money, { value: kpis.paidThisMonth }), parts: [[t('deductions.kpi.count'), kpis.paidThisMonthCount]] }), _jsx(Kpi, { accent: "amber", icon: _jsx(UpcomingOutlinedIcon, {}), label: t('deductions.kpi.due', { month: monthName(kpis.nextPeriod) }), value: _jsx(Money, { value: kpis.dueNextMonth }), parts: [[t('deductions.kpi.dueNote'), '']] })] })) : (Array.from({ length: 4 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: 118 }, i))) }), _jsxs(Box, { sx: { ...hrCard, px: 2, pb: 2 }, children: [_jsxs(Tabs, { value: view, onChange: (_, v) => setView(v), variant: "scrollable", sx: { borderBottom: `1px solid ${hr.border}`, mb: 1.5 }, children: [_jsx(Tab, { value: "all", label: t('deductions.advance.tabs.all') }), _jsx(Tab, { value: "pending", label: t('deductions.advance.tabs.pending', { count: kpis?.pending ?? 0 }) }), _jsx(Tab, { value: "disburse", label: t('deductions.advance.tabs.disburse', { count: kpis?.toDisburse ?? 0 }) }), _jsx(Tab, { value: "open", label: t('deductions.advance.tabs.open') })] }), _jsx(TextField, { size: "small", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('deductions.search'), sx: { width: { xs: '100%', md: 300 }, mb: 1.5 }, slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) }, htmlInput: { 'aria-label': t('deductions.search') } } }), error ? (_jsxs(Stack, { sx: { gap: 1, alignItems: 'flex-start' }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Button, { variant: "outlined", size: "small", onClick: load, children: t('deductions.retry') })] })) : !rows ? (_jsx(Stack, { sx: { gap: 0.75 }, children: Array.from({ length: 4 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: 42 }, i)) })) : rows.length === 0 ? (_jsx(HrEmptyState, { icon: _jsx(CreditCardOutlinedIcon, {}), title: query ? t('deductions.noResults') : t('deductions.advance.none'), hint: query ? undefined : t('deductions.advance.noneHint') })) : (_jsx(AdvancesTable, { rows: rows, onOpen: (id) => navigate(`/hr/advances/${id}`) }))] }), asking && _jsx(AdvanceDialog, { onClose: () => setAsking(false), onSent: (id) => navigate(`/hr/advances/${id}`) })] }));
}
/** A note for an early settlement or a postponed installment. */
export function NoteDialog({ title, hint, onClose, onSave }) {
    const { t } = useTranslation();
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await onSave(note.trim());
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: title }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: hint }), _jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('deductions.note'), value: note, onChange: (e) => setNote(e.target.value), slotProps: { htmlInput: { maxLength: 300 } } }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !note.trim(), onClick: () => void save(), children: t('common.save') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
const methods = ['Transfer', 'Cash', 'Cheque'];
/** Finance records the payment: the date, the method and its reference. */
function DisburseDialog({ advance, onClose, onSaved }) {
    const { t } = useTranslation();
    const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
    const [method, setMethod] = useState('Transfer');
    const [reference, setReference] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await deductionsApi.disburse(advance.id, { paidOn, method, reference: reference.trim() || null });
            onSaved();
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('deductions.disburse.title', { no: advance.advanceNo }) }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsxs(Typography, { sx: { fontSize: 13 }, children: [t('deductions.disburse.amount'), " ", _jsx(Money, { value: advance.amount, strong: true })] }), _jsx(DateField, { size: "small", label: t('deductions.disburse.paidOn'), value: paidOn, onChange: (e) => setPaidOn(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { select: true, size: "small", label: t('deductions.disburse.method'), value: method, onChange: (e) => setMethod(e.target.value), children: methods.map((m) => (_jsx(MenuItem, { value: m, children: t(`deductions.disburse.methods.${m}`) }, m))) }), _jsx(TextField, { size: "small", label: t('deductions.disburse.reference'), value: reference, onChange: (e) => setReference(e.target.value), slotProps: { htmlInput: { maxLength: 100, dir: 'ltr' } } }), _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: t('deductions.disburse.note') }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", startIcon: _jsx(PaymentsOutlinedIcon, {}), disabled: busy || !paidOn, onClick: () => void save(), children: t('deductions.disburse.save') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
function Row({ label, children }) {
    return (_jsxs(Stack, { direction: "row", sx: { gap: 2, borderBottom: `1px solid #EEF2F7`, py: 1, justifyContent: 'space-between' }, children: [_jsx(Typography, { sx: { color: hr.textMuted, fontSize: 13 }, children: label }), _jsx(Typography, { component: "div", sx: { fontWeight: 600, fontSize: 13.5, textAlign: 'end' }, children: children })] }));
}
/** An advance: its approval bar, its data, then (once approved) the deduction schedule, the payment, and the postponement or the early settlement. */
export function AdvancePage() {
    const { id = '' } = useParams();
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const navigate = useNavigate();
    const monthName = useMonthName();
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const [d, setD] = useState(null);
    const [error, setError] = useState(null);
    const [dialog, setDialog] = useState(null);
    const approval = useRecordApproval(d?.approval?.instanceId);
    useCrumb(d?.advance.advanceNo, `/hr/advances/${id}`);
    const reload = useCallback(async () => {
        try {
            setD(await deductionsApi.advance(id));
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
    const a = d.advance;
    const open = a.status === 'Disbursed' || a.status === 'Approved';
    const done = () => {
        setDialog(null);
        void reload();
        void approval.reload();
    };
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(CreditCardOutlinedIcon, {}), title: t('deductions.advance.pageTitle', { amount: sar(a.amount) }), status: _jsx(AdvanceStatusBadge, { status: a.status }), reference: a.advanceNo, subtitle: _jsxs(_Fragment, { children: [_jsx(RouterLink, { to: `/hr/employees/${a.employeeId}`, children: a.employeeName }), (ar ? a.departmentAr : a.departmentEn) && ` · ${ar ? a.departmentAr : a.departmentEn}`, " \u00B7 ", t('deductions.advance.over', { months: a.months, month: monthName(a.firstPeriod) })] }), actions: _jsxs(_Fragment, { children: [a.status === 'Returned' && can('deductions.manage', true) && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), onClick: () => setDialog('edit'), children: t('deductions.resubmit') })), d.canAmend && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditNoteOutlinedIcon, {}), onClick: () => setDialog('amend'), children: t('deductions.amend.action') })), d.canCancelApproved && (_jsx(Button, { variant: "outlined", color: "error", startIcon: _jsx(CancelOutlinedIcon, {}), onClick: () => setDialog('cancelApproved'), children: t('deductions.amend.cancelAdvance') })), a.status === 'Approved' && can('deductions.disburse', true) && (_jsx(Button, { variant: "contained", startIcon: _jsx(PaymentsOutlinedIcon, {}), onClick: () => setDialog('disburse'), children: t('deductions.disburse.action') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') } }), onClick: () => navigate(-1), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), d.approval && _jsx(ApprovalBar, { status: d.approval, detail: approval.detail, onChanged: done }), d.amendedAt && a.status === 'Approved' && (_jsxs(Alert, { severity: "info", sx: { mb: 1.5 }, children: [t('deductions.amend.amendedBy', { by: d.amendedByName, date: date(d.amendedAt) }), " \u2014 ", d.amendNote] })), d.canceledAt && (_jsxs(Alert, { severity: "warning", sx: { mb: 1.5 }, children: [t('deductions.amend.canceledBy', { by: d.canceledByName, date: date(d.canceledAt) }), " \u2014 ", d.lastComment] })), d.lastComment && (a.status === 'Returned' || a.status === 'Rejected') && (_jsx(Alert, { severity: a.status === 'Rejected' ? 'error' : 'warning', sx: { mb: 1.5 }, children: d.lastComment })), a.aboveCap && (_jsx(Alert, { severity: "warning", sx: { mb: 1.5 }, children: t('deductions.aboveCap.approved') })), _jsxs(Box, { sx: { ...hrCard, p: 2, mb: 2 }, children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 1 }, children: t('deductions.advance.dataTitle') }), _jsxs(Box, { sx: { display: 'grid', columnGap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' } }, children: [_jsx(Row, { label: t('deductions.employee'), children: _jsx(RouterLink, { to: `/hr/employees/${a.employeeId}`, children: a.employeeName }) }), _jsx(Row, { label: t('deductions.advance.department'), children: (ar ? a.departmentAr : a.departmentEn) ?? '—' }), _jsx(Row, { label: t('deductions.advance.amount'), children: _jsx(Money, { value: a.amount, strong: true }) }), _jsx(Row, { label: t('deductions.advance.months'), children: a.months }), _jsx(Row, { label: t('deductions.advance.firstPeriod'), children: monthName(a.firstPeriod) }), _jsx(Row, { label: t('deductions.advance.installment'), children: _jsx(Money, { value: Math.floor((a.amount / a.months) * 100) / 100 }) }), d.salaryAtRequest !== null && (_jsx(Row, { label: t('deductions.advance.salaryAtRequest'), children: _jsx(Money, { value: d.salaryAtRequest }) })), _jsx(Row, { label: t('deductions.aboveCap.badge'), children: a.aboveCap ? t('common.yes') : t('deductions.advance.withinCap') }), _jsxs(Row, { label: t('deductions.requested'), children: [d.createdByName, " \u00B7 ", _jsx("bdi", { children: date(a.createdAt) })] })] }), _jsx(Row, { label: t('deductions.advance.reason'), children: d.reason })] }), d.installments.length === 0 ? (_jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 0.75 }, children: t('deductions.schedule.title') }), _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: a.status === 'Rejected' ? t('deductions.schedule.rejected') : t('deductions.schedule.afterApproval', { amount: sar(Math.floor((a.amount / a.months) * 100) / 100) }) })] })) : (_jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, alignItems: 'start' }, children: [_jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 1.25 }, children: t('deductions.schedule.title') }), _jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 44, fontVariantNumeric: 'tabular-nums' }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700 } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('deductions.schedule.period') }), _jsx(TableCell, { children: t('deductions.schedule.amount') }), _jsx(TableCell, { children: t('deductions.schedule.deducted') }), _jsx(TableCell, { children: t('deductions.cols.status') }), _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: d.installments.map((i) => (_jsxs(TableRow, { children: [_jsx(TableCell, { sx: { fontWeight: 600 }, children: monthName(i.period) }), _jsx(TableCell, { children: _jsx(Money, { value: i.amount }) }), _jsx(TableCell, { children: i.deducted > 0 ? _jsx(Money, { value: i.deducted }) : '—' }), _jsxs(TableCell, { children: [_jsx(HrStatusBadge, { label: t(`deductions.installmentStatus.${i.status}`), ...installmentLook[i.status] }), i.note && _jsx(Typography, { sx: { fontSize: 11, color: hr.textMuted, mt: 0.25 }, children: i.note })] }), _jsx(TableCell, { sx: { textAlign: 'end' }, children: open && i.status === 'Scheduled' && i.deducted === 0 && can('deductions.manage', true) && (_jsx(Button, { size: "small", startIcon: _jsx(EventRepeatOutlinedIcon, {}), onClick: () => setDialog(i), children: t('deductions.schedule.postpone') })) })] }, i.id))) })] }) }), _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 1 }, children: t('deductions.monthCapNote') })] }), _jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 0.5 }, children: t('deductions.payment.title') }), _jsx(Row, { label: t('deductions.payment.paidOn'), children: d.paidOn ? _jsx("bdi", { children: date(d.paidOn) }) : t('deductions.payment.notYet') }), _jsx(Row, { label: t('deductions.payment.method'), children: d.paymentMethod ? t(`deductions.disburse.methods.${d.paymentMethod}`, { defaultValue: d.paymentMethod }) : '—' }), _jsx(Row, { label: t('deductions.payment.reference'), children: d.paymentReference ? _jsx("bdi", { dir: "ltr", children: d.paymentReference }) : '—' }), _jsx(Row, { label: t('deductions.payment.paidBy'), children: d.paidBy ?? '—' }), _jsx(Row, { label: t('deductions.advance.remaining'), children: _jsx(Money, { value: a.remaining, strong: true }) }), a.status === 'Disbursed' && can('deductions.disburse', true) && (_jsx(Button, { sx: { mt: 1.5 }, variant: "outlined", startIcon: _jsx(TaskAltOutlinedIcon, {}), onClick: () => setDialog('settle'), children: t('deductions.settle.action') }))] })] })), dialog === 'edit' && _jsx(AdvanceDialog, { advance: d, onClose: () => setDialog(null), onSent: done }), dialog === 'amend' && _jsx(AdvanceDialog, { advance: d, amend: true, onClose: () => setDialog(null), onSent: done }), dialog === 'cancelApproved' && (_jsx(NoteDialog, { title: t('deductions.amend.cancelAdvance'), hint: t('deductions.amend.cancelAdvanceHint'), onClose: () => setDialog(null), onSave: async (note) => {
                    await deductionsApi.cancelApprovedAdvance(a.id, note);
                    done();
                } })), dialog === 'disburse' && _jsx(DisburseDialog, { advance: a, onClose: () => setDialog(null), onSaved: done }), dialog === 'settle' && (_jsx(NoteDialog, { title: t('deductions.settle.title'), hint: t('deductions.settle.hint', { amount: sar(a.remaining) }), onClose: () => setDialog(null), onSave: async (note) => {
                    await deductionsApi.settle(a.id, note);
                    done();
                } })), dialog && typeof dialog === 'object' && (_jsx(NoteDialog, { title: t('deductions.schedule.postponeTitle', { month: monthName(dialog.period) }), hint: t('deductions.schedule.postponeHint'), onClose: () => setDialog(null), onSave: async (note) => {
                    await deductionsApi.postpone(a.id, dialog.id, note);
                    done();
                } }))] }));
}
