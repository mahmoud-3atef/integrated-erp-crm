import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ApprovalOutlinedIcon from '@mui/icons-material/ApprovalOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import TranslateIcon from '@mui/icons-material/Translate';
import { keyframes } from '@emotion/react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { tokens } from '../app/theme';
import { applyLanguage } from '../i18n';
export function LanguageSwitch({ light = false }) {
    const { t, i18n } = useTranslation();
    const toggle = () => {
        const next = i18n.language === 'ar' ? 'en' : 'ar';
        applyLanguage(next);
        void i18n.changeLanguage(next);
    };
    return (_jsx(Button, { size: "small", startIcon: _jsx(TranslateIcon, {}), onClick: toggle, "aria-label": t('language.label'), lang: i18n.language === 'ar' ? 'en' : 'ar', sx: light ? { color: '#fff', bgcolor: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', '&:hover': { bgcolor: 'rgba(255,255,255,.18)' } } : undefined, children: t('language.switchTo') }));
}
/** Translated error box; renders nothing when there is no error. */
export function ErrorMessage({ messageKey }) {
    const { t, i18n } = useTranslation();
    return messageKey ? (_jsx(Alert, { severity: "error", sx: { mb: 2, fontWeight: 600 }, role: "alert", children: t(i18n.exists(messageKey) ? messageKey : 'errors.unknown') })) : null;
}
const drift = keyframes `
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(6%, -8%) scale(1.15); }
  100% { transform: translate(-8%, 6%) scale(.95); }
`;
const cardIn = keyframes `
  from { opacity: 0; transform: translateY(24px) scale(.97); }
  to { opacity: 1; transform: none; }
`;
const moduleIn = keyframes `
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
`;
const startModules = [
    { icon: _jsx(HandshakeOutlinedIcon, {}), title: 'hero.customers', sub: 'hero.customersSub', tone: 'rgba(43,195,225,.38)' },
    { icon: _jsx(AccountTreeOutlinedIcon, {}), title: 'hero.projects', sub: 'hero.projectsSub', tone: 'rgba(255,255,255,.14)' },
    { icon: _jsx(EngineeringOutlinedIcon, {}), title: 'hero.workers', sub: 'hero.workersSub', tone: 'rgba(179,138,15,.5)' },
];
const endModules = [
    { icon: _jsx(ReceiptLongOutlinedIcon, {}), title: 'hero.invoices', sub: 'hero.invoicesSub', tone: 'rgba(47,179,68,.42)' },
    { icon: _jsx(ApprovalOutlinedIcon, {}), title: 'hero.approvals', sub: 'hero.approvalsSub', tone: 'rgba(255,255,255,.14)' },
    { icon: _jsx(InsightsOutlinedIcon, {}), title: 'hero.reports', sub: 'hero.reportsSub', tone: 'rgba(179,138,15,.5)' },
];
function ModuleCards({ items, delay }) {
    const { t } = useTranslation();
    return (_jsx(Box, { sx: { display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', gap: 2 }, children: items.map((m, i) => (_jsxs(Box, { sx: {
                display: 'flex',
                alignItems: 'center',
                gap: 1.75,
                width: 300,
                px: 2.25,
                py: 2,
                borderRadius: '18px',
                bgcolor: 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.15)',
                backdropFilter: 'blur(10px)',
                animation: `${moduleIn} .7s ease-out both`,
                animationDelay: `${delay + i * 0.15}s`,
                transition: 'background-color .2s, border-color .2s',
                '&:hover': { bgcolor: 'rgba(255,255,255,.15)', borderColor: 'rgba(255,255,255,.32)' },
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', flex: '0 0 46px', width: 46, height: 46, borderRadius: '14px', bgcolor: m.tone }, children: m.icon }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 15, fontWeight: 700, color: '#fff' }, children: t(m.title) }), _jsx(Typography, { sx: { fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,.72)' }, children: t(m.sub) })] })] }, m.title))) }));
}
/** Every sign-in screen: the portal's login look (navy gradient, soft lights, module cards, white card). */
export function AuthLayout({ title, subtitle, children }) {
    const { t } = useTranslation();
    return (_jsxs(Box, { sx: {
            position: 'relative',
            isolation: 'isolate',
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            gap: 2.25,
            px: { xs: 2, md: 5 },
            py: { xs: 2, md: 2.5 },
            overflow: 'hidden',
            color: '#fff',
            background: `linear-gradient(140deg, #072b40 0%, ${tokens.navy800} 35%, #0e5f73 70%, ${tokens.teal} 100%)`,
        }, children: [_jsxs(Box, { "aria-hidden": true, sx: {
                    position: 'absolute',
                    inset: '-20%',
                    zIndex: -2,
                    filter: 'blur(80px)',
                    opacity: 0.5,
                    '& span': { position: 'absolute', borderRadius: '50%', animation: `${drift} 18s ease-in-out infinite alternate` },
                    '@media (prefers-reduced-motion: reduce)': { '& span': { animation: 'none' } },
                }, children: [_jsx(Box, { component: "span", sx: { width: '40%', height: '40%', top: '4%', right: '12%', bgcolor: tokens.sky } }), _jsx(Box, { component: "span", sx: { width: '34%', height: '34%', bottom: '4%', left: '6%', bgcolor: tokens.gold, opacity: 0.7, animationDuration: '22s' } }), _jsx(Box, { component: "span", sx: { width: '28%', height: '28%', top: '42%', left: '40%', bgcolor: '#14a0ab', animationDuration: '26s' } })] }), _jsx(Box, { "aria-hidden": true, sx: {
                    position: 'absolute',
                    inset: 0,
                    zIndex: -1,
                    backgroundImage: 'radial-gradient(rgba(255,255,255,.13) 1px, transparent 1px)',
                    backgroundSize: '26px 26px',
                    maskImage: 'radial-gradient(ellipse at 50% 45%, #000 35%, transparent 80%)',
                } }), _jsxs(Box, { component: "header", sx: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }, children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }, children: [_jsx(Box, { component: "img", src: "/brand/carepro-logo.png", alt: "", sx: { width: 48, height: 48, flex: '0 0 auto', objectFit: 'contain', borderRadius: '14px', bgcolor: '#fff', p: 0.75, boxShadow: '0 10px 24px rgba(0,0,0,.25)' } }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { noWrap: true, sx: { fontSize: { xs: 16, sm: 19 }, fontWeight: 800, lineHeight: 1.2, color: '#fff' }, children: t('app.name') }), _jsx(Typography, { noWrap: true, sx: { fontSize: 12, opacity: 0.75 }, children: t('app.tagline') })] })] }), _jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1, flex: '0 0 auto' }, children: [_jsxs(Box, { sx: {
                                    display: { xs: 'none', sm: 'inline-flex' },
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 1.75,
                                    py: 0.75,
                                    borderRadius: 999,
                                    bgcolor: 'rgba(255,255,255,.1)',
                                    border: '1px solid rgba(255,255,255,.18)',
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    '& svg': { fontSize: 18, color: '#7ee2b0' },
                                }, children: [_jsx(ShieldOutlinedIcon, {}), t('login.secure')] }), _jsx(LanguageSwitch, { light: true })] })] }), _jsxs(Box, { sx: { textAlign: 'center', display: { xs: 'none', md: 'block' } }, children: [_jsx(Box, { component: "span", sx: {
                            display: 'inline-block',
                            mb: 1,
                            px: 1.75,
                            py: 0.5,
                            borderRadius: 999,
                            background: 'linear-gradient(90deg, rgba(179,138,15,.35), rgba(43,195,225,.25))',
                            border: '1px solid rgba(255,255,255,.2)',
                            fontSize: 13,
                            fontWeight: 700,
                        }, children: t('hero.kicker') }), _jsxs(Typography, { component: "p", sx: { m: 0, fontSize: 'clamp(26px, 3vw, 42px)', lineHeight: 1.3, fontWeight: 800, color: '#fff', textShadow: '0 6px 24px rgba(0,0,0,.25)' }, children: [t('hero.title'), ' ', _jsx(Box, { component: "span", sx: { background: 'linear-gradient(90deg, #f4c95d, #8fe3ea)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' }, children: t('hero.titleHighlight') })] })] }), _jsxs(Box, { sx: {
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) minmax(360px, 440px) minmax(0,1fr)' },
                    alignItems: 'center',
                    justifyItems: 'center',
                    gap: 4.5,
                    width: '100%',
                    maxWidth: 1320,
                    mx: 'auto',
                }, children: [_jsx(Box, { sx: { justifySelf: 'end', display: { xs: 'none', lg: 'block' } }, children: _jsx(ModuleCards, { items: startModules, delay: 0.2 }) }), _jsxs(Box, { component: "main", sx: {
                            width: '100%',
                            maxWidth: 440,
                            px: { xs: 2.75, sm: 3.75 },
                            pt: 3.25,
                            pb: 2.5,
                            borderRadius: '26px',
                            bgcolor: '#fff',
                            color: tokens.gray900,
                            boxShadow: '0 40px 80px rgba(0,0,0,.35), 0 0 0 8px rgba(255,255,255,.06)',
                            animation: `${cardIn} .7s cubic-bezier(.2,.9,.3,1.1) both`,
                            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                        }, children: [_jsx(Typography, { component: "h1", sx: { m: 0, fontSize: 25, fontWeight: 800, textAlign: 'center', color: tokens.navy800 }, children: title }), subtitle ? _jsx(Typography, { sx: { mt: 0.25, mb: 2.25, textAlign: 'center', fontSize: 14, color: tokens.gray500 }, children: subtitle }) : _jsx(Box, { sx: { mb: 2 } }), children] }), _jsx(Box, { sx: { justifySelf: 'start', display: { xs: 'none', lg: 'block' } }, children: _jsx(ModuleCards, { items: endModules, delay: 0.25 }) })] }), _jsx(Typography, { component: "footer", sx: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.65)' }, children: t('hero.footer') })] }));
}
