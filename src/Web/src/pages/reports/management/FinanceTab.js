import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DonutLargeOutlinedIcon from '@mui/icons-material/DonutLargeOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PieChartOutlineOutlinedIcon from '@mui/icons-material/PieChartOutlineOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Alert, Box, Button, Collapse, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { managementApi } from '../../../api/management';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { useFreshKey, useLive } from '../../../components/live';
import { DataTable, Donut, finCard, md, Pill, useNumbers } from './mdKit';
/** «المالية»: the old finance tab — its banner, five cards, the monthly billing against collection, statuses, debt ages, debtors, managers, coverage, invoices. */
export function FinanceTab({ from, to, overview }) {
    const { t, i18n } = useTranslation();
    const f = useNumbers();
    const [project, setProject] = useState('');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [projects, setProjects] = useState([]);
    const [showInvoices, setShowInvoices] = useState(false);
    const tick = useLive();
    const fresh = useFreshKey(`${from}|${to}|${project}`);
    useEffect(() => {
        let live = true;
        if (fresh())
            setData(null);
        setError(null);
        managementApi
            .finance(from, to, project || null)
            .then((d) => {
            if (!live)
                return;
            setData(d);
            // The projects to narrow to: those of the period's invoices and of the debts (kept while one is chosen).
            if (!project) {
                const all = new Map();
                for (const i of d.invoices)
                    if (i.projectCrmId)
                        all.set(i.projectCrmId, i.projectName);
                for (const x of d.debtors)
                    if (x.projectCrmId)
                        all.set(x.projectCrmId, x.name);
                setProjects([...all].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ar')));
            }
        })
            .catch((e) => live && setError(errorKey(e)));
        return () => {
            live = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [from, to, project, tick]);
    if (error)
        return _jsx(ErrorMessage, { messageKey: error });
    const cov = overview?.coverage;
    const covered = cov ? cov.full : 0;
    const covTotal = cov ? cov.full + cov.partial + cov.missing : 0;
    return (_jsxs(Stack, { sx: { gap: 2 }, children: [_jsxs(Box, { sx: {
                    borderRadius: '18px',
                    p: '14px 18px',
                    color: '#fff',
                    background: 'linear-gradient(135deg, #0A3C58 0%, #0E5F73 55%, #0E7C86 100%)',
                    boxShadow: '0 10px 26px rgba(14,124,134,.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                }, children: [_jsx(Box, { "aria-hidden": true, sx: { width: 42, height: 42, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.16)', '& svg': { fontSize: 22 } }, children: _jsx(PieChartOutlineOutlinedIcon, {}) }), _jsxs(Box, { sx: { minWidth: 0, flex: '1 1 260px' }, children: [_jsx(Typography, { component: "h2", sx: { fontSize: 16, fontWeight: 700 }, children: t('mgmt.fin.title') }), _jsx(Typography, { sx: { fontSize: 12, opacity: 0.82 }, children: t('mgmt.fin.subtitle') })] }), _jsxs(TextField, { select: true, size: "small", value: project, onChange: (e) => setProject(e.target.value), slotProps: { select: { displayEmpty: true } }, sx: { minWidth: 260, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,.14)', color: '#fff', borderRadius: '10px', '& fieldset': { borderColor: 'rgba(255,255,255,.35)' } }, '& svg': { color: '#fff' } }, children: [_jsx(MenuItem, { value: "", children: t('mgmt.fin.allProjects') }), projects.map((p) => (_jsx(MenuItem, { value: p.id, children: _jsx("bdi", { children: p.name }) }, p.id)))] }), _jsx(Button, { component: RouterLink, to: "/billing/invoices", startIcon: _jsx(ReceiptLongOutlinedIcon, {}), sx: { bgcolor: md.glass, color: md.title, fontWeight: 700, borderRadius: '10px', px: 1.75, '&:hover': { bgcolor: md.glassHi } }, children: t('mgmt.fin.monthly') })] }), !data ? (_jsx(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(5, minmax(0, 1fr))' } }, children: Array.from({ length: 5 }, (_, i) => (_jsx(Skeleton, { variant: "rounded", height: 140, sx: { borderRadius: '18px' } }, i))) })) : (_jsxs(_Fragment, { children: [_jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' } }, children: [_jsxs(FinKpi, { color: md.teal, icon: _jsx(DescriptionOutlinedIcon, {}), label: t('mgmt.fin.invoiced'), value: f.m(data.invoiced.value ?? 0), children: [_jsx(Typography, { sx: { fontSize: 11.5, color: md.muted }, children: t('mgmt.fin.invoicedSub', { count: f.n(data.invoiceCount.value ?? 0), workers: f.n(data.workers.value ?? 0) }) }), _jsx(Typography, { sx: { fontSize: 11.5, color: md.muted }, children: t('mgmt.fin.vatSub', { before: f.m(data.beforeVat.value ?? 0), vat: f.m(data.vat.value ?? 0) }) })] }), _jsxs(FinKpi, { color: md.greenDeep, icon: _jsx(PaymentsOutlinedIcon, {}), label: t('mgmt.fin.collected'), value: f.m(data.collected.value ?? 0), children: [_jsx(Progress, { value: data.collectionRate.value, color: md.greenDeep }), _jsxs(Typography, { sx: { fontSize: 11.5, color: md.muted }, children: [t('mgmt.fin.rate'), " ", _jsx("b", { children: data.collectionRate.value === null ? '—' : `${f.p(data.collectionRate.value)}%` })] })] }), _jsx(FinKpi, { color: md.amberDeep, icon: _jsx(AccountBalanceWalletOutlinedIcon, {}), label: t('mgmt.fin.remaining'), value: f.m(data.remaining.value ?? 0), children: _jsx(Typography, { sx: { fontSize: 11.5, color: md.muted }, children: t('mgmt.fin.ofPeriod') }) }), _jsx(FinKpi, { color: md.red, icon: _jsx(WarningAmberOutlinedIcon, {}), label: t('mgmt.fin.overdue'), value: f.n(data.overdue60), valueColor: md.red, children: _jsx(Typography, { sx: { fontSize: 11.5, color: md.muted }, children: t('mgmt.fin.overdueSub', { count: f.n(data.overdue60Invoices), share: data.overdue60Share === null ? '—' : f.n(Math.round(data.overdue60Share)) }) }) }), _jsxs(FinKpi, { color: md.coverage, icon: _jsx(FactCheckOutlinedIcon, {}), label: cov?.month ? t('mgmt.fin.coverageOf', { month: monthName(cov.month, i18n.language) }) : t('mgmt.fin.coverage'), value: cov?.month ? `${f.n(covered)}` : '—', unit: cov?.month ? t('mgmt.fin.ofProjects', { total: f.n(covTotal) }) : undefined, children: [_jsx(Progress, { value: covTotal ? (covered / covTotal) * 100 : null, color: md.coverage }), cov?.month && (_jsxs(Typography, { sx: { fontSize: 11.5, color: md.red }, children: [_jsx("b", { children: f.n(cov.workersNotInvoiced) }), " ", t('mgmt.fin.notInvoiced')] }))] })] }), _jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.7fr) minmax(0, 1fr)' } }, children: [_jsxs(Box, { sx: finCard, children: [_jsx(CardHead, { icon: _jsx(BarChartOutlinedIcon, {}), title: t('mgmt.fin.trend') }), _jsx(MoneyChart, { months: data.money })] }), _jsxs(Box, { sx: finCard, children: [_jsx(CardHead, { icon: _jsx(DonutLargeOutlinedIcon, {}), title: t('mgmt.fin.statuses') }), _jsx(Donut, { items: data.statuses.map((s) => ({ key: String(s.code), label: i18n.language === 'ar' ? s.nameAr : s.nameEn, value: s.count })), size: 140 })] })] }), _jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }, children: [_jsxs(Box, { sx: finCard, children: [_jsx(CardHead, { icon: _jsx(HourglassBottomOutlinedIcon, {}), title: t('mgmt.fin.aging'), hint: t('mgmt.fin.agingHint') }), _jsx(Aging, { data: data })] }), _jsxs(Box, { sx: finCard, children: [_jsx(CardHead, { icon: _jsx(ApartmentOutlinedIcon, {}), title: t('mgmt.fin.debtors'), hint: t('mgmt.fin.debtorsHint') }), _jsx(Stack, { sx: { gap: 1, maxHeight: 420, overflowY: 'auto', scrollbarWidth: 'thin', pe: 0.5 }, children: data.debtors.slice(0, 12).map((d, index) => {
                                            const top = data.debtors[0]?.outstanding || 1;
                                            return (_jsxs(Stack, { direction: "row", sx: { gap: 1.25, alignItems: 'center', p: 1, borderRadius: '12px', '&:hover': { bgcolor: md.glassHi } }, children: [_jsx(Box, { sx: { width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: md.red, bgcolor: md.glassHi, flex: '0 0 auto' }, children: index + 1 }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: md.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: _jsx("bdi", { children: d.name }) }), _jsxs(Typography, { sx: { fontSize: 11, color: md.muted }, children: [_jsx("bdi", { children: d.manager ?? '—' }), " \u00B7 ", t('mgmt.fin.openSince', { count: d.openInvoices, days: d.oldestDays })] }), _jsx(Box, { sx: { mt: 0.5, height: 4, borderRadius: 999, bgcolor: md.track }, children: _jsx(Box, { sx: { height: '100%', width: `${(d.outstanding / top) * 100}%`, borderRadius: 999, background: 'linear-gradient(90deg, #E8890C, #E03434)' } }) })] }), _jsxs(Box, { sx: { textAlign: 'end', flex: '0 0 auto' }, children: [_jsx(Typography, { sx: { fontSize: 14, fontWeight: 700, color: md.red, fontVariantNumeric: 'tabular-nums' }, children: f.n(d.outstanding) }), _jsx(Typography, { sx: { fontSize: 11, color: md.muted }, children: t('mgmt.fin.collectedPct', { rate: f.n(Math.round(d.rate)) }) })] })] }, d.projectCrmId ?? d.name));
                                        }) })] })] }), _jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }, children: [_jsxs(Box, { sx: { ...finCard, order: { md: 2 } }, children: [_jsx(CardHead, { icon: _jsx(FactCheckOutlinedIcon, {}), title: cov?.month ? t('mgmt.fin.coverageOf', { month: monthName(cov.month, i18n.language) }) : t('mgmt.fin.coverage') }), !cov?.month ? (_jsx(Alert, { severity: "info", children: t('mgmt.fin.noCoverage') })) : (_jsxs(_Fragment, { children: [_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, mb: 1.5 }, children: [_jsx(CovStat, { color: md.greenDeep, value: cov.full, label: t('mgmt.fin.covFull') }), _jsx(CovStat, { color: md.amberDeep, value: cov.partial, label: t('mgmt.fin.covPartial') }), _jsx(CovStat, { color: md.red, value: cov.missing, label: t('mgmt.fin.covMissing') })] }), _jsx(Stack, { sx: { gap: 0.5, maxHeight: 300, overflowY: 'auto', scrollbarWidth: 'thin' }, children: cov.gaps.map((g) => (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, py: 0.75, borderBottom: `1px solid ${md.border}` }, children: [_jsx(Box, { sx: { width: 8, height: 8, borderRadius: '50%', bgcolor: g.hasInvoice ? md.amberDeep : md.red, flex: '0 0 auto' } }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: md.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: _jsx("bdi", { children: g.name }) }), _jsx(Typography, { sx: { fontSize: 11, color: md.muted }, children: _jsx("bdi", { children: g.manager ?? '—' }) })] }), _jsxs(Box, { sx: { textAlign: 'end' }, children: [_jsx(Typography, { sx: { fontSize: 14, fontWeight: 700, color: md.red }, children: f.n(g.worked - g.invoiced) }), _jsx(Typography, { sx: { fontSize: 10.5, color: md.muted }, children: g.hasInvoice ? t('mgmt.fin.notInvoicedOf', { worked: g.worked }) : t('mgmt.fin.noInvoice') })] })] }, g.projectCrmId))) })] }))] }), _jsxs(Box, { sx: finCard, children: [_jsx(CardHead, { icon: _jsx(PersonOutlineIcon, {}), title: t('mgmt.fin.byManager'), hint: t('mgmt.fin.byManagerHint') }), _jsx(Stack, { sx: { gap: 1, maxHeight: 420, overflowY: 'auto', scrollbarWidth: 'thin', pe: 0.5 }, children: data.managers.map((m) => (_jsxs(Stack, { direction: "row", sx: { gap: 1.25, alignItems: 'center', p: 1.25, borderRadius: '12px', bgcolor: md.glassHi, border: `1px solid ${md.border}` }, children: [_jsx(Box, { sx: { width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, color: '#fff', bgcolor: md.navy, flex: '0 0 auto' }, children: _jsx("bdi", { children: Array.from(m.manager.trim())[0]?.toUpperCase() ?? '—' }) }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: md.ink }, children: _jsx("bdi", { children: m.manager }) }), _jsx(Typography, { sx: { fontSize: 11, color: md.muted }, children: t('mgmt.fin.managerSub', { projects: m.projects, invoices: m.invoices, invoiced: f.n(m.invoiced) }) }), _jsx(Box, { sx: { mt: 0.5, height: 4, borderRadius: 999, bgcolor: md.track }, children: _jsx(Box, { sx: { height: '100%', width: `${Math.min(100, m.rate)}%`, borderRadius: 999, bgcolor: md.greenDeep } }) })] }), _jsxs(Box, { sx: { textAlign: 'end', flex: '0 0 auto' }, children: [_jsx(Pill, { color: "#fff", bg: m.rate >= 50 ? md.greenDeep : md.red, children: `${f.n(Math.round(m.rate))}%` }), _jsx(Typography, { sx: { fontSize: 11, color: md.muted, mt: 0.5 }, children: t('mgmt.fin.remainingShort', { amount: f.n(m.outstanding) }) })] })] }, m.manager))) })] })] }), _jsxs(Box, { sx: finCard, children: [_jsx(Button, { fullWidth: true, onClick: () => setShowInvoices((s) => !s), endIcon: _jsx(ExpandMoreIcon, { sx: { transform: showInvoices ? 'rotate(180deg)' : 'none', transition: 'transform .2s' } }), sx: { justifyContent: 'space-between', color: md.title, fontWeight: 700, fontSize: 14 }, children: _jsxs("span", { children: [t('mgmt.fin.invoices'), ' ', _jsx(Box, { component: "small", sx: { color: md.muted, fontWeight: 400 }, children: t('mgmt.fin.latest', { count: Math.min(250, data.invoicesTotal) }) })] }) }), _jsx(Collapse, { in: showInvoices, unmountOnExit: true, children: _jsx(InvoicesTable, { rows: data.invoices, excel: managementApi.invoicesExcel(from, to, project || null) }) })] })] }))] }));
}
const monthName = (key, lang) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));
function CardHead({ icon, title, hint }) {
    return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }, children: [_jsx(Box, { sx: { color: md.teal, display: 'flex', '& svg': { fontSize: 19 } }, children: icon }), _jsx(Typography, { component: "h3", sx: { fontSize: 14.5, fontWeight: 700, color: md.title }, children: title }), hint && _jsx(Typography, { sx: { fontSize: 11.5, color: md.muted, marginInlineStart: 'auto' }, children: hint })] }));
}
/** A finance card: its colour's 4px line on top, a tinted icon square, the amount with «ريال». */
function FinKpi({ color, icon, label, value, unit, valueColor, children }) {
    const { t } = useTranslation();
    return (_jsxs(Box, { sx: { bgcolor: md.glass, border: `1px solid ${md.border}`, borderTop: `4px solid ${color}`, borderRadius: '18px', boxShadow: '0 4px 14px rgba(10,60,88,.07)', p: '16px 18px', minWidth: 0 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 1 }, children: [_jsx(Box, { "aria-hidden": true, sx: { width: 34, height: 34, borderRadius: '12px', display: 'grid', placeItems: 'center', color, bgcolor: `${color}1A`, '& svg': { fontSize: 18 } }, children: icon }), _jsx(Typography, { sx: { fontSize: 12.5, color: md.label, fontWeight: 600 }, children: label })] }), _jsxs(Typography, { component: "div", sx: { fontSize: 24, fontWeight: 700, color: valueColor ?? md.glow, textShadow: valueColor ? undefined : md.glowShadow, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }, children: [_jsx("bdi", { children: value }), _jsx(Box, { component: "small", sx: { fontSize: 13, fontWeight: 600, color: md.muted, marginInlineStart: 0.75 }, children: unit ?? t('mgmt.unit.sar') })] }), _jsx(Stack, { sx: { gap: 0.5, mt: 0.75 }, children: children })] }));
}
function Progress({ value, color }) {
    return (_jsx(Box, { sx: { height: 6, borderRadius: 999, bgcolor: md.track, overflow: 'hidden' }, children: _jsx(Box, { sx: { height: '100%', width: `${Math.max(0, Math.min(100, value ?? 0))}%`, borderRadius: 999, bgcolor: color } }) }));
}
function CovStat({ color, value, label }) {
    return (_jsxs(Box, { sx: { borderRadius: '12px', bgcolor: `${color}12`, p: 1, textAlign: 'center' }, children: [_jsx(Typography, { sx: { fontSize: 20, fontWeight: 700, color }, children: value }), _jsx(Typography, { sx: { fontSize: 11.5, color: md.text }, children: label })] }));
}
const agingLook = [
    { color: '#1D8D48', key: 'fresh' },
    { color: '#7CB342', key: 'follow' },
    { color: '#E39A0B', key: 'late' },
    { color: '#E8650C', key: 'veryLate' },
    { color: '#E03434', key: 'danger' },
];
/** The debts by age: a stacked line, then a row per bucket (count, amount, share). */
function Aging({ data }) {
    const { t } = useTranslation();
    const f = useNumbers();
    const total = data.aging.reduce((s, a) => s + a.amount, 0);
    return (_jsxs(_Fragment, { children: [_jsx(Stack, { direction: "row", sx: { height: 10, borderRadius: 999, overflow: 'hidden', bgcolor: md.track, mb: 1.5 }, children: data.aging.map((a) => (_jsx(Box, { sx: { width: total ? `${(a.amount / total) * 100}%` : 0, bgcolor: agingLook[a.bucket - 1]?.color } }, a.bucket))) }), _jsx(Stack, { sx: { gap: 0.75 }, children: data.aging.map((a) => {
                    const look = agingLook[a.bucket - 1];
                    return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, p: 1, borderRadius: '10px', bgcolor: md.glassHi, borderInlineStart: `3px solid ${look.color}` }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: md.ink, minWidth: 92 }, children: t(`mgmt.fin.bucket.${a.bucket}`) }), _jsx(Pill, { color: look.color, bg: `${look.color}1A`, children: t(`mgmt.fin.age.${look.key}`) }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Typography, { sx: { fontSize: 11.5, color: md.muted }, children: t('mgmt.fin.invoicesCount', { count: a.count }) }), _jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 700, color: md.ink, minWidth: 90, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }, children: f.n(a.amount) }), _jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: look.color, minWidth: 48, textAlign: 'end' }, children: `${f.p(a.percent)}%` })] }, a.bucket));
                }) })] }));
}
/** Billing against collection by month: two columns a month and the collection rate as a line (its own % axis). */
function MoneyChart({ months }) {
    const { t, i18n } = useTranslation();
    const f = useNumbers();
    const w = 640;
    const h = 260;
    const pad = { top: 16, bottom: 30, side: 44 };
    const top = Math.max(1, ...months.flatMap((m) => [m.invoiced, m.collected]));
    const step = 10 ** Math.floor(Math.log10(top));
    const max = Math.ceil(top / step) * step;
    const inner = w - pad.side * 2;
    const slot = inner / Math.max(1, months.length);
    const y = (v) => pad.top + (h - pad.top - pad.bottom) * (1 - v / max);
    const yr = (v) => pad.top + (h - pad.top - pad.bottom) * (1 - Math.min(100, v) / 100);
    const label = (key) => new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));
    // Months read left to right in both languages, as on the old chart.
    const x = (i) => pad.side + slot * i + slot / 2;
    const line = months.map((m, i) => (m.rate === null ? null : `${x(i)},${yr(m.rate)}`)).filter(Boolean).join(' ');
    return (_jsxs(Box, { children: [_jsxs(Stack, { direction: "row", sx: { gap: 2, mb: 1, fontSize: 11.5, color: md.muted }, children: [_jsx(Legend, { color: md.teal, text: t('mgmt.fin.legendInvoiced') }), _jsx(Legend, { color: md.green, text: t('mgmt.fin.legendCollected') }), _jsx(Legend, { color: "#E8890C", text: t('mgmt.fin.legendRate'), line: true })] }), _jsx(Box, { dir: "ltr", children: _jsxs("svg", { viewBox: `0 0 ${w} ${h}`, width: "100%", role: "img", "aria-label": t('mgmt.fin.trend'), children: [[0, 0.25, 0.5, 0.75, 1].map((p) => (_jsxs("g", { children: [_jsx("line", { x1: pad.side, x2: w - pad.side, y1: y(max * p), y2: y(max * p), stroke: md.border }), _jsxs("text", { x: pad.side - 6, y: y(max * p) + 4, textAnchor: "end", fontSize: "10", fill: md.muted, children: [f.n(Math.round((max * p) / 1e5) / 10), "M"] }), _jsxs("text", { x: w - pad.side + 6, y: yr(100 * p) + 4, fontSize: "10", fill: md.muted, children: [100 * p, "%"] })] }, p))), months.map((m, i) => {
                            const bw = Math.min(28, slot / 3);
                            return (_jsxs("g", { children: [_jsx("rect", { x: x(i) - bw - 3, y: y(m.invoiced), width: bw, height: Math.max(0, y(0) - y(m.invoiced)), rx: "3", fill: md.teal, children: _jsx("title", { children: `${label(m.month)} · ${f.n(m.invoiced)}` }) }), _jsx("rect", { x: x(i) + 3, y: y(m.collected), width: bw, height: Math.max(0, y(0) - y(m.collected)), rx: "3", fill: md.green, children: _jsx("title", { children: `${label(m.month)} · ${f.n(m.collected)}` }) }), _jsx("text", { x: x(i), y: h - 10, textAnchor: "middle", fontSize: "10.5", fill: md.text, children: label(m.month) })] }, m.month));
                        }), line && _jsx("polyline", { points: line, fill: "none", stroke: "#E8890C", strokeWidth: "2" }), months.map((m, i) => (m.rate === null ? null : _jsx("circle", { cx: x(i), cy: yr(m.rate), r: "3.5", fill: "#E8890C" }, m.month)))] }) })] }));
}
function Legend({ color, text, line }) {
    return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75 }, children: [_jsx(Box, { sx: { width: line ? 16 : 10, height: line ? 3 : 10, borderRadius: line ? 2 : '3px', bgcolor: color } }), text] }));
}
function InvoicesTable({ rows, excel }) {
    const { t, i18n } = useTranslation();
    const f = useNumbers();
    const columns = useMemo(() => [
        { key: 'no', label: t('mgmt.col.invoice'), render: (r) => _jsx("bdi", { children: r.no || '—' }), text: (r) => r.no },
        { key: 'project', label: t('mgmt.col.project'), render: (r) => _jsx("bdi", { children: r.projectName }), text: (r) => r.projectName },
        { key: 'manager', label: t('mgmt.col.manager'), render: (r) => _jsx("bdi", { children: r.manager ?? '—' }), text: (r) => r.manager ?? '' },
        { key: 'workers', label: t('mgmt.col.workers'), render: (r) => f.n(r.workers), align: 'center' },
        { key: 'total', label: t('mgmt.col.total'), render: (r) => f.m(r.total), align: 'end' },
        { key: 'collected', label: t('mgmt.col.collected'), render: (r) => f.m(r.collected), align: 'end' },
        { key: 'remaining', label: t('mgmt.col.remaining'), render: (r) => _jsx(Box, { component: "b", sx: { color: r.remaining > 0.01 ? md.red : md.greenDeep }, children: f.m(r.remaining) }), align: 'end' },
        { key: 'status', label: t('mgmt.col.status'), render: (r) => (i18n.language === 'ar' ? r.statusAr : r.statusEn), text: (r) => r.statusAr + r.statusEn },
        { key: 'to', label: t('mgmt.col.periodEnd'), render: (r) => _jsx("bdi", { children: r.to.slice(0, 10) }) },
        { key: 'age', label: t('mgmt.col.age'), render: (r) => f.n(r.ageDays), align: 'center' },
    ], [t, i18n.language, f]);
    return _jsx(DataTable, { title: t('mgmt.fin.invoices'), rows: rows, columns: columns, excel: excel, empty: t('mgmt.empty') });
}
