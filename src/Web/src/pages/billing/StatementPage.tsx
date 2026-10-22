import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { Box, Button, GlobalStyles, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { receivablesApi, type Statement } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday, sar } from '../operations/delivery';
import { DateField } from '../../components/DateField';

function Tile({ label, value, tone = tokens.navy800 }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50, '@media print': { border: '1px solid #c9d3e0', bgcolor: '#fff' } }}>
      <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 19, fontWeight: 800, color: tone, lineHeight: 1.3 }}>{value}</Typography>
    </Box>
  );
}

/**
 * A project's statement for a period: the balance before it, every invoice, note, receipt and old-system balance, the
 * running balance and the closing one. <paramref name="print"/>: the page alone, to print (opened in its own tab).
 */
export function StatementPage({ print = false }: { print?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const [params, setParams] = useSearchParams();
  const from = params.get('from') ?? `${new Date().getFullYear()}-01-01`;
  const to = params.get('to') ?? isoToday();
  const [data, setData] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    receivablesApi
      .statement(id!, from, to)
      .then((value) => {
        setData(value);
        if (print) document.title = `${value.projectName} — ${from} → ${to}`;
      })
      .catch((failure: unknown) => setError(errorKey(failure)));
  }, [id, from, to, print]);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  const open = (kind: string, documentId: string | null) => {
    if (!documentId || print) return;
    navigate(kind === 'Receipt' ? `/billing/receipts/${documentId}` : `/billing/invoices/${documentId}`);
  };

  return (
    <Box sx={print ? { p: 3, bgcolor: '#fff', minHeight: '100vh', '@media print': { p: 0 } } : undefined}>
      {print && <GlobalStyles styles={{ '@page': { size: 'A4', margin: '10mm' } }} />}
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: print ? 'none' : tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('statement.title')}</Typography>
            <Typography component="h1" sx={{ fontSize: 21, fontWeight: 800, color: tokens.navy800 }}>
              {data?.projectName ?? '…'}
            </Typography>
            <Typography sx={{ fontSize: 13, color: tokens.gray600 }}>
              {t('commercial.col.customer')}: {data?.customerName ?? '—'} · {t('statement.period', { from: date(from), to: date(to) })}
            </Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center', '@media print': { display: 'none' } }}>
            {!print && (
              <>
                <DateField size="small" label={t('statement.from')} value={from} onChange={(e) => e.target.value && set('from', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                <DateField size="small" label={t('statement.to')} value={to} onChange={(e) => e.target.value && set('to', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              </>
            )}
            <Button
              variant={print ? 'contained' : 'text'}
              startIcon={<PrintOutlinedIcon />}
              onClick={() => (print ? window.print() : window.open(`/billing/statements/${id}/print?from=${from}&to=${to}`, '_blank', 'noopener'))}
            >
              {t('invoices.printDoc')}
            </Button>
            {!print && (
              <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate(-1)}>
                {t('common.back')}
              </Button>
            )}
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.25, mt: 2 }}>
          <Tile label={t('statement.opening')} value={sar(data?.opening ?? 0)} />
          <Tile label={t('statement.debits')} value={sar(data?.debits ?? 0)} />
          <Tile label={t('statement.credits')} value={sar(data?.credits ?? 0)} tone="#1f9d55" />
          <Tile label={t('statement.closing')} value={sar(data?.closing ?? 0)} tone={(data?.closing ?? 0) > 0 ? tokens.danger : tokens.teal} />
        </Box>
      </Box>
      <ErrorMessage messageKey={error} />

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: print ? 'none' : tokens.shadowSm, p: 2 }}>
        {!data && !error && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('statement.date')}</TableCell>
                <TableCell>{t('statement.document')}</TableCell>
                <TableCell>{t('statement.description')}</TableCell>
                <TableCell align="center">{t('statement.debit')}</TableCell>
                <TableCell align="center">{t('statement.credit')}</TableCell>
                <TableCell align="center">{t('statement.balance')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data && (
                <TableRow sx={{ bgcolor: tokens.gray50 }}>
                  <TableCell>{date(data.from)}</TableCell>
                  <TableCell colSpan={4} sx={{ fontWeight: 700 }}>
                    {t('statement.opening')}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    {sar(data.opening)}
                  </TableCell>
                </TableRow>
              )}
              {data?.entries.map((e, n) => (
                <TableRow key={n} hover sx={{ cursor: e.documentId && !print ? 'pointer' : 'default' }} onClick={() => open(e.kind, e.documentId)}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(e.date)}</TableCell>
                  <TableCell>
                    <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                      {e.number}
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t(`statement.kinds.${e.kind}`)}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12.5 }}>{e.description}</TableCell>
                  <TableCell align="center">{e.debit > 0 ? sar(e.debit) : ''}</TableCell>
                  <TableCell align="center" sx={{ color: '#1f9d55' }}>
                    {e.credit > 0 ? sar(e.credit) : ''}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    {sar(e.balance)}
                  </TableCell>
                </TableRow>
              ))}
              {data && (
                <TableRow sx={{ bgcolor: tokens.navy50 }}>
                  <TableCell>{date(data.to)}</TableCell>
                  <TableCell colSpan={2} sx={{ fontWeight: 800 }}>
                    {t('statement.closing')}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    {sar(data.debits)}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: '#1f9d55' }}>
                    {sar(data.credits)}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 900, color: tokens.navy800 }}>
                    {sar(data.closing)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}
