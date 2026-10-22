import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { billingApi, type BillingSettings } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';

/** A month's billing period from the project's cycle (as the server's TimesheetMath.Cycle): the month, or from a day of the month before. */
export function cycleOf(month: string, startDay: number): [string, string] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (startDay <= 1) return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
  const day = Math.min(startDay, 28);
  return [iso(new Date(y, m - 2, day)), iso(new Date(y, m - 1, day - 1))];
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

/** The cycle's start day: the calendar month, or from a day to the day before it of the next month. */
function CycleField({ value, onChange }: { value: number; onChange: (day: number) => void }) {
  const { t } = useTranslation();
  return (
    <TextField select label={t('timesheets.settings.cycleStartDay')} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {Array.from({ length: 28 }, (_, n) => n + 1).map((d) => (
        <MenuItem key={d} value={d}>
          {d === 1 ? t('timesheets.settings.calendarMonth') : t('timesheets.settings.fromDay', { day: d, prev: d - 1 })}
        </MenuItem>
      ))}
    </TextField>
  );
}

function BasisField({ value, onChange }: { value: BillingSettings['dayBasis']; onChange: (basis: BillingSettings['dayBasis']) => void }) {
  const { t } = useTranslation();
  return (
    <TextField select label={t('timesheets.settings.dayBasis')} value={value} onChange={(e) => onChange(e.target.value as BillingSettings['dayBasis'])}>
      <MenuItem value="Thirty">{t('timesheets.dayBasis.Thirty')}</MenuItem>
      <MenuItem value="ActualDays">{t('timesheets.dayBasis.ActualDays')}</MenuItem>
    </TextField>
  );
}

/** A project's timesheet settings: the cycle, the day basis, overtime, GOSI and VAT (from the project or a timesheet). */
export function TimesheetSettingsDialog({ projectId, projectName, settings, onClose, onSaved }: { projectId: string; projectName: string; settings: BillingSettings; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [s, setS] = useState<BillingSettings>(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const num = (key: keyof BillingSettings, label: string, scale = 1) => (
    <TextField
      label={label}
      value={s[key] === null ? '' : String(Math.round(Number(s[key]) * scale * 10000) / 10000)}
      onChange={(e) => setS({ ...s, [key]: e.target.value === '' ? null : Number(e.target.value.replace(/[^\d.]/g, '')) / scale })}
      slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }}
    />
  );

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('timesheets.settings.title')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Typography sx={{ fontSize: 12.5, color: tokens.gray500, mb: 2 }}>{t('timesheets.settings.hint', { project: projectName })}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <CycleField value={s.cycleStartDay} onChange={(cycleStartDay) => setS({ ...s, cycleStartDay })} />
          <BasisField value={s.dayBasis} onChange={(dayBasis) => setS({ ...s, dayBasis })} />
          {num('overtimeMultiplier', t('timesheets.settings.overtimeMultiplier'))}
          {num('monthlyHours', t('timesheets.settings.monthlyHours'))}
          {num('overtimeHourlyRate', t('timesheets.settings.overtimeHourlyRate'))}
          {num('maxOvertimeHours', t('timesheets.settings.maxOvertimeHours'))}
          {num('gosiRate', t('timesheets.settings.gosiRate'), 100)}
          {num('vatRate', t('timesheets.settings.vatRate'), 100)}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            billingApi
              .saveSettings(projectId, s)
              .then(onSaved)
              .catch((failure: unknown) => setError(errorKey(failure)))
              .finally(() => setBusy(false));
          }}
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * «إنشاء التحضير الشهري» from a project's page: the month, its period and day basis from the project's settings (they
 * can be changed here, and are then saved as the project's settings); OK generates the timesheet and opens it.
 */
export function CreateTimesheetDialog({ projectId, projectName, onClose }: { projectId: string; projectName: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [cycle, setCycle] = useState(1);
  const [basis, setBasis] = useState<BillingSettings['dayBasis']>('Thirty');
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    billingApi
      .settings(projectId)
      .then((s) => {
        setSettings(s);
        setCycle(s.cycleStartDay);
        setBasis(s.dayBasis);
      })
      .catch((e) => setError(errorKey(e)));
  }, [projectId]);

  // This month and the eleven before it.
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, n) => new Date(now.getFullYear(), now.getMonth() - n, 1));
  }, []);
  const label = (d: Date) => new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(d);
  const [from, to] = cycleOf(month, cycle);
  const changed = settings !== null && (settings.cycleStartDay !== cycle || settings.dayBasis !== basis);

  const create = async () => {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      // A changed period or day basis becomes the project's setting, so the timesheet is generated with it.
      if (changed) {
        await billingApi.saveSettings(projectId, { ...settings, cycleStartDay: cycle, dayBasis: basis });
      }
      const { id } = await billingApi.generate(projectId, month);
      navigate(`/billing/timesheets/${id}`);
    } catch (e) {
      setError(errorKey(e));
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="create-timesheet">
      <DialogTitle id="create-timesheet">{t('timesheets.create.title')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Typography sx={{ fontSize: 12.5, color: tokens.gray500, mb: 2 }}>{t('timesheets.create.hint', { project: projectName })}</Typography>
        {!settings ? (
          <Skeleton variant="rounded" height={160} />
        ) : (
          <Stack sx={{ gap: 2 }}>
            <TextField select label={t('timesheets.create.month')} value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((d) => (
                <MenuItem key={monthKey(d)} value={monthKey(d)}>
                  {label(d)}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <CycleField value={cycle} onChange={setCycle} />
              <BasisField value={basis} onChange={setBasis} />
            </Box>
            <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: tokens.navy50, color: tokens.navy800, fontSize: 13.5, fontWeight: 700 }}>
              {t('timesheets.create.period')} <bdi dir="ltr">{from.replaceAll('-', '/')}</bdi> ← <bdi dir="ltr">{to.replaceAll('-', '/')}</bdi> · {t(`timesheets.dayBasis.${basis}`)}
            </Box>
            {changed && (
              <Alert severity="info" sx={{ py: 0 }}>
                {t('timesheets.create.willSave')}
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" disabled={!settings || busy} onClick={() => void create()}>
          {busy ? t('timesheets.create.creating') : t('timesheets.create.ok')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
