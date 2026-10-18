import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { Box, Link, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { tokens } from '../../app/theme';
import { recordTones, type RecordTone } from '../../components/RecordLayout';
import { StateBubble } from './movements/movementMeta';

// The parts of an operations order about one worker: their card, and the way they go (from where to where).

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

/** A fact about the worker, in a tinted tile. */
export function WorkerFact({ icon, label, value, ltr = false }: { icon: ReactNode; label: string; value: ReactNode; ltr?: boolean }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px solid ${tokens.gray100}`, minWidth: 0 }}>
      <Box sx={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: '#fff', color: tokens.navy700, '& svg': { fontSize: 18 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{label}</Typography>
        <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ltr ? <span dir="ltr">{value}</span> : value}
        </Typography>
      </Box>
    </Stack>
  );
}

/** The worker's head: an avatar in the record's color, the name (to their page), the number, a badge, then their facts. */
export function WorkerHead({
  tone,
  label,
  name,
  workerId,
  workerNo,
  badge,
  facts,
}: {
  tone: RecordTone;
  label: string;
  name: string;
  workerId: string | null;
  workerNo: string;
  badge?: ReactNode;
  facts: ReactNode;
}) {
  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 2, px: 2.5, py: 2, background: `linear-gradient(180deg, ${recordTones[tone].soft} 0%, #fff 100%)` }}>
        <Box
          sx={{
            flex: '0 0 auto',
            width: 64,
            height: 64,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: 21,
            fontWeight: 800,
            color: '#fff',
            background: recordTones[tone].dark,
            boxShadow: `0 0 0 4px #fff, 0 4px 12px ${recordTones[tone].main}40`,
          }}
        >
          {initials(name)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{label}</Typography>
          <Typography sx={{ fontSize: 19, fontWeight: 800, color: tokens.navy800, lineHeight: 1.3 }}>
            {workerId ? (
              <Link component={RouterLink} to={`/workforce/workers/${workerId}`} underline="hover" color="inherit">
                {name}
              </Link>
            ) : (
              name
            )}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>
            <span dir="ltr">{workerNo}</span>
          </Typography>
        </Box>
        {badge}
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.25, px: 2.5, pb: 2.25, pt: 0.5 }}>{facts}</Box>
    </>
  );
}

export interface JourneyEnd {
  state: string;
  label: string;
  sub?: string | null;
  /** Lines under the end (its date, its price). */
  lines?: ReactNode;
}

/** The way a worker goes: from one place to another, a dashed arrow between, and a pill on it (e.g. the days spent). */
export function Journey({ from, to, pill, pillIcon }: { from: JourneyEnd; to: JourneyEnd; pill?: ReactNode; pillIcon?: ReactNode }) {
  const end = (e: JourneyEnd) => (
    <Box sx={{ flex: '0 1 auto', minWidth: 0 }}>
      <StateBubble state={e.state} label={e.label} sub={e.sub} big />
      {e.lines && <Box sx={{ mt: 0.75, fontSize: 12, color: tokens.gray500, paddingInlineStart: '64px', lineHeight: 1.8 }}>{e.lines}</Box>}
    </Box>
  );
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} sx={{ alignItems: { md: 'center' }, gap: 2 }}>
      {end(from)}
      <Box sx={{ flex: 1, minWidth: 80, position: 'relative', display: { xs: 'none', md: 'block' } }}>
        <Box sx={{ height: 2, backgroundImage: 'linear-gradient(90deg, #b6c3d3 50%, transparent 50%)', backgroundSize: '12px 2px' }} />
        <Box sx={{ position: 'absolute', insetInlineEnd: -2, top: -4, width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderInlineStart: '8px solid #b6c3d3' }} />
        {pill && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              insetInline: 0,
              mx: 'auto',
              width: 'fit-content',
              transform: 'translateY(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.25,
              py: 0.25,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              color: tokens.gold,
              bgcolor: '#fbf4dc',
              border: '1px solid rgba(179, 138, 15, .25)',
              '& svg': { fontSize: 14 },
            }}
          >
            {pillIcon ?? <TimerOutlinedIcon />}
            {pill}
          </Box>
        )}
      </Box>
      {end(to)}
    </Stack>
  );
}

/** "label: value" under a journey's end, the value in bold. */
export function JourneyLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      {label}: <b style={{ color: tokens.navy800 }}>{children}</b>
    </div>
  );
}

/** Whole days between two dates (null if either is missing). */
export function daysBetween(from: string | null | undefined, to: string | null | undefined) {
  return from && to ? Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)) : null;
}
