import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { tokens } from '../app/theme';

// The record page's frame: a slim colored band with the record's number and whom it is for, and a side summary read
// top to bottom — who made it, the amount, then groups each with its own color.

/** The band above a record: its icon, kind and number (large), its state, whom it is for, and its actions. */
export function RecordHero({
  icon,
  kind,
  number,
  status,
  title,
  subtitle,
  actions,
}: {
  icon: ReactNode;
  kind: string;
  number: string;
  status?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        mb: `${tokens.gap}px`,
        px: { xs: 2, md: 2.75 },
        py: 1.75,
        borderRadius: `${tokens.radiusLg}px`,
        color: '#fff',
        background: 'linear-gradient(120deg, #0b3954 0%, #0d6e8c 60%, #1aa39a 100%)',
        boxShadow: tokens.shadowSm,
        '&::after': { content: '""', position: 'absolute', width: 220, height: 220, borderRadius: '50%', top: -140, insetInlineEnd: -40, background: 'rgba(255,255,255,.07)' },
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ position: 'relative', zIndex: 1, alignItems: { md: 'center' }, gap: { xs: 1.5, md: 2.5 } }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.75, flex: 1, minWidth: 0 }}>
          <Box sx={{ flex: '0 0 auto', width: 50, height: 50, borderRadius: '15px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.16)', '& svg': { fontSize: 27 } }}>{icon}</Box>
          {/* The number, set apart: what people quote. */}
          <Box sx={{ flex: '0 0 auto', paddingInlineEnd: 2.5, borderInlineEnd: '1px solid rgba(255,255,255,.22)' }}>
            <Typography sx={{ fontSize: 12, opacity: 0.8 }}>{kind}</Typography>
            <Typography dir="ltr" sx={{ fontSize: 23, fontWeight: 800, letterSpacing: '.5px', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', textAlign: 'start' }}>
              {number}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography component="h1" sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1.35 }}>
                {title}
              </Typography>
              {status}
            </Stack>
            {subtitle && <Typography sx={{ fontSize: 12.5, opacity: 0.85 }}>{subtitle}</Typography>}
          </Box>
        </Stack>
        {actions && (
          <Stack
            direction="row"
            sx={{
              flexWrap: 'wrap',
              gap: 1,
              alignItems: 'center',
              '& .MuiButton-root': { color: '#fff', borderColor: 'rgba(255,255,255,.45)', bgcolor: 'rgba(255,255,255,.1)', '&:hover': { bgcolor: 'rgba(255,255,255,.2)', borderColor: '#fff' } },
              '& .MuiButton-contained': { bgcolor: '#fff', color: tokens.navy800, '&:hover': { bgcolor: '#eef5f8' } },
            }}
          >
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

/** The side summary card. */
export function SummaryCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: '#fff',
        borderRadius: `${tokens.radiusLg}px`,
        boxShadow: tokens.shadowSm,
        border: `1px solid ${tokens.gray100}`,
        overflow: 'hidden',
        position: { lg: 'sticky' },
        top: { lg: 84 },
      }}
    >
      {children}
    </Box>
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter((part) => /\p{L}/u.test(part))
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '·'
  );
}

/** Who made the record and when, first in the summary. */
export function SummaryCreator({ label, name, at }: { label: string; name: string; at?: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, px: 2.5, py: 1.75, bgcolor: tokens.gray50 }}>
      <Box sx={{ flex: '0 0 auto', width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: tokens.navy700, color: '#fff', fontSize: 14, fontWeight: 800 }}>
        {initials(name)}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{label}</Typography>
        <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tokens.navy800 }}>{name}</Typography>
        {at && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{at}</Typography>}
      </Box>
    </Stack>
  );
}

/** The amount, large on a dark band, with short chips under it. */
export function SummaryTotal({ label, amount, unit, chips }: { label: string; amount: string; unit?: string; chips?: { label: string; tone?: 'light' | 'gold' }[] }) {
  return (
    <Box sx={{ px: 2.5, py: 2, color: '#fff', background: 'linear-gradient(135deg, #0f4c6e, #13708f)' }}>
      <Typography sx={{ fontSize: 12, opacity: 0.85 }}>{label}</Typography>
      <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}>
        {amount}
        {unit && <Box component="span" sx={{ fontSize: 14, fontWeight: 600, opacity: 0.8, marginInlineStart: 0.75 }}>{unit}</Box>}
      </Typography>
      {chips && chips.length > 0 && (
        <Stack direction="row" sx={{ gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
          {chips.map((chip) => (
            <Box
              key={chip.label}
              sx={{ px: 1.25, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 700, ...(chip.tone === 'gold' ? { bgcolor: '#fff3d6', color: '#a86d06' } : { bgcolor: 'rgba(255,255,255,.16)', color: '#fff' }) }}
            >
              {chip.label}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

/** A group of the summary, under a colored heading. */
export function SummaryGroup({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <Box sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${tokens.gray100}` }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, color, mb: 1 }}>{title}</Typography>
      <Stack spacing={1.25}>{children}</Stack>
    </Box>
  );
}

/** One fact: a tinted icon tile in the fact's color, the label, the value (and a line under it). */
export function SummaryFact({ icon, color, label, value, sub }: { icon: ReactNode; color: string; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
      <Box sx={{ flex: '0 0 auto', width: 36, height: 36, borderRadius: '11px', display: 'grid', placeItems: 'center', bgcolor: `${color}1a`, color, '& svg': { fontSize: 19 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{label}</Typography>
        <Typography component="div" sx={{ fontSize: 14, fontWeight: 800, color: tokens.navy800, overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
        {sub && <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{sub}</Typography>}
      </Box>
    </Stack>
  );
}

/** Two dates side by side in tinted boxes (e.g. delivery and start). */
export function SummaryDates({ items }: { items: { icon: ReactNode; color: string; label: string; value: string }[] }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 1 }}>
      {items.map((item) => (
        <Box key={item.label} sx={{ p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: `${item.color}14` }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, color: item.color, '& svg': { fontSize: 16 } }}>
            {item.icon}
            <Typography sx={{ fontSize: 11.5, color: tokens.gray600 }}>{item.label}</Typography>
          </Stack>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: item.color, mt: 0.25 }}>{item.value}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Free text at the end of the summary (notes, reasons). */
export function SummaryNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${tokens.gray100}` }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, color: tokens.gray500, mb: 0.5 }}>{title}</Typography>
      <Typography component="div" sx={{ fontSize: 12.5, color: tokens.gray600, lineHeight: 1.7 }}>
        {children}
      </Typography>
    </Box>
  );
}
