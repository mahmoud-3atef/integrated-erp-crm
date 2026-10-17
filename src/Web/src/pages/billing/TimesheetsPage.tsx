import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import AutoModeOutlinedIcon from '@mui/icons-material/AutoModeOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import {
  Box,
  Button,
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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { billingApi, type TimesheetMonth } from '../../api/billing';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { Badge, Initials, PageHeader } from '../../components/ui';
import { sar } from '../operations/delivery';
import { TimesheetStatusBadge } from './timesheets';

const monthIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

/** The month's projects with work, each with its timesheet (or the button to generate it), as the old "التحضير" page. */
export function TimesheetsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const ar = i18n.language === 'ar';
  const [params, setParams] = useSearchParams();
  const month = params.get('month') ?? monthIso(new Date());
  const [data, setData] = useState<TimesheetMonth | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = can('billing.timesheets.manage', true);

  const reload = useCallback(async () => {
    try {
      setData(await billingApi.month(month));
      setError(null);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [month]);

  useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);

  const shift = (by: number) => {
    const d = new Date(`${month}T00:00:00`);
    d.setMonth(d.getMonth() + by);
    setParams({ month: monthIso(d) }, { replace: true });
  };
  const monthName = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${month}T00:00:00`));

  const generate = async (projectId: string) => {
    setBusy(projectId);
    setError(null);
    try {
      const { id } = await billingApi.generate(projectId, month);
      navigate(`/billing/timesheets/${id}`);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(null);
    }
  };

  const generateAll = async () => {
    setBusy('all');
    setError(null);
    try {
      for (const p of data?.projects.filter((x) => !x.timesheetId && x.projectId) ?? []) {
        await billingApi.generate(p.projectId!, month);
      }
      await reload();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(null);
    }
  };

  const missing = data?.projects.filter((p) => !p.timesheetId && p.projectId).length ?? 0;

  return (
    <Box>
      <PageHeader
        title={t('timesheets.title')}
        subtitle={t('timesheets.intro')}
        actions={
          canManage && missing > 0 ? (
            <Button variant="contained" startIcon={<AutoModeOutlinedIcon />} disabled={busy !== null} onClick={() => void generateAll()}>
              {t('timesheets.generateAll', { count: missing })}
            </Button>
          ) : undefined
        }
      />

      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => shift(ar ? 1 : -1)} sx={{ bgcolor: '#fff', boxShadow: tokens.shadowXs }}>
          <ChevronRightIcon />
        </IconButton>
        <Box sx={{ minWidth: 220, textAlign: 'center', px: 3, py: 1, borderRadius: 999, bgcolor: '#fff', boxShadow: tokens.shadowSm }}>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: tokens.navy800 }}>{monthName}</Typography>
        </Box>
        <IconButton onClick={() => shift(ar ? -1 : 1)} sx={{ bgcolor: '#fff', boxShadow: tokens.shadowXs }}>
          <ChevronLeftIcon />
        </IconButton>
      </Stack>
      <ErrorMessage messageKey={error} />

      <KpiGrid count={5}>
        <KpiCard label={t('timesheets.cards.projects')} value={String(data?.totals.projects ?? 0)} foot={t('timesheets.cards.projectsFoot')} icon={<BusinessCenterOutlinedIcon />} tone={tokens.navy700} />
        <KpiCard label={t('timesheets.cards.generated')} value={String(data?.totals.generated ?? 0)} foot={t('timesheets.cards.generatedFoot', { count: missing })} icon={<PostAddOutlinedIcon />} tone="#6b7a90" />
        <KpiCard label={t('timesheets.cards.inApproval')} value={String(data?.totals.inApproval ?? 0)} foot={t('timesheets.cards.inApprovalFoot')} icon={<HourglassBottomOutlinedIcon />} tone="#d9822b" />
        <KpiCard label={t('timesheets.cards.approved')} value={String(data?.totals.approved ?? 0)} foot={t('timesheets.cards.approvedFoot')} icon={<AssignmentTurnedInOutlinedIcon />} tone="#1f9d55" />
        <KpiCard label={t('timesheets.cards.amount')} value={sar(data?.totals.invoiceAmount ?? 0)} foot={t('timesheets.cards.amountFoot')} icon={<PaymentsOutlinedIcon />} tone="#2b7bd9" />
      </KpiGrid>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        {(!data || busy === 'all') && !error && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('commercial.col.project')}</TableCell>
                <TableCell align="center">{t('timesheets.col.ledgerWorkers')}</TableCell>
                <TableCell>{t('timesheets.col.timesheet')}</TableCell>
                <TableCell align="center">{t('timesheets.col.workDays')}</TableCell>
                <TableCell align="center">{t('timesheets.col.amount')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.projects.map((p) => (
                <TableRow key={p.projectCrmId} hover sx={{ cursor: p.timesheetId ? 'pointer' : 'default' }} onClick={() => p.timesheetId && navigate(`/billing/timesheets/${p.timesheetId}`)}>
                  <TableCell sx={{ minWidth: 260 }}>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                      <Initials name={p.projectName} size={30} />
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{p.projectName}</Typography>
                        <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                          {[p.customerName, p.projectManager].filter(Boolean).join(' · ') || '—'}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Badge tone="info">{p.ledgerWorkers}</Badge>
                  </TableCell>
                  <TableCell>
                    {p.timesheetId ? (
                      <Stack spacing={0.4} sx={{ alignItems: 'flex-start' }}>
                        <Typography dir="ltr" sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.navy800 }}>
                          {p.timesheetNo}
                        </Typography>
                        <TimesheetStatusBadge status={p.status!} />
                      </Stack>
                    ) : p.projectId ? (
                      <Badge tone="neutral">{t('timesheets.notGenerated')}</Badge>
                    ) : (
                      <Tooltip title={t('timesheets.projectMissingHint')}>
                        <span>
                          <Badge tone="warning">{t('timesheets.projectMissing')}</Badge>
                        </span>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="center">{p.workDays === null ? '—' : sar(p.workDays)}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: tokens.navy800 }}>
                    {p.invoiceAmount === null ? '—' : sar(p.invoiceAmount)}
                  </TableCell>
                  <TableCell align="left" onClick={(e) => e.stopPropagation()}>
                    {!p.timesheetId && p.projectId && canManage && (
                      <Button size="small" variant="outlined" startIcon={<PostAddOutlinedIcon />} disabled={busy !== null} onClick={() => void generate(p.projectId!)}>
                        {t('timesheets.generate')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data && data.projects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {t('timesheets.empty')}
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
