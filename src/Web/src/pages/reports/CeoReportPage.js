import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import CloseIcon from '@mui/icons-material/Close';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Alert, Box, Button, ButtonBase, Drawer, IconButton, InputAdornment, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, TextField, Tooltip, Typography, } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { ceoApi, movementApi, reportsApi } from '../../api/reports';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Columns } from '../../components/charts';
import { accents, appear, card, CardTitle, Empty, Hero, Kpi, Legend, Loading, PrintStyles, Ticker, useFormat, useMark } from './reportKit';
import { DrillDrawer, FinanceTab } from './ExecutiveReportPage';
import { ProjectCost, WorkerCost } from './CostBreakdown';
const positive = '#059669';
const negative = '#DC2626';
const profitColor = (v) => (v < 0 ? negative : positive);
/**
 * The CEO report (docs/03-migration-plan/16): the company's state in an invoiced month — profit and loss against the
 * month before, where the money goes, what needs a decision — then the profitability of the projects, the suppliers
 * and each worker, the workforce and housing now, and the finance. Every figure comes from the server.
 */
export function CeoReportPage() {
    const { t } = useTranslation();
    const { can } = useSession();
    const f = useFormat();
    const [tab, setTab] = useState('overview');
    const [month, setMonth] = useState(null);
    const [overview, setOverview] = useState(undefined);
    const [open, setOpen] = useState(null);
    const [error, setError] = useState(null);
    const profitAllowed = can('reports.profit.view', true);
    useEffect(() => {
        if (!profitAllowed)
            return;
        setOverview(undefined);
        setError(null);
        ceoApi
            .overview(month)
            .then((o) => setOverview(o ?? null))
            .catch((e) => setError(errorKey(e)));
    }, [month, profitAllowed]);
    if (!can('reports.executive.view', true))
        return _jsx(Alert, { severity: "warning", children: t('exec.noAccess') });
    if (!profitAllowed)
        return _jsx(Alert, { severity: "warning", children: t('ceo.noProfit') });
    const shown = overview?.month ?? month;
    const tabs = [
        { key: 'overview', icon: _jsx(InsightsOutlinedIcon, {}) },
        { key: 'profit', icon: _jsx(ShowChartOutlinedIcon, {}) },
        { key: 'workforce', icon: _jsx(GroupsOutlinedIcon, {}) },
        ...(can('billing.invoices.view', true) ? [{ key: 'finance', icon: _jsx(PaymentsOutlinedIcon, {}) }] : []),
    ];
    return (_jsxs(Box, { children: [_jsx(PrintStyles, {}), _jsxs(Stack, { direction: "row", className: "no-print", sx: { ...card, p: 0.75, gap: 0.5, mb: 1.75, flexWrap: 'wrap', alignItems: 'center' }, role: "tablist", children: [tabs.map((k) => (_jsxs(ButtonBase, { role: "tab", "aria-selected": tab === k.key, onClick: () => setTab(k.key), sx: { gap: 1, px: 2, py: 1.1, borderRadius: '10px', fontWeight: 700, fontSize: 13.5, color: tab === k.key ? '#fff' : tokens.gray600, bgcolor: tab === k.key ? tokens.navy700 : 'transparent', '& svg': { fontSize: 19 } }, children: [k.icon, t(`ceo.tabs.${k.key}`)] }, k.key))), _jsx(Box, { sx: { flex: 1 } }), _jsxs(Box, { sx: { px: 1, textAlign: 'end' }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('ceo.invoicedMonth') }), overview?.periodFrom && overview.periodTo && (_jsx(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: _jsx("bdi", { children: t('ceo.periodHint', { from: f.day(overview.periodFrom), to: f.day(overview.periodTo) }) }) }))] }), (overview?.months ?? []).slice(0, 6).map((m) => (_jsx(ButtonBase, { onClick: () => setMonth(m), "aria-pressed": shown === m, sx: { px: 1.5, py: 0.75, borderRadius: 99, fontSize: 12.5, fontWeight: 700, border: `1px solid ${shown === m ? tokens.navy800 : tokens.gray200}`, bgcolor: shown === m ? tokens.navy800 : '#fff', color: shown === m ? '#fff' : tokens.navy800 }, children: f.monthLong(m) }, m))), _jsx(IconButton, { onClick: () => window.print(), "aria-label": t('exec.print'), children: _jsx(PrintOutlinedIcon, {}) })] }), _jsx(ErrorMessage, { messageKey: error }), overview === undefined ? (!error && _jsx(Loading, {})) : overview === null ? (_jsx(Alert, { severity: "info", children: t('ceo.noInvoices') })) : tab === 'overview' ? (_jsx(OverviewTab, { data: overview, onOpen: setOpen, onTab: setTab }, overview.month)) : tab === 'profit' ? (_jsx(ProfitTab, { month: overview.month, onOpen: setOpen }, overview.month)) : tab === 'workforce' ? (_jsx(WorkforceTab, { data: overview, month: overview.month }, overview.month)) : (_jsx(FinanceMonth, { month: overview.month }, overview.month)), open && overview && _jsx(WorkersDrawer, { month: overview.month, ...open, onClose: () => setOpen(null) })] }));
}
function useMoney() {
    const f = useFormat();
    return (v) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : f.n(v));
}
function OverviewTab({ data, onOpen, onTab }) {
    const { t } = useTranslation();
    const f = useFormat();
    const money = useMoney();
    const mark = useMark();
    const a = data.alerts;
    const lines = [];
    if (data.profit.value !== null)
        lines.push(mark('ceo.ins.profit', { profit: money(data.profit.value), margin: data.margin.value ?? 0 }));
    if (data.margin.previous !== null && data.margin.value !== null)
        lines.push(mark(data.margin.value >= data.margin.previous ? 'ceo.ins.marginUp' : 'ceo.ins.marginDown', { diff: Math.abs(data.margin.value - data.margin.previous).toFixed(1) }));
    if (a.losingProjects)
        lines.push(mark('ceo.ins.losing', { count: a.losingProjects, total: money(Math.abs(a.losingTotal)) }));
    if (a.unbilledProjects)
        lines.push(mark('ceo.ins.unbilled', { count: a.unbilledWorkers, projects: a.unbilledProjects }));
    if (data.uncostedWorkers)
        lines.push(mark('ceo.ins.uncosted', { count: data.uncostedWorkers, revenue: money(data.uncostedRevenue) }));
    if (data.lostRevenue.value)
        lines.push(mark('ceo.ins.lost', { revenue: money(data.lostRevenue.value), days: f.n(data.housingDays), profit: money(data.lostProfit.value ?? 0) }));
    if (data.collectionRate.value !== null)
        lines.push(mark('ceo.ins.collection', { rate: data.collectionRate.value }));
    const steps = [
        { key: 'Revenue', amount: data.revenue.value ?? 0 },
        ...(data.uncostedRevenue ? [{ key: 'Uncosted', amount: -data.uncostedRevenue }] : []),
        ...data.breakdown.filter((b) => b.amount !== 0).map((b) => ({ key: b.key, amount: -b.amount })),
    ];
    const top = Math.max(1, data.revenue.value ?? 0);
    let run = top;
    const colors = { Revenue: tokens.navy700, Uncosted: '#94A3B8', CompanySalaries: accents.amber, SupplierCosts: '#b45309', IdleCost: negative, WorkerExpenses: accents.violet, ProjectExpenses: accents.teal, GeneralExpenses: tokens.gray500 };
    return (_jsxs(Box, { children: [_jsxs(Hero, { children: [_jsx(Kpi, { index: 0, label: t('ceo.kpi.revenue'), icon: _jsx(ReceiptLongOutlinedIcon, {}), figure: data.revenue, unit: t('exec.sar'), money: true, good: "up", spark: data.trend.map((x) => x.revenue), note: t('ceo.kpi.revenueNote') }), _jsx(Kpi, { index: 1, label: t('ceo.kpi.cost'), icon: _jsx(PaymentsOutlinedIcon, {}), figure: data.cost, unit: t('exec.sar'), money: true, good: "down", spark: data.trend.map((x) => x.cost), note: t('ceo.kpi.costNote') }), _jsx(Kpi, { index: 2, label: t('ceo.kpi.profit'), icon: _jsx(TrendingUpOutlinedIcon, {}), figure: data.profit, unit: t('exec.sar'), money: true, good: "up", spark: data.trend.map((x) => x.profit) }), _jsx(Kpi, { index: 3, label: t('ceo.kpi.margin'), icon: _jsx(PercentOutlinedIcon, {}), figure: data.margin, unit: "%", good: "up", note: data.uncostedWorkers ? t('ceo.kpi.marginNote', { count: data.uncostedWorkers }) : undefined }), _jsx(Kpi, { index: 4, label: t('ceo.kpi.idle'), icon: _jsx(BedOutlinedIcon, {}), figure: data.idleCost, unit: t('exec.sar'), money: true, good: "down", note: t('ceo.kpi.idleNote', { count: f.n(data.idleDays) }), onClick: () => onOpen({ title: t('ceo.kpi.idle'), query: { housing: true } }) }), _jsx(Kpi, { index: 5, label: t('ceo.kpi.lost'), icon: _jsx(HourglassBottomOutlinedIcon, {}), figure: data.lostRevenue, unit: t('exec.sar'), money: true, good: "down", note: t('ceo.kpi.lostNote', { days: f.n(data.housingDays), profit: f.n(data.lostProfit.value ?? 0) }), onClick: () => onOpen({ title: t('ceo.kpi.lost'), query: { lost: true } }) })] }), _jsx(Ticker, { lines: lines }), _jsxs(Box, { sx: { display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' }, mb: 1.75 }, children: [_jsxs(Box, { sx: { ...card, ...appear(0.35) }, children: [_jsx(CardTitle, { icon: _jsx(ShowChartOutlinedIcon, {}), title: t('ceo.flow.title'), hint: t('ceo.flow.hint', { month: f.monthLong(data.month) }) }), _jsxs(Stack, { sx: { gap: 1 }, children: [steps.map((s, i) => {
                                        const width = (Math.abs(s.amount) / top) * 100;
                                        const start = s.key === 'Revenue' ? 0 : ((run + s.amount) / top) * 100;
                                        if (s.key !== 'Revenue')
                                            run += s.amount;
                                        return (_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: 'minmax(0, 210px) 1fr 120px', gap: 1.25, alignItems: 'center' }, children: [_jsxs(Typography, { noWrap: true, sx: { fontSize: 12.5 }, children: [s.key === 'Revenue' ? '' : '− ', t(`ceo.flow.${s.key}`)] }), _jsx(Box, { sx: { position: 'relative', height: 22, borderRadius: '6px', bgcolor: tokens.gray100, overflow: 'hidden' }, children: _jsx(Box, { sx: { position: 'absolute', top: 0, bottom: 0, insetInlineStart: `${Math.max(0, start)}%`, width: `${Math.max(0.5, width)}%`, borderRadius: '6px', bgcolor: colors[s.key] ?? tokens.gray500, ...appear(0.4 + i * 0.05) } }) }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 800, textAlign: 'end', color: s.amount < 0 ? negative : tokens.navy800, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: f.n(s.amount) }) })] }, s.key));
                                    }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: 'minmax(0, 210px) 1fr 120px', gap: 1.25, alignItems: 'center', borderTop: `1px dashed ${tokens.gray200}`, pt: 1 }, children: [_jsxs(Typography, { sx: { fontSize: 13, fontWeight: 800 }, children: ["= ", t('ceo.kpi.profit')] }), _jsx(Box, { sx: { position: 'relative', height: 22, borderRadius: '6px', bgcolor: tokens.gray100, overflow: 'hidden' }, children: _jsx(Box, { sx: { position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0, width: `${Math.max(0.5, (Math.abs(data.profit.value ?? 0) / top) * 100)}%`, borderRadius: '6px', bgcolor: profitColor(data.profit.value ?? 0) } }) }), _jsx(Typography, { sx: { fontSize: 14, fontWeight: 800, textAlign: 'end', color: profitColor(data.profit.value ?? 0) }, children: _jsx("bdi", { children: f.n(data.profit.value ?? 0) }) })] })] }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500, mt: 1.25 }, children: t('ceo.flow.note') })] }), _jsxs(Box, { sx: { ...card, ...appear(0.43) }, children: [_jsx(CardTitle, { icon: _jsx(WarningAmberOutlinedIcon, {}), title: t('ceo.alerts.title'), hint: t('ceo.alerts.hint') }), _jsxs(Stack, { sx: { gap: 1 }, children: [a.losingProjects > 0 && _jsx(AlertRow, { tone: negative, icon: _jsx(TrendingDownOutlinedIcon, {}), text: t('ceo.alerts.losing', { count: a.losingProjects, total: f.n(Math.abs(a.losingTotal)), worst: a.worstProject ?? '—', loss: f.n(Math.abs(a.worstLoss ?? 0)) }), onClick: () => onTab('profit') }), a.unbilledProjects > 0 && _jsx(AlertRow, { tone: accents.amber, icon: _jsx(ReceiptLongOutlinedIcon, {}), text: t('ceo.alerts.unbilled', { count: a.unbilledWorkers, projects: a.unbilledProjects, largest: a.unbilledLargest ?? '—' }), onClick: () => onTab('profit') }), a.suppliersInHousing > 0 && _jsx(AlertRow, { tone: negative, icon: _jsx(BedOutlinedIcon, {}), text: a.dailyIdleCost > 0 ? t('ceo.alerts.housing', { count: a.suppliersInHousing, daily: f.n(a.dailyIdleCost) }) : t('ceo.alerts.housingNoCost', { count: a.suppliersInHousing }), onClick: () => onOpen({ title: t('ceo.kpi.idle'), query: { housing: true, source: 'Supplier' } }) }), (data.lostRevenue.value ?? 0) > 0 && _jsx(AlertRow, { tone: accents.amber, icon: _jsx(HourglassBottomOutlinedIcon, {}), text: t('ceo.alerts.lost', { revenue: f.n(data.lostRevenue.value ?? 0), days: f.n(data.housingDays), profit: f.n(data.lostProfit.value ?? 0) }), onClick: () => onOpen({ title: t('ceo.kpi.lost'), query: { lost: true } }) }), a.missingCosts > 0 && _jsx(AlertRow, { tone: tokens.info, icon: _jsx(ReportProblemOutlinedIcon, {}), text: t('ceo.alerts.missing', { count: a.missingCosts, revenue: f.n(a.uncostedRevenue) }), link: "/workforce/supplier-costs" }), !a.losingProjects && !a.unbilledProjects && !a.suppliersInHousing && !a.missingCosts && _jsx(Empty, {})] })] })] }), _jsxs(Box, { sx: { display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' } }, children: [_jsxs(Box, { sx: { ...card, ...appear(0.51) }, children: [_jsx(CardTitle, { icon: _jsx(ShowChartOutlinedIcon, {}), title: t('ceo.trend.title'), hint: t('ceo.trend.hint') }), _jsx(Columns, { categories: data.trend.map((x) => f.monthName(x.month)), series: [
                                    { key: 'revenue', label: t('ceo.trend.revenue'), color: tokens.navy700 },
                                    { key: 'cost', label: t('ceo.trend.cost'), color: accents.amber },
                                    { key: 'profit', label: t('ceo.trend.profit'), color: positive },
                                ], values: [data.trend.map((x) => x.revenue), data.trend.map((x) => x.cost), data.trend.map((x) => Math.max(0, x.profit))], format: (n) => f.c(n) }), _jsx(Legend, { items: [[t('ceo.trend.revenue'), tokens.navy700], [t('ceo.trend.cost'), accents.amber], [t('ceo.trend.profit'), positive]] })] }), _jsxs(Box, { sx: { ...card, ...appear(0.59) }, children: [_jsx(CardTitle, { icon: _jsx(GroupsOutlinedIcon, {}), title: t('ceo.sources.title'), hint: t('ceo.sources.hint') }), data.sources.length === 0 ? (_jsx(Empty, {})) : (_jsx(Stack, { sx: { gap: 1.5 }, children: data.sources.map((s) => (_jsxs(ButtonBase, { onClick: () => onOpen({ title: t(`ceo.source.${s.source}`), query: { source: s.source } }), sx: { display: 'block', textAlign: 'start', borderRadius: '12px', p: 1.25, border: `1px solid ${tokens.gray100}`, '&:hover': { bgcolor: tokens.navy50 } }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }, children: [_jsx(Typography, { sx: { fontWeight: 800, fontSize: 13.5 }, children: t(`ceo.source.${s.source}`) }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('ceo.sources.workers', { count: f.n(s.workers) }) })] }), _jsxs(Stack, { direction: "row", sx: { gap: 2, fontSize: 12.5 }, children: [_jsxs("span", { children: [t('ceo.trend.revenue'), ": ", _jsx("b", { children: _jsx("bdi", { children: money(s.revenue) }) })] }), s.missingCosts > 0 && s.missingCosts === s.workers ? (_jsx(Box, { component: "span", sx: { color: tokens.info, fontWeight: 700 }, children: t('ceo.sources.noCost') })) : (_jsxs("span", { children: [t('ceo.trend.profit'), ": ", _jsx("b", { style: { color: profitColor(s.profit) }, children: _jsx("bdi", { children: money(s.profit) }) }), " \u00B7 ", t('ceo.kpi.margin'), " ", _jsx("b", { children: _jsxs("bdi", { children: [s.margin ?? '—', "%"] }) })] }))] }), s.source === 'Unknown' && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500, mt: 0.5 }, children: t('ceo.sources.unknownHint') })] }, s.source))) }))] })] })] }));
}
function AlertRow({ tone, icon, text, onClick, link }) {
    const navigate = useNavigate();
    return (_jsxs(ButtonBase, { onClick: onClick ?? (link ? () => navigate(link) : undefined), sx: { display: 'flex', gap: 1.25, alignItems: 'flex-start', justifyContent: 'flex-start', textAlign: 'start', p: 1.25, borderRadius: '10px', bgcolor: `${tone}12`, borderInlineStart: `4px solid ${tone}`, '& svg': { color: tone, fontSize: 20, mt: '1px' } }, children: [icon, _jsx(Typography, { sx: { fontSize: 12.5, lineHeight: 1.7 }, children: text })] }));
}
function ProfitTab({ month, onOpen }) {
    const { t } = useTranslation();
    const f = useFormat();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [sort, setSort] = useState({ by: 'profit', asc: true });
    useEffect(() => {
        ceoApi.profit(month).then((d) => setData(d ?? null)).catch((e) => setError(errorKey(e)));
    }, [month]);
    const rows = useMemo(() => {
        if (!data)
            return [];
        const list = data.projects.filter((p) => filter === 'losing' ? p.revenue > 0 && p.profit < 0 : filter === 'unbilled' ? p.unbilledWorkers > 0 : filter === 'weak' ? p.margin !== null && p.margin < 5 : true);
        const key = (p) => (sort.by === 'margin' ? p.margin ?? -999 : p[sort.by]);
        return [...list].sort((a, b) => (sort.asc ? key(a) - key(b) : key(b) - key(a)));
    }, [data, filter, sort]);
    if (error)
        return _jsx(ErrorMessage, { messageKey: error });
    if (!data)
        return _jsx(Loading, {});
    const head = (by, label) => (_jsx(TableSortLabel, { active: sort.by === by, direction: sort.by === by && sort.asc ? 'asc' : 'desc', onClick: () => setSort({ by, asc: sort.by === by ? !sort.asc : false }), children: label }));
    return (_jsxs(Box, { children: [_jsxs(Hero, { children: [_jsx(Kpi, { index: 0, label: t('ceo.kpi.profit'), icon: _jsx(TrendingUpOutlinedIcon, {}), figure: data.profit, unit: t('exec.sar'), money: true, good: "up" }), _jsx(Kpi, { index: 1, label: t('ceo.kpi.margin'), icon: _jsx(PercentOutlinedIcon, {}), figure: data.margin, unit: "%", good: "up" }), _jsx(Kpi, { index: 2, label: t('ceo.profit.losing'), icon: _jsx(TrendingDownOutlinedIcon, {}), value: data.losingProjects, unit: t('ceo.profit.projectsUnit'), note: t('ceo.profit.total', { total: f.n(data.losingTotal) }), onClick: () => setFilter('losing') }), _jsx(Kpi, { index: 3, label: t('ceo.profit.perWorker'), icon: _jsx(EngineeringOutlinedIcon, {}), value: data.averageWorkerProfit, unit: t('ceo.profit.perMonth') }), _jsx(Kpi, { index: 4, label: t('ceo.profit.losingWorkers'), icon: _jsx(ReportProblemOutlinedIcon, {}), value: data.losingWorkers, unit: t('exec.worker'), note: t('ceo.profit.total', { total: f.n(data.losingWorkersTotal) }), onClick: () => onOpen({ title: t('ceo.profit.losingWorkers'), query: { losing: true } }) }), _jsx(Kpi, { index: 5, label: t('ceo.profit.suppliers'), icon: _jsx(LocalShippingOutlinedIcon, {}), value: data.suppliers.reduce((s, x) => s + x.workers, 0), unit: t('exec.worker'), note: t('ceo.profit.suppliersNote', { count: data.suppliers.reduce((s, x) => s + x.missingCosts, 0) }) })] }), _jsxs(Box, { sx: { ...card, mb: 1.75, ...appear(0.3) }, children: [_jsx(CardTitle, { icon: _jsx(AccountTreeOutlinedIcon, {}), title: t('ceo.profit.projects'), hint: t('ceo.profit.projectsHint', { month: f.monthLong(month) }) }), _jsx(Stack, { direction: "row", sx: { gap: 0.75, mb: 1.5, flexWrap: 'wrap' }, children: ['all', 'losing', 'unbilled', 'weak'].map((k) => (_jsx(ButtonBase, { onClick: () => setFilter(k), "aria-pressed": filter === k, sx: { px: 1.5, py: 0.5, borderRadius: 99, fontSize: 12.5, fontWeight: 700, border: `1px solid ${filter === k ? tokens.navy800 : tokens.gray200}`, bgcolor: filter === k ? tokens.navy800 : '#fff', color: filter === k ? '#fff' : tokens.navy800 }, children: t(`ceo.profit.filter.${k}`, { count: k === 'all' ? data.projects.length : k === 'losing' ? data.losingProjects : k === 'unbilled' ? data.projects.filter((p) => p.unbilledWorkers > 0).length : data.projects.filter((p) => p.margin !== null && p.margin < 5).length }) }, k))) }), rows.length === 0 ? (_jsx(Empty, {})) : (_jsx(TableContainer, { sx: { maxHeight: 560 }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('ceo.col.project') }), _jsx(TableCell, { align: "right", children: head('workers', t('ceo.col.workers')) }), _jsx(TableCell, { align: "right", children: t('ceo.col.workDays') }), _jsx(TableCell, { align: "right", children: head('revenue', t('ceo.col.revenue')) }), _jsx(TableCell, { align: "right", children: t('ceo.col.cost') }), _jsx(TableCell, { align: "right", children: head('profit', t('ceo.col.profit')) }), _jsx(TableCell, { children: head('margin', t('ceo.col.margin')) })] }) }), _jsx(TableBody, { children: rows.map((p) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => onOpen({ title: p.name, query: { project: p.projectCrmId } }), children: [_jsxs(TableCell, { children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700 }, children: p.name }), _jsxs(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: [p.manager ?? '—', p.unbilledWorkers > 0 && (_jsxs(Box, { component: "span", sx: { color: accents.amber, fontWeight: 700 }, children: [' · ', p.revenue === 0 ? t('ceo.profit.notBilled') : t('ceo.profit.unbilledSome', { count: p.unbilledWorkers })] })), p.missingCosts > 0 && (_jsxs(Box, { component: "span", sx: { color: tokens.info, fontWeight: 700 }, children: [' · ', t('ceo.profit.missingSome', { count: p.missingCosts })] }))] })] }), _jsx(TableCell, { align: "right", children: p.workers }), _jsx(TableCell, { align: "right", children: f.n(p.workDays) }), _jsx(TableCell, { align: "right", children: f.n(p.revenue) }), _jsxs(TableCell, { align: "right", children: [_jsx(ProjectCost, { p: p }), p.expenses > 0 && _jsx(Typography, { sx: { fontSize: 10.5, color: tokens.gray500 }, children: t('ceo.profit.withExpenses', { amount: f.n(p.expenses) }) })] }), _jsx(TableCell, { align: "right", sx: { fontWeight: 800, color: profitColor(p.profit) }, children: _jsx("bdi", { children: f.n(p.profit) }) }), _jsx(TableCell, { children: p.margin === null ? ('—') : (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75 }, children: [_jsx(Box, { sx: { width: 70, height: 8, borderRadius: 4, bgcolor: tokens.gray100, overflow: 'hidden' }, children: _jsx(Box, { sx: { width: `${Math.min(100, Math.abs(p.margin))}%`, height: '100%', bgcolor: profitColor(p.margin) } }) }), _jsx(Typography, { sx: { fontSize: 12, fontWeight: 700 }, children: _jsxs("bdi", { children: [p.margin, "%"] }) })] })) })] }, p.projectCrmId ?? p.name))) })] }) }))] }), _jsxs(Box, { sx: { ...card, ...appear(0.4) }, children: [_jsx(CardTitle, { icon: _jsx(LocalShippingOutlinedIcon, {}), title: t('ceo.profit.suppliersTitle'), hint: t('ceo.profit.suppliersHint') }), data.suppliers.length === 0 ? (_jsx(Empty, {})) : (_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('ceo.col.supplier') }), _jsx(TableCell, { align: "right", children: t('ceo.col.workers') }), _jsx(TableCell, { align: "right", children: t('ceo.col.revenue') }), _jsx(TableCell, { align: "right", children: t('ceo.col.cost') }), _jsx(TableCell, { align: "right", children: t('ceo.col.idle') }), _jsx(TableCell, { align: "right", children: t('ceo.col.lost') }), _jsx(TableCell, { align: "right", children: t('ceo.col.profit') })] }) }), _jsx(TableBody, { children: data.suppliers.map((s) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => onOpen({ title: s.supplier, query: { supplier: s.supplier } }), children: [_jsx(TableCell, { sx: { fontWeight: 700 }, children: _jsx("bdi", { children: s.supplier }) }), _jsx(TableCell, { align: "right", children: s.workers }), _jsx(TableCell, { align: "right", children: f.n(s.revenue) }), _jsx(TableCell, { align: "right", children: s.missingCosts === s.workers ? _jsx(Box, { component: "span", sx: { color: tokens.info, fontWeight: 700 }, children: t('ceo.sources.noCost') }) : f.n(s.cost) }), _jsxs(TableCell, { align: "right", children: [f.n(s.idleCost), _jsx(Typography, { sx: { fontSize: 10.5, color: tokens.gray500 }, children: t('ceo.profit.idleDays', { count: f.n(s.idleDays) }) })] }), _jsx(TableCell, { align: "right", sx: { color: s.lostRevenue ? accents.amber : undefined, fontWeight: 700 }, children: f.n(s.lostRevenue) }), _jsxs(TableCell, { align: "right", sx: { fontWeight: 800, color: s.missingCosts === s.workers ? tokens.gray500 : profitColor(s.profit) }, children: [s.missingCosts === s.workers ? '—' : _jsx("bdi", { children: f.n(s.profit) }), s.missingCosts > 0 && s.missingCosts < s.workers && _jsx(Typography, { sx: { fontSize: 10.5, color: tokens.info }, children: t('ceo.profit.missingSome', { count: s.missingCosts }) })] })] }, s.supplier))) })] }) })), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500, mt: 1.25 }, children: t('ceo.profit.example') })] })] }));
}
function WorkforceTab({ data, month }) {
    const { t } = useTranslation();
    const f = useFormat();
    const navigate = useNavigate();
    const { can } = useSession();
    const [moves, setMoves] = useState(null);
    useEffect(() => {
        if (!can('reports.movement.view', true))
            return;
        const [y, m] = month.split('-').map(Number);
        movementApi.overview(`${month}-01`, `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`).then(setMoves).catch(() => undefined);
    }, [month, can]);
    return (_jsxs(Box, { children: [_jsxs(Hero, { children: [_jsx(Kpi, { index: 0, label: t('ceo.kpi.onJob'), icon: _jsx(EngineeringOutlinedIcon, {}), value: data.onJob, unit: t('exec.worker') }), _jsx(Kpi, { index: 1, label: t('ceo.work.inHousing'), icon: _jsx(BedOutlinedIcon, {}), value: data.inHousing, unit: t('exec.worker'), onClick: () => navigate('/housing/showroom'), note: t('ceo.work.toHousing') }), _jsx(Kpi, { index: 2, label: t('ceo.kpi.lost'), icon: _jsx(HourglassBottomOutlinedIcon, {}), figure: data.lostRevenue, unit: t('exec.sar'), money: true, good: "down", note: t('ceo.kpi.lostNote', { days: f.n(data.housingDays), profit: f.n(data.lostProfit.value ?? 0) }) }), _jsx(Kpi, { index: 3, label: t('ceo.kpi.idle'), icon: _jsx(HourglassBottomOutlinedIcon, {}), figure: data.idleCost, unit: t('exec.sar'), money: true, good: "down", note: t('ceo.kpi.idleNote', { count: f.n(data.idleDays) }) }), _jsx(Kpi, { index: 4, label: t('ceo.work.movement'), icon: _jsx(SwapHorizOutlinedIcon, {}), figure: moves?.net ?? { value: null, previous: null }, unit: t('exec.worker'), good: "up", note: moves ? t('ceo.work.moves', { starts: f.n(moves.starts.value ?? 0), returns: f.n(moves.returns.value ?? 0) }) : t('ceo.work.toMovement'), onClick: () => navigate('/reports/movement') }), _jsx(Kpi, { index: 5, label: t('ceo.work.unbilled'), icon: _jsx(ReceiptLongOutlinedIcon, {}), value: data.alerts.unbilledWorkers, unit: t('exec.worker'), note: t('ceo.work.unbilledNote', { count: data.alerts.unbilledProjects }) })] }), _jsxs(Box, { sx: { ...card, ...appear(0.3) }, children: [_jsx(CardTitle, { icon: _jsx(EngineeringOutlinedIcon, {}), title: t('ceo.work.title'), hint: t('ceo.work.hint', { month: f.monthLong(month) }) }), _jsx(WorkersList, { month: month, query: {}, withFilters: true })] })] }));
}
function FinanceMonth({ month }) {
    const [y, m] = month.split('-').map(Number);
    const from = `${month}-01`;
    const to = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    const [data, setData] = useState(null);
    const [drill, setDrill] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        reportsApi.finance(from, to).then(setData).catch((e) => setError(errorKey(e)));
    }, [from, to]);
    return (_jsxs(_Fragment, { children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(FinanceTab, { data: data, onDrill: (title, d) => setDrill({ title, drill: d }) }), drill && _jsx(DrillDrawer, { from: from, to: to, kind: "invoices", title: drill.title, drill: drill.drill, onClose: () => setDrill(null) })] }));
}
/** The workers behind a figure, the biggest losses first. */
function WorkersDrawer({ month, title, query, onClose }) {
    const { t } = useTranslation();
    return (_jsxs(Drawer, { anchor: "left", open: true, onClose: onClose, slotProps: { paper: { sx: { width: { xs: '100%', md: 980 }, p: 2 } } }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 1.5 }, children: [_jsx(Box, { sx: { width: 38, height: 38, borderRadius: '50%', bgcolor: tokens.navy50, color: tokens.navy700, display: 'grid', placeItems: 'center' }, children: _jsx(EngineeringOutlinedIcon, {}) }), _jsx(Typography, { noWrap: true, sx: { flex: 1, fontWeight: 800, fontSize: 16 }, children: title }), _jsx(IconButton, { onClick: onClose, "aria-label": t('common.close'), children: _jsx(CloseIcon, {}) })] }), _jsx(WorkersList, { month: month, query: query })] }));
}
function WorkersList({ month, query, withFilters }) {
    const { t } = useTranslation();
    const f = useFormat();
    const navigate = useNavigate();
    const { can } = useSession();
    const [rows, setRows] = useState(null);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [view, setView] = useState('all');
    const q = { ...query, search, ...(view === 'losing' ? { losing: true } : view === 'lost' ? { lost: true } : view === 'housing' ? { housing: true } : view === 'Supplier' || view === 'Company' ? { source: view } : {}) };
    const key = JSON.stringify(q);
    useEffect(() => {
        if (!can('workforce.workers.salary', true))
            return;
        setRows(null);
        const id = setTimeout(() => ceoApi.workers(month, JSON.parse(key)).then(setRows).catch((e) => setError(errorKey(e))), 250);
        return () => clearTimeout(id);
    }, [month, key, can]);
    if (!can('workforce.workers.salary', true))
        return _jsx(Alert, { severity: "info", children: t('ceo.work.noSalary') });
    return (_jsxs(Box, { children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1, mb: 1.5, alignItems: { md: 'center' } }, children: [withFilters && (_jsx(Stack, { direction: "row", sx: { gap: 0.75, flexWrap: 'wrap' }, children: ['all', 'losing', 'lost', 'housing', 'Supplier', 'Company'].map((k) => (_jsx(ButtonBase, { onClick: () => setView(k), "aria-pressed": view === k, sx: { px: 1.5, py: 0.5, borderRadius: 99, fontSize: 12.5, fontWeight: 700, border: `1px solid ${view === k ? tokens.navy800 : tokens.gray200}`, bgcolor: view === k ? tokens.navy800 : '#fff', color: view === k ? '#fff' : tokens.navy800 }, children: t(`ceo.work.view.${k}`) }, k))) })), _jsx(TextField, { size: "small", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('ceo.work.search'), sx: { flex: { md: '1 1 240px' } }, slotProps: { input: { startAdornment: (_jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, {}) })) } } }), _jsx(Button, { startIcon: _jsx(FileDownloadOutlinedIcon, {}), component: "a", href: ceoApi.workersExcel(month, q), sx: { whiteSpace: 'nowrap' }, children: t('exec.excel') })] }), _jsx(ErrorMessage, { messageKey: error }), !rows ? (_jsx(LinearProgress, {})) : rows.length === 0 ? (_jsx(Empty, {})) : (_jsx(TableContainer, { sx: { maxHeight: 'calc(100vh - 220px)' }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('ceo.col.worker') }), _jsx(TableCell, { children: t('ceo.col.source') }), _jsx(TableCell, { children: t('ceo.col.project') }), _jsx(TableCell, { align: "right", children: t('ceo.col.workDays') }), _jsx(TableCell, { align: "right", children: t('ceo.col.housingDays') }), _jsx(TableCell, { align: "right", children: t('ceo.col.revenue') }), _jsx(TableCell, { align: "right", children: t('ceo.col.cost') }), _jsx(TableCell, { align: "right", children: t('ceo.col.profit') }), _jsx(TableCell, { align: "right", children: t('ceo.col.lost') })] }) }), _jsx(TableBody, { children: rows.slice(0, 500).map((w) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/workforce/workers/${w.workerId}?tab=cost`), children: [_jsxs(TableCell, { children: [_jsx(Typography, { dir: "auto", sx: { fontSize: 12.5, fontWeight: 600, unicodeBidi: 'plaintext', textAlign: 'start' }, children: w.name }), _jsxs(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: [_jsx("bdi", { children: w.workerNo }), w.newArrival && (_jsx(Box, { component: "span", sx: { marginInlineStart: 0.75, px: 0.75, py: 0.1, borderRadius: 99, bgcolor: '#E0F2FE', color: '#075985', fontWeight: 700, fontSize: 10.5 }, children: t('ceo.work.newArrival') }))] })] }), _jsxs(TableCell, { children: [t(`ceo.source.${w.source}`), w.supplier && w.source === 'Supplier' && (_jsx(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: _jsx("bdi", { children: w.supplier }) }))] }), _jsx(TableCell, { sx: { maxWidth: 220 }, children: _jsx(Typography, { noWrap: true, sx: { fontSize: 12 }, title: w.projects ?? undefined, children: w.projects ?? '—' }) }), _jsx(TableCell, { align: "right", children: w.workDays }), _jsx(TableCell, { align: "right", sx: { color: w.housingDays ? accents.amber : undefined, fontWeight: w.housingDays ? 700 : 400 }, children: w.housingDays }), _jsx(TableCell, { align: "right", children: f.n(w.revenue) }), _jsx(TableCell, { align: "right", children: w.costMissing ? (_jsx(Tooltip, { title: t('ceo.work.missingTip'), children: _jsx(Box, { component: "span", sx: { color: tokens.info, fontWeight: 700 }, children: t('ceo.sources.noCost') }) })) : (_jsxs(_Fragment, { children: [_jsx(WorkerCost, { w: w }), w.idleCost > 0 && _jsx(Typography, { sx: { fontSize: 10.5, color: negative }, children: t('ceo.work.idleOf', { amount: f.n(w.idleCost) }) })] })) }), _jsx(TableCell, { align: "right", sx: { fontWeight: 800, color: w.costMissing ? tokens.gray500 : profitColor(w.profit) }, children: w.costMissing ? '—' : _jsx("bdi", { children: f.n(w.profit) }) }), _jsx(TableCell, { align: "right", sx: { color: w.lostRevenue ? accents.amber : tokens.gray500, fontWeight: w.lostRevenue ? 700 : 400 }, children: w.lostRevenue ? f.n(w.lostRevenue) : w.housingDays && w.parts.dailyPrice === null ? _jsx(Tooltip, { title: t('ceo.work.noPrice'), children: _jsx("span", { children: "\u2014" }) }) : '0' })] }, w.workerId))) })] }) })), rows && rows.length > 500 && _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500, mt: 1 }, children: t('ceo.work.more', { count: rows.length }) })] }));
}
