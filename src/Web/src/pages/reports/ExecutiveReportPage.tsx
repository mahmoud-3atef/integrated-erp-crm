import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import SyncAltOutlinedIcon from '@mui/icons-material/SyncAltOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import DonutLargeOutlinedIcon from '@mui/icons-material/DonutLargeOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import CloseIcon from '@mui/icons-material/Close';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Drawer,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { reportsApi, type Drill, type Finance, type InvoiceRow, type MoveRow, type Overview } from '../../api/reports';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Columns, RankedBars, Ring } from '../../components/charts';
import { accents, appear, card, CardTitle, Dot, Empty, filling, Hero, Kpi, Legend, Loading, PrintStyles, ReportBar, Ticker, useFormat, useMark, usePeriodChoice } from './reportKit';

type Tab = 'overview' | 'finance';

/**
 * The executive report (docs/03-migration-plan/14, phase A): the period and its comparison, the summary written from the
 * numbers, the overview and the finance; any chart opens the list behind it, as Excel too. Every figure comes from the
 * server; an unknown one shows «—».
 */
export function ExecutiveReportPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [tab, setTab] = useState<Tab>('overview');
  const choice = usePeriodChoice();
  const { from, to } = choice;
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

  return (
    <Box>
      <PrintStyles />
      <ReportBar
        tabs={[
          { key: 'overview' as Tab, label: t('exec.tabs.overview'), icon: <QueryStatsOutlinedIcon /> },
          ...(overview?.financeVisible !== false ? [{ key: 'finance' as Tab, label: t('exec.tabs.finance'), icon: <PaymentsOutlinedIcon /> }] : []),
        ]}
        tab={tab}
        onTab={setTab}
        choice={choice}
        period={overview?.period}
      />

      <ErrorMessage messageKey={error} />
      {tab === 'overview' ? (
        <OverviewTab key={`${from}-${to}`} data={overview} onDrill={(kind, title, d) => setDrill({ kind, title, drill: d })} />
      ) : (
        <FinanceTab key={`${from}-${to}`} data={finance} onDrill={(title, d) => setDrill({ kind: 'invoices', title, drill: d })} />
      )}
      {drill && <DrillDrawer from={from} to={to} {...drill} onClose={() => setDrill(null)} />}
    </Box>
  );
}

/** The summary for senior management, written from the figures (nothing typed by hand). */
function Insights({ data }: { data: Overview }) {
  const f = useFormat();
  const mark = useMark();
  const lines: string[] = [];
  const s = data.starts.value ?? 0;
  const ps = data.starts.previous;
  lines.push(ps === null ? mark('exec.ins.starts', { count: f.n(s) }) : mark(s >= ps ? 'exec.ins.startsUp' : 'exec.ins.startsDown', { count: f.n(s), diff: f.n(Math.abs(s - ps)) }));
  lines.push(mark('exec.ins.net', { net: f.n(data.net.value ?? 0), starts: f.n(s), returns: f.n(data.returns.value ?? 0) }));
  if (data.startsByManager[0]) lines.push(mark('exec.ins.topManager', { name: data.startsByManager[0].name, count: f.n(data.startsByManager[0].count) }));
  if (data.financeVisible && data.collectionRate.value !== null) {
    lines.push(
      data.collectionRate.previous === null
        ? mark('exec.ins.rate', { rate: data.collectionRate.value })
        : mark('exec.ins.rateCompare', { rate: data.collectionRate.value, previous: data.collectionRate.previous }),
    );
  }
  if (data.financeVisible && data.overdue60 > 0) lines.push(mark('exec.ins.overdue', { amount: f.n(data.overdue60), share: data.totalDebt > 0 ? Math.round((data.overdue60 * 100) / data.totalDebt) : 0 }));
  if (data.financeVisible && data.coverage.month && data.coverage.missing + data.coverage.partial > 0) {
    lines.push(mark('exec.ins.coverage', { month: f.monthLong(data.coverage.month), count: data.coverage.missing + data.coverage.partial, workers: f.n(data.coverage.workersNotInvoiced) }));
  }
  return <Ticker lines={lines} />;

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
      <Hero>
        <Kpi index={0} label={t('exec.kpi.onJob')} icon={<GroupsOutlinedIcon />} value={data.onJob} unit={t('exec.worker')} accent={accents.navy} note={t('exec.kpi.activeProjects', { count: f.n(data.activeProjects) })} />
        <Kpi index={1} label={t('exec.kpi.starts')} icon={<TrendingUpOutlinedIcon />} figure={data.starts} unit={t('exec.worker')} good="up" accent={accents.teal} spark={data.moves.map((m) => m.starts)} />
        <Kpi index={2} label={t('exec.kpi.net')} icon={<SyncAltOutlinedIcon />} figure={data.net} good="up" accent={accents.green} spark={data.moves.map((m) => m.starts - m.returns)} note={t('exec.kpi.netNote', { starts: f.n(data.starts.value ?? 0), returns: f.n(data.returns.value ?? 0) })} />
        <Kpi index={3} label={t('exec.kpi.inHousing')} icon={<HotelOutlinedIcon />} value={data.inHousing} unit={t('exec.worker')} accent={accents.amber} note={t('exec.kpi.inHousingNote')} />
        <Kpi index={4} label={t('exec.kpi.invoiced')} icon={<ReceiptLongOutlinedIcon />} figure={data.invoiced} unit={t('exec.sar')} money good="up" accent={accents.violet} spark={data.money.map((m) => m.invoiced)} note={data.invoiceCount.value !== null ? t('exec.kpi.invoiceCount', { count: f.n(data.invoiceCount.value) }) : undefined} />
        <Kpi index={5} label={t('exec.kpi.rate')} icon={<PercentOutlinedIcon />} figure={data.collectionRate} unit="%" good="up" accent={accents.rose} spark={data.money.map((m) => m.rate)} note={data.financeVisible ? t('exec.kpi.overdue', { amount: f.n(data.overdue60) }) : undefined} />
      </Hero>
      <Insights data={data} />
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' }, mb: 1.75 }}>
        <Box sx={{ ...card, ...appear(0.35) }}>
          <CardTitle icon={<HistoryOutlinedIcon />} title={t('exec.moves.title')} hint={t('exec.moves.hint')} />
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
        <Box sx={{ ...card, ...appear(0.43) }}>
          <CardTitle icon={<ManageAccountsOutlinedIcon />} title={t('exec.managers.title')} hint={t('exec.managers.hint')} />
          {data.startsByManager.length === 0 ? (
            <Empty />
          ) : (
            <RankedBars items={data.startsByManager.slice(0, 8).map((r) => ({ key: r.key, label: r.name, value: r.count }))} onClick={(key) => onDrill('moves', t('exec.drill.manager', { name: key }), { manager: key, kind: 'Work' })} />
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' } }}>
        <Box sx={{ ...card, ...appear(0.51) }}>
          <CardTitle icon={<BusinessCenterOutlinedIcon />} title={t('exec.projects.title')} hint={t('exec.projects.hint')} />
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
                      <Box sx={{ display: 'flex', width: `${((p.starts + p.returns) / max) * 100}%`, ...filling(0.5) }}>
                        <Box sx={{ flex: p.starts, bgcolor: tokens.navy700 }} />
                        <Box sx={{ flex: p.returns, bgcolor: accents.amber }} />
                      </Box>
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
          <Box sx={{ ...card, ...appear(0.59) }}>
            <CardTitle icon={<DonutLargeOutlinedIcon />} title={c.month ? t('exec.coverage.title', { month: f.monthLong(c.month) }) : t('exec.coverage.titleNone')} hint={t('exec.coverage.hint')} />
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
      <Hero>
        <Kpi index={0} label={t('exec.fin.invoiced')} icon={<ReceiptLongOutlinedIcon />} figure={data.invoiced} unit={t('exec.sar')} money good="up" accent={accents.green} spark={data.money.map((m) => m.invoiced)} note={t('exec.fin.invoicedNote', { count: f.n(data.invoiceCount.value ?? 0), vat: f.n(data.vat.value ?? 0) })} />
        <Kpi index={1} label={t('exec.fin.collected')} icon={<PaymentsOutlinedIcon />} figure={data.collected} unit={t('exec.sar')} money good="up" accent={accents.violet} spark={data.money.map((m) => m.collected)} />
        <Kpi index={2} label={t('exec.fin.rate')} icon={<PercentOutlinedIcon />} figure={data.collectionRate} unit="%" good="up" accent={accents.teal} spark={data.money.map((m) => m.rate)} />
        <Kpi index={3} label={t('exec.fin.debt')} icon={<AccountBalanceWalletOutlinedIcon />} value={data.totalDebt} unit={t('exec.sar')} money accent={accents.navy} note={t('exec.fin.debtNote', { count: f.n(data.openInvoices) })} />
        <Kpi index={4} label={t('exec.fin.overdue')} icon={<WarningAmberOutlinedIcon />} value={data.overdue60} unit={t('exec.sar')} money accent={accents.rose} note={t('exec.fin.overdueNote', { count: f.n(data.overdue60Invoices), share: data.overdue60Share ?? 0 })} />
        <Kpi index={5} label={t('exec.fin.dso')} icon={<TimerOutlinedIcon />} value={data.dso} unit={t('exec.days')} accent={accents.amber} note={t('exec.fin.dsoNote')} />
      </Hero>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' }, mb: 1.75 }}>
        <Box sx={{ ...card, ...appear(0.35) }}>
          <CardTitle icon={<QueryStatsOutlinedIcon />} title={t('exec.fin.trend')} hint={t('exec.fin.trendHint')} />
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
        <Box sx={{ ...card, ...appear(0.43) }}>
          <CardTitle icon={<HourglassBottomOutlinedIcon />} title={t('exec.fin.aging')} hint={t('exec.fin.agingHint')} />
          <Box sx={{ display: 'flex', height: 22, borderRadius: '7px', overflow: 'hidden', mb: 1.25, bgcolor: tokens.gray100, '& > *': filling(0.5) }}>
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
        <Box sx={{ ...card, ...appear(0.51) }}>
          <CardTitle icon={<ApartmentOutlinedIcon />} title={t('exec.fin.debtors')} hint={t('exec.fin.debtorsHint')} />
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
        <Box sx={{ ...card, ...appear(0.59) }}>
          <CardTitle icon={<ManageAccountsOutlinedIcon />} title={t('exec.fin.managers')} hint={t('exec.fin.managersHint')} />
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
                    <Box sx={{ height: '100%', width: `${Math.min(100, m.rate)}%`, bgcolor: rateColor(m.rate), borderRadius: 4, ...filling(0.5) }} />
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
      <Box sx={{ ...card, ...appear(0.67) }}>
        <CardTitle icon={<TableChartOutlinedIcon />}
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
