import { Box, ButtonBase, Paper, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';
import { toneColors, tokens } from '../app/theme';

/** Page title, subtitle and actions (the portal's .cp-page-header). */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.75, mb: `${tokens.gap}px` }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h1" sx={{ m: 0, fontSize: 21, fontWeight: 700, color: tokens.navy800, lineHeight: 1.3 }}>
          {title}
        </Typography>
        {subtitle && <Typography sx={{ mt: 0.25, fontSize: 13, color: tokens.gray600 }}>{subtitle}</Typography>}
      </Box>
      {actions && <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>{actions}</Stack>}
    </Stack>
  );
}

/** White floating card (the portal's .cp-card / .cp-table-card). */
export function Panel({ children, padding = 2, sx }: { children: ReactNode; padding?: number; sx?: SxProps<Theme> }) {
  return (
    <Paper elevation={0} sx={[{ p: padding, borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Paper>
  );
}

export type Tone = keyof typeof toneColors;

/** Colored text with a dot, e.g. Active / Inactive (the portal's .cp-status). */
export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        fontSize: 12.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: toneColors[tone].fg,
        '&::before': { content: '""', width: 7, height: 7, borderRadius: '50%', backgroundColor: 'currentColor' },
      }}
    >
      {label}
    </Box>
  );
}

/** Soft pill badge (the portal's .cp-badge + tone). */
export function Badge({ tone = 'primary', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.25,
        py: 0.25,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        color: toneColors[tone].fg,
        backgroundColor: toneColors[tone].bg,
        '& svg': { fontSize: 14 },
      }}
    >
      {icon}
      {children}
    </Box>
  );
}

/** Initials in a navy circle (the portal's .cp-avatar). */
export function Initials({ name, size = 38 }: { name: string; size?: number }) {
  const letters = name
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part))
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: 'inline-grid',
        placeItems: 'center',
        flex: '0 0 auto',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: tokens.navy700,
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.37,
        boxShadow: size >= 34 ? '0 0 0 3px #fff, 0 3px 8px rgba(10, 60, 88, .25)' : 'none',
      }}
    >
      {letters || '·'}
    </Box>
  );
}

/** Empty list message. */
export function EmptyState({ text }: { text: string }) {
  return <Typography sx={{ py: 5, textAlign: 'center', color: tokens.gray500 }}>{text}</Typography>;
}

/** The portal's pill tabs (.cp-tabs). */
export function PillTabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <Box role="tablist" sx={{ display: 'inline-flex', gap: 0.5, p: 0.5, borderRadius: 999, bgcolor: tokens.tint, mb: `${tokens.gap}px` }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <ButtonBase
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            sx={{
              px: 2,
              py: 0.9,
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              color: active ? tokens.navy700 : tokens.gray600,
              bgcolor: active ? '#fff' : 'transparent',
              boxShadow: active ? tokens.shadowXs : 'none',
            }}
          >
            {option.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
