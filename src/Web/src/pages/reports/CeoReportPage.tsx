import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import CloseIcon from '@mui/icons-material/Close';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Drawer,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { ceoApi, movementApi, reportsApi, type CeoOverview, type Movement, type CeoProfit, type Drill, type Finance, type ProjectProfit, type WorkerProfit, type WorkerProfitQuery } from '../../api/reports';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Columns } from '../../components/charts';
import { accents, appear, card, CardTitle, Empty, Hero, Kpi, Legend, Loading, PrintStyles, Ticker, useFormat, useMark } from './reportKit';
import { DrillDrawer, FinanceTab } from './ExecutiveReportPage';
import { ProjectCost, WorkerCost } from './CostBreakdown';

type Tab = 'overview' | 'profit' | 'workforce' | 'finance';
type Open = { title: string; query: WorkerProfitQuery };

const positive = '#059669';
const negative = '#DC2626';
const profitColor = (v: number) => (v < 0 ? negative : positive);

/**
 * The CEO report (docs/03-migration-plan/16): the company's state in an invoiced month — profit and loss against the
 * month before, where the money goes, what needs a decision — then the profitability of the projects, the suppliers
 * and each worker, the workforce and housing now, and the finance. Every figure comes from the server.
 */
export function CeoReportPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const f = useFormat();
  const [tab, setTab] = useState<Tab>('overview');
  const [month, setMonth] = useState<string | null>(null);
  const [overview, setOverview] = useState<CeoOverview | null | undefined>(undefined);
  const [open, setOpen] = useState<Open | null>(null);
  const [error, setError] = useState<string | null>(null);
  const profitAllowed = can('reports.profit.view', true);

  useEffect(() => {
    if (!profitAllowed) return;
    setOverview(undefined);
    setError(null);
    ceoApi
      .overview(month)
      .then((o) => setOverview(o ?? null))
      .catch((e) => setError(errorKey(e)));
  }, [month, profitAllowed]);

  if (!can('reports.executive.view', true)) return <Alert severity="warning">{t('exec.noAccess')}</Alert>;
  if (!profitAllowed) return <Alert severity="warning">{t('ceo.noProfit')}</Alert>;

  const shown = overview?.month ?? month;
  const tabs: { key: Tab; icon: ReactNode }[] = [
    { key: 'overview', icon: <InsightsOutlinedIcon /> },
    { key: 'profit', icon: <ShowChartOutlinedIcon /> },
    { key: 'workforce', icon: <GroupsOutlinedIcon /> },
    ...(can('billing.invoices.view', true) ? [{ key: 'finance' as Tab, icon: <PaymentsOutlinedIcon /> }] : []),
  ];
  return (
    <Box>
      <PrintStyles />
      <Stack direction="row" className="no-print" sx={{ ...card, p: 0.75, gap: 0.5, mb: 1.75, flexWrap: 'wrap', alignItems: 'center' }} role="tablist">
        {tabs.map((k) => (
          <ButtonBase
            key={k.key}
            role="tab"
            aria-selected={tab === k.key}
            onClick={() => setTab(k.key)}
            sx={{ gap: 1, px: 2, py: 1.1, borderRadius: '10px', fontWeight: 700, fontSize: 13.5, color: tab === k.key ? '#fff' : tokens.gray600, bgcolor: tab === k.key ? tokens.navy700 : 'transparent', '& svg': { fontSize: 19 } }}
          >
            {k.icon}
            {t(`ceo.tabs.${k.key}`)}
          </ButtonBase>
        ))}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 12.5, color: tokens.gray500, px: 1 }}>{t('ceo.invoicedMonth')}</Typography>
        {(overview?.months ?? []).slice(0, 6).map((m) => (
          <ButtonBase
            key={m}
            onClick={() => setMonth(m)}
            aria-pressed={shown === m}
            sx={{ px: 1.5, py: 0.75, borderRadius: 99, fontSize: 12.5, fontWeight: 700, border: `1px solid ${shown === m ? tokens.navy800 : tokens.gray200}`, bgcolor: shown === m ? tokens.navy800 : '#fff', color: shown === m ? '#fff' : tokens.navy800 }}
          >
            {f.monthLong(m)}
          </ButtonBase>
        ))}
        <IconButton onClick={() => window.print()} aria-label={t('exec.print')}>
          <PrintOutlinedIcon />
        </IconButton>
      </Stack>
      <ErrorMessage messageKey={error} />
      {overview === undefined ? (
        !error && <Loading />
      ) : overview === null ? (
        <Alert severity="info">{t('ceo.noInvoices')}</Alert>
      ) : tab === 'overview' ? (
        <OverviewTab key={overview.month} data={overview} onOpen={setOpen} onTab={setTab} />
      ) : tab === 'profit' ? (
        <ProfitTab key={overview.month} month={overview.month} onOpen={setOpen} />
      ) : tab === 'workforce' ? (
        <WorkforceTab key={overview.month} data={overview} month={overview.month} />
      ) : (
        <FinanceMonth key={overview.month} month={overview.month} />
      )}
      {open && overview && <WorkersDrawer month={overview.month} {...open} onClose={() => setOpen(null)} />}
    </Box>
  );
}

function useMoney() {
  const f = useFormat();
  return (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : f.n(v));
}

function OverviewTab({ data, onOpen, onTab }: { data: CeoOverview; onOpen: (o: Open) => void; onTab: (t: Tab) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const money = useMoney();
  const mark = useMark();
  const a = data.alerts;
  const lines: string[] = [];
  if (data.profit.value !== null) lines.push(mark('ceo.ins.profit', { profit: money(data.profit.value), margin: data.margin.value ?? 0 }));
  if (data.margin.previous !== null && data.margin.value !== null) lines.push(mark(data.margin.value >= data.margin.previous ? 'ceo.ins.marginUp' : 'ceo.ins.marginDown', { diff: Math.abs(data.margin.value - data.margin.previous).toFixed(1) }));
  if (a.losingProjects) lines.push(mark('ceo.ins.losing', { count: a.losingProjects, total: money(Math.abs(a.losingTotal)) }));
  if (a.unbilledProjects) lines.push(mark('ceo.ins.unbilled', { count: a.unbilledWorkers, projects: a.unbilledProjects }));
  if (data.uncostedWorkers) lines.push(mark('ceo.ins.uncosted', { count: data.uncostedWorkers, revenue: money(data.uncostedRevenue) }));
  if (data.lostRevenue.value) lines.push(mark('ceo.ins.lost', { revenue: money(data.lostRevenue.value), days: f.n(data.housingDays), profit: money(data.lostProfit.value ?? 0) }));
  if (data.collectionRate.value !== null) lines.push(mark('ceo.ins.collection', { rate: data.collectionRate.value }));

  const steps = [
    { key: 'Revenue', amount: data.revenue.value ?? 0 },
    ...(data.uncostedRevenue ? [{ key: 'Uncosted', amount: -data.uncostedRevenue }] : []),
    ...data.breakdown.filter((b) => b.amount !== 0).map((b) => ({ key: b.key, amount: -b.amount })),
  ];
  const top = Math.max(1, data.revenue.value ?? 0);
  let run = top;
  const colors: Record<string, string> = { Revenue: tokens.navy700, Uncosted: '#94A3B8', CompanySalaries: accents.amber, SupplierCosts: '#b45309', IdleCost: negative, WorkerExpenses: accents.violet, ProjectExpenses: accents.teal, GeneralExpenses: tokens.gray500 };

  return (
    <Box>
      <Hero>
        <Kpi index={0} label={t('ceo.kpi.revenue')} icon={<ReceiptLongOutlinedIcon />} figure={data.revenue} unit={t('exec.sar')} money good="up" spark={data.trend.map((x) => x.revenue)} note={t('ceo.kpi.revenueNote')} />
        <Kpi index={1} label={t('ceo.kpi.cost')} icon={<PaymentsOutlinedIcon />} figure={data.cost} unit={t('exec.sar')} money good="down" spark={data.trend.map((x) => x.cost)} note={t('ceo.kpi.costNote')} />
        <Kpi index={2} label={t('ceo.kpi.profit')} icon={<TrendingUpOutlinedIcon />} figure={data.profit} unit={t('exec.sar')} money good="up" spark={data.trend.map((x) => x.profit)} />
        <Kpi index={3} label={t('ceo.kpi.margin')} icon={<PercentOutlinedIcon />} figure={data.margin} unit="%" good="up" note={data.uncostedWorkers ? t('ceo.kpi.marginNote', { count: data.uncostedWorkers }) : undefined} />
        <Kpi index={4} label={t('ceo.kpi.idle')} icon={<BedOutlinedIcon />} figure={data.idleCost} unit={t('exec.sar')} money good="down" note={t('ceo.kpi.idleNote', { count: f.n(data.idleDays) })} onClick={() => onOpen({ title: t('ceo.kpi.idle'), query: { housing: true } })} />
        <Kpi index={5} label={t('ceo.kpi.lost')} icon={<HourglassBottomOutlinedIcon />} figure={data.lostRevenue} unit={t('exec.sar')} money good="down" note={t('ceo.kpi.lostNote', { days: f.n(data.housingDays), profit: f.n(data.lostProfit.value ?? 0) })} onClick={() => onOpen({ title: t('ceo.kpi.lost'), query: { lost: true } })} />
      </Hero>
      <Ticker lines={lines} />

      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' }, mb: 1.75 }}>
        <Box sx={{ ...card, ...appear(0.35) }}>
          <CardTitle icon={<ShowChartOutlinedIcon />} title={t('ceo.flow.title')} hint={t('ceo.flow.hint', { month: f.monthLong(data.month) })} />
          <Stack sx={{ gap: 1 }}>
            {steps.map((s, i) => {
              const width = (Math.abs(s.amount) / top) * 100;
              const start = s.key === 'Revenue' ? 0 : ((run + s.amount) / top) * 100;
              if (s.key !== 'Revenue') run += s.amount;
              return (
                <Box key={s.key} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 210px) 1fr 120px', gap: 1.25, alignItems: 'center' }}>
                  <Typography noWrap sx={{ fontSize: 12.5 }}>
                    {s.key === 'Revenue' ? '' : '− '}
                    {t(`ceo.flow.${s.key}`)}
                  </Typography>
                  <Box sx={{ position: 'relative', height: 22, borderRadius: '6px', bgcolor: tokens.gray100, overflow: 'hidden' }}>
                    <Box sx={{ position: 'absolute', top: 0, bottom: 0, insetInlineStart: `${Math.max(0, start)}%`, width: `${Math.max(0.5, width)}%`, borderRadius: '6px', bgcolor: colors[s.key] ?? tokens.gray500, ...appear(0.4 + i * 0.05) }} />
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, textAlign: 'end', color: s.amount < 0 ? negative : tokens.navy800, fontVariantNumeric: 'tabular-nums' }}>
                    <bdi>{f.n(s.amount)}</bdi>
                  </Typography>
                </Box>
              );
            })}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 210px) 1fr 120px', gap: 1.25, alignItems: 'center', borderTop: `1px dashed ${tokens.gray200}`, pt: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 800 }}>= {t('ceo.kpi.profit')}</Typography>
              <Box sx={{ position: 'relative', height: 22, borderRadius: '6px', bgcolor: tokens.gray100, overflow: 'hidden' }}>
                <Box sx={{ position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0, width: `${Math.max(0.5, (Math.abs(data.profit.value ?? 0) / top) * 100)}%`, borderRadius: '6px', bgcolor: profitColor(data.profit.value ?? 0) }} />
              </Box>
              <Typography sx={{ fontSize: 14, fontWeight: 800, textAlign: 'end', color: profitColor(data.profit.value ?? 0) }}>
                <bdi>{f.n(data.profit.value ?? 0)}</bdi>
              </Typography>
            </Box>
          </Stack>
          <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mt: 1.25 }}>{t('ceo.flow.note')}</Typography>
        </Box>

        <Box sx={{ ...card, ...appear(0.43) }}>
          <CardTitle icon={<WarningAmberOutlinedIcon />} title={t('ceo.alerts.title')} hint={t('ceo.alerts.hint')} />
          <Stack sx={{ gap: 1 }}>
            {a.losingProjects > 0 && <AlertRow tone={negative} icon={<TrendingDownOutlinedIcon />} text={t('ceo.alerts.losing', { count: a.losingProjects, total: f.n(Math.abs(a.losingTotal)), worst: a.worstProject ?? '—', loss: f.n(Math.abs(a.worstLoss ?? 0)) })} onClick={() => onTab('profit')} />}
            {a.unbilledProjects > 0 && <AlertRow tone={accents.amber} icon={<ReceiptLongOutlinedIcon />} text={t('ceo.alerts.unbilled', { count: a.unbilledWorkers, projects: a.unbilledProjects, largest: a.unbilledLargest ?? '—' })} onClick={() => onTab('profit')} />}
            {a.suppliersInHousing > 0 && <AlertRow tone={negative} icon={<BedOutlinedIcon />} text={a.dailyIdleCost > 0 ? t('ceo.alerts.housing', { count: a.suppliersInHousing, daily: f.n(a.dailyIdleCost) }) : t('ceo.alerts.housingNoCost', { count: a.suppliersInHousing })} onClick={() => onOpen({ title: t('ceo.kpi.idle'), query: { housing: true, source: 'Supplier' } })} />}
            {(data.lostRevenue.value ?? 0) > 0 && <AlertRow tone={accents.amber} icon={<HourglassBottomOutlinedIcon />} text={t('ceo.alerts.lost', { revenue: f.n(data.lostRevenue.value ?? 0), days: f.n(data.housingDays), profit: f.n(data.lostProfit.value ?? 0) })} onClick={() => onOpen({ title: t('ceo.kpi.lost'), query: { lost: true } })} />}
            {a.missingCosts > 0 && <AlertRow tone={tokens.info} icon={<ReportProblemOutlinedIcon />} text={t('ceo.alerts.missing', { count: a.missingCosts, revenue: f.n(a.uncostedRevenue) })} link="/workforce/supplier-costs" />}
            {!a.losingProjects && !a.unbilledProjects && !a.suppliersInHousing && !a.missingCosts && <Empty />}
          </Stack>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' } }}>
        <Box sx={{ ...card, ...appear(0.51) }}>
          <CardTitle icon={<ShowChartOutlinedIcon />} title={t('ceo.trend.title')} hint={t('ceo.trend.hint')} />
          <Columns
            categories={data.trend.map((x) => f.monthName(x.month))}
            series={[
              { key: 'revenue', label: t('ceo.trend.revenue'), color: tokens.navy700 },
              { key: 'cost', label: t('ceo.trend.cost'), color: accents.amber },
              { key: 'profit', label: t('ceo.trend.profit'), color: positive },
            ]}
            values={[data.trend.map((x) => x.revenue), data.trend.map((x) => x.cost), data.trend.map((x) => Math.max(0, x.profit))]}
            format={(n) => f.c(n)}
          />
          <Legend items={[[t('ceo.trend.revenue'), tokens.navy700], [t('ceo.trend.cost'), accents.amber], [t('ceo.trend.profit'), positive]]} />
        </Box>
        <Box sx={{ ...card, ...appear(0.59) }}>
          <CardTitle icon={<GroupsOutlinedIcon />} title={t('ceo.sources.title')} hint={t('ceo.sources.hint')} />
          {data.sources.length === 0 ? (
            <Empty />
          ) : (
            <Stack sx={{ gap: 1.5 }}>
              {data.sources.map((s) => (
                <ButtonBase key={s.source} onClick={() => onOpen({ title: t(`ceo.source.${s.source}`), query: { source: s.source } })} sx={{ display: 'block', textAlign: 'start', borderRadius: '12px', p: 1.25, border: `1px solid ${tokens.gray100}`, '&:hover': { bgcolor: tokens.navy50 } }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 13.5 }}>{t(`ceo.source.${s.source}`)}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('ceo.sources.workers', { count: f.n(s.workers) })}</Typography>
                  </Stack>
                  <Stack direction="row" sx={{ gap: 2, fontSize: 12.5 }}>
                    <span>
                      {t('ceo.trend.revenue')}: <b><bdi>{money(s.revenue)}</bdi></b>
                    </span>
                    {s.missingCosts > 0 && s.missingCosts === s.workers ? (
                      <Box component="span" sx={{ color: tokens.info, fontWeight: 700 }}>
                        {t('ceo.sources.noCost')}
                      </Box>
                    ) : (
                      <span>
                        {t('ceo.trend.profit')}: <b style={{ color: profitColor(s.profit) }}><bdi>{money(s.profit)}</bdi></b> · {t('ceo.kpi.margin')} <b><bdi>{s.margin ?? '—'}%</bdi></b>
                      </span>
                    )}
                  </Stack>
                  {s.source === 'Unknown' && <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mt: 0.5 }}>{t('ceo.sources.unknownHint')}</Typography>}
                </ButtonBase>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function AlertRow({ tone, icon, text, onClick, link }: { tone: string; icon: ReactNode; text: string; onClick?: () => void; link?: string }) {
  const navigate = useNavigate();
  return (
    <ButtonBase
      onClick={onClick ?? (link ? () => navigate(link) : undefined)}
      sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', justifyContent: 'flex-start', textAlign: 'start', p: 1.25, borderRadius: '10px', bgcolor: `${tone}12`, borderInlineStart: `4px solid ${tone}`, '& svg': { color: tone, fontSize: 20, mt: '1px' } }}
    >
      {icon}
      <Typography sx={{ fontSize: 12.5, lineHeight: 1.7 }}>{text}</Typography>
    </ButtonBase>
  );
}

type Sort = 'profit' | 'revenue' | 'margin' | 'workers';

function ProfitTab({ month, onOpen }: { month: string; onOpen: (o: Open) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [data, setData] = useState<CeoProfit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'losing' | 'unbilled' | 'weak'>('all');
  const [sort, setSort] = useState<{ by: Sort; asc: boolean }>({ by: 'profit', asc: true });
  useEffect(() => {
    ceoApi.profit(month).then((d) => setData(d ?? null)).catch((e) => setError(errorKey(e)));
  }, [month]);
  const rows = useMemo(() => {
    if (!data) return [];
    const list = data.projects.filter((p) =>
      filter === 'losing' ? p.revenue > 0 && p.profit < 0 : filter === 'unbilled' ? p.unbilledWorkers > 0 : filter === 'weak' ? p.margin !== null && p.margin < 5 : true,
    );
    const key = (p: ProjectProfit) => (sort.by === 'margin' ? p.margin ?? -999 : p[sort.by]);
    return [...list].sort((a, b) => (sort.asc ? key(a) - key(b) : key(b) - key(a)));
  }, [data, filter, sort]);
  if (error) return <ErrorMessage messageKey={error} />;
  if (!data) return <Loading />;
  const head = (by: Sort, label: string) => (
    <TableSortLabel active={sort.by === by} direction={sort.by === by && sort.asc ? 'asc' : 'desc'} onClick={() => setSort({ by, asc: sort.by === by ? !sort.asc : false })}>
      {label}
    </TableSortLabel>
  );
  return (
    <Box>
      <Hero>
        <Kpi index={0} label={t('ceo.kpi.profit')} icon={<TrendingUpOutlinedIcon />} figure={data.profit} unit={t('exec.sar')} money good="up" />
        <Kpi index={1} label={t('ceo.kpi.margin')} icon={<PercentOutlinedIcon />} figure={data.margin} unit="%" good="up" />
        <Kpi index={2} label={t('ceo.profit.losing')} icon={<TrendingDownOutlinedIcon />} value={data.losingProjects} unit={t('ceo.profit.projectsUnit')} note={t('ceo.profit.total', { total: f.n(data.losingTotal) })} onClick={() => setFilter('losing')} />
        <Kpi index={3} label={t('ceo.profit.perWorker')} icon={<EngineeringOutlinedIcon />} value={data.averageWorkerProfit} unit={t('ceo.profit.perMonth')} />
        <Kpi index={4} label={t('ceo.profit.losingWorkers')} icon={<ReportProblemOutlinedIcon />} value={data.losingWorkers} unit={t('exec.worker')} note={t('ceo.profit.total', { total: f.n(data.losingWorkersTotal) })} onClick={() => onOpen({ title: t('ceo.profit.losingWorkers'), query: { losing: true } })} />
        <Kpi index={5} label={t('ceo.profit.suppliers')} icon={<LocalShippingOutlinedIcon />} value={data.suppliers.reduce((s, x) => s + x.workers, 0)} unit={t('exec.worker')} note={t('ceo.profit.suppliersNote', { count: data.suppliers.reduce((s, x) => s + x.missingCosts, 0) })} />
      </Hero>

      <Box sx={{ ...card, mb: 1.75, ...appear(0.3) }}>
        <CardTitle icon={<AccountTreeOutlinedIcon />} title={t('ceo.profit.projects')} hint={t('ceo.profit.projectsHint', { month: f.monthLong(month) })} />
        <Stack direction="row" sx={{ gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
          {(['all', 'losing', 'unbilled', 'weak'] as const).map((k) => (
            <ButtonBase key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} sx={{ px: 1.5, py: 0.5, borderRadius: 99, fontSize: 12.5, fontWeight: 700, border: `1px solid ${filter === k ? tokens.navy800 : tokens.gray200}`, bgcolor: filter === k ? tokens.navy800 : '#fff', color: filter === k ? '#fff' : tokens.navy800 }}>
              {t(`ceo.profit.filter.${k}`, { count: k === 'all' ? data.projects.length : k === 'losing' ? data.losingProjects : k === 'unbilled' ? data.projects.filter((p) => p.unbilledWorkers > 0).length : data.projects.filter((p) => p.margin !== null && p.margin < 5).length })}
            </ButtonBase>
          ))}
        </Stack>
        {rows.length === 0 ? (
          <Empty />
        ) : (
          <TableContainer sx={{ maxHeight: 560 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>{t('ceo.col.project')}</TableCell>
                  <TableCell align="right">{head('workers', t('ceo.col.workers'))}</TableCell>
                  <TableCell align="right">{t('ceo.col.workDays')}</TableCell>
                  <TableCell align="right">{head('revenue', t('ceo.col.revenue'))}</TableCell>
                  <TableCell align="right">{t('ceo.col.cost')}</TableCell>
                  <TableCell align="right">{head('profit', t('ceo.col.profit'))}</TableCell>
                  <TableCell>{head('margin', t('ceo.col.margin'))}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.projectCrmId ?? p.name} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen({ title: p.name, query: { project: p.projectCrmId } })}>
                    <TableCell>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{p.name}</Typography>
                      <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>
                        {p.manager ?? '—'}
                        {p.unbilledWorkers > 0 && (
                          <Box component="span" sx={{ color: accents.amber, fontWeight: 700 }}>
                            {' · '}
                            {p.revenue === 0 ? t('ceo.profit.notBilled') : t('ceo.profit.unbilledSome', { count: p.unbilledWorkers })}
                          </Box>
                        )}
                        {p.missingCosts > 0 && (
                          <Box component="span" sx={{ color: tokens.info, fontWeight: 700 }}>
                            {' · '}
                            {t('ceo.profit.missingSome', { count: p.missingCosts })}
                          </Box>
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{p.workers}</TableCell>
                    <TableCell align="right">{f.n(p.workDays)}</TableCell>
                    <TableCell align="right">{f.n(p.revenue)}</TableCell>
                    <TableCell align="right">
                      <ProjectCost p={p} />
                      {p.expenses > 0 && <Typography sx={{ fontSize: 10.5, color: tokens.gray500 }}>{t('ceo.profit.withExpenses', { amount: f.n(p.expenses) })}</Typography>}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: profitColor(p.profit) }}>
                      <bdi>{f.n(p.profit)}</bdi>
                    </TableCell>
                    <TableCell>
                      {p.margin === null ? (
                        '—'
                      ) : (
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
                          <Box sx={{ width: 70, height: 8, borderRadius: 4, bgcolor: tokens.gray100, overflow: 'hidden' }}>
                            <Box sx={{ width: `${Math.min(100, Math.abs(p.margin))}%`, height: '100%', bgcolor: profitColor(p.margin) }} />
                          </Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                            <bdi>{p.margin}%</bdi>
                          </Typography>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Box sx={{ ...card, ...appear(0.4) }}>
        <CardTitle icon={<LocalShippingOutlinedIcon />} title={t('ceo.profit.suppliersTitle')} hint={t('ceo.profit.suppliersHint')} />
        {data.suppliers.length === 0 ? (
          <Empty />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('ceo.col.supplier')}</TableCell>
                  <TableCell align="right">{t('ceo.col.workers')}</TableCell>
                  <TableCell align="right">{t('ceo.col.revenue')}</TableCell>
                  <TableCell align="right">{t('ceo.col.cost')}</TableCell>
                  <TableCell align="right">{t('ceo.col.idle')}</TableCell>
                  <TableCell align="right">{t('ceo.col.lost')}</TableCell>
                  <TableCell align="right">{t('ceo.col.profit')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.suppliers.map((s) => (
                  <TableRow key={s.supplier} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen({ title: s.supplier, query: { supplier: s.supplier } })}>
                    <TableCell sx={{ fontWeight: 700 }}>
                      <bdi>{s.supplier}</bdi>
                    </TableCell>
                    <TableCell align="right">{s.workers}</TableCell>
                    <TableCell align="right">{f.n(s.revenue)}</TableCell>
                    <TableCell align="right">{s.missingCosts === s.workers ? <Box component="span" sx={{ color: tokens.info, fontWeight: 700 }}>{t('ceo.sources.noCost')}</Box> : f.n(s.cost)}</TableCell>
                    <TableCell align="right">
                      {f.n(s.idleCost)}
                      <Typography sx={{ fontSize: 10.5, color: tokens.gray500 }}>{t('ceo.profit.idleDays', { count: f.n(s.idleDays) })}</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ color: s.lostRevenue ? accents.amber : undefined, fontWeight: 700 }}>
                      {f.n(s.lostRevenue)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: s.missingCosts === s.workers ? tokens.gray500 : profitColor(s.profit) }}>
                      {s.missingCosts === s.workers ? '—' : <bdi>{f.n(s.profit)}</bdi>}
                      {s.missingCosts > 0 && s.missingCosts < s.workers && <Typography sx={{ fontSize: 10.5, color: tokens.info }}>{t('ceo.profit.missingSome', { count: s.missingCosts })}</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mt: 1.25 }}>{t('ceo.profit.example')}</Typography>
      </Box>
    </Box>
  );
}

function WorkforceTab({ data, month }: { data: CeoOverview; month: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const { can } = useSession();
  const [moves, setMoves] = useState<Movement | null>(null);
  useEffect(() => {
    if (!can('reports.movement.view', true)) return;
    const [y, m] = month.split('-').map(Number) as [number, number];
    movementApi.overview(`${month}-01`, `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`).then(setMoves).catch(() => undefined);
  }, [month, can]);
  return (
    <Box>
      <Hero>
        <Kpi index={0} label={t('ceo.kpi.onJob')} icon={<EngineeringOutlinedIcon />} value={data.onJob} unit={t('exec.worker')} />
        <Kpi index={1} label={t('ceo.work.inHousing')} icon={<BedOutlinedIcon />} value={data.inHousing} unit={t('exec.worker')} onClick={() => navigate('/housing/showroom')} note={t('ceo.work.toHousing')} />
        <Kpi index={2} label={t('ceo.kpi.lost')} icon={<HourglassBottomOutlinedIcon />} figure={data.lostRevenue} unit={t('exec.sar')} money good="down" note={t('ceo.kpi.lostNote', { days: f.n(data.housingDays), profit: f.n(data.lostProfit.value ?? 0) })} />
        <Kpi index={3} label={t('ceo.kpi.idle')} icon={<HourglassBottomOutlinedIcon />} figure={data.idleCost} unit={t('exec.sar')} money good="down" note={t('ceo.kpi.idleNote', { count: f.n(data.idleDays) })} />
        <Kpi index={4} label={t('ceo.work.movement')} icon={<SwapHorizOutlinedIcon />} figure={moves?.net ?? { value: null, previous: null }} unit={t('exec.worker')} good="up" note={moves ? t('ceo.work.moves', { starts: f.n(moves.starts.value ?? 0), returns: f.n(moves.returns.value ?? 0) }) : t('ceo.work.toMovement')} onClick={() => navigate('/reports/movement')} />
        <Kpi index={5} label={t('ceo.work.unbilled')} icon={<ReceiptLongOutlinedIcon />} value={data.alerts.unbilledWorkers} unit={t('exec.worker')} note={t('ceo.work.unbilledNote', { count: data.alerts.unbilledProjects })} />
      </Hero>
      <Box sx={{ ...card, ...appear(0.3) }}>
        <CardTitle icon={<EngineeringOutlinedIcon />} title={t('ceo.work.title')} hint={t('ceo.work.hint', { month: f.monthLong(month) })} />
        <WorkersList month={month} query={{}} withFilters />
      </Box>
    </Box>
  );
}

function FinanceMonth({ month }: { month: string }) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  const [data, setData] = useState<Finance | null>(null);
  const [drill, setDrill] = useState<{ title: string; drill: Drill } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    reportsApi.finance(from, to).then(setData).catch((e) => setError(errorKey(e)));
  }, [from, to]);
  return (
    <>
      <ErrorMessage messageKey={error} />
      <FinanceTab data={data} onDrill={(title, d) => setDrill({ title, drill: d })} />
      {drill && <DrillDrawer from={from} to={to} kind="invoices" title={drill.title} drill={drill.drill} onClose={() => setDrill(null)} />}
    </>
  );
}

/** The workers behind a figure, the biggest losses first. */
function WorkersDrawer({ month, title, query, onClose }: Open & { month: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Drawer anchor="left" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', md: 980 }, p: 2 } } }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: tokens.navy50, color: tokens.navy700, display: 'grid', placeItems: 'center' }}>
          <EngineeringOutlinedIcon />
        </Box>
        <Typography noWrap sx={{ flex: 1, fontWeight: 800, fontSize: 16 }}>
          {title}
        </Typography>
        <IconButton onClick={onClose} aria-label={t('common.close')}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <WorkersList month={month} query={query} />
    </Drawer>
  );
}

function WorkersList({ month, query, withFilters }: { month: string; query: WorkerProfitQuery; withFilters?: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const { can } = useSession();
  const [rows, setRows] = useState<WorkerProfit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'losing' | 'lost' | 'housing' | 'Supplier' | 'Company'>('all');
  const q: WorkerProfitQuery = { ...query, search, ...(view === 'losing' ? { losing: true } : view === 'lost' ? { lost: true } : view === 'housing' ? { housing: true } : view === 'Supplier' || view === 'Company' ? { source: view } : {}) };
  const key = JSON.stringify(q);
  useEffect(() => {
    if (!can('workforce.workers.salary', true)) return;
    setRows(null);
    const id = setTimeout(() => ceoApi.workers(month, JSON.parse(key) as WorkerProfitQuery).then(setRows).catch((e) => setError(errorKey(e))), 250);
    return () => clearTimeout(id);
  }, [month, key, can]);
  if (!can('workforce.workers.salary', true)) return <Alert severity="info">{t('ceo.work.noSalary')}</Alert>;
  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, mb: 1.5, alignItems: { md: 'center' } }}>
        {withFilters && (
          <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
            {(['all', 'losing', 'lost', 'housing', 'Supplier', 'Company'] as const).map((k) => (
              <ButtonBase key={k} onClick={() => setView(k)} aria-pressed={view === k} sx={{ px: 1.5, py: 0.5, borderRadius: 99, fontSize: 12.5, fontWeight: 700, border: `1px solid ${view === k ? tokens.navy800 : tokens.gray200}`, bgcolor: view === k ? tokens.navy800 : '#fff', color: view === k ? '#fff' : tokens.navy800 }}>
                {t(`ceo.work.view.${k}`)}
              </ButtonBase>
            ))}
          </Stack>
        )}
        <TextField size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('ceo.work.search')} sx={{ flex: { md: '1 1 240px' } }} slotProps={{ input: { startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) } }} />
        <Button startIcon={<FileDownloadOutlinedIcon />} component="a" href={ceoApi.workersExcel(month, q)} sx={{ whiteSpace: 'nowrap' }}>
          {t('exec.excel')}
        </Button>
      </Stack>
      <ErrorMessage messageKey={error} />
      {!rows ? (
        <LinearProgress />
      ) : rows.length === 0 ? (
        <Empty />
      ) : (
        <TableContainer sx={{ maxHeight: 'calc(100vh - 220px)' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>{t('ceo.col.worker')}</TableCell>
                <TableCell>{t('ceo.col.source')}</TableCell>
                <TableCell>{t('ceo.col.project')}</TableCell>
                <TableCell align="right">{t('ceo.col.workDays')}</TableCell>
                <TableCell align="right">{t('ceo.col.housingDays')}</TableCell>
                <TableCell align="right">{t('ceo.col.revenue')}</TableCell>
                <TableCell align="right">{t('ceo.col.cost')}</TableCell>
                <TableCell align="right">{t('ceo.col.profit')}</TableCell>
                <TableCell align="right">{t('ceo.col.lost')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.slice(0, 500).map((w) => (
                <TableRow key={w.workerId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/workforce/workers/${w.workerId}?tab=cost`)}>
                  <TableCell>
                    <Typography dir="auto" sx={{ fontSize: 12.5, fontWeight: 600, unicodeBidi: 'plaintext', textAlign: 'start' }}>
                      {w.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>
                      <bdi>{w.workerNo}</bdi>
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {t(`ceo.source.${w.source}`)}
                    {w.supplier && w.source === 'Supplier' && (
                      <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>
                        <bdi>{w.supplier}</bdi>
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Typography noWrap sx={{ fontSize: 12 }} title={w.projects ?? undefined}>
                      {w.projects ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{w.workDays}</TableCell>
                  <TableCell align="right" sx={{ color: w.housingDays ? accents.amber : undefined, fontWeight: w.housingDays ? 700 : 400 }}>
                    {w.housingDays}
                  </TableCell>
                  <TableCell align="right">{f.n(w.revenue)}</TableCell>
                  <TableCell align="right">
                    {w.costMissing ? (
                      <Tooltip title={t('ceo.work.missingTip')}>
                        <Box component="span" sx={{ color: tokens.info, fontWeight: 700 }}>
                          {t('ceo.sources.noCost')}
                        </Box>
                      </Tooltip>
                    ) : (
                      <>
                        <WorkerCost w={w} />
                        {w.idleCost > 0 && <Typography sx={{ fontSize: 10.5, color: negative }}>{t('ceo.work.idleOf', { amount: f.n(w.idleCost) })}</Typography>}
                      </>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: w.costMissing ? tokens.gray500 : profitColor(w.profit) }}>
                    {w.costMissing ? '—' : <bdi>{f.n(w.profit)}</bdi>}
                  </TableCell>
                  <TableCell align="right" sx={{ color: w.lostRevenue ? accents.amber : tokens.gray500, fontWeight: w.lostRevenue ? 700 : 400 }}>
                    {w.lostRevenue ? f.n(w.lostRevenue) : w.housingDays && w.parts.dailyPrice === null ? <Tooltip title={t('ceo.work.noPrice')}><span>—</span></Tooltip> : '0'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {rows && rows.length > 500 && <Typography sx={{ fontSize: 12, color: tokens.gray500, mt: 1 }}>{t('ceo.work.more', { count: rows.length })}</Typography>}
    </Box>
  );
}
