import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import { Box, ButtonBase, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { workflowApi, type CurrentStage } from '../api/workflow';
import { tokens } from '../app/theme';
import { recordTones, type RecordTone } from './RecordLayout';

// A list page's frame, in its record's color: the band with the title and the "new" action, the strip of statuses
// (each with its count, clicked to filter), the table's head in the color, each row's edge in its status's color, and
// under a row's status the stage its approval waits at and since when.

/** The band above a list: its icon, title and description, and its actions (white on the color). */
export function ListHero({ tone, icon, title, subtitle, actions }: { tone: RecordTone; icon: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        mb: `${tokens.gap}px`,
        px: { xs: 2, md: 2.75 },
        py: 2,
        borderRadius: `${tokens.radiusLg}px`,
        color: '#fff',
        background: recordTones[tone].band,
        boxShadow: tokens.shadowSm,
        '&::after': { content: '""', position: 'absolute', width: 220, height: 220, borderRadius: '50%', top: -140, insetInlineEnd: -40, background: 'rgba(255,255,255,.07)' },
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ position: 'relative', zIndex: 1, alignItems: { md: 'center' }, gap: 2 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.75, flex: 1, minWidth: 0 }}>
          <Box sx={{ flex: '0 0 auto', width: 50, height: 50, borderRadius: '15px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.16)', '& svg': { fontSize: 27 } }}>{icon}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" sx={{ fontSize: 21, fontWeight: 800, lineHeight: 1.3 }}>
              {title}
            </Typography>
            {subtitle && <Typography sx={{ fontSize: 12.5, opacity: 0.88 }}>{subtitle}</Typography>}
          </Box>
        </Stack>
        {actions && (
          <Stack
            direction="row"
            sx={{
              flexWrap: 'wrap',
              gap: 1,
              '& .MuiButton-contained': { bgcolor: '#fff', color: recordTones[tone].main, fontWeight: 800, boxShadow: 'none', '&:hover': { bgcolor: '#f3f7f9' } },
              '& .MuiButton-outlined, & .MuiButton-text': { color: '#fff', borderColor: 'rgba(255,255,255,.45)', bgcolor: 'rgba(255,255,255,.1)' },
            }}
          >
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

/** The strip of statuses under the band. */
export function StatusStrip({ children }: { count?: number; children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridAutoFlow: { md: 'column' },
        gridAutoColumns: { md: '1fr' },
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'none' },
        mb: `${tokens.gap}px`,
        bgcolor: '#fff',
        borderRadius: `${tokens.radiusLg}px`,
        boxShadow: tokens.shadowSm,
        border: `1px solid ${tokens.gray100}`,
        overflow: 'hidden',
      }}
    >
      {children}
    </Box>
  );
}

/** One status in the strip: its count in its color; clicked, the list shows only it (the chosen one is underlined). */
export function StripItem({ label, value, foot, tone, active, onClick }: { label: string; value: ReactNode; foot?: string; icon?: ReactNode; tone: string; active?: boolean; onClick?: () => void }) {
  return (
    <ButtonBase
      disabled={!onClick}
      onClick={onClick}
      title={foot}
      sx={{
        position: 'relative',
        display: 'block',
        textAlign: 'start',
        px: 2,
        py: 1.5,
        bgcolor: active ? `${tone}12` : 'transparent',
        borderInlineStart: `1px solid ${tokens.gray100}`,
        transition: 'background .15s',
        '&:hover': { bgcolor: `${tone}0d` },
        '&.Mui-disabled': { color: 'inherit' },
        '&::after': { content: '""', position: 'absolute', insetInline: 0, bottom: 0, height: 3, bgcolor: active ? tone : 'transparent' },
      }}
    >
      <Typography sx={{ fontSize: 12, color: tokens.gray500, whiteSpace: 'nowrap' }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: 24, fontWeight: 800, color: tone, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </ButtonBase>
  );
}

/** The table's head in the record's color. */
export const toneHead = (tone: RecordTone): SxProps<Theme> => ({
  '& .MuiTableRow-root': { background: recordTones[tone].dark },
  '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': { bgcolor: 'transparent', color: '#fff', borderBottom: 0, borderRadius: 0 },
  '& .MuiTableSortLabel-root, & .MuiTableSortLabel-root.Mui-active, & .MuiTableSortLabel-icon': { color: '#fff !important' },
});

/** A row's edge in its status's color (on the reading side: the RTL styles flip the shadow). */
export const rowEdge = (color: string) => ({ '& > td:first-of-type': { boxShadow: `inset 4px 0 0 ${color}` } });

/** Where the approvals of the listed records stand (one call for the page). */
export function useCurrentStages(screen: string, ids: string[]) {
  const [stages, setStages] = useState<Record<string, CurrentStage>>({});
  const key = ids.join(',');
  useEffect(() => {
    if (!key) {
      setStages({});
      return;
    }
    let cancelled = false;
    workflowApi
      .currentStages(screen, key.split(','))
      .then((list) => !cancelled && setStages(Object.fromEntries(list.map((s) => [s.recordId, s]))))
      .catch(() => !cancelled && setStages({}));
    return () => {
      cancelled = true;
    };
  }, [screen, key]);
  return stages;
}

/** "⏳ stage · for 2 days" under a row's status. */
export function StageLine({ stage }: { stage?: CurrentStage }) {
  const { t, i18n } = useTranslation();
  if (!stage) {
    return null;
  }
  const name = i18n.language === 'ar' ? stage.stepAr : stage.stepEn;
  const minutes = stage.since ? Math.max(0, (Date.now() - Date.parse(stage.since)) / 60000) : null;
  const since =
    minutes === null
      ? ''
      : minutes < 60
        ? t('tracker.minutes', { count: Math.max(1, Math.floor(minutes)) })
        : minutes < 60 * 24
          ? t('tracker.hours', { count: Math.floor(minutes / 60) })
          : t('tracker.days', { count: Math.floor(minutes / 60 / 24) });
  const late = minutes !== null && minutes >= 60 * 24 * 2;
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.4, mt: 0.4, fontSize: 11.5, color: late ? tokens.danger : tokens.gray500, '& svg': { fontSize: 14 } }}>
      <HourglassBottomOutlinedIcon />
      <Box component="span" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
        {name}
        {since && ` · ${t('lists.since', { time: since })}`}
      </Box>
    </Stack>
  );
}
