import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { staffApi, staffStatuses } from '../../api/staff';
import { ErrorMessage } from '../../auth/AuthLayout';
import { useLegalEntities } from '../payroll/RunDialogs';
import { DateField } from '../../components/DateField';
// The employee file's dialogs: a new hire, and the edits of a box of the file (personal data, job, contract, salary).
const salaryKeys = ['basic', 'housing', 'food', 'transport', 'mobile', 'project', 'other'];
const salaryLabel = { basic: 'basic', housing: 'housing', food: 'food', transport: 'transport', mobile: 'mobileAllowance', project: 'project', other: 'other' };
const emptySalary = { basic: 0, housing: 0, food: 0, transport: 0, mobile: 0, project: 0, other: 0 };
const nz = (v) => (v.trim() === '' ? null : v.trim());
export function Frame({ open, title, busy, error, onClose, onSave, saveDisabled, children }) {
    const { t } = useTranslation();
    return (_jsxs(Dialog, { open: open, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "sm", slotProps: { paper: { sx: { borderRadius: '18px' } } }, children: [_jsx(DialogTitle, { sx: { fontWeight: 800 }, children: title }), _jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 2, pt: 1 }, children: [_jsx(ErrorMessage, { messageKey: error }), children] }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: onSave, disabled: busy || saveDisabled, children: t('common.save') })] })] }));
}
export function useSave(onDone) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const run = async (work) => {
        setBusy(true);
        setError(null);
        try {
            await work();
            onDone();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return { busy, error, run };
}
function SalaryFields({ value, onChange }) {
    const { t } = useTranslation();
    const total = salaryKeys.reduce((s, k) => s + (Number(value[k]) || 0), 0);
    return (_jsxs(_Fragment, { children: [_jsx(Stack, { sx: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }, children: salaryKeys.map((k) => (_jsx(TextField, { type: "number", size: "small", label: t(`staff.profile.fields.${salaryLabel[k]}`), value: value[k], onChange: (e) => onChange({ ...value, [k]: Number(e.target.value) }), slotProps: { htmlInput: { min: 0, step: 'any' } } }, k))) }), _jsxs(Typography, { sx: { fontWeight: 700, color: '#1f9d55' }, children: [t('staff.profile.fields.total'), ": ", _jsx("bdi", { children: total.toLocaleString('en-US') })] })] }));
}
/** The positions of a department with their free seats, for the job pickers. */
function positionsOf(departments, departmentId, language, t) {
    return (departments.find((d) => d.id === departmentId)?.positions ?? [])
        .filter((p) => p.isActive)
        .map((p) => ({ id: p.id, label: t('staff.dialogs.positionLabel', { title: language === 'ar' ? p.jobTitleAr : p.jobTitleEn, taken: p.occupants.length, seats: p.seats }) }));
}
export function PersonalDialog({ profile, onClose, onSaved }) {
    const { t, i18n } = useTranslation();
    const [v, setV] = useState({
        nameAr: profile.nameAr ?? '',
        nameEn: profile.nameEn,
        idNumber: profile.idNumber ?? '',
        nationalityCode: profile.nationalityCode ?? '',
        birthDate: profile.birthDate ?? '',
        mobile: profile.mobile ?? '',
        email: profile.email ?? '',
        gosiNo: profile.gosiNo ?? '',
    });
    const [nationalities, setNationalities] = useState([]);
    useEffect(() => {
        staffApi.nationalities().then(setNationalities).catch(() => setNationalities([]));
    }, []);
    const { busy, error, run } = useSave(onSaved);
    const field = (key, label, type = 'text') => (_jsx(TextField, { type: type, label: t(`staff.profile.fields.${label}`), value: v[key], onChange: (e) => setV({ ...v, [key]: e.target.value }), fullWidth: true, slotProps: type === 'date' ? { inputLabel: { shrink: true } } : undefined }));
    return (_jsxs(Frame, { open: true, title: t('staff.dialogs.personal'), busy: busy, error: error, onClose: onClose, saveDisabled: !v.nameEn.trim(), onSave: () => void run(() => staffApi.setPersonal(profile.id, { nameAr: nz(v.nameAr), nameEn: v.nameEn.trim(), idNumber: nz(v.idNumber), nationalityCode: nz(v.nationalityCode), birthDate: nz(v.birthDate), mobile: nz(v.mobile), email: nz(v.email), gosiNo: nz(v.gosiNo) })), children: [_jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [field('nameAr', 'nameAr'), field('nameEn', 'nameEn')] }), _jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [field('idNumber', 'idNumber'), _jsxs(TextField, { select: true, label: t('staff.profile.fields.nationality'), value: v.nationalityCode, onChange: (e) => setV({ ...v, nationalityCode: e.target.value }), fullWidth: true, children: [_jsx(MenuItem, { value: "", children: "\u2014" }), nationalities.map((n) => (_jsx(MenuItem, { value: n.code, children: i18n.language === 'ar' ? n.nameAr : n.nameEn }, n.code)))] })] }), _jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [field('birthDate', 'birthDate', 'date'), field('mobile', 'mobile')] }), _jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [field('email', 'email'), field('gosiNo', 'gosiNo')] })] }));
}
export function JobDialog({ profile, departments, onClose, onSaved }) {
    const { t, i18n } = useTranslation();
    const entities = useLegalEntities();
    const [entity, setEntity] = useState(profile.legalEntity?.id ?? '');
    const [department, setDepartment] = useState(profile.department?.id ?? '');
    const [position, setPosition] = useState(profile.positionId ?? '');
    const [hire, setHire] = useState(profile.hireDate ?? '');
    const [probation, setProbation] = useState(profile.probationEndsOn ?? '');
    const [status, setStatus] = useState(profile.status);
    const { busy, error, run } = useSave(onSaved);
    return (_jsxs(Frame, { open: true, title: t('staff.dialogs.job'), busy: busy, error: error, onClose: onClose, onSave: () => void run(() => staffApi.setJob(profile.id, { legalEntityId: entity || null, departmentId: department || null, positionId: position || null, hireDate: nz(hire), probationEndsOn: nz(probation), status })), children: [_jsxs(TextField, { select: true, label: t('staff.profile.fields.legalEntity'), value: entity, onChange: (e) => setEntity(e.target.value), slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staff.dialogs.noEntity') }), entities.map((e) => (_jsx(MenuItem, { value: e.id, children: localName(e, i18n.language) }, e.id)))] }), _jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [_jsxs(TextField, { select: true, label: t('staff.profile.fields.department'), value: department, onChange: (e) => (setDepartment(e.target.value), setPosition('')), fullWidth: true, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staff.dialogs.noDepartment') }), departments.map((d) => (_jsx(MenuItem, { value: d.id, children: i18n.language === 'ar' ? d.nameAr : d.nameEn }, d.id)))] }), _jsxs(TextField, { select: true, label: t('staff.profile.fields.position'), value: position, onChange: (e) => setPosition(e.target.value), fullWidth: true, disabled: !department, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staff.dialogs.noPosition') }), positionsOf(departments, department, i18n.language, t).map((p) => (_jsx(MenuItem, { value: p.id, children: p.label }, p.id)))] })] }), _jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [_jsx(DateField, { label: t('staff.profile.fields.hireDate'), value: hire, onChange: (e) => setHire(e.target.value), fullWidth: true, slotProps: { inputLabel: { shrink: true } } }), _jsx(DateField, { label: t('staff.profile.fields.probationEnds'), value: probation, onChange: (e) => setProbation(e.target.value), fullWidth: true, slotProps: { inputLabel: { shrink: true } } })] }), _jsx(TextField, { select: true, label: t('staff.profile.fields.status'), value: status, onChange: (e) => setStatus(e.target.value), children: staffStatuses.map((s) => (_jsx(MenuItem, { value: s, children: t(`staff.status.${s}`) }, s))) })] }));
}
export function ContractDialog({ profile, onClose, onSaved }) {
    const { t } = useTranslation();
    const [start, setStart] = useState(profile.contractStartsOn ?? '');
    const [months, setMonths] = useState(profile.contractMonths?.toString() ?? '');
    const [end, setEnd] = useState(profile.contractEndsOn ?? '');
    const { busy, error, run } = useSave(onSaved);
    return (_jsxs(Frame, { open: true, title: t('staff.dialogs.contract'), busy: busy, error: error, onClose: onClose, onSave: () => void run(() => staffApi.setContract(profile.id, { startsOn: nz(start), months: months ? Number(months) : null, endsOn: nz(end) })), children: [_jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [_jsx(DateField, { label: t('staff.profile.fields.contractStart'), value: start, onChange: (e) => setStart(e.target.value), fullWidth: true, slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { type: "number", label: t('staff.profile.fields.contractMonths'), value: months, onChange: (e) => setMonths(e.target.value), fullWidth: true })] }), _jsx(DateField, { label: t('staff.profile.fields.contractEnd'), value: end, onChange: (e) => setEnd(e.target.value), slotProps: { inputLabel: { shrink: true } } })] }));
}
export function SalaryDialog({ profile, onClose, onSaved }) {
    const { t } = useTranslation();
    const current = profile.salary;
    const [salary, setSalary] = useState(current ? { basic: current.basic, housing: current.housing, food: current.food, transport: current.transport, mobile: current.mobile, project: current.project, other: current.other } : emptySalary);
    const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
    const [reason, setReason] = useState('');
    const { busy, error, run } = useSave(onSaved);
    return (_jsxs(Frame, { open: true, title: t('staff.dialogs.salary'), busy: busy, error: error, onClose: onClose, saveDisabled: !reason.trim(), onSave: () => void run(() => staffApi.changeSalary(profile.id, { effectiveFrom: from, salary, reason: reason.trim() })), children: [_jsx(Alert, { severity: "info", children: t('staff.dialogs.salaryHint') }), _jsx(DateField, { label: t('staff.dialogs.effectiveFrom'), value: from, onChange: (e) => setFrom(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(SalaryFields, { value: salary, onChange: setSalary }), _jsx(TextField, { label: t('staff.dialogs.reason'), value: reason, onChange: (e) => setReason(e.target.value), required: true, multiline: true, minRows: 2 })] }));
}
/** The bank the salary is transferred to, and the date the employee joined GOSI (the rates differ after 2024-07-03). */
export function PayDetailsDialog({ profile, onClose, onSaved }) {
    const { t } = useTranslation();
    const p = profile.payDetails;
    const [bank, setBank] = useState(p?.bankName ?? '');
    const [iban, setIban] = useState(p?.iban ?? '');
    const [holder, setHolder] = useState(p?.accountHolder ?? profile.nameAr ?? profile.nameEn);
    const [since, setSince] = useState(p?.gosiSince ?? '');
    const { busy, error, run } = useSave(onSaved);
    return (_jsxs(Frame, { open: true, title: t('staff.dialogs.payDetails'), busy: busy, error: error, onClose: onClose, onSave: () => void run(() => staffApi.setPayDetails(profile.id, { bankName: nz(bank), iban: nz(iban), accountHolder: nz(holder), gosiSince: nz(since) })), children: [_jsx(TextField, { label: t('staff.profile.fields.bank'), value: bank, onChange: (e) => setBank(e.target.value), slotProps: { htmlInput: { maxLength: 100 } } }), _jsx(TextField, { label: t('staff.profile.fields.iban'), value: iban, onChange: (e) => setIban(e.target.value), placeholder: "SA00 0000 0000 0000 0000 0000", helperText: t('staff.dialogs.ibanHint'), slotProps: { htmlInput: { maxLength: 34, dir: 'ltr' } } }), _jsx(TextField, { label: t('staff.profile.fields.accountHolder'), value: holder, onChange: (e) => setHolder(e.target.value), slotProps: { htmlInput: { maxLength: 200 } } }), _jsx(DateField, { label: t('staff.profile.fields.gosiSince'), value: since, onChange: (e) => setSince(e.target.value), helperText: t('staff.dialogs.gosiSinceHint'), slotProps: { inputLabel: { shrink: true } } })] }));
}
