import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import CloseIcon from '@mui/icons-material/Close';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Drawer,
  GlobalStyles,
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { reportsApi, type Drill, type Figure, type Finance, type InvoiceRow, type MoveRow, type Overview } from '../../api/reports';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Columns, RankedBars, Ring } from '../../components/charts';

type Tab = 'overview' | 'finance';
type Preset = 'month' | 'last' | 'quarter' | 'ytd' | 'custom';
type Good = 'up' | 'down' | 'none';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The presets' periods, from today. */
function presetRange(preset: Exclude<Preset, 'custom'>): [string, string] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'last':
      return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    case 'quarter': {
      const q = Math.floor(m / 3) * 3;
      return [iso(new Date(y, q, 1)), iso(new Date(y, q + 3, 0))];
    }
    case 'ytd':
      return [iso(new Date(y, 0, 1)), iso(new Date(y, m + 1, 0))];
    default:
      return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
  }
}

const accents = {
  navy: tokens.navy700,
  teal: '#0e7c86',
  amber: '#d98a06',
  green: '#23a455',
  violet: '#7b5cd6',
  rose: '#e0607e',
} as const;

const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2, minWidth: 0 } as const;

function useFormat() {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  return useMemo(() => {
    const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
    const locale = ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
    const month = new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' });
    const monthOnly = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
    const monthLong = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return {
      n: (v: number) => whole.format(v),
      c: (v: number) => compact.format(v),
      month: (key: string) => month.format(new Date(`${key}-01T00:00:00Z`)),
      monthName: (key: string) => monthOnly.format(new Date(`${key}-01T00:00:00Z`)),
      monthLong: (key: string) => monthLong.format(new Date(`${key}-01T00:00:00Z`)),
      day: (v: string) => v.slice(0, 10).replaceAll('-', '/'),
    };
  }, [ar]);
}

/**
 * The executive report (docs/03-migration-plan/14, phase A): the period and its comparison, the summary written from the
 * numbers, the overview and the finance; any chart opens the list behind it, as Excel too. Every figure comes from the
 * server; an unknown one shows «—».
 */
export function ExecutiveReportPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [tab, setTab] = useState<Tab>('overview');
  const [preset, setPreset] = useState<Preset>('month');
  const [[from, to], setRange] = useState<[string, string]>(() => presetRange('month'));
  const [overview, setOverview] = useState<Overview | null>(null);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ kind: 'moves' | 'invoices'; title: string; drill: Drill } | null>(null);

  useEffect(() => {
    setOverview(null);
    setError(null);
    reportsApi.overview(from, to).then(setOverview).catch((f) => setError(errorKey(f)));
  }, [from, to]);
  useEffect(() => {
    if (tab !== 'finance' || !overview?.financeVisible) return;
    setFinance(null);
    reportsApi.finance(from, to).then(setFinance).catch((f) => setError(errorKey(f)));
  }, [tab, from, to, overview?.financeVisible]);

  if (!can('reports.executive.view', true)) {
    return <Alert severity="warning">{t('exec.noAccess')}</Alert>;
  }

  const choose = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(presetRange(p));
  };
  const presets: Preset[] = ['month', 'last', 'quarter', 'ytd', 'custom'];
  return (
    <Box>
      <GlobalStyles styles={{ '@media print': { aside: { display: 'none !important' }, header: { display: 'none !important' }, '.no-print': { display: 'none !important' }, body: { background: '#fff' } } }} />
      <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 1.5, alignItems: { lg: 'center' }, mb: 1.75 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h1" sx={{ fontSize: 23, fontWeight: 800, color: tokens.navy800 }}>
            {t('exec.title')}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('exec.subtitle')}</Typography>
        </Box>
        <Stack direction="row" className="no-print" sx={{ gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
          {presets.map((p) => (
            <Button
              key={p}
              size="small"
              variant={preset === p ? 'contained' : 'outlined'}
              onClick={() => choose(p)}
              sx={{ borderRadius: 999, px: 1.75, ...(preset === p ? { bgcolor: tokens.navy800 } : { bgcolor: '#fff', borderColor: tokens.border, color: tokens.navy800 }) }}
            >
              {t(`exec.preset.${p}`)}
            </Button>
          ))}
          {preset === 'custom' && (
            <>
              <TextField size="small" type="date" label={t('exec.from')} value={from} onChange={(e) => e.target.value && setRange([e.target.value, to])} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }} />
              <TextField size="small" type="date" label={t('exec.to')} value={to} onChange={(e) => e.target.value && setRange([from, e.target.value])} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }} />
            </>
          )}
          <Button size="small" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()} sx={{ borderRadius: 999, bgcolor: '#fff' }}>
            {t('exec.print')}
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" className="no-print" sx={{ ...card, p: 0.75, gap: 0.5, mb: 1.75, flexWrap: 'wrap' }} role="tablist">
        {(['overview', 'finance'] as Tab[])
          .filter((k) => k !== 'finance' || overview?.financeVisible !== false)
          .map((k) => (
            <ButtonBase
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              sx={{ gap: 1, px: 2, py: 1.1, borderRadius: '10px', fontWeight: 700, fontSize: 13.5, color: tab === k ? '#fff' : tokens.gray600, bgcolor: tab === k ? tokens.navy700 : 'transparent', '& svg': { fontSize: 19 } }}
            >
              {k === 'overview' ? <QueryStatsOutlinedIcon /> : <PaymentsOutlinedIcon />}
              {t(`exec.tabs.${k}`)}
            </ButtonBase>
          ))}
        <Box sx={{ flex: 1 }} />
        {overview && (
          <Typography sx={{ alignSelf: 'center', px: 1.5, fontSize: 12.5, color: tokens.gray500 }}>
            <bdi>{t('exec.comparing', { from: overview.period.from.replaceAll('-', '/'), to: overview.period.to.replaceAll('-', '/'), pfrom: overview.period.previousFrom.replaceAll('-', '/'), pto: overview.period.previousTo.replaceAll('-', '/') })}</bdi>
            {overview.period.movesPreviousTo !== overview.period.previousTo && <> · {t('exec.sameDays', { to: overview.period.movesPreviousTo.replaceAll('-', '/') })}</>}
          </Typography>
        )}
      </Stack>

      <ErrorMessage messageKey={error} />
      {tab === 'overview' ? (
        <OverviewTab data={overview} onDrill={(kind, title, d) => setDrill({ kind, title, drill: d })} />
      ) : (
        <FinanceTab data={finance} onDrill={(title, d) => setDrill({ kind: 'invoices', title, drill: d })} />
      )}
      {drill && <DrillDrawer from={from} to={to} {...drill} onClose={() => setDrill(null)} />}
    </Box>
  );
}

/** A figure's card: its value, the comparison with the period before (the colour follows the meaning), six months. */
function Kpi({ label, figure, value, unit, good = 'none', accent, spark, note, money }: { label: string; figure?: Figure; value?: number | null; unit?: string; good?: Good; accent: string; spark?: (number | null)[]; note?: ReactNode; money?: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const v = figure ? figure.value : (value ?? null);
  const p = figure?.previous ?? null;
  const diff = v !== null && p !== null ? v - p : null;
  const pct = diff !== null && p ? (diff / Math.abs(p)) * 100 : null;
  const tone = diff === null || diff === 0 || good === 'none' ? tokens.gray600 : (diff > 0) === (good === 'up') ? '#047857' : '#B91C1C';
  const shown = (n: number) => (money && Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}` : f.n(n));
  const points = unit === '%';
  const unitShown = money && v !== null && Math.abs(v) >= 1_000_000 ? t('exec.millionSar') : unit;
  const max = Math.max(1, ...(spark ?? []).map((x) => Math.abs(x ?? 0)));
  return (
    <Box sx={{ ...card, position: 'relative', overflow: 'hidden', '&::before': { content: '""', position: 'absolute', insetBlock: 0, insetInlineStart: 0, width: 4, bgcolor: accent } }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.gray600 }}>{label}</Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 800, color: tokens.navy800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>
        {v === null ? (
          <Tooltip title={t('exec.unknown')}>
            <span>—</span>
          </Tooltip>
        ) : (
          <bdi>{shown(v)}</bdi>
        )}{' '}
        {unitShown && <Box component="span" sx={{ fontSize: 12, fontWeight: 500, color: tokens.gray500 }}>{unitShown}</Box>}
      </Typography>
      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tone, minHeight: 17 }}>
        {diff !== null ? (
          <bdi>
            {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {points ? t('exec.points', { value: Math.abs(diff).toFixed(1) }) : pct !== null ? `${Math.abs(pct).toFixed(1)}%` : shown(Math.abs(diff))} ·{' '}
            {t('exec.previous', { value: points ? `${p}%` : money ? f.c(p!) : f.n(p!) })}
          </bdi>
        ) : (
          note
        )}
      </Typography>
      {diff !== null && note && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{note}</Typography>}
      {spark && spark.length > 0 && (
        <Box aria-hidden sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 24, mt: 0.75 }}>
          {spark.map((x, i) => (
            <Box key={i} sx={{ width: 9, height: `${Math.max(8, (Math.abs(x ?? 0) / max) * 100)}%`, borderRadius: '2px 2px 0 0', bgcolor: accent, opacity: i === spark.length - 1 ? 1 : 0.35 }} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function CardTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <Stack direction="row" sx={{ gap: 1, alignItems: 'flex-start', mb: 1.25 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: tokens.navy800 }}>{title}</Typography>
        {hint && <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{hint}</Typography>}
      </Box>
      {action}
    </Stack>
  );
}

function Loading() {
  return (
    <Stack sx={{ gap: 1.5 }}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(6, 1fr)' } }}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={118} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={110} />
      <Skeleton variant="rounded" height={300} />
    </Stack>
  );
}

/** The summary for senior management, written from the figures (nothing typed by hand). */
function Insights({ data }: { data: Overview }) {
  const { t } = useTranslation();
  const f = useFormat();
  const lines: string[] = [];
  const s = data.starts.value ?? 0;
  const ps = data.starts.previous;
  lines.push(ps === null ? t('exec.ins.starts', { count: f.n(s) }) : t(s >= ps ? 'exec.ins.startsUp' : 'exec.ins.startsDown', { count: f.n(s), diff: f.n(Math.abs(s - ps)) }));
  lines.push(t('exec.ins.net', { net: f.n(data.net.value ?? 0), starts: f.n(s), returns: f.n(data.returns.value ?? 0) }));
  if (data.startsByManager[0]) lines.push(t('exec.ins.topManager', { name: data.startsByManager[0].name, count: f.n(data.startsByManager[0].count) }));
  if (data.financeVisible && data.collectionRate.value !== null) {
    lines.push(
      data.collectionRate.previous === null
        ? t('exec.ins.rate', { rate: data.collectionRate.value })
        : t('exec.ins.rateCompare', { rate: data.collectionRate.value, previous: data.collectionRate.previous }),
    );
  }
  if (data.financeVisible && data.overdue60 > 0) lines.push(t('exec.ins.overdue', { amount: f.n(data.overdue60), share: data.totalDebt > 0 ? Math.round((data.overdue60 * 100) / data.totalDebt) : 0 }));
  if (data.financeVisible && data.coverage.month && data.coverage.missing + data.coverage.partial > 0) {
    lines.push(t('exec.ins.coverage', { month: f.monthLong(data.coverage.month), count: data.coverage.missing + data.coverage.partial, workers: f.n(data.coverage.workersNotInvoiced) }));
  }
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', background: `linear-gradient(90deg, ${tokens.navy700}, #12597f)`, color: '#fff', borderRadius: `${tokens.radiusLg}px`, p: 2, mb: 1.75 }}>
      <LightbulbOutlinedIcon sx={{ color: '#FCD34D', mt: 0.25 }} />
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{t('exec.ins.title')}</Typography>
        <Box component="ul" sx={{ m: 0, paddingInlineStart: 2.25, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 3, rowGap: 0.5, fontSize: 13 }}>
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function OverviewTab({ data, onDrill }: { data: Overview | null; onDrill: (kind: 'moves' | 'invoices', title: string, drill: Drill) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  if (!data) return <Loading />;
  const months = data.moves.map((m) => f.monthName(m.month));
  const c = data.coverage;
  const covTotal = c.full + c.partial + c.missing;
  return (
    <Box>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' }, mb: 1.75 }}>
        <Kpi label={t('exec.kpi.onJob')} value={data.onJob} unit={t('exec.worker')} accent={accents.navy} note={t('exec.kpi.activeProjects', { count: f.n(data.activeProjects) })} />
        <Kpi label={t('exec.kpi.starts')} figure={data.starts} unit={t('exec.worker')} good="up" accent={accents.teal} spark={data.moves.map((m) => m.starts)} />
        <Kpi label={t('exec.kpi.net')} figure={data.net} good="up" accent={accents.green} spark={data.moves.map((m) => m.starts - m.returns)} note={t('exec.kpi.netNote', { starts: f.n(data.starts.value ?? 0), returns: f.n(data.returns.value ?? 0) })} />
        <Kpi label={t('exec.kpi.inHousing')} value={data.inHousing} unit={t('exec.worker')} accent={accents.amber} note={t('exec.kpi.inHousingNote')} />
        <Kpi label={t('exec.kpi.invoiced')} figure={data.invoiced} unit={t('exec.sar')} money good="up" accent={accents.violet} spark={data.money.map((m) => m.invoiced)} note={data.invoiceCount.value !== null ? t('exec.kpi.invoiceCount', { count: f.n(data.invoiceCount.value) }) : undefined} />
        <Kpi label={t('exec.kpi.rate')} figure={data.collectionRate} unit="%" good="up" accent={accents.rose} spark={data.money.map((m) => m.rate)} note={data.financeVisible ? t('exec.kpi.overdue', { amount: f.n(data.overdue60) }) : undefined} />
      </Box>
      <Insights data={data} />
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' }, mb: 1.75 }}>
        <Box sx={card}>
          <CardTitle title={t('exec.moves.title')} hint={t('exec.moves.hint')} />
          <Columns
            categories={months}
            series={[
              { key: 'starts', label: t('exec.moves.starts'), color: tokens.navy700 },
              { key: 'returns', label: t('exec.moves.returns'), color: accents.amber },
            ]}
            values={[data.moves.map((m) => m.starts), data.moves.map((m) => m.returns)]}
            onPick={(i) => onDrill('moves', t('exec.drill.month', { month: f.monthLong(data.moves[i]!.month) }), { month: data.moves[i]!.month })}
          />
          <Legend items={[[t('exec.moves.starts'), tokens.navy700], [t('exec.moves.returns'), accents.amber]]} />
        </Box>
        <Box sx={card}>
          <CardTitle title={t('exec.managers.title')} hint={t('exec.managers.hint')} />
          {data.startsByManager.length === 0 ? (
            <Empty />
          ) : (
            <RankedBars items={data.startsByManager.slice(0, 8).map((r) => ({ key: r.key, label: r.name, value: r.count }))} onClick={(key) => onDrill('moves', t('exec.drill.manager', { name: key }), { manager: key, kind: 'Work' })} />
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' } }}>
        <Box sx={card}>
          <CardTitle title={t('exec.projects.title')} hint={t('exec.projects.hint')} />
          {data.projects.length === 0 ? (
            <Empty />
          ) : (
            <Stack sx={{ gap: 1 }}>
              {data.projects.map((p) => {
                const max = Math.max(1, ...data.projects.map((x) => x.starts + x.returns));
                return (
                  <ButtonBase
                    key={p.projectCrmId ?? p.name}
                    onClick={() => p.projectCrmId && onDrill('moves', p.name, { project: p.projectCrmId })}
                    sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 220px) 1fr 64px', gap: 1, alignItems: 'center', textAlign: 'start', borderRadius: '8px', px: 0.5, py: 0.25, '&:hover': { bgcolor: tokens.navy50 } }}
                  >
                    <Typography noWrap sx={{ fontSize: 12.5 }} title={p.name}>
                      {p.name}
                    </Typography>
                    <Box sx={{ display: 'flex', height: 9, borderRadius: 5, overflow: 'hidden', bgcolor: tokens.gray100 }}>
                      <Box sx={{ width: `${(p.starts / max) * 100}%`, bgcolor: tokens.navy700 }} />
                      <Box sx={{ width: `${(p.returns / max) * 100}%`, bgcolor: accents.amber }} />
                    </Box>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, textAlign: 'end' }}>
                      <bdi>{`${p.starts} / ${p.returns}`}</bdi>
                    </Typography>
                  </ButtonBase>
                );
              })}
              <Legend items={[[t('exec.moves.starts'), tokens.navy700], [t('exec.moves.returns'), accents.amber]]} />
            </Stack>
          )}
        </Box>
        {data.financeVisible && (
          <Box sx={card}>
            <CardTitle title={c.month ? t('exec.coverage.title', { month: f.monthLong(c.month) }) : t('exec.coverage.titleNone')} hint={t('exec.coverage.hint')} />
            {covTotal === 0 ? (
              <Empty />
            ) : (
              <>
                <Stack direction="row" sx={{ gap: 2, alignItems: 'center', mb: 1.25 }}>
                  <Ring percent={Math.round(((c.full + c.partial) * 100) / covTotal)} color={accents.green} size={118} label={t('exec.coverage.invoiced')}>
                    <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{`${Math.round(((c.full + c.partial) * 100) / covTotal)}%`}</Typography>
                  </Ring>
                  <Stack sx={{ gap: 0.6, fontSize: 12.5 }}>
                    <Dot color={accents.green} text={t('exec.coverage.full', { count: c.full })} />
                    <Dot color={accents.amber} text={t('exec.coverage.partial', { count: c.partial })} />
                    <Dot color={accents.rose} text={t('exec.coverage.missing', { count: c.missing })} />
                    <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('exec.coverage.workers', { count: f.n(c.workersNotInvoiced) })}</Typography>
                  </Stack>
                </Stack>
                <Stack sx={{ gap: 0.5 }}>
                  {c.gaps.slice(0, 6).map((g) => (
                    <Stack key={g.projectCrmId} direction="row" sx={{ gap: 1, fontSize: 12, borderBottom: `1px solid ${tokens.gray100}`, py: 0.5 }}>
                      <Typography noWrap sx={{ flex: 1, fontSize: 12 }} title={g.name}>
                        {g.name}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: g.hasInvoice ? accents.amber : accents.rose, fontWeight: 700 }}>
                        {g.hasInvoice ? t('exec.coverage.gapPartial', { invoiced: g.invoiced, worked: g.worked }) : t('exec.coverage.gapMissing', { worked: g.worked })}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function FinanceTab({ data, onDrill }: { data: Finance | null; onDrill: (title: string, drill: Drill) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const f = useFormat();
  if (!data) return <Loading />;
  const months = data.money.map((m) => f.monthName(m.month));
  const agingColors = [accents.green, accents.teal, accents.amber, accents.rose, '#9F1239'];
  return (
    <Box>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' }, mb: 1.75 }}>
        <Kpi label={t('exec.fin.invoiced')} figure={data.invoiced} unit={t('exec.sar')} money good="up" accent={accents.green} spark={data.money.map((m) => m.invoiced)} note={t('exec.fin.invoicedNote', { count: f.n(data.invoiceCount.value ?? 0), vat: f.n(data.vat.value ?? 0) })} />
        <Kpi label={t('exec.fin.collected')} figure={data.collected} unit={t('exec.sar')} money good="up" accent={accents.violet} spark={data.money.map((m) => m.collected)} />
        <Kpi label={t('exec.fin.rate')} figure={data.collectionRate} unit="%" good="up" accent={accents.teal} spark={data.money.map((m) => m.rate)} />
        <Kpi label={t('exec.fin.debt')} value={data.totalDebt} unit={t('exec.sar')} money accent={accents.navy} note={t('exec.fin.debtNote', { count: f.n(data.openInvoices) })} />
        <Kpi label={t('exec.fin.overdue')} value={data.overdue60} unit={t('exec.sar')} money accent={accents.rose} note={t('exec.fin.overdueNote', { count: f.n(data.overdue60Invoices), share: data.overdue60Share ?? 0 })} />
        <Kpi label={t('exec.fin.dso')} value={data.dso} unit={t('exec.days')} accent={accents.amber} note={t('exec.fin.dsoNote')} />
      </Box>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' }, mb: 1.75 }}>
        <Box sx={card}>
          <CardTitle title={t('exec.fin.trend')} hint={t('exec.fin.trendHint')} />
          <Columns
            categories={months}
            series={[
              { key: 'invoiced', label: t('exec.fin.invoicedShort'), color: accents.green },
              { key: 'collected', label: t('exec.fin.collectedShort'), color: accents.violet },
            ]}
            values={[data.money.map((m) => m.invoiced), data.money.map((m) => m.collected)]}
            format={f.c}
            line={{ label: t('exec.fin.rate'), values: data.money.map((m) => m.rate), color: tokens.navy800 }}
            onPick={(i) => onDrill(t('exec.drill.month', { month: f.monthLong(data.money[i]!.month) }), { month: data.money[i]!.month })}
          />
          <Legend items={[[t('exec.fin.invoicedShort'), accents.green], [t('exec.fin.collectedShort'), accents.violet], [t('exec.fin.rateLine'), tokens.navy800]]} />
        </Box>
        <Box sx={card}>
          <CardTitle title={t('exec.fin.aging')} hint={t('exec.fin.agingHint')} />
          <Box sx={{ display: 'flex', height: 22, borderRadius: '7px', overflow: 'hidden', mb: 1.25, bgcolor: tokens.gray100 }}>
            {data.aging.map((a) => (
              <Tooltip key={a.bucket} title={`${t(`exec.bucket.${a.bucket}`)}: ${f.n(a.amount)}`}>
                <Box sx={{ width: `${a.percent}%`, bgcolor: agingColors[a.bucket - 1] }} />
              </Tooltip>
            ))}
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('exec.fin.bucket')}</TableCell>
                <TableCell align="right">{t('exec.fin.amount')}</TableCell>
                <TableCell align="right">{t('exec.fin.invoices')}</TableCell>
                <TableCell align="right">%</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.aging.map((a) => (
                <TableRow key={a.bucket} hover sx={{ cursor: a.count ? 'pointer' : 'default' }} onClick={() => a.count && onDrill(t(`exec.bucket.${a.bucket}`), { bucket: a.bucket })}>
                  <TableCell>
                    <Dot color={agingColors[a.bucket - 1]!} text={t(`exec.bucket.${a.bucket}`)} />
                  </TableCell>
                  <TableCell align="right">{f.n(a.amount)}</TableCell>
                  <TableCell align="right">{a.count}</TableCell>
                  <TableCell align="right">{a.percent}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' }, mb: 1.75 }}>
        <Box sx={card}>
          <CardTitle title={t('exec.fin.debtors')} hint={t('exec.fin.debtorsHint')} />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('exec.fin.project')}</TableCell>
                  <TableCell>{t('exec.fin.manager')}</TableCell>
                  <TableCell align="right">{t('exec.fin.outstanding')}</TableCell>
                  <TableCell align="right">{t('exec.fin.oldest')}</TableCell>
                  <TableCell align="right">{t('exec.fin.collectedPct')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.debtors.map((d) => (
                  <TableRow key={d.projectCrmId ?? d.name} hover sx={{ cursor: 'pointer' }} onClick={() => onDrill(d.name, { project: d.projectCrmId, open: true })}>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>{d.manager ?? '—'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {f.n(d.outstanding)}
                    </TableCell>
                    <TableCell align="right">{t('exec.daysCount', { count: d.oldestDays })}</TableCell>
                    <TableCell align="right">
                      <RatePill rate={d.rate} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        <Box sx={card}>
          <CardTitle title={t('exec.fin.managers')} hint={t('exec.fin.managersHint')} />
          {data.managers.length === 0 ? (
            <Empty />
          ) : (
            <Stack sx={{ gap: 1 }}>
              {data.managers.slice(0, 8).map((m) => (
                <ButtonBase key={m.manager} onClick={() => onDrill(m.manager, { manager: m.manager })} sx={{ display: 'block', textAlign: 'start', borderRadius: '8px', px: 0.5, '&:hover': { bgcolor: tokens.navy50 } }}>
                  <Stack direction="row" sx={{ gap: 1, mb: 0.4, alignItems: 'baseline' }}>
                    <Typography noWrap sx={{ flex: 1, fontSize: 12.5 }}>
                      {m.manager}
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t('exec.fin.managerLeft', { amount: f.n(m.outstanding) })}</Typography>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: rateColor(m.rate) }}>{`${m.rate}%`}</Typography>
                  </Stack>
                  <Box sx={{ height: 8, borderRadius: 4, bgcolor: tokens.gray100, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${Math.min(100, m.rate)}%`, bgcolor: rateColor(m.rate), borderRadius: 4 }} />
                  </Box>
                </ButtonBase>
              ))}
            </Stack>
          )}
          {data.statuses.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.75 }}>{t('exec.fin.statuses')}</Typography>
              <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                {data.statuses.map((s) => (
                  <ButtonBase key={s.code} onClick={() => onDrill(ar ? s.nameAr : s.nameEn, { status: s.code })} sx={{ px: 1.25, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy800, fontSize: 12, fontWeight: 600 }}>
                    {ar ? s.nameAr : s.nameEn} · {s.count}
                  </ButtonBase>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </Box>
      <Box sx={card}>
        <CardTitle
          title={t('exec.fin.list')}
          hint={t('exec.fin.listHint', { shown: data.invoices.length, total: data.invoicesTotal })}
          action={
            <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} component="a" href={reportsApi.invoicesExcel(data.period.from, data.period.to, {})} className="no-print">
              {t('exec.excel')}
            </Button>
          }
        />
        <InvoiceTable rows={data.invoices} />
      </Box>
    </Box>
  );
}

function rateColor(rate: number) {
  return rate >= 75 ? '#047857' : rate >= 40 ? '#B45309' : '#B91C1C';
}

function RatePill({ rate }: { rate: number }) {
  const bg = rate >= 75 ? '#D1FAE5' : rate >= 40 ? '#FEF3C7' : '#FEE2E2';
  return <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: 11.5, fontWeight: 700, bgcolor: bg, color: rateColor(rate) }}>{`${rate}%`}</Box>;
}

function Dot({ color, text }: { color: string; text: string }) {
  return (
    <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center' }}>
      <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color, flex: '0 0 auto' }} />
      <Typography sx={{ fontSize: 12.5 }}>{text}</Typography>
    </Stack>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <Stack direction="row" sx={{ gap: 2, mt: 1, flexWrap: 'wrap' }}>
      {items.map(([label, color]) => (
        <Dot key={label} color={color} text={label} />
      ))}
    </Stack>
  );
}

function Empty() {
  const { t } = useTranslation();
  return <Typography sx={{ fontSize: 13, color: tokens.gray500, py: 3, textAlign: 'center' }}>{t('exec.empty')}</Typography>;
}

function InvoiceTable({ rows }: { rows: InvoiceRow[] }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const f = useFormat();
  if (rows.length === 0) return <Empty />;
  return (
    <TableContainer sx={{ maxHeight: 520 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>{t('exec.fin.invoice')}</TableCell>
            <TableCell>{t('exec.fin.project')}</TableCell>
            <TableCell>{t('exec.fin.manager')}</TableCell>
            <TableCell align="right">{t('exec.fin.workers')}</TableCell>
            <TableCell align="right">{t('exec.fin.total')}</TableCell>
            <TableCell align="right">{t('exec.fin.collectedShort')}</TableCell>
            <TableCell align="right">{t('exec.fin.outstanding')}</TableCell>
            <TableCell align="right">{t('exec.fin.collectedPct')}</TableCell>
            <TableCell>{t('exec.fin.status')}</TableCell>
            <TableCell>{t('exec.fin.periodEnd')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.crmId} hover>
              <TableCell>
                <bdi>{r.no}</bdi>
              </TableCell>
              <TableCell>{r.projectName}</TableCell>
              <TableCell>{r.manager ?? '—'}</TableCell>
              <TableCell align="right">{r.workers}</TableCell>
              <TableCell align="right">{f.n(r.total)}</TableCell>
              <TableCell align="right">{f.n(r.collected)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {f.n(r.remaining)}
              </TableCell>
              <TableCell align="right">
                <RatePill rate={r.rate} />
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{ar ? r.statusAr : r.statusEn}</TableCell>
              <TableCell>
                <bdi>{f.day(r.to)}</bdi>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** The list behind a clicked figure, with its Excel. */
function DrillDrawer({ from, to, kind, title, drill, onClose }: { from: string; to: string; kind: 'moves' | 'invoices'; title: string; drill: Drill; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [moves, setMoves] = useState<MoveRow[] | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    if (kind === 'moves') reportsApi.moves(from, to, drill).then(setMoves).catch((e) => setError(errorKey(e)));
    else reportsApi.invoices(from, to, drill).then(setInvoices).catch((e) => setError(errorKey(e)));
  }, [kind, from, to, drill]);
  useEffect(load, [load]);
  const rows = kind === 'moves' ? moves : invoices;
  return (
    <Drawer anchor="left" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', md: 760 }, p: 2 } } }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: tokens.navy50, color: tokens.navy700, display: 'grid', placeItems: 'center' }}>
          {kind === 'moves' ? <EngineeringOutlinedIcon /> : drill.open ? <ApartmentOutlinedIcon /> : <InsightsOutlinedIcon />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 800, fontSize: 16 }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{rows ? t('exec.drill.count', { count: rows.length }) : ' '}</Typography>
        </Box>
        <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} component="a" href={kind === 'moves' ? reportsApi.movesExcel(from, to, drill) : reportsApi.invoicesExcel(from, to, drill)}>
          {t('exec.excel')}
        </Button>
        <IconButton onClick={onClose} aria-label={t('common.close')}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <ErrorMessage messageKey={error} />
      {!rows ? (
        <LinearProgress />
      ) : kind === 'invoices' ? (
        <InvoiceTable rows={invoices ?? []} />
      ) : (moves ?? []).length === 0 ? (
        <Empty />
      ) : (
        <TableContainer sx={{ maxHeight: 'calc(100vh - 120px)' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>{t('exec.drill.worker')}</TableCell>
                <TableCell>{t('exec.drill.kind')}</TableCell>
                <TableCell>{t('exec.drill.on')}</TableCell>
                <TableCell>{t('exec.fin.project')}</TableCell>
                <TableCell>{t('exec.fin.manager')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(moves ?? []).map((m, i) => (
                <TableRow key={`${m.workerNo}-${m.on}-${i}`} hover>
                  <TableCell>
                    <Typography dir="auto" sx={{ fontSize: 12.5, fontWeight: 600, unicodeBidi: 'plaintext', textAlign: 'start' }}>
                      {m.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>
                      <bdi>{m.workerNo}</bdi>
                    </Typography>
                  </TableCell>
                  <TableCell>{t(`exec.drill.${m.kind}`)}</TableCell>
                  <TableCell>
                    <bdi>{f.day(m.on)}</bdi>
                  </TableCell>
                  <TableCell>{m.project ?? '—'}</TableCell>
                  <TableCell>{m.manager ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Drawer>
  );
}
