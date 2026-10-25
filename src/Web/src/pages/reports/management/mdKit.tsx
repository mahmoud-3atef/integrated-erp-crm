import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, createTheme, InputAdornment, Stack, TextField, ThemeProvider, Tooltip, Typography, type SxProps, type Theme } from '@mui/material';
import { keyframes } from '@emotion/react';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCountUp } from '../../../components/charts';

/**
 * The executive dashboard's night look (the user's request, 2026-10-22): a navy gradient sky with bright stars, glass
 * cards with soft edges and big KPI numbers in a glowing teal. The layout and colours of the old page
 * (ManagementDashboard.aspx) stay; its tones are lifted to read on the dark sky. An exception to the HR tokens, as the
 * employee file is (docs/03-migration-plan/19).
 */
export const md = {
  /** Filled controls on the sky (active pills, avatars, the primary button): white text on it. */
  navy: '#1B6E8F',
  navyDeep: '#155A75',
  navyMid: '#0F4F73',
  /** The sky's own navy. */
  sky: '#061A2B',
  ink: '#EAF4F8',
  title: '#E6F3F8',
  text: '#C9DAE3',
  muted: '#93AABB',
  label: '#A9BFCC',
  border: 'rgba(255,255,255,.12)',
  track: 'rgba(255,255,255,.1)',
  /** A box inside a dark panel (or a panel's flat colour): solid, since the page itself is light (2026-10-25). */
  glass: '#0E2F48',
  glassHi: '#153B59',
  /** The dark panels (tabs, charts, tables) on the system's light page: the night sky's gradient with a faint teal glow. */
  panel:
    'radial-gradient(ellipse at 90% -20%, rgba(45,212,191,.14), transparent 55%), radial-gradient(ellipse at 5% 120%, rgba(56,189,248,.12), transparent 55%), linear-gradient(160deg, #0B2C47 0%, #071F33 55%, #04121F 100%)',
  /** The KPI numbers' glowing teal. */
  glow: '#5EEAD4',
  glowShadow: '0 0 18px rgba(45,212,191,.55), 0 0 2px rgba(94,234,212,.6)',
  teal: '#2CC5C9',
  blue: '#38BDF8',
  green: '#4ADE80',
  greenDeep: '#34D399',
  amber: '#FBBF24',
  amberDeep: '#F59E0B',
  brown: '#D6A06A',
  red: '#F87171',
  gold: '#F3C661',
  coverage: '#12597F',
};

/** The colours of a white table (2026-10-25: the tables are white on the white page). */
export const mdLight = {
  title: '#0F2747',
  text: '#334155',
  muted: '#64748B',
  border: '#E2E8F0',
  head: '#14263D',
  stripe: '#F8FAFC',
  hover: '#EEF4FA',
  track: '#E2E8F0',
  red: '#B42318',
  green: '#16734B',
};

/** Whether a part sits in a white table (pills and cells pick their colours from it). */
const OnWhite = createContext(false);
export const useOnWhite = () => useContext(OnWhite);

/** A dark panel on the page (a chart, a strip): the night sky's gradient, soft edges. */
export const glassCard: SxProps<Theme> = {
  background: md.panel,
  border: `1px solid ${md.border}`,
  borderRadius: '18px',
  color: md.ink,
  boxShadow: '0 10px 26px rgba(4,18,31,.22), inset 0 1px 0 rgba(255,255,255,.08)',
};

/** Stars as small radial dots at fixed places (the same sky every time), in two layers that twinkle apart. */
function stars(count: number, seed: number, bright = false) {
  let x = seed;
  const next = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: count }, () => {
    const at = `${(next() * 100).toFixed(2)}% ${(next() * 100).toFixed(2)}%`;
    if (bright) {
      // A bright star: a white core in a soft blue-teal halo.
      const halo = 5 + Math.round(next() * 3);
      return `radial-gradient(${halo}px ${halo}px at ${at}, #fff 0, rgba(255,255,255,.95) 18%, rgba(165,243,252,.45) 45%, transparent 100%)`;
    }
    const size = next() < 0.2 ? 2 : 1.4;
    const alpha = 0.55 + next() * 0.45;
    return `radial-gradient(${size}px ${size}px at ${at}, rgba(255,255,255,${alpha.toFixed(2)}) 50%, transparent 100%)`;
  }).join(', ');
}
/** The tabs' strip and the KPI band keep a few still stars over the panel's gradient (the night look, on the light page). */
export const starryPanel = `${stars(8, 41, true)}, ${stars(60, 7)}, ${md.panel}`;

/** The white tables keep a light theme for their search field, menus and buttons. */
const light = (outer: Theme) => createTheme(outer, { palette: { mode: 'light', text: { primary: mdLight.text, secondary: mdLight.muted }, background: { paper: '#fff' }, divider: mdLight.border } });

/** The page's own dark theme, so fields, menus, dialogs and tooltips inside it read on the sky. */
const night = (outer: Theme) =>
  createTheme(outer, {
    palette: {
      mode: 'dark',
      primary: { main: md.glow, contrastText: md.sky },
      text: { primary: md.ink, secondary: md.muted, disabled: 'rgba(234,244,248,.45)' },
      background: { default: md.sky, paper: '#0C2A40' },
      divider: md.border,
      action: { active: md.text, hover: 'rgba(255,255,255,.08)', selected: 'rgba(255,255,255,.14)', disabled: 'rgba(255,255,255,.3)', disabledBackground: 'rgba(255,255,255,.12)' },
    },
    components: {
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: md.glass,
            color: md.ink,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,.22)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,.4)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: md.glow },
          },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { color: md.label, '&.Mui-focused': { color: md.glow } } } },
      MuiIconButton: { styleOverrides: { root: { color: md.text, '&:hover': { backgroundColor: 'rgba(255,255,255,.08)' } } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', backgroundColor: '#0C2A40', color: md.ink } } },
      MuiDialogTitle: { styleOverrides: { root: { color: md.title } } },
      MuiTableCell: { styleOverrides: { root: { borderBottomColor: md.border }, body: { color: md.text } } },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: '#0C2A40', border: `1px solid ${md.border}` } } },
      MuiButton: {
        styleOverrides: {
          outlined: { backgroundColor: md.glass, borderColor: 'rgba(255,255,255,.25)', boxShadow: 'none', '&:hover': { backgroundColor: md.glassHi, borderColor: 'rgba(255,255,255,.4)' } },
          text: { color: md.glow },
        },
      },
    },
  });

/**
 * The page's dark theme for its panels, menus, dialogs and tooltips. Since 2026-10-25 the page is white (the user's
 * request): the tabs, the KPI band and the charts are dark panels, and the tables are white.
 */
export function NightSky({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={night}>
      <Box sx={{ minHeight: 'calc(100dvh - 96px)', bgcolor: '#fff', borderRadius: '20px', p: { xs: 1.25, md: 2 }, boxShadow: '0 1px 2px rgba(20,38,61,.06)' }}>{children}</Box>
    </ThemeProvider>
  );
}

/** The slices' colours of the old pies, in order. */
export const slices = ['#1F78C8', '#E8890C', '#2FB344', '#E03434', '#0E7C86', '#0A3C58', '#8A9AA6', '#7C5CBF', '#C2410C', '#0891B2'];

export const panel: SxProps<Theme> = { ...(glassCard as object), p: { xs: 1.5, md: '14px' }, minWidth: 0 };

export const finCard: SxProps<Theme> = { ...(glassCard as object), p: '18px', minWidth: 0 };

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
        background: `linear-gradient(125deg, rgba(27,110,143,.28) 0%, rgba(255,255,255,.04) 55%, rgba(45,212,191,.16) 100%), ${starryPanel}`,
        color: md.ink,
        border: `1px solid ${md.border}`,
        boxShadow: '0 14px 30px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.08)',
      }}
    >
      <Box aria-hidden sx={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', top: -170, insetInlineEnd: -60, background: 'radial-gradient(circle, rgba(45,212,191,.22), transparent 70%)', animation: `${drift} 9s ease-in-out infinite` }} />
      <Box aria-hidden sx={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', bottom: -150, insetInlineStart: '28%', background: 'radial-gradient(circle, rgba(56,189,248,.16), transparent 70%)', animation: `${drift} 12s ease-in-out infinite reverse` }} />
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
        background: glass ? 'rgba(255,255,255,.08)' : md.glass,
        border: `1px solid ${glass ? 'rgba(255,255,255,.18)' : md.border}`,
        borderRadius: '16px',
        backdropFilter: 'blur(12px) saturate(140%)',
        color: md.ink,
        boxShadow: `inset 0 3px 0 ${color}, inset 0 1px 0 rgba(255,255,255,.12), 0 10px 26px rgba(0,0,0,.25)`,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        transition: 'transform .15s, box-shadow .15s',
        '&:hover': onClick ? { transform: 'translateY(-2px)', bgcolor: md.glassHi } : { bgcolor: md.glassHi },
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
          boxShadow: '0 0 0 4px rgba(255,255,255,.14), 0 6px 16px rgba(0,0,0,.35)',
          '& svg': { fontSize: 24 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ px: 2, pt: 2.25, pb: 1.25, pe: '84px', minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 12.5, color: md.label }}>{label}</Typography>
        <Typography component="div" sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 700, color: md.glow, textShadow: md.glowShadow, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
          <bdi>{value}</bdi>
          {unit && (
            <Box component="small" sx={{ fontSize: 12, fontWeight: 500, color: md.muted, textShadow: 'none', marginInlineStart: 0.5 }}>
              {unit}
            </Box>
          )}
        </Typography>
      </Box>
      <Box sx={{ borderTop: `1px solid ${md.border}`, px: 2, py: 1.25, fontSize: 12.5, fontWeight: 600, color: md.text }}>{foot}</Box>
    </Box>
  );
}

/** The big card of a sub-tab: its total on a dark gradient, the number in gold (it resets the table's filter). */
export function HeroTotal({ icon, label, value, unit, note, tone = 'navy', onClick }: { icon: ReactNode; label: string; value: ReactNode; unit: string; note: string; tone?: 'navy' | 'housing' | 'blue'; onClick?: () => void }) {
  const background = {
    navy: 'radial-gradient(circle at 12% 110%, rgba(45,212,191,.22) 0, transparent 55%), radial-gradient(circle at 95% -10%, rgba(56,189,248,.18) 0, transparent 45%), linear-gradient(140deg, rgba(27,110,143,.35) 0%, rgba(255,255,255,.05) 100%)',
    housing: 'radial-gradient(circle at 12% 110%, rgba(243,198,97,.22) 0, transparent 60%), linear-gradient(140deg, rgba(44,197,201,.28) 0%, rgba(255,255,255,.05) 100%)',
    blue: 'radial-gradient(circle at 12% 110%, rgba(56,189,248,.24) 0, transparent 55%), linear-gradient(140deg, rgba(31,120,200,.32) 0%, rgba(255,255,255,.05) 100%)',
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
        border: `1px solid ${md.border}`,
        color: md.ink,
        borderRadius: '18px',
        p: '22px',
        background: `${background}, ${md.panel}`,
        boxShadow: '0 14px 30px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 1,
        minHeight: 220,
        minWidth: 0,
        '&:focus-visible': { outline: `2px solid ${md.glow}`, outlineOffset: 2 },
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, fontSize: 14, fontWeight: 700 }}>
        <Box aria-hidden sx={{ width: 34, height: 34, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: md.gold, color: '#072D43', '& svg': { fontSize: 20 } }}>
          {icon}
        </Box>
        {label}
      </Stack>
      <Box sx={{ fontSize: 52, fontWeight: 700, lineHeight: 1.1, color: md.glow, textShadow: md.glowShadow, fontVariantNumeric: 'tabular-nums' }}>
        <bdi>{value}</bdi>
        <Box component="small" sx={{ fontSize: 16, fontWeight: 600, color: md.text, textShadow: 'none', marginInlineStart: 1 }}>
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
    <Box sx={{ ...(glassCard as object), borderRadius: '16px', p: '14px 16px', minWidth: 0, ...(sx as object) }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.25, minWidth: 0 }}>
        {icon && <Box sx={{ color: md.title, display: 'flex', '& svg': { fontSize: 18 } }}>{icon}</Box>}
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700, color: md.title }}>
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
export function Donut({ items, selected, onSelect, center, size = 112, colors = slices }: { items: { key: string; label: string; value: number }[]; selected?: string | null; onSelect?: (key: string) => void; center?: ReactNode; size?: number; colors?: string[] }) {
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
              bgcolor: selected === item.key ? md.glassHi : 'transparent',
              borderRadius: '8px',
              py: 0.6,
              px: 0.75,
              cursor: onSelect ? 'pointer' : 'default',
              textAlign: 'start',
            }}
          >
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', flex: '0 0 auto', bgcolor: colors[index % colors.length] }} />
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
                  stroke={colors[index % colors.length]}
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
            bgcolor: selected === item.key ? md.glassHi : 'transparent',
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
export function DataTable<T>({ title, badge, rows, columns, excel, empty, page = 25, filters, onRow }: { title: string; badge?: ReactNode; rows: T[]; columns: Column<T>[]; excel?: string; empty: string; page?: number; filters?: ReactNode; onRow?: (row: T) => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(page);
  const found = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? rows.filter((r) => columns.some((c) => (c.text?.(r) ?? '').toLowerCase().includes(s))) : rows;
  }, [rows, columns, search]);
  return (
    <ThemeProvider theme={light}>
      <OnWhite.Provider value>
        <Box sx={{ bgcolor: '#fff', border: `1px solid ${mdLight.border}`, borderRadius: '18px', boxShadow: '0 1px 2px rgba(20,38,61,.05), 0 8px 22px rgba(20,38,61,.06)', p: { xs: 1.5, md: '14px 16px' }, minWidth: 0, color: mdLight.text }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Typography component="h3" sx={{ fontSize: 14.5, fontWeight: 700, color: mdLight.title }}>
              {title}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {badge && (
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11.5, fontWeight: 700, color: mdLight.title, bgcolor: mdLight.stripe, border: `1px solid ${mdLight.border}`, borderRadius: 999, px: 1.25, py: 0.4, '& svg': { fontSize: 14 } }}>
                {badge}
              </Box>
            )}
            {excel && (
              <Button component="a" href={excel} size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} sx={{ borderRadius: 999, borderColor: mdLight.border, color: mdLight.green, fontWeight: 700, height: 30 }}>
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
            sx={{ mb: 1, width: { xs: '100%', sm: 320 }, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
          <Box sx={{ overflowX: 'auto', border: `1px solid ${mdLight.border}`, borderRadius: '12px', bgcolor: '#fff' }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <Box component="thead">
                <Box component="tr">
                  {columns.map((c) => (
                    <Box component="th" key={c.key} sx={{ bgcolor: mdLight.head, color: '#fff', fontSize: 11, fontWeight: 700, px: 1.5, py: 1.25, textAlign: c.align ?? 'start', whiteSpace: 'nowrap', position: 'sticky', top: 0 }}>
                      {c.label}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {found.slice(0, shown).map((row, index) => (
                  <Box
                    component="tr"
                    key={index}
                    tabIndex={onRow ? 0 : undefined}
                    onClick={onRow ? () => onRow(row) : undefined}
                    onKeyDown={onRow ? (e: { key: string }) => e.key === 'Enter' && onRow(row) : undefined}
                    sx={{ cursor: onRow ? 'pointer' : 'default', '&:nth-of-type(even)': { bgcolor: mdLight.stripe }, '&:hover': { bgcolor: mdLight.hover }, '&:focus-visible': { outline: `2px solid ${mdLight.head}`, outlineOffset: -2 } }}
                  >
                    {columns.map((c) => (
                      <Box component="td" key={c.key} sx={{ px: 1.5, py: 1.1, borderTop: `1px solid ${mdLight.border}`, color: mdLight.text, textAlign: c.align ?? 'start', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {c.render(row)}
                      </Box>
                    ))}
                  </Box>
                ))}
                {found.length === 0 && (
                  <Box component="tr">
                    <Box component="td" colSpan={columns.length} sx={{ textAlign: 'center', color: mdLight.muted, py: 4 }}>
                      {empty}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 1, gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 12, color: mdLight.muted }}>{t('mgmt.showing', { shown: Math.min(shown, found.length), total: found.length })}</Typography>
            {shown < found.length && (
              <Button size="small" onClick={() => setShown((s) => s + page * 4)} sx={{ fontWeight: 700, color: mdLight.title }}>
                {t('mgmt.showMore')}
              </Button>
            )}
          </Stack>
        </Box>
      </OnWhite.Provider>
    </ThemeProvider>
  );
}

/** A small rounded status pill (the old «exec-pill»). */
export function Pill({ color, children }: { color: string; bg?: string; children: ReactNode }) {
  // The status colour as a soft tint and edge; the text light on a dark panel, the status colour (darkened) on a white table.
  const white = useOnWhite();
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        borderRadius: 999,
        px: 1.1,
        py: 0.2,
        fontSize: 11.5,
        fontWeight: 700,
        color: white ? `color-mix(in srgb, ${color} 70%, #000)` : md.ink,
        bgcolor: `color-mix(in srgb, ${color} ${white ? 14 : 30}%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} ${white ? 40 : 60}%, transparent)`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
  );
}
