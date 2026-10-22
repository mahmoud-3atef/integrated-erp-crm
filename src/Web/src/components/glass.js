import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Stack, Typography } from '@mui/material';
const tints = {
    list: 'radial-gradient(500px 260px at 15% 0%, rgba(56,189,248,.35), transparent 60%), radial-gradient(420px 260px at 90% 120%, rgba(20,184,166,.35), transparent 60%), linear-gradient(135deg, #082B49 0%, #0d4a6c 55%, #0e7c86 100%)',
    detail: 'radial-gradient(500px 260px at 15% 0%, rgba(56,189,248,.3), transparent 60%), radial-gradient(420px 260px at 90% 120%, rgba(124,58,237,.38), transparent 60%), linear-gradient(135deg, #082B49 0%, #1e3a8a 55%, #4338ca 100%)',
};
/** A glass card on the strip. */
export const glassOnDark = {
    bgcolor: 'rgba(255,255,255,.1)',
    border: '1px solid rgba(255,255,255,.22)',
    borderRadius: '16px',
    backdropFilter: 'blur(10px) saturate(140%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
};
/** A frosted light card for the content. */
export const glassPanel = {
    bgcolor: 'rgba(255,255,255,.78)',
    border: '1px solid rgba(255,255,255,.9)',
    borderRadius: '16px',
    backdropFilter: 'blur(14px) saturate(160%)',
    boxShadow: '0 10px 30px rgba(15,39,71,.08), inset 0 1px 0 #fff',
};
/** A light button on the strip (outlined; `solid` for the main action). */
export const glassButton = (solid = false) => solid
    ? { bgcolor: '#fff', color: '#082B49', borderColor: '#fff', '&:hover': { bgcolor: '#eef4ff', borderColor: '#fff' } }
    : { color: '#fff', borderColor: 'rgba(255,255,255,.4)', bgcolor: 'rgba(255,255,255,.08)', backdropFilter: 'blur(8px)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.16)' } };
export function GlassHero({ tint, overline, title, chip, subtitle, actions, children }) {
    return (_jsxs(Box, { component: "header", sx: { borderRadius: '20px', p: { xs: 2, md: '20px 22px' }, mb: 2, color: '#fff', background: tints[tint], position: 'relative', overflow: 'hidden' }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { justifyContent: 'space-between', alignItems: { md: 'flex-start' }, gap: 1.5 }, children: [_jsxs(Box, { sx: { minWidth: 0 }, children: [overline && _jsx(Typography, { sx: { fontSize: 12, opacity: 0.75 }, children: overline }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.25 }, children: [_jsx(Typography, { component: "h1", sx: { fontSize: 22, fontWeight: 700, lineHeight: 1.35 }, children: title }), chip] }), subtitle && _jsx(Typography, { component: "div", sx: { fontSize: 12.5, opacity: 0.82, mt: 0.25 }, children: subtitle })] }), actions && _jsx(Stack, { direction: "row", sx: { gap: 1, flexWrap: 'wrap', flex: '0 0 auto' }, children: actions })] }), children] }));
}
/** A chip on the strip (the status). */
export function GlassChip({ children }) {
    return (_jsx(Box, { component: "span", sx: { display: 'inline-flex', alignItems: 'center', gap: 0.5, borderRadius: 99, px: 1.25, py: 0.25, fontSize: 12, fontWeight: 700, bgcolor: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.3)' }, children: children }));
}
export function GlassKpi({ icon, label, value, hint }) {
    return (_jsxs(Box, { sx: { ...glassOnDark, p: '14px 16px', display: 'flex', gap: 1.5, alignItems: 'flex-start', justifyContent: 'space-between', minWidth: 0 }, children: [_jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, opacity: 0.82 }, children: label }), _jsx(Typography, { component: "div", sx: { fontSize: 26, fontWeight: 700, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }, children: value }), hint && _jsx(Typography, { component: "div", sx: { fontSize: 11.5, opacity: 0.75 }, children: hint })] }), _jsx(Box, { "aria-hidden": true, sx: { flex: '0 0 auto', width: 38, height: 38, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.14)', '& svg': { fontSize: 20 } }, children: icon })] }));
}
export function GlassFact({ label, children }) {
    return (_jsxs(Box, { sx: { ...glassOnDark, px: 1.5, py: 1.25, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 11.5, opacity: 0.75 }, children: label }), _jsx(Typography, { component: "div", sx: { fontSize: 13.5, fontWeight: 700, overflowWrap: 'anywhere' }, children: children })] }));
}
/** The strip's row of KPIs (or facts), four on a wide screen. */
export function GlassRow({ children, columns = 4 }) {
    return _jsx(Box, { sx: { display: 'grid', gap: 1.5, mt: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: `repeat(${columns}, minmax(0, 1fr))` } }, children: children });
}
