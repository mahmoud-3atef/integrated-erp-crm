import { Box, Link, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workerFileApi } from '../../api/workerFile';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge } from '../../components/ui';

/** One row of the tab: a line on an invoice of this system (opens it) or of the old system (read-only). */
interface Row {
  key: string;
  invoiceId: string | null;
  invoiceNo: string;
  projectName: string;
  from: string | null;
  to: string;
  status: string;
  workDays: number;
  monthlyPrice: number;
  amount: number;
}

/** The worker's invoice lines month by month, as the old employee screen's invoices tab, the latest first. */
export function WorkerInvoices({ workerId }: { workerId: string }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([workerFileApi.invoiceLines(workerId), workerFileApi.legacyInvoices(workerId)])
      .then(([mine, old]) =>
        setRows(
          [
            ...mine.map((l): Row => ({
              key: `n-${l.invoiceId}-${l.from}`, invoiceId: l.invoiceId, invoiceNo: l.invoiceNo ?? t('workforce.invoices.draft'), projectName: l.projectName,
              from: l.from, to: l.to, status: t(`workforce.invoices.status.${l.status}`, { defaultValue: l.status }), workDays: l.workDays, monthlyPrice: l.monthlyPrice, amount: l.amount,
            })),
            ...old.map((l, i): Row => ({
              key: `o-${l.invoiceNo}-${i}`, invoiceId: null, invoiceNo: l.invoiceNo, projectName: l.projectName,
              from: l.from, to: l.to, status: ar ? l.statusAr : l.statusEn, workDays: l.workDays, monthlyPrice: l.monthlyPrice, amount: l.amount,
            })),
          ].sort((a, b) => b.to.localeCompare(a.to)),
        ),
      )
      .catch((failure: unknown) => setError(errorKey(failure)));
  }, [workerId, t, ar]);

  const date = (value: string | null) =>
    value ? new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—';
  const money = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (error) {
    return <ErrorMessage messageKey={error} />;
  }
  if (!rows) {
    return (
      <Box>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={44} />
        ))}
      </Box>
    );
  }
  if (rows.length === 0) {
    return <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('workforce.invoices.empty')}</Typography>;
  }

  return (
    <>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('workforce.invoices.no')}</TableCell>
              <TableCell>{t('commercial.col.project')}</TableCell>
              <TableCell>{t('workforce.invoices.period')}</TableCell>
              <TableCell align="center">{t('workforce.invoices.days')}</TableCell>
              <TableCell align="center">{t('workforce.invoices.price')}</TableCell>
              <TableCell align="center">{t('workforce.invoices.amount')}</TableCell>
              <TableCell>{t('common.status')}</TableCell>
              <TableCell>{t('workforce.periods.origin')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} hover>
                <TableCell sx={{ fontWeight: 700 }}>
                  {r.invoiceId ? (
                    <Link component={RouterLink} to={`/billing/invoices/${r.invoiceId}`} underline="hover">
                      <bdi>{r.invoiceNo}</bdi>
                    </Link>
                  ) : (
                    <bdi>{r.invoiceNo}</bdi>
                  )}
                </TableCell>
                <TableCell>{r.projectName}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {date(r.from)} – {date(r.to)}
                </TableCell>
                <TableCell align="center">{r.workDays.toLocaleString('en-US')}</TableCell>
                <TableCell align="center">{money(r.monthlyPrice)}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                  {money(r.amount)}
                </TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell>
                  <Badge tone={r.invoiceId ? 'primary' : 'neutral'}>{t(r.invoiceId ? 'workforce.periods.thisSystem' : 'workforce.periods.oldSystem')}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography sx={{ mt: 1.5, fontSize: 12, color: tokens.gray500 }}>{t('workforce.invoices.note')}</Typography>
    </>
  );
}
