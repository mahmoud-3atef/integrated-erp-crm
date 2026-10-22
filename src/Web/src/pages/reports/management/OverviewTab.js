import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DirectionsWalkOutlinedIcon from '@mui/icons-material/DirectionsWalkOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import VolunteerActivismOutlinedIcon from '@mui/icons-material/VolunteerActivismOutlined';
import { Alert, Box, ButtonBase, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../../api/auth';
import { managementApi } from '../../../api/management';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { BarList, DataTable, Donut, HeroTotal, KpiCard, md, Pill, Unknown, useNumbers, VisualCard } from './mdKit';
/** «نظرة عامة»: the six cards, then the project deliveries and the housing entries (docs/03-migration-plan/19). */
export function OverviewTab({ from, to, overview }) {
    const { t } = useTranslation();
    const f = useNumbers();
    const [inner, setInner] = useState('delivery');
    const rate = overview?.collectionRate.value ?? null;
    const k = overview;
    return (_jsxs(Stack, { sx: { gap: 2 }, children: [_jsx(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' } }, children: !k
                    ? Array.from({ length: 6 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: 118, sx: { mt: '14px', borderRadius: '12px' } }, i))
                    : (_jsxs(_Fragment, { children: [_jsx(KpiCard, { color: md.navyDeep, icon: _jsx(AccountTreeOutlinedIcon, {}), label: t('mgmt.kpi.projects'), value: f.n(k.activeProjects), unit: t('mgmt.unit.project'), foot: t('mgmt.kpi.projectsFoot') }), _jsx(KpiCard, { color: md.green, icon: _jsx(HowToRegOutlinedIcon, {}), label: t('mgmt.kpi.onJob'), value: f.n(k.onJob), unit: t('mgmt.unit.worker'), foot: t('mgmt.kpi.onJobFoot') }), _jsx(KpiCard, { color: md.amber, icon: _jsx(BedOutlinedIcon, {}), label: t('mgmt.kpi.housing'), value: f.n(k.inHousing), unit: t('mgmt.unit.worker'), foot: t('mgmt.kpi.housingFoot') }), _jsx(KpiCard, { color: md.blue, icon: _jsx(SwapHorizOutlinedIcon, {}), label: t('mgmt.kpi.net'), value: f.n(k.net.value ?? 0), foot: t('mgmt.kpi.netFoot', { starts: f.n(k.starts.value ?? 0), returns: f.n(k.returns.value ?? 0) }) }), _jsx(KpiCard, { color: md.teal, icon: _jsx(DescriptionOutlinedIcon, {}), label: t('mgmt.kpi.invoiced'), value: k.invoiced.value === null ? _jsx(Unknown, { hint: t('mgmt.noFinance') }) : f.m(k.invoiced.value), unit: k.invoiced.value === null ? undefined : t('mgmt.unit.sar'), foot: t('mgmt.kpi.invoicedFoot') }), _jsx(KpiCard, { color: md.red, icon: _jsx(VolunteerActivismOutlinedIcon, {}), label: t('mgmt.kpi.rate'), value: rate === null ? _jsx(Unknown, { hint: k.financeVisible ? t('mgmt.noRate') : t('mgmt.noFinance') }) : `${f.p(rate)}%`, foot: t('mgmt.kpi.rateFoot') })] })) }), _jsxs(Box, { sx: { bgcolor: '#fff', border: `1px solid ${md.border}`, borderRadius: '18px', boxShadow: '0 1px 2px rgba(10,60,88,.05), 0 10px 26px rgba(10,60,88,.07)', p: { xs: 1.5, md: '14px' }, minWidth: 0 }, children: [_jsx(Stack, { direction: "row", role: "tablist", sx: { gap: 3, borderBottom: `1px solid ${md.border}`, mb: 2, px: 1, overflowX: 'auto' }, children: ['delivery', 'housing', 'arrivals', 'tracking'].map((key) => (_jsx(ButtonBase, { role: "tab", "aria-selected": inner === key, onClick: () => setInner(key), sx: {
                                font: 'inherit',
                                fontSize: 14,
                                fontWeight: 700,
                                pt: 0.75,
                                pb: 1.5,
                                px: 0.25,
                                whiteSpace: 'nowrap',
                                color: inner === key ? md.navy : md.muted,
                                boxShadow: inner === key ? `inset 0 -3px 0 ${md.navy}` : 'none',
                            }, children: t(`mgmt.inner.${key}`) }, key))) }), inner === 'delivery' && _jsx(DeliveryPane, { from: from, to: to }), inner === 'housing' && _jsx(HousingPane, { from: from, to: to }), (inner === 'arrivals' || inner === 'tracking') && (_jsx(Alert, { severity: "info", sx: { borderRadius: '12px' }, children: t('mgmt.phase2') }))] })] }));
}
function useLoad(load, keys) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        let live = true;
        setData(null);
        setError(null);
        load()
            .then((d) => live && setData(d))
            .catch((e) => live && setError(errorKey(e)));
        return () => {
            live = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, keys);
    return { data, error };
}
const day = (v) => (v ? v.slice(0, 10) : '—');
function PaneSkeleton() {
    return (_jsx(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '210px minmax(0,1.25fr) minmax(0,1fr)' } }, children: [0, 1, 2].map((i) => (_jsx(Skeleton, { variant: "rounded", height: 240, sx: { borderRadius: '14px' } }, i))) }));
}
/** «تسليمات المشاريع»: the starts of the period by manager and by project; a manager or a project narrows the table. */
function DeliveryPane({ from, to }) {
    const { t } = useTranslation();
    const f = useNumbers();
    const { data, error } = useLoad(() => managementApi.delivery(from, to), [from, to]);
    const [filter, setFilter] = useState({});
    useEffect(() => setFilter({}), [from, to]);
    const rows = useMemo(() => (data?.rows ?? []).filter((r) => (!filter.manager || (r.manager ?? '—') === filter.manager) && (!filter.project || (r.project ?? '—') === filter.project)), [data, filter]);
    const columns = [
        { key: 'no', label: t('mgmt.col.no'), render: (r) => _jsx("bdi", { children: r.workerNo }), text: (r) => r.workerNo },
        { key: 'name', label: t('mgmt.col.worker'), render: (r) => _jsx(Typography, { component: "span", sx: { fontSize: 12.5, fontWeight: 700, color: md.ink }, children: _jsx("bdi", { children: r.name }) }), text: (r) => r.name },
        { key: 'project', label: t('mgmt.col.project'), render: (r) => _jsx("bdi", { children: r.project ?? '—' }), text: (r) => r.project ?? '' },
        { key: 'price', label: t('mgmt.col.price'), render: (r) => (r.price === null ? '—' : f.m(r.price)), align: 'end' },
        { key: 'manager', label: t('mgmt.col.manager'), render: (r) => _jsx("bdi", { children: r.manager ?? '—' }), text: (r) => r.manager ?? '' },
        { key: 'start', label: t('mgmt.col.startsOn'), render: (r) => _jsx("bdi", { children: day(r.startsOn) }) },
        { key: 'end', label: t('mgmt.col.endsOn'), render: (r) => _jsx("bdi", { children: day(r.endsOn) }) },
        {
            key: 'status',
            label: t('mgmt.col.status'),
            render: (r) => r.status === 'Working' ? _jsx(Pill, { color: md.greenDeep, bg: "#E7F6EC", children: t('mgmt.start.Working') }) : r.status === 'Ended' ? _jsx(Pill, { color: md.muted, bg: "#EEF2F5", children: t('mgmt.start.Ended') }) : _jsx(Pill, { color: md.amberDeep, bg: "#FDF3E1", children: t('mgmt.start.NotStarted') }),
        },
        { key: 'days', label: t('mgmt.col.workDays'), render: (r) => _jsx("b", { children: f.n(r.days) }), align: 'center' },
    ];
    if (error)
        return _jsx(ErrorMessage, { messageKey: error });
    if (!data)
        return _jsx(PaneSkeleton, {});
    return (_jsxs(Stack, { sx: { gap: 2 }, children: [_jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '210px minmax(0,1.25fr) minmax(0,1fr)' } }, children: [_jsx(HeroTotal, { icon: _jsx(DirectionsWalkOutlinedIcon, {}), label: t('mgmt.delivery.total'), value: f.n(data.total), unit: t('mgmt.unit.worker'), note: t('mgmt.inPeriod'), onClick: () => setFilter({}) }), _jsx(VisualCard, { title: t('mgmt.delivery.byManager'), children: _jsx(Donut, { items: data.byManager.map((r) => ({ key: r.key, label: r.name, value: r.count })), selected: filter.manager, onSelect: (key) => setFilter((x) => ({ manager: x.manager === key ? undefined : key })) }) }), _jsx(VisualCard, { title: t('mgmt.delivery.byProject'), children: _jsx(BarList, { items: data.byProject.map((r) => ({ key: r.key, label: r.name, value: r.count })), selected: filter.project, onSelect: (key) => setFilter((x) => ({ project: x.project === key ? undefined : key })) }) })] }), _jsx(DataTable, { title: t('mgmt.delivery.table'), badge: _jsxs(_Fragment, { children: [_jsx(CalendarMonthOutlinedIcon, {}), filter.manager ?? filter.project ?? t('mgmt.inPeriodShort')] }), rows: rows, columns: columns, excel: managementApi.deliveryExcel(from, to), empty: t('mgmt.empty') })] }));
}
const entryLook = {
    NewArrival: { color: '#1F78C8', bg: '#E8F1FB' },
    ReturnedWorker: { color: md.amberDeep, bg: '#FDF3E1' },
    BackFromVacation: { color: md.greenDeep, bg: '#E7F6EC' },
};
/** «حركة دخول السكن»: the approved housing orders of the period, by manager, project, way in and reason. */
function HousingPane({ from, to }) {
    const { t } = useTranslation();
    const f = useNumbers();
    const { data, error } = useLoad(() => managementApi.housingEntries(from, to), [from, to]);
    const [filter, setFilter] = useState({});
    useEffect(() => setFilter({}), [from, to]);
    const rows = useMemo(() => (data?.rows ?? []).filter((r) => (!filter.project || (r.project ?? '—') === filter.project) && (!filter.entry || r.entry === filter.entry) && (!filter.reason || (r.entry === 'ReturnedWorker' && r.reason === filter.reason))), [data, filter]);
    const reason = (key) => t(`operations.return.reasons.${key}`, { defaultValue: key });
    const columns = [
        { key: 'name', label: t('mgmt.col.worker'), render: (r) => _jsx(Typography, { component: "span", sx: { fontSize: 12.5, fontWeight: 700, color: md.ink }, children: _jsx("bdi", { children: r.name }) }), text: (r) => r.name },
        { key: 'no', label: t('mgmt.col.no'), render: (r) => _jsx("bdi", { children: r.workerNo }), text: (r) => r.workerNo },
        { key: 'project', label: t('mgmt.col.project'), render: (r) => _jsx("bdi", { children: r.project ?? '—' }), text: (r) => r.project ?? '' },
        { key: 'manager', label: t('mgmt.col.manager'), render: (r) => _jsx("bdi", { children: r.manager ?? '—' }), text: (r) => r.manager ?? '' },
        { key: 'on', label: t('mgmt.col.housingOn'), render: (r) => _jsx("bdi", { children: day(r.arrivedOn) }) },
        { key: 'entry', label: t('mgmt.col.entry'), render: (r) => _jsx(Pill, { ...(entryLook[r.entry] ?? entryLook.ReturnedWorker), children: t(`mgmt.entry.${r.entry}`) }) },
        { key: 'reason', label: t('mgmt.col.reason'), render: (r) => (r.entry === 'ReturnedWorker' ? reason(r.reason) : '—'), text: (r) => (r.entry === 'ReturnedWorker' ? reason(r.reason) : '') },
        { key: 'housing', label: t('mgmt.col.housing'), render: (r) => _jsx("bdi", { children: r.housing ?? '—' }), text: (r) => r.housing ?? '' },
        { key: 'days', label: t('mgmt.col.days'), render: (r) => _jsx("b", { children: f.n(r.days) }), align: 'center' },
    ];
    if (error)
        return _jsx(ErrorMessage, { messageKey: error });
    if (!data)
        return _jsx(PaneSkeleton, {});
    const returned = data.byEntry.find((e) => e.key === 'ReturnedWorker')?.count ?? 0;
    return (_jsxs(Stack, { sx: { gap: 2 }, children: [_jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '210px minmax(0,1.25fr) minmax(0,1fr)' } }, children: [_jsx(HeroTotal, { tone: "housing", icon: _jsx(HomeOutlinedIcon, {}), label: t('mgmt.housingIn.total'), value: f.n(data.total), unit: t('mgmt.unit.worker'), note: t('mgmt.housingIn.note'), onClick: () => setFilter({}) }), _jsx(VisualCard, { title: t('mgmt.housingIn.byManager'), children: _jsx(Donut, { items: data.byManager.map((r) => ({ key: r.key, label: r.name, value: r.count })) }) }), _jsx(VisualCard, { title: t('mgmt.housingIn.byProject'), children: _jsx(BarList, { fill: "linear-gradient(135deg, #F7C25A 0%, #E39A0B 100%)", items: data.byProject.map((r) => ({ key: r.key, label: r.name, value: r.count })), selected: filter.project, onSelect: (key) => setFilter((x) => ({ project: x.project === key ? undefined : key })) }) })] }), _jsx(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }, children: ['NewArrival', 'ReturnedWorker', 'BackFromVacation'].map((key) => {
                    const count = data.byEntry.find((e) => e.key === key)?.count ?? 0;
                    const look = entryLook[key];
                    return (_jsxs(ButtonBase, { onClick: () => setFilter((x) => ({ entry: x.entry === key ? undefined : key })), sx: { justifyContent: 'space-between', gap: 1, p: 1.5, borderRadius: '14px', border: `1px solid ${filter.entry === key ? look.color : md.border}`, bgcolor: '#fff', textAlign: 'start' }, children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: md.ink }, children: t(`mgmt.entry.${key}`) }), _jsx(Typography, { sx: { fontSize: 11.5, color: md.muted }, children: data.total ? `${f.n(Math.round((count / data.total) * 100))}%` : '—' })] }), _jsx(Typography, { sx: { fontSize: 24, fontWeight: 700, color: look.color }, children: f.n(count) })] }, key));
                }) }), _jsx(DataTable, { title: t('mgmt.housingIn.table'), badge: _jsxs(_Fragment, { children: [_jsx(CheckCircleOutlineIcon, {}), t('mgmt.approved')] }), rows: rows, columns: columns, excel: managementApi.housingEntriesExcel(from, to), empty: t('mgmt.empty'), filters: data.reasons.length > 0 && (_jsxs(Stack, { direction: "row", sx: { gap: 1, flexWrap: 'wrap', mb: 1.25 }, children: [_jsx(ReasonChip, { label: t('mgmt.allReasons'), count: returned, active: !filter.reason, onClick: () => setFilter({}) }), data.reasons.map((r) => (_jsx(ReasonChip, { label: reason(r.key), count: r.count, share: returned ? r.count / returned : 0, active: filter.reason === r.key, onClick: () => setFilter((x) => ({ reason: x.reason === r.key ? undefined : r.key })) }, r.key)))] })) })] }));
}
function ReasonChip({ label, count, share, active, onClick }) {
    return (_jsxs(ButtonBase, { onClick: onClick, sx: {
            position: 'relative',
            overflow: 'hidden',
            gap: 1,
            px: 1.5,
            py: 0.75,
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 700,
            color: active ? '#fff' : md.text,
            bgcolor: active ? md.navy : '#F3F7FA',
            border: `1px solid ${active ? md.navy : md.border}`,
        }, children: [_jsx("span", { children: label }), _jsx(Box, { component: "em", sx: { fontStyle: 'normal', fontSize: 11.5, px: 0.75, borderRadius: 999, bgcolor: active ? 'rgba(255,255,255,.2)' : '#fff' }, children: count }), share !== undefined && _jsx(Box, { "aria-hidden": true, sx: { position: 'absolute', insetInlineStart: 0, bottom: 0, height: 3, width: `${share * 100}%`, bgcolor: md.amber } })] }));
}
