import { Box, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';

// The screens' glass identity (the user's decision, 2026-10-21): the header and its KPIs on a navy gradient strip with
// translucent glass cards, as the housing showroom's; the content on frosted light cards. A main list has one tint and
// a record's details another, so the two are told apart at a glance; both are set here, to be unified once approved.

export type GlassTint = 'list' | 'detail';

const tints: Record<GlassTint, string> = {
  list:
    'radial-gradient(500px 260px at 15% 0%, rgba(56,189,248,.35), transparent 60%), radial-gradient(420px 260px at 90% 120%, rgba(20,184,166,.35), transparent 60%), linear-gradient(135deg, #082B49 0%, #0d4a6c 55%, #0e7c86 100%)',
  detail:
    'radial-gradient(500px 260px at 15% 0%, rgba(56,189,248,.3), transparent 60%), radial-gradient(420px 260px at 90% 120%, rgba(124,58,237,.38), transparent 60%), linear-gradient(135deg, #082B49 0%, #1e3a8a 55%, #4338ca 100%)',
};

/** A glass card on the strip. */
export const glassOnDark: SxProps<Theme> = {
  bgcolor: 'rgba(255,255,255,.1)',
  border: '1px solid rgba(255,255,255,.22)',
  borderRadius: '16px',
  backdropFilter: 'blur(10px) saturate(140%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
};

/** A frosted light card for the content. */
export const glassPanel: SxProps<Theme> = {
  bgcolor: 'rgba(255,255,255,.78)',
  border: '1px solid rgba(255,255,255,.9)',
  borderRadius: '16px',
  backdropFilter: 'blur(14px) saturate(160%)',
  boxShadow: '0 10px 30px rgba(15,39,71,.08), inset 0 1px 0 #fff',
};

/** A light button on the strip (outlined; `solid` for the main action). */
export const glassButton = (solid = false): SxProps<Theme> =>
  solid
    ? { bgcolor: '#fff', color: '#082B49', borderColor: '#fff', '&:hover': { bgcolor: '#eef4ff', borderColor: '#fff' } }
    : { color: '#fff', borderColor: 'rgba(255,255,255,.4)', bgcolor: 'rgba(255,255,255,.08)', backdropFilter: 'blur(8px)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.16)' } };

export function GlassHero({ tint, overline, title, chip, subtitle, actions, children }: {
  tint: GlassTint;
  overline?: ReactNode;
  title: ReactNode;
  chip?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Box component="header" sx={{ borderRadius: '20px', p: { xs: 2, md: '20px 22px' }, mb: 2, color: '#fff', background: tints[tint], position: 'relative', overflow: 'hidden' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-start' }, gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          {overline && <Typography sx={{ fontSize: 12, opacity: 0.75 }}>{overline}</Typography>}
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.25 }}>
            <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35 }}>
              {title}
            </Typography>
            {chip}
          </Stack>
          {subtitle && <Typography component="div" sx={{ fontSize: 12.5, opacity: 0.82, mt: 0.25 }}>{subtitle}</Typography>}
        </Box>
        {actions && <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', flex: '0 0 auto' }}>{actions}</Stack>}
      </Stack>
      {children}
    </Box>
  );
}

/** A chip on the strip (the status). */
export function GlassChip({ children }: { children: ReactNode }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, borderRadius: 99, px: 1.25, py: 0.25, fontSize: 12, fontWeight: 700, bgcolor: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.3)' }}>
      {children}
    </Box>
  );
}

export function GlassKpi({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Box sx={{ ...(glassOnDark as object), p: '14px 16px', display: 'flex', gap: 1.5, alignItems: 'flex-start', justifyContent: 'space-between', minWidth: 0 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, opacity: 0.82 }}>{label}</Typography>
        <Typography component="div" sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
        {hint && <Typography component="div" sx={{ fontSize: 11.5, opacity: 0.75 }}>{hint}</Typography>}
      </Box>
      <Box aria-hidden sx={{ flex: '0 0 auto', width: 38, height: 38, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.14)', '& svg': { fontSize: 20 } }}>
        {icon}
      </Box>
    </Box>
  );
}

export function GlassFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ ...(glassOnDark as object), px: 1.5, py: 1.25, minWidth: 0 }}>
      <Typography sx={{ fontSize: 11.5, opacity: 0.75 }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: 13.5, fontWeight: 700, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

/** The strip's row of KPIs (or facts), four on a wide screen. */
export function GlassRow({ children, columns = 4 }: { children: ReactNode; columns?: number }) {
  return <Box sx={{ display: 'grid', gap: 1.5, mt: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: `repeat(${columns}, minmax(0, 1fr))` } }}>{children}</Box>;
}
