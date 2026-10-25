import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import Add from '@mui/icons-material/Add';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import LocalAtmOutlinedIcon from '@mui/icons-material/LocalAtmOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineOutlined';
import PhoneIphoneOutlinedIcon from '@mui/icons-material/PhoneIphoneOutlined';
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import StarBorderOutlinedIcon from '@mui/icons-material/StarBorderOutlined';
import SupervisorAccountOutlinedIcon from '@mui/icons-material/SupervisorAccountOutlined';
import TagIcon from '@mui/icons-material/Tag';
import WorkOutlineIcon from '@mui/icons-material/WorkOutlineOutlined';
import { Box, Button, ButtonBase, LinearProgress, Link, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { staffApi } from '../../api/staff';
import { useCrumb } from '../../app/breadcrumbs';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { ActionDialog, ActionStatusBadge, actionIcon } from './StaffActions';
import { ContractDialog, JobDialog, PayDetailsDialog, PersonalDialog, SalaryDialog } from './StaffDialogs';
import { EmployeePayrollPanel } from '../payroll/staff/EmployeePayrollPanel';
import { EmployeeLeavePanel } from '../leave/leave';
import { EmployeeDeductionsPanel } from '../deductions/settings';
import { useService } from './staff';
import { useSession } from '../../app/session';
import { NewSettlementDialog } from '../settlements/NewSettlementDialog';
// The employee's file after the old system's latest employee screen (content/css/pages/hr-employee-details.css,
// 2026-10-14): the hero with the facts, the dark overview card, pill tabs, and boxes titled on their border with
// «تعديل». Its navy is the app's own (the HR screens' blue is not used here — a decision of the user).
const tone = { navy: '#0a3c58', navySoft: '#eaf3f8', green: '#1f9d55', greenSoft: '#e9f7ef', sky: '#1b6a92', skySoft: '#eaf4fa' };
/** The file's fields a change shows, by the stored property's name. */
const changeLabels = {
    NameAr: 'nameAr', NameEn: 'nameEn', IdNumber: 'idNumber', NationalityCode: 'nationality', BirthDate: 'birthDate', Mobile: 'mobile', Email: 'email', GosiNo: 'gosiNo',
    DepartmentId: 'department', PositionId: 'position', LegalEntityId: 'legalEntity', HireDate: 'hireDate', ProbationEndsOn: 'probationEnds', Status: 'status',
    ContractStartsOn: 'contractStart', ContractMonths: 'contractMonths', ContractEndsOn: 'contractEnd',
    BankName: 'bank', Iban: 'iban', AccountHolder: 'accountHolder', GosiSince: 'gosiSince',
};
const fmt = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
export function StaffProfilePage() {
    const { id = '' } = useParams();
    const { t, i18n } = useTranslation();
    const { date } = useCommercialFormat();
    const service = useService();
    const { can } = useSession();
    const [p, setP] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('data');
    const [edit, setEdit] = useState(null);
    const [version, setVersion] = useState(0);
    const navigate = useNavigate();
    const ar = i18n.language === 'ar';
    useCrumb(p ? (p.nameAr ?? p.nameEn) : undefined, `/hr/employees/${id}`);
    const reload = useCallback(async () => {
        try {
            setP(await staffApi.profile(id));
            setVersion((v) => v + 1);
            setError(null);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [id]);
    useEffect(() => {
        void reload();
        staffApi.structure().then((s) => setDepartments(s.departments)).catch(() => setDepartments([]));
    }, [reload]);
    if (!p) {
        return (_jsxs(_Fragment, { children: [_jsx(ErrorMessage, { messageKey: error }), !error && _jsx(LinearProgress, {})] }));
    }
    const name = (ar ? p.nameAr : null) ?? p.nameEn;
    const d = (v) => (v ? date(v) : '—');
    const named = (r) => (r ? (ar ? r.nameAr : r.nameEn) : '—');
    const missing = p.missing.map((m) => t(`staff.profile.missing.${m}`)).join('، ');
    const summary = t('staff.profile.summaryText', { service: service(p.hireDate) ?? '—', hire: p.hireDate ? ` (${date(p.hireDate)})` : '' }) +
        (p.status === 'Probation' && p.probationEndsOn ? t('staff.profile.summaryProbation', { date: date(p.probationEndsOn) }) : '') +
        (p.contractEndsOn ? t('staff.profile.summaryContract', { date: date(p.contractEndsOn) }) : '') +
        (p.leaveRemaining !== null ? t('staff.profile.summaryLeave', { days: fmt(p.leaveRemaining) }) : '') +
        (missing ? t('staff.profile.summaryMissing', { items: missing }) : t('staff.profile.summaryDone'));
    const done = () => {
        setEdit(null);
        void reload();
    };
    return (_jsxs(Box, { children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Box, { sx: { display: 'grid', gap: `${tokens.gap}px`, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 420px' }, mb: `${tokens.gap}px` }, children: [_jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: { xs: 2, md: 2.75 } }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 2, alignItems: { md: 'center' } }, children: [_jsxs(Stack, { direction: "row", sx: { gap: 2, alignItems: 'center', flex: 1, minWidth: 0 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 62, height: 62, borderRadius: '50%', bgcolor: tokens.navy700, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 700, boxShadow: `0 0 0 4px ${tokens.navy50}` }, children: name.trim().charAt(0).toUpperCase() }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { component: "h1", sx: { fontSize: 22, fontWeight: 700, color: tokens.navy800, lineHeight: 1.3, textAlign: 'start', overflowWrap: 'break-word' }, children: _jsx("bdi", { children: name }) }), _jsxs(Stack, { direction: "row", sx: { gap: 2, flexWrap: 'wrap', color: tokens.gray600, fontSize: 12.5, mt: 0.25, '& svg': { fontSize: 15, color: tokens.navy400, verticalAlign: 'middle', marginInlineEnd: 0.4 } }, children: [_jsxs("span", { children: [_jsx(TagIcon, {}), _jsx("bdi", { children: p.employeeNo })] }), p.idNumber && (_jsxs("span", { children: [_jsx(BadgeOutlinedIcon, {}), _jsx("bdi", { children: p.idNumber })] })), p.hireDate && (_jsxs("span", { children: [_jsx(CalendarMonthOutlinedIcon, {}), t('staff.profile.hiredBy', { date: date(p.hireDate), by: p.createdByName })] }))] })] })] }), _jsxs(Stack, { direction: "row", sx: { gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsxs(Typography, { sx: { color: tokens.teal, fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 0.75 }, children: [_jsx(PersonOutlineIcon, {}), t(`staff.status.${p.status}`)] }), _jsxs(Box, { sx: { display: 'inline-flex', gap: 1, alignItems: 'center', border: '1px solid #cfe3ec', borderRadius: 99, px: 1.75, py: 0.6, bgcolor: '#f3f9fc', fontSize: 12.5 }, children: [_jsx("b", { style: { color: tokens.navy700 }, children: t('staff.profile.service') }), _jsx("span", { style: { color: tokens.gray500 }, children: service(p.hireDate) ?? '—' })] }), p.canEdit && (_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), disabled: p.status === 'Left', onClick: () => setEdit('action'), sx: { borderRadius: 99, bgcolor: tokens.navy800, boxShadow: '0 6px 14px rgba(10,60,88,.25)', px: 2.5 }, children: t('staff.profile.newAction') })), can('payroll.settlements.manage', true) && p.status !== 'Left' && (_jsx(Button, { variant: "outlined", onClick: () => setEdit('settlement'), sx: { borderRadius: 99, borderColor: tokens.border, color: tokens.navy800 }, children: t('staff.profile.endService') }))] })] }), _jsxs(Box, { component: "dl", sx: { m: 0, mt: 1.75, display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' } }, children: [_jsx(Fact, { wide: true, icon: _jsx(ApartmentOutlinedIcon, {}), label: t('staff.profile.department'), value: named(p.department) }), _jsx(Fact, { icon: _jsx(WorkOutlineIcon, {}), label: t('staff.profile.jobTitle'), value: p.jobTitle ? `${named(p.jobTitle)}${p.grade ? ` · ${p.grade}` : ''}` : '—' }), _jsx(Fact, { icon: _jsx(FlagOutlinedIcon, {}), label: t('staff.profile.nationality'), value: (ar ? p.nationalityAr : p.nationalityEn) ?? '—' }), _jsx(Fact, { icon: _jsx(AccountBalanceOutlinedIcon, {}), label: t('staff.profile.legalEntity'), value: named(p.legalEntity) }), _jsx(Fact, { icon: _jsx(SupervisorAccountOutlinedIcon, {}), label: t('staff.profile.manager'), value: p.manager ? _jsx(Link, { component: RouterLink, to: `/hr/employees/${p.manager.id}`, children: named(p.manager) }) : '—' }), _jsx(Fact, { icon: _jsx(HourglassBottomOutlinedIcon, {}), label: t('staff.profile.probationEnds'), value: d(p.probationEndsOn), warn: p.status === 'Probation' }), _jsx(Fact, { icon: _jsx(DescriptionOutlinedIcon, {}), label: t('staff.profile.contractEnds'), value: d(p.contractEndsOn) })] }), p.legacyStatusAr && (_jsx(Typography, { sx: { mt: 1.25, fontSize: 12, color: tokens.gray500 }, children: t('staff.profile.legacy', { status: ar ? p.legacyStatusAr : (p.legacyStatusEn ?? p.legacyStatusAr) }) }))] }), _jsx(Overview, { score: p.completeness, text: summary, canEdit: p.canEdit, onComplete: () => setEdit(p.missing.some((m) => ['department', 'position', 'legal_entity', 'hire_date'].includes(m)) ? 'job' : 'personal') })] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: { xs: 2, md: 2.5 } }, children: [_jsx(Stack, { direction: "row", sx: { display: 'inline-flex', bgcolor: tokens.gray100, borderRadius: 99, p: 0.6, gap: 0.5, flexWrap: 'wrap' }, role: "tablist", children: ['data', 'leave', 'deductions', 'payroll', 'contract', 'history'].map((k) => {
                            const icons = { data: _jsx(BadgeOutlinedIcon, {}), leave: _jsx(BeachAccessOutlinedIcon, {}), deductions: _jsx(CreditCardOutlinedIcon, {}), payroll: _jsx(PaymentsOutlinedIcon, {}), contract: _jsx(DescriptionOutlinedIcon, {}), history: _jsx(HistoryOutlinedIcon, {}) };
                            return (_jsxs(ButtonBase, { role: "tab", "aria-selected": tab === k, onClick: () => setTab(k), sx: { px: 2.25, py: 1, borderRadius: 99, fontWeight: 600, fontSize: 13.5, gap: 0.75, color: tab === k ? tokens.navy800 : tokens.gray600, bgcolor: tab === k ? '#fff' : 'transparent', boxShadow: tab === k ? '0 1px 4px rgba(0,0,0,.08)' : 'none', '& svg': { fontSize: 17 } }, children: [icons[k], t(`staff.profile.tabs.${k}`)] }, k));
                        }) }), tab === 'data' && (_jsxs(Box, { sx: { display: 'grid', gap: 2.25, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start', mt: 1 }, children: [_jsxs(Box, { children: [_jsxs(Section, { title: t('staff.profile.boxes.basic'), icon: _jsx(BadgeOutlinedIcon, {}), onEdit: p.canEdit ? () => setEdit('personal') : undefined, children: [_jsx(Field, { icon: _jsx(TagIcon, {}), label: t('staff.profile.fields.employeeNo'), value: _jsx("bdi", { children: p.employeeNo }) }), _jsx(Field, { icon: _jsx(BadgeOutlinedIcon, {}), label: t('staff.profile.fields.idNumber'), value: _jsx("bdi", { children: p.idNumber ?? '—' }) }), _jsx(Field, { wide: true, icon: _jsx(PersonOutlineIcon, {}), label: t('staff.profile.fields.name'), value: p.nameAr ? `${p.nameAr} · ${p.nameEn}` : p.nameEn }), _jsx(Field, { icon: _jsx(FlagOutlinedIcon, {}), label: t('staff.profile.fields.nationality'), value: (ar ? p.nationalityAr : p.nationalityEn) ?? '—' }), _jsx(Field, { icon: _jsx(CheckCircleOutlineOutlinedIcon, {}), label: t('staff.profile.fields.status'), value: _jsx(Box, { component: "span", sx: { bgcolor: tone.green, color: '#fff', borderRadius: 99, px: 1.5, py: 0.25, fontSize: 12 }, children: t(`staff.status.${p.status}`) }) }), _jsx(Field, { icon: _jsx(CakeOutlinedIcon, {}), label: t('staff.profile.fields.birthDate'), value: d(p.birthDate) }), _jsx(Field, { icon: _jsx(PhoneIphoneOutlinedIcon, {}), label: t('staff.profile.fields.mobile'), value: _jsx("bdi", { children: p.mobile ?? '—' }) }), _jsx(Field, { icon: _jsx(EmailOutlinedIcon, {}), label: t('staff.profile.fields.email'), value: _jsx("bdi", { children: p.email ?? '—' }) }), _jsx(Field, { icon: _jsx(ShieldOutlinedIcon, {}), label: t('staff.profile.fields.gosiNo'), value: _jsx("bdi", { children: p.gosiNo ?? '—' }) })] }), _jsxs(Section, { title: t('staff.profile.boxes.job'), icon: _jsx(ApartmentOutlinedIcon, {}), onEdit: p.canEdit ? () => setEdit('job') : undefined, children: [_jsx(Field, { icon: _jsx(ApartmentOutlinedIcon, {}), label: t('staff.profile.fields.department'), value: named(p.department) }), _jsx(Field, { icon: _jsx(WorkOutlineIcon, {}), label: t('staff.profile.fields.jobTitle'), value: named(p.jobTitle) }), _jsx(Field, { icon: _jsx(StarBorderOutlinedIcon, {}), label: t('staff.profile.fields.grade'), value: p.grade ?? '—' }), _jsx(Field, { icon: _jsx(SupervisorAccountOutlinedIcon, {}), label: t('staff.profile.fields.manager'), value: named(p.manager) }), _jsx(Field, { icon: _jsx(AccountBalanceOutlinedIcon, {}), label: t('staff.profile.fields.legalEntity'), value: named(p.legalEntity) }), _jsx(Field, { icon: _jsx(CalendarMonthOutlinedIcon, {}), label: t('staff.profile.fields.hireDate'), value: d(p.hireDate) }), _jsx(Field, { icon: _jsx(HourglassBottomOutlinedIcon, {}), label: t('staff.profile.fields.probationEnds'), value: d(p.probationEndsOn) }), p.sponsor && _jsx(Field, { icon: _jsx(OpenInNewIcon, {}), label: t('staff.profile.fields.sponsor'), value: _jsx("bdi", { children: p.sponsor }) })] })] }), _jsxs(Box, { children: [_jsx(SalaryBox, { p: p, onChange: p.canChangeSalary ? () => setEdit('salary') : undefined }), p.payDetails && _jsx(PayBox, { p: p, onEdit: p.canManageBank ? () => setEdit('pay') : undefined }), _jsx(ContractBox, { p: p, onEdit: p.canEdit ? () => setEdit('contract') : undefined })] })] })), tab === 'leave' && (_jsxs(Box, { sx: { mt: 2.25 }, children: [_jsx(EmployeeLeavePanel, { employee: { id: p.id, nameAr: p.nameAr ?? p.nameEn, nameEn: p.nameEn } }), _jsx(LeaveBox, { p: p })] })), tab === 'deductions' && (_jsx(Box, { sx: { mt: 2.25 }, children: _jsx(EmployeeDeductionsPanel, { employee: { id: p.id, nameAr: p.nameAr ?? p.nameEn, nameEn: p.nameEn } }) })), tab === 'payroll' && (_jsx(Box, { sx: { mt: 2.25 }, children: _jsx(EmployeePayrollPanel, { employeeId: p.id }) })), tab === 'contract' && (_jsxs(Box, { sx: { display: 'grid', gap: 2.25, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }, children: [_jsx(ContractBox, { p: p, onEdit: p.canEdit ? () => setEdit('contract') : undefined }), _jsx(Contracts, { id: p.id, version: version })] })), tab === 'history' && _jsx(History, { id: p.id, version: version })] }), edit === 'personal' && _jsx(PersonalDialog, { profile: p, onClose: () => setEdit(null), onSaved: done }), edit === 'job' && _jsx(JobDialog, { profile: p, departments: departments, onClose: () => setEdit(null), onSaved: done }), edit === 'contract' && _jsx(ContractDialog, { profile: p, onClose: () => setEdit(null), onSaved: done }), edit === 'salary' && _jsx(SalaryDialog, { profile: p, onClose: () => setEdit(null), onSaved: done }), edit === 'pay' && _jsx(PayDetailsDialog, { profile: p, onClose: () => setEdit(null), onSaved: done }), edit === 'settlement' && (_jsx(NewSettlementDialog, { employee: { id: p.id, nameAr: p.nameAr ?? p.nameEn, nameEn: p.nameEn }, onClose: () => setEdit(null), onCreated: (sid) => navigate(`/hr/settlements/${sid}`) })), edit === 'action' && _jsx(ActionDialog, { profile: p, departments: departments, onClose: () => setEdit(null), onSent: (actionId) => navigate(`/hr/actions/${actionId}`) })] }));
}
/** One fact of the hero on one line: the icon and its name, then the value (as the worker file, 2026-10-25). */
function Fact({ icon, label, value, wide, warn }) {
    return (_jsxs(Box, { sx: { gridColumn: wide ? '1 / -1' : undefined, display: 'flex', alignItems: 'baseline', gap: 1, bgcolor: wide ? tokens.navy50 : tokens.gray50, borderRadius: `${tokens.radius}px`, p: '7px 12px', minWidth: 0 }, children: [_jsxs(Typography, { component: "dt", sx: { flex: '0 0 auto', alignSelf: 'center', fontSize: 12, color: tokens.gray500, display: 'flex', gap: 0.75, alignItems: 'center', whiteSpace: 'nowrap', '& svg': { fontSize: 16, color: tokens.navy400 } }, children: [icon, label] }), _jsx(Typography, { component: "dd", sx: { m: 0, flex: 1, minWidth: 0, fontWeight: 700, color: warn ? '#b45309' : tokens.navy800, fontSize: wide ? 14.5 : 13.5, overflowWrap: 'anywhere' }, children: value })] }));
}
function Overview({ score, text, canEdit, onComplete }) {
    const { t } = useTranslation();
    return (_jsxs(Box, { sx: { borderRadius: `${tokens.radiusLg}px`, p: 2.5, color: '#fff', background: 'linear-gradient(135deg, #0a3c58 0%, #0d5e72 55%, #127c86 100%)', display: 'flex', flexDirection: 'column', boxShadow: tokens.shadowSm }, children: [_jsxs(Stack, { direction: "row", sx: { gap: 2, alignItems: 'center' }, children: [_jsx(Box, { role: "img", "aria-label": t('staff.profile.completeness', { value: score }), sx: { flex: '0 0 auto', width: 96, height: 96, borderRadius: '50%', background: `conic-gradient(#7ee0a8 0 ${score}%, rgba(255,255,255,.18) ${score}% 100%)`, display: 'grid', placeItems: 'center' }, children: _jsx(Box, { sx: { width: 78, height: 78, borderRadius: '50%', bgcolor: '#0c4a63', display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800 }, children: _jsx("bdi", { children: score }) }) }), _jsxs(Box, { children: [_jsxs(Typography, { sx: { fontSize: 19, fontWeight: 800, display: 'flex', gap: 0.75, alignItems: 'center' }, children: [_jsx(DescriptionOutlinedIcon, {}), t('staff.profile.summary')] }), _jsx(Box, { component: "span", sx: { display: 'inline-block', mt: 0.75, bgcolor: '#7ee0a8', color: tokens.navy800, borderRadius: 99, px: 1.5, py: 0.25, fontWeight: 700, fontSize: 12 }, children: t('staff.profile.completeness', { value: score }) })] })] }), _jsx(Typography, { sx: { my: 1.75, lineHeight: 1.9, fontSize: 13, opacity: 0.95 }, children: text }), canEdit && score < 100 && (_jsx(Button, { onClick: onComplete, startIcon: _jsx(EditNoteOutlinedIcon, {}), sx: { alignSelf: 'flex-start', mt: 'auto', bgcolor: '#fff', color: tokens.navy800, borderRadius: 99, px: 2, fontWeight: 700, '&:hover': { bgcolor: '#eef5f8' } }, children: t('staff.profile.complete') }))] }));
}
/** A box titled on its border (the old screen's fieldset), with «تعديل» on the other side of the border. */
function Section({ title, icon, onEdit, editLabel, boxTone = 'navy', children }) {
    const { t } = useTranslation();
    const main = tone[boxTone];
    return (_jsxs(Box, { component: "fieldset", sx: { position: 'relative', minWidth: 0, m: 0, mt: 2.25, px: 2.25, pt: 2.5, pb: 1.75, border: '1.5px solid #dbe4ec', borderRadius: '18px', bgcolor: '#fff' }, children: [_jsxs(Box, { component: "legend", sx: { px: 1.25, display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 14.5, fontWeight: 800, color: main }, children: [_jsx(Box, { component: "span", sx: { width: 28, height: 28, borderRadius: '9px', bgcolor: main, color: '#fff', display: 'grid', placeItems: 'center', '& svg': { fontSize: 15 } }, children: icon }), title] }), onEdit && (_jsx(Box, { sx: { position: 'absolute', top: -17, insetInlineEnd: 16, bgcolor: '#fff', px: 0.75 }, children: _jsx(Button, { size: "small", variant: "outlined", onClick: onEdit, sx: { borderRadius: 99, height: 30, borderColor: tokens.border, color: tokens.navy800, fontWeight: 600 }, children: editLabel ?? t('staff.profile.edit') }) })), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', columnGap: 2.25, rowGap: 0.25, '--field-tone': main, '--field-soft': boxTone === 'green' ? tone.greenSoft : boxTone === 'sky' ? tone.skySoft : tone.navySoft }, children: children })] }));
}
/** A field on one line, as every form (2026-10-25): a coloured icon, the label beside it, then the value in a quiet box. */
function Field({ icon, label, value, wide, unit }) {
    return (_jsxs(Box, { sx: { gridColumn: wide ? '1 / -1' : undefined, display: 'flex', alignItems: 'center', gap: 1, py: 0.6, minWidth: 0 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 30, height: 30, borderRadius: '10px', bgcolor: 'var(--field-soft)', color: 'var(--field-tone)', display: 'grid', placeItems: 'center', '& svg': { fontSize: 16 } }, children: icon }), _jsx(Typography, { sx: { flex: '0 0 104px', fontSize: 12, color: tokens.gray500, lineHeight: 1.35 }, children: label }), _jsxs(Box, { sx: { flex: 1, minWidth: 0, border: '1px solid #dfe8ef', borderRadius: '10px', px: 1.5, py: 0.6, fontWeight: 700, color: tokens.navy800, bgcolor: '#fbfcfd', fontSize: 13.5, fontVariantNumeric: 'tabular-nums', minHeight: 34, display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: [value, unit && (_jsx(Box, { component: "small", sx: { color: tokens.gray500, fontWeight: 500, fontSize: 11, marginInlineStart: 0.5 }, children: unit }))] })] }));
}
function SalaryBox({ p, onChange }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const s = p.salary;
    const riyal = t('hr.sar');
    return (_jsx(Section, { title: t('staff.profile.boxes.salary'), icon: _jsx(PaymentsOutlinedIcon, {}), boxTone: "green", onEdit: onChange, editLabel: t('staff.profile.changeSalary'), children: !p.canSeeSalary ? (_jsx(Typography, { sx: { gridColumn: '1 / -1', color: tokens.gray500, py: 1 }, children: t('staff.profile.salaryHidden') })) : !s ? (_jsx(Typography, { sx: { gridColumn: '1 / -1', color: tokens.gray500, py: 1 }, children: t('staff.profile.noSalary') })) : (_jsxs(_Fragment, { children: [_jsx(Field, { icon: _jsx(LocalAtmOutlinedIcon, {}), label: t('staff.profile.fields.basic'), value: fmt(s.basic), unit: riyal }), _jsx(Field, { icon: _jsx(HomeOutlinedIcon, {}), label: t('staff.profile.fields.housing'), value: fmt(s.housing), unit: riyal }), _jsx(Field, { icon: _jsx(RestaurantOutlinedIcon, {}), label: t('staff.profile.fields.food'), value: fmt(s.food), unit: riyal }), _jsx(Field, { icon: _jsx(DirectionsCarOutlinedIcon, {}), label: t('staff.profile.fields.transport'), value: fmt(s.transport), unit: riyal }), _jsx(Field, { icon: _jsx(PhoneIphoneOutlinedIcon, {}), label: t('staff.profile.fields.mobileAllowance'), value: fmt(s.mobile), unit: riyal }), _jsx(Field, { icon: _jsx(WorkOutlineIcon, {}), label: t('staff.profile.fields.project'), value: fmt(s.project), unit: riyal }), _jsx(Field, { icon: _jsx(RedeemOutlinedIcon, {}), label: t('staff.profile.fields.other'), value: fmt(s.other), unit: riyal }), _jsxs(Box, { sx: { gridColumn: '1 / -1', bgcolor: tone.greenSoft, borderRadius: '14px', p: 1.5, mt: 0.75, display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', gap: 1.25, alignItems: 'end' }, children: [_jsx(Box, { sx: { width: 34, height: 34, borderRadius: '10px', bgcolor: tone.green, color: '#fff', display: 'grid', placeItems: 'center' }, children: _jsx(CreditCardOutlinedIcon, { fontSize: "small" }) }), _jsxs(Box, { children: [_jsxs(Typography, { sx: { fontSize: 12, color: tokens.gray500, mb: 0.6 }, children: [t('staff.profile.fields.total'), " \u00B7 ", t('staff.profile.fields.effective', { date: date(s.effectiveFrom) }), " \u00B7 ", t(`staff.profile.source.${s.source}`), p.salaryChanges > 0 && ` · ${t('staff.profile.salaryChanges', { count: p.salaryChanges })}`] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: '10px', px: 1.75, py: 0.9, fontWeight: 800, color: tone.green, fontSize: 20, fontVariantNumeric: 'tabular-nums' }, children: [s.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), " ", _jsx("small", { style: { fontSize: 11, color: tokens.gray500, fontWeight: 500 }, children: riyal })] })] })] })] })) }));
}
/** The bank the salary goes to and the GOSI start (shown to those who manage bank details or see salaries). */
function PayBox({ p, onEdit }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const d = p.payDetails;
    return (_jsxs(Section, { title: t('staff.profile.boxes.pay'), icon: _jsx(AccountBalanceOutlinedIcon, {}), boxTone: "sky", onEdit: onEdit, children: [_jsx(Field, { icon: _jsx(AccountBalanceOutlinedIcon, {}), label: t('staff.profile.fields.bank'), value: d.bankName ?? '—' }), _jsx(Field, { icon: _jsx(PersonOutlineIcon, {}), label: t('staff.profile.fields.accountHolder'), value: d.accountHolder ?? '—' }), _jsx(Field, { wide: true, icon: _jsx(CreditCardOutlinedIcon, {}), label: t('staff.profile.fields.iban'), value: d.iban ? _jsx("bdi", { dir: "ltr", children: d.iban.replace(/(.{4})/g, '$1 ').trim() }) : _jsx(Box, { component: "span", sx: { color: '#b45309' }, children: t('staff.profile.noIban') }) }), _jsx(Field, { icon: _jsx(ShieldOutlinedIcon, {}), label: t('staff.profile.fields.gosiSince'), value: d.gosiSince ? date(d.gosiSince) : '—' })] }));
}
function ContractBox({ p, onEdit }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const d = (v) => (v ? date(v) : '—');
    return (_jsxs(Section, { title: t('staff.profile.boxes.contract'), icon: _jsx(DescriptionOutlinedIcon, {}), boxTone: "sky", onEdit: onEdit, children: [_jsx(Field, { icon: _jsx(EventAvailableOutlinedIcon, {}), label: t('staff.profile.fields.contractStart'), value: d(p.contractStartsOn) }), _jsx(Field, { icon: _jsx(HourglassBottomOutlinedIcon, {}), label: t('staff.profile.fields.contractMonths'), value: fmt(p.contractMonths), unit: t('staff.profile.fields.months') }), _jsx(Field, { icon: _jsx(EventBusyOutlinedIcon, {}), label: t('staff.profile.fields.contractEnd'), value: d(p.contractEndsOn) }), _jsx(Field, { icon: _jsx(HourglassBottomOutlinedIcon, {}), label: t('staff.profile.fields.probationEnds'), value: d(p.probationEndsOn) })] }));
}
function LeaveBox({ p }) {
    const { t } = useTranslation();
    const days = t('staff.profile.fields.days');
    return (_jsxs(Box, { sx: { maxWidth: 760 }, children: [_jsxs(Section, { title: t('staff.profile.boxes.leaveOld'), icon: _jsx(BeachAccessOutlinedIcon, {}), boxTone: "green", children: [_jsx(Field, { icon: _jsx(BeachAccessOutlinedIcon, {}), label: t('staff.profile.fields.annualLeave'), value: fmt(p.annualLeaveDays), unit: days }), _jsx(Field, { icon: _jsx(CalendarMonthOutlinedIcon, {}), label: t('staff.profile.fields.leaveBalance'), value: fmt(p.leaveBalance), unit: days }), _jsx(Field, { icon: _jsx(HistoryOutlinedIcon, {}), label: t('staff.profile.fields.oldConsumed'), value: fmt(p.leaveOldConsumed), unit: days }), _jsx(Field, { icon: _jsx(EventBusyOutlinedIcon, {}), label: t('staff.profile.fields.consumed'), value: fmt(p.leaveConsumed), unit: days }), _jsx(Field, { wide: true, icon: _jsx(ScaleOutlinedIcon, {}), label: t('staff.profile.fields.remaining'), value: fmt(p.leaveRemaining), unit: days })] }), _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500, mt: 1 }, children: t('staff.profile.leaveNote') })] }));
}
function History({ id, version }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const [events, setEvents] = useState(null);
    const [actions, setActions] = useState([]);
    useEffect(() => {
        staffApi.history(id).then(setEvents).catch(() => setEvents([]));
        staffApi.actions({ employeeId: id }).then(setActions).catch(() => setActions([]));
    }, [id, version]);
    if (!events)
        return _jsx(LinearProgress, { sx: { mt: 2 } });
    // What a change touched, in the file's words; changes made only by the import (leave balance, dates synced) are left out.
    const shown = events
        .map((e) => ({ ...e, fields: e.changes ? Object.keys(e.changes).filter((k) => k in changeLabels).map((k) => t(`staff.profile.fields.${changeLabels[k]}`)) : [] }))
        .filter((e) => e.kind !== 'Changed' || e.fields.length > 0);
    if (shown.length === 0 && actions.length === 0)
        return _jsx(Typography, { sx: { mt: 2, color: tokens.gray500 }, children: t('staff.profile.history.empty') });
    const look = { Created: { c: tokens.navy700, i: _jsx(Add, {}) }, Changed: { c: tokens.sky, i: _jsx(EditNoteOutlinedIcon, {}) }, Salary: { c: tone.green, i: _jsx(PaymentsOutlinedIcon, {}) } };
    return (_jsxs(Stack, { sx: { gap: 1.5, mt: 2.5 }, children: [actions.map((a) => (_jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', bgcolor: tokens.navy700, color: '#fff', display: 'grid', placeItems: 'center', '& svg': { fontSize: 17 } }, children: actionIcon[a.kind] }), _jsxs(Box, { component: RouterLink, to: `/hr/actions/${a.id}`, sx: { flex: 1, textDecoration: 'none', color: 'inherit', border: '1px solid #e6eef7', borderInlineStart: `4px solid ${tokens.navy700}`, borderRadius: '14px', px: 1.75, py: 1.25, '&:hover': { bgcolor: tokens.gray50 } }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 1, alignItems: 'center' }, children: [_jsxs(Typography, { sx: { fontWeight: 700, color: tokens.navy800 }, children: [t(`staffActions.kind.${a.kind}`), " \u00B7 ", _jsx("bdi", { style: { color: tokens.gray500, fontWeight: 600 }, children: a.actionNo })] }), _jsx(ActionStatusBadge, { status: a.status })] }), _jsxs(Typography, { sx: { fontSize: 12, color: tokens.gray500, mt: 0.25 }, children: [t('staffActions.effectiveFrom'), " ", _jsx("bdi", { children: date(a.effectiveFrom) }), " \u00B7 ", t('staff.profile.history.by', { by: a.createdByName })] })] })] }, a.id))), shown.map((e, n) => (_jsxs(Stack, { direction: "row", sx: { gap: 1.5 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', bgcolor: look[e.kind].c, color: '#fff', display: 'grid', placeItems: 'center', '& svg': { fontSize: 17 } }, children: look[e.kind].i }), _jsxs(Box, { sx: { flex: 1, border: '1px solid #e6eef7', borderInlineStart: `4px solid ${look[e.kind].c}`, borderRadius: '14px', px: 1.75, py: 1.25 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 1 }, children: [_jsx(Typography, { sx: { fontWeight: 700, color: look[e.kind].c }, children: t(`staff.profile.history.${e.kind}`) }), _jsxs(Typography, { sx: { fontSize: 12, color: tokens.gray500, fontVariantNumeric: 'tabular-nums' }, children: [_jsx("bdi", { children: date(e.at.slice(0, 10)) }), " \u00B7 ", t('staff.profile.history.by', { by: e.by })] })] }), e.salary && (_jsxs(Typography, { sx: { fontSize: 12.5, color: tokens.gray600, mt: 0.5 }, children: [t('staff.profile.fields.total'), ": ", _jsx("b", { children: _jsx("bdi", { children: e.salary.total.toLocaleString('en-US') }) }), " \u00B7 ", t('staff.profile.fields.effective', { date: date(e.salary.effectiveFrom) }), e.salary.reason && ` · ${t('staff.profile.history.reason', { reason: e.salary.reason })}`] })), e.kind === 'Changed' && _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500, mt: 0.5 }, children: e.fields.join('، ') })] })] }, n)))] }));
}
/** The employee's contracts, newest first (a renewal is a new one). */
function Contracts({ id, version }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const [list, setList] = useState(null);
    useEffect(() => {
        staffApi.contracts(id).then(setList).catch(() => setList([]));
    }, [id, version]);
    const look = { Active: { c: tone.green, b: tone.greenSoft }, Renewed: { c: tokens.navy500, b: tokens.navy50 }, Ended: { c: tokens.gray500, b: tokens.gray100 } };
    return (_jsx(Section, { title: t('staffContracts.title'), icon: _jsx(HistoryOutlinedIcon, {}), boxTone: "sky", children: _jsx(Box, { sx: { gridColumn: '1 / -1' }, children: !list ? (_jsx(LinearProgress, {})) : list.length === 0 ? (_jsx(Typography, { sx: { color: tokens.gray500, fontSize: 13, py: 1 }, children: t('staffContracts.none') })) : (_jsx(Stack, { sx: { gap: 1, py: 0.5 }, children: list.map((c) => (_jsxs(Box, { sx: { border: '1px solid #e6eef7', borderRadius: '12px', px: 1.5, py: 1 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'center', gap: 1 }, children: [_jsxs(Typography, { sx: { fontWeight: 700, color: tokens.navy800, fontSize: 13.5 }, children: [_jsx("bdi", { children: t('staffContracts.from', { date: date(c.startsOn) }) }), " ", c.endsOn ? _jsx("bdi", { children: t('staffContracts.to', { date: date(c.endsOn) }) }) : `· ${t('staffContracts.open')}`] }), _jsx(Box, { component: "span", sx: { bgcolor: look[c.status].b, color: look[c.status].c, borderRadius: 99, px: 1.25, py: 0.25, fontSize: 12, fontWeight: 700 }, children: t(`staffContracts.status.${c.status}`) })] }), _jsxs(Typography, { sx: { fontSize: 12, color: tokens.gray500, mt: 0.25 }, children: [t(`staffActions.contractKinds.${c.kind}`), c.months ? ` · ${c.months} ${t('staff.profile.fields.months')}` : '', " \u00B7 ", t('staffContracts.notice', { days: c.noticeDays }), c.actionId && (_jsxs(_Fragment, { children: [' · ', _jsx(RouterLink, { to: `/hr/actions/${c.actionId}`, children: t('staffContracts.byAction') })] }))] })] }, c.id))) })) }) }));
}
