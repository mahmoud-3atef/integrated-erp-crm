import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenOutlinedIcon from '@mui/icons-material/FullscreenOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingBasketOutlinedIcon from '@mui/icons-material/ShoppingBasketOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { Alert, Box, Button, ButtonBase, InputAdornment, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { photoUrl, showroomApi } from '../../../api/showroom';
import { useSession } from '../../../app/session';
import { tokens } from '../../../app/theme';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { Flag } from '../../../components/workforce/Flag';
import { ShowroomFile } from './ShowroomFile';
import { WorkerShowCard } from './WorkerShowCard';
import { initialsOf, specialtyIcon, tintOf, useShowroomText } from './showroomParts';
const rise = keyframes `from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; }`;
const appear = (i) => ({ animation: `${rise} .5s ${Math.min(i, 12) * 0.04}s cubic-bezier(.2,.8,.2,1) both` });
/**
 * The showroom (docs/03-migration-plan/15): the workers in housing are the company's stock, shown as a customer should
 * see them, by specialty and nationality. «Presentation» fills the screen for a customer and the server leaves out what
 * is internal. Choosing workers ends in a list for the customer (PDF) or a delivery order.
 */
export function ShowroomPage() {
    const { t } = useTranslation();
    const { can } = useSession();
    const navigate = useNavigate();
    const x = useShowroomText();
    const [params, setParams] = useSearchParams();
    const presentation = params.get('present') === '1';
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [specialty, setSpecialty] = useState(undefined);
    const [nationality, setNationality] = useState(undefined);
    const [experience, setExperience] = useState('all');
    const [sort, setSort] = useState('experience');
    const [search, setSearch] = useState('');
    const [picked, setPicked] = useState([]);
    const [open, setOpen] = useState(null);
    useEffect(() => {
        setData(null);
        setError(null);
        showroomApi.get(presentation).then(setData).catch((f) => setError(errorKey(f)));
    }, [presentation]);
    const workers = useMemo(() => {
        if (!data)
            return [];
        const q = search.trim().toLowerCase();
        const list = data.workers.filter((w) => (specialty === undefined || (w.specialty?.code ?? null) === specialty) &&
            (nationality === undefined || w.nationalityCode === nationality) &&
            (experience === 'all' || (experience === 'new' ? w.isNew : experience === 'hotel' ? w.hotelExperience : !w.isNew)) &&
            (!q || [w.name, w.workerNo, x.name(w.specialty), ...w.skills.map(x.name), ...w.languages.map(x.name)].some((v) => v.toLowerCase().includes(q))));
        const by = {
            experience: (a, b) => b.workDays - a.workDays,
            waiting: (a, b) => (b.daysAvailable ?? 0) - (a.daysAvailable ?? 0),
            newest: (a, b) => (a.daysAvailable ?? 0) - (b.daysAvailable ?? 0),
        };
        return [...list].sort((a, b) => Number(!!a.reservedBy) - Number(!!b.reservedBy) || by[sort](a, b));
    }, [data, specialty, nationality, experience, sort, search, x]);
    if (!can('operations.showroom.view', true)) {
        return _jsx(Alert, { severity: "warning", children: t('showroom.noAccess') });
    }
    const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    const present = (on) => {
        setParams(on ? { present: '1' } : {});
        setOpen(null);
        if (on)
            document.documentElement.requestFullscreen?.().catch(() => undefined);
        else if (document.fullscreenElement)
            document.exitFullscreen().catch(() => undefined);
    };
    const chosen = data?.workers.filter((w) => picked.includes(w.id)) ?? [];
    const body = (_jsxs(Box, { sx: { pb: picked.length ? 10 : 2 }, children: [_jsx(ErrorMessage, { messageKey: error }), !data ? !error && _jsx(Loading, {}) : (_jsxs(_Fragment, { children: [_jsx(Hero, { data: data, presentation: presentation, specialty: specialty, onSpecialty: setSpecialty }), _jsxs(Stack, { direction: "row", role: "group", "aria-label": t('showroom.byNationality'), sx: { alignItems: 'center', gap: 0.75, mb: 2, px: 1, py: 0.75, bgcolor: '#fff', borderRadius: '14px', boxShadow: tokens.shadowSm, overflowX: 'auto', scrollbarWidth: 'thin', '& > *': { flex: '0 0 auto' } }, children: [_jsx(Chip, { on: nationality === undefined, onClick: () => setNationality(undefined), label: t('showroom.all'), count: data.workers.length }), data.byNationality.map((n) => (_jsx(Chip, { on: nationality !== undefined && nationality === n.code, onClick: () => setNationality(nationality === n.code ? undefined : n.code), label: x.name(n), count: n.count, flag: n.code }, n.code ?? 'none')))] }), _jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1, mb: 2, p: 1, bgcolor: '#fff', borderRadius: '14px', boxShadow: tokens.shadowSm }, children: [_jsx(TextField, { size: "small", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t(presentation ? 'showroom.searchCustomer' : 'showroom.search'), sx: { flex: { md: '1 1 320px' }, minWidth: 0 }, slotProps: { input: { startAdornment: (_jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, {}) })) } } }), _jsx(TextField, { select: true, size: "small", label: t('showroom.experience'), value: experience, onChange: (e) => setExperience(e.target.value), sx: { flex: { md: '0 0 200px' } }, children: ['all', 'experienced', 'hotel', 'new'].map((v) => (_jsx(MenuItem, { value: v, children: t(`showroom.experienceOptions.${v}`) }, v))) }), !presentation && (_jsx(TextField, { select: true, size: "small", label: t('showroom.sort'), value: sort, onChange: (e) => setSort(e.target.value), sx: { flex: { md: '0 0 200px' } }, children: ['experience', 'waiting', 'newest'].map((v) => (_jsx(MenuItem, { value: v, children: t(`showroom.sortOptions.${v}`) }, v))) }))] }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500, mb: 1.25 }, children: t('showroom.showing', { count: workers.length, total: data.workers.length }) }), workers.length === 0 ? (_jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: '18px', p: 5, textAlign: 'center', color: tokens.gray500 }, children: [data.workers.length === 0 ? t('showroom.empty') : t('showroom.noResults'), data.workers.length > 0 && (_jsx(Box, { children: _jsx(Button, { sx: { mt: 1 }, onClick: () => { setSpecialty(undefined); setNationality(undefined); setExperience('all'); setSearch(''); }, children: t('showroom.clear') }) }))] })) : (_jsx(Box, { sx: { display: 'grid', gap: 2.25, gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }, children: workers.map((w, i) => (_jsx(Box, { sx: appear(i), children: _jsx(WorkerShowCard, { worker: w, presentation: presentation, selected: picked.includes(w.id), onToggle: () => toggle(w.id), onOpen: () => setOpen(w.id) }) }, w.id))) }))] })), chosen.length > 0 && (_jsxs(Stack, { direction: "row", sx: {
                    position: 'fixed',
                    bottom: 18,
                    insetInlineStart: presentation ? 24 : { xs: 16, md: 110 },
                    insetInlineEnd: 24,
                    zIndex: 20,
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.25,
                    borderRadius: '16px',
                    color: '#fff',
                    bgcolor: '#082B49',
                    boxShadow: '0 16px 40px rgba(8,43,73,.35)',
                    animation: `${rise} .35s cubic-bezier(.2,.8,.2,1) both`,
                }, children: [_jsx(ShoppingBasketOutlinedIcon, {}), _jsx(Typography, { sx: { fontWeight: 800, whiteSpace: 'nowrap' }, children: t('showroom.basket.count', { count: chosen.length }) }), _jsx(Stack, { direction: "row", sx: { display: { xs: 'none', sm: 'flex' } }, children: chosen.slice(0, 6).map((w) => (_jsx(Box, { sx: { width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: '2px solid #082B49', marginInlineStart: '-8px', bgcolor: tintOf(w.nationalityCode), display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }, children: w.photos[0] ? _jsx(Box, { component: "img", src: photoUrl(w.id, w.photos[0]), alt: "", sx: { width: '100%', height: '100%', objectFit: 'cover' } }) : initialsOf(w.name) }, w.id))) }), _jsx(Typography, { noWrap: true, sx: { fontSize: 12.5, opacity: 0.75, flex: 1, display: { xs: 'none', md: 'block' } }, children: [...new Set(chosen.map((w) => (w.specialty ? x.name(w.specialty) : t('showroom.noSpecialty'))))].join(x.ar ? '، ' : ', ') }), _jsx(Button, { onClick: () => setPicked([]), sx: { color: 'rgba(255,255,255,.75)' }, children: t('showroom.basket.clear') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(PictureAsPdfOutlinedIcon, {}), onClick: () => window.open(`/housing/showroom/print?ids=${picked.join(',')}`, '_blank'), sx: { color: '#fff', borderColor: 'rgba(255,255,255,.4)', whiteSpace: 'nowrap' }, children: t('showroom.basket.pdf') }), !presentation && can('operations.delivery.create', true) && (_jsx(Button, { variant: "contained", startIcon: _jsx(LocalShippingOutlinedIcon, {}), onClick: () => navigate('/operations/delivery-orders/new', { state: { workerIds: picked } }), sx: { bgcolor: '#F59E0B', fontWeight: 800, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#D97706' } }, children: t('showroom.basket.order') }))] })), open && _jsx(ShowroomFile, { workerId: open, presentation: presentation, selected: picked.includes(open), onToggle: () => toggle(open), onClose: () => setOpen(null) })] }));
    if (!presentation)
        return body;
    // The presentation fills the window over the menu and the top bar.
    return (_jsxs(Box, { sx: { position: 'fixed', inset: 0, zIndex: 1200, overflow: 'auto', bgcolor: '#EEF2F7' }, children: [_jsxs(Stack, { direction: "row", sx: { position: 'sticky', top: 0, zIndex: 5, alignItems: 'center', gap: 1.5, px: { xs: 2, md: 4 }, py: 1.5, bgcolor: '#082B49', color: '#fff', boxShadow: '0 4px 18px rgba(8,43,73,.25)' }, children: [_jsx(VerifiedOutlinedIcon, { sx: { color: '#FCD34D' } }), _jsx(Typography, { sx: { fontWeight: 800, fontSize: 16, flex: 1 }, children: t('showroom.presentTitle') }), _jsx(Button, { startIcon: _jsx(FullscreenOutlinedIcon, {}), onClick: () => document.documentElement.requestFullscreen?.().catch(() => undefined), sx: { color: '#fff' }, children: t('showroom.fullscreen') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(CloseIcon, {}), onClick: () => present(false), sx: { color: '#fff', borderColor: 'rgba(255,255,255,.4)' }, children: t('showroom.exitPresent') })] }), _jsx(Box, { sx: { px: { xs: 2, md: 4 }, py: 3, maxWidth: 1600, mx: 'auto' }, children: body })] }));
}
function Chip({ on, onClick, label, count, flag }) {
    return (_jsxs(ButtonBase, { onClick: onClick, "aria-pressed": on, sx: { gap: 0.75, paddingInlineStart: flag === undefined ? 1.5 : 0.5, paddingInlineEnd: 0.75, py: 0.4, borderRadius: 99, whiteSpace: 'nowrap', border: `1px solid ${on ? '#082B49' : tokens.gray200}`, bgcolor: on ? '#082B49' : '#fff', color: on ? '#fff' : tokens.navy800, fontWeight: 700, fontSize: 13, transition: 'all .2s', '&:hover': { borderColor: '#082B49' } }, children: [flag !== undefined && _jsx(Flag, { code: flag, size: 22 }), label, _jsx(Box, { component: "span", sx: { px: 0.9, py: 0.1, borderRadius: 99, fontSize: 12, bgcolor: on ? 'rgba(255,255,255,.2)' : tokens.gray100 }, children: count })] }));
}
/** The banner: what is ready now, said as sales would say it. */
function Hero({ data, presentation, specialty, onSpecialty }) {
    const { t } = useTranslation();
    const x = useShowroomText();
    const faces = data.workers.filter((w) => !w.reservedBy).sort((a, b) => b.photos.length - a.photos.length).slice(0, 7);
    const top = data.bySpecialty.filter((s) => s.code).slice(0, 3).map((s) => x.name(s));
    // Delivery within a day, and (inside) the workers an order has already reserved.
    const facts = [
        [_jsx(BoltRoundedIcon, {}, "a"), t('showroom.hero.fast')],
        ...(!presentation && data.reserved ? [[_jsx(LocalShippingOutlinedIcon, {}, "c"), t('showroom.hero.reserved', { count: data.reserved })]] : []),
    ];
    return (_jsxs(Box, { sx: {
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '22px',
            mb: 2,
            px: { xs: 2.5, md: 3 },
            py: { xs: 2, md: 2.25 },
            color: '#fff',
            background: 'linear-gradient(120deg, #072d43 0%, #0d4a6c 48%, #0e7c86 100%)',
            display: 'grid',
            columnGap: 3,
            rowGap: 2,
            gridTemplateColumns: { xs: '1fr', lg: '1fr auto' },
            alignItems: 'center',
            '&::after': { content: '""', position: 'absolute', width: 380, height: 380, borderRadius: '50%', insetInlineEnd: -120, top: -200, background: 'radial-gradient(circle, rgba(252,211,77,.18), transparent 65%)' },
        }, children: [_jsxs(Box, { sx: { position: 'relative', zIndex: 1, minWidth: 0 }, children: [_jsxs(Typography, { component: "h1", sx: { fontSize: { xs: 22, md: 26 }, fontWeight: 800, lineHeight: 1.35 }, children: [t('showroom.hero.title1'), ' ', _jsx(Box, { component: "span", sx: { color: '#FCD34D' }, children: t('showroom.hero.title2') })] }), _jsx(Typography, { sx: { fontSize: 13.5, opacity: 0.85, mt: 0.5 }, children: top.length ? t('showroom.hero.subtitle', { specialties: top.join(x.ar ? '، ' : ', '), count: data.nationalities }) : t('showroom.hero.subtitleNone') })] }), _jsxs(Stack, { direction: "row", sx: { position: 'relative', zIndex: 1, alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: { lg: 'flex-end' } }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center' }, children: [faces.map((w, i) => (_jsx(Box, { title: w.name, sx: { width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', border: '3px solid #0d4a6c', marginInlineStart: i ? '-11px' : 0, bgcolor: tintOf(w.nationalityCode), display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, boxShadow: '0 4px 10px rgba(0,0,0,.2)' }, children: w.photos[0] ? _jsx(Box, { component: "img", src: photoUrl(w.id, w.photos[0]), alt: "", sx: { width: '100%', height: '100%', objectFit: 'cover' } }) : initialsOf(w.name) }, w.id))), data.workers.length > faces.length && (_jsxs(Box, { sx: { width: 42, height: 42, borderRadius: '50%', border: '3px solid #0d4a6c', marginInlineStart: '-11px', bgcolor: '#fff', color: tokens.navy800, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12.5 }, children: ["+", data.workers.length - faces.length] }))] }), facts.map(([icon, text], i) => (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75, px: 1.5, py: 0.8, borderRadius: '12px', fontSize: 13, fontWeight: 700, bgcolor: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', backdropFilter: 'blur(8px)', '& svg': { fontSize: 18, color: '#FCD34D' } }, children: [icon, text] }, i)))] }), _jsxs(Box, { role: "group", "aria-label": t('showroom.bySpecialty'), sx: { gridColumn: '1 / -1', position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: 1.25, '& > *': { flex: '1 1 130px', maxWidth: { xs: 'none', sm: 240 } } }, children: [_jsx(GlassCard, { index: 0, on: specialty === undefined, onClick: () => onSpecialty(undefined), icon: _jsx(AppsRoundedIcon, {}), label: t('showroom.all'), count: data.workers.length }), data.bySpecialty.map((s, i) => {
                        const on = specialty !== undefined && specialty === s.code;
                        return _jsx(GlassCard, { index: i + 1, on: on, onClick: () => onSpecialty(on ? undefined : s.code), icon: specialtyIcon(s.code), label: s.code ? x.name(s) : t('showroom.noSpecialty'), count: s.count }, s.code ?? 'none');
                    })] })] }));
}
/** A glass card that tilts towards the mouse, with a light that follows it (still when less motion is asked). */
function GlassCard({ index, on, onClick, icon, label, count }) {
    const ref = useRef(null);
    const move = (e) => {
        const el = ref.current;
        if (!el)
            return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--rx', `${((0.5 - py) * 16).toFixed(1)}deg`);
        el.style.setProperty('--ry', `${((px - 0.5) * 16).toFixed(1)}deg`);
        el.style.setProperty('--gx', `${(px * 100).toFixed(0)}%`);
        el.style.setProperty('--gy', `${(py * 100).toFixed(0)}%`);
    };
    const leave = () => {
        const el = ref.current;
        if (!el)
            return;
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
    };
    return (_jsx(Box, { sx: { perspective: '700px', ...appear(index + 2) }, children: _jsxs(ButtonBase, { ref: ref, onClick: onClick, onMouseMove: move, onMouseLeave: leave, "aria-pressed": on, sx: {
                position: 'relative',
                width: '100%',
                flexDirection: 'column',
                gap: 0.6,
                py: 1.5,
                px: 1,
                overflow: 'hidden',
                borderRadius: '16px',
                color: '#fff',
                bgcolor: on ? 'rgba(255,255,255,.24)' : 'rgba(255,255,255,.09)',
                border: `1px solid ${on ? 'rgba(252,211,77,.85)' : 'rgba(255,255,255,.18)'}`,
                boxShadow: on ? '0 10px 28px rgba(0,0,0,.25), inset 0 0 0 1px rgba(252,211,77,.4)' : '0 6px 18px rgba(0,0,0,.12)',
                backdropFilter: 'blur(10px) saturate(140%)',
                transform: 'rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateZ(0)',
                transformStyle: 'preserve-3d',
                transition: 'transform .18s ease-out, background-color .2s, border-color .2s, box-shadow .2s',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: 'radial-gradient(160px circle at var(--gx, 50%) var(--gy, 0%), rgba(255,255,255,.28), transparent 60%)',
                    opacity: 0,
                    transition: 'opacity .25s',
                },
                '&:hover': { bgcolor: on ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.16)' },
                '&:hover::before': { opacity: 1 },
                '&:focus-visible': { outline: '2px solid #FCD34D', outlineOffset: 2 },
                '@media (prefers-reduced-motion: reduce)': { transform: 'none', transition: 'background-color .2s' },
            }, children: [_jsx(Box, { sx: { width: 40, height: 40, borderRadius: '12px', display: 'grid', placeItems: 'center', color: on ? '#082B49' : '#FCD34D', bgcolor: on ? '#FCD34D' : 'rgba(255,255,255,.12)', transform: 'translateZ(24px)', '& svg': { fontSize: 23 } }, children: icon }), _jsx(Typography, { noWrap: true, sx: { fontSize: 12.5, fontWeight: 700, maxWidth: '100%', transform: 'translateZ(16px)' }, children: label }), _jsx(Typography, { sx: { fontSize: 22, fontWeight: 800, lineHeight: 1, color: on ? '#FCD34D' : '#fff', transform: 'translateZ(20px)' }, children: count })] }) }));
}
function Loading() {
    return (_jsxs(Stack, { sx: { gap: 2 }, children: [_jsx(Skeleton, { variant: "rounded", height: 230, sx: { borderRadius: '22px' } }), _jsx(Skeleton, { variant: "rounded", height: 210, sx: { borderRadius: '18px' } }), _jsx(Box, { sx: { display: 'grid', gap: 2.25, gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }, children: Array.from({ length: 8 }, (_, i) => (_jsx(Skeleton, { variant: "rounded", height: 480, sx: { borderRadius: '18px' } }, i))) })] }));
}
