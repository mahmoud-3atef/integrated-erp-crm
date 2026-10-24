import { Box, ButtonBase, Skeleton, Tooltip, Typography, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';
import type { Placement } from '../api/workforce';

/**
 * The system's shared look (the user's goal, 2026-10-24: «وحدة التصميم في النظام»), first made for the workers list
 * (docs/02-target-architecture/22) and now used by the home page and the reports: navy with a little gold, white
 * surfaces, neutral borders, and status colours that only mean a status. HR screens keep their own tokens (CLAUDE.md).
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

type Semantic = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * What each status means, as a colour: at work is good, new and in housing are information, on vacation is a
 * notice, suspended and absconded need attention; a final exit is the normal end, not an error.
 */
export const placementTone: Record<Placement, Semantic> = {
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

export const toneOf = (placement: Placement) => wf[placementTone[placement]];

/** A white card with a light border (no coloured backgrounds, no heavy shadow). */
export const card: SxProps<Theme> = { bgcolor: wf.surface, border: `1px solid ${wf.border}`, borderRadius: wf.radius, boxShadow: '0 1px 2px rgba(20,38,61,.04)' };

/** Figures in columns line up (tabular numerals). */
export const num: SxProps<Theme> = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' };

/** A table's navy head, held in place while the rows scroll (put on the `Table`, with `stickyHeader`). */
export const navyHead: SxProps<Theme> = {
  '& thead th': { bgcolor: `${wf.navy} !important`, color: '#fff !important', fontSize: 12.5, fontWeight: 600, py: 1, borderBottom: 0, whiteSpace: 'nowrap' },
  '& tbody td': { borderBottom: `1px solid ${wf.subtle}`, fontSize: 13 },
  '& tbody tr:hover td': { bgcolor: wf.rowHover },
  '& tfoot td': { bgcolor: wf.subtle, color: wf.navy, fontWeight: 700, fontSize: 13, borderTop: `1px solid ${wf.border}`, borderBottom: 0 },
};

/** A status as a small badge: a dot and the text (colour is never the only sign). */
export function StatusPill({ placement, children }: { placement: Placement; children: ReactNode }) {
  const tone = toneOf(placement);
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.1, py: 0.3, borderRadius: 999, fontSize: 12, fontWeight: 600, lineHeight: 1.4, whiteSpace: 'nowrap', color: tone.fg, bgcolor: tone.bg }}>
      <Box component="span" aria-hidden sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: tone.fg, flex: '0 0 auto' }} />
      {children}
    </Box>
  );
}

/**
 * One figure in a white card: its name, the value (a skeleton while loading, «—» with a tooltip when unknown, never a
 * made-up 0), and a line under it. `tone` colours the value only when it calls for attention.
 */
export function KpiCard({ label, value, unit, sub, loading, unknownHint, tone, onClick }: { label: string; value: ReactNode | null; unit?: string; sub?: ReactNode; loading?: boolean; unknownHint?: string; tone?: 'danger'; onClick?: () => void }) {
  return (
    <Box
      component={onClick ? ButtonBase : 'div'}
      onClick={onClick}
      sx={{ ...card, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'start', gap: 0.5, minWidth: 0, transition: 'border-color .15s', '&:hover': onClick ? { borderColor: wf.navy } : undefined, '&.Mui-focusVisible': { outline: `2px solid ${wf.navy}`, outlineOffset: 2 } } as SxProps<Theme>}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: wf.textSecondary }}>{label}</Typography>
      {loading ? (
        <Skeleton variant="rounded" width="60%" height={34} />
      ) : value === null ? (
        <Tooltip title={unknownHint ?? ''}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, color: wf.textSecondary, lineHeight: 1.2 }}>—</Typography>
        </Tooltip>
      ) : (
        <Typography sx={{ ...num, fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: tone === 'danger' ? wf.danger.fg : wf.navy } as SxProps<Theme>}>
          {value}
          {unit && <Box component="span" sx={{ fontSize: 13, fontWeight: 600, color: wf.textSecondary, marginInlineStart: 0.75 }}>{unit}</Box>}
        </Typography>
      )}
      {sub && <Typography component="div" sx={{ fontSize: 12.5, color: wf.textSecondary }}>{sub}</Typography>}
    </Box>
  );
}
