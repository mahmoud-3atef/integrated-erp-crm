import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, ButtonBase, Typography } from '@mui/material';
import { tokens } from '../app/theme';
/**
 * The old portal's KPI card (.cp-kpi): a round icon sitting on the top edge, the label and number, and a footer
 * line. Clickable as a filter when <paramref name="onClick"/> is given.
 */
export function KpiCard({ label, value, foot, icon, tone, active, onClick, }) {
    return (_jsxs(ButtonBase, { disabled: !onClick, onClick: onClick, sx: {
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            textAlign: 'start',
            bgcolor: '#fff',
            borderRadius: `${tokens.radius}px`,
            boxShadow: active ? `0 0 0 2px ${tone}, ${tokens.shadowMd}` : tokens.shadowSm,
            transition: 'box-shadow .15s, transform .15s',
            '&:hover': onClick ? { boxShadow: tokens.shadowMd, transform: 'translateY(-2px)' } : undefined,
            '&.Mui-disabled': { color: 'inherit' },
        }, children: [_jsx(Box, { "aria-hidden": true, sx: {
                    position: 'absolute',
                    top: -22,
                    insetInlineStart: 14,
                    display: 'grid',
                    placeItems: 'center',
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    bgcolor: tone,
                    color: '#fff',
                    boxShadow: `0 0 0 4px ${tokens.bg}, 0 6px 14px rgba(13, 74, 108, .22)`,
                    '& svg': { fontSize: 22 },
                }, children: icon }), _jsxs(Box, { sx: { p: '12px 16px', textAlign: 'end' }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: label }), _jsx(Typography, { component: "div", sx: { fontSize: 24, fontWeight: 700, lineHeight: 1.25, color: tokens.navy800, fontVariantNumeric: 'tabular-nums' }, children: value })] }), _jsx(Box, { sx: { mt: 'auto', px: 2, py: 1.25, borderTop: `1px solid ${tokens.border}`, fontSize: 12.5, color: active ? tone : tokens.gray600, fontWeight: active ? 700 : 400 }, children: foot })] }));
}
/** The cards' grid: room above for the round icons. */
export function KpiGrid({ count, children }) {
    return (_jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: `repeat(${count}, 1fr)` }, gap: `${tokens.gap}px`, pt: '22px', mb: `${tokens.gap}px` }, children: children }));
}
