import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, InputAdornment, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography, } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { receivablesApi } from '../../api/billing';
import { ErrorMessage } from '../../auth/AuthLayout';
import { DateField } from '../../components/DateField';
import { card, KpiCard, navyHead, num, wf } from '../../components/designKit';
import { PageHeader } from '../../components/ui';
import { isoToday } from '../operations/delivery';
// From not due yet to the oldest debt: one scale that darkens with the delay (colour is never the only sign: every
// cell also has its column's name and the amount). `heat` tints a table cell.
const buckets = [
    { key: 'current', tone: '#6B8BAE', heat: 'transparent' },
    { key: 'days30', tone: '#D9A520', heat: '#FDF4DC' },
    { key: 'days60', tone: '#D9782F', heat: '#FBE6D2' },
    { key: 'days90', tone: '#C24A33', heat: '#F8D8D0' },
    { key: 'days180', tone: '#8F1D14', heat: '#F2C2BC' },
    { key: 'over180', tone: '#4D0D08', heat: '#EAA59D' },
];
// Money with two decimals, so the columns line up.
const sar = (value) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (part, whole) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—');
/**
 * The debts' ages: what each project owes by days past due, its credit and its net, by project or by project manager.
 * Laid out as the proposal of 2026-10-24 (three figures, the distribution, a table whose cells darken with the delay),
 * in the system's shared look (components/designKit). Everything comes from one request; the grouping and search are
 * done here.
 */
export function AgingPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [asOf, setAsOf] = useState(isoToday());
    const [group, setGroup] = useState('project');
    const [search, setSearch] = useState('');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        setData(null);
        setError(null);
        receivablesApi
            .aging(asOf)
            .then(setData)
            .catch((failure) => setError(errorKey(failure)));
    }, [asOf, attempt]);
    const rows = useMemo(() => {
        const term = search.trim().toLowerCase();
        const list = (data?.rows ?? []).filter((r) => !term || [r.projectName, r.customerName, r.manager].some((v) => v?.toLowerCase().includes(term)));
        if (group === 'project')
            return list;
        const byManager = new Map();
        for (const r of list) {
            const name = r.manager ?? t('aging.noManager');
            const sum = byManager.get(name);
            byManager.set(name, sum
                ? {
                    ...sum,
                    current: sum.current + r.current,
                    days30: sum.days30 + r.days30,
                    days60: sum.days60 + r.days60,
                    days90: sum.days90 + r.days90,
                    days180: sum.days180 + r.days180,
                    over180: sum.over180 + r.over180,
                    total: sum.total + r.total,
                    credit: sum.credit + r.credit,
                    net: sum.net + r.net,
                    items: sum.items + 1,
                }
                : { ...r, projectName: name, customerName: null, items: 1 });
        }
        return [...byManager.values()].sort((a, b) => b.net - a.net);
    }, [data, search, group, t]);
    // The figures and the distribution are the server's totals (all projects), whatever the search shows.
    const totals = data?.totals;
    const overdue = totals ? totals.days30 + totals.days60 + totals.days90 + totals.days180 + totals.over180 : 0;
    const over60 = totals ? totals.days90 + totals.days180 + totals.over180 : 0;
    const hasCredit = (data?.rows ?? []).some((r) => r.credit > 0);
    const sum = (pick) => rows.reduce((s, r) => s + pick(r), 0);
    const filtered = search.trim() !== '';
    const columns = 2 + buckets.length + (hasCredit ? 2 : 0);
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('aging.title'), subtitle: t('aging.intro'), actions: _jsx(DateField, { size: "small", label: t('aging.asOf'), value: asOf, onChange: (e) => e.target.value && setAsOf(e.target.value), slotProps: { inputLabel: { shrink: true } } }) }), error && (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.5, mb: 2 }, children: [_jsx(Box, { sx: { flex: 1 }, children: _jsx(ErrorMessage, { messageKey: error }) }), _jsx(Button, { variant: "outlined", onClick: () => setAttempt((n) => n + 1), children: t('workforce.ui.retry') })] })), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2, mb: 2 }, children: [_jsx(KpiCard, { label: t('aging.totalOwed'), loading: !data && !error, value: totals ? sar(totals.net) : null, unit: t('aging.sar'), sub: totals && (totals.credit > 0 ? t('aging.kpi.netAfterCredit', { credit: sar(totals.credit) }) : t('aging.kpi.noCredit')) }), _jsx(KpiCard, { label: t('aging.kpi.overdue'), loading: !data && !error, value: totals ? sar(overdue) : null, unit: t('aging.sar'), sub: totals && t('aging.kpi.ofOwed', { pct: pct(overdue, totals.total) }) }), _jsx(KpiCard, { label: t('aging.kpi.over60'), loading: !data && !error, value: totals ? sar(over60) : null, unit: t('aging.sar'), tone: over60 > 0 ? 'danger' : undefined, sub: totals && t('aging.kpi.over60Sub', { pct: pct(over60, totals.total) }) })] }), _jsxs(Box, { sx: { ...card, p: 2.5, mb: 2 }, children: [_jsx(Typography, { component: "h2", sx: { m: 0, fontSize: 15, fontWeight: 700, color: wf.navy, mb: 1.5 }, children: t('aging.distribution') }), totals ? (_jsxs(_Fragment, { children: [_jsx(Box, { role: "img", "aria-label": buckets.map((b) => `${t(`aging.buckets.${b.key}`)} ${pct(totals[b.key], totals.total)}`).join('، '), sx: { display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden', gap: '2px', bgcolor: wf.subtle }, children: totals.total > 0 && buckets.map((b) => (totals[b.key] > 0 ? _jsx(Box, { sx: { width: `${(totals[b.key] / totals.total) * 100}%`, bgcolor: b.tone } }, b.key) : null)) }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1.5, mt: 1.75 }, children: buckets.map((b) => (_jsxs(Box, { children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75, fontSize: 13, fontWeight: 600, color: wf.textSecondary }, children: [_jsx(Box, { component: "span", "aria-hidden": true, sx: { width: 10, height: 10, borderRadius: '3px', bgcolor: b.tone } }), t(`aging.buckets.${b.key}`)] }), _jsx(Typography, { sx: { ...num, fontSize: 16, fontWeight: 700, color: wf.navy }, children: totals[b.key] > 0 ? sar(totals[b.key]) : '—' }), _jsx(Typography, { sx: { ...num, fontSize: 12.5, color: wf.textSecondary }, children: totals[b.key] > 0 ? pct(totals[b.key], totals.total) : t('aging.none') })] }, b.key))) })] })) : (!error && _jsx(Skeleton, { variant: "rounded", height: 70 }))] }), _jsxs(Box, { sx: { ...card, overflow: 'hidden' }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, justifyContent: 'space-between', p: 2 }, children: [_jsxs(ToggleButtonGroup, { size: "small", exclusive: true, sx: { whiteSpace: 'nowrap' }, value: group, onChange: (_, v) => v && setGroup(v), children: [_jsx(ToggleButton, { value: "project", children: t('aging.byProject') }), _jsx(ToggleButton, { value: "manager", children: t('aging.byManager') })] }), _jsx(TextField, { size: "small", sx: { minWidth: { md: 320 } }, placeholder: t('aging.search'), value: search, onChange: (e) => setSearch(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) }, htmlInput: { 'aria-label': t('aging.search') } } })] }), _jsx(TableContainer, { sx: { maxHeight: 'calc(100dvh - 220px)' }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: { ...navyHead, '& th, & td': { px: 1.25 }, '& td': { whiteSpace: 'nowrap' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: group === 'project' ? t('commercial.col.project') : t('commercial.col.manager') }), buckets.map((b) => (_jsx(TableCell, { align: "right", children: t(`aging.buckets.${b.key}`) }, b.key))), hasCredit && _jsx(TableCell, { align: "right", children: t('aging.total') }), hasCredit && _jsx(TableCell, { align: "right", children: t('aging.credit') }), _jsx(TableCell, { align: "right", children: t('aging.net') })] }) }), _jsxs(TableBody, { children: [!data &&
                                            !error &&
                                            Array.from({ length: 6 }, (_, i) => (_jsx(TableRow, { children: Array.from({ length: columns }, (_, j) => (_jsx(TableCell, { children: _jsx(Skeleton, { variant: "text", width: j === 0 ? 180 : 80 }) }, j))) }, i))), rows.map((r) => (_jsxs(TableRow, { sx: { cursor: group === 'project' ? 'pointer' : 'default' }, onClick: () => group === 'project' && navigate(`/billing/statements/${r.projectId ?? r.projectCrmId}`), children: [_jsxs(TableCell, { sx: { minWidth: 200, whiteSpace: 'normal !important' }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 600, color: wf.navy }, children: r.projectName }), _jsx(Typography, { sx: { fontSize: 12, color: wf.textSecondary }, children: group === 'project' ? [r.customerName, r.manager].filter(Boolean).join(' · ') || '—' : t('aging.projects', { count: r.items }) })] }), buckets.map((b) => (_jsx(TableCell, { align: "right", sx: { ...num, bgcolor: r[b.key] > 0 ? `${b.heat} !important` : undefined, color: r[b.key] > 0 ? wf.text : wf.border }, children: r[b.key] > 0 ? sar(r[b.key]) : '—' }, b.key))), hasCredit && _jsx(TableCell, { align: "right", sx: num, children: sar(r.total) }), hasCredit && _jsx(TableCell, { align: "right", sx: num, children: r.credit > 0 ? sar(r.credit) : '—' }), _jsx(TableCell, { align: "right", sx: { ...num, fontWeight: 700, color: wf.navy }, children: sar(r.net) })] }, group === 'project' ? r.projectCrmId : r.projectName))), data && rows.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: columns, align: "center", sx: { py: 5, color: wf.textSecondary }, children: filtered ? t('workforce.ui.noResults') : t('aging.empty') }) }))] }), rows.length > 0 && (_jsx(TableFooter, { sx: { position: 'sticky', bottom: 0 }, children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: filtered ? t('aging.totalShown', { count: rows.length }) : t('aging.totalAll') }), buckets.map((b) => (_jsx(TableCell, { align: "right", sx: num, children: sar(sum((r) => r[b.key])) }, b.key))), hasCredit && _jsx(TableCell, { align: "right", sx: num, children: sar(sum((r) => r.total)) }), hasCredit && _jsx(TableCell, { align: "right", sx: num, children: sar(sum((r) => r.credit)) }), _jsx(TableCell, { align: "right", sx: num, children: sar(sum((r) => r.net)) })] }) }))] }) })] })] }));
}
