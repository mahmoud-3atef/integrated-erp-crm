import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import FlightLandOutlinedIcon from '@mui/icons-material/FlightLandOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MoreTimeOutlinedIcon from '@mui/icons-material/MoreTimeOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import WalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import { Alert, Box, Button, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workforceApi } from '../../api/workforce';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { Badge, Initials, PillTabs } from '../../components/ui';
import { placementLook } from '../../components/workforce/placement';
/**
 * One worker's or staff member's file, laid out as the old employee page: header with the key facts, then the data
 * sections. Staff have no supplier, agent, current project or work days; their job section shows the job title and
 * joining date.
 */
export function WorkerDetailPage({ kind }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const [worker, setWorker] = useState(null);
    const [tab, setTab] = useState('info');
    const [error, setError] = useState(null);
    const ar = i18n.language === 'ar';
    useEffect(() => {
        workforceApi.get(kind, id).then(setWorker).catch((failure) => setError(errorKey(failure)));
    }, [kind, id]);
    if (!worker) {
        return _jsx(ErrorMessage, { messageKey: error });
    }
    const w = worker.summary;
    const look = placementLook[w.placement];
    const status = (ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`);
    const date = (value) => value ? new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—';
    const money = (value) => (_jsxs(_Fragment, { children: [new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value), _jsx(Box, { component: "small", sx: { fontSize: 12, fontWeight: 500, color: tokens.gray500, marginInlineStart: 0.5 }, children: t('workforce.sar') })] }));
    const unit = (text) => (_jsx(Box, { component: "small", sx: { fontSize: 12, fontWeight: 500, color: tokens.gray500, marginInlineStart: 0.5 }, children: text }));
    const days = (value) => (value === null ? '—' : _jsxs(_Fragment, { children: [value.toLocaleString('en-US'), unit(t('workforce.days'))] }));
    const staff = kind === 'Staff';
    const working = w.placement === 'Working' && !staff;
    const flip = { transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' };
    return (_jsxs(Box, { children: [_jsx(Stack, { direction: "row", sx: { justifyContent: 'flex-end', mb: 1 }, children: _jsx(Button, { startIcon: _jsx(ArrowBackIcon, { sx: flip }), onClick: () => navigate(-1), children: t('common.back') }) }), _jsx(ErrorMessage, { messageKey: error }), worker.removedInCrm && (_jsx(Alert, { severity: "warning", sx: { mb: 2 }, children: t('workforce.removedInCrm') })), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: '20px 22px', mb: `${tokens.gap}px` }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 2, mb: 2.25 }, children: [_jsx(Box, { sx: { borderRadius: '50%', boxShadow: `0 0 0 4px ${tokens.navy50}` }, children: _jsx(Initials, { name: w.name, size: 64 }) }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { component: "h1", dir: "ltr", sx: { fontSize: 20, fontWeight: 700, color: tokens.navy800, mb: 0.5, textAlign: 'start', overflowWrap: 'anywhere' }, children: w.name }), _jsxs(Stack, { direction: "row", sx: { flexWrap: 'wrap', gap: '6px 18px', fontSize: 13, color: tokens.gray600, '& svg': { fontSize: 16, color: tokens.navy400, marginInlineEnd: 0.75, verticalAlign: 'text-bottom' } }, children: [_jsxs("span", { children: [_jsx(TagOutlinedIcon, {}), _jsx("span", { dir: "ltr", children: w.workerNo })] }), w.iqama && (_jsxs("span", { children: [_jsx(BadgeOutlinedIcon, {}), _jsx("span", { dir: "ltr", children: w.iqama })] })), worker.crmCreatedAt && (_jsxs("span", { children: [_jsx(CalendarMonthOutlinedIcon, {}), t('workforce.createdOn'), " ", _jsx("b", { children: date(worker.crmCreatedAt) })] })), _jsx("span", { children: _jsx(Badge, { tone: staff ? 'primary' : 'neutral', children: t(`workforce.kind.${w.kind}`) }) })] })] })] }), _jsxs(Box, { component: "dl", sx: { m: 0, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' }, gap: 1.25 }, children: [_jsxs(Box, { sx: {
                                    gridColumn: { xs: 'span 2', md: working || staff ? 'span 3' : '1 / -1' },
                                    display: 'grid',
                                    gridTemplateColumns: 'auto 1fr',
                                    columnGap: 1.5,
                                    alignItems: 'center',
                                    p: '10px 14px',
                                    borderRadius: `${tokens.radius}px`,
                                    bgcolor: look.soft,
                                    borderInlineStart: `4px solid ${look.tone}`,
                                }, children: [_jsx(Box, { sx: { gridRow: '1 / span 2', display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: '12px', bgcolor: look.tone, color: '#fff', '& svg': { fontSize: 20 } }, children: look.icon }), _jsx(Typography, { component: "dt", sx: { fontSize: 12, color: tokens.gray500 }, children: t('workforce.col.status') }), _jsx(Typography, { component: "dd", sx: { m: 0, fontSize: 15, fontWeight: 800, color: look.tone }, children: status })] }), working && (_jsxs(Fact, { wide: true, icon: _jsx(AccountTreeOutlinedIcon, {}), label: t('workforce.currentProject'), children: [w.projectName ?? '—', w.projectJoinedOn && (_jsxs(Stack, { direction: "row", sx: { flexWrap: 'wrap', gap: '4px 10px', mt: 0.5, fontSize: 12, fontWeight: 500, color: tokens.gray600 }, children: [_jsxs("span", { children: [t('workforce.startedOn'), " ", _jsx("b", { children: date(w.projectJoinedOn) })] }), w.workDays !== null && (_jsxs("span", { children: [_jsx("b", { children: w.workDays }), " ", t('workforce.workDaysSuffix')] }))] }))] })), staff && (_jsx(Fact, { wide: true, icon: _jsx(CalendarMonthOutlinedIcon, {}), label: t('workforce.col.hired'), children: date(w.projectJoinedOn) })), _jsx(Fact, { icon: _jsx(WorkOutlineOutlinedIcon, {}), label: t(staff ? 'workforce.field.jobTitle' : 'workforce.col.profession'), wide: staff, children: (ar ? w.professionAr : w.professionEn) ?? '—' }), _jsx(Fact, { icon: _jsx(FlagOutlinedIcon, {}), label: t('workforce.col.nationality'), wide: staff, children: (ar ? w.nationalityAr : w.nationalityEn) ?? '—' }), !staff && (_jsx(Fact, { icon: _jsx(LocalShippingOutlinedIcon, {}), label: t('workforce.col.sponsor'), children: _jsx("span", { dir: "ltr", children: w.sponsor ?? '—' }) }))] })] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }, children: [_jsx(PillTabs, { value: tab, onChange: setTab, options: [
                            { value: 'info', label: t('workforce.tabs.info') },
                            { value: 'ids', label: t('workforce.tabs.ids', { count: worker.identifiers.length }) },
                        ] }), tab === 'info' ? (_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }, children: [_jsxs(Stack, { spacing: 2.5, children: [_jsxs(FieldSection, { title: t('workforce.sections.basic'), icon: _jsx(BadgeOutlinedIcon, {}), children: [_jsx(FieldBox, { label: t(staff ? 'workforce.field.employeeNo' : 'workforce.col.number'), icon: _jsx(TagOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: w.workerNo }) }), _jsx(FieldBox, { label: t('workforce.field.iqama'), icon: _jsx(CreditCardOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: w.iqama ?? '—' }) }), _jsx(FieldBox, { label: t('workforce.field.name'), icon: _jsx(PersonOutlinedIcon, {}), wide: true, children: _jsx("span", { dir: "ltr", children: w.name }) }), _jsx(FieldBox, { label: t('workforce.col.nationality'), icon: _jsx(FlagOutlinedIcon, {}), children: (ar ? w.nationalityAr : w.nationalityEn) ?? '—' }), _jsx(FieldBox, { label: t('workforce.col.status'), icon: look.icon, children: _jsx(Box, { component: "span", sx: { color: look.tone }, children: status }) })] }), staff ? (_jsxs(FieldSection, { title: t('workforce.sections.staffJob'), icon: _jsx(WorkOutlineOutlinedIcon, {}), children: [_jsx(FieldBox, { label: t('workforce.field.jobTitle'), icon: _jsx(WorkOutlineOutlinedIcon, {}), wide: true, children: (ar ? w.professionAr : w.professionEn) ?? '—' }), _jsx(FieldBox, { label: t('workforce.col.hired'), icon: _jsx(CalendarMonthOutlinedIcon, {}), children: date(w.projectJoinedOn) }), _jsx(FieldBox, { label: t('workforce.field.arrived'), icon: _jsx(FlightLandOutlinedIcon, {}), children: date(worker.arrivedOn) }), _jsx(FieldBox, { label: t('workforce.field.iqamaProfession'), icon: _jsx(CreditCardOutlinedIcon, {}), wide: true, children: (ar ? worker.iqamaProfessionAr : worker.iqamaProfessionEn) ?? '—' })] })) : (_jsxs(FieldSection, { title: t('workforce.sections.job'), icon: _jsx(AccountTreeOutlinedIcon, {}), children: [_jsx(FieldBox, { label: t('workforce.col.profession'), icon: _jsx(WorkOutlineOutlinedIcon, {}), children: (ar ? w.professionAr : w.professionEn) ?? '—' }), _jsx(FieldBox, { label: t('workforce.col.sponsor'), icon: _jsx(LocalShippingOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: w.sponsor ?? '—' }) }), _jsx(FieldBox, { label: t('workforce.field.project'), icon: _jsx(AccountTreeOutlinedIcon, {}), wide: true, children: w.projectName ?? '—' }), _jsx(FieldBox, { label: t('workforce.field.projectJoined'), icon: _jsx(CalendarMonthOutlinedIcon, {}), children: date(w.projectJoinedOn) }), _jsx(FieldBox, { label: t('workforce.col.workDays'), icon: _jsx(ScheduleOutlinedIcon, {}), children: days(w.workDays) }), _jsx(FieldBox, { label: t('workforce.field.iqamaProfession'), icon: _jsx(CreditCardOutlinedIcon, {}), children: (ar ? worker.iqamaProfessionAr : worker.iqamaProfessionEn) ?? '—' }), _jsx(FieldBox, { label: t('workforce.field.arrived'), icon: _jsx(FlightLandOutlinedIcon, {}), children: date(worker.arrivedOn) }), _jsx(FieldBox, { label: t('workforce.field.agent'), icon: _jsx(SupportAgentOutlinedIcon, {}), wide: true, children: _jsx("span", { dir: "ltr", children: worker.recruitmentAgent ?? '—' }) })] }))] }), _jsxs(Stack, { spacing: 2.5, children: [_jsx(FieldSection, { title: t('workforce.sections.salary'), icon: _jsx(PaidOutlinedIcon, {}), tone: "green", children: w.salary ? (_jsxs(_Fragment, { children: [_jsx(FieldBox, { label: t('workforce.salary.basic'), icon: _jsx(PaidOutlinedIcon, {}), children: money(w.salary.basic) }), _jsx(FieldBox, { label: t('workforce.salary.housing'), icon: _jsx(HomeOutlinedIcon, {}), children: money(w.salary.housing) }), _jsx(FieldBox, { label: t('workforce.salary.food'), icon: _jsx(RestaurantOutlinedIcon, {}), children: money(w.salary.food) }), _jsx(FieldBox, { label: t('workforce.salary.transport'), icon: _jsx(DirectionsCarOutlinedIcon, {}), children: money(w.salary.transport) }), _jsx(FieldBox, { label: t('workforce.salary.overtime'), icon: _jsx(MoreTimeOutlinedIcon, {}), children: money(w.salary.overtime) }), _jsx(FieldBox, { label: t('workforce.salary.other'), icon: _jsx(RedeemOutlinedIcon, {}), children: money(w.salary.other) }), _jsx(FieldBox, { label: t(staff ? 'workforce.salary.fixed' : 'workforce.salary.project'), icon: _jsx(WorkOutlineOutlinedIcon, {}), children: money(w.salary.project) }), w.salary.hardship > 0 && (_jsx(FieldBox, { label: t('workforce.salary.hardship'), icon: _jsx(WorkOutlineOutlinedIcon, {}), children: money(w.salary.hardship) })), _jsx(FieldBox, { label: t('workforce.salary.total'), icon: _jsx(WalletOutlinedIcon, {}), highlight: true, wide: true, children: money(w.salary.total) })] })) : (_jsx(Typography, { sx: { gridColumn: '1 / -1', fontSize: 13, color: tokens.gray500 }, children: t('workforce.noSalaryPermission') })) }), _jsxs(FieldSection, { title: t('workforce.sections.contract'), icon: _jsx(DescriptionOutlinedIcon, {}), tone: "sky", children: [_jsx(FieldBox, { label: t('workforce.field.contractStart'), icon: _jsx(EventAvailableOutlinedIcon, {}), children: date(worker.contract.startsOn) }), _jsxs(FieldBox, { label: t('workforce.field.contractMonths'), icon: _jsx(HourglassBottomOutlinedIcon, {}), children: [worker.contract.months ?? '—', worker.contract.months !== null && unit(t('workforce.months'))] }), _jsx(FieldBox, { label: t('workforce.field.contractEnd'), icon: _jsx(EventBusyOutlinedIcon, {}), children: date(worker.contract.endsOn) })] }), _jsxs(FieldSection, { title: t('workforce.sections.leave'), icon: _jsx(BeachAccessOutlinedIcon, {}), tone: "sky", children: [_jsx(FieldBox, { label: t('workforce.leave.annual'), icon: _jsx(FlightLandOutlinedIcon, {}), children: days(worker.leave.annualDays) }), _jsx(FieldBox, { label: t('workforce.leave.balance'), icon: _jsx(WalletOutlinedIcon, {}), children: days(worker.leave.balance) }), _jsx(FieldBox, { label: t('workforce.leave.oldConsumed'), icon: _jsx(HistoryOutlinedIcon, {}), children: days(worker.leave.oldConsumed) }), _jsx(FieldBox, { label: t('workforce.leave.consumed'), icon: _jsx(ScheduleOutlinedIcon, {}), children: days(worker.leave.consumed) }), _jsx(FieldBox, { label: t('workforce.leave.remaining'), icon: _jsx(BeachAccessOutlinedIcon, {}), highlight: true, wide: true, children: days(worker.leave.remaining) })] })] })] })) : (_jsx(Identifiers, { worker: worker, date: date })), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mt: 2.5, fontSize: 12.5, color: tokens.gray500 }, children: [_jsx(InfoOutlinedIcon, { sx: { fontSize: 16 } }), t('workforce.readOnly')] })] })] }));
}
function Fact({ icon, label, children, wide }) {
    return (_jsxs(Box, { sx: { gridColumn: { xs: wide ? 'span 2' : 'span 1', md: wide ? 'span 3' : 'span 2' }, p: '10px 14px', borderRadius: `${tokens.radius}px`, bgcolor: wide ? tokens.navy50 : tokens.gray50, minWidth: 0 }, children: [_jsxs(Typography, { component: "dt", sx: { display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: tokens.gray500, mb: 0.25, '& svg': { fontSize: 16, color: tokens.navy400 } }, children: [icon, label] }), _jsx(Box, { component: "dd", sx: { m: 0, fontSize: wide ? 15 : 14, fontWeight: 600, color: tokens.navy800, overflowWrap: 'anywhere' }, children: children })] }));
}
/** Identity numbers with their expiry: expired (red), within 60 days (amber). */
function Identifiers({ worker, date }) {
    const { t } = useTranslation();
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    if (worker.identifiers.length === 0) {
        return _jsx(Typography, { sx: { py: 4, textAlign: 'center', color: tokens.gray500 }, children: t('workforce.noIds') });
    }
    return (_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.ids.type') }), _jsx(TableCell, { children: t('workforce.ids.number') }), _jsx(TableCell, { children: t('workforce.ids.expires') }), _jsx(TableCell, { children: t('common.status') })] }) }), _jsx(TableBody, { children: worker.identifiers.map((i) => {
                        const expiry = i.expiresOn?.slice(0, 10);
                        const tone = !expiry ? null : expiry < today ? 'danger' : expiry <= soon ? 'warning' : 'success';
                        return (_jsxs(TableRow, { children: [_jsx(TableCell, { children: t(`workforce.idType.${i.type}`) }), _jsx(TableCell, { dir: "ltr", sx: { fontVariantNumeric: 'tabular-nums', fontWeight: 600 }, children: i.number }), _jsx(TableCell, { children: tone ? _jsx(Badge, { tone: tone, children: `${date(i.expiresOn)}${tone === 'danger' ? ` — ${t('workforce.ids.expired')}` : tone === 'warning' ? ` — ${t('workforce.ids.soon')}` : ''}` }) : '—' }), _jsx(TableCell, { children: i.isCurrent ? _jsx(Badge, { tone: "success", children: t('workforce.ids.current') }) : _jsx(Badge, { tone: "warning", children: t('workforce.ids.duplicate') }) })] }, `${i.type}-${i.number}`));
                    }) })] }) }));
}
