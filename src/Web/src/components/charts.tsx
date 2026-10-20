import { Box, Stack, Typography } from '@mui/material';
import { keyframes, useTheme } from '@mui/material/styles';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { tokens } from '../app/theme';

/**
 * Small charts drawn in SVG for the dashboard (no chart library): a donut, a ring gauge, grouped columns and ranked
 * bars. They animate in once, follow the page direction, and show values on hover.
 */

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export const palette = ['#0d4a6c', '#0e7c86', '#2bc3e1', '#23a455', '#d98a06', '#7b5cd6', '#e0607e', '#8aa1b1'];

const grow = keyframes`from { transform: scaleY(0); } to { transform: scaleY(1); }`;
const fade = keyframes`from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; }`;

/** A number that counts up from zero when it first shows. */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(begin + (target - begin) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = target;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

export function CountUp({ value, suffix }: { value: number; suffix?: string }) {
  const shown = useCountUp(value);
  return (
    <>
      {shown.toLocaleString('en-US')}
      {suffix}
    </>
  );
}

/** A donut with its total (or a given label) in the middle; a slice lifts on hover. */
export function Donut({ data, size = 190, thickness = 26, center, centerLabel }: { data: Slice[]; size?: number; thickness?: number; center?: ReactNode; centerLabel?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const active = data.find((d) => d.key === hover);
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tokens.gray100} strokeWidth={thickness} />
        {data.map((d) => {
          const length = (d.value / total) * c;
          const dash = drawn ? `${Math.max(0, length - 2)} ${c}` : `0 ${c}`;
          const el = (
            <circle
              key={d.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={hover === d.key ? thickness + 6 : thickness}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray .9s cubic-bezier(.2,.8,.2,1), stroke-width .15s', cursor: 'pointer', opacity: hover && hover !== d.key ? 0.45 : 1 }}
              onMouseEnter={() => setHover(d.key)}
              onMouseLeave={() => setHover(null)}
            />
          );
          offset += length;
          return el;
        })}
      </svg>
      <Stack sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center', px: `${thickness + 4}px` }}>
        <Typography sx={{ fontSize: 26, fontWeight: 800, color: tokens.navy800, lineHeight: 1.1 }}>
          {active ? active.value.toLocaleString('en-US') : center ?? total.toLocaleString('en-US')}
        </Typography>
        <Typography sx={{ fontSize: 12, color: tokens.gray500, lineHeight: 1.3 }}>{active ? `${active.label} · ${Math.round((active.value / total) * 100)}%` : centerLabel}</Typography>
      </Stack>
    </Box>
  );
}

/** The donut's legend: colour, label, value and share. */
export function Legend({ data, onClick }: { data: Slice[]; onClick?: (key: string) => void }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  return (
    <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
      {data.map((d, i) => (
        <Stack
          key={d.key}
          direction="row"
          onClick={onClick ? () => onClick(d.key) : undefined}
          sx={{ alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: '8px', cursor: onClick ? 'pointer' : 'default', animation: `${fade} .4s ${i * 0.04}s both`, '&:hover': { bgcolor: tokens.gray50 } }}
        >
          <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: d.color, flexShrink: 0 }} />
          <Typography noWrap sx={{ flex: 1, fontSize: 13, color: tokens.gray700 }}>
            {d.label}
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{d.value.toLocaleString('en-US')}</Typography>
          <Typography sx={{ fontSize: 11.5, color: tokens.gray500, width: 38, textAlign: 'end' }}>{Math.round((d.value / total) * 100)}%</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

/** A ring filled to a percentage, with the value in the middle. */
export function Ring({ percent, size = 130, thickness = 12, color, label, children }: { percent: number; size?: number; thickness?: number; color: string; label?: string; children?: ReactNode }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, percent));
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tokens.gray100} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${drawn ? (value / 100) * c : 0} ${c}`}
          style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <Stack sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {children ?? (
          <Typography sx={{ fontSize: size / 5, fontWeight: 800, color: tokens.navy800 }}>
            <CountUp value={Math.round(value)} suffix="%" />
          </Typography>
        )}
        {label && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{label}</Typography>}
      </Stack>
    </Box>
  );
}

export interface Series {
  key: string;
  label: string;
  color: string;
}

/**
 * Grouped columns over categories (e.g. months), with horizontal grid lines; hovering a group shows its values.
 * The categories follow the page direction (right to left in Arabic), with the axis where they start.
 */
export function Columns({
  categories,
  series,
  values,
  height = 220,
  format = (n: number) => n.toLocaleString('en-US'),
  onPick,
  line,
}: {
  categories: string[];
  series: Series[];
  values: number[][];
  height?: number;
  /** How the axis and the tooltip write a value (e.g. in thousands of riyals). */
  format?: (n: number) => string;
  /** A click on a category (e.g. a month) opens what is behind it. */
  onPick?: (index: number) => void;
  /** A line over the columns on its own 0–100 scale (e.g. the collection rate). */
  line?: { label: string; values: (number | null)[]; color: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const rtl = useTheme().direction === 'rtl';
  const max = Math.max(1, ...values.flat());
  const nice = niceMax(max);
  const n = categories.length;
  const points = line
    ? line.values.map((v, i) => (v === null ? null : { x: ((rtl ? n - i - 0.5 : i + 0.5) / n) * 100, y: 100 - Math.max(0, Math.min(100, v)) }))
    : [];
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(nice * f));
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      {/* The axis sits where the timeline starts: on the right in Arabic. */}
      <Stack sx={{ justifyContent: 'space-between', height, flexShrink: 0 }}>
        {[...ticks].reverse().map((tick, n) => (
          <Typography key={tick} sx={{ fontSize: 10.5, color: tokens.gray500, lineHeight: 1, transform: n === 0 ? 'none' : n === ticks.length - 1 ? 'translateY(0)' : 'translateY(-50%)' }}>
            {format(tick)}
          </Typography>
        ))}
      </Stack>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ position: 'relative', height }}>
          {ticks.map((tick) => (
            <Box key={tick} sx={{ position: 'absolute', insetInline: 0, bottom: `${(tick / nice) * 100}%`, borderTop: `1px dashed ${tokens.gray200}` }} />
          ))}
          {line && (
            <Box component="svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 1 }}>
              <polyline
                fill="none"
                stroke={line.color}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                points={points.filter((p): p is { x: number; y: number } => p !== null).map((p) => `${p.x},${p.y}`).join(' ')}
              />
            </Box>
          )}
          {line &&
            points.map((p, i) =>
              p === null ? null : (
                <Box key={i} aria-hidden sx={{ position: 'absolute', insetInlineStart: `calc(${((i + 0.5) / n) * 100}% - 4px)`, top: `calc(${p.y}% - 4px)`, width: 8, height: 8, borderRadius: '50%', bgcolor: '#fff', border: `2px solid ${line.color}`, zIndex: 1, pointerEvents: 'none' }} />
              ),
            )}
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end' }}>
            {categories.map((_, i) => (
              <Box
                key={categories[i]}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={onPick ? () => onPick(i) : undefined}
                role={onPick ? 'button' : undefined}
                tabIndex={onPick ? 0 : undefined}
                onKeyDown={onPick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(i)) : undefined}
                aria-label={onPick ? categories[i] : undefined}
                sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '3px', px: '3px', borderRadius: '8px', cursor: onPick ? 'pointer' : 'default', bgcolor: hover === i ? 'rgba(13,74,108,.05)' : 'transparent', position: 'relative', '&:focus-visible': { outline: `2px solid ${tokens.navy600}` } }}
              >
                {series.map((s, k) => (
                  <Box
                    key={s.key}
                    sx={{
                      width: `${Math.min(18, 70 / series.length)}%`,
                      maxWidth: 16,
                      minWidth: 4,
                      height: `${((values[k]?.[i] ?? 0) / nice) * 100}%`,
                      minHeight: (values[k]?.[i] ?? 0) > 0 ? 3 : 0,
                      bgcolor: s.color,
                      borderRadius: '5px 5px 2px 2px',
                      transformOrigin: 'bottom',
                      animation: `${grow} .8s ${i * 0.04}s cubic-bezier(.2,.8,.2,1) both`,
                    }}
                  />
                ))}
                {hover === i && (
                  <Box sx={{ position: 'absolute', bottom: '100%', insetInline: '-60px', display: 'flex', justifyContent: 'center', mb: '6px', zIndex: 2, pointerEvents: 'none' }}>
                    <Box sx={{ bgcolor: tokens.navy900, color: '#fff', borderRadius: '8px', px: 1.25, py: 0.75, whiteSpace: 'nowrap', boxShadow: tokens.shadowMd }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{categories[i]}</Typography>
                      {series.map((s, k) => (
                        <Stack key={s.key} direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: s.color }} />
                          <Typography sx={{ fontSize: 11.5 }}>
                            {s.label}: <b>{format(values[k]?.[i] ?? 0)}</b>
                          </Typography>
                        </Stack>
                      ))}
                      {line && line.values[i] !== null && (
                        <Typography sx={{ fontSize: 11.5 }}>
                          {line.label}: <b>{`${line.values[i]}%`}</b>
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', mt: 0.75 }}>
          {categories.map((_, i) => (
            <Typography key={categories[i]} noWrap sx={{ flex: 1, textAlign: 'center', fontSize: 10.5, color: hover === i ? tokens.navy800 : tokens.gray500, fontWeight: hover === i ? 700 : 400 }}>
              {categories[i]}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/** Ranked bars: a label, a bar of its share of the largest, and the value. */
export function RankedBars({ items, color = tokens.navy700, onClick }: { items: { key: string; label: string; value: number }[]; color?: string; onClick?: (key: string) => void }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <Stack spacing={1.1}>
      {items.map((item, n) => (
        <Box key={item.key} onClick={onClick ? () => onClick(item.key) : undefined} sx={{ cursor: onClick ? 'pointer' : 'default', '&:hover .bar': { filter: 'brightness(1.12)' } }}>
          <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1, mb: 0.4 }}>
            <Typography noWrap sx={{ flex: 1, fontSize: 12.5, color: tokens.gray700 }} title={item.label}>
              {item.label}
            </Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: tokens.navy800 }}>{item.value.toLocaleString('en-US')}</Typography>
          </Stack>
          <Box sx={{ height: 8, borderRadius: 4, bgcolor: tokens.gray100, overflow: 'hidden' }}>
            <Box
              className="bar"
              sx={{
                height: '100%',
                width: drawn ? `${(item.value / max) * 100}%` : 0,
                borderRadius: 4,
                background: `linear-gradient(90deg, ${color}, ${tokens.teal})`,
                transition: `width .9s ${n * 0.05}s cubic-bezier(.2,.8,.2,1)`,
              }}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function niceMax(value: number) {
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value) ?? 10;
  return step * power;
}
