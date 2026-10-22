import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CloseIcon from '@mui/icons-material/Close';
import { Box, Drawer, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
// The HR design system (docs/02-target-architecture/15): its tokens apply inside HR screens only — the blue primary,
// the light canvas, white cards of radius 12 — and its shared parts: the page header, the KPI cards, the status
// badge, the details drawer and the empty state.
export const hr = {
    navy: '#082B49',
    primary: '#2563EB',
    primaryDark: '#1D4ED8',
    canvas: '#F6F8FC',
    surface: '#FFFFFF',
    muted: '#F1F5F9',
    border: '#E2E8F0',
    text: '#0F2747',
    textMuted: '#64748B',
    success: '#059669',
    warning: '#D97706',
    danger: '#DC2626',
    violet: '#7C3AED',
    radius: 12,
    shadow: '0 2px 12px rgba(15,39,71,.05)',
};
/** KPI accents: pastel tint, icon and spark colour. */
export const hrAccents = {
    violet: { tint: '#F5F3FF', main: '#7C3AED', soft: '#E9D5FF' },
    blue: { tint: '#EFF6FF', main: '#2563EB', soft: '#BFDBFE' },
    green: { tint: '#ECFDF5', main: '#059669', soft: '#A7F3D0' },
    amber: { tint: '#FFFBEB', main: '#D97706', soft: '#FDE68A' },
    rose: { tint: '#FFF1F2', main: '#E11D48', soft: '#FECDD3' },
};
/** HR screens: the blue primary and the 12px cards, without changing the rest of the app. */
export function HrScope({ children }) {
    return (_jsx(ThemeProvider, { theme: (outer) => ({
            ...outer,
            palette: { ...outer.palette, primary: { ...outer.palette.primary, main: hr.primary, dark: hr.primaryDark, light: '#60A5FA', contrastText: '#fff' } },
            components: {
                ...outer.components,
                // Light grid heads and plain rows (the HR grid), instead of the app's navy heads and striped rows.
                MuiTableHead: {
                    styleOverrides: {
                        root: {
                            '& .MuiTableCell-head': { backgroundColor: hr.muted, color: '#475569', fontWeight: 600, fontSize: 12, lineHeight: 1.25, paddingBlock: 8, whiteSpace: 'normal', borderBottom: `1px solid ${hr.border}` },
                        },
                    },
                },
                MuiTableBody: {
                    styleOverrides: {
                        root: {
                            '& .MuiTableCell-body': { backgroundColor: '#fff', color: hr.text },
                            '& .MuiTableRow-hover:hover .MuiTableCell-body': { backgroundColor: '#F5F8FF' },
                        },
                    },
                },
            },
        }), children: _jsx(Box, { sx: { color: hr.text, '& .MuiButton-root': { borderRadius: '8px' } }, children: children }) }));
}
export const hrCard = { bgcolor: hr.surface, border: `1px solid ${hr.border}`, borderRadius: `${hr.radius}px`, boxShadow: hr.shadow };
/** The page's header: icon, title with its state and reference, the description, and the actions (one primary). */
export function HrPageHeader({ icon, title, status, reference, subtitle, period, actions }) {
    return (_jsxs(Stack, { direction: { xs: 'column', lg: 'row' }, sx: { gap: 1.5, alignItems: { lg: 'center' }, mb: 1.75 }, children: [_jsxs(Stack, { direction: "row", sx: { gap: 1.5, alignItems: 'center', flex: 1, minWidth: 0 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 46, height: 46, borderRadius: '12px', bgcolor: '#DBEAFE', color: hr.primary, display: 'grid', placeItems: 'center', '& svg': { fontSize: 24 } }, children: icon }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsxs(Stack, { direction: "row", sx: { gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx(Typography, { component: "h1", sx: { fontSize: 23, fontWeight: 700, color: hr.text, lineHeight: 1.3 }, children: title }), status, reference && (_jsx(Typography, { component: "bdi", sx: { fontSize: 12.5, fontWeight: 600, color: hr.textMuted, fontVariantNumeric: 'tabular-nums' }, children: reference }))] }), subtitle && _jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: subtitle })] })] }), _jsxs(Stack, { direction: "row", sx: { gap: 1, flexWrap: 'wrap', alignItems: 'center' }, children: [period, actions] })] }));
}
/** A status as a pill with a dot (colour is never the only signal: the label says it). */
export function HrStatusBadge({ label, color, tint }) {
    return (_jsxs(Box, { component: "span", sx: { display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.25, py: 0.25, borderRadius: 99, bgcolor: tint, color, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }, children: [_jsx(Box, { component: "span", sx: { width: 6, height: 6, borderRadius: '50%', bgcolor: color } }), label] }));
}
const money = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
/**
 * A payroll KPI: the label and value with its unit, mini bars of the past runs (the last is this one), the change
 * against the previous run named, and the previous value with the difference. Unknown ⇒ «—» with a reason.
 */
export function HrKpiCard({ label, value, unit, icon, accent, trend, previous, comparisonLabel, loading }) {
    const { t } = useTranslation();
    const a = hrAccents[accent];
    const delta = value !== null && previous !== null ? value - previous : null;
    const percent = delta !== null && previous ? (delta / previous) * 100 : null;
    const max = Math.max(...trend.map(Math.abs), 1);
    const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '');
    return (_jsxs(Box, { sx: { ...hrCard, bgcolor: a.tint, p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }, children: [_jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600, color: '#334155' }, children: label }), loading ? (_jsx(Skeleton, { width: 120, height: 36 })) : (_jsxs(Typography, { sx: { fontSize: 22, fontWeight: 700, lineHeight: 1.25, color: hr.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }, children: [value === null ? '—' : money(value), " ", _jsx(Box, { component: "span", sx: { fontSize: 12, fontWeight: 500, color: hr.textMuted }, children: unit })] }))] }), _jsx(Box, { sx: { flex: '0 0 auto', width: 38, height: 38, borderRadius: '50%', bgcolor: '#fff', color: a.main, display: 'grid', placeItems: 'center', '& svg': { fontSize: 19 } }, children: icon })] }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'flex-end', gap: 1 }, children: [_jsx(Box, { role: "img", "aria-label": t('hr.trendLabel', { values: trend.map(money).join('، ') }), sx: { display: 'flex', alignItems: 'flex-end', gap: '3px', height: 34 }, children: trend.map((v, i) => (_jsx(Box, { sx: { width: 9, height: Math.max(3, (Math.abs(v) / max) * 34), borderRadius: '2px 2px 0 0', bgcolor: i === trend.length - 1 ? a.main : a.soft } }, i))) }), _jsx(Tooltip, { title: comparisonLabel ? '' : t('hr.noComparison'), children: _jsxs(Box, { sx: { textAlign: 'end' }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: '#334155', fontVariantNumeric: 'tabular-nums' }, children: percent === null ? '—' : _jsx("bdi", { children: `${sign(percent)}${Math.abs(percent).toFixed(1)}%` }) }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: comparisonLabel ? t('hr.comparedWith', { period: comparisonLabel }) : t('hr.noComparisonShort') })] }) })] }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', borderTop: '1px dashed rgba(15,39,71,.12)', pt: 0.75, fontSize: 11.5, color: hr.textMuted }, children: [_jsxs("span", { children: [t('hr.previous'), _jsx(Box, { component: "b", sx: { display: 'block', color: hr.text, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }, children: previous === null ? '—' : money(previous) })] }), _jsxs("span", { style: { textAlign: 'end' }, children: [t('hr.difference'), _jsx(Box, { component: "b", sx: { display: 'block', color: hr.text, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }, children: delta === null ? '—' : _jsx("bdi", { children: `${sign(delta)}${money(Math.abs(delta))}` }) })] })] })] }));
}
/** The coverage card: who is in the run out of who could be, as a donut (only when both are known) and by reason. */
export function HrCoverageCard({ label, value, unit, of, parts, loading }) {
    const a = hrAccents.violet;
    const eligible = value + parts.slice(1).reduce((s, p) => s + p.value, 0);
    const share = eligible > 0 ? Math.round((value / eligible) * 100) : null;
    return (_jsxs(Box, { sx: { ...hrCard, bgcolor: a.tint, p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 1 }, children: [_jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600, color: '#334155' }, children: label }), loading ? (_jsx(Skeleton, { width: 90, height: 36 })) : (_jsxs(Typography, { sx: { fontSize: 22, fontWeight: 700, lineHeight: 1.25, color: hr.text, fontVariantNumeric: 'tabular-nums' }, children: [value.toLocaleString('en-US'), " ", _jsx(Box, { component: "span", sx: { fontSize: 12, fontWeight: 500, color: hr.textMuted }, children: unit })] })), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: of })] }), share !== null && (_jsx(Box, { role: "img", "aria-label": `${share}%`, sx: { flex: '0 0 auto', width: 64, height: 64, borderRadius: '50%', background: `conic-gradient(${a.main} 0 ${share}%, ${a.soft} ${share}% 100%)`, display: 'grid', placeItems: 'center' }, children: _jsx(Box, { sx: { width: 46, height: 46, borderRadius: '50%', bgcolor: a.tint, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: a.main }, children: _jsxs("bdi", { children: [share, "%"] }) }) }))] }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: 1, rowGap: 0.5, borderTop: '1px dashed rgba(15,39,71,.12)', pt: 0.75, fontSize: 11.5, color: hr.textMuted }, children: parts.map((p) => (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 0.5 }, children: [_jsx("span", { children: p.label }), _jsx(Box, { component: "b", sx: { color: hr.text, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }, children: p.value.toLocaleString('en-US') })] }, p.label))) })] }));
}
/** The record drawer: opens from the reading start side, one at a time, focus back to what opened it on close. */
export function HrDrawer({ open, onClose, title, subtitle, avatar, children, width = 500 }) {
    const { t } = useTranslation();
    return (_jsxs(Drawer
    // MUI mirrors the anchor in RTL: "left" is the reading start side in both directions.
    , { 
        // MUI mirrors the anchor in RTL: "left" is the reading start side in both directions.
        anchor: "left", open: open, onClose: onClose, slotProps: { paper: { sx: { width: { xs: '100%', sm: width }, p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.75, bgcolor: '#fff' } } }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.5 }, children: [avatar, _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 17, fontWeight: 700, color: hr.text }, children: title }), subtitle && _jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: subtitle })] }), _jsx(IconButton, { "aria-label": t('common.close'), onClick: onClose, sx: { border: `1px solid ${hr.border}`, borderRadius: '8px' }, children: _jsx(CloseIcon, { fontSize: "small" }) })] }), children] }));
}
/** Initials in a soft circle, its colour from the name (the HR lists' avatar). */
const avatarColours = [
    ['#DBEAFE', '#1D4ED8'],
    ['#EDE9FE', '#6D28D9'],
    ['#DCFCE7', '#15803D'],
    ['#FEE2E2', '#B91C1C'],
    ['#FFEDD5', '#C2410C'],
    ['#CFFAFE', '#0E7490'],
];
export function HrAvatar({ name, size = 30 }) {
    const words = name.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/);
    const initials = ((words[0]?.[0] ?? '') + (words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '')).toUpperCase();
    const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const [bg, fg] = avatarColours[hash % avatarColours.length] ?? avatarColours[0];
    return (_jsx(Box, { component: "span", "aria-hidden": true, sx: { flex: '0 0 auto', width: size, height: size, borderRadius: '50%', bgcolor: bg, color: fg, display: 'inline-grid', placeItems: 'center', fontSize: size * 0.38, fontWeight: 700 }, children: initials }));
}
export function HrEmptyState({ icon, title, hint, action }) {
    return (_jsxs(Stack, { sx: { alignItems: 'center', textAlign: 'center', gap: 1, py: 6, color: hr.textMuted, '& > svg': { fontSize: 40, color: '#CBD5E1' } }, children: [icon, _jsx(Typography, { sx: { fontWeight: 700, color: hr.text }, children: title }), hint && _jsx(Typography, { sx: { fontSize: 13, maxWidth: 420 }, children: hint }), action] }));
}
