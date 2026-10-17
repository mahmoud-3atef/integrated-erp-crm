import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  InputAdornment,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { invoiceCheckResults, workforceApi, type InvoiceCheckList } from '../../api/workforce';
import { tokens, type toneColors } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PageHeader } from '../../components/ui';

const resultTone: Record<string, keyof typeof toneColors> = {
  Match: 'success',
  DaysDiff: 'warning',
  PriceDiff: 'warning',
  DaysAndPriceDiff: 'danger',
  NotInLedger: 'danger',
  NotInvoiced: 'danger',
  ProjectNotInvoiced: 'neutral',
};

const num = (value: number | null) => (value == null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 2 }));

/**
 * The attendance check: each line of the old system's project invoices against the days and price of the period
 * ledger for the same worker, project and invoice period, month by month, with the match rate.
 */
export function InvoiceCheckPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const month = params.get('month') ?? '';
  const result = params.get('result') ?? '';
  const search = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1');
  const [text, setText] = useState(search);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState<InvoiceCheckList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!('page' in changes)) {
      next.delete('page');
    }
    setParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    workforceApi
      .invoiceCheck({ month, result, search, page, pageSize })
      .then((value) => !cancelled && (setData(value), setError(null)))
      .catch((failure: unknown) => !cancelled && setError(errorKey(failure)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [month, result, search, page, pageSize]);

  const monthName = (value: string) =>
    new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
  const shortDate = (value: string) => value.slice(5).replace('-', '/');
  const counted = data ? Object.entries(data.counts).filter(([k]) => k !== 'ProjectNotInvoiced').reduce((a, [, v]) => a + v, 0) : 0;

  return (
    <Box>
      <PageHeader title={t('workforce.invoiceCheck.title')} subtitle={t('workforce.invoiceCheck.intro')} />
      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
        {t('workforce.invoiceCheck.how')}
        {data?.builtAt && (
          <Box component="span" sx={{ display: 'block', mt: 0.5, fontSize: 12.5 }}>
            {t('workforce.invoiceCheck.builtAt', { at: new Date(data.builtAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) })}
          </Box>
        )}
      </Alert>
      <ErrorMessage messageKey={error} />

      {data && data.months.length > 1 && (
        <Stack direction="row" sx={{ gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {data.months.map((m) => (
            <Button key={m} size="small" variant={m === data.month ? 'contained' : 'outlined'} onClick={() => update({ month: m, result: null })}>
              {monthName(m)}
            </Button>
          ))}
        </Stack>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px 1fr' }, gap: 1.5, mb: 2 }}>
        {/* The month's match rate: the target is 99%. */}
        <Box sx={{ p: 2, borderRadius: `${tokens.radiusLg}px`, bgcolor: tokens.navy700, color: '#fff', boxShadow: tokens.shadowSm }}>
          <Typography sx={{ fontSize: 13, opacity: 0.85 }}>{data?.month ? t('workforce.invoiceCheck.rateOf', { month: monthName(data.month) }) : t('workforce.invoiceCheck.rate')}</Typography>
          <Typography sx={{ fontSize: 40, fontWeight: 800, lineHeight: 1.2 }}>{data ? `${data.matchRate.toFixed(1)}%` : '—'}</Typography>
          <Typography sx={{ fontSize: 12.5, opacity: 0.85 }}>
            {t('workforce.invoiceCheck.rateDetail', { match: data?.counts.Match ?? 0, total: counted, invoices: data?.invoices ?? 0 })}
          </Typography>
          <Typography sx={{ fontSize: 12, mt: 0.5, color: (data?.matchRate ?? 0) >= 99 ? '#9be7b7' : '#ffd88a' }}>{t('workforce.invoiceCheck.target')}</Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.25 }}>
          {['', ...invoiceCheckResults].map((r) => {
            const active = result === r;
            const count = r ? data?.counts[r] ?? 0 : counted + (data?.counts.ProjectNotInvoiced ?? 0);
            return (
              <ButtonBase
                key={r || 'all'}
                onClick={() => update({ result: r || null })}
                sx={{
                  display: 'block',
                  textAlign: 'start',
                  p: 1.5,
                  borderRadius: `${tokens.radius}px`,
                  bgcolor: active ? tokens.navy700 : '#fff',
                  color: active ? '#fff' : tokens.navy800,
                  boxShadow: tokens.shadowSm,
                }}
              >
                <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{count.toLocaleString('en-US')}</Typography>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, opacity: 0.9 }}>{r ? t(`workforce.invoiceCheck.results.${r}`) : t('workforce.invoiceCheck.all')}</Typography>
              </ButtonBase>
            );
          })}
        </Box>
      </Box>
      {result && (
        <Alert severity={result === 'Match' ? 'success' : 'warning'} sx={{ mb: 2 }}>
          {t(`workforce.invoiceCheck.explain.${result}`)}
        </Alert>
      )}

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <Box component="form" sx={{ display: 'flex', gap: 1, flex: 1, maxWidth: 560 }} onSubmit={(e) => (e.preventDefault(), update({ q: text.trim() || null }))}>
            <TextField
              size="small"
              fullWidth
              placeholder={t('workforce.invoiceCheck.search')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <Button type="submit" variant="contained">
              {t('workforce.searchButton')}
            </Button>
            {(search || result) && <Button onClick={() => (setText(''), update({ q: null, result: null }))}>{t('workforce.reset')}</Button>}
          </Box>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }}>
            {t('workforce.invoiceCheck.count', { count: data?.total ?? 0 })}
          </Box>
        </Stack>
        {busy && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('workforce.col.name')}</TableCell>
                <TableCell>{t('commercial.col.project')}</TableCell>
                <TableCell>{t('workforce.invoiceCheck.invoice')}</TableCell>
                <TableCell align="center">{t('workforce.invoiceCheck.invoiceDays')}</TableCell>
                <TableCell align="center">{t('workforce.invoiceCheck.ledgerDays')}</TableCell>
                <TableCell align="center">{t('workforce.invoiceCheck.invoicePrice')}</TableCell>
                <TableCell align="center">{t('workforce.invoiceCheck.ledgerPrice')}</TableCell>
                <TableCell>{t('workforce.invoiceCheck.result')}</TableCell>
                <TableCell>{t('workforce.history.details')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((i) => (
                <TableRow
                  key={i.id}
                  hover
                  sx={{ cursor: i.workerId ? 'pointer' : 'default' }}
                  onClick={() => i.workerId && navigate(`/workforce/workers/${i.workerId}?tab=periods`)}
                >
                  <TableCell sx={{ minWidth: 170 }}>
                    <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                      {i.name}
                    </Typography>
                    <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                      {i.workerNo}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, minWidth: 160 }}>{i.projectName ?? '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{i.invoiceNo ?? '—'}</Typography>
                    <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                      {shortDate(i.from)} – {shortDate(i.to)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    {num(i.workingDays)}
                    {!!i.absentDays && (
                      <Typography component="span" sx={{ display: 'block', fontSize: 11.5, color: tokens.gray500 }}>
                        {t('workforce.invoiceCheck.absent', { days: num(i.absentDays) })}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">{num(i.ledgerDays)}</TableCell>
                  <TableCell align="center">{num(i.invoicedPrice)}</TableCell>
                  <TableCell align="center">{num(i.ledgerPrice)}</TableCell>
                  <TableCell>
                    <Badge tone={resultTone[i.result] ?? 'neutral'}>{t(`workforce.invoiceCheck.results.${i.result}`)}</Badge>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12.5, minWidth: 300 }}>{i.details}</TableCell>
                </TableRow>
              ))}
              {data && data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {data.months.length === 0 ? t('workforce.invoiceCheck.none') : t('workforce.invoiceCheck.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={Math.max(0, page - 1)}
          onPageChange={(_, p) => update({ page: String(p + 1) })}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[25, 50, 100]}
          onRowsPerPageChange={(e) => (setPageSize(Number(e.target.value)), update({ page: null }))}
          labelRowsPerPage={t('workforce.perPage')}
          labelDisplayedRows={({ from, to, count }) => t('workforce.rows', { from, to, count })}
        />
      </Box>
    </Box>
  );
}
