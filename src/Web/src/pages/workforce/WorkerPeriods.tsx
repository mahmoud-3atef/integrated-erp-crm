import { Link, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workforceApi, type WorkerKind, type WorkerPeriod } from '../../api/workforce';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, type Tone } from '../../components/ui';

const kindTone: Record<string, Tone> = { Work: 'success', Housing: 'info', Vacation: 'warning', ClientVacation: 'warning', Absconded: 'danger', Suspended: 'danger', Out: 'neutral' };

const sourceLink: Record<string, string> = { delivery_order: '/operations/delivery-orders/', return_order: '/operations/return-orders/' };

/** The worker's period ledger: where they were and when (work on a project with its price, housing…), latest first. */
export function WorkerPeriods({ kind, workerId }: { kind: WorkerKind; workerId: string }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [periods, setPeriods] = useState<WorkerPeriod[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workforceApi.periods(kind, workerId).then(setPeriods).catch((failure: unknown) => setError(errorKey(failure)));
  }, [kind, workerId]);

  const date = (value: string | null) =>
    value ? new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—';
  // The ledger stores the first day after the period; people read the last day in it.
  const lastDay = (endsOn: string | null) => (endsOn ? date(new Date(Date.parse(endsOn) - 86400000).toISOString().slice(0, 10)) : null);
  const money = (value: number | null) => (value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 2 }));

  if (error) {
    return <ErrorMessage messageKey={error} />;
  }

  if (periods && periods.length === 0) {
    return <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('workforce.periods.empty')}</Typography>;
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('workforce.periods.kind')}</TableCell>
            <TableCell>{t('commercial.col.project')}</TableCell>
            <TableCell>{t('workforce.periods.from')}</TableCell>
            <TableCell>{t('workforce.periods.to')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.total')}</TableCell>
            <TableCell>{t('commercial.prices.col.package')}</TableCell>
            <TableCell>{t('workforce.periods.source')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {periods?.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Badge tone={kindTone[p.kind] ?? 'neutral'}>{t(`workforce.periods.kinds.${p.kind}`)}</Badge>
              </TableCell>
              <TableCell>{p.projectName ?? '—'}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(p.startsOn)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {lastDay(p.endsOn) ?? <Badge tone="success">{t('workforce.periods.open')}</Badge>}
                {p.closedByNo && (
                  <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                    {p.closedByNo}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                {p.kind === 'Housing' ? <Badge tone={p.paySalary ? 'info' : 'neutral'}>{t(p.paySalary ? 'workforce.periods.salaryPaid' : 'workforce.periods.salaryStopped')}</Badge> : money(p.totalPrice)}
              </TableCell>
              <TableCell>{p.isSpecialPrice ? <Badge tone="warning">{t('commercial.prices.status.Special')}</Badge> : p.packageNo ? <Badge tone="success">{p.packageNo}</Badge> : '—'}</TableCell>
              <TableCell dir="ltr" sx={{ textAlign: 'start' }}>
                {sourceLink[p.sourceType] ? (
                  <Link component={RouterLink} to={`${sourceLink[p.sourceType]}${p.sourceId}`} underline="hover">
                    {p.sourceNo}
                  </Link>
                ) : (
                  p.sourceNo
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
