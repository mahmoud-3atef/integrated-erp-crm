import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, InputAdornment, Stack, TextField, Tooltip, Typography, type SxProps, type Theme } from '@mui/material';
import { keyframes } from '@emotion/react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCountUp } from '../../../components/charts';

/**
 * The old executive dashboard's look (content/css/pages/management-dashboard.css and carepro-design.css), read from
 * the old page itself: its navy, teal, green, amber and red, its cards and tables. An exception to the HR tokens, as
 * the employee file is (docs/03-migration-plan/19).
 */
export const md = {
  navy: '#0A3C58',
  navyDeep: '#072D43',
  navyMid: '#0F4F73',
  ink: '#102633',
  text: '#33444F',
  muted: '#66798A',
  label: '#4A5C6C',
  border: '#E1EBF1',
  track: '#EDF2F6',
  teal: '#0E7C86',
  blue: '#1592C4',
  green: '#2FB344',
  greenDeep: '#1D8D48',
  amber: '#E39A0B',
  amberDeep: '#D98A06',
  brown: '#A8692A',
  red: '#E03434',
  gold: '#F3C661',
  coverage: '#12597F',
};

/** The slices' colours of the old pies, in order. */
export const slices = ['#1F78C8', '#E8890C', '#2FB344', '#E03434', '#0E7C86', '#0A3C58', '#8A9AA6', '#7C5CBF', '#C2410C', '#0891B2'];

export const panel: SxProps<Theme> = {
  bgcolor: '#fff',
  border: `1px solid ${md.border}`,
  borderRadius: '18px',
  boxShadow: '0 1px 2px rgba(10,60,88,.05), 0 10px 26px rgba(10,60,88,.07)',
  p: { xs: 1.5, md: '14px' },
  minWidth: 0,
};

export const finCard: SxProps<Theme> = {
  bgcolor: '#fff',
  border: `1px solid ${md.border}`,
  borderRadius: '18px',
  boxShadow: '0 4px 14px rgba(10,60,88,.07)',
  p: '18px',
  minWidth: 0,
};

/** Numbers as the old page wrote them: whole or with two decimals, Latin digits. */
export function useNumbers() {
  return useMemo(() => {
    const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    const two = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const one = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return { n: (v: number) => whole.format(v), m: (v: number) => two.format(v), p: (v: number) => one.format(v) };
  }, []);
}

/** A value the dashboard cannot know: «—» with why, never 0. */
export function Unknown({ hint }: { hint: string }) {
  return (
    <Tooltip title={hint}>
      <span>—</span>
    </Tooltip>
  );
}

/** A number counting up from zero when it shows, as on the home page (two decimals for amounts and one for rates). */
export function Rolling({ value, decimals = 0 }: { value: number; decimals?: 0 | 1 | 2 }) {
  const scale = 10 ** decimals;
  const shown = useCountUp(Math.round(value * scale)) / scale;
  return <>{new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(shown)}</>;
}

const drift = keyframes`0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-18px, 14px); }`;

/**
 * The six cards' strip (the user's trial, 2026-10-22): a navy gradient with slow glows, as the home page's, and the
 * cards on it as translucent glass.
 */
export function GlassStrip({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '20px',
        p: { xs: 1.5, md: '6px 16px 16px' },
        background: 'linear-gradient(125deg, #072D43 0%, #0A3C58 45%, #0E7C86 100%)',
        boxShadow: '0 14px 30px rgba(7,45,67,.22)',
      }}
    >
      <Box aria-hidden sx={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', top: -170, insetInlineEnd: -60, background: 'radial-gradient(circle, rgba(43,195,225,.35), transparent 70%)', animation: `${drift} 9s ease-in-out infinite` }} />
      <Box aria-hidden sx={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', bottom: -150, insetInlineStart: '28%', background: 'radial-gradient(circle, rgba(243,198,97,.22), transparent 70%)', animation: `${drift} 12s ease-in-out infinite reverse` }} />
      <Box sx={{ position: 'relative' }}>{children}</Box>
    </Box>
  );
}

/**
 * One of the six cards: its colour's line on top, a round icon standing out of its corner, a foot. `glass`: a
 * translucent card on the navy strip, in white.
 */
export function KpiCard({ color, icon, label, value, unit, foot, onClick, glass }: { color: string; icon: ReactNode; label: string; value: ReactNode; unit?: string; foot: ReactNode; onClick?: () => void; glass?: boolean }) {
  return (
    <Box
      component={onClick ? 'button' : 'div'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      sx={{
        position: 'relative',
        textAlign: 'start',
        font: 'inherit',
        cursor: onClick ? 'pointer' : 'default',
        p: 0,
        mt: '14px',
        background: glass ? 'rgba(255,255,255,.1)' : 'linear-gradient(180deg, #fff 0%, #FBFDFE 100%)',
        border: `1px solid ${glass ? 'rgba(255,255,255,.2)' : md.border}`,
        borderRadius: '12px',
        backdropFilter: glass ? 'blur(10px) saturate(140%)' : undefined,
        color: glass ? '#fff' : undefined,
        boxShadow: glass ? `inset 0 3px 0 ${color}, inset 0 1px 0 rgba(255,255,255,.25)` : `inset 0 3px 0 ${color}, 0 1px 2px rgba(10,60,88,.06), 0 8px 20px rgba(10,60,88,.07)`,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        transition: 'transform .15s, box-shadow .15s',
        '&:hover': onClick ? { transform: 'translateY(-2px)' } : glass ? { bgcolor: 'rgba(255,255,255,.16)' } : undefined,
        '&:focus-visible': { outline: `2px solid ${color}`, outlineOffset: 2 },
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: -14,
          insetInlineEnd: 14,
          width: 52,
          height: 52,
          borderRadius: '50%',
          bgcolor: color,
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          boxShadow: glass ? '0 0 0 4px rgba(255,255,255,.18), 0 6px 14px rgba(0,0,0,.25)' : '0 0 0 4px #E3E7EC, 0 6px 14px rgba(13,74,108,.22)',
          '& svg': { fontSize: 24 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ px: 2, pt: 2.25, pb: 1.25, pe: '84px', minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 12.5, color: glass ? 'rgba(255,255,255,.82)' : md.label }}>{label}</Typography>
        <Typography component="div" sx={{ fontSize: 24, fontWeight: 700, color: glass ? '#fff' : md.navy, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
          <bdi>{value}</bdi>
          {unit && (
            <Box component="small" sx={{ fontSize: 12, fontWeight: 500, color: glass ? 'rgba(255,255,255,.7)' : md.muted, marginInlineStart: 0.5 }}>
              {unit}
            </Box>
          )}
        </Typography>
      </Box>
      <Box sx={{ borderTop: `1px solid ${glass ? 'rgba(255,255,255,.16)' : md.border}`, px: 2, py: 1.25, fontSize: 12.5, fontWeight: 600, color: glass ? 'rgba(255,255,255,.88)' : color }}>{foot}</Box>
    </Box>
  );
}

/** The big card of a sub-tab: its total on a dark gradient, the number in gold (it resets the table's filter). */
export function HeroTotal({ icon, label, value, unit, note, tone = 'navy', onClick }: { icon: ReactNode; label: string; value: ReactNode; unit: string; note: string; tone?: 'navy' | 'housing' | 'blue'; onClick?: () => void }) {
  const background = {
    navy: 'radial-gradient(circle at 12% 110%, rgba(243,198,97,.35) 0, transparent 55%), radial-gradient(circle at 95% -10%, rgba(80,184,197,.25) 0, transparent 45%), linear-gradient(140deg, #0F4F73 0%, #0A3C58 55%, #072D43 100%)',
    housing: 'radial-gradient(circle at 12% 110%, rgba(243,198,97,.45) 0, transparent 60%), linear-gradient(140deg, #0E7C86 0%, #4E8F5A 55%, #B7952F 100%)',
    blue: 'radial-gradient(circle at 12% 110%, rgba(243,198,97,.3) 0, transparent 55%), linear-gradient(140deg, #1F78C8 0%, #1A5FA0 55%, #0A3C58 100%)',
  }[tone];
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        font: 'inherit',
        textAlign: 'start',
        cursor: onClick ? 'pointer' : 'default',
        border: 0,
        color: '#fff',
        borderRadius: '18px',
        p: '22px',
        background,
        boxShadow: '0 14px 30px rgba(7,45,67,.3)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 1,
        minHeight: 220,
        minWidth: 0,
        '&:focus-visible': { outline: `2px solid ${md.gold}`, outlineOffset: 2 },
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, fontSize: 14, fontWeight: 700 }}>
        <Box aria-hidden sx={{ width: 34, height: 34, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: md.gold, color: md.navyDeep, '& svg': { fontSize: 20 } }}>
          {icon}
        </Box>
        {label}
      </Stack>
      <Box sx={{ fontSize: 52, fontWeight: 700, lineHeight: 1.1, color: md.gold, fontVariantNumeric: 'tabular-nums' }}>
        <bdi>{value}</bdi>
        <Box component="small" sx={{ fontSize: 16, fontWeight: 600, color: '#fff', marginInlineStart: 1 }}>
          {unit}
        </Box>
      </Box>
      <Typography sx={{ fontSize: 12, opacity: 0.82 }}>{note}</Typography>
    </Box>
  );
}

/** A white card with a navy title (the old «overview-visual-card»). */
export function VisualCard({ title, hint, icon, action, children, sx }: { title: string; hint?: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box sx={{ bgcolor: '#fff', border: `1px solid ${md.border}`, borderRadius: '12px', p: '14px 16px', minWidth: 0, ...(sx as object) }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.25, minWidth: 0 }}>
        {icon && <Box sx={{ color: md.navy, display: 'flex', '& svg': { fontSize: 18 } }}>{icon}</Box>}
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700, color: md.navy }}>
          {title}
        </Typography>
        {hint && <Typography sx={{ fontSize: 11.5, color: md.muted, marginInlineStart: 'auto' }}>{hint}</Typography>}
        {action && <Box sx={{ marginInlineStart: hint ? 1 : 'auto' }}>{action}</Box>}
      </Stack>
      {children}
    </Box>
  );
}

/** A pie as a ring with its legend; clicking a legend line narrows the table to it. */
export function Donut({ items, selected, onSelect, center, size = 112 }: { items: { key: string; label: string; value: number }[]; selected?: string | null; onSelect?: (key: string) => void; center?: ReactNode; size?: number }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const r = 15.915;
  let offset = 0;
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 2, minWidth: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0, maxHeight: 230, overflowY: 'auto', scrollbarWidth: 'thin', pe: 0.5 }}>
        {items.map((item, index) => (
          <Box
            key={item.key}
            component={onSelect ? 'button' : 'div'}
            type={onSelect ? 'button' : undefined}
            onClick={onSelect ? () => onSelect(item.key) : undefined}
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              font: 'inherit',
              fontSize: 12.5,
              color: md.text,
              border: 0,
              bgcolor: selected === item.key ? '#EEF5FA' : 'transparent',
              borderRadius: '8px',
              py: 0.6,
              px: 0.75,
              cursor: onSelect ? 'pointer' : 'default',
              textAlign: 'start',
            }}
          >
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', flex: '0 0 auto', bgcolor: slices[index % slices.length] }} />
            <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>
              <bdi>{item.label}</bdi>
            </Box>
            <Box component="strong" sx={{ color: md.ink, fontVariantNumeric: 'tabular-nums' }}>
              {item.value}
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
        <svg viewBox="0 0 42 42" width={size} height={size} role="img" aria-hidden>
          <circle cx="21" cy="21" r={r} fill="none" stroke={md.track} strokeWidth="7" />
          {total > 0 &&
            items.map((item, index) => {
              const part = (item.value / total) * 100;
              const el = (
                <circle
                  key={item.key}
                  cx="21"
                  cy="21"
                  r={r}
                  fill="none"
                  stroke={slices[index % slices.length]}
                  strokeWidth={selected === item.key ? 8.5 : 7}
                  strokeDasharray={`${part} ${100 - part}`}
                  strokeDashoffset={25 - offset}
                />
              );
              offset += part;
              return el;
            })}
        </svg>
        {center && <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{center}</Box>}
      </Box>
    </Stack>
  );
}

/** Ranked bars (the old «server-bar-chart»): label, a thin rounded track, the count. */
export function BarList({ items, fill = 'linear-gradient(135deg, #22B8E6 0%, #1F5FC2 100%)', selected, onSelect, max = 280 }: { items: { key: string; label: string; value: number; hint?: string }[]; fill?: string; selected?: string | null; onSelect?: (key: string) => void; max?: number }) {
  const top = Math.max(1, ...items.map((i) => i.value));
  return (
    <Box sx={{ maxHeight: max, overflowY: 'auto', scrollbarWidth: 'thin', pe: 0.5 }}>
      {items.map((item) => (
        <Box
          key={item.key}
          component={onSelect ? 'button' : 'div'}
          type={onSelect ? 'button' : undefined}
          onClick={onSelect ? () => onSelect(item.key) : undefined}
          sx={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) 40px',
            alignItems: 'center',
            gap: 1.25,
            font: 'inherit',
            fontSize: 12.5,
            color: md.text,
            border: 0,
            bgcolor: selected === item.key ? '#EEF5FA' : 'transparent',
            borderRadius: '8px',
            py: 0.7,
            px: 0.75,
            cursor: onSelect ? 'pointer' : 'default',
            textAlign: 'start',
          }}
        >
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>
            <bdi>{item.label}</bdi>
          </Box>
          <Box sx={{ height: 8, borderRadius: 999, bgcolor: md.track, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${(item.value / top) * 100}%`, borderRadius: 999, background: fill, marginInlineStart: 'auto' }} />
          </Box>
          <Box component="strong" sx={{ color: md.ink, fontVariantNumeric: 'tabular-nums', textAlign: 'end' }}>
            {item.value}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** The text the search matches. */
  text?: (row: T) => string;
  align?: 'start' | 'end' | 'center';
}

/** The old «exec-table»: a navy header, a search box, Excel, and the rows a page at a time. */
export function DataTable<T>({ title, badge, rows, columns, excel, empty, page = 25, filters }: { title: string; badge?: ReactNode; rows: T[]; columns: Column<T>[]; excel?: string; empty: string; page?: number; filters?: ReactNode }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(page);
  const found = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? rows.filter((r) => columns.some((c) => (c.text?.(r) ?? '').toLowerCase().includes(s))) : rows;
  }, [rows, columns, search]);
  return (
    <Box sx={{ pt: 0.5, minWidth: 0 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography component="h3" sx={{ fontSize: 14.5, fontWeight: 700, color: md.navy }}>
          {title}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {badge && (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11.5, fontWeight: 700, color: md.navy, bgcolor: '#EEF5FA', borderRadius: 999, px: 1.25, py: 0.4, '& svg': { fontSize: 14 } }}>
            {badge}
          </Box>
        )}
        {excel && (
          <Button component="a" href={excel} size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} sx={{ borderRadius: 999, borderColor: md.border, color: md.greenDeep, fontWeight: 700, height: 30 }}>
            {t('mgmt.excel')}
          </Button>
        )}
      </Stack>
      {filters}
      <TextField
        size="small"
        placeholder={t('mgmt.searchTable')}
        value={search}
        onChange={(e) => (setSearch(e.target.value), setShown(page))}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        sx={{ mb: 1, width: { xs: '100%', sm: 320 }, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff' } }}
      />
      <Box sx={{ overflowX: 'auto', border: `1px solid ${md.border}`, borderRadius: '12px' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <Box component="thead">
            <Box component="tr">
              {columns.map((c) => (
                <Box component="th" key={c.key} sx={{ bgcolor: md.navy, color: '#fff', fontSize: 11, fontWeight: 700, px: 1.5, py: 1.25, textAlign: c.align ?? 'start', whiteSpace: 'nowrap', position: 'sticky', top: 0 }}>
                  {c.label}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {found.slice(0, shown).map((row, index) => (
              <Box component="tr" key={index} sx={{ '&:nth-of-type(even)': { bgcolor: '#F7FAFC' }, '&:hover': { bgcolor: '#EEF5FA' } }}>
                {columns.map((c) => (
                  <Box component="td" key={c.key} sx={{ px: 1.5, py: 1.1, borderTop: `1px solid ${md.border}`, color: md.text, textAlign: c.align ?? 'start', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {c.render(row)}
                  </Box>
                ))}
              </Box>
            ))}
            {found.length === 0 && (
              <Box component="tr">
                <Box component="td" colSpan={columns.length} sx={{ textAlign: 'center', color: md.muted, py: 4 }}>
                  {empty}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 1, gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 12, color: md.muted }}>{t('mgmt.showing', { shown: Math.min(shown, found.length), total: found.length })}</Typography>
        {shown < found.length && (
          <Button size="small" onClick={() => setShown((s) => s + page * 4)} sx={{ fontWeight: 700, color: md.navy }}>
            {t('mgmt.showMore')}
          </Button>
        )}
      </Stack>
    </Box>
  );
}

/** A small rounded status pill (the old «exec-pill»). */
export function Pill({ color, bg, children }: { color: string; bg: string; children: ReactNode }) {
  return (
    <Box component="span" sx={{ display: 'inline-block', borderRadius: 999, px: 1.1, py: 0.2, fontSize: 11.5, fontWeight: 700, color, bgcolor: bg, whiteSpace: 'nowrap' }}>
      {children}
    </Box>
  );
}
