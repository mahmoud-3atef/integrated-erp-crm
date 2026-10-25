import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MultipleStopOutlinedIcon from '@mui/icons-material/MultipleStopOutlined';
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
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { Alert, Box, Button, LinearProgress, Link, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../app/session';
import { ActionDialog } from '../operations/movements/ActionDialog';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workforceApi } from '../../api/workforce';
import { photoUrl, profileApi } from '../../api/showroom';
import { ceoApi } from '../../api/reports';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { Badge, Initials, PillTabs } from '../../components/ui';
import { WorkerActions, periodDays } from './WorkerActions';
import { WorkerInvoices } from './WorkerInvoices';
import { useService } from '../staff/staff';
import { WorkerProfileTab } from './WorkerProfileTab';
import { WorkerCostTab } from './WorkerCostTab';
import { placementLook } from '../../components/workforce/placement';
import { useCrumb } from '../../app/breadcrumbs';
/**
 * One worker's or staff member's file, laid out as the old employee page (HR_EmployeeDetails.aspx, as the staff file):
 * the hero with the key facts and the dark «ملخص عام» card, pill tabs, then the data sections; the actions tab is the
 * old screen's actions timeline, each action opening its document. Staff have no supplier, agent, current project,
 * work days, invoices, marketing profile or cost.
 */
export function WorkerDetailPage({ kind }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const { id } = useParams();
    const [worker, setWorker] = useState(null);
    useCrumb(worker?.summary.name);
    const [tab, setTab] = useState(() => {
        const asked = new URLSearchParams(window.location.search).get('tab');
        if (asked === 'periods' || asked === 'actions')
            return 'actions';
        return asked === 'ids' || ((asked === 'profile' || asked === 'cost' || asked === 'invoices') && kind === 'Worker') ? asked : 'info';
    });
    const [periods, setPeriods] = useState(null);
    const [photo, setPhoto] = useState(null);
    const [profit, setProfit] = useState(null);
    const service = useService();
    const [error, setError] = useState(null);
    const [acting, setActing] = useState(false);
    const [sent, setSent] = useState(0);
    const ar = i18n.language === 'ar';
    useEffect(() => {
        workforceApi.get(kind, id).then(setWorker).catch((failure) => setError(errorKey(failure)));
        if (kind === 'Worker') {
            profileApi
                .get(id)
                .then((p) => setPhoto(p.photos[0] ? photoUrl(id, p.photos[0]) : null))
                .catch(() => setPhoto(null));
        }
    }, [kind, id]);
    useEffect(() => {
        workforceApi.periods(kind, id).then(setPeriods).catch(() => setPeriods([]));
    }, [kind, id, sent]);
    // The last invoiced month's profit on the worker (the CEO report's), for those who may see it.
    const seesProfit = kind === 'Worker' && can('reports.profit.view', true) && can('workforce.workers.salary', true);
    const workerNo = worker?.summary.workerNo;
    useEffect(() => {
        if (!seesProfit || !workerNo)
            return;
        ceoApi
            .workers(null, { search: workerNo })
            .then((rows) => setProfit(rows.find((r) => r.workerId === id)?.profit ?? null))
            .catch(() => setProfit(null));
    }, [seesProfit, workerNo, id]);
    if (!worker) {
        return (_jsxs(_Fragment, { children: [_jsx(ErrorMessage, { messageKey: error }), !error && _jsx(LinearProgress, {})] }));
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
    // The project of the open work period, to open its page from the header.
    const openWork = (periods ?? []).find((p) => p.kind === 'Work' && p.endsOn === null);
    const currentProjectId = openWork?.projectId ?? openWork?.projectCrmId ?? null;
    const flip = { transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' };
    const tally = (kinds) => (periods ?? []).filter((p) => kinds.includes(p.kind)).reduce((sum, p) => sum + periodDays(p), 0);
    const projectDays = tally(['Work', 'ClientVacation']);
    const housingDays = tally(['Housing']);
    const projects = new Set((periods ?? []).filter((p) => p.kind === 'Work' && p.projectName).map((p) => p.projectName)).size;
    const usage = projectDays + housingDays > 0 ? Math.round((projectDays * 100) / (projectDays + housingDays)) : null;
    const lastPrice = (periods ?? []).find((p) => p.kind === 'Work' && p.totalPrice !== null)?.totalPrice ?? null;
    const iqamaEnds = worker.identifiers.find((i) => i.type === 'Iqama' && i.isCurrent)?.expiresOn ?? null;
    const since = (worker.arrivedOn ?? worker.crmCreatedAt)?.slice(0, 10) ?? null;
    return (_jsxs(Box, { children: [_jsx(ErrorMessage, { messageKey: error }), worker.removedInCrm && (_jsx(Alert, { severity: "warning", sx: { mb: 2 }, children: t('workforce.removedInCrm') })), _jsxs(Box, { sx: { display: 'grid', gap: `${tokens.gap}px`, gridTemplateColumns: { xs: '1fr', lg: staff ? '1fr' : 'minmax(0, 1fr) 380px' }, mb: `${tokens.gap}px` }, children: [_jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: { xs: 2, md: 2.75 } }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 2, alignItems: { md: 'center' }, flexWrap: 'wrap' }, children: [_jsxs(Stack, { direction: "row", sx: { gap: 2, alignItems: 'center', flex: { md: '1 1 320px' }, minWidth: 0 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', borderRadius: '50%', boxShadow: `0 0 0 4px ${tokens.navy50}` }, children: photo ? (_jsx(Box, { component: "img", src: photo, alt: "", sx: { display: 'block', width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center 20%' } })) : (_jsx(Initials, { name: w.name, size: 72 })) }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { component: "h1", sx: { fontSize: 22, fontWeight: 700, color: tokens.navy800, lineHeight: 1.3, textAlign: 'start', overflowWrap: 'break-word' }, children: _jsx("bdi", { children: w.name }) }), _jsxs(Stack, { direction: "row", sx: { flexWrap: 'wrap', gap: '4px 16px', mt: 0.25, fontSize: 12.5, color: tokens.gray600, '& svg': { fontSize: 15, color: tokens.navy400, verticalAlign: 'middle', marginInlineEnd: 0.4 } }, children: [_jsxs("span", { children: [_jsx(TagOutlinedIcon, {}), _jsx("bdi", { children: w.workerNo })] }), w.iqama && (_jsxs("span", { children: [_jsx(BadgeOutlinedIcon, {}), _jsx("bdi", { children: w.iqama })] })), worker.arrivedOn ? (_jsxs("span", { children: [_jsx(FlightLandOutlinedIcon, {}), t('workforce.field.arrived'), " ", _jsx("b", { children: date(worker.arrivedOn) })] })) : (worker.crmCreatedAt && (_jsxs("span", { children: [_jsx(CalendarMonthOutlinedIcon, {}), t('workforce.createdOn'), " ", _jsx("b", { children: date(worker.crmCreatedAt) })] }))), staff && (_jsx("span", { children: _jsx(Badge, { tone: "primary", children: t(`workforce.kind.${w.kind}`) }) }))] })] })] }), _jsxs(Stack, { direction: "row", sx: { gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsxs(Typography, { component: "p", sx: { color: look.tone, fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 0.75, '& svg': { fontSize: 22 } }, children: [look.icon, status] }), since && (_jsxs(Box, { sx: { display: 'inline-flex', gap: 1, alignItems: 'center', border: '1px solid #cfe3ec', borderRadius: 99, px: 1.75, py: 0.6, bgcolor: '#f3f9fc', fontSize: 12.5 }, children: [_jsx("b", { style: { color: tokens.navy700 }, children: t('workforce.overview.service') }), _jsx("span", { style: { color: tokens.gray500 }, children: service(since) ?? '—' })] })), can('operations.movements.manage', true) && (_jsx(Button, { variant: "contained", startIcon: _jsx(MultipleStopOutlinedIcon, {}), onClick: () => setActing(true), sx: { borderRadius: 99, bgcolor: tokens.navy800, boxShadow: '0 6px 14px rgba(10,60,88,.25)', px: 2.5 }, children: t('movements.new') })), _jsx(Button, { startIcon: _jsx(ArrowBackIcon, { sx: flip }), onClick: () => navigate(-1), sx: { borderRadius: 99 }, children: t('common.back') })] })] }), w.fromLedger && (_jsx(Typography, { sx: { mt: 1, fontSize: 12, color: tokens.gray500 }, children: t('workforce.fromLedger', { status: (ar ? w.crmStatusAr : w.crmStatusEn) ?? '—' }) })), _jsxs(Box, { component: "dl", sx: { m: 0, mt: 1.75, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }, children: [working && (_jsx(Fact, { wide: true, icon: _jsx(AccountTreeOutlinedIcon, {}), label: t('workforce.currentProject'), children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', flexWrap: 'wrap', gap: 1 }, children: [currentProjectId ? (_jsx(Link, { component: RouterLink, to: `/commercial/projects/${currentProjectId}`, underline: "hover", sx: { flex: 1, minWidth: 0, fontSize: 16.5, fontWeight: 800, color: '#9A6B12' }, children: w.projectName ?? '—' })) : (_jsx(Box, { component: "span", sx: { flex: 1, minWidth: 0, fontSize: 16.5, fontWeight: 800, color: '#9A6B12' }, children: w.projectName ?? '—' })), w.projectJoinedOn && (_jsxs(Box, { component: "span", sx: { display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.35, borderRadius: 99, bgcolor: '#e6eefb', color: '#1d4f91', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap' }, children: [t('workforce.startedOn'), " ", _jsx("b", { children: date(w.projectJoinedOn) })] })), w.workDays !== null && (_jsxs(Box, { component: "span", sx: { display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.35, borderRadius: 99, bgcolor: '#e6f4ec', color: '#16734b', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap' }, children: [_jsx("b", { children: w.workDays }), " ", t('workforce.workDaysSuffix')] }))] }) })), staff && (_jsx(Fact, { wide: true, icon: _jsx(CalendarMonthOutlinedIcon, {}), label: t('workforce.col.hired'), children: date(w.projectJoinedOn) })), _jsx(Fact, { icon: _jsx(WorkOutlineOutlinedIcon, {}), label: t(staff ? 'workforce.field.jobTitle' : 'workforce.col.profession'), children: (ar ? w.professionAr : w.professionEn) ?? '—' }), _jsx(Fact, { icon: _jsx(FlagOutlinedIcon, {}), label: t('workforce.col.nationality'), children: (ar ? w.nationalityAr : w.nationalityEn) ?? '—' }), staff ? (_jsx(Fact, { icon: _jsx(CreditCardOutlinedIcon, {}), label: t('workforce.overview.iqamaEnds'), children: date(iqamaEnds) })) : (_jsxs(_Fragment, { children: [_jsx(Fact, { icon: _jsx(LocalShippingOutlinedIcon, {}), label: t('workforce.col.sponsor'), children: _jsx("bdi", { children: w.sponsor ?? '—' }) }), _jsx(Fact, { icon: _jsx(CreditCardOutlinedIcon, {}), label: t('workforce.overview.iqamaEnds'), children: date(iqamaEnds) }), _jsx(Fact, { icon: _jsx(SupportAgentOutlinedIcon, {}), label: t('workforce.field.agent'), children: _jsx("bdi", { children: worker.recruitmentAgent ?? '—' }) }), _jsx(Fact, { icon: _jsx(SellOutlinedIcon, {}), label: t('workforce.overview.lastPrice'), children: lastPrice === null ? '—' : money(lastPrice) })] }))] })] }), !staff && (_jsx(Overview, { usage: usage, projectDays: projectDays, housingDays: housingDays, projects: projects, profit: seesProfit ? profit : undefined, loading: periods === null }))] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }, children: [_jsx(PillTabs, { value: tab, onChange: setTab, options: [
                            { value: 'info', label: t(staff ? 'workforce.tabs.staffInfo' : 'workforce.tabs.info') },
                            { value: 'actions', label: periods ? t(staff ? 'workforce.tabs.staffActionsCount' : 'workforce.tabs.actionsCount', { count: periods.length }) : t(staff ? 'workforce.tabs.staffActions' : 'workforce.tabs.actions') },
                            ...(staff || !can('billing.invoices.view', true) ? [] : [{ value: 'invoices', label: t('workforce.tabs.invoices') }]),
                            { value: 'ids', label: t('workforce.tabs.ids', { count: worker.identifiers.length }) },
                            ...(staff ? [] : [{ value: 'profile', label: t('workforce.tabs.profile') }]),
                            ...(staff || !can('workforce.costs.view', true) ? [] : [{ value: 'cost', label: t('workforce.tabs.cost') }]),
                        ] }), tab === 'invoices' ? (_jsx(WorkerInvoices, { workerId: id })) : tab === 'actions' ? (periods ? _jsx(WorkerActions, { workerId: id, periods: periods, withDocuments: !staff }) : _jsx(LinearProgress, {})) : tab === 'cost' ? (_jsx(WorkerCostTab, { workerId: id, name: w.name })) : tab === 'profile' ? (_jsx(WorkerProfileTab, { workerId: id })) : tab === 'info' ? (_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }, children: [_jsxs(Stack, { spacing: 2.5, children: [_jsxs(FieldSection, { title: t('workforce.sections.basic'), icon: _jsx(BadgeOutlinedIcon, {}), children: [_jsx(FieldBox, { label: t(staff ? 'workforce.field.employeeNo' : 'workforce.col.number'), icon: _jsx(TagOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: w.workerNo }) }), _jsx(FieldBox, { label: t('workforce.field.iqama'), icon: _jsx(CreditCardOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: w.iqama ?? '—' }) }), _jsx(FieldBox, { label: t('workforce.field.name'), icon: _jsx(PersonOutlinedIcon, {}), wide: true, children: _jsx("span", { dir: "ltr", children: w.name }) }), _jsx(FieldBox, { label: t('workforce.col.nationality'), icon: _jsx(FlagOutlinedIcon, {}), children: (ar ? w.nationalityAr : w.nationalityEn) ?? '—' }), _jsx(FieldBox, { label: t('workforce.col.status'), icon: look.icon, children: _jsx(Box, { component: "span", sx: { color: look.tone }, children: status }) })] }), staff ? (_jsxs(FieldSection, { title: t('workforce.sections.staffJob'), icon: _jsx(WorkOutlineOutlinedIcon, {}), children: [_jsx(FieldBox, { label: t('workforce.field.jobTitle'), icon: _jsx(WorkOutlineOutlinedIcon, {}), wide: true, children: (ar ? w.professionAr : w.professionEn) ?? '—' }), _jsx(FieldBox, { label: t('workforce.col.hired'), icon: _jsx(CalendarMonthOutlinedIcon, {}), children: date(w.projectJoinedOn) }), _jsx(FieldBox, { label: t('workforce.field.arrived'), icon: _jsx(FlightLandOutlinedIcon, {}), children: date(worker.arrivedOn) }), _jsx(FieldBox, { label: t('workforce.field.iqamaProfession'), icon: _jsx(CreditCardOutlinedIcon, {}), wide: true, children: (ar ? worker.iqamaProfessionAr : worker.iqamaProfessionEn) ?? '—' })] })) : (_jsxs(FieldSection, { title: t('workforce.sections.job'), icon: _jsx(AccountTreeOutlinedIcon, {}), children: [_jsx(FieldBox, { label: t('workforce.col.profession'), icon: _jsx(WorkOutlineOutlinedIcon, {}), children: (ar ? w.professionAr : w.professionEn) ?? '—' }), _jsx(FieldBox, { label: t('workforce.col.sponsor'), icon: _jsx(LocalShippingOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: w.sponsor ?? '—' }) }), _jsx(FieldBox, { label: t('workforce.field.project'), icon: _jsx(AccountTreeOutlinedIcon, {}), wide: true, children: w.projectName ?? '—' }), _jsx(FieldBox, { label: t('workforce.field.projectJoined'), icon: _jsx(CalendarMonthOutlinedIcon, {}), children: date(w.projectJoinedOn) }), _jsx(FieldBox, { label: t('workforce.col.workDays'), icon: _jsx(ScheduleOutlinedIcon, {}), children: days(w.workDays) }), _jsx(FieldBox, { label: t('workforce.field.iqamaProfession'), icon: _jsx(CreditCardOutlinedIcon, {}), children: (ar ? worker.iqamaProfessionAr : worker.iqamaProfessionEn) ?? '—' }), _jsx(FieldBox, { label: t('workforce.field.arrived'), icon: _jsx(FlightLandOutlinedIcon, {}), children: date(worker.arrivedOn) }), _jsx(FieldBox, { label: t('workforce.field.agent'), icon: _jsx(SupportAgentOutlinedIcon, {}), wide: true, children: _jsx("span", { dir: "ltr", children: worker.recruitmentAgent ?? '—' }) })] }))] }), _jsxs(Stack, { spacing: 2.5, children: [_jsx(FieldSection, { title: t('workforce.sections.salary'), icon: _jsx(PaidOutlinedIcon, {}), tone: "green", children: w.salary ? (_jsxs(_Fragment, { children: [_jsx(FieldBox, { label: t('workforce.salary.basic'), icon: _jsx(PaidOutlinedIcon, {}), children: money(w.salary.basic) }), _jsx(FieldBox, { label: t('workforce.salary.housing'), icon: _jsx(HomeOutlinedIcon, {}), children: money(w.salary.housing) }), _jsx(FieldBox, { label: t('workforce.salary.food'), icon: _jsx(RestaurantOutlinedIcon, {}), children: money(w.salary.food) }), _jsx(FieldBox, { label: t('workforce.salary.transport'), icon: _jsx(DirectionsCarOutlinedIcon, {}), children: money(w.salary.transport) }), _jsx(FieldBox, { label: t('workforce.salary.overtime'), icon: _jsx(MoreTimeOutlinedIcon, {}), children: money(w.salary.overtime) }), _jsx(FieldBox, { label: t('workforce.salary.other'), icon: _jsx(RedeemOutlinedIcon, {}), children: money(w.salary.other) }), _jsx(FieldBox, { label: t(staff ? 'workforce.salary.fixed' : 'workforce.salary.project'), icon: _jsx(WorkOutlineOutlinedIcon, {}), children: money(w.salary.project) }), w.salary.hardship > 0 && (_jsx(FieldBox, { label: t('workforce.salary.hardship'), icon: _jsx(WorkOutlineOutlinedIcon, {}), children: money(w.salary.hardship) })), _jsx(FieldBox, { label: t('workforce.salary.total'), icon: _jsx(WalletOutlinedIcon, {}), highlight: true, wide: true, children: money(w.salary.total) })] })) : (_jsx(Typography, { sx: { gridColumn: '1 / -1', fontSize: 13, color: tokens.gray500 }, children: t('workforce.noSalaryPermission') })) }), _jsxs(FieldSection, { title: t('workforce.sections.contract'), icon: _jsx(DescriptionOutlinedIcon, {}), tone: "sky", children: [_jsx(FieldBox, { label: t('workforce.field.contractStart'), icon: _jsx(EventAvailableOutlinedIcon, {}), children: date(worker.contract.startsOn) }), _jsxs(FieldBox, { label: t('workforce.field.contractMonths'), icon: _jsx(HourglassBottomOutlinedIcon, {}), children: [worker.contract.months ?? '—', worker.contract.months !== null && unit(t('workforce.months'))] }), _jsx(FieldBox, { label: t('workforce.field.contractEnd'), icon: _jsx(EventBusyOutlinedIcon, {}), children: date(worker.contract.endsOn) })] }), _jsxs(FieldSection, { title: t('workforce.sections.leave'), icon: _jsx(BeachAccessOutlinedIcon, {}), tone: "sky", children: [_jsx(FieldBox, { label: t('workforce.leave.annual'), icon: _jsx(FlightLandOutlinedIcon, {}), children: days(worker.leave.annualDays) }), _jsx(FieldBox, { label: t('workforce.leave.balance'), icon: _jsx(WalletOutlinedIcon, {}), children: days(worker.leave.balance) }), _jsx(FieldBox, { label: t('workforce.leave.oldConsumed'), icon: _jsx(HistoryOutlinedIcon, {}), children: days(worker.leave.oldConsumed) }), _jsx(FieldBox, { label: t('workforce.leave.consumed'), icon: _jsx(ScheduleOutlinedIcon, {}), children: days(worker.leave.consumed) }), _jsx(FieldBox, { label: t('workforce.leave.remaining'), icon: _jsx(BeachAccessOutlinedIcon, {}), highlight: true, wide: true, children: days(worker.leave.remaining) })] })] })] })) : (_jsx(Identifiers, { worker: worker, date: date })), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mt: 2.5, fontSize: 12.5, color: tokens.gray500 }, children: [_jsx(InfoOutlinedIcon, { sx: { fontSize: 16 } }), t('workforce.readOnly')] })] }), acting && _jsx(ActionDialog, { workerId: w.id, onClose: () => setActing(false), onSent: () => setSent((n) => n + 1) })] }));
}
/** One fact of the hero on one line: the icon and its name, then the value (the user's request of 2026-10-25, a shorter header). */
function Fact({ icon, label, children, wide }) {
    return (_jsxs(Box, { sx: { gridColumn: wide ? '1 / -1' : undefined, display: 'flex', alignItems: 'baseline', gap: 1, p: '7px 12px', borderRadius: `${tokens.radius}px`, bgcolor: wide ? tokens.navy50 : tokens.gray50, minWidth: 0 }, children: [_jsxs(Typography, { component: "dt", sx: { flex: '0 0 auto', display: 'flex', alignItems: 'center', alignSelf: 'center', gap: 0.75, fontSize: 12, color: tokens.gray500, whiteSpace: 'nowrap', '& svg': { fontSize: 16, color: tokens.navy400 } }, children: [icon, label] }), _jsx(Box, { component: "dd", sx: { m: 0, flex: 1, minWidth: 0, fontSize: wide ? 14.5 : 13.5, fontWeight: 600, color: tokens.navy800, overflowWrap: 'anywhere' }, children: children })] }));
}
/** The dark overview card (.cp-ed-summary): the share of the days on projects since arrival, and the last month's profit. */
function Overview({ usage, projectDays, housingDays, projects, profit, loading }) {
    const { t } = useTranslation();
    const n = (v) => v.toLocaleString('en-US');
    const rows = [
        { icon: _jsx(WorkOutlineOutlinedIcon, {}), label: t('workforce.overview.projectDays'), value: n(projectDays) },
        { icon: _jsx(HomeOutlinedIcon, {}), label: t('workforce.overview.housingDays'), value: n(housingDays) },
        { icon: _jsx(AccountTreeOutlinedIcon, {}), label: t('workforce.overview.projects'), value: n(projects) },
    ];
    if (profit !== undefined) {
        rows.push({
            icon: _jsx(TrendingUpOutlinedIcon, {}),
            label: t('workforce.overview.profit'),
            value: profit === null ? '—' : (_jsxs(_Fragment, { children: [profit.toLocaleString('en-US', { maximumFractionDigits: 0 }), " ", _jsx("small", { style: { fontWeight: 500, opacity: 0.8 }, children: t('workforce.sar') })] })),
        });
    }
    const ring = usage ?? 0;
    return (_jsxs(Box, { sx: { borderRadius: `${tokens.radiusLg}px`, p: 2.5, color: '#fff', background: 'linear-gradient(135deg, #0a3c58 0%, #0d5e72 55%, #127c86 100%)', boxShadow: tokens.shadowSm }, children: [_jsxs(Stack, { direction: "row", sx: { gap: 2, alignItems: 'center' }, children: [_jsx(Box, { role: "img", "aria-label": t('workforce.overview.usage', { value: usage ?? '—' }), sx: { flex: '0 0 auto', width: 96, height: 96, borderRadius: '50%', background: `conic-gradient(#7ee0a8 0 ${ring}%, rgba(255,255,255,.18) ${ring}% 100%)`, display: 'grid', placeItems: 'center' }, children: _jsx(Box, { sx: { width: 78, height: 78, borderRadius: '50%', bgcolor: '#0c4a63', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800 }, children: _jsx("bdi", { children: loading || usage === null ? '—' : `${usage}%` }) }) }), _jsxs(Box, { children: [_jsxs(Typography, { sx: { fontSize: 19, fontWeight: 800, display: 'flex', gap: 0.75, alignItems: 'center' }, children: [_jsx(ReceiptLongOutlinedIcon, {}), t('workforce.overview.title')] }), _jsx(Typography, { sx: { mt: 0.5, fontSize: 12.5, opacity: 0.85 }, children: t('workforce.overview.usageHint') })] })] }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.9, mt: 2 }, children: rows.map((r) => (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'space-between', gap: 1, bgcolor: 'rgba(255,255,255,.1)', borderRadius: '10px', px: 1.25, py: 0.8, fontSize: 12.5, '& svg': { fontSize: 16, opacity: 0.85 } }, children: [_jsxs(Box, { component: "span", sx: { display: 'inline-flex', alignItems: 'center', gap: 1 }, children: [r.icon, r.label] }), _jsx(Box, { component: "b", sx: { fontVariantNumeric: 'tabular-nums' }, children: r.value })] }, r.label))) })] }));
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
