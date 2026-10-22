import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { keyframes } from '@emotion/react';
import { Box, Button, ButtonBase, Dialog, IconButton, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { tokens } from '../app/theme';
import { ErrorMessage } from '../auth/AuthLayout';
import { recordTones } from './RecordLayout';
const pop = keyframes `
  0% { opacity: 0; transform: translateY(18px) scale(.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;
const enter = keyframes `
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
`;
const tick = keyframes `
  0% { transform: scale(.4); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
`;
/**
 * Creating a record as a guided popup: a band in the record's color with what is being made, the steps across the top
 * (a finished step gets a check and can be reopened), the current step's form, a live summary beside it, and the
 * buttons to go back, on, or send.
 */
export function WizardDialog({ tone, icon, title, subtitle, steps, step, onStep, canNext, onClose, onFinish, finishLabel, busy, error, aside, children, look: lookOverride, canReach, done, }) {
    const { t, i18n } = useTranslation();
    const rtl = i18n.dir() === 'rtl';
    const theme = useTheme();
    const phone = useMediaQuery(theme.breakpoints.down('md'));
    const look = lookOverride ?? recordTones[tone];
    const last = step === steps.length - 1;
    const next = steps[step + 1];
    return (_jsxs(Dialog, { open: true, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "xl", fullScreen: phone, slotProps: { paper: { sx: { maxWidth: phone ? undefined : 1320, borderRadius: phone ? 0 : '22px', overflow: 'hidden', bgcolor: tokens.gray50, display: 'flex', flexDirection: 'column', maxHeight: phone ? '100%' : 'calc(100% - 48px)', animation: `${pop} .35s cubic-bezier(.2,.8,.2,1) both` } } }, children: [_jsx(Box, { sx: {
                    position: 'relative',
                    overflow: 'hidden',
                    flexShrink: 0,
                    px: { xs: 2.5, md: 3.5 },
                    py: 2,
                    color: '#fff',
                    background: look.band,
                    '&::after': { content: '""', position: 'absolute', width: 240, height: 240, borderRadius: '50%', top: -150, insetInlineEnd: -50, background: 'rgba(255,255,255,.08)' },
                }, children: _jsxs(Stack, { direction: "row", sx: { position: 'relative', zIndex: 1, alignItems: 'center', gap: 1.75 }, children: [_jsx(Box, { sx: { width: 46, height: 46, borderRadius: '14px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.18)', '& svg': { fontSize: 25 } }, children: icon }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 18.5, fontWeight: 800 }, children: title }), subtitle && _jsx(Typography, { sx: { fontSize: 13, opacity: 0.88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: subtitle })] }), _jsx(IconButton, { onClick: onClose, disabled: busy, "aria-label": t('common.close'), sx: { color: '#fff', bgcolor: 'rgba(255,255,255,.14)', '&:hover': { bgcolor: 'rgba(255,255,255,.26)' } }, children: _jsx(CloseIcon, {}) })] }) }), done ? (_jsx(Box, { sx: { flex: 1, minHeight: 0, overflowY: 'auto', p: { xs: 2, md: 3 } }, children: done })) : (_jsxs(_Fragment, { children: [steps.length > 1 && (_jsx(Box, { sx: { flexShrink: 0, bgcolor: '#fff', borderBottom: `1px solid ${tokens.gray100}`, px: { xs: 1.5, md: 3.5 }, py: 1.75 }, children: _jsx(Stack, { component: "ol", direction: "row", sx: { listStyle: 'none', m: 0, p: 0, alignItems: 'flex-start' }, children: steps.map((s, index) => {
                                const finished = index < step;
                                const current = index === step;
                                return (_jsxs(Box, { component: "li", sx: { flex: 1, position: 'relative', textAlign: 'center', minWidth: 0 }, children: [index > 0 && (_jsx(Box, { "aria-hidden": true, sx: {
                                                position: 'absolute',
                                                top: 16,
                                                insetInlineStart: 'calc(-50% + 22px)',
                                                insetInlineEnd: 'calc(50% + 22px)',
                                                height: 3,
                                                borderRadius: 3,
                                                bgcolor: tokens.gray100,
                                                overflow: 'hidden',
                                                '&::after': { content: '""', position: 'absolute', inset: 0, background: look.main, transformOrigin: rtl ? 'right' : 'left', transform: `scaleX(${index <= step ? 1 : 0})`, transition: 'transform .45s ease' },
                                            } })), _jsxs(ButtonBase, { disabled: !finished || busy || (canReach ? !canReach(index) : false), onClick: () => onStep(index), "aria-current": current ? 'step' : undefined, sx: { flexDirection: 'column', gap: 0.6, borderRadius: '12px', px: 1, py: 0.25, maxWidth: '100%', '&:hover .wiz-dot': finished ? { boxShadow: `0 0 0 5px ${look.soft}` } : {} }, children: [_jsx(Box, { className: "wiz-dot", sx: {
                                                        width: 34,
                                                        height: 34,
                                                        borderRadius: '50%',
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        fontSize: 14,
                                                        fontWeight: 800,
                                                        transition: 'all .3s ease',
                                                        ...(finished
                                                            ? { bgcolor: look.main, color: '#fff', '& svg': { fontSize: 19, animation: `${tick} .35s ease both` } }
                                                            : current
                                                                ? { bgcolor: look.main, color: '#fff', boxShadow: `0 0 0 5px ${look.soft}` }
                                                                : { bgcolor: '#fff', color: tokens.gray500, border: `2px solid ${tokens.gray200}` }),
                                                    }, children: finished ? _jsx(CheckIcon, {}) : index + 1 }), _jsx(Typography, { sx: {
                                                        fontSize: 12.5,
                                                        fontWeight: current ? 800 : 600,
                                                        color: current ? look.main : finished ? tokens.navy800 : tokens.gray500,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        maxWidth: '100%',
                                                        display: { xs: current ? 'block' : 'none', sm: 'block' },
                                                    }, children: s.label })] })] }, s.key));
                            }) }) })), _jsxs(Box, { sx: { flex: 1, minHeight: 0, overflowY: 'auto', p: { xs: 2, md: 3 } }, children: [_jsx(ErrorMessage, { messageKey: error ?? null }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: aside ? 'minmax(0, 1fr) 280px' : '1fr' }, gap: 2.5, alignItems: 'start' }, children: [_jsx(Box, { sx: { minWidth: 0, animation: `${enter} .3s ease both` }, children: children }, step), aside && _jsx(Box, { sx: { position: { md: 'sticky' }, top: 0 }, children: aside })] })] }), _jsxs(Stack, { direction: "row", sx: { flexShrink: 0, alignItems: 'center', gap: 1.25, px: { xs: 2, md: 3.5 }, py: 1.5, bgcolor: '#fff', borderTop: `1px solid ${tokens.gray100}` }, children: [_jsx(Button, { onClick: onClose, disabled: busy, color: "inherit", children: t('common.cancel') }), _jsx(Box, { sx: { flex: 1 } }), step > 0 && (_jsx(Button, { variant: "outlined", disabled: busy, startIcon: rtl ? _jsx(ArrowForwardIcon, {}) : _jsx(ArrowBackIcon, {}), onClick: () => onStep(step - 1), children: t('wizard.back') })), last ? (_jsx(Button, { variant: "contained", disabled: busy || !canNext, startIcon: _jsx(SendOutlinedIcon, {}), onClick: onFinish, sx: { px: 3, background: canNext ? look.dark : undefined }, children: busy ? t('common.loading') : finishLabel })) : (_jsx(Button, { variant: "contained", disabled: !canNext, endIcon: rtl ? _jsx(ArrowBackIcon, {}) : _jsx(ArrowForwardIcon, {}), onClick: () => onStep(step + 1), sx: { px: 3, background: canNext ? look.dark : undefined }, children: t('wizard.next', { step: next?.label ?? '' }) }))] })] }))] }));
}
/** A card inside a wizard step: a title with an icon, then its fields. */
export function WizardCard({ title, icon, action, children }) {
    return (_jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, border: `1px solid ${tokens.gray100}`, p: { xs: 2, md: 2.5 }, mb: 2 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 2, color: tokens.navy800, '& svg': { color: tokens.navy700, fontSize: 21 } }, children: [icon, _jsx(Typography, { sx: { fontSize: 15.5, fontWeight: 800, flex: 1 }, children: title }), action] }), children] }));
}
/** The live summary beside a wizard: what has been chosen so far. */
export function WizardAside({ tone, title, children }) {
    const look = recordTones[tone];
    return (_jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, border: `1px solid ${tokens.gray100}`, overflow: 'hidden' }, children: [_jsx(Box, { sx: { px: 2, py: 1.25, color: '#fff', background: look.dark, fontSize: 13.5, fontWeight: 800 }, children: title }), _jsx(Stack, { sx: { px: 2, py: 0.5 }, children: children })] }));
}
/** One line of the live summary; a value not chosen yet shows a dash. */
export function WizardFact({ icon, label, value, sub }) {
    const empty = value === undefined || value === null || value === '';
    return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'flex-start', gap: 1.25, py: 1.25, '&:not(:last-of-type)': { borderBottom: `1px solid ${tokens.gray100}` } }, children: [_jsx(Box, { sx: { flex: '0 0 auto', mt: 0.25, color: empty ? tokens.gray300 : tokens.navy700, '& svg': { fontSize: 19 } }, children: icon }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: label }), _jsx(Typography, { component: "div", sx: { fontSize: 13.5, fontWeight: 800, color: empty ? tokens.gray300 : tokens.navy800, overflowWrap: 'anywhere' }, children: empty ? '—' : value }), !empty && sub && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: sub })] })] }));
}
