import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { endReasons, settlementsApi } from '../../api/settlements';
import { useCrumb } from '../../app/breadcrumbs';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrScope, hr } from '../../components/hr/Hr';
import { GlassChip, GlassFact, GlassHero, GlassKpi, GlassRow, glassButton, glassPanel } from '../../components/glass';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { Money, sar, useYears } from './settlementParts';
import { DateField } from '../../components/DateField';
/**
 * One settlement (docs/03-migration-plan/18), with the details' glass tint: the strip with its KPIs and facts, the
 * approval bar, the dues and the deductions (each line with the article or the record it comes from), the net, and for
 * an end of service the award's breakdown. Every figure is the server's; the entries change only before it is sent.
 */
export function SettlementPage() {
    const { id = '' } = useParams();
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const navigate = useNavigate();
    const { date } = useCommercialFormat();
    const years = useYears();
    const [d, setD] = useState(null);
    const [error, setError] = useState(null);
    const [dialog, setDialog] = useState(null);
    const [busy, setBusy] = useState(false);
    const approval = useRecordApproval(d?.approval?.instanceId);
    useCrumb(d?.settlementNo, `/hr/settlements/${id}`);
    const reload = useCallback(async () => {
        try {
            setD(await settlementsApi.get(id));
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
    const end = d.kind === 'EndOfService';
    const worker = d.party === 'Worker';
    const adds = d.lines.filter((l) => l.side === 'Addition');
    const deds = d.lines.filter((l) => l.side === 'Deduction');
    const done = () => {
        setDialog(null);
        void reload();
        void approval.reload();
    };
    const submit = async () => {
        setBusy(true);
        try {
            await settlementsApi.submit(d.id);
            done();
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(HrScope, { children: [_jsxs(GlassHero, { tint: "detail", overline: _jsxs(_Fragment, { children: [t('settlements.crumb'), " \u203A ", _jsx("bdi", { children: d.settlementNo })] }), title: t(end ? 'settlements.titleEnd' : 'settlements.titleVacation', { name: d.name }), chip: _jsx(GlassChip, { children: t(`settlements.status.${d.status}`) }), subtitle: end
                    ? `${t(`settlements.reason.${d.reason}`)} · ${t('settlements.lastDayOn', { date: date(d.lastDay) })}`
                    : `${t('settlements.annualLeave')} · ${date(d.leaveFrom)} – ${date(d.leaveTo)}${d.leaveRequestNo ? ` · ${d.leaveRequestNo}` : ''}${worker ? ` · ${t('settlements.party.Worker')}` : ''}`, actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(PrintOutlinedIcon, {}), onClick: () => window.open(`/hr/settlements/${d.id}/print`, '_blank'), sx: glassButton(), children: t('settlements.print') }), d.canEdit && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(EditOutlinedIcon, {}), onClick: () => setDialog('edit'), sx: glassButton(), children: t('settlements.edit') }), _jsx(Button, { variant: "outlined", onClick: () => setDialog('cancel'), sx: glassButton(), children: t('settlements.cancel') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(SendOutlinedIcon, {}), disabled: busy, onClick: () => void submit(), sx: glassButton(true), children: t('settlements.submit') })] })), d.canPay && (_jsx(Button, { variant: "outlined", startIcon: _jsx(PaymentsOutlinedIcon, {}), onClick: () => setDialog('pay'), sx: glassButton(true), children: t('settlements.pay') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') } }), onClick: () => navigate(-1), sx: glassButton(), children: t('common.back') })] }), children: [_jsxs(GlassRow, { children: [end ? (_jsx(GlassKpi, { icon: _jsx(HourglassBottomOutlinedIcon, {}), label: t('settlements.kpi.service'), value: years(d.serviceYears), hint: t('settlements.kpi.serviceHint', { from: date(d.hireDate), days: d.serviceDays.toLocaleString('en-US'), excluded: d.excludedDays }) })) : (_jsx(GlassKpi, { icon: _jsx(BeachAccessOutlinedIcon, {}), label: t('settlements.kpi.leaveDays'), value: t('settlements.daysN', { count: d.leaveDays }), hint: `${date(d.leaveFrom)} – ${date(d.leaveTo)}` })), _jsx(GlassKpi, { icon: _jsx(AddCircleOutlineIcon, {}), label: t('settlements.dues'), value: sar(d.totalAdditions), hint: t('settlements.itemsN', { count: adds.length }) }), _jsx(GlassKpi, { icon: _jsx(RemoveCircleOutlineIcon, {}), label: t('settlements.deductions'), value: sar(d.totalDeductions), hint: t('settlements.itemsN', { count: deds.length }) }), _jsx(GlassKpi, { icon: _jsx(CheckCircleOutlineIcon, {}), label: t('settlements.net'), value: sar(d.net), hint: d.status === 'Paid' ? t('settlements.paidOn', { date: date(d.paidOn) }) : t('settlements.netHint') })] }), _jsxs(GlassRow, { children: [_jsxs(GlassFact, { label: t(worker ? 'settlements.worker' : 'settlements.employee'), children: [_jsx(RouterLink, { to: worker ? `/workforce/workers/${d.personId}` : `/hr/employees/${d.personId}`, style: { color: '#fff' }, children: _jsx("bdi", { children: d.personNo }) }), (ar ? d.jobTitleAr : d.jobTitleEn) && ` · ${ar ? d.jobTitleAr : d.jobTitleEn}`, (ar ? d.departmentAr : d.departmentEn) && ` · ${ar ? d.departmentAr : d.departmentEn}`] }), _jsx(GlassFact, { label: t('settlements.wage'), children: _jsx(Money, { value: d.wage, muted: true }) }), end ? (_jsx(GlassFact, { label: t('settlements.leaveBalance'), children: t('settlements.daysN', { count: d.leaveDays }) })) : (_jsx(GlassFact, { label: t(worker ? 'settlements.workerLeaveRequest' : 'settlements.leaveRequest'), children: d.leaveRequestId ? (_jsx(RouterLink, { to: worker ? `/operations/movements/${d.leaveRequestId}` : `/hr/leave/${d.leaveRequestId}`, style: { color: '#fff' }, children: _jsx("bdi", { children: d.leaveRequestNo }) })) : ('—') })), _jsx(GlassFact, { label: t('settlements.unpaidFrom'), children: d.unpaidDays > 0 ? date(d.unpaidFrom) : t('settlements.allPaid') })] })] }), _jsx(ErrorMessage, { messageKey: error }), d.approval && _jsx(ApprovalBar, { status: d.approval, detail: approval.detail, onChanged: done }), d.lastComment && d.status === 'Returned' && (_jsx(Alert, { severity: "warning", sx: { mb: 1.5 }, children: d.lastComment })), d.net < 0 && (_jsx(Alert, { severity: "warning", sx: { mb: 1.5 }, children: t('settlements.negative') })), _jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }, children: [_jsx(Side, { title: t('settlements.dues'), tone: "add", lines: adds, total: d.totalAdditions, d: d }), _jsx(Side, { title: t('settlements.deductions'), tone: "deduct", lines: deds, total: d.totalDeductions, d: d })] }), _jsxs(Box, { sx: { mt: 2, borderRadius: '18px', p: '18px 22px', color: '#fff', display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'center', background: 'radial-gradient(400px 200px at 10% 0%, rgba(56,189,248,.3), transparent 60%), linear-gradient(135deg, #082B49, #1e3a8a)' }, children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { opacity: 0.8, fontSize: 13 }, children: t('settlements.netDue') }), _jsx(Typography, { sx: { fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }, children: _jsx(Money, { value: d.net, muted: true }) }), _jsx(Typography, { sx: { opacity: 0.7, fontSize: 12 }, children: t('settlements.netFormula') })] }), _jsxs(Typography, { sx: { opacity: 0.85, fontSize: 12.5, maxWidth: 460 }, children: [d.notes ?? t('settlements.serverNote'), d.status === 'Paid' && (_jsxs(Box, { component: "span", sx: { display: 'block', mt: 0.5 }, children: [t('settlements.paidBy', { date: date(d.paidOn), method: t(`settlements.method.${d.paymentMethod}`, { defaultValue: d.paymentMethod ?? '' }), by: d.paidByName }), d.paymentReference && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx("bdi", { children: d.paymentReference })] })] }))] })] }), end && _jsx(Award, { d: d }), dialog === 'edit' && _jsx(EditDialog, { d: d, onClose: () => setDialog(null), onSaved: done }), dialog === 'pay' && _jsx(PayDialog, { id: d.id, onClose: () => setDialog(null), onPaid: done }), dialog === 'cancel' && _jsx(CancelDialog, { id: d.id, onClose: () => setDialog(null), onCancelled: done })] }));
}
/** A line's details: the days and their rate, the article it comes from, or the record it takes. */
export function useLineDetail() {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const years = useYears();
    return (l, d) => {
        switch (l.code) {
            case 'unpaid_salary':
                return t('settlements.detail.unpaid', { from: date(d.unpaidFrom), to: date(d.lastDay), days: l.days, rate: sar(l.rate) });
            case 'timesheet_pay':
                return t('settlements.detail.timesheet', { no: l.reference, days: l.days });
            case 'leave_allowance':
                return t('settlements.detail.leave', { days: l.days, rate: sar(l.rate) });
            case 'leave_balance':
                return t('settlements.detail.balance', { days: l.days, rate: sar(l.rate) });
            case 'end_of_service':
                return t('settlements.detail.award', { years: years(d.serviceYears), share: t(`settlements.share.${shareOf(l.rate)}`) });
            case 'article_77':
                return t(d.term === 'Fixed' ? 'settlements.detail.art77Fixed' : 'settlements.detail.art77');
            case 'installment':
                return t('settlements.detail.installment', { no: l.reference, period: l.sourcePeriod });
            case 'penalty_days':
            case 'suspension':
                return t('settlements.detail.days', { no: l.reference, days: l.days, rate: sar(l.rate) });
            case 'penalty_amount':
            case 'other_due':
                return l.reference ?? '';
            default:
                return '';
        }
    };
}
const shareOf = (rate) => (rate >= 0.99 ? 'all' : rate >= 0.66 ? 'twoThirds' : rate >= 0.33 ? 'third' : 'none');
function Side({ title, tone, lines, total, d }) {
    const { t } = useTranslation();
    const detail = useLineDetail();
    const main = tone === 'add' ? '#047857' : '#B45309';
    return (_jsxs(Box, { component: "section", sx: { ...glassPanel, p: 2 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 1 }, children: [_jsx(Box, { "aria-hidden": true, sx: { width: 30, height: 30, borderRadius: '10px', display: 'grid', placeItems: 'center', color: '#fff', background: tone === 'add' ? 'linear-gradient(135deg,#34d399,#059669)' : 'linear-gradient(135deg,#fbbf24,#d97706)', '& svg': { fontSize: 18 } }, children: tone === 'add' ? _jsx(AddCircleOutlineIcon, {}) : _jsx(RemoveCircleOutlineIcon, {}) }), _jsx(Typography, { component: "h2", sx: { fontWeight: 800, fontSize: 15, color: main }, children: title })] }), lines.length === 0 ? (_jsx(Typography, { sx: { py: 2, color: hr.textMuted, fontSize: 13 }, children: t(tone === 'add' ? 'settlements.noDues' : 'settlements.noDeductions') })) : (lines.map((l) => (_jsx(Row, { label: t(`settlements.line.${l.code}`), hint: detail(l, d), children: _jsx(Money, { value: l.amount, strong: true }) }, l.lineNo)))), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', mt: 1.25, px: 1.5, py: 1.25, borderRadius: '12px', fontWeight: 800, color: main, bgcolor: tone === 'add' ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.14)' }, children: [_jsx("span", { children: t(tone === 'add' ? 'settlements.totalDues' : 'settlements.totalDeductions') }), _jsx(Money, { value: total, strong: true })] })] }));
}
function Row({ label, hint, children }) {
    return (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'center', gap: 2, py: 1.1, borderBottom: '1px dashed rgba(100,116,139,.25)' }, children: [_jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 13.5, color: '#334155' }, children: label }), hint && _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: hint })] }), children] }));
}
/** The award line by line (articles 84 and 85). */
function Award({ d }) {
    const { t } = useTranslation();
    const first = Math.min(d.serviceYears, 5);
    const after = Math.max(d.serviceYears - 5, 0);
    const award = d.lines.find((l) => l.code === 'end_of_service')?.amount ?? 0;
    // The rows add up to the server's full award: what is after the five years, and the rest for them.
    const afterAmount = Math.round(d.wage * after * 100) / 100;
    return (_jsxs(Box, { component: "section", sx: { ...glassPanel, p: 2, mt: 2 }, children: [_jsx(Typography, { component: "h2", sx: { fontWeight: 800, fontSize: 15, mb: 1 }, children: t('settlements.award.title') }), _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('settlements.award.item') }), _jsx(TableCell, { children: t('settlements.award.period') }), _jsx(TableCell, { children: t('settlements.award.rate') }), _jsx(TableCell, { align: "center", children: t('settlements.award.amount') })] }) }), _jsxs(TableBody, { children: [_jsxs(TableRow, { children: [_jsx(TableCell, { children: t('settlements.award.first') }), _jsx(TableCell, { children: t('settlements.yearsDec', { value: first.toFixed(2) }) }), _jsx(TableCell, { children: t('settlements.award.half') }), _jsx(TableCell, { align: "center", children: sar(d.awardFull - afterAmount) })] }), _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('settlements.award.after') }), _jsx(TableCell, { children: after > 0 ? t('settlements.yearsDec', { value: after.toFixed(2) }) : '—' }), _jsx(TableCell, { children: t('settlements.award.whole') }), _jsx(TableCell, { align: "center", children: sar(afterAmount) })] }), _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('settlements.award.full') }), _jsx(TableCell, {}), _jsx(TableCell, {}), _jsx(TableCell, { align: "center", children: sar(d.awardFull) })] }), _jsxs(TableRow, { sx: { '& td': { fontWeight: 800 } }, children: [_jsx(TableCell, { children: t('settlements.award.due', { reason: t(`settlements.reason.${d.reason}`) }) }), _jsx(TableCell, {}), _jsx(TableCell, { children: t(`settlements.share.${shareOf(d.awardFactor)}`) }), _jsx(TableCell, { align: "center", children: sar(award) })] })] })] }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted, mt: 1 }, children: t('settlements.award.note') })] }));
}
function EditDialog({ d, onClose, onSaved }) {
    const { t } = useTranslation();
    const end = d.kind === 'EndOfService';
    const [reason, setReason] = useState(d.reason ?? 'ContractEnd');
    const [lastDay, setLastDay] = useState(d.lastDay);
    const [term, setTerm] = useState(d.term);
    const [ends, setEnds] = useState(d.contractEndsOn ?? '');
    const [other, setOther] = useState(String(d.otherAdditions));
    const [custody, setCustody] = useState(String(d.custody));
    const [otherDeduction, setOtherDeduction] = useState(String(d.otherDeductions));
    const [full, setFull] = useState(d.deductFullAdvance);
    const [notes, setNotes] = useState(d.notes ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const amount = (v) => Math.max(0, Number(v) || 0);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await settlementsApi.update(d.id, {
                reason: end ? reason : null,
                lastDay: end ? lastDay : null,
                term: end ? term : null,
                contractEndsOn: end && term === 'Fixed' ? ends : null,
                otherAdditions: amount(other),
                custody: amount(custody),
                otherDeductions: amount(otherDeduction),
                deductFullAdvance: full,
                notes: notes.trim() || null,
            });
            onSaved();
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    const money = (label, value, set) => (_jsx(TextField, { size: "small", type: "number", label: label, value: value, onChange: (e) => set(e.target.value), slotProps: { htmlInput: { min: 0, step: 0.01 } } }));
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('settlements.edit') }), _jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 2, pt: 0.5 }, children: [end && (_jsxs(_Fragment, { children: [_jsx(TextField, { select: true, size: "small", label: t('settlements.col.reason'), value: reason, onChange: (e) => setReason(e.target.value), children: endReasons.map((r) => (_jsx(MenuItem, { value: r, children: t(`settlements.reason.${r}`) }, r))) }), _jsx(DateField, { size: "small", label: t('settlements.create.lastDay'), value: lastDay, onChange: (e) => setLastDay(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 2 }, children: [_jsxs(TextField, { select: true, size: "small", label: t('settlements.create.term'), value: term, onChange: (e) => setTerm(e.target.value), sx: { flex: 1 }, children: [_jsx(MenuItem, { value: "Indefinite", children: t('settlements.term.Indefinite') }), _jsx(MenuItem, { value: "Fixed", children: t('settlements.term.Fixed') })] }), term === 'Fixed' && (_jsx(DateField, { size: "small", label: t('settlements.create.contractEnds'), value: ends, onChange: (e) => setEnds(e.target.value), slotProps: { inputLabel: { shrink: true } }, sx: { flex: 1 } }))] })] })), money(t('settlements.line.other_addition'), other, setOther), money(t('settlements.line.custody'), custody, setCustody), money(t('settlements.line.other_deduction'), otherDeduction, setOtherDeduction), !end && d.party === 'Staff' && _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: full, onChange: (e) => setFull(e.target.checked) }), label: t('settlements.fullAdvance') }), _jsx(TextField, { size: "small", multiline: true, minRows: 2, label: t('settlements.notes'), value: notes, onChange: (e) => setNotes(e.target.value), slotProps: { htmlInput: { maxLength: 2000 } } }), _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: t('settlements.editHint') }), error && _jsx(Alert, { severity: "error", children: t(error) })] }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || (end && (!lastDay || (term === 'Fixed' && !ends))), onClick: () => void save(), children: t('settlements.saveRecalculate') })] })] }));
}
function PayDialog({ id, onClose, onPaid }) {
    const { t } = useTranslation();
    const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
    const [method, setMethod] = useState('Transfer');
    const [reference, setReference] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const pay = async () => {
        setBusy(true);
        try {
            await settlementsApi.pay(id, { paidOn, method, reference: reference.trim() || null });
            onPaid();
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "xs", children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('settlements.pay') }), _jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 2, pt: 0.5 }, children: [_jsx(DateField, { size: "small", label: t('settlements.paidOnLabel'), value: paidOn, onChange: (e) => setPaidOn(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { select: true, size: "small", label: t('settlements.methodLabel'), value: method, onChange: (e) => setMethod(e.target.value), children: ['Transfer', 'Cash', 'Cheque'].map((m) => (_jsx(MenuItem, { value: m, children: t(`settlements.method.${m}`) }, m))) }), _jsx(TextField, { size: "small", label: t('settlements.referenceLabel'), value: reference, onChange: (e) => setReference(e.target.value), slotProps: { htmlInput: { maxLength: 100 } } }), error && _jsx(Alert, { severity: "error", children: t(error) })] }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy, onClick: () => void pay(), children: t('settlements.confirmPay') })] })] }));
}
function CancelDialog({ id, onClose, onCancelled }) {
    const { t } = useTranslation();
    const [comment, setComment] = useState('');
    const [error, setError] = useState(null);
    const cancel = async () => {
        try {
            await settlementsApi.cancel(id, comment.trim() || null);
            onCancelled();
        }
        catch (f) {
            setError(errorKey(f));
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "xs", children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('settlements.cancel') }), _jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 2, pt: 0.5 }, children: [_jsx(Typography, { sx: { fontSize: 13 }, children: t('settlements.cancelConfirm') }), _jsx(TextField, { size: "small", multiline: true, minRows: 2, label: t('settlements.cancelReason'), value: comment, onChange: (e) => setComment(e.target.value) }), error && _jsx(Alert, { severity: "error", children: t(error) })] }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.back') }), _jsx(Button, { variant: "contained", color: "error", onClick: () => void cancel(), children: t('settlements.cancel') })] })] }));
}
