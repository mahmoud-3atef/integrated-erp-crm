import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Alert, Box, Button, ButtonBase, Skeleton, Stack, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/dashboard';
import { housingApi } from '../api/housing';
import { useSession } from '../app/session';
import { tokens } from '../app/theme';
import { Columns, CountUp, Donut, Legend, palette, RankedBars, Ring } from '../components/charts';
import { companyName } from './ChooseCompanyPage';
const rise = keyframes `from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; }`;
const float = keyframes `0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); }`;
const placementColors = {
    Working: '#23a455',
    Housing: '#0d4a6c',
    New: '#2bc3e1',
    Vacation: '#d98a06',
    Suspended: '#e0607e',
    Absconded: '#e03434',
    Exited: '#8aa1b1',
    Other: '#7b5cd6',
};
/** A white dashboard card with a title, an optional link, and a staggered entrance. */
function Card({ title, subtitle, icon, link, delay = 0, children, sx }) {
    const navigate = useNavigate();
    return (_jsxs(Box, { sx: {
            bgcolor: '#fff',
            borderRadius: `${tokens.radiusLg}px`,
            boxShadow: tokens.shadowSm,
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            animation: `${rise} .55s ${delay}s cubic-bezier(.2,.8,.2,1) both`,
            transition: 'box-shadow .2s',
            '&:hover': { boxShadow: tokens.shadowMd },
            ...sx,
        }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25, mb: 2 }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: '11px', bgcolor: tokens.navy50, color: tokens.navy700, '& svg': { fontSize: 20 } }, children: icon }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 15, fontWeight: 800, color: tokens.navy800 }, children: title }), subtitle && _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: subtitle })] }), link && (_jsx(Button, { size: "small", endIcon: _jsx(ArrowOutwardIcon, { sx: { fontSize: '15px !important' } }), onClick: () => navigate(link.to), sx: { fontSize: 12.5 }, children: link.label }))] }), children] }));
}
/** A glass tile on the hero banner. */
function HeroStat({ label, value, foot, icon, onClick }) {
    return (_jsxs(ButtonBase, { onClick: onClick, disabled: !onClick, sx: {
            display: 'block',
            textAlign: 'start',
            p: 2,
            borderRadius: '16px',
            bgcolor: 'rgba(255,255,255,.1)',
            border: '1px solid rgba(255,255,255,.16)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            transition: 'background-color .2s, transform .2s',
            '&:hover': onClick ? { bgcolor: 'rgba(255,255,255,.18)', transform: 'translateY(-2px)' } : undefined,
        }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 0.75, opacity: 0.85, '& svg': { fontSize: 18 } }, children: [icon, _jsx(Typography, { sx: { fontSize: 12.5 }, children: label })] }), _jsx(Typography, { sx: { fontSize: 30, fontWeight: 800, lineHeight: 1.1 }, children: value }), foot && _jsx(Typography, { sx: { fontSize: 11.5, opacity: 0.75, mt: 0.25 }, children: foot })] }));
}
/** A coloured number tile (this month's movements). */
function MoveTile({ label, value, icon, color, onClick }) {
    return (_jsxs(ButtonBase, { onClick: onClick, sx: { display: 'block', textAlign: 'start', p: 1.75, borderRadius: '14px', bgcolor: `${color}12`, border: `1px solid ${color}26`, transition: 'transform .15s', '&:hover': { transform: 'translateY(-2px)' } }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: '10px', bgcolor: color, color: '#fff', mb: 1, '& svg': { fontSize: 19 } }, children: icon }), _jsx(Typography, { sx: { fontSize: 26, fontWeight: 800, color: tokens.navy800, lineHeight: 1.1 }, children: _jsx(CountUp, { value: value }) }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: label })] }));
}
/** The management dashboard: where the workers are, how they move, the documents waiting, housing and data checks. */
export function HomePage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { me, can } = useSession();
    const ar = i18n.language === 'ar';
    const seeWorkforce = can('workforce.workers.view', true);
    const seeOperations = can('operations.delivery.view', true);
    const seeHousing = can('housing.view', true);
    const [workforce, setWorkforce] = useState(null);
    const [operations, setOperations] = useState(null);
    const [housing, setHousing] = useState(null);
    useEffect(() => {
        if (seeWorkforce)
            dashboardApi.workforce().then(setWorkforce).catch(() => setWorkforce(null));
        if (seeOperations)
            dashboardApi.operations().then(setOperations).catch(() => setOperations(null));
        if (seeHousing)
            housingApi.overview().then(setHousing).catch(() => setHousing(null));
    }, [seeWorkforce, seeOperations, seeHousing]);
    const now = new Date();
    const hour = now.getHours();
    const greeting = t(hour < 12 ? 'home.morning' : 'home.evening');
    const gregorian = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    const hijri = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-GB-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    const name = (n) => (ar ? n.nameAr : n.nameEn);
    const monthLabel = (iso) => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'short', ...(iso.slice(5, 7) === '01' ? { year: '2-digit' } : {}), timeZone: 'UTC' }).format(new Date(iso));
    const p = workforce?.placements ?? {};
    const onJob = p.Working ?? 0;
    const available = (p.Housing ?? 0) + (p.New ?? 0);
    const placementSlices = Object.entries(p)
        .filter(([key]) => key !== 'Exited' && key !== 'Absconded')
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => ({ key, label: t(`workforce.placement.${key}`), value, color: placementColors[key] ?? palette[7] }));
    const nationalitySlices = (workforce?.nationalities ?? []).map((n, i) => ({ key: n.code ?? `x${i}`, label: name(n), value: n.count, color: palette[i % palette.length] }));
    const occupancy = housing && housing.totals.capacity > 0 ? (housing.totals.occupied / housing.totals.capacity) * 100 : 0;
    const waiting = operations ? [operations.deliveries, operations.returns, operations.transfers].reduce((sum, d) => sum + d.preparing + d.inApproval, 0) : 0;
    const kindIcon = { delivery: _jsx(LocalShippingOutlinedIcon, {}), return: _jsx(KeyboardReturnOutlinedIcon, {}), transfer: _jsx(SwapHorizIcon, {}) };
    const kindPath = { delivery: 'delivery-orders', return: 'return-orders', transfer: 'transfer-orders' };
    const statusLabel = (kind, status) => kind === 'delivery' ? t(`operations.status.${status}`) : kind === 'return' ? t(`operations.return.status.${status}`) : t(`operations.transfer.status.${status}`);
    const ago = (iso) => {
        const minutes = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
        const rtf = new Intl.RelativeTimeFormat(ar ? 'ar' : 'en', { numeric: 'auto' });
        return minutes < 60 ? rtf.format(-minutes, 'minute') : minutes < 1440 ? rtf.format(-Math.round(minutes / 60), 'hour') : rtf.format(-Math.round(minutes / 1440), 'day');
    };
    return (_jsxs(Stack, { spacing: `${tokens.gap + 4}px`, children: [_jsxs(Box, { sx: {
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '24px',
                    p: { xs: 2.5, md: 3.5 },
                    color: '#fff',
                    background: `linear-gradient(125deg, ${tokens.navy900} 0%, ${tokens.navy700} 45%, ${tokens.teal} 100%)`,
                    boxShadow: tokens.shadowMd,
                    animation: `${rise} .5s cubic-bezier(.2,.8,.2,1) both`,
                }, children: [_jsx(Box, { sx: { position: 'absolute', width: 340, height: 340, borderRadius: '50%', top: -160, insetInlineEnd: -80, background: 'radial-gradient(circle, rgba(43,195,225,.35), transparent 70%)', animation: `${float} 9s ease-in-out infinite` } }), _jsx(Box, { sx: { position: 'absolute', width: 220, height: 220, borderRadius: '50%', bottom: -120, insetInlineStart: '30%', background: 'radial-gradient(circle, rgba(255,255,255,.12), transparent 70%)', animation: `${float} 11s ease-in-out infinite reverse` } }), _jsxs(Stack, { direction: { xs: 'column', lg: 'row' }, sx: { position: 'relative', gap: 3, alignItems: { lg: 'center' } }, children: [_jsxs(Box, { sx: { flex: '0 0 auto', minWidth: 260 }, children: [_jsx(Typography, { sx: { fontSize: 13.5, opacity: 0.8 }, children: greeting }), _jsx(Typography, { component: "h1", sx: { fontSize: { xs: 24, md: 28 }, fontWeight: 800, lineHeight: 1.25 }, children: me.displayName }), me.company && _jsx(Typography, { sx: { fontSize: 14, opacity: 0.85, mt: 0.5 }, children: companyName(me.company, i18n.language) }), _jsxs(Stack, { direction: "row", sx: { flexWrap: 'wrap', gap: 1, mt: 1.5 }, children: [_jsx(Box, { sx: { px: 1.25, py: 0.4, borderRadius: 999, bgcolor: 'rgba(255,255,255,.14)', fontSize: 12.5 }, children: gregorian }), _jsx(Box, { sx: { px: 1.25, py: 0.4, borderRadius: 999, bgcolor: 'rgba(255,255,255,.14)', fontSize: 12.5 }, children: hijri })] })] }), workforce ? (_jsxs(Box, { sx: { flex: 1, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }, children: [_jsx(HeroStat, { label: t('home.stats.active'), value: _jsx(CountUp, { value: workforce.active }), foot: t('home.stats.activeFoot'), icon: _jsx(GroupsOutlinedIcon, {}), onClick: () => navigate('/workforce/workers') }), _jsx(HeroStat, { label: t('home.stats.onJob'), value: _jsx(CountUp, { value: onJob }), foot: t('home.stats.share', { percent: workforce.active ? Math.round((onJob / workforce.active) * 100) : 0 }), icon: _jsx(EngineeringOutlinedIcon, {}), onClick: () => navigate('/workforce/workers?status=Working') }), _jsx(HeroStat, { label: t('home.stats.available'), value: _jsx(CountUp, { value: available }), foot: t('home.stats.availableFoot'), icon: _jsx(HotelOutlinedIcon, {}), onClick: () => navigate('/workforce/workers?status=Housing') }), _jsx(HeroStat, { label: t('home.stats.projects'), value: _jsx(CountUp, { value: workforce.projectsWithWorkers }), foot: t('home.stats.projectsFoot'), icon: _jsx(BusinessCenterOutlinedIcon, {}), onClick: () => navigate('/commercial/projects') })] })) : (seeWorkforce && (_jsx(Box, { sx: { flex: 1, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }, children: [0, 1, 2, 3].map((i) => (_jsx(Skeleton, { variant: "rounded", height: 104, sx: { bgcolor: 'rgba(255,255,255,.12)', borderRadius: '16px' } }, i))) })))] })] }), me.permissions.length === 0 && _jsx(Alert, { severity: "info", children: t('home.noPermissions') }), seeWorkforce && workforce && (_jsxs(_Fragment, { children: [_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '5fr 7fr' }, gap: `${tokens.gap + 4}px` }, children: [_jsxs(Card, { title: t('home.where.title'), subtitle: t('home.where.subtitle'), icon: _jsx(InsightsOutlinedIcon, {}), link: { label: t('home.open'), to: '/workforce/workers' }, delay: 0.05, children: [_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { alignItems: 'center', gap: 2.5, flex: 1 }, children: [_jsx(Donut, { data: placementSlices, centerLabel: t('home.where.center') }), _jsx(Legend, { data: placementSlices, onClick: (key) => navigate(`/workforce/workers?status=${key}`) })] }), (p.Exited ?? 0) + (p.Absconded ?? 0) > 0 && (_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500, mt: 1.5 }, children: t('home.where.gone', { exited: p.Exited ?? 0, absconded: p.Absconded ?? 0 }) }))] }), _jsxs(Card, { title: t('home.moves.title'), subtitle: t('home.moves.subtitle'), icon: _jsx(HistoryOutlinedIcon, {}), delay: 0.1, children: [_jsx(Stack, { direction: "row", sx: { gap: 2, mb: 1.5 }, children: [
                                            { color: tokens.navy700, label: t('home.moves.starts') },
                                            { color: tokens.gold, label: t('home.moves.returns') },
                                        ].map((s) => (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75 }, children: [_jsx(Box, { sx: { width: 10, height: 10, borderRadius: '3px', bgcolor: s.color } }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: s.label })] }, s.label))) }), _jsx(Columns, { categories: workforce.moves.map((m) => monthLabel(m.month)), series: [
                                            { key: 'starts', label: t('home.moves.starts'), color: tokens.navy700 },
                                            { key: 'returns', label: t('home.moves.returns'), color: tokens.gold },
                                        ], values: [workforce.moves.map((m) => m.workStarts), workforce.moves.map((m) => m.returns)] })] })] }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: '5fr 4fr 3fr' }, gap: `${tokens.gap + 4}px` }, children: [_jsx(Card, { title: t('home.projects.title'), subtitle: t('home.projects.subtitle', { count: workforce.projectsWithWorkers }), icon: _jsx(BusinessCenterOutlinedIcon, {}), link: { label: t('home.open'), to: '/commercial/projects' }, delay: 0.15, children: _jsx(RankedBars, { items: workforce.projects.map((x) => ({ key: x.code ?? x.nameEn, label: name(x), value: x.count })) }) }), _jsx(Card, { title: t('home.nationalities.title'), subtitle: t('home.nationalities.subtitle'), icon: _jsx(PublicOutlinedIcon, {}), delay: 0.2, children: _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { alignItems: 'center', gap: 2 }, children: [_jsx(Donut, { data: nationalitySlices, size: 150, thickness: 20, centerLabel: t('home.nationalities.center') }), _jsx(Legend, { data: nationalitySlices })] }) }), _jsx(Card, { title: t('home.professions.title'), subtitle: t('home.professions.subtitle'), icon: _jsx(BadgeOutlinedIcon, {}), delay: 0.25, sx: { gridColumn: { md: '1 / -1', xl: 'auto' } }, children: _jsx(RankedBars, { color: tokens.teal, items: workforce.professions.map((x, i) => ({ key: x.code ?? `x${i}`, label: name(x), value: x.count })) }) })] })] })), seeOperations && operations && (_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '4fr 3fr 5fr' }, gap: `${tokens.gap + 4}px` }, children: [_jsx(Card, { title: t('home.month.title'), subtitle: new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(now), icon: _jsx(InsightsOutlinedIcon, {}), delay: 0.3, children: _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25 }, children: [_jsx(MoveTile, { label: t('home.month.delivered'), value: operations.deliveredThisMonth, icon: _jsx(LocalShippingOutlinedIcon, {}), color: tokens.success, onClick: () => navigate('/operations/delivery-orders') }), _jsx(MoveTile, { label: t('home.month.returned'), value: operations.returnedThisMonth, icon: _jsx(KeyboardReturnOutlinedIcon, {}), color: tokens.warning, onClick: () => navigate('/operations/return-orders') }), _jsx(MoveTile, { label: t('home.month.transferred'), value: operations.transferredThisMonth, icon: _jsx(SwapHorizIcon, {}), color: tokens.info, onClick: () => navigate('/operations/transfer-orders') })] }) }), _jsx(Card, { title: t('home.waiting.title'), subtitle: t('home.waiting.subtitle', { count: waiting }), icon: _jsx(PendingActionsOutlinedIcon, {}), delay: 0.35, children: _jsx(Stack, { spacing: 1, children: [
                                ['delivery', operations.deliveries],
                                ['return', operations.returns],
                                ['transfer', operations.transfers],
                            ].map(([kind, open]) => (_jsxs(ButtonBase, { onClick: () => navigate(`/operations/${kindPath[kind]}?status=${kind === 'return' ? 'approval' : 'operations'}`), sx: { display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, borderRadius: '12px', bgcolor: tokens.gray50, textAlign: 'start', '&:hover': { bgcolor: tokens.navy50 } }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: '10px', bgcolor: '#fff', color: tokens.navy700, boxShadow: tokens.shadowXs, '& svg': { fontSize: 18 } }, children: kindIcon[kind] }), _jsx(Typography, { sx: { flex: 1, fontSize: 13.5, fontWeight: 700, color: tokens.navy800 }, children: t(`home.kinds.${kind}`) }), _jsxs(Box, { sx: { textAlign: 'center', minWidth: 54 }, children: [_jsx(Typography, { sx: { fontSize: 17, fontWeight: 800, color: tokens.gray600, lineHeight: 1 }, children: open.preparing }), _jsx(Typography, { sx: { fontSize: 10.5, color: tokens.gray500 }, children: t('home.waiting.preparing') })] }), _jsxs(Box, { sx: { textAlign: 'center', minWidth: 54 }, children: [_jsx(Typography, { sx: { fontSize: 17, fontWeight: 800, color: open.inApproval > 0 ? tokens.warning : tokens.gray500, lineHeight: 1 }, children: open.inApproval }), _jsx(Typography, { sx: { fontSize: 10.5, color: tokens.gray500 }, children: t('home.waiting.approval') })] })] }, kind))) }) }), _jsx(Card, { title: t('home.recent.title'), subtitle: t('home.recent.subtitle'), icon: _jsx(HistoryOutlinedIcon, {}), delay: 0.4, children: operations.recent.length === 0 ? (_jsxs(Stack, { sx: { flex: 1, alignItems: 'center', justifyContent: 'center', color: tokens.gray500, py: 3, gap: 1 }, children: [_jsx(HistoryOutlinedIcon, { sx: { fontSize: 34, opacity: 0.6 } }), _jsx(Typography, { sx: { fontSize: 13 }, children: t('home.recent.empty') })] })) : (_jsxs(Stack, { sx: { position: 'relative' }, children: [_jsx(Box, { sx: { position: 'absolute', top: 12, bottom: 12, insetInlineStart: 16, borderInlineStart: `2px solid ${tokens.gray100}` } }), operations.recent.map((r) => (_jsxs(ButtonBase, { onClick: () => navigate(`/operations/${kindPath[r.kind]}/${r.id}`), sx: { display: 'flex', alignItems: 'center', gap: 1.25, py: 0.9, px: 0.25, borderRadius: '10px', textAlign: 'start', position: 'relative', '&:hover': { bgcolor: tokens.gray50 } }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: '50%', bgcolor: '#fff', border: `2px solid ${tokens.navy100}`, color: tokens.navy700, zIndex: 1, '& svg': { fontSize: 16 } }, children: kindIcon[r.kind] }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsxs(Typography, { noWrap: true, sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: [_jsx("span", { dir: "ltr", children: r.orderNo }), " \u00B7 ", r.title] }), _jsxs(Typography, { noWrap: true, sx: { fontSize: 11.5, color: tokens.gray500 }, children: [statusLabel(r.kind, r.status), " \u00B7 ", r.createdByName, " \u00B7 ", ago(r.createdAt)] })] })] }, `${r.kind}-${r.id}`)))] })) })] })), (seeHousing || (seeWorkforce && workforce)) && (_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: `${tokens.gap + 4}px` }, children: [seeHousing && housing && (_jsx(Card, { title: t('home.housing.title'), subtitle: t('home.housing.subtitle', { count: housing.totals.buildings }), icon: _jsx(ApartmentOutlinedIcon, {}), link: { label: t('home.open'), to: '/housing' }, delay: 0.45, children: housing.totals.capacity === 0 ? (_jsxs(Stack, { sx: { alignItems: 'center', py: 3, gap: 1.5, color: tokens.gray500 }, children: [_jsx(ApartmentOutlinedIcon, { sx: { fontSize: 38, opacity: 0.6 } }), _jsx(Typography, { sx: { fontSize: 13 }, children: t('home.housing.empty') }), _jsx(Button, { variant: "outlined", size: "small", onClick: () => navigate('/housing'), children: t('housing.newBuilding') })] })) : (_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { alignItems: 'center', gap: 3 }, children: [_jsx(Ring, { percent: occupancy, size: 150, thickness: 14, color: occupancy >= 95 ? tokens.danger : occupancy >= 80 ? tokens.warning : tokens.success, label: t('home.housing.occupancy') }), _jsx(Box, { sx: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25, width: '100%' }, children: [
                                        [t('housing.cards.capacity'), housing.totals.capacity, tokens.navy700],
                                        [t('housing.cards.occupied'), housing.totals.occupied, tokens.success],
                                        [t('housing.cards.free'), Math.max(0, housing.totals.capacity - housing.totals.occupied), tokens.info],
                                        [t('housing.cards.withoutRoom'), housing.totals.withoutRoom, housing.totals.withoutRoom > 0 ? tokens.warning : tokens.gray500],
                                    ].map(([label, value, color]) => (_jsxs(Box, { sx: { p: 1.5, borderRadius: '12px', bgcolor: tokens.gray50, borderInlineStart: `3px solid ${color}` }, children: [_jsx(Typography, { sx: { fontSize: 22, fontWeight: 800, color: tokens.navy800, lineHeight: 1.1 }, children: _jsx(CountUp, { value: value }) }), _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray600 }, children: label })] }, label))) })] })) })), seeWorkforce && workforce && (_jsx(Card, { title: t('home.quality.title'), subtitle: t('home.quality.subtitle'), icon: _jsx(FactCheckOutlinedIcon, {}), delay: 0.5, children: _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { alignItems: 'center', gap: 3 }, children: [workforce.checkRate !== null ? (_jsx(ButtonBase, { onClick: () => navigate('/workforce/invoice-check'), sx: { borderRadius: '50%' }, children: _jsx(Ring, { percent: workforce.checkRate, size: 150, thickness: 14, color: workforce.checkRate >= 99 ? tokens.success : workforce.checkRate >= 90 ? tokens.teal : tokens.warning, label: t('home.quality.match', { month: workforce.checkMonth ? monthLabel(workforce.checkMonth) : '' }), children: _jsxs(Typography, { sx: { fontSize: 28, fontWeight: 800, color: tokens.navy800 }, children: [workforce.checkRate.toFixed(1), "%"] }) }) })) : (_jsx(Ring, { percent: 0, size: 150, thickness: 14, color: tokens.gray300, label: t('home.quality.noCheck'), children: _jsx(Typography, { sx: { fontSize: 24, fontWeight: 800, color: tokens.gray500 }, children: "\u2014" }) })), _jsx(Stack, { spacing: 1.25, sx: { flex: 1, width: '100%' }, children: [
                                        { icon: _jsx(RuleOutlinedIcon, {}), label: t('home.quality.issues'), value: workforce.historyIssues, color: tokens.navy700, to: '/workforce/history-issues' },
                                        { icon: _jsx(WarningAmberOutlinedIcon, {}), label: t('home.quality.iqama30'), value: workforce.iqamaExpiring30, color: tokens.warning, to: undefined, none: workforce.iqamaWithExpiry === 0 },
                                        { icon: _jsx(WarningAmberOutlinedIcon, {}), label: t('home.quality.iqamaExpired'), value: workforce.iqamaExpired, color: tokens.danger, to: undefined, none: workforce.iqamaWithExpiry === 0 },
                                    ].map((item) => (_jsxs(ButtonBase, { disabled: !item.to, onClick: () => item.to && navigate(item.to), sx: { display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, borderRadius: '12px', bgcolor: tokens.gray50, textAlign: 'start', '&:hover': item.to ? { bgcolor: tokens.navy50 } : undefined }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: '10px', bgcolor: `${item.color}18`, color: item.color, '& svg': { fontSize: 18 } }, children: item.icon }), _jsxs(Box, { sx: { flex: 1 }, children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray700 }, children: item.label }), 'none' in item && item.none && _jsx(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: t('home.quality.noExpiry') })] }), _jsx(Typography, { sx: { fontSize: 18, fontWeight: 800, color: item.value > 0 ? item.color : tokens.gray500 }, children: 'none' in item && item.none ? '—' : _jsx(CountUp, { value: item.value }) })] }, item.label))) })] }) }))] }))] }));
}
