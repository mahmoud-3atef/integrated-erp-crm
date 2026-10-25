import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import { Alert, Box, Button, LinearProgress, Link, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workforceApi } from '../../api/workforce';
import { useCrumb } from '../../app/breadcrumbs';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { DateField } from '../../components/DateField';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { ApprovalBar, ShownStatus, useRecordApproval } from '../../components/workflow/RecordApproval';
import { Frame, useSave } from '../staff/StaffDialogs';
const salaryParts = ['basic', 'housing', 'food', 'transport', 'overtime', 'other', 'project', 'hardship'];
const nz = (value) => (value.trim() === '' ? null : value.trim());
const num = (value) => (value.trim() === '' ? null : Number(value));
const text = (value) => (value === null ? '' : String(value));
const money = (value) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** The edit form's lists (nationalities and professions), loaded once per dialog. */
function useOptions() {
    const [options, setOptions] = useState(null);
    useEffect(() => {
        workforceApi.editOptions().then(setOptions).catch(() => setOptions({ nationalities: [], professions: [] }));
    }, []);
    return options;
}
/** Tells the editor that the old system still wins in the parallel phase (the user's decision, 2026-10-25). */
function SyncNote() {
    const { t } = useTranslation();
    return _jsx(Alert, { severity: "info", children: t('workforce.edit.syncNote') });
}
/**
 * All of a worker's data (the user's decision, 2026-10-25), with «workforce.workers.edit»: identity, job, contract and
 * leave. The project, the status and the work days come from the movements and are not edited here.
 */
export function WorkerDataDialog({ worker, onClose, onSaved }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const options = useOptions();
    const w = worker.summary;
    const iqama = worker.identifiers.find((i) => i.type === 'Iqama' && i.isCurrent);
    const [f, setF] = useState({
        nameEn: w.name,
        nameAr: worker.nameAr ?? '',
        iqama: iqama?.number ?? '',
        iqamaExpiresOn: iqama?.expiresOn ?? '',
        nationalityCode: worker.nationalityCode ?? '',
        arrivedOn: worker.arrivedOn ?? '',
        professionCode: worker.professionCode ?? '',
        iqamaProfessionCode: worker.iqamaProfessionCode ?? '',
        sponsor: w.sponsor ?? '',
        recruitmentAgent: worker.recruitmentAgent ?? '',
        contractStartsOn: worker.contract.startsOn ?? '',
        contractMonths: text(worker.contract.months),
        contractEndsOn: worker.contract.endsOn ?? '',
        annualLeaveDays: text(worker.leave.annualDays),
        leaveBalance: text(worker.leave.balance),
        leaveConsumed: text(worker.leave.consumed),
        leaveOldConsumed: text(worker.leave.oldConsumed),
        leaveRemaining: text(worker.leave.remaining),
    });
    const set = (key) => (value) => setF((x) => ({ ...x, [key]: value }));
    const { busy, error, run } = useSave(onSaved);
    const pick = (list, key, label) => (_jsxs(TextField, { select: true, size: "small", label: label, value: f[key], onChange: (e) => set(key)(e.target.value), disabled: !list, children: [_jsx(MenuItem, { value: "", children: "\u2014" }), (list ?? []).map((o) => (_jsx(MenuItem, { value: o.code, children: ar ? o.nameAr : o.nameEn }, o.code)))] }));
    const save = () => void run(() => workforceApi.saveData(w.id, {
        nameEn: f.nameEn.trim(),
        nameAr: nz(f.nameAr),
        iqama: nz(f.iqama),
        iqamaExpiresOn: nz(f.iqamaExpiresOn),
        nationalityCode: nz(f.nationalityCode),
        arrivedOn: nz(f.arrivedOn),
        professionCode: nz(f.professionCode),
        iqamaProfessionCode: nz(f.iqamaProfessionCode),
        sponsor: nz(f.sponsor),
        recruitmentAgent: nz(f.recruitmentAgent),
        contractStartsOn: nz(f.contractStartsOn),
        contractMonths: num(f.contractMonths),
        contractEndsOn: nz(f.contractEndsOn),
        annualLeaveDays: num(f.annualLeaveDays),
        leaveBalance: num(f.leaveBalance),
        leaveConsumed: num(f.leaveConsumed),
        leaveOldConsumed: num(f.leaveOldConsumed),
        leaveRemaining: num(f.leaveRemaining),
    }));
    const grid = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 };
    const date = (key, label) => _jsx(DateField, { size: "small", label: label, value: f[key], onChange: (e) => set(key)(e.target.value), slotProps: { inputLabel: { shrink: true } } });
    const number = (key, label) => (_jsx(TextField, { size: "small", type: "number", label: label, value: f[key], onChange: (e) => set(key)(e.target.value), slotProps: { htmlInput: { min: 0, step: 'any' } } }));
    return (_jsxs(Frame, { open: true, title: t('workforce.edit.dataTitle'), busy: busy, error: error, onClose: onClose, saveDisabled: !f.nameEn.trim(), onSave: save, children: [_jsx(SyncNote, {}), _jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy800 }, children: t('workforce.sections.basic') }), _jsxs(Box, { sx: grid, children: [_jsx(TextField, { size: "small", required: true, label: t('workforce.edit.nameEn'), value: f.nameEn, onChange: (e) => set('nameEn')(e.target.value), slotProps: { htmlInput: { maxLength: 300, dir: 'ltr' } } }), _jsx(TextField, { size: "small", label: t('workforce.edit.nameAr'), value: f.nameAr, onChange: (e) => set('nameAr')(e.target.value), slotProps: { htmlInput: { maxLength: 300 } } }), _jsx(TextField, { size: "small", label: t('workforce.field.iqama'), value: f.iqama, onChange: (e) => set('iqama')(e.target.value), slotProps: { htmlInput: { maxLength: 50, dir: 'ltr' } } }), date('iqamaExpiresOn', t('workforce.overview.iqamaEnds')), pick(options?.nationalities, 'nationalityCode', t('workforce.col.nationality')), date('arrivedOn', t('workforce.field.arrived'))] }), _jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy800 }, children: t('workforce.sections.job') }), _jsxs(Box, { sx: grid, children: [pick(options?.professions, 'professionCode', t('workforce.col.profession')), pick(options?.professions, 'iqamaProfessionCode', t('workforce.field.iqamaProfession')), _jsx(TextField, { size: "small", label: t('workforce.col.sponsor'), value: f.sponsor, onChange: (e) => set('sponsor')(e.target.value), slotProps: { htmlInput: { maxLength: 100, dir: 'ltr' } } }), _jsx(TextField, { size: "small", label: t('workforce.field.agent'), value: f.recruitmentAgent, onChange: (e) => set('recruitmentAgent')(e.target.value), slotProps: { htmlInput: { maxLength: 200 } } })] }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('workforce.edit.projectNote') }), _jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy800 }, children: t('workforce.sections.contract') }), _jsxs(Box, { sx: grid, children: [date('contractStartsOn', t('workforce.field.contractStart')), number('contractMonths', t('workforce.field.contractMonths')), date('contractEndsOn', t('workforce.field.contractEnd'))] }), _jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy800 }, children: t('workforce.sections.leave') }), _jsxs(Box, { sx: grid, children: [number('annualLeaveDays', t('workforce.leave.annual')), number('leaveBalance', t('workforce.leave.balance')), number('leaveOldConsumed', t('workforce.leave.oldConsumed')), number('leaveConsumed', t('workforce.leave.consumed')), number('leaveRemaining', t('workforce.leave.remaining'))] })] }));
}
function SalaryFields({ value, onChange }) {
    const { t } = useTranslation();
    const total = salaryParts.reduce((s, k) => s + (Number(value[k]) || 0), 0);
    return (_jsxs(_Fragment, { children: [_jsx(Box, { sx: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }, children: salaryParts.map((k) => (_jsx(TextField, { type: "number", size: "small", label: t(`workforce.salary.${k}`), value: value[k], onChange: (e) => onChange({ ...value, [k]: Number(e.target.value) || 0 }), slotProps: { htmlInput: { min: 0, step: 'any' } } }, k))) }), _jsxs(Typography, { sx: { fontWeight: 700, color: '#1f9d55' }, children: [t('workforce.salary.total'), ": ", _jsx("bdi", { children: money(total) })] })] }));
}
const partsOf = (s) => ({ basic: s.basic, housing: s.housing, food: s.food, transport: s.transport, overtime: s.overtime, other: s.other, project: s.project, hardship: s.hardship });
/**
 * The salary: changed directly («workforce.workers.salary_edit»), or asked for with an effective date and a reason
 * («workforce.salary_changes.request»), which goes through approval and changes the file only once approved.
 */
export function WorkerSalaryDialog({ workerId, salary, request, onClose, onSaved }) {
    const { t } = useTranslation();
    const [value, setValue] = useState(partsOf(salary));
    const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
    const [reason, setReason] = useState('');
    const created = useRef(undefined);
    const { busy, error, run } = useSave(() => onSaved(created.current));
    const save = () => void run(async () => {
        if (request) {
            const result = await workforceApi.requestSalaryChange(workerId, { salary: value, effectiveFrom: from, reason: nz(reason) });
            created.current = result.id;
        }
        else {
            await workforceApi.saveSalary(workerId, value);
        }
    });
    return (_jsxs(Frame, { open: true, title: t(request ? 'workforce.edit.requestTitle' : 'workforce.edit.salaryTitle'), busy: busy, error: error, onClose: onClose, saveDisabled: request && !reason.trim(), onSave: save, children: [request ? _jsx(Alert, { severity: "info", children: t('workforce.edit.requestHint') }) : _jsx(SyncNote, {}), request && _jsx(DateField, { size: "small", label: t('workforce.edit.effectiveFrom'), value: from, onChange: (e) => setFrom(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(SalaryFields, { value: value, onChange: setValue }), request && _jsx(TextField, { label: t('workforce.edit.reason'), value: reason, onChange: (e) => setReason(e.target.value), required: true, multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 1000 } } })] }));
}
/** A salary change's state as a small badge. */
function ChangeStatus({ status }) {
    const { t } = useTranslation();
    const look = { InApproval: ['#8A5700', '#FFF4DB'], Applied: ['#16734B', '#EAF6EF'], Returned: ['#475569', '#F1F5F9'], Rejected: ['#B42318', '#FEECEB'] }[status];
    return (_jsx(Box, { component: "span", sx: { px: 1.1, py: 0.3, borderRadius: 999, fontSize: 12, fontWeight: 600, color: look[0], bgcolor: look[1], whiteSpace: 'nowrap' }, children: t(`workforce.edit.status.${status}`) }));
}
/** The worker's salary changes under the salary box (for those who see salaries). */
export function SalaryChangesList({ workerId, version }) {
    const { t } = useTranslation();
    const [rows, setRows] = useState(null);
    useEffect(() => {
        workforceApi.salaryChanges(workerId).then(setRows).catch(() => setRows([]));
    }, [workerId, version]);
    if (!rows || rows.length === 0)
        return null;
    return (_jsxs(Box, { sx: { gridColumn: '1 / -1', mt: 0.5 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, mb: 0.75 }, children: t('workforce.edit.changes') }), _jsx(Stack, { spacing: 0.75, children: rows.map((c) => (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, flexWrap: 'wrap', fontSize: 13, p: 1, borderRadius: '10px', border: `1px solid ${tokens.border}` }, children: [_jsx(Link, { component: RouterLink, to: `/workforce/salary-changes/${c.id}`, sx: { fontWeight: 700 }, children: _jsx("bdi", { children: c.changeNo }) }), _jsx(ChangeStatus, { status: c.status }), _jsxs(Box, { component: "span", sx: { flex: 1, color: tokens.gray600, fontVariantNumeric: 'tabular-nums' }, children: [_jsx("bdi", { children: money(c.oldSalary.total) }), " \u2190 ", _jsx("bdi", { children: money(c.newSalary.total) })] }), _jsx(Box, { component: "span", sx: { color: tokens.gray500, fontSize: 12 }, children: _jsx("bdi", { children: c.effectiveFrom }) })] }, c.id))) })] }));
}
/** A salary change (/workforce/salary-changes/:id): its approval bar, the salary before and after, and the reason. */
export function SalaryChangePage() {
    const { id = '' } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [c, setC] = useState(null);
    const [error, setError] = useState(null);
    const approval = useRecordApproval(c?.approval?.instanceId);
    useCrumb(c?.changeNo, `/workforce/salary-changes/${id}`);
    const reload = useCallback(async () => {
        try {
            setC(await workforceApi.salaryChange(id));
            setError(null);
        }
        catch (f) {
            setError(errorKey(f));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    if (!c) {
        return (_jsxs(_Fragment, { children: [_jsx(ErrorMessage, { messageKey: error }), !error && _jsx(LinearProgress, {})] }));
    }
    const done = () => {
        void reload();
        void approval.reload();
    };
    return (_jsxs(Box, { children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }, children: [_jsx(Box, { sx: { width: 46, height: 46, borderRadius: '12px', bgcolor: '#e9f7ef', color: '#1f9d55', display: 'grid', placeItems: 'center' }, children: _jsx(PaidOutlinedIcon, {}) }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsxs(Typography, { component: "h1", sx: { fontSize: 21, fontWeight: 700, color: tokens.navy800 }, children: [t('workforce.edit.changeTitle'), " ", _jsx("bdi", { children: c.changeNo })] }), _jsxs(Typography, { sx: { fontSize: 13, color: tokens.gray600 }, children: [_jsx(Link, { component: RouterLink, to: `/workforce/workers/${c.workerId}`, children: _jsx("bdi", { children: c.workerName }) }), ' ', "\u00B7 ", _jsx("bdi", { children: c.workerNo }), " \u00B7 ", t('workforce.edit.requestedBy', { by: c.requestedBy })] })] }), _jsx(ShownStatus, { approval: approval.detail, children: _jsx(ChangeStatus, { status: c.status }) }), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') } }), onClick: () => navigate(-1), children: t('common.back') })] }), _jsx(ErrorMessage, { messageKey: error }), c.approval && _jsx(ApprovalBar, { status: c.approval, detail: approval.detail, onChanged: done }), c.lastComment && c.status !== 'Applied' && (_jsx(Alert, { severity: c.status === 'Rejected' ? 'error' : 'warning', sx: { mb: 2 }, children: c.lastComment })), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, display: 'grid', gap: 2.5 }, children: [_jsxs(FieldSection, { title: t('workforce.edit.changeTitle'), icon: _jsx(PaidOutlinedIcon, {}), tone: "green", children: [_jsx(FieldBox, { label: t('workforce.edit.effectiveFrom'), icon: _jsx(PaidOutlinedIcon, {}), children: _jsx("bdi", { children: c.effectiveFrom }) }), _jsx(FieldBox, { label: t('workforce.edit.difference'), icon: _jsx(PaidOutlinedIcon, {}), children: _jsx("bdi", { children: money(c.newSalary.total - c.oldSalary.total) }) }), c.reason && (_jsx(FieldBox, { label: t('workforce.edit.reason'), icon: _jsx(PaidOutlinedIcon, {}), wide: true, multiline: true, children: c.reason }))] }), _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.edit.part') }), _jsx(TableCell, { align: "center", children: t('workforce.edit.before') }), _jsx(TableCell, { align: "center", children: t('workforce.edit.after') })] }) }), _jsx(TableBody, { children: [...salaryParts, 'total'].map((k) => (_jsxs(TableRow, { sx: k === 'total' ? { '& td': { fontWeight: 800 } } : undefined, children: [_jsx(TableCell, { children: t(`workforce.salary.${k}`) }), _jsx(TableCell, { align: "center", children: _jsx("bdi", { children: money(c.oldSalary[k]) }) }), _jsx(TableCell, { align: "center", sx: { color: c.newSalary[k] !== c.oldSalary[k] ? '#1d4f91' : undefined, fontWeight: c.newSalary[k] !== c.oldSalary[k] ? 700 : undefined }, children: _jsx("bdi", { children: money(c.newSalary[k]) }) })] }, k))) })] })] })] }));
}
