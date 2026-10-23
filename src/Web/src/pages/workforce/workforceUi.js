import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box } from '@mui/material';
/**
 * The workers list's design tokens (the user's proposal, 2026-10-23; docs/02-target-architecture/22): navy with a little
 * gold, white surfaces, neutral borders, and status colours that only mean a status. Local to the workers list, so no
 * other screen changes.
 */
export const wf = {
    navy: '#14263D',
    navyHover: '#203B5C',
    gold: '#C5A059',
    goldText: '#806020',
    goldSoft: '#F7F1E5',
    page: '#F5F7FA',
    surface: '#FFFFFF',
    subtle: '#EEF2F6',
    border: '#DDE3EB',
    text: '#182638',
    textSecondary: '#5D6B7C',
    rowHover: '#F1F5F9',
    success: { fg: '#16734B', bg: '#EAF6EF' },
    warning: { fg: '#8A5700', bg: '#FFF4DB' },
    danger: { fg: '#B42318', bg: '#FEECEB' },
    info: { fg: '#175CD3', bg: '#EFF5FF' },
    neutral: { fg: '#475569', bg: '#F1F5F9' },
    radius: '12px',
    control: '8px',
};
/**
 * What each status means, as a colour: at work is good, new and in housing are information, on vacation is a
 * notice, suspended and absconded need attention; a final exit is the normal end, not an error.
 */
export const placementTone = {
    Working: 'success',
    New: 'info',
    Housing: 'info',
    Vacation: 'warning',
    Suspended: 'danger',
    Exited: 'neutral',
    Absconded: 'danger',
    Other: 'neutral',
    Inactive: 'neutral',
};
export const toneOf = (placement) => wf[placementTone[placement]];
/** A white card with a light border (no coloured backgrounds, no heavy shadow). */
export const card = { bgcolor: wf.surface, border: `1px solid ${wf.border}`, borderRadius: wf.radius, boxShadow: '0 1px 2px rgba(20,38,61,.04)' };
/** A status as a small badge: a dot and the text (colour is never the only sign). */
export function StatusPill({ placement, children }) {
    const tone = toneOf(placement);
    return (_jsxs(Box, { component: "span", sx: { display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.1, py: 0.3, borderRadius: 999, fontSize: 12, fontWeight: 600, lineHeight: 1.4, whiteSpace: 'nowrap', color: tone.fg, bgcolor: tone.bg }, children: [_jsx(Box, { component: "span", "aria-hidden": true, sx: { width: 7, height: 7, borderRadius: '50%', bgcolor: tone.fg, flex: '0 0 auto' } }), children] }));
}
