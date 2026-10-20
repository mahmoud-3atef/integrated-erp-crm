import Add from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { periodOf, shiftPeriod } from '../../../api/attendance';
import { errorKey } from '../../../api/auth';
import { staffPayrollApi, type StaffRunChecks, type StaffRunItem } from '../../../api/staffPayroll';
import { useSession } from '../../../app/session';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { HrEmptyState, HrPageHeader, HrScope, hr, hrCard } from '../../../components/hr/Hr';
import { useMonthName as usePeriodName } from '../../attendance/AttendanceMonthPage';
import { money, RunStatusBadge } from '../payroll';
import { useLegalEntities } from '../RunDialogs';

type View = 'all' | 'open' | 'pending' | 'approved';

/** The staff payroll runs: one per commercial registration and closed attendance month. */
export function StaffRunsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const periodName = usePeriodName();
  const [view, setView] = useState<View>('all');
  const [runs, setRuns] = useState<StaffRunItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => {
    setRuns(null);
    setError(null);
    staffPayrollApi
      .runs({ tab: view })
      .then(setRuns)
      .catch((f) => setError(errorKey(f)));
  }, [view]);
  useEffect(load, [load]);
  return (
    <HrScope>
      <HrPageHeader
        icon={<RequestQuoteOutlinedIcon />}
        title={t('staffPayroll.title')}
        subtitle={t('staffPayroll.intro')}
        actions={
          <>
            {can('payroll.staff.view', true) && (
              <Button variant="outlined" startIcon={<SettingsOutlinedIcon />} onClick={() => navigate('/payroll/staff-settings')}>
                {t('staffPayroll.settings.title')}
              </Button>
            )}
            {can('payroll.staff.manage', true) && (
              <Button variant="contained" startIcon={<Add />} onClick={() => setCreating(true)}>
                {t('staffPayroll.new')}
              </Button>
            )}
          </>
        }
      />
      <Box sx={{ ...(hrCard as object), px: 2, pb: 2 }}>
        <Tabs value={view} onChange={(_, v: View) => setView(v)} sx={{ borderBottom: `1px solid ${hr.border}`, mb: 1.5 }}>
          <Tab value="all" label={t('staffPayroll.tabs.all')} />
          <Tab value="open" label={t('staffPayroll.tabs.open')} />
          <Tab value="pending" label={t('staffPayroll.tabs.pending')} />
          <Tab value="approved" label={t('staffPayroll.tabs.approved')} />
        </Tabs>
        {error ? (
          <Stack sx={{ gap: 1, alignItems: 'flex-start' }}>
            <ErrorMessage messageKey={error} />
            <Button size="small" variant="outlined" onClick={load}>
              {t('staffPayroll.retry')}
            </Button>
          </Stack>
        ) : !runs ? (
          <Stack sx={{ gap: 0.75 }}>
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="rounded" height={42} />)}
          </Stack>
        ) : runs.length === 0 ? (
          <HrEmptyState icon={<RequestQuoteOutlinedIcon />} title={t('staffPayroll.none')} hint={t('staffPayroll.noneHint')} />
        ) : (
          <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
            <Table size="small" sx={{ '& td': { height: 46, fontVariantNumeric: 'tabular-nums' }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700, color: '#334155' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('staffPayroll.cols.no')}</TableCell>
                  <TableCell>{t('staffPayroll.cols.legalEntity')}</TableCell>
                  <TableCell>{t('staffPayroll.cols.period')}</TableCell>
                  <TableCell align="right">{t('staffPayroll.cols.employees')}</TableCell>
                  <TableCell align="right">{t('staffPayroll.cols.net')}</TableCell>
                  <TableCell>{t('staffPayroll.cols.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/payroll/staff/${r.id}`)}>
                    <TableCell sx={{ fontWeight: 700 }}>
                      <RouterLink to={`/payroll/staff/${r.id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none' }}>
                        <bdi>{r.runNo}</bdi>
                      </RouterLink>
                    </TableCell>
                    <TableCell>{r.legalEntityName}</TableCell>
                    <TableCell>{periodName(r.period)}</TableCell>
                    <TableCell align="right">{r.employees}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {money(r.net)}
                    </TableCell>
                    <TableCell>
                      <RunStatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
      {creating && <NewStaffRunDialog onClose={() => setCreating(false)} onCreated={(id) => navigate(`/payroll/staff/${id}`)} />}
    </HrScope>
  );
}

/** A new run: the registration and a closed attendance month, with what the run will and will not cover checked first. */
function NewStaffRunDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const periodName = usePeriodName();
  const entities = useLegalEntities();
  const [entity, setEntity] = useState('');
  const now = periodOf(new Date());
  const periods = Array.from({ length: 6 }, (_, i) => shiftPeriod(now, -i));
  const [period, setPeriod] = useState(now);
  const [checks, setChecks] = useState<StaffRunChecks | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!entity && entities[0]) setEntity(entities[0].id);
  }, [entities, entity]);
  useEffect(() => {
    if (!entity) return;
    setChecks(null);
    staffPayrollApi
      .checks(entity, period)
      .then((c) => (setChecks(c), setError(null)))
      .catch((f) => setError(errorKey(f)));
  }, [entity, period]);
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      onCreated((await staffPayrollApi.create({ legalEntityId: entity, period })).id);
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  const blocked = !checks || !checks.attendanceClosed || Boolean(checks.existingRunNo) || Boolean(checks.earlierOpenRunNo) || checks.employees === 0;
  const line = (ok: boolean, text: string) => (
    <Stack direction="row" key={text} sx={{ gap: 0.75, alignItems: 'center', fontSize: 13 }}>
      {ok ? <CheckCircleOutlineIcon sx={{ fontSize: 17, color: hr.success }} /> : <WarningAmberOutlinedIcon sx={{ fontSize: 17, color: hr.warning }} />}
      <Typography sx={{ fontSize: 13 }}>{text}</Typography>
    </Stack>
  );
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('staffPayroll.new')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField select size="small" required label={t('staffPayroll.cols.legalEntity')} value={entity} onChange={(e) => setEntity(e.target.value)}>
              {entities.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {ar ? e.nameAr : e.nameEn}
                </MenuItem>
              ))}
            </TextField>
            <TextField select size="small" required label={t('staffPayroll.attendanceMonth')} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periods.map((p) => (
                <MenuItem key={p} value={p}>
                  {periodName(p)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ bgcolor: '#F8FAFC', border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.5, display: 'grid', gap: 0.6 }}>
            {!checks ? (
              <LinearProgress />
            ) : (
              <>
                {line(checks.attendanceClosed, checks.attendanceClosed ? t('staffPayroll.checks.closed', { month: periodName(period) }) : t('staffPayroll.checks.notClosed', { month: periodName(period) }))}
                {checks.attendanceClosed && line(checks.employees > 0, t('staffPayroll.checks.employees', { count: checks.employees }))}
                {checks.withoutRegistration > 0 && line(false, t('staffPayroll.checks.noRegistration', { count: checks.withoutRegistration }))}
                {checks.noSalary > 0 && line(false, t('staffPayroll.checks.noSalary', { count: checks.noSalary }))}
                {checks.withoutIban > 0 && line(false, t('staffPayroll.checks.noIban', { count: checks.withoutIban }))}
                {checks.existingRunNo && line(false, t('staffPayroll.checks.existing', { no: checks.existingRunNo }))}
                {checks.earlierOpenRunNo && line(false, t('staffPayroll.checks.earlier', { no: checks.earlierOpenRunNo }))}
                {!checks.existingRunNo && !checks.earlierOpenRunNo && line(true, t('staffPayroll.checks.noOverlap'))}
              </>
            )}
          </Box>
          <Alert severity="info" sx={{ py: 0 }}>
            {t('staffPayroll.newHint')}
          </Alert>
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || blocked} onClick={() => void create()}>
            {t('staffPayroll.create')}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}
