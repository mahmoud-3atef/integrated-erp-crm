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
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { tokens } from '../app/theme';
import { applyLanguage, type Language } from '../i18n';

export function LanguageSwitch({ light = false }: { light?: boolean }) {
  const { t, i18n } = useTranslation();
  const toggle = () => {
    const next: Language = i18n.language === 'ar' ? 'en' : 'ar';
    applyLanguage(next);
    void i18n.changeLanguage(next);
  };

  return (
    <Button
      size="small"
      startIcon={<TranslateIcon />}
      onClick={toggle}
      aria-label={t('language.label')}
      lang={i18n.language === 'ar' ? 'en' : 'ar'}
      sx={light ? { color: '#fff', bgcolor: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', '&:hover': { bgcolor: 'rgba(255,255,255,.18)' } } : undefined}
    >
      {t('language.switchTo')}
    </Button>
  );
}

/** Translated error box; renders nothing when there is no error. */
export function ErrorMessage({ messageKey }: { messageKey: string | null }) {
  const { t, i18n } = useTranslation();
  return messageKey ? (
    <Alert severity="error" sx={{ mb: 2, fontWeight: 600 }} role="alert">
      {/* A code without a translation yet still shows a readable message. */}
      {t(i18n.exists(messageKey) ? messageKey : 'errors.unknown')}
    </Alert>
  ) : null;
}

const drift = keyframes`
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(6%, -8%) scale(1.15); }
  100% { transform: translate(-8%, 6%) scale(.95); }
`;
const cardIn = keyframes`
  from { opacity: 0; transform: translateY(24px) scale(.97); }
  to { opacity: 1; transform: none; }
`;
const moduleIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
`;

interface ModuleCard {
  icon: ReactNode;
  title: string;
  sub: string;
  tone: string;
}

const startModules: ModuleCard[] = [
  { icon: <HandshakeOutlinedIcon />, title: 'hero.customers', sub: 'hero.customersSub', tone: 'rgba(43,195,225,.38)' },
  { icon: <AccountTreeOutlinedIcon />, title: 'hero.projects', sub: 'hero.projectsSub', tone: 'rgba(255,255,255,.14)' },
  { icon: <EngineeringOutlinedIcon />, title: 'hero.workers', sub: 'hero.workersSub', tone: 'rgba(179,138,15,.5)' },
];
const endModules: ModuleCard[] = [
  { icon: <ReceiptLongOutlinedIcon />, title: 'hero.invoices', sub: 'hero.invoicesSub', tone: 'rgba(47,179,68,.42)' },
  { icon: <ApprovalOutlinedIcon />, title: 'hero.approvals', sub: 'hero.approvalsSub', tone: 'rgba(255,255,255,.14)' },
  { icon: <InsightsOutlinedIcon />, title: 'hero.reports', sub: 'hero.reportsSub', tone: 'rgba(179,138,15,.5)' },
];

function ModuleCards({ items, delay }: { items: ModuleCard[]; delay: number }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', gap: 2 }}>
      {items.map((m, i) => (
        <Box
          key={m.title}
          sx={{
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
          }}
        >
          <Box sx={{ display: 'grid', placeItems: 'center', flex: '0 0 46px', width: 46, height: 46, borderRadius: '14px', bgcolor: m.tone }}>{m.icon}</Box>
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{t(m.title)}</Typography>
            <Typography sx={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,.72)' }}>{t(m.sub)}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** Every sign-in screen: the portal's login look (navy gradient, soft lights, module cards, white card). */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
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
      }}
    >
      {/* Soft moving lights + dot grid (decorative; still for users who ask for less motion). */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: '-20%',
          zIndex: -2,
          filter: 'blur(80px)',
          opacity: 0.5,
          '& span': { position: 'absolute', borderRadius: '50%', animation: `${drift} 18s ease-in-out infinite alternate` },
          '@media (prefers-reduced-motion: reduce)': { '& span': { animation: 'none' } },
        }}
      >
        <Box component="span" sx={{ width: '40%', height: '40%', top: '4%', right: '12%', bgcolor: tokens.sky }} />
        <Box component="span" sx={{ width: '34%', height: '34%', bottom: '4%', left: '6%', bgcolor: tokens.gold, opacity: 0.7, animationDuration: '22s' }} />
        <Box component="span" sx={{ width: '28%', height: '28%', top: '42%', left: '40%', bgcolor: '#14a0ab', animationDuration: '26s' }} />
      </Box>
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          backgroundImage: 'radial-gradient(rgba(255,255,255,.13) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(ellipse at 50% 45%, #000 35%, transparent 80%)',
        }}
      />

      <Box component="header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box
            component="img"
            src="/brand/carepro-logo.png"
            alt=""
            sx={{ width: 48, height: 48, flex: '0 0 auto', objectFit: 'contain', borderRadius: '14px', bgcolor: '#fff', p: 0.75, boxShadow: '0 10px 24px rgba(0,0,0,.25)' }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: { xs: 16, sm: 19 }, fontWeight: 800, lineHeight: 1.2, color: '#fff' }}>
              {t('app.name')}
            </Typography>
            <Typography noWrap sx={{ fontSize: 12, opacity: 0.75 }}>
              {t('app.tagline')}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: '0 0 auto' }}>
          <Box
            sx={{
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
            }}
          >
            <ShieldOutlinedIcon />
            {t('login.secure')}
          </Box>
          <LanguageSwitch light />
        </Box>
      </Box>

      <Box sx={{ textAlign: 'center', display: { xs: 'none', md: 'block' } }}>
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            mb: 1,
            px: 1.75,
            py: 0.5,
            borderRadius: 999,
            background: 'linear-gradient(90deg, rgba(179,138,15,.35), rgba(43,195,225,.25))',
            border: '1px solid rgba(255,255,255,.2)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {t('hero.kicker')}
        </Box>
        <Typography component="p" sx={{ m: 0, fontSize: 'clamp(26px, 3vw, 42px)', lineHeight: 1.3, fontWeight: 800, color: '#fff', textShadow: '0 6px 24px rgba(0,0,0,.25)' }}>
          {t('hero.title')}{' '}
          <Box component="span" sx={{ background: 'linear-gradient(90deg, #f4c95d, #8fe3ea)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' }}>
            {t('hero.titleHighlight')}
          </Box>
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) minmax(360px, 440px) minmax(0,1fr)' },
          alignItems: 'center',
          justifyItems: 'center',
          gap: 4.5,
          width: '100%',
          maxWidth: 1320,
          mx: 'auto',
        }}
      >
        <Box sx={{ justifySelf: 'end', display: { xs: 'none', lg: 'block' } }}>
          <ModuleCards items={startModules} delay={0.2} />
        </Box>
        <Box
          component="main"
          sx={{
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
          }}
        >
          <Typography component="h1" sx={{ m: 0, fontSize: 25, fontWeight: 800, textAlign: 'center', color: tokens.navy800 }}>
            {title}
          </Typography>
          {subtitle ? <Typography sx={{ mt: 0.25, mb: 2.25, textAlign: 'center', fontSize: 14, color: tokens.gray500 }}>{subtitle}</Typography> : <Box sx={{ mb: 2 }} />}
          {children}
        </Box>
        <Box sx={{ justifySelf: 'start', display: { xs: 'none', lg: 'block' } }}>
          <ModuleCards items={endModules} delay={0.25} />
        </Box>
      </Box>

      <Typography component="footer" sx={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.65)' }}>
        {t('hero.footer')}
      </Typography>
    </Box>
  );
}
