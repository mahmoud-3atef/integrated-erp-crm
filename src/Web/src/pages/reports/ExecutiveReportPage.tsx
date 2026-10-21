import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import CloseIcon from '@mui/icons-material/Close';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import {
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
import { reportsApi, type Drill, type Finance, type InvoiceRow, type MoveRow } from '../../api/reports';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Columns } from '../../components/charts';
import { accents, appear, card, CardTitle, Dot, Empty, filling, Hero, Kpi, Legend, Loading, useFormat } from './reportKit';




export function FinanceTab({ data, onDrill }: { data: Finance | null; onDrill: (title: string, drill: Drill) => void }) {
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
export function DrillDrawer({ from, to, kind, title, drill, onClose }: { from: string; to: string; kind: 'moves' | 'invoices'; title: string; drill: Drill; onClose: () => void }) {
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
