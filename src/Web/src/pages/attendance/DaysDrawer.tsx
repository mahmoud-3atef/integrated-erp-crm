import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { Alert, Box, Button, Checkbox, Collapse, FormControlLabel, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { attendanceApi, hhmm, hm, manualStatuses, type Day, type DayStatus, type EmployeeMonth, type ManualStatus } from '../../api/attendance';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrDrawer, HrStatusBadge, hr } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { localRef } from './AttendanceMonthPage';

/** Each day status: its cell colour and its text colour (the label always says it too). */
export const dayLook: Record<DayStatus | 'Late', { bg: string; fg: string }> = {
  Present: { bg: '#FFFFFF', fg: '#059669' },
  Late: { bg: '#FFFBEB', fg: '#B45309' },
  MissingPunch: { bg: '#EFF6FF', fg: '#2563EB' },
  Absent: { bg: '#FFF1F2', fg: '#BE123C' },
  Excused: { bg: '#F0FDF4', fg: '#15803D' },
  Rest: { bg: '#F1F5F9', fg: '#94A3B8' },
  Holiday: { bg: '#F5F3FF', fg: '#7C3AED' },
  Leave: { bg: '#ECFDF5', fg: '#047857' },
  Mission: { bg: '#ECFEFF', fg: '#0E7490' },
  Exempt: { bg: '#F8FAFC', fg: '#475569' },
  NoData: { bg: '#FFFFFF', fg: '#CBD5E1' },
};

const look = (d: Day) => dayLook[d.status === 'Present' && d.lateMinutes > 0 ? 'Late' : d.status];

/** An employee's month: the calendar coloured by status, the chosen day with what the file said and its correction, and the summary. */
export function DaysDrawer({ period, employeeId, initialDate, canManage, onClose, onChanged }: { period: string; employeeId: string; initialDate?: string; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { date } = useCommercialFormat();
  const [data, setData] = useState<EmployeeMonth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(initialDate ?? null);
  const [version, setVersion] = useState(0);
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    attendanceApi
      .employee(period, employeeId)
      .then((d) => (setData(d), setError(null)))
      .catch((failure) => setError(errorKey(failure)));
  }, [period, employeeId, version]);

  const day = data?.days.find((d) => d.date === picked) ?? null;
  const weekdays = t('attendance.weekdays', { returnObjects: true }) as string[];
  const first = data?.days[0];
  const lead = first ? new Date(`${first.date}T00:00:00`).getDay() : 0;
  const name = data ? (ar ? (data.nameAr ?? data.nameEn) : data.nameEn) : '';
  const changed = () => {
    setVersion((v) => v + 1);
    onChanged();
  };

  return (
    <HrDrawer
      open
      onClose={onClose}
      width={560}
      avatar={data ? <HrAvatar name={data.nameEn || name} size={44} /> : undefined}
      title={name || '…'}
      subtitle={
        data && (
          <>
            <bdi>{data.employeeNo}</bdi>
            {(ar ? data.departmentAr : data.departmentEn) ? ` · ${ar ? data.departmentAr : data.departmentEn}` : ''}
            {data.shiftAr && ` · ${localRef({ nameAr: data.shiftAr, nameEn: data.shiftEn }, ar)} `}
            {data.shiftStartsAt && <bdi dir="ltr">{`${hhmm(data.shiftStartsAt)} – ${hhmm(data.shiftEndsAt)}`}</bdi>}
            {data.graceMinutes !== null && ` · ${t('attendance.drawer.grace', { minutes: data.graceMinutes })}`}
          </>
        )
      }
    >
      <ErrorMessage messageKey={error} />
      {!data ? (
        <LinearProgress />
      ) : (
        <Stack sx={{ gap: 1.75, overflowY: 'auto', mx: -0.5, px: 0.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75 }}>
            {weekdays.map((w) => (
              <Typography key={w} sx={{ fontSize: 11, color: hr.textMuted, textAlign: 'center' }}>
                {w}
              </Typography>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <Box key={`lead-${i}`} />
            ))}
            {data.days.map((d) => {
              const l = look(d);
              const on = d.date === picked;
              return (
                <Box
                  key={d.date}
                  component="button"
                  type="button"
                  onClick={() => setPicked(d.date)}
                  aria-pressed={on}
                  aria-label={`${date(d.date)} · ${t(`attendance.status.${d.status}`)}`}
                  sx={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    minHeight: 56,
                    borderRadius: '8px',
                    p: 0.6,
                    bgcolor: l.bg,
                    border: `1px solid ${on ? hr.primary : hr.border}`,
                    boxShadow: on ? `0 0 0 2px #BFDBFE` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.1,
                    '&:focus-visible': { outline: `2px solid ${hr.primary}` },
                  }}
                >
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums' }}>{Number(d.date.slice(8))}</Typography>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: l.fg, lineHeight: 1.2 }}>
                    {d.status === 'Present' && d.lateMinutes > 0 ? t('attendance.status.Late') : d.status === 'Holiday' ? (localRef({ nameAr: d.holidayAr, nameEn: d.holidayEn }, ar) || t('attendance.status.Holiday')) : t(`attendance.status.${d.status}`)}
                  </Typography>
                  {(d.in || d.out) && (
                    <Typography sx={{ fontSize: 10, color: hr.textMuted, fontVariantNumeric: 'tabular-nums', lineHeight: 1.35 }}>
                      {hhmm(d.in) ?? '—'}
                      <br />
                      {hhmm(d.out) ?? '—'}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
          {day ? <DayCard key={`${day.date}-${version}`} employeeId={data.employeeId} day={day} canManage={canManage} onSaved={changed} /> : <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('attendance.drawer.pick')}</Typography>}
          <Box sx={{ border: `1px solid ${hr.border}`, borderRadius: '12px', p: 1.5 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('attendance.drawer.summary')}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, textAlign: 'center' }}>
              {(
                [
                  [t('attendance.cols.present'), String(data.summary.present)],
                  [t('attendance.cols.absent'), String(data.summary.absent)],
                  [t('attendance.cols.late'), hm(data.summary.lateMinutes)],
                  [t('attendance.cols.deduction'), String(data.summary.deduction)],
                ] as const
              ).map(([l, v]) => (
                <Box key={l}>
                  <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{l}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                    <bdi>{v}</bdi>
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
          {canManage && (
            <Box>
              <Button size="small" startIcon={<SettingsOutlinedIcon />} onClick={() => setSettings((s) => !s)}>
                {t('attendance.drawer.settings')}
              </Button>
              <Collapse in={settings} unmountOnExit>
                <EmployeeSettings data={data} onSaved={changed} />
              </Collapse>
            </Box>
          )}
        </Stack>
      )}
    </HrDrawer>
  );
}

function DayCard({ employeeId, day, canManage, onSaved }: { employeeId: string; day: Day; canManage: boolean; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { date } = useCommercialFormat();
  const [inTime, setIn] = useState(hhmm(day.in) ?? '');
  const [outTime, setOut] = useState(hhmm(day.out) ?? '');
  const [status, setStatus] = useState<ManualStatus | ''>(day.manualStatus ?? '');
  const [note, setNote] = useState(day.note ?? '');
  const [deduction, setDeduction] = useState(day.deductionSet === null ? '' : String(day.deductionSet));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const l = look(day);
  const weekday = (t('attendance.weekdays', { returnObjects: true }) as string[])[new Date(`${day.date}T00:00:00`).getDay()];
  const editable = canManage && day.status !== 'NoData';

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await attendanceApi.correct(employeeId, day.date, {
        in: inTime && inTime !== hhmm(day.deviceIn) ? inTime : null,
        out: outTime && outTime !== hhmm(day.deviceOut) ? outTime : null,
        status: status || null,
        note: note.trim() || null,
        deduction: deduction === '' ? null : Number(deduction),
      });
      setSaved(true);
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ border: `1px solid ${hr.border}`, borderRadius: '12px', p: 1.5, display: 'grid', gap: 1 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>
          {weekday} <bdi>{date(day.date)}</bdi>
          {day.ramadan ? ` · ${t('shifts.ramadan')}` : ''}
        </Typography>
        <HrStatusBadge label={day.status === 'Holiday' ? localRef({ nameAr: day.holidayAr, nameEn: day.holidayEn }, ar) || t('attendance.status.Holiday') : t(`attendance.status.${day.status}`)} color={l.fg} tint={l.bg === '#FFFFFF' ? '#F0FDF4' : l.bg} />
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, fontSize: 12.5 }}>
        {(
          [
            [t('attendance.cols.in'), hhmm(day.in) ?? '—'],
            [t('attendance.cols.out'), hhmm(day.out) ?? '—'],
            [t('attendance.cols.late'), hm(day.lateMinutes)],
            [t('attendance.drawer.worked'), hm(day.workedMinutes)],
          ] as const
        ).map(([k, v]) => (
          <Box key={k} sx={{ bgcolor: hr.muted, borderRadius: '8px', px: 1, py: 0.75 }}>
            <Typography sx={{ fontSize: 11, color: hr.textMuted }}>{k}</Typography>
            <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              <bdi>{v}</bdi>
            </Typography>
          </Box>
        ))}
      </Box>
      {(day.deviceStatus || day.deviceIn || day.deviceOut) && (
        <Typography sx={{ fontSize: 12, color: hr.textMuted }}>
          {day.deviceStatus && t('attendance.drawer.device', { status: day.deviceStatus })}
          {(day.deviceIn || day.deviceOut) && (
            <>
              {' · '}
              <bdi dir="ltr">{t('attendance.drawer.deviceTimes', { in: hhmm(day.deviceIn) ?? '—', out: hhmm(day.deviceOut) ?? '—' })}</bdi>
            </>
          )}
          {day.permissionMinutes > 0 && ` · ${t('attendance.drawer.permission', { minutes: day.permissionMinutes })}`}
          {(day.deviceLateMinutes !== null || day.deviceEarlyMinutes !== null) && ` · ${t('attendance.drawer.deviceMinutes', { late: hm(day.deviceLateMinutes ?? 0), early: hm(day.deviceEarlyMinutes ?? 0) })}`}
        </Typography>
      )}
      {day.editedByName && <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{t('attendance.drawer.edited', { by: day.editedByName, date: date(day.editedAt) })}</Typography>}
      {editable && (
        <Box sx={{ borderTop: `1px dashed ${hr.border}`, pt: 1, display: 'grid', gap: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{t('attendance.drawer.correct')}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <TextField size="small" type="time" label={t('attendance.drawer.in')} value={inTime} onChange={(e) => setIn(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="time" label={t('attendance.drawer.out')} value={outTime} onChange={(e) => setOut(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField select size="small" label={t('attendance.drawer.statusOver')} value={status} onChange={(e) => setStatus(e.target.value as ManualStatus | '')} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value="">{t('attendance.drawer.calculated')}</MenuItem>
              {manualStatuses.map((s) => (
                <MenuItem key={s} value={s}>
                  {t(`attendance.manual.${s}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              type="number"
              label={t('attendance.drawer.deduction')}
              value={deduction}
              onChange={(e) => setDeduction(e.target.value)}
              helperText={t('attendance.drawer.deductionHint', { value: day.deduction })}
              slotProps={{ htmlInput: { min: 0, max: 3, step: 0.25 }, inputLabel: { shrink: true } }}
            />
          </Box>
          <TextField size="small" label={t('attendance.drawer.note')} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 500 } }} />
          <ErrorMessage messageKey={error} />
          {saved && <Alert severity="success">{t('attendance.drawer.saved')}</Alert>}
          <Box>
            <Button variant="contained" disabled={busy} onClick={() => void save()}>
              {t('attendance.drawer.save')}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function EmployeeSettings({ data, onSaved }: { data: EmployeeMonth; onSaved: () => void }) {
  const { t } = useTranslation();
  const [badge, setBadge] = useState(data.badgeNo ?? '');
  const [exempt, setExempt] = useState(data.exempt);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await attendanceApi.saveEmployee(data.employeeId, { badgeNo: badge.trim() || null, exempt });
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box sx={{ display: 'grid', gap: 1, mt: 1, border: `1px solid ${hr.border}`, borderRadius: '12px', p: 1.5 }}>
      {data.idNumber && (
        <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>
          {t('attendance.drawer.idNumber')} <bdi>{data.idNumber}</bdi>
        </Typography>
      )}
      <TextField size="small" label={t('attendance.drawer.badge')} helperText={t('attendance.drawer.badgeHint')} value={badge} onChange={(e) => setBadge(e.target.value)} slotProps={{ htmlInput: { maxLength: 30, dir: 'ltr' } }} />
      <FormControlLabel control={<Checkbox checked={exempt} onChange={(e) => setExempt(e.target.checked)} />} label={t('attendance.drawer.exempt')} />
      <ErrorMessage messageKey={error} />
      <Box>
        <Button variant="outlined" disabled={busy} onClick={() => void save()}>
          {t('common.save')}
        </Button>
      </Box>
    </Box>
  );
}
