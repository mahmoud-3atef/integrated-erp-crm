import Add from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Link,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { gosiCategories, staffPayrollApi, type GosiCategory, type GosiRate, type LateMode, type PaySettings } from '../../../api/staffPayroll';
import { useCrumb } from '../../../app/breadcrumbs';
import { useSession } from '../../../app/session';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { HrPageHeader, HrScope, hr, hrCard } from '../../../components/hr/Hr';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { money } from '../payroll';

/** A GOSI rate of a category from a date (a new row for a change: the earlier one stays for the earlier months). */
function RateDialog({ rate, onClose, onSaved }: { rate: GosiRate | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<GosiCategory>(rate?.category ?? 'SaudiNew');
  const [from, setFrom] = useState(rate?.effectiveFrom ?? new Date().toISOString().slice(0, 10));
  const [employee, setEmployee] = useState(String(rate?.employeePercent ?? 9.75));
  const [employer, setEmployer] = useState(String(rate?.employerPercent ?? 11.75));
  const [min, setMin] = useState(String(rate?.minBase ?? 1500));
  const [max, setMax] = useState(String(rate?.maxBase ?? 45000));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await staffPayrollApi.saveGosiRate(rate?.id ?? null, { category, effectiveFrom: from, employeePercent: Number(employee), employerPercent: Number(employer), minBase: Number(min), maxBase: Number(max) });
      onSaved();
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  const pct = { input: { endAdornment: <InputAdornment position="end">%</InputAdornment> }, htmlInput: { step: '0.01', dir: 'ltr' } };
  const sar = { input: { endAdornment: <InputAdornment position="end">{t('hr.sar')}</InputAdornment> }, htmlInput: { dir: 'ltr' } };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{rate ? t('staffPayroll.settings.editRate') : t('staffPayroll.settings.newRate')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <TextField select size="small" label={t('staffPayroll.gosi.category')} value={category} disabled={Boolean(rate)} onChange={(e) => setCategory(e.target.value as GosiCategory)}>
            {gosiCategories.map((c) => (
              <MenuItem key={c} value={c}>
                {t(`staffPayroll.gosiCategory.${c}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="date" label={t('staffPayroll.settings.from')} value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
            <TextField size="small" type="number" label={t('staffPayroll.gosi.employee')} value={employee} onChange={(e) => setEmployee(e.target.value)} slotProps={pct} />
            <TextField size="small" type="number" label={t('staffPayroll.gosi.employer')} value={employer} onChange={(e) => setEmployer(e.target.value)} slotProps={pct} />
            <TextField size="small" type="number" label={t('staffPayroll.settings.min')} value={min} onChange={(e) => setMin(e.target.value)} slotProps={sar} />
            <TextField size="small" type="number" label={t('staffPayroll.settings.max')} value={max} onChange={(e) => setMax(e.target.value)} slotProps={sar} />
          </Box>
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !from} onClick={() => void save()}>
            {t('common.save')}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

/** The staff payroll's rules (overtime, lateness) and GOSI's rates by category and date. */
export function StaffPaySettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const editable = can('payroll.settings.manage', true);
  useCrumb(t('staffPayroll.settings.pageTitle'));
  const [s, setS] = useState<PaySettings | null>(null);
  const [rates, setRates] = useState<GosiRate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<GosiRate | null | 'new'>(null);
  const load = useCallback(() => {
    Promise.all([staffPayrollApi.settings(), staffPayrollApi.gosiRates()])
      .then(([x, r]) => (setS(x), setRates(r), setError(null)))
      .catch((f) => setError(errorKey(f)));
  }, []);
  useEffect(load, [load]);
  if (!s || !rates) {
    return (
      <HrScope>
        <ErrorMessage messageKey={error} />
        {!error && <LinearProgress />}
      </HrScope>
    );
  }
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await staffPayrollApi.saveSettings(s);
      setSaved(true);
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };
  const set = <K extends keyof PaySettings>(k: K, v: PaySettings[K]) => (setS({ ...s, [k]: v }), setSaved(false));
  return (
    <HrScope>
      <HrPageHeader
        icon={<SettingsOutlinedIcon />}
        title={t('staffPayroll.settings.pageTitle')}
        subtitle={t('staffPayroll.settings.intro')}
        actions={
          <>
            {editable && (
              <Button variant="contained" disabled={busy} onClick={() => void save()}>
                {saved ? t('staffPayroll.settings.saved') : t('common.save')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') }} />} onClick={() => navigate(-1)}>
              {t('common.back')}
            </Button>
          </>
        }
      />
      <ErrorMessage messageKey={error} />
      <Box sx={{ ...(hrCard as object), p: 2, mb: 2 }}>
        <Typography sx={{ fontWeight: 700, mb: 1.5 }}>{t('staffPayroll.settings.rules')}</Typography>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
          <TextField size="small" type="number" disabled={!editable} label={t('staffPayroll.settings.premium')} value={s.overtimePremiumPercent} onChange={(e) => set('overtimePremiumPercent', Number(e.target.value))} slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> }, htmlInput: { dir: 'ltr' } }} />
          <TextField size="small" type="number" disabled={!editable} label={t('staffPayroll.settings.hours')} value={s.hoursPerDay} onChange={(e) => set('hoursPerDay', Number(e.target.value))} slotProps={{ input: { endAdornment: <InputAdornment position="end">{t('staffPayroll.settings.hoursUnit')}</InputAdornment> }, htmlInput: { dir: 'ltr' } }} />
          <TextField select size="small" disabled={!editable} label={t('staffPayroll.settings.late')} value={s.lateMode} onChange={(e) => set('lateMode', e.target.value as LateMode)}>
            <MenuItem value="None">{t('staffPayroll.settings.lateModes.None')}</MenuItem>
            <MenuItem value="PerMinute">{t('staffPayroll.settings.lateModes.PerMinute')}</MenuItem>
          </TextField>
        </Box>
        <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: 1.25 }}>{t('staffPayroll.settings.rulesHint')}</Typography>
        <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: 0.5 }}>
          {t('staffPayroll.settings.cap', { percent: s.monthlyCapPercent })}{' '}
          <Link component={RouterLink} to="/hr/deductions-settings">
            {t('staffPayroll.settings.capLink')}
          </Link>
        </Typography>
      </Box>
      <Box sx={{ ...(hrCard as object), p: 2 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>{t('staffPayroll.settings.gosi')}</Typography>
          {editable && (
            <Button variant="outlined" startIcon={<Add />} onClick={() => setEditing('new')}>
              {t('staffPayroll.settings.newRate')}
            </Button>
          )}
        </Stack>
        <Typography sx={{ fontSize: 12, color: hr.textMuted, mb: 1.25 }}>{t('staffPayroll.settings.gosiHint')}</Typography>
        <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
          <Table size="small" sx={{ '& td': { height: 44, fontVariantNumeric: 'tabular-nums' }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700 } }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('staffPayroll.gosi.category')}</TableCell>
                <TableCell>{t('staffPayroll.settings.from')}</TableCell>
                <TableCell align="right">{t('staffPayroll.gosi.employee')}</TableCell>
                <TableCell align="right">{t('staffPayroll.gosi.employer')}</TableCell>
                <TableCell align="right">{t('staffPayroll.settings.range')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{t(`staffPayroll.gosiCategory.${r.category}`)}</TableCell>
                  <TableCell>{date(r.effectiveFrom)}</TableCell>
                  <TableCell align="right">{r.employeePercent}%</TableCell>
                  <TableCell align="right">{r.employerPercent}%</TableCell>
                  <TableCell align="right">
                    <bdi>{`${money(r.minBase)} – ${money(r.maxBase)}`}</bdi>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'end' }}>
                    {editable && (
                      <IconButton size="small" aria-label={t('common.edit')} onClick={() => setEditing(r)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      {editing && (
        <RateDialog
          rate={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </HrScope>
  );
}
