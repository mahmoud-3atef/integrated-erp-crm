import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { settlementsApi, type SettlementDetail, type SettlementLine } from '../../api/settlements';
import { ErrorMessage } from '../../auth/AuthLayout';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { useLineDetail } from './SettlementPage';
import { sar, useYears } from './settlementParts';

/** The settlement to print and sign (A4): the facts, the dues and deductions, the net, and the employee's acknowledgment. */
export function SettlementPrintPage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { date } = useCommercialFormat();
  const years = useYears();
  const detail = useLineDetail();
  const [d, setD] = useState<SettlementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    settlementsApi.get(id).then(setD).catch((f: unknown) => setError(errorKey(f)));
  }, [id]);
  if (!d) {
    return error ? <ErrorMessage messageKey={error} /> : <LinearProgress />;
  }

  const end = d.kind === 'EndOfService';
  const table = (title: string, lines: SettlementLine[], total: number) => (
    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mb: 2, '& td, & th': { border: '1px solid #cbd5e1', p: '6px 8px', fontSize: 12.5, textAlign: 'start' } }}>
      <thead>
        <tr>
          <Box component="th" colSpan={2} sx={{ bgcolor: '#f1f5f9' }}>
            {title}
          </Box>
          <Box component="th" sx={{ bgcolor: '#f1f5f9', width: 140 }}>
            {t('settlements.award.amount')}
          </Box>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.lineNo}>
            <td>{t(`settlements.line.${l.code}`)}</td>
            <td>{detail(l, d)}</td>
            <Box component="td" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {sar(l.amount)}
            </Box>
          </tr>
        ))}
        <Box component="tr" sx={{ fontWeight: 800 }}>
          <td colSpan={2}>{t(title === t('settlements.dues') ? 'settlements.totalDues' : 'settlements.totalDeductions')}</td>
          <td>{sar(total)}</td>
        </Box>
      </tbody>
    </Box>
  );
  const fact = (label: string, value: ReactNode) => (
    <Box>
      <Typography sx={{ fontSize: 11, color: '#64748b' }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: 13, fontWeight: 700 }}>
        {value}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto', p: 3, bgcolor: '#fff', color: '#0f2747', '@media print': { p: 0, '& .no-print': { display: 'none' } } }}>
      <Stack direction="row" className="no-print" sx={{ justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" onClick={() => window.print()}>
          {t('settlements.print')}
        </Button>
      </Stack>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #082B49', pb: 1.5, mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{t(end ? 'settlements.kind.EndOfService' : 'settlements.kind.Vacation')}</Typography>
          <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>
            <bdi>{d.settlementNo}</bdi> · {t(`settlements.status.${d.status}`)}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 12, color: '#64748b' }}>{date(new Date().toISOString())}</Typography>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2 }}>
        {fact(t(d.party === 'Worker' ? 'settlements.worker' : 'settlements.employee'), <>{d.name} · <bdi>{d.personNo}</bdi></>)}
        {fact(t(d.party === 'Worker' ? 'settlements.professionProject' : 'settlements.jobDepartment'), [ar ? d.jobTitleAr : d.jobTitleEn, ar ? d.departmentAr : d.departmentEn].filter(Boolean).join(' · ') || '—')}
        {fact(t('settlements.hireDate'), date(d.hireDate))}
        {end
          ? fact(t('settlements.col.reason'), t(`settlements.reason.${d.reason}`))
          : fact(t('settlements.annualLeave'), `${date(d.leaveFrom)} – ${date(d.leaveTo)}`)}
        {end ? fact(t('settlements.create.lastDay'), date(d.lastDay)) : fact(t('settlements.kpi.leaveDays'), t('settlements.daysN', { count: d.leaveDays }))}
        {end ? fact(t('settlements.kpi.service'), years(d.serviceYears)) : fact(t(d.party === 'Worker' ? 'settlements.workerLeaveRequest' : 'settlements.leaveRequest'), <bdi>{d.leaveRequestNo ?? '—'}</bdi>)}
        {fact(t('settlements.wage'), `${sar(d.wage)} ${t('settlements.sar')}`)}
      </Box>
      {table(t('settlements.dues'), d.lines.filter((l) => l.side === 'Addition'), d.totalAdditions)}
      {table(t('settlements.deductions'), d.lines.filter((l) => l.side === 'Deduction'), d.totalDeductions)}
      <Stack direction="row" sx={{ justifyContent: 'space-between', bgcolor: '#082B49', color: '#fff', borderRadius: 1, px: 2, py: 1.25, mb: 2, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
        <Typography sx={{ fontWeight: 700 }}>{t('settlements.netDue')}</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: 18 }}>
          {sar(d.net)} {t('settlements.sar')}
        </Typography>
      </Stack>
      <Typography sx={{ fontSize: 12.5, lineHeight: 2, mb: 4 }}>{t(end ? 'settlements.acknowledgeEnd' : 'settlements.acknowledgeVacation', { name: d.name, net: sar(d.net) })}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, textAlign: 'center', fontSize: 12.5 }}>
        {[d.party === 'Worker' ? 'workerSign' : 'employeeSign', 'hrSign', 'financeSign'].map((k) => (
          <Box key={k} sx={{ borderTop: '1px solid #94a3b8', pt: 1 }}>
            {t(`settlements.${k}`)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
