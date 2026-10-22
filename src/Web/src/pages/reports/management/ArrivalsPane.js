import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import FlightLandOutlinedIcon from '@mui/icons-material/FlightLandOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import { Box, ButtonBase, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../../api/auth';
import { managementApi } from '../../../api/management';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { DataTable, Donut, HeroTotal, md, Pill, useNumbers, VisualCard } from './mdKit';
const statusLook = {
    working: { color: md.teal, bg: '#E3F4F5' },
    housing: { color: md.amberDeep, bg: '#FDF3E1' },
    vacation: { color: md.greenDeep, bg: '#E7F6EC' },
    other: { color: md.muted, bg: '#EEF2F5' },
};
/**
 * «العمالة دخول جديد» as the old dashboard had it: the workers who joined the company in the period, where they are
 * now, how much of their time has been work, how soon they first worked, by month and by supplier (a status or a
 * supplier narrows the table).
 */
export function ArrivalsPane({ from, to }) {
    const { t } = useTranslation();
    const f = useNumbers();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState({});
    useEffect(() => {
        let live = true;
        setData(null);
        setError(null);
        setFilter({});
        managementApi
            .newArrivals(from, to)
            .then((d) => live && setData(d))
            .catch((e) => live && setError(errorKey(e)));
        return () => {
            live = false;
        };
    }, [from, to]);
    const rows = useMemo(() => (data?.rows ?? []).filter((r) => (!filter.status || r.status === filter.status) && (!filter.supplier || (r.supplier ?? '—') === filter.supplier) && (!filter.undelivered || r.firstWorkOn === null)), [data, filter]);
    const columns = useMemo(() => [
        { key: 'arrived', label: t('mgmt.arrivals.col.arrived'), render: (r) => _jsx("bdi", { children: r.arrivedOn }) },
        { key: 'no', label: t('mgmt.col.no'), render: (r) => _jsx("bdi", { children: r.workerNo }), text: (r) => r.workerNo },
        { key: 'name', label: t('mgmt.col.worker'), render: (r) => _jsx(Typography, { component: "span", sx: { fontSize: 12.5, fontWeight: 700, color: md.ink }, children: _jsx("bdi", { children: r.name }) }), text: (r) => r.name },
        { key: 'supplier', label: t('mgmt.arrivals.col.supplier'), render: (r) => _jsx("bdi", { children: r.supplier ?? t('mgmt.arrivals.noSupplier') }), text: (r) => r.supplier ?? '' },
        { key: 'status', label: t('mgmt.col.status'), render: (r) => _jsx(Pill, { ...statusLook[r.status], children: t(`mgmt.arrivals.status.${r.status}`) }) },
        { key: 'project', label: t('mgmt.arrivals.col.project'), render: (r) => _jsx("bdi", { children: r.project ?? '—' }), text: (r) => r.project ?? '' },
        { key: 'since', label: t('mgmt.arrivals.col.since'), render: (r) => t('mgmt.arrivals.days', { count: r.daysSince }), align: 'center' },
        {
            key: 'share',
            label: t('mgmt.arrivals.col.share'),
            render: (r) => (_jsxs(Box, { title: t('mgmt.arrivals.shareHint', { work: r.workDays, housing: r.housingDays }), sx: { minWidth: 120 }, children: [_jsxs(Stack, { direction: "row", sx: { height: 6, borderRadius: 999, overflow: 'hidden', bgcolor: md.track }, children: [_jsx(Box, { sx: { width: `${r.workShare}%`, bgcolor: md.teal } }), _jsx(Box, { sx: { width: `${r.housingShare}%`, bgcolor: md.amber } })] }), _jsx(Typography, { sx: { fontSize: 10.5, color: md.muted }, children: t('mgmt.arrivals.shareText', { work: f.n(Math.round(r.workShare)), housing: f.n(Math.round(r.housingShare)) }) })] })),
        },
        {
            key: 'first',
            label: t('mgmt.arrivals.col.first'),
            render: (r) => r.firstWorkOn ? (_jsxs(_Fragment, { children: [_jsx("bdi", { children: r.firstWorkOn }), _jsx(Typography, { sx: { fontSize: 10.5, color: md.muted }, children: t('mgmt.arrivals.after', { count: r.daysToFirstWork ?? 0 }) })] })) : (_jsx(Pill, { color: md.red, bg: "#FDEEEE", children: t('mgmt.arrivals.notYet') })),
        },
    ], [t, f]);
    if (error)
        return _jsx(ErrorMessage, { messageKey: error });
    if (!data) {
        return (_jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '260px minmax(0,1fr)' } }, children: [_jsx(Skeleton, { variant: "rounded", height: 220, sx: { borderRadius: '18px' } }), _jsx(Skeleton, { variant: "rounded", height: 220, sx: { borderRadius: '14px' } })] }));
    }
    const share = (n) => (data.total ? `${f.n(Math.round((n / data.total) * 100))}%` : '—');
    const supplierTop = Math.max(1, ...data.bySupplier.map((s) => s.total));
    const monthTop = Math.max(1, ...data.byMonth.map((m) => m.count));
    return (_jsxs(Stack, { sx: { gap: 2 }, children: [_jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '260px minmax(0,1fr)' } }, children: [_jsx(HeroTotal, { tone: "blue", icon: _jsx(FlightLandOutlinedIcon, {}), label: t('mgmt.arrivals.total'), value: f.n(data.total), unit: t('mgmt.unit.worker'), note: t('mgmt.arrivals.note', { from, to }), onClick: () => setFilter({}) }), _jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(3, minmax(0,1fr))' } }, children: [_jsx(Mini, { color: md.teal, icon: _jsx(WorkOutlineOutlinedIcon, {}), value: f.n(data.working), label: t('mgmt.arrivals.kpi.working'), hint: t('mgmt.arrivals.ofAll', { share: share(data.working) }), onClick: () => setFilter({ status: 'working' }) }), _jsx(Mini, { color: md.amberDeep, icon: _jsx(BedOutlinedIcon, {}), value: f.n(data.housing), label: t('mgmt.arrivals.kpi.housing'), hint: t('mgmt.arrivals.ofAll', { share: share(data.housing) }), onClick: () => setFilter({ status: 'housing' }) }), _jsx(Mini, { color: "#7C5CBF", icon: _jsx(HourglassEmptyOutlinedIcon, {}), value: f.n(data.notDelivered), label: t('mgmt.arrivals.kpi.notDelivered'), hint: t('mgmt.arrivals.ofAll', { share: share(data.notDelivered) }), onClick: () => setFilter({ undelivered: true }) }), _jsx(Mini, { color: md.navy, icon: _jsx(BusinessCenterOutlinedIcon, {}), value: f.n(data.workedOnce), label: t('mgmt.arrivals.kpi.workedOnce'), hint: t('mgmt.arrivals.ofAll', { share: share(data.workedOnce) }) }), _jsx(Mini, { color: md.greenDeep, icon: _jsx(SpeedOutlinedIcon, {}), value: data.workShare === null ? '—' : `${f.n(Math.round(data.workShare))}%`, label: t('mgmt.arrivals.kpi.workShare'), hint: _jsxs(_Fragment, { children: [_jsxs(Stack, { direction: "row", component: "span", sx: { display: 'flex', height: 5, borderRadius: 999, overflow: 'hidden', bgcolor: md.track, my: 0.5 }, children: [_jsx(Box, { component: "span", sx: { width: `${data.workShare ?? 0}%`, bgcolor: md.teal } }), _jsx(Box, { component: "span", sx: { width: `${data.housingShare ?? 0}%`, bgcolor: md.amber } })] }), t('mgmt.arrivals.shareText', { work: f.n(Math.round(data.workShare ?? 0)), housing: f.n(Math.round(data.housingShare ?? 0)) })] }) }), _jsx(Mini, { color: "#7C5CBF", icon: _jsx(TimerOutlinedIcon, {}), value: data.daysToFirstWork === null ? '—' : t('mgmt.arrivals.days', { count: Math.round(data.daysToFirstWork) }), label: t('mgmt.arrivals.kpi.toFirst') })] })] }), _jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' } }, children: [_jsxs(VisualCard, { title: t('mgmt.arrivals.bySupplier'), icon: _jsx(LocalShippingOutlinedIcon, {}), hint: t('mgmt.arrivals.clickToFilter'), children: [_jsx(Stack, { direction: "row", sx: { gap: 1.5, fontSize: 11.5, color: md.muted, mb: 1, flexWrap: 'wrap' }, children: ['working', 'housing', 'vacation'].map((s) => (_jsxs("span", { children: [_jsx(Box, { component: "span", sx: { color: statusLook[s].color }, children: "\u25A0" }), " ", t(`mgmt.arrivals.status.${s}`)] }, s))) }), _jsx(Stack, { sx: { gap: 0.5, maxHeight: 300, overflowY: 'auto', scrollbarWidth: 'thin' }, children: data.bySupplier.map((s) => (_jsxs(ButtonBase, { onClick: () => setFilter((x) => ({ supplier: x.supplier === s.supplier ? undefined : s.supplier })), sx: { display: 'grid', gridTemplateColumns: 'minmax(0, 120px) minmax(0,1fr) 36px 58px', gap: 1, alignItems: 'center', p: 0.6, borderRadius: '8px', textAlign: 'start', bgcolor: filter.supplier === s.supplier ? '#EEF5FA' : 'transparent' }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: md.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: _jsx("bdi", { children: s.supplier === '—' ? t('mgmt.arrivals.noSupplier') : s.supplier }) }), _jsxs(Stack, { direction: "row", sx: { height: 10, borderRadius: 999, overflow: 'hidden', bgcolor: md.track, width: `${(s.total / supplierTop) * 100}%`, minWidth: 8 }, children: [_jsx(Box, { sx: { flex: s.working, bgcolor: statusLook.working.color } }), _jsx(Box, { sx: { flex: s.housing, bgcolor: statusLook.housing.color } }), _jsx(Box, { sx: { flex: s.vacation, bgcolor: statusLook.vacation.color } }), _jsx(Box, { sx: { flex: s.other, bgcolor: '#C3CDD5' } })] }), _jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: md.ink, textAlign: 'end' }, children: s.total }), _jsx(Typography, { sx: { fontSize: 11, color: md.teal, fontWeight: 700 }, children: t('mgmt.arrivals.workPct', { rate: f.n(s.workShare) }) })] }, s.supplier))) })] }), _jsxs(VisualCard, { title: t('mgmt.arrivals.statuses'), hint: t('mgmt.arrivals.clickToFilter'), children: [_jsx(Donut, { items: data.byStatus.map((s) => ({ key: s.key, label: t(`mgmt.arrivals.status.${s.key}`), value: s.count })), colors: data.byStatus.map((s) => statusLook[s.key]?.color ?? md.muted), selected: filter.status, onSelect: (key) => setFilter((x) => ({ status: x.status === key ? undefined : key })), center: _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 20, fontWeight: 700, color: md.navy, lineHeight: 1 }, children: f.n(data.total) }), _jsx(Typography, { sx: { fontSize: 10.5, color: md.muted }, children: t('mgmt.unit.worker') })] }) }), _jsx(Typography, { component: "h4", sx: { fontSize: 13, fontWeight: 700, color: md.navy, mt: 1.5, mb: 0.75 }, children: t('mgmt.arrivals.byMonth') }), _jsx(Stack, { sx: { gap: 0.5 }, children: data.byMonth.map((m) => (_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 40px', gap: 1, alignItems: 'center' }, children: [_jsx(Typography, { sx: { fontSize: 12, color: md.text }, children: _jsx("bdi", { children: m.month }) }), _jsx(Box, { sx: { height: 7, borderRadius: 999, bgcolor: md.track }, children: _jsx(Box, { sx: { height: '100%', width: `${(m.count / monthTop) * 100}%`, borderRadius: 999, background: 'linear-gradient(135deg, #22B8E6 0%, #1F5FC2 100%)' } }) }), _jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: md.ink, textAlign: 'end' }, children: m.count })] }, m.month))) })] })] }), _jsx(DataTable, { title: t('mgmt.arrivals.table'), badge: filter.supplier ?? (filter.status ? t(`mgmt.arrivals.status.${filter.status}`) : filter.undelivered ? t('mgmt.arrivals.kpi.notDelivered') : t('mgmt.inPeriodShort')), rows: rows, columns: columns, excel: managementApi.newArrivalsExcel(from, to), empty: t('mgmt.empty') })] }));
}
function Mini({ color, icon, value, label, hint, onClick }) {
    return (_jsxs(ButtonBase, { onClick: onClick, disabled: !onClick, sx: { justifyContent: 'flex-start', alignItems: 'flex-start', gap: 1.25, p: '12px 14px', borderRadius: '14px', bgcolor: '#fff', border: `1px solid ${md.border}`, boxShadow: `inset -3px 0 0 ${color}`, textAlign: 'start' }, children: [_jsx(Box, { "aria-hidden": true, sx: { width: 36, height: 36, borderRadius: '10px', bgcolor: `${color}1A`, color, display: 'grid', placeItems: 'center', flex: '0 0 auto', '& svg': { fontSize: 20 } }, children: icon }), _jsxs(Box, { sx: { minWidth: 0, flex: 1 }, children: [_jsx(Typography, { sx: { fontSize: 22, fontWeight: 700, color: md.navy, lineHeight: 1.2 }, children: value }), _jsx(Typography, { sx: { fontSize: 12, color: md.label }, children: label }), hint && _jsx(Typography, { component: "div", sx: { fontSize: 11, color, fontWeight: 600 }, children: hint })] })] }));
}
