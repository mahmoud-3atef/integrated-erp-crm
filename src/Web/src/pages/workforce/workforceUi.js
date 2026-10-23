import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { Box, ButtonBase, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
/**
 * The workers pages' design tokens (the user's proposal, 2026-10-23; docs/02-target-architecture/22): navy with a little
 * gold, white surfaces, neutral borders, and status colours that only mean a status. Local to the workers list and
 * file, so no other screen changes.
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
/** Copies a code or a number (only in this browser; nothing is sent). */
export function CopyButton({ value, label }) {
    const { t } = useTranslation();
    const [done, setDone] = useState(false);
    if (typeof navigator === 'undefined' || !navigator.clipboard)
        return null;
    return (_jsx(Tooltip, { title: done ? t('workforce.ui.copied') : t('workforce.ui.copy', { what: label }), children: _jsx(IconButton, { size: "small", "aria-label": t('workforce.ui.copy', { what: label }), onClick: () => void navigator.clipboard.writeText(value).then(() => {
                setDone(true);
                window.setTimeout(() => setDone(false), 1500);
            }), sx: { p: 0.25, color: wf.textSecondary, '& svg': { fontSize: 15 } }, children: done ? _jsx(CheckIcon, {}) : _jsx(ContentCopyOutlinedIcon, {}) }) }));
}
/** Underlined tabs (44px, a gold line under the current one, counts beside), scrolling sideways on small screens. */
export function UnderlineTabs({ value, onChange, options, label }) {
    return (_jsx(Box, { role: "tablist", "aria-label": label, sx: { display: 'flex', gap: 0.5, overflowX: 'auto', scrollbarWidth: 'none', borderBottom: `1px solid ${wf.border}`, px: 1 }, onKeyDown: (e) => {
            const at = options.findIndex((o) => o.value === value);
            const step = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
            if (!step)
                return;
            e.preventDefault();
            // Logical: the next tab is on the left in Arabic and on the right in English.
            const dir = document.dir === 'rtl' ? step : -step;
            const next = options[(at + dir + options.length) % options.length];
            if (next)
                onChange(next.value);
        }, children: options.map((o) => {
            const active = o.value === value;
            return (_jsxs(ButtonBase, { role: "tab", "aria-selected": active, tabIndex: active ? 0 : -1, onClick: () => onChange(o.value), sx: {
                    flex: '0 0 auto',
                    height: 44,
                    px: 1.75,
                    gap: 0.75,
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    color: active ? wf.navy : wf.textSecondary,
                    borderBottom: `2px solid ${active ? wf.gold : 'transparent'}`,
                    mb: '-1px',
                    transition: 'color 150ms, border-color 150ms',
                    '&:hover': { color: wf.navy },
                    '&:focus-visible': { outline: `2px solid ${wf.gold}`, outlineOffset: -2, borderRadius: '6px' },
                }, children: [o.label, o.count !== undefined && (_jsx(Box, { component: "span", sx: { minWidth: 20, px: 0.6, borderRadius: 999, fontSize: 11.5, fontWeight: 600, bgcolor: active ? wf.goldSoft : wf.subtle, color: active ? wf.goldText : wf.textSecondary, fontVariantNumeric: 'tabular-nums' }, children: o.count }))] }, o.value));
        }) }));
}
/** A data section: a navy title (with a small icon) and its rows, in a white card. */
export function Section({ title, icon, children }) {
    return (_jsxs(Box, { component: "section", sx: { ...card, p: { xs: 2, md: 2.5 } }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25, mb: 1.25 }, children: [_jsx(Box, { "aria-hidden": true, sx: { width: 32, height: 32, borderRadius: wf.control, display: 'grid', placeItems: 'center', bgcolor: wf.subtle, color: wf.navy, '& svg': { fontSize: 18 } }, children: icon }), _jsx(Typography, { component: "h3", sx: { fontSize: 16, fontWeight: 600, color: wf.navy }, children: title })] }), _jsx(Box, { component: "dl", sx: { m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, columnGap: 3 }, children: children })] }));
}
/** One value of a section: a small label, then the value; `highlight` for the one that matters most (e.g. the total). */
export function Row({ label, children, wide, highlight }) {
    return (_jsxs(Box, { sx: {
            gridColumn: wide || highlight ? '1 / -1' : undefined,
            py: 1,
            px: highlight ? 1.5 : 0,
            mt: highlight ? 1 : 0,
            borderBottom: highlight ? 0 : `1px solid ${wf.subtle}`,
            borderRadius: highlight ? wf.control : 0,
            bgcolor: highlight ? wf.goldSoft : 'transparent',
            borderInlineStart: highlight ? `3px solid ${wf.gold}` : 0,
            display: highlight ? 'flex' : 'block',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 2,
            minWidth: 0,
        }, children: [_jsx(Typography, { component: "dt", sx: { fontSize: highlight ? 14 : 12.5, fontWeight: highlight ? 600 : 400, color: highlight ? wf.navy : wf.textSecondary }, children: label }), _jsx(Box, { component: "dd", sx: { m: 0, mt: highlight ? 0 : 0.25, fontSize: highlight ? 17 : 14, fontWeight: 600, color: wf.text, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }, children: children })] }));
}
/** A value that is not recorded: said in words (never shown as 0). */
export function NotRecorded() {
    const { t } = useTranslation();
    return (_jsx(Box, { component: "span", sx: { color: wf.textSecondary, fontWeight: 400 }, children: t('workforce.ui.notRecorded') }));
}
