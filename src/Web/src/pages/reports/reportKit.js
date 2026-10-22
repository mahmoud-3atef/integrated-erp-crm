import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { Box, Button, ButtonBase, GlobalStyles, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tokens } from '../../app/theme';
import { useCountUp } from '../../components/charts';
import { DateField } from '../../components/DateField';
// The reports' shared parts (docs/03-migration-plan/14): the period bar, the figures' banner, the summary ticker, the
// cards' titles and the small helpers; each report (executive, workforce movement, housing) builds on them.
// As on the home page: cards rise in one after the other, numbers count up, bars grow (from the reading start:
// «left» becomes «right» in Arabic through the RTL style plugin).
const rise = keyframes `from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; }`;
const grow = keyframes `from { transform: scaleY(0); } to { transform: scaleY(1); }`;
const fill = keyframes `from { transform: scaleX(0); } to { transform: scaleX(1); }`;
export const appear = (delay) => ({ animation: `${rise} .55s ${delay}s cubic-bezier(.2,.8,.2,1) both` });
const float = keyframes `0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); }`;
// The summary's ticker: the sentences enter at the reading end and run towards its start (to the right in Arabic: the RTL
// style plugin turns this leftward run around), two copies so it never jumps.
const ticker = keyframes `from { transform: translateX(0); } to { transform: translateX(-50%); }`;
/** The figures' banner, as the home page's: the navy gradient with its floating lights. */
export function Hero({ children }) {
    return (_jsxs(Box, { sx: {
            position: 'relative',
            overflow: 'hidden',
            borderRadius: `${tokens.radiusLg}px`,
            p: { xs: 2, md: 2.5 },
            mb: 1.75,
            color: '#fff',
            background: `linear-gradient(125deg, ${tokens.navy900} 0%, ${tokens.navy700} 45%, ${tokens.teal} 100%)`,
            boxShadow: tokens.shadowMd,
            animation: `${rise} .5s cubic-bezier(.2,.8,.2,1) both`,
        }, children: [_jsx(Box, { "aria-hidden": true, sx: { position: 'absolute', width: 340, height: 340, borderRadius: '50%', top: -160, insetInlineEnd: -80, background: 'radial-gradient(circle, rgba(43,195,225,.35), transparent 70%)', animation: `${float} 9s ease-in-out infinite` } }), _jsx(Box, { "aria-hidden": true, sx: { position: 'absolute', width: 220, height: 220, borderRadius: '50%', bottom: -120, insetInlineStart: '30%', background: 'radial-gradient(circle, rgba(255,255,255,.12), transparent 70%)', animation: `${float} 11s ease-in-out infinite reverse` } }), _jsx(Box, { sx: { position: 'relative', display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' } }, children: children })] }));
}
export const filling = (delay = 0) => ({ transformOrigin: 'left center', animation: `${fill} .9s ${delay}s cubic-bezier(.2,.8,.2,1) both` });
/**
 * A ticker sentence with its data in a colour of its own: the marked values (figures, names, months) and any other
 * number of the sentence, with the % that follows it.
 */
export function Marked({ text }) {
    const parts = text.split(/(⟦[^⟧]*⟧%?|\d[\d,.]*%?)/);
    return (_jsx(_Fragment, { children: parts.map((part, i) => i % 2 === 1 ? (_jsx(Box, { component: "bdi", sx: { color: '#C2410C', fontWeight: 800 }, children: part.replace(/[⟦⟧]/g, '') }, i)) : (part)) }));
}
/** Whether the device asks for less motion (then the ticker shows one sentence at a time). */
function useReducedMotion() {
    const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const change = () => setReduced(query.matches);
        query.addEventListener('change', change);
        return () => query.removeEventListener('change', change);
    }, []);
    return reduced;
}
/** A number counting up from zero when it shows (to two decimals for the millions and the rates). */
export function Count({ value, decimals = 0, format }) {
    const scale = 10 ** decimals;
    const shown = useCountUp(Math.round(value * scale)) / scale;
    return _jsx(_Fragment, { children: decimals ? shown.toFixed(decimals) : format(shown) });
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** The presets' periods, from today. */
export function presetRange(preset) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    switch (preset) {
        case 'last':
            return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
        case 'quarter': {
            const q = Math.floor(m / 3) * 3;
            return [iso(new Date(y, q, 1)), iso(new Date(y, q + 3, 0))];
        }
        case 'ytd':
            return [iso(new Date(y, 0, 1)), iso(new Date(y, m + 1, 0))];
        default:
            return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
    }
}
export const accents = {
    navy: tokens.navy700,
    teal: '#0e7c86',
    amber: '#d98a06',
    green: '#23a455',
    violet: '#7b5cd6',
    rose: '#e0607e',
};
export const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, minWidth: 0, transition: 'box-shadow .2s', '&:hover': { boxShadow: tokens.shadowMd } };
export function useFormat() {
    const { i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    return useMemo(() => {
        const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
        const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
        const locale = ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
        const month = new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' });
        const monthOnly = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
        const monthLong = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
        return {
            n: (v) => whole.format(v),
            c: (v) => compact.format(v),
            month: (key) => month.format(new Date(`${key}-01T00:00:00Z`)),
            monthName: (key) => monthOnly.format(new Date(`${key}-01T00:00:00Z`)),
            monthLong: (key) => monthLong.format(new Date(`${key}-01T00:00:00Z`)),
            day: (v) => v.slice(0, 10).replaceAll('-', '/'),
        };
    }, [ar]);
}
/** A figure's card: its value, the comparison with the period before (the colour follows the meaning), six months. */
export function Kpi({ label, icon, figure, value, unit, good = 'none', spark, note, money, index = 0, onClick }) {
    const { t } = useTranslation();
    const f = useFormat();
    const v = figure ? figure.value : (value ?? null);
    const p = figure?.previous ?? null;
    const diff = v !== null && p !== null ? v - p : null;
    const pct = diff !== null && p ? (diff / Math.abs(p)) * 100 : null;
    const tone = diff === null || diff === 0 || good === 'none' ? 'rgba(255,255,255,.8)' : (diff > 0) === (good === 'up') ? '#86EFAC' : '#FCA5A5';
    const shown = (n) => (money && Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}` : f.n(n));
    const points = unit === '%';
    const unitShown = money && v !== null && Math.abs(v) >= 1_000_000 ? t('exec.millionSar') : unit;
    const max = Math.max(1, ...(spark ?? []).map((x) => Math.abs(x ?? 0)));
    return (_jsxs(Box, { role: onClick ? 'button' : undefined, tabIndex: onClick ? 0 : undefined, onClick: onClick, onKeyDown: onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined, sx: {
            ...appear(0.1 + index * 0.06),
            cursor: onClick ? 'pointer' : 'default',
            '&:focus-visible': { outline: '2px solid #fff', outlineOffset: 2 },
            minWidth: 0,
            p: 1.75,
            borderRadius: '16px',
            bgcolor: 'rgba(255,255,255,.1)',
            border: '1px solid rgba(255,255,255,.16)',
            backdropFilter: 'blur(8px)',
            transition: 'background-color .2s, transform .2s',
            '&:hover': { bgcolor: 'rgba(255,255,255,.18)', transform: 'translateY(-2px)' },
        }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 0.5, opacity: 0.85, '& svg': { fontSize: 18 } }, children: [icon, _jsx(Typography, { noWrap: true, sx: { fontSize: 12.5 }, children: label })] }), _jsxs(Typography, { sx: { fontSize: 27, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }, children: [v === null ? (_jsx(Tooltip, { title: t('exec.unknown'), children: _jsx("span", { children: "\u2014" }) })) : (_jsx("bdi", { children: _jsx(Count, { value: money && Math.abs(v) >= 1_000_000 ? v / 1_000_000 : v, decimals: money && Math.abs(v) >= 1_000_000 ? 2 : points && !Number.isInteger(v) ? 1 : 0, format: f.n }) })), ' ', unitShown && _jsx(Box, { component: "span", sx: { fontSize: 12, fontWeight: 500, opacity: 0.75 }, children: unitShown })] }), _jsx(Typography, { sx: { fontSize: 11.5, fontWeight: 700, color: tone, minHeight: 17 }, children: diff !== null ? (_jsxs("bdi", { children: [diff > 0 ? '▲' : diff < 0 ? '▼' : '=', " ", points ? t('exec.points', { value: Math.abs(diff).toFixed(1) }) : pct !== null ? `${Math.abs(pct).toFixed(1)}%` : shown(Math.abs(diff)), " \u00B7", ' ', t('exec.previous', { value: points ? `${p}%` : money ? f.c(p) : f.n(p) })] })) : (note) }), diff !== null && note && _jsx(Typography, { sx: { fontSize: 11.5, opacity: 0.75 }, children: note }), spark && spark.length > 0 && (_jsx(Box, { "aria-hidden": true, sx: { display: 'flex', alignItems: 'flex-end', gap: '3px', height: 24, mt: 0.75 }, children: spark.map((x, i) => (_jsx(Box, { sx: { width: 9, height: `${Math.max(8, (Math.abs(x ?? 0) / max) * 100)}%`, borderRadius: '2px 2px 0 0', bgcolor: '#fff', opacity: i === spark.length - 1 ? 0.95 : 0.35, transformOrigin: 'bottom', animation: `${grow} .7s ${index * 0.06 + 0.25 + i * 0.05}s cubic-bezier(.2,.8,.2,1) both` } }, i))) }))] }));
}
export function CardTitle({ title, hint, icon, action }) {
    return (_jsxs(Stack, { direction: "row", sx: { gap: 1.25, alignItems: 'center', mb: 1.75 }, children: [icon && _jsx(Box, { sx: { display: 'grid', placeItems: 'center', flex: '0 0 auto', width: 36, height: 36, borderRadius: '11px', bgcolor: tokens.navy50, color: tokens.navy700, '& svg': { fontSize: 20 } }, children: icon }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontWeight: 800, fontSize: 15, color: tokens.navy800 }, children: title }), hint && _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: hint })] }), action] }));
}
export function Loading() {
    return (_jsxs(Stack, { sx: { gap: 1.5 }, children: [_jsx(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(6, 1fr)' } }, children: Array.from({ length: 6 }, (_, i) => (_jsx(Skeleton, { variant: "rounded", height: 118 }, i))) }), _jsx(Skeleton, { variant: "rounded", height: 110 }), _jsx(Skeleton, { variant: "rounded", height: 300 })] }));
}
/** A translated sentence whose values are marked, so the ticker shows them in their own colour. */
export function useMark() {
    const { t } = useTranslation();
    return (key, values) => t(key, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, `⟦${v}⟧`])));
}
/** The summary as a news ticker; with less motion asked by the device, one sentence at a time. */
export function Ticker({ lines }) {
    const { t } = useTranslation();
    const seconds = Math.max(28, lines.join(' ').length * 0.16);
    const calm = useReducedMotion();
    const [shown, setShown] = useState(0);
    useEffect(() => {
        if (!calm)
            return;
        const timer = window.setInterval(() => setShown((n) => n + 1), 5000);
        return () => window.clearInterval(timer);
    }, [calm]);
    const run = (copy) => (_jsx(Stack, { direction: "row", "aria-hidden": copy === 1 ? true : undefined, sx: { flex: '0 0 auto', alignItems: 'center' }, children: lines.map((l) => (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', flex: '0 0 auto' }, children: [_jsx(Typography, { component: "span", sx: { fontSize: 13.5, whiteSpace: 'nowrap', px: 2 }, children: _jsx(Marked, { text: l }) }), _jsx(Box, { component: "span", sx: { width: 6, height: 6, borderRadius: '50%', bgcolor: '#FCD34D', flex: '0 0 auto' } })] }, `${copy}-${l}`))) }));
    return (_jsxs(Box, { role: "region", "aria-label": t('exec.ins.title'), sx: { ...appear(0.3), display: 'flex', alignItems: 'stretch', overflow: 'hidden', bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, mb: 1.75, height: 48 }, children: [_jsxs(Stack, { direction: "row", sx: { flex: '0 0 auto', alignItems: 'center', gap: 1, px: 2, bgcolor: '#d98a06', color: '#fff', fontWeight: 800, fontSize: 13.5, '& svg': { fontSize: 20 } }, children: [_jsx(CampaignOutlinedIcon, {}), t('exec.ins.title')] }), _jsx(Box, { sx: {
                    position: 'relative',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    color: tokens.navy800,
                    maskImage: 'linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)',
                    '&:hover .ticker': { animationPlayState: 'paused' },
                }, children: calm ? (_jsx(Typography, { sx: { ...appear(0), fontSize: 13.5, px: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: _jsx(Marked, { text: lines[shown % lines.length] }) }, shown)) : (_jsxs(Box, { className: "ticker", sx: { display: 'flex', width: 'max-content', animation: `${ticker} ${seconds}s linear infinite` }, children: [run(0), run(1)] })) })] }));
}
export function Dot({ color, text }) {
    return (_jsxs(Stack, { direction: "row", sx: { gap: 0.75, alignItems: 'center' }, children: [_jsx(Box, { sx: { width: 10, height: 10, borderRadius: '3px', bgcolor: color, flex: '0 0 auto' } }), _jsx(Typography, { sx: { fontSize: 12.5 }, children: text })] }));
}
export function Legend({ items }) {
    return (_jsx(Stack, { direction: "row", sx: { gap: 2, mt: 1, flexWrap: 'wrap' }, children: items.map(([label, color]) => (_jsx(Dot, { color: color, text: label }, label))) }));
}
export function Empty() {
    const { t } = useTranslation();
    return _jsx(Typography, { sx: { fontSize: 13, color: tokens.gray500, py: 3, textAlign: 'center' }, children: t('exec.empty') });
}
/** Print the report alone: no menu, no top bar, no buttons. */
export function PrintStyles() {
    return _jsx(GlobalStyles, { styles: { '@media print': { aside: { display: 'none !important' }, header: { display: 'none !important' }, '.no-print': { display: 'none !important' }, body: { background: '#fff' } } } });
}
/** The chosen period: a preset (this month by default) or two dates. */
export function usePeriodChoice() {
    const [preset, setPreset] = useState('month');
    const [range, setRange] = useState(() => presetRange('month'));
    const choose = (p) => {
        setPreset(p);
        if (p !== 'custom')
            setRange(presetRange(p));
    };
    return { preset, from: range[0], to: range[1], choose, setRange };
}
/** The report's bar: its tabs, then the period presets (with what they are compared with) and print. */
export function ReportBar({ tabs, tab, onTab, choice, period, }) {
    const { t } = useTranslation();
    const { preset, from, to, choose, setRange } = choice;
    const presets = ['month', 'last', 'quarter', 'ytd', 'custom'];
    return (_jsxs(Stack, { direction: "row", className: "no-print", sx: { ...card, p: 0.75, gap: 0.5, mb: 1.75, flexWrap: 'wrap' }, role: "tablist", children: [tabs.map((k) => (_jsxs(ButtonBase, { role: "tab", "aria-selected": tab === k.key, onClick: () => onTab(k.key), sx: { gap: 1, px: 2, py: 1.1, borderRadius: '10px', fontWeight: 700, fontSize: 13.5, color: tab === k.key ? '#fff' : tokens.gray600, bgcolor: tab === k.key ? tokens.navy700 : 'transparent', '& svg': { fontSize: 19 } }, children: [k.icon, k.label] }, k.key))), _jsx(Box, { sx: { flex: 1 } }), _jsxs(Stack, { direction: "row", sx: { gap: 0.75, flexWrap: 'wrap', alignItems: 'center', px: 0.5 }, children: [presets.map((p) => (_jsx(Tooltip, { title: preset === p && period ? (_jsxs("bdi", { children: [t('exec.comparing', { from: period.from.replaceAll('-', '/'), to: period.to.replaceAll('-', '/'), pfrom: period.previousFrom.replaceAll('-', '/'), pto: period.previousTo.replaceAll('-', '/') }), period.movesPreviousTo !== period.previousTo && ` · ${t('exec.sameDays', { to: period.movesPreviousTo.replaceAll('-', '/') })}`] })) : (''), children: _jsx(Button, { size: "small", variant: preset === p ? 'contained' : 'outlined', onClick: () => choose(p), sx: { borderRadius: 999, px: 1.5, height: 32, ...(preset === p ? { bgcolor: tokens.navy800 } : { bgcolor: '#fff', borderColor: tokens.border, color: tokens.navy800 }) }, children: t(`exec.preset.${p}`) }) }, p))), preset === 'custom' && (_jsxs(_Fragment, { children: [_jsx(DateField, { size: "small", label: t('exec.from'), value: from, onChange: (e) => e.target.value && setRange([e.target.value, to]), slotProps: { inputLabel: { shrink: true } }, sx: { width: 150 } }), _jsx(DateField, { size: "small", label: t('exec.to'), value: to, onChange: (e) => e.target.value && setRange([from, e.target.value]), slotProps: { inputLabel: { shrink: true } }, sx: { width: 150 } })] })), _jsx(Tooltip, { title: t('exec.print'), children: _jsx(IconButton, { size: "small", onClick: () => window.print(), "aria-label": t('exec.print'), sx: { border: `1px solid ${tokens.border}`, width: 32, height: 32 }, children: _jsx(PrintOutlinedIcon, { fontSize: "small" }) }) })] })] }));
}
