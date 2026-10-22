import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Typography } from '@mui/material';
import { tokens } from '../app/theme';
const sectionTones = {
    teal: { border: tokens.teal, icon: tokens.navy700, soft: tokens.navy50 },
    green: { border: '#1f9d55', icon: '#1f9d55', soft: '#e9f7ef' },
    sky: { border: tokens.info, icon: tokens.info, soft: '#e6f5fb' },
    gold: { border: tokens.gold, icon: tokens.gold, soft: '#fbf4dc' },
};
/**
 * A titled group of fields as in the portal's forms (.cp-sections fieldset.cp-box): a coloured border with the title
 * and an icon square sitting on it, and the fields in two columns.
 */
export function FieldSection({ title, icon, tone = 'teal', columns = 2, children }) {
    const look = sectionTones[tone];
    return (_jsxs(Box, { component: "fieldset", sx: { m: 0, minWidth: 0, border: `1.5px solid ${look.border}`, borderRadius: `${tokens.radiusLg}px`, p: '20px 18px 14px', bgcolor: '#fff' }, children: [_jsxs(Box, { component: "legend", sx: { display: 'flex', alignItems: 'center', gap: 1, px: 1, mx: 0.5 }, children: [_jsx(Box, { "aria-hidden": true, sx: { display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: '8px', bgcolor: look.icon, color: '#fff', '& svg': { fontSize: 17 } }, children: icon }), _jsx(Typography, { component: "span", sx: { fontWeight: 800, fontSize: 14.5, color: tokens.navy800 }, children: title })] }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: columns === 2 ? '1fr 1fr' : '1fr' }, gap: '14px 18px' }, children: children })] }));
}
/**
 * One field as in the portal (.cp-sec-field): an icon square, a small grey label, and the value in a soft box.
 * <paramref name="wide"/> spans both columns; <paramref name="highlight"/> is for totals (larger, tinted).
 */
export function FieldBox({ label, icon, children, wide, highlight, multiline, required, input }) {
    return (_jsxs(Box, { sx: { display: 'flex', gap: 1.25, alignItems: 'flex-start', gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }, children: [_jsx(Box, { "aria-hidden": true, sx: { flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 34, height: 34, mt: '18px', borderRadius: '10px', bgcolor: tokens.navy50, color: tokens.navy700, '& svg': { fontSize: 18 } }, children: icon }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsxs(Typography, { component: input ? 'label' : 'p', sx: { display: 'block', fontSize: 11.5, color: '#7b8a98', fontWeight: 600, mb: 0.5 }, children: [label, required && _jsx(Box, { component: "span", sx: { color: tokens.danger }, children: " *" })] }), input ? (_jsx(Box, { sx: inputLook, children: children })) : (_jsx(Box, { sx: {
                            minHeight: 38,
                            display: 'flex',
                            alignItems: multiline ? 'flex-start' : 'center',
                            px: 1.5,
                            py: 0.9,
                            border: '1px solid #e1e8ee',
                            borderRadius: '10px',
                            bgcolor: highlight ? '#e9f7ef' : '#f6f8fa',
                            color: highlight ? '#1f9d55' : tokens.navy800,
                            fontSize: highlight ? 18 : 14,
                            fontWeight: 700,
                            whiteSpace: multiline ? 'pre-wrap' : undefined,
                            lineHeight: multiline ? 1.8 : 1.4,
                            wordBreak: 'break-word',
                        }, children: children }))] })] }));
}
// An editable field keeps the look of a value box (soft background, light border, radius 10).
const inputLook = {
    '& .MuiInputBase-root': { bgcolor: '#f6f8fa', borderRadius: '10px', fontSize: 14, fontWeight: 600, color: tokens.navy800 },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e1e8ee' },
    '& .MuiInputBase-input': { py: 1 },
    '& .MuiInputBase-multiline': { py: 1 },
    '& .MuiInputBase-inputMultiline': { py: 0 },
};
