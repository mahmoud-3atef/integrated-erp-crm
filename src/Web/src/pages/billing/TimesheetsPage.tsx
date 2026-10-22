import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import AutoModeOutlinedIcon from '@mui/icons-material/AutoModeOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { billingApi, type MonthProject, type TimesheetMonth } from '../../api/billing';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, Initials } from '../../components/ui';
import { sar } from '../operations/delivery';
import { InvoiceStatusBadge } from './invoices';
import { TimesheetStatusBadge, timesheetTone } from './timesheets';
import { ListHero, rowEdge, StageLine, StatusStrip, StripItem, toneHead, useCurrentStages } from '../../components/ListLayout';
import { toneColors } from '../../app/theme';

type CardFilter = 'all' | 'generated' | 'inApproval' | 'approved' | 'invoiced' | 'notGenerated';

/** Which projects a card shows: all, with a timesheet, in approval, approved, or with an issued invoice. */
const cardFilters: Record<CardFilter, (p: MonthProject) => boolean> = {
  all: () => true,
  generated: (p) => p.timesheetId !== null,
  inApproval: (p) => p.status === 'InApproval',
  approved: (p) => p.status === 'Approved',
  invoiced: (p) => p.invoiceDoc?.status === 'Issued',
  notGenerated: (p) => p.timesheetId === null,
};

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
  const [card, setCard] = useState<CardFilter>('generated');
  const [search, setSearch] = useState('');
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
  const term = search.trim().toLowerCase();
  const rows = (data?.projects ?? []).filter(
    (p) => cardFilters[card](p) && (!term || [p.projectName, p.customerName, p.projectManager, p.timesheetNo, p.invoiceDoc?.invoiceNo].some((v) => v?.toLowerCase().includes(term))),
  );
  const toggle = (value: CardFilter) => setCard(card === value ? 'all' : value);

  const stages = useCurrentStages('billing.timesheet', rows.flatMap((x) => (x.timesheetId ? [x.timesheetId] : [])));

  return (
    <Box>
      <ListHero tone="timesheet" icon={<CalendarMonthOutlinedIcon />}
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

      <StatusStrip count={5}>
        <StripItem active={card === 'generated'} onClick={() => toggle('generated')} label={t('timesheets.cards.generated')} value={String(data?.totals.generated ?? 0)} foot={t('timesheets.cards.generatedOf', { count: data?.totals.projects ?? 0 })} icon={<PostAddOutlinedIcon />} tone={tokens.navy700} />
        <StripItem active={card === 'inApproval'} onClick={() => toggle('inApproval')} label={t('timesheets.cards.inApproval')} value={String(data?.totals.inApproval ?? 0)} foot={t('timesheets.cards.inApprovalFoot')} icon={<HourglassBottomOutlinedIcon />} tone="#d9822b" />
        <StripItem active={card === 'approved'} onClick={() => toggle('approved')} label={t('timesheets.cards.approved')} value={String(data?.totals.approved ?? 0)} foot={t('timesheets.cards.approvedFoot')} icon={<AssignmentTurnedInOutlinedIcon />} tone="#1f9d55" />
        <StripItem active={card === 'invoiced'} onClick={() => toggle('invoiced')} label={t('timesheets.cards.amount')} value={sar(data?.totals.invoiceAmount ?? 0)} foot={t('timesheets.cards.amountFoot', { count: data?.totals.invoiced ?? 0 })} icon={<PaymentsOutlinedIcon />} tone="#2b7bd9" />
        <StripItem active={card === 'notGenerated'} onClick={() => toggle('notGenerated')} label={t('timesheets.cards.notGenerated')} value={String(missing)} foot={t('timesheets.cards.notGeneratedFoot')} icon={<BusinessCenterOutlinedIcon />} tone="#6b7a90" />
      </StatusStrip>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, alignItems: { sm: 'center' }, mb: 1.5 }}>
          <TextField
            size="small"
            sx={{ minWidth: 300 }}
            placeholder={t('timesheets.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          {(card !== 'all' || term) && (
            <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>
              {t('timesheets.filtered', { shown: rows.length, total: data?.projects.length ?? 0 })}{' '}
              <Button size="small" onClick={() => (setCard('all'), setSearch(''))}>
                {t('timesheets.clearFilter')}
              </Button>
            </Typography>
          )}
        </Stack>
        {(!data || busy === 'all') && !error && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead sx={toneHead('timesheet')}>
              <TableRow>
                <TableCell>{t('commercial.col.project')}</TableCell>
                <TableCell align="center">{t('timesheets.col.ledgerWorkers')}</TableCell>
                <TableCell>{t('timesheets.col.timesheet')}</TableCell>
                <TableCell align="center">{t('timesheets.col.workDays')}</TableCell>
                <TableCell align="center">{t('timesheets.col.amount')}</TableCell>
                <TableCell>{t('timesheets.col.invoiceDoc')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.projectCrmId} hover sx={[{ cursor: p.timesheetId ? 'pointer' : 'default' }, rowEdge(p.status ? toneColors[timesheetTone[p.status]].fg : tokens.gray300)]} onClick={() => p.timesheetId && navigate(`/billing/timesheets/${p.timesheetId}`)}>
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
                        <StageLine stage={stages[p.timesheetId]} />
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
                  <TableCell onClick={(e) => (p.invoiceDoc ? (e.stopPropagation(), navigate(`/billing/invoices/${p.invoiceDoc.id}`)) : undefined)}>
                    {p.invoiceDoc ? (
                      <Stack spacing={0.4} sx={{ alignItems: 'flex-start' }}>
                        <Typography dir="ltr" sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.navy800 }}>
                          {p.invoiceDoc.invoiceNo ?? t('invoices.noNumber')}
                        </Typography>
                        <InvoiceStatusBadge status={p.invoiceDoc.status} />
                      </Stack>
                    ) : (
                      '—'
                    )}
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
              {data && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {data.projects.length === 0 ? t('timesheets.empty') : t('timesheets.noMatch')}
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
