import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MultipleStopOutlinedIcon from '@mui/icons-material/MultipleStopOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import { Alert, Box, Button, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../app/session';
import { ActionDialog } from '../operations/movements/ActionDialog';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workforceApi } from '../../api/workforce';
import { photoUrl, profileApi } from '../../api/showroom';
import { ceoApi } from '../../api/reports';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, Initials } from '../../components/ui';
import { card, CopyButton, NotRecorded, Row, Section, StatusPill, UnderlineTabs, wf } from './workforceUi';
import { WorkerActions, periodDays } from './WorkerActions';
import { WorkerInvoices } from './WorkerInvoices';
import { useService } from '../staff/staff';
import { WorkerProfileTab } from './WorkerProfileTab';
import { WorkerCostTab } from './WorkerCostTab';
import { useCrumb } from '../../app/breadcrumbs';
/**
 * One worker's or staff member's file (the user's redesign, 2026-10-23; docs/02-target-architecture/22): the title with
 * the new action, a white identity card with the current project and the key facts, the operational summary, underlined
 * tabs, then the data sections as labels and values; the actions tab is the old screen's actions timeline, each action
 * opening its document. Staff have no supplier, agent, current project, work days, invoices, marketing profile or cost.
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
    const status = (ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`);
    const date = (value) => value ? new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—';
    const money = (value) => (_jsxs(_Fragment, { children: [new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value), _jsx(Box, { component: "small", sx: { fontSize: 12, fontWeight: 500, color: tokens.gray500, marginInlineStart: 0.5 }, children: t('workforce.sar') })] }));
    const unit = (text) => (_jsx(Box, { component: "small", sx: { fontSize: 12, fontWeight: 500, color: tokens.gray500, marginInlineStart: 0.5 }, children: text }));
    const days = (value) => (value === null ? '—' : _jsxs(_Fragment, { children: [value.toLocaleString('en-US'), unit(t('workforce.days'))] }));
    const staff = kind === 'Staff';
    const working = w.placement === 'Working' && !staff;
    const flip = { transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' };
    const tally = (kinds) => (periods ?? []).filter((p) => kinds.includes(p.kind)).reduce((sum, p) => sum + periodDays(p), 0);
    const projectDays = tally(['Work', 'ClientVacation']);
    const housingDays = tally(['Housing']);
    const projects = new Set((periods ?? []).filter((p) => p.kind === 'Work' && p.projectName).map((p) => p.projectName)).size;
    const usage = projectDays + housingDays > 0 ? Math.round((projectDays * 100) / (projectDays + housingDays)) : null;
    const lastPrice = (periods ?? []).find((p) => p.kind === 'Work' && p.totalPrice !== null)?.totalPrice ?? null;
    const iqamaEnds = worker.identifiers.find((i) => i.type === 'Iqama' && i.isCurrent)?.expiresOn ?? null;
    const since = (worker.arrivedOn ?? worker.crmCreatedAt)?.slice(0, 10) ?? null;
    const title = t(staff ? 'workforce.ui.staffTitle' : 'workforce.ui.workerTitle');
    const missing = _jsx(NotRecorded, {});
    const text = (value, ltr = false) => (value ? ltr ? _jsx("bdi", { children: value }) : value : missing);
    return (_jsxs(Box, { children: [_jsx(ErrorMessage, { messageKey: error }), worker.removedInCrm && (_jsx(Alert, { severity: "warning", sx: { mb: 2 }, children: t('workforce.removedInCrm') })), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap', mb: 2 }, children: [_jsx(Typography, { component: "h1", sx: { fontSize: 24, fontWeight: 600, color: wf.navy, lineHeight: 1.3 }, children: title }), _jsxs(Stack, { direction: "row", sx: { gap: 1, alignItems: 'center' }, children: [can('operations.movements.manage', true) && (_jsx(Button, { variant: "contained", startIcon: _jsx(MultipleStopOutlinedIcon, {}), onClick: () => setActing(true), sx: { height: 40, borderRadius: wf.control, bgcolor: wf.navy, boxShadow: 'none', px: 2.25, '&:hover': { bgcolor: wf.navyHover, boxShadow: 'none' } }, children: t('movements.new') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: flip }), onClick: () => navigate(-1), sx: { height: 40, borderRadius: wf.control, borderColor: wf.border, color: wf.navy, bgcolor: wf.surface }, children: t('common.back') })] })] }), _jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: staff ? '1fr' : 'minmax(0, 1fr) 360px' }, mb: 2, alignItems: 'start' }, children: [_jsxs(Box, { sx: { ...card, p: { xs: 2, md: 2.5 } }, children: [_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 2, alignItems: { sm: 'flex-start' } }, children: [_jsx(Box, { sx: { flex: '0 0 auto' }, children: photo ? (_jsx(Box, { component: "img", src: photo, alt: "", sx: { display: 'block', width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center 20%', border: `2px solid ${wf.border}` } })) : (_jsx(Initials, { name: w.name, size: 72 })) }), _jsxs(Box, { sx: { minWidth: 0, flex: 1 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }, children: [_jsx(Typography, { component: "h2", dir: "ltr", sx: { fontSize: 19, fontWeight: 600, color: wf.navy, lineHeight: 1.35, textAlign: 'start', overflowWrap: 'anywhere' }, children: w.name }), _jsx(StatusPill, { placement: w.placement, children: status }), staff && _jsx(StatusPill, { placement: "Other", children: t(`workforce.kind.${w.kind}`) })] }), _jsxs(Stack, { direction: "row", sx: { flexWrap: 'wrap', alignItems: 'center', gap: '4px 18px', mt: 0.75, fontSize: 13, color: wf.textSecondary, '& b': { color: wf.text, fontWeight: 600 } }, children: [_jsxs(Box, { component: "span", sx: { display: 'inline-flex', alignItems: 'center', gap: 0.5 }, children: [t(staff ? 'workforce.field.employeeNo' : 'workforce.col.number'), " ", _jsx("b", { children: _jsx("bdi", { children: w.workerNo }) }), _jsx(CopyButton, { value: w.workerNo, label: t(staff ? 'workforce.field.employeeNo' : 'workforce.col.number') })] }), w.iqama && (_jsxs(Box, { component: "span", sx: { display: 'inline-flex', alignItems: 'center', gap: 0.5 }, children: [t('workforce.field.iqama'), " ", _jsx("b", { children: _jsx("bdi", { children: w.iqama }) }), _jsx(CopyButton, { value: w.iqama, label: t('workforce.field.iqama') })] })), worker.arrivedOn ? (_jsxs("span", { children: [t('workforce.field.arrived'), " ", _jsx("b", { children: date(worker.arrivedOn) })] })) : (worker.crmCreatedAt && (_jsxs("span", { children: [t('workforce.createdOn'), " ", _jsx("b", { children: date(worker.crmCreatedAt) })] }))), since && (_jsxs("span", { children: [t('workforce.overview.service'), " ", _jsx("b", { children: service(since) ?? '—' })] }))] }), w.fromLedger && _jsx(Typography, { sx: { mt: 0.75, fontSize: 12, color: wf.textSecondary }, children: t('workforce.fromLedger', { status: (ar ? w.crmStatusAr : w.crmStatusEn) ?? '—' }) })] })] }), working && (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25, mt: 2, px: 1.75, py: 1.25, borderRadius: wf.control, bgcolor: wf.subtle, border: `1px solid ${wf.border}`, flexWrap: 'wrap', '& > svg': { color: wf.navy, fontSize: 20 } }, children: [_jsx(AccountTreeOutlinedIcon, {}), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 12, color: wf.textSecondary }, children: t('workforce.currentProject') }), _jsx(Typography, { sx: { fontSize: 14, fontWeight: 600, color: wf.navy, overflowWrap: 'anywhere' }, children: text(w.projectName) })] }), _jsx(Box, { sx: { flex: 1 } }), w.projectJoinedOn && (_jsxs(Typography, { sx: { fontSize: 13, color: wf.textSecondary }, children: [t('workforce.startedOn'), " ", _jsx("b", { style: { color: wf.text }, children: date(w.projectJoinedOn) }), w.workDays !== null && (_jsxs(_Fragment, { children: [' · ', _jsx("b", { style: { color: wf.text }, children: w.workDays.toLocaleString('en-US') }), " ", t('workforce.workDaysSuffix')] }))] }))] })), _jsxs(Box, { component: "dl", sx: { m: 0, mt: 1.5, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, columnGap: 2.5 }, children: [staff && _jsx(Row, { label: t('workforce.col.hired'), children: w.projectJoinedOn ? date(w.projectJoinedOn) : missing }), _jsx(Row, { label: t(staff ? 'workforce.field.jobTitle' : 'workforce.col.profession'), children: text(ar ? w.professionAr : w.professionEn) }), _jsx(Row, { label: t('workforce.col.nationality'), children: text(ar ? w.nationalityAr : w.nationalityEn) }), !staff && _jsx(Row, { label: t('workforce.col.sponsor'), children: text(w.sponsor, true) }), _jsx(Row, { label: t('workforce.overview.iqamaEnds'), children: iqamaEnds ? date(iqamaEnds) : missing }), !staff && _jsx(Row, { label: t('workforce.field.agent'), children: text(worker.recruitmentAgent, true) }), !staff && _jsx(Row, { label: t('workforce.overview.lastPrice'), children: lastPrice === null ? missing : money(lastPrice) })] })] }), !staff && (_jsx(Overview, { usage: usage, projectDays: projectDays, housingDays: housingDays, projects: projects, profit: seesProfit ? profit : undefined, loading: periods === null }))] }), _jsxs(Box, { sx: { ...card, overflow: 'hidden' }, children: [_jsx(UnderlineTabs, { value: tab, onChange: setTab, label: title, options: [
                            { value: 'info', label: t(staff ? 'workforce.tabs.staffInfo' : 'workforce.tabs.info') },
                            { value: 'actions', label: t(staff ? 'workforce.tabs.staffActions' : 'workforce.tabs.actions'), count: periods?.length },
                            ...(staff || !can('billing.invoices.view', true) ? [] : [{ value: 'invoices', label: t('workforce.tabs.invoices') }]),
                            { value: 'ids', label: t('workforce.ui.idsTab'), count: worker.identifiers.length },
                            ...(staff ? [] : [{ value: 'profile', label: t('workforce.tabs.profile') }]),
                            ...(staff || !can('workforce.costs.view', true) ? [] : [{ value: 'cost', label: t('workforce.tabs.cost') }]),
                        ] }), _jsxs(Box, { role: "tabpanel", sx: { p: { xs: 1.5, md: 2.5 } }, children: [tab === 'invoices' ? (_jsx(WorkerInvoices, { workerId: id })) : tab === 'actions' ? (periods ? _jsx(WorkerActions, { workerId: id, periods: periods, withDocuments: !staff }) : _jsx(LinearProgress, {})) : tab === 'cost' ? (_jsx(WorkerCostTab, { workerId: id, name: w.name })) : tab === 'profile' ? (_jsx(WorkerProfileTab, { workerId: id })) : tab === 'info' ? (_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, alignItems: 'start' }, children: [_jsxs(Stack, { spacing: 2, children: [_jsxs(Section, { title: t('workforce.sections.basic'), icon: _jsx(BadgeOutlinedIcon, {}), children: [_jsx(Row, { label: t(staff ? 'workforce.field.employeeNo' : 'workforce.col.number'), children: _jsx("bdi", { children: w.workerNo }) }), _jsx(Row, { label: t('workforce.field.iqama'), children: text(w.iqama, true) }), _jsx(Row, { label: t('workforce.field.name'), wide: true, children: _jsx("bdi", { children: w.name }) }), _jsx(Row, { label: t('workforce.col.nationality'), children: text(ar ? w.nationalityAr : w.nationalityEn) }), _jsx(Row, { label: t('workforce.col.status'), children: _jsx(StatusPill, { placement: w.placement, children: status }) })] }), staff ? (_jsxs(Section, { title: t('workforce.sections.staffJob'), icon: _jsx(WorkOutlineOutlinedIcon, {}), children: [_jsx(Row, { label: t('workforce.field.jobTitle'), wide: true, children: text(ar ? w.professionAr : w.professionEn) }), _jsx(Row, { label: t('workforce.col.hired'), children: w.projectJoinedOn ? date(w.projectJoinedOn) : missing }), _jsx(Row, { label: t('workforce.field.arrived'), children: worker.arrivedOn ? date(worker.arrivedOn) : missing }), _jsx(Row, { label: t('workforce.field.iqamaProfession'), wide: true, children: text(ar ? worker.iqamaProfessionAr : worker.iqamaProfessionEn) })] })) : (_jsxs(Section, { title: t('workforce.sections.job'), icon: _jsx(AccountTreeOutlinedIcon, {}), children: [_jsx(Row, { label: t('workforce.col.profession'), children: text(ar ? w.professionAr : w.professionEn) }), _jsx(Row, { label: t('workforce.col.sponsor'), children: text(w.sponsor, true) }), _jsx(Row, { label: t('workforce.field.project'), wide: true, children: text(w.projectName) }), _jsx(Row, { label: t('workforce.field.projectJoined'), children: w.projectJoinedOn ? date(w.projectJoinedOn) : missing }), _jsx(Row, { label: t('workforce.col.workDays'), children: days(w.workDays) }), _jsx(Row, { label: t('workforce.field.iqamaProfession'), children: text(ar ? worker.iqamaProfessionAr : worker.iqamaProfessionEn) }), _jsx(Row, { label: t('workforce.field.arrived'), children: worker.arrivedOn ? date(worker.arrivedOn) : missing }), _jsx(Row, { label: t('workforce.field.agent'), wide: true, children: text(worker.recruitmentAgent, true) })] }))] }), _jsxs(Stack, { spacing: 2, children: [_jsx(Section, { title: t('workforce.sections.salary'), icon: _jsx(PaidOutlinedIcon, {}), children: w.salary ? (_jsxs(_Fragment, { children: [_jsx(Row, { label: t('workforce.salary.basic'), children: money(w.salary.basic) }), _jsx(Row, { label: t('workforce.salary.housing'), children: money(w.salary.housing) }), _jsx(Row, { label: t('workforce.salary.food'), children: money(w.salary.food) }), _jsx(Row, { label: t('workforce.salary.transport'), children: money(w.salary.transport) }), _jsx(Row, { label: t('workforce.salary.overtime'), children: money(w.salary.overtime) }), _jsx(Row, { label: t('workforce.salary.other'), children: money(w.salary.other) }), _jsx(Row, { label: t(staff ? 'workforce.salary.fixed' : 'workforce.salary.project'), children: money(w.salary.project) }), w.salary.hardship > 0 && _jsx(Row, { label: t('workforce.salary.hardship'), children: money(w.salary.hardship) }), _jsx(Row, { label: t('workforce.salary.total'), highlight: true, children: money(w.salary.total) })] })) : (_jsx(Typography, { sx: { gridColumn: '1 / -1', fontSize: 13, color: wf.textSecondary }, children: t('workforce.noSalaryPermission') })) }), _jsxs(Section, { title: t('workforce.sections.contract'), icon: _jsx(DescriptionOutlinedIcon, {}), children: [_jsx(Row, { label: t('workforce.field.contractStart'), children: worker.contract.startsOn ? date(worker.contract.startsOn) : missing }), _jsx(Row, { label: t('workforce.field.contractMonths'), children: worker.contract.months === null ? missing : (_jsxs(_Fragment, { children: [worker.contract.months, unit(t('workforce.months'))] })) }), _jsx(Row, { label: t('workforce.field.contractEnd'), children: worker.contract.endsOn ? date(worker.contract.endsOn) : missing })] }), _jsxs(Section, { title: t('workforce.sections.leave'), icon: _jsx(BeachAccessOutlinedIcon, {}), children: [_jsx(Row, { label: t('workforce.leave.annual'), children: days(worker.leave.annualDays) }), _jsx(Row, { label: t('workforce.leave.balance'), children: days(worker.leave.balance) }), _jsx(Row, { label: t('workforce.leave.oldConsumed'), children: days(worker.leave.oldConsumed) }), _jsx(Row, { label: t('workforce.leave.consumed'), children: days(worker.leave.consumed) }), _jsx(Row, { label: t('workforce.leave.remaining'), highlight: true, children: days(worker.leave.remaining) })] })] })] })) : (_jsx(Identifiers, { worker: worker, date: date })), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mt: 2, fontSize: 12.5, color: wf.textSecondary }, children: [_jsx(InfoOutlinedIcon, { sx: { fontSize: 16 } }), t('workforce.readOnly')] })] })] }), acting && _jsx(ActionDialog, { workerId: w.id, onClose: () => setActing(false), onSent: () => setSent((n) => n + 1) })] }));
}
/**
 * «الملخص التشغيلي»: the share of the days on projects since arrival (project days ÷ project and housing days, as
 * before), as a small navy ring, then the project and housing days, the projects and the last month's profit.
 */
function Overview({ usage, projectDays, housingDays, projects, profit, loading }) {
    const { t } = useTranslation();
    const n = (v) => v.toLocaleString('en-US');
    const rows = [
        { label: t('workforce.overview.projectDays'), value: n(projectDays) },
        { label: t('workforce.overview.housingDays'), value: n(housingDays) },
        { label: t('workforce.overview.projects'), value: n(projects) },
    ];
    if (profit !== undefined) {
        rows.push({
            label: t('workforce.overview.profit'),
            value: profit === null ? '—' : (_jsxs(_Fragment, { children: [profit.toLocaleString('en-US', { maximumFractionDigits: 0 }), " ", _jsx("small", { style: { fontWeight: 500, color: wf.textSecondary }, children: t('workforce.sar') })] })),
        });
    }
    const ring = usage ?? 0;
    const r = 30;
    const circumference = 2 * Math.PI * r;
    return (_jsxs(Box, { component: "section", sx: { ...card, p: 2.5 }, children: [_jsx(Typography, { component: "h2", sx: { fontSize: 16, fontWeight: 600, color: wf.navy, mb: 1.5 }, children: t('workforce.ui.opsTitle') }), _jsxs(Stack, { direction: "row", sx: { gap: 2, alignItems: 'center' }, children: [_jsxs(Box, { role: "img", "aria-label": t('workforce.overview.usage', { value: usage ?? '—' }), sx: { position: 'relative', flex: '0 0 auto', width: 76, height: 76 }, children: [_jsxs("svg", { width: "76", height: "76", viewBox: "0 0 76 76", "aria-hidden": true, children: [_jsx("circle", { cx: "38", cy: "38", r: r, fill: "none", stroke: wf.subtle, strokeWidth: "7" }), ring > 0 && _jsx("circle", { cx: "38", cy: "38", r: r, fill: "none", stroke: wf.navy, strokeWidth: "7", strokeLinecap: "round", strokeDasharray: `${(circumference * ring) / 100} ${circumference}`, transform: "rotate(-90 38 38)" })] }), _jsx(Box, { sx: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 600, color: wf.navy, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: loading || usage === null ? '—' : `${usage}%` }) })] }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 14, fontWeight: 600, color: wf.text }, children: t('workforce.ui.usageLabel') }), _jsx(Typography, { sx: { mt: 0.25, fontSize: 12.5, color: wf.textSecondary, lineHeight: 1.5 }, children: t('workforce.ui.usageHint') })] })] }), _jsx(Box, { component: "dl", sx: { m: 0, mt: 1.5 }, children: rows.map((row) => (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'space-between', py: 1, borderTop: `1px solid ${wf.subtle}`, fontSize: 13.5 }, children: [_jsx(Box, { component: "dt", sx: { color: wf.textSecondary }, children: row.label }), _jsx(Box, { component: "dd", sx: { m: 0, fontWeight: 600, color: wf.text, fontVariantNumeric: 'tabular-nums' }, children: row.value })] }, row.label))) })] }));
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
