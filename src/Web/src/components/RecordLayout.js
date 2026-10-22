import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Stack, Typography } from '@mui/material';
import { tokens } from '../app/theme';
// The billing bands begin behind the number: --band-angle turns them with the reading direction (set in the theme).
export const recordTones = {
    // Teal: workers going out to a project.
    delivery: { band: 'linear-gradient(120deg, #0b3954 0%, #0d6e8c 60%, #1aa39a 100%)', dark: 'linear-gradient(135deg, #0f4c6e, #13708f)', main: '#0d6e8c', soft: '#e3f3f9' },
    // Ocean to amber: a worker coming back to the housing.
    return: { band: 'linear-gradient(120deg, #124a69 0%, #1592c4 55%, #d08a1e 100%)', dark: 'linear-gradient(135deg, #124a69, #1785b3)', main: '#1580b0', soft: '#e4f2fa' },
    // Wine: a worker moving between projects.
    transfer: { band: 'linear-gradient(120deg, #4a0f2a 0%, #8a1d48 55%, #c4466f 100%)', dark: 'linear-gradient(135deg, #6b1538, #a32a5c)', main: '#a32a5c', soft: '#fbeaf1' },
    // Blue: a change in a worker's state.
    movement: { band: 'linear-gradient(120deg, #0f2f5c 0%, #1f5fbf 55%, #3b8be6 100%)', dark: 'linear-gradient(135deg, #163f7a, #2a6fd0)', main: '#2a6fd0', soft: '#e8f0fc' },
    // Billing (navy to teal), begun behind the number in gold: the month's attendance.
    timesheet: { band: 'linear-gradient(var(--band-angle, 240deg), #c9971c 0%, #8a6510 28%, #0a3b57 62%, #17a596 100%)', dark: 'linear-gradient(135deg, #7a5a0e, #a87c12)', main: '#a87c0e', soft: '#fbf3dc' },
    // Billing (navy to teal), begun behind the number in copper orange: the bill.
    invoice: { band: 'linear-gradient(var(--band-angle, 240deg), #b8650a 0%, #7a4106 28%, #0a3b57 62%, #17a596 100%)', dark: 'linear-gradient(135deg, #7a4106, #a85a0a)', main: '#b8650a', soft: '#fdf0e0' },
    // Billing (navy to teal), begun behind the number in emerald: money in.
    receipt: { band: 'linear-gradient(var(--band-angle, 240deg), #0d7a52 0%, #06503a 28%, #0a3b57 62%, #17a596 100%)', dark: 'linear-gradient(135deg, #06503a, #0b6e4b)', main: '#0d7a52', soft: '#e1f4ec' },
};
/** The band above a record: its icon, kind and number (large), its state, whom it is for (optional), and its actions. */
export function RecordHero({ icon, kind, number, status, title, subtitle, actions, tone = 'delivery', background, }) {
    return (_jsx(Box, { sx: {
            position: 'relative',
            overflow: 'hidden',
            mb: `${tokens.gap}px`,
            px: { xs: 2, md: 2.75 },
            py: 1.75,
            borderRadius: `${tokens.radiusLg}px`,
            color: '#fff',
            background: background ?? recordTones[tone].band,
            boxShadow: tokens.shadowSm,
            '&::after': { content: '""', position: 'absolute', width: 220, height: 220, borderRadius: '50%', top: -140, insetInlineEnd: -40, background: 'rgba(255,255,255,.07)' },
        }, children: _jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { position: 'relative', zIndex: 1, alignItems: { md: 'center' }, flexWrap: { md: 'wrap' }, gap: { xs: 1.5, md: 2.5 } }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.75, flex: '1 1 auto', minWidth: { md: 440 } }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 50, height: 50, borderRadius: '15px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.16)', '& svg': { fontSize: 27 } }, children: icon }), _jsxs(Box, { sx: { flex: '0 0 auto', ...(title ? { paddingInlineEnd: 2.5, borderInlineEnd: '1px solid rgba(255,255,255,.22)' } : {}) }, children: [_jsx(Typography, { sx: { fontSize: 12, opacity: 0.8 }, children: kind }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 23, fontWeight: 800, letterSpacing: '.5px', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', textAlign: 'start' }, children: number })] }), title ? (_jsxs(Box, { sx: { minWidth: 0 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, flexWrap: 'wrap' }, children: [_jsx(Typography, { component: "h1", sx: { fontSize: 17, fontWeight: 800, lineHeight: 1.35 }, children: title }), status] }), subtitle && _jsx(Typography, { sx: { fontSize: 12.5, opacity: 0.85 }, children: subtitle })] })) : (_jsx(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, flexWrap: 'wrap', alignSelf: 'flex-end', pb: 0.5 }, children: status }))] }), actions && (_jsx(Stack, { direction: "row", sx: {
                        flexWrap: 'wrap',
                        gap: 1,
                        alignItems: 'center',
                        '& .MuiButton-root': { color: '#fff', borderColor: 'rgba(255,255,255,.45)', bgcolor: 'rgba(255,255,255,.1)', '&:hover': { bgcolor: 'rgba(255,255,255,.2)', borderColor: '#fff' } },
                        '& .MuiButton-contained': { bgcolor: '#fff', color: tokens.navy800, '&:hover': { bgcolor: '#eef5f8' } },
                    }, children: actions }))] }) }));
}
/** The side summary card. */
export function SummaryCard({ children }) {
    return (_jsx(Box, { sx: {
            bgcolor: '#fff',
            borderRadius: `${tokens.radiusLg}px`,
            boxShadow: tokens.shadowSm,
            border: `1px solid ${tokens.gray100}`,
            overflow: 'hidden',
            position: { lg: 'sticky' },
            top: { lg: 84 },
        }, children: children }));
}
function initials(name) {
    return (name
        .split(/\s+/)
        .filter((part) => /\p{L}/u.test(part))
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || '·');
}
/** Who made the record and when, first in the summary. */
export function SummaryCreator({ label, name, at }) {
    return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.5, px: 2.5, py: 1.75, bgcolor: tokens.gray50 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: tokens.navy700, color: '#fff', fontSize: 14, fontWeight: 800 }, children: initials(name) }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: label }), _jsx(Typography, { sx: { fontSize: 14.5, fontWeight: 800, color: tokens.navy800 }, children: name }), at && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: at })] })] }));
}
/** The record's main fact (whom it is for, or its amount), large on a dark band, with short chips under it. */
export function SummaryBand({ label, value, unit, size = 30, chips, tone = 'delivery', background, }) {
    return (_jsxs(Box, { sx: { px: 2.5, py: 2, color: '#fff', background: background ?? recordTones[tone].dark }, children: [_jsx(Typography, { sx: { fontSize: 12, opacity: 0.85 }, children: label }), _jsxs(Typography, { sx: { fontSize: size, fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere' }, children: [value, unit && _jsx(Box, { component: "span", sx: { fontSize: 14, fontWeight: 600, opacity: 0.8, marginInlineStart: 0.75 }, children: unit })] }), chips && chips.length > 0 && (_jsx(Stack, { direction: "row", sx: { gap: 0.75, mt: 1, flexWrap: 'wrap' }, children: chips.map((chip) => (_jsx(Box, { sx: { px: 1.25, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 700, ...(chip.tone === 'gold' ? { bgcolor: '#fff3d6', color: '#a86d06' } : { bgcolor: 'rgba(255,255,255,.16)', color: '#fff' }) }, children: chip.label }, chip.label))) }))] }));
}
/** A group of the summary, under a colored heading. */
export function SummaryGroup({ title, color, children }) {
    return (_jsxs(Box, { sx: { px: 2.5, py: 1.75, borderTop: `1px solid ${tokens.gray100}` }, children: [_jsx(Typography, { sx: { fontSize: 12, fontWeight: 800, color, mb: 1 }, children: title }), _jsx(Stack, { spacing: 1.25, children: children })] }));
}
/** One fact: a tinted icon tile in the fact's color, the label, the value (and a line under it). */
export function SummaryFact({ icon, color, label, value, sub }) {
    return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 36, height: 36, borderRadius: '11px', display: 'grid', placeItems: 'center', bgcolor: `${color}1a`, color, '& svg': { fontSize: 19 } }, children: icon }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: label }), _jsx(Typography, { component: "div", sx: { fontSize: 14, fontWeight: 800, color: tokens.navy800, overflowWrap: 'anywhere' }, children: value }), sub && _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: sub })] })] }));
}
/** Two dates side by side in tinted boxes (e.g. delivery and start). */
export function SummaryDates({ items }) {
    return (_jsx(Box, { sx: { display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 1 }, children: items.map((item) => (_jsxs(Box, { sx: { p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: `${item.color}14` }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.5, color: item.color, '& svg': { fontSize: 16 } }, children: [item.icon, _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray600 }, children: item.label })] }), _jsx(Typography, { sx: { fontSize: 15, fontWeight: 800, color: item.color, mt: 0.25 }, children: item.value })] }, item.label))) }));
}
/** Free text at the end of the summary (notes, reasons). */
export function SummaryNote({ title, children }) {
    return (_jsxs(Box, { sx: { px: 2.5, py: 1.5, borderTop: `1px solid ${tokens.gray100}` }, children: [_jsx(Typography, { sx: { fontSize: 12, fontWeight: 800, color: tokens.gray500, mb: 0.5 }, children: title }), _jsx(Typography, { component: "div", sx: { fontSize: 12.5, color: tokens.gray600, lineHeight: 1.7 }, children: children })] }));
}
/** A card's heading: a small icon in the brand color and a bold title, with a thin rule under it. */
export function SectionTitle({ icon, title, extra }) {
    return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, pb: 1.25, mb: 1.5, borderBottom: `1px solid ${tokens.gray100}` }, children: [_jsx(Box, { sx: { display: 'grid', color: tokens.navy700, '& svg': { fontSize: 20 } }, children: icon }), _jsx(Typography, { sx: { fontSize: 15.5, fontWeight: 800, color: tokens.navy800, flex: 1 }, children: title }), extra] }));
}
