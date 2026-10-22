import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import WorkHistoryOutlinedIcon from '@mui/icons-material/WorkHistoryOutlined';
import { Alert, Box, Button, ButtonBase, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, Link, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { actionKinds, staffApi } from '../../api/staff';
import { useCrumb } from '../../app/breadcrumbs';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval, ShownStatus } from '../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { useLegalEntities } from '../payroll/RunDialogs';
import { DateField } from '../../components/DateField';
// Employment actions: a request on an employee through the approval process, applied to the file when approved.
export const actionIcon = {
    Promotion: _jsx(TrendingUpOutlinedIcon, {}),
    Transfer: _jsx(SwapHorizOutlinedIcon, {}),
    SalaryChange: _jsx(PaymentsOutlinedIcon, {}),
    Acting: _jsx(AssignmentIndOutlinedIcon, {}),
    ConfirmProbation: _jsx(CheckCircleOutlineOutlinedIcon, {}),
    ExtendProbation: _jsx(EventRepeatOutlinedIcon, {}),
    EndProbation: _jsx(LogoutOutlinedIcon, {}),
    RenewContract: _jsx(AutorenewIcon, {}),
    NotRenew: _jsx(BlockOutlinedIcon, {}),
};
const statusLook = {
    Draft: { color: '#475569', tint: '#F1F5F9' },
    InApproval: { color: hr.primary, tint: '#EFF6FF' },
    Returned: { color: '#B45309', tint: '#FEF3C7' },
    Rejected: { color: hr.danger, tint: '#FEE2E2' },
    Applied: { color: hr.success, tint: '#D1FAE5' },
    Cancelled: { color: hr.danger, tint: '#FEE2E2' },
};
export function ActionStatusBadge({ status }) {
    const { t } = useTranslation();
    return _jsx(HrStatusBadge, { label: t(`staffActions.status.${status}`), ...statusLook[status] });
}
/** Which actions fit the employee now (a probation decision only on probation, not renewing only with an end date). */
const kindsFor = (p) => actionKinds.filter((k) => {
    if (k === 'ConfirmProbation' || k === 'ExtendProbation' || k === 'EndProbation')
        return p.status === 'Probation';
    if (k === 'NotRenew')
        return p.contractEndsOn !== null;
    if (k === 'SalaryChange')
        return p.canChangeSalary;
    return true;
});
const salaryKeys = ['basic', 'housing', 'food', 'transport', 'mobile', 'project', 'other'];
const salaryLabel = { basic: 'basic', housing: 'housing', food: 'food', transport: 'transport', mobile: 'mobileAllowance', project: 'project', other: 'other' };
export function ActionDialog({ profile, departments, onClose, onSent }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const entities = useLegalEntities();
    const kinds = kindsFor(profile);
    const [kind, setKind] = useState(kinds[0] ?? 'Transfer');
    const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
    const [reason, setReason] = useState('');
    const [entity, setEntity] = useState('');
    const [department, setDepartment] = useState('');
    const [position, setPosition] = useState('');
    const [withSalary, setWithSalary] = useState(false);
    const s = profile.salary;
    const [salary, setSalary] = useState(s ? { basic: s.basic, housing: s.housing, food: s.food, transport: s.transport, mobile: s.mobile, project: s.project, other: s.other } : { basic: 0, housing: 0, food: 0, transport: 0, mobile: 0, project: 0, other: 0 });
    const [until, setUntil] = useState('');
    const [allowance, setAllowance] = useState('');
    const [contractKind, setContractKind] = useState('Fixed');
    const [months, setMonths] = useState('12');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const allPositions = departments.flatMap((d) => d.positions.filter((p) => p.isActive).map((p) => ({ id: p.id, departmentId: d.id, label: `${ar ? p.jobTitleAr : p.jobTitleEn} — ${ar ? d.nameAr : d.nameEn} (${p.occupants.length}/${p.seats})` })));
    const positions = department ? allPositions.filter((p) => p.departmentId === department) : allPositions;
    const needsSalary = kind === 'SalaryChange' || ((kind === 'Promotion' || kind === 'Transfer') && withSalary);
    const total = salaryKeys.reduce((sum, k) => sum + (Number(salary[k]) || 0), 0);
    const send = async () => {
        setBusy(true);
        setError(null);
        try {
            const r = await staffApi.requestAction(profile.id, {
                kind,
                effectiveFrom: from,
                reason: reason.trim(),
                newLegalEntityId: kind === 'Transfer' && entity ? entity : null,
                newDepartmentId: (kind === 'Transfer' || kind === 'Promotion') && department ? department : null,
                newPositionId: (kind === 'Transfer' || kind === 'Promotion' || kind === 'Acting') && position ? position : null,
                newSalary: needsSalary && profile.canChangeSalary ? salary : null,
                actingAllowance: kind === 'Acting' ? Number(allowance) || 0 : null,
                actingUntil: kind === 'Acting' && until ? until : null,
                newProbationEndsOn: kind === 'ExtendProbation' && until ? until : null,
                newContractKind: kind === 'RenewContract' ? contractKind : null,
                newContractMonths: kind === 'RenewContract' && contractKind === 'Fixed' ? Number(months) || null : null,
                newContractEndsOn: null,
            });
            onSent(r.id);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "md", slotProps: { paper: { sx: { borderRadius: '18px' } } }, children: [_jsxs(DialogTitle, { sx: { fontWeight: 800 }, children: [t('staffActions.new'), " \u00B7 ", _jsx("span", { style: { color: hr.textMuted, fontWeight: 600 }, children: profile.nameAr ?? profile.nameEn })] }), _jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 2 }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Typography, { sx: { fontWeight: 700, fontSize: 13 }, children: t('staffActions.choose') }), _jsx(Box, { sx: { display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }, role: "radiogroup", children: kinds.map((k) => (_jsxs(ButtonBase, { role: "radio", "aria-checked": kind === k, onClick: () => setKind(k), sx: { justifyContent: 'flex-start', textAlign: 'start', gap: 1.25, p: 1.25, borderRadius: '12px', border: `1.5px solid ${kind === k ? hr.primary : hr.border}`, bgcolor: kind === k ? '#EFF6FF' : '#fff', '& svg': { color: kind === k ? hr.primary : hr.textMuted } }, children: [actionIcon[k], _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 13 }, children: t(`staffActions.kind.${k}`) }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted, lineHeight: 1.4 }, children: t(`staffActions.kindHint.${k}`) })] })] }, k))) }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 1.5 }, children: [_jsx(DateField, { label: t('staffActions.effectiveFrom'), value: from, onChange: (e) => setFrom(e.target.value), slotProps: { inputLabel: { shrink: true } }, sx: { minWidth: 200 } }), kind === 'Transfer' && (_jsxs(TextField, { select: true, label: t('staffActions.newLegalEntity'), value: entity, onChange: (e) => setEntity(e.target.value), fullWidth: true, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staffActions.keep') }), entities.map((e) => (_jsx(MenuItem, { value: e.id, children: localName(e, i18n.language) }, e.id)))] }))] }), (kind === 'Transfer' || kind === 'Promotion' || kind === 'Acting') && (_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 1.5 }, children: [kind !== 'Acting' && (_jsxs(TextField, { select: true, label: t('staffActions.newDepartment'), value: department, onChange: (e) => (setDepartment(e.target.value), setPosition('')), fullWidth: true, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staffActions.keep') }), departments.map((d) => (_jsx(MenuItem, { value: d.id, children: ar ? d.nameAr : d.nameEn }, d.id)))] })), _jsxs(TextField, { select: true, label: kind === 'Acting' ? t('staffActions.actingPosition') : t('staffActions.newPosition'), value: position, onChange: (e) => setPosition(e.target.value), fullWidth: true, required: kind !== 'Transfer', slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staffActions.keep') }), positions.map((p) => (_jsx(MenuItem, { value: p.id, children: p.label }, p.id)))] })] })), kind === 'Acting' && (_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 1.5 }, children: [_jsx(DateField, { label: t('staffActions.actingUntil'), value: until, onChange: (e) => setUntil(e.target.value), slotProps: { inputLabel: { shrink: true } }, fullWidth: true, required: true }), _jsx(TextField, { type: "number", label: t('staffActions.actingAllowance'), value: allowance, onChange: (e) => setAllowance(e.target.value), fullWidth: true })] })), kind === 'ExtendProbation' && _jsx(DateField, { label: t('staffActions.probationUntil'), value: until, onChange: (e) => setUntil(e.target.value), slotProps: { inputLabel: { shrink: true } }, required: true }), kind === 'RenewContract' && (_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 1.5 }, children: [_jsxs(TextField, { select: true, label: t('staffActions.contractKind'), value: contractKind, onChange: (e) => setContractKind(e.target.value), fullWidth: true, children: [_jsx(MenuItem, { value: "Fixed", children: t('staffActions.contractKinds.Fixed') }), _jsx(MenuItem, { value: "Open", children: t('staffActions.contractKinds.Open') })] }), contractKind === 'Fixed' && _jsx(TextField, { type: "number", label: t('staffActions.contractMonths'), value: months, onChange: (e) => setMonths(e.target.value), fullWidth: true })] })), (kind === 'Promotion' || kind === 'Transfer') && profile.canChangeSalary && (_jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: withSalary, onChange: (e) => setWithSalary(e.target.checked) }), label: t('staffActions.withSalary') })), needsSalary && profile.canChangeSalary && (_jsxs(_Fragment, { children: [_jsx(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }, children: salaryKeys.map((k) => (_jsx(TextField, { type: "number", size: "small", label: t(`staff.profile.fields.${salaryLabel[k]}`), value: salary[k], onChange: (e) => setSalary({ ...salary, [k]: Number(e.target.value) }) }, k))) }), _jsxs(Typography, { sx: { fontWeight: 700, color: hr.success }, children: [t('staff.profile.fields.total'), ": ", _jsx("bdi", { children: total.toLocaleString('en-US') }), s && _jsxs("span", { style: { color: hr.textMuted, fontWeight: 500 }, children: [" (", t('staffActions.before'), ": ", _jsx("bdi", { children: s.total.toLocaleString('en-US') }), ")"] })] })] })), _jsx(TextField, { label: t('staffActions.reason'), value: reason, onChange: (e) => setReason(e.target.value), required: true, multiline: true, minRows: 2 }), _jsx(Alert, { severity: "info", children: t('staffActions.sendHint') })] }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), onClick: () => void send(), disabled: busy || !reason.trim(), children: t('staffActions.send') })] })] }));
}
/** One action: what it changes (before → after), the request, and its approval. */
export function StaffActionPage() {
    const { id = '' } = useParams();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { date } = useCommercialFormat();
    const ar = i18n.language === 'ar';
    const [a, setA] = useState(null);
    const [error, setError] = useState(null);
    const [amending, setAmending] = useState(false);
    const [cancelling, setCancelling] = useState(null);
    const approval = useRecordApproval(a?.approval?.instanceId);
    useCrumb(a?.actionNo, `/hr/actions/${id}`);
    const reload = useCallback(async () => {
        try {
            setA(await staffApi.action(id));
            setError(null);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    if (!a) {
        return (_jsxs(HrScope, { children: [_jsx(ErrorMessage, { messageKey: error }), !error && _jsx(LinearProgress, {})] }));
    }
    const name = (r) => (r ? (ar ? r.nameAr : r.nameEn) : '—');
    const money = (n) => (n === null ? '—' : n.toLocaleString('en-US'));
    const d = (v) => (v ? date(v) : '—');
    const rows = [];
    if (['Promotion', 'Transfer'].includes(a.kind)) {
        if (name(a.before.legalEntity) !== name(a.after.legalEntity))
            rows.push([t('staffActions.field.legalEntity'), name(a.before.legalEntity), name(a.after.legalEntity)]);
        rows.push([t('staffActions.field.department'), name(a.before.department), name(a.after.department)]);
        rows.push([t('staffActions.field.jobTitle'), name(a.before.jobTitle), name(a.after.jobTitle)]);
        rows.push([t('staffActions.field.grade'), a.before.grade ?? '—', a.after.grade ?? '—']);
    }
    if (a.kind === 'Acting')
        rows.push([t('staffActions.field.acting'), name(a.before.jobTitle), t('staffActions.actingValue', { title: name(a.after.jobTitle), date: d(a.actingUntil), amount: money(a.actingAllowance) })]);
    if (a.newSalaryTotal !== null)
        rows.push([t('staffActions.field.salary'), money(a.oldSalaryTotal), money(a.newSalaryTotal)]);
    if (a.kind === 'ExtendProbation' || a.kind === 'ConfirmProbation')
        rows.push([t('staffActions.field.probation'), d(a.oldProbationEndsOn), a.kind === 'ConfirmProbation' ? t('staffActions.kind.ConfirmProbation') : d(a.newProbationEndsOn)]);
    if (a.kind === 'EndProbation')
        rows.push([t('staffActions.ends'), '—', d(a.effectiveFrom)]);
    if (a.kind === 'RenewContract')
        rows.push([t('staffActions.field.contract'), d(a.oldContractEndsOn), t('staffActions.contractValue', { kind: t(`staffActions.contractKinds.${a.newContractKind ?? 'Fixed'}`), months: a.newContractMonths ? ` · ${a.newContractMonths} ${t('staff.profile.fields.months')}` : '' })]);
    if (a.kind === 'NotRenew')
        rows.push([t('staffActions.ends'), '—', d(a.oldContractEndsOn)]);
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: actionIcon[a.kind], title: t(`staffActions.kind.${a.kind}`), status: _jsx(ShownStatus, { approval: approval.detail, children: _jsx(ActionStatusBadge, { status: a.status }) }), reference: a.actionNo, subtitle: _jsxs(_Fragment, { children: [_jsx(Link, { component: RouterLink, to: `/hr/employees/${a.employeeId}`, children: a.employeeName }), ' ', "\u00B7 ", _jsx("bdi", { children: a.employeeNo }), " \u00B7 ", t('staffActions.effectiveFrom'), " ", _jsx("bdi", { children: date(a.effectiveFrom) })] }), actions: _jsxs(_Fragment, { children: [a.canResubmit && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), onClick: () => void staffApi.resubmit(a.id).then(reload).catch((f) => setError(errorKey(f))), children: t('staffActions.resubmit') })), a.canAmend && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditNoteOutlinedIcon, {}), onClick: () => setAmending(true), children: t('staffActions.amend.action') })), a.canCancelApproved && (_jsx(Button, { variant: "outlined", color: "error", startIcon: _jsx(CancelOutlinedIcon, {}), onClick: () => setCancelling(''), children: t('staffActions.amend.cancelAction') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') } }), onClick: () => navigate(-1), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), a.amendedAt && a.status === 'Applied' && (_jsxs(Alert, { severity: "info", sx: { mb: 1.5 }, children: [t('staffActions.amend.amendedBy', { by: a.amendedByName, date: date(a.amendedAt.slice(0, 10)) }), " \u2014 ", a.amendNote] })), a.canceledAt && (_jsx(Alert, { severity: "warning", sx: { mb: 1.5 }, children: t('staffActions.amend.canceledBy', { by: a.canceledByName, date: date(a.canceledAt.slice(0, 10)) }) })), a.approval && (_jsx(ApprovalBar, { status: a.approval, detail: approval.detail, onChanged: () => {
                    void reload();
                    void approval.reload();
                } })), _jsxs(Box, { sx: { display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, alignItems: 'start' }, children: [_jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 1.25 }, children: t('staffActions.changes') }), _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, {}), _jsx(TableCell, { children: t('staffActions.before') }), _jsx(TableCell, { children: t('staffActions.after') })] }) }), _jsx(TableBody, { children: rows.map(([label, before, after]) => (_jsxs(TableRow, { children: [_jsx(TableCell, { sx: { color: hr.textMuted, fontWeight: 600 }, children: label }), _jsx(TableCell, { sx: { color: hr.textMuted, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: before }) }), _jsx(TableCell, { sx: { fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: after }) })] }, label))) })] })] }), _jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 1 }, children: t('staffActions.details') }), _jsx(Typography, { sx: { fontSize: 13.5, mb: 1.25, whiteSpace: 'pre-wrap' }, children: a.reason }), _jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: t('staffActions.requestedBy', { by: a.createdByName, date: date(a.createdAt.slice(0, 10)) }) }), a.appliedAt && _jsx(Typography, { sx: { fontSize: 12.5, color: hr.success, mt: 0.5 }, children: t('staffActions.appliedOn', { date: date(a.appliedAt.slice(0, 10)) }) }), a.lastComment && _jsx(Alert, { severity: a.status === 'Applied' ? 'success' : 'warning', sx: { mt: 1.25 }, children: a.lastComment })] })] }), amending && (_jsx(ActionAmendDialog, { action: a, onClose: () => setAmending(false), onSaved: () => {
                    setAmending(false);
                    void reload();
                } })), cancelling !== null && (_jsx(Dialog, { open: true, onClose: () => setCancelling(null), maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('staffActions.amend.cancelAction') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Typography, { sx: { fontSize: 13 }, children: t('staffActions.amend.cancelHint') }), _jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('staffActions.amend.reason'), value: cancelling, onChange: (e) => setCancelling(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", color: "error", disabled: !cancelling.trim(), onClick: () => void staffApi
                                        .cancelApprovedAction(a.id, cancelling.trim())
                                        .then(() => (setCancelling(null), reload()))
                                        .catch((f) => (setCancelling(null), setError(errorKey(f)))), children: t('staffActions.amend.cancelAction') }), _jsx(Button, { onClick: () => setCancelling(null), children: t('common.back') })] })] }) }))] }));
}
/**
 * Changing an applied action (its kind's own permission): taken back and applied again with its new effective day and
 * values (the salary, the acting's end and allowance, the probation's end, the renewal's months or end).
 */
function ActionAmendDialog({ action: a, onClose, onSaved }) {
    const { t } = useTranslation();
    const [effectiveFrom, setEffectiveFrom] = useState(a.effectiveFrom);
    const [salary, setSalary] = useState(() => Object.fromEntries(salaryKeys.map((k) => [k, a.newSalary ? String(a.newSalary[k]) : '0'])));
    const [allowance, setAllowance] = useState(a.actingAllowance === null ? '' : String(a.actingAllowance));
    const [actingUntil, setActingUntil] = useState(a.actingUntil ?? '');
    const [probationEnds, setProbationEnds] = useState(a.newProbationEndsOn ?? '');
    const [months, setMonths] = useState(a.newContractMonths === null ? '' : String(a.newContractMonths));
    const [why, setWhy] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const withSalary = a.newSalary !== null && a.canSeeSalary;
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await staffApi.amendAction(a.id, {
                effectiveFrom,
                newSalary: withSalary ? Object.fromEntries(salaryKeys.map((k) => [k, Number(salary[k]) || 0])) : null,
                actingAllowance: a.kind === 'Acting' ? Number(allowance) || 0 : null,
                actingUntil: a.kind === 'Acting' ? actingUntil || null : null,
                newProbationEndsOn: a.kind === 'ExtendProbation' ? probationEnds || null : null,
                newContractMonths: a.kind === 'RenewContract' && months ? Number(months) : null,
                newContractEndsOn: a.kind === 'RenewContract' && !months ? a.newContractEndsOn : null,
                amendReason: why.trim(),
            });
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "sm", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('staffActions.amend.title', { no: a.actionNo }) }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Alert, { severity: "info", children: t('staffActions.amend.hint') }), _jsx(DateField, { size: "small", label: t('staffActions.effectiveFrom'), value: effectiveFrom, onChange: (e) => setEffectiveFrom(e.target.value), slotProps: { inputLabel: { shrink: true } } }), withSalary && (_jsx(Box, { sx: { display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' } }, children: salaryKeys.map((k) => (_jsx(TextField, { size: "small", type: "number", label: t(`staff.profile.fields.${salaryLabel[k]}`), value: salary[k], onChange: (e) => setSalary((s) => ({ ...s, [k]: e.target.value })), slotProps: { htmlInput: { min: 0, step: '0.01', dir: 'ltr' } } }, k))) })), a.kind === 'Acting' && (_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 1.5 }, children: [_jsx(DateField, { size: "small", label: t('staffActions.field.actingUntil'), value: actingUntil, onChange: (e) => setActingUntil(e.target.value), slotProps: { inputLabel: { shrink: true } }, sx: { flex: 1 } }), _jsx(TextField, { size: "small", type: "number", label: t('staffActions.field.actingAllowance'), value: allowance, onChange: (e) => setAllowance(e.target.value), slotProps: { htmlInput: { min: 0, dir: 'ltr' } }, sx: { flex: 1 } })] })), a.kind === 'ExtendProbation' && (_jsx(DateField, { size: "small", label: t('staffActions.field.probation'), value: probationEnds, onChange: (e) => setProbationEnds(e.target.value), slotProps: { inputLabel: { shrink: true } } })), a.kind === 'RenewContract' && a.newContractKind !== 'Open' && (_jsx(TextField, { size: "small", type: "number", label: t('staff.profile.fields.months'), value: months, onChange: (e) => setMonths(e.target.value), slotProps: { htmlInput: { min: 1, dir: 'ltr' } } })), _jsx(TextField, { size: "small", required: true, multiline: true, minRows: 2, label: t('staffActions.amend.reason'), value: why, onChange: (e) => setWhy(e.target.value), slotProps: { htmlInput: { maxLength: 500 } } }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", startIcon: _jsx(EditNoteOutlinedIcon, {}), disabled: busy || !why.trim() || !effectiveFrom, onClick: () => void save(), children: t('staffActions.amend.save') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.back') })] })] }) }));
}
/** Every employment action, newest first, filtered by status. */
export function StaffActionsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { date } = useCommercialFormat();
    const [params, setParams] = useSearchParams();
    const status = params.get('status') ?? '';
    const [rows, setRows] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        staffApi.actions({ status }).then(setRows).catch((f) => setError(errorKey(f)));
    }, [status]);
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(WorkHistoryOutlinedIcon, {}), title: t('staffActions.title'), subtitle: t('staffActions.intro') }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsxs(TextField, { select: true, size: "small", label: t('staff.cols.status'), value: status, onChange: (e) => setParams(e.target.value ? { status: e.target.value } : {}, { replace: true }), sx: { width: 220, mb: 1.5 }, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staffActions.all') }), ['InApproval', 'Applied', 'Returned', 'Rejected'].map((s) => (_jsx(MenuItem, { value: s, children: t(`staffActions.status.${s}`) }, s)))] }), !rows ? (_jsx(LinearProgress, {})) : rows.length === 0 ? (_jsx(HrEmptyState, { icon: _jsx(WorkHistoryOutlinedIcon, {}), title: t('staffActions.none') })) : (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 46 } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('staffActions.cols.no') }), _jsx(TableCell, { children: t('staffActions.cols.employee') }), _jsx(TableCell, { children: t('staffActions.cols.kind') }), _jsx(TableCell, { children: t('staffActions.cols.effective') }), _jsx(TableCell, { children: t('staffActions.cols.status') }), _jsx(TableCell, { children: t('staffActions.cols.by') })] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/hr/actions/${r.id}`), children: [_jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums', fontWeight: 600 }, children: _jsx("bdi", { children: r.actionNo }) }), _jsx(TableCell, { children: r.employeeName }), _jsx(TableCell, { children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75, '& svg': { fontSize: 18, color: hr.primary } }, children: [actionIcon[r.kind], t(`staffActions.kind.${r.kind}`)] }) }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums' }, children: date(r.effectiveFrom) }), _jsx(TableCell, { children: _jsx(ActionStatusBadge, { status: r.status }) }), _jsx(TableCell, { sx: { color: hr.textMuted }, children: r.createdByName })] }, r.id))) })] }) }))] })] }));
}
