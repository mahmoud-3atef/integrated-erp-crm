import Add from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { attendanceApi, hhmm, matchBys, type AttendanceSetupData, type Holiday, type HolidayKind, type MatchBy, type Shift, type ShiftInput } from '../../api/attendance';
import { staffApi, type Department } from '../../api/staff';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { localRef } from './AttendanceMonthPage';

const accents = ['#2563EB', '#D97706', '#059669', '#7C3AED', '#DB2777', '#0E7490'];

/** The shifts (with Ramadan hours) and who has them, the year's holidays, the attendance settings and the calculation rules. */
export function ShiftsPage() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<AttendanceSetupData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Shift | 'new' | null>(null);
  const [assigning, setAssigning] = useState<Shift | null>(null);
  const [holiday, setHoliday] = useState<Holiday | 'new' | null>(null);
  const [version, setVersion] = useState(0);
  const canSet = can('attendance.settings', true);
  const weekdays = t('attendance.weekdays', { returnObjects: true }) as string[];

  useEffect(() => {
    attendanceApi
      .setup(year)
      .then((d) => (setData(d), setError(null)))
      .catch((failure) => setError(errorKey(failure)));
  }, [year, version]);
  useEffect(() => {
    staffApi.structure().then((s) => setDepartments(s.departments)).catch(() => setDepartments([]));
  }, []);

  const reload = () => setVersion((v) => v + 1);
  const remove = async (run: () => Promise<void>, name: string) => {
    if (!window.confirm(t('shifts.confirmDelete', { name }))) return;
    try {
      await run();
      reload();
    } catch (failure) {
      setError(errorKey(failure));
    }
  };

  return (
    <HrScope>
      <HrPageHeader
        icon={<EventNoteOutlinedIcon />}
        title={t('shifts.title')}
        subtitle={t('shifts.intro')}
        actions={
          canSet && (
            <>
              <Button variant="outlined" startIcon={<Add />} onClick={() => setHoliday('new')}>
                {t('shifts.newHoliday')}
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => setEditing('new')}>
                {t('shifts.new')}
              </Button>
            </>
          )
        }
      />
      <ErrorMessage messageKey={error} />
      {!data ? (
        <LinearProgress />
      ) : (
        <Stack sx={{ gap: 1.75 }}>
          <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
            {data.shifts.map((s, i) => (
              <Box key={s.id} sx={{ ...(hrCard as object), p: 1.75, borderTop: `3px solid ${accents[i % accents.length]}`, display: 'grid', gap: 1, alignContent: 'start', opacity: s.isActive ? 1 : 0.6 }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{localRef(s, ar)}</Typography>
                  {s.isDefault && <HrStatusBadge label={t('shifts.default')} color={hr.primary} tint="#EFF6FF" />}
                  {!s.isActive && <HrStatusBadge label={t('shifts.inactive')} color={hr.textMuted} tint={hr.muted} />}
                  {canSet && (
                    <Button size="small" variant="outlined" onClick={() => setEditing(s)}>
                      {t('shifts.edit')}
                    </Button>
                  )}
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <Fact label={t('shifts.hours')} value={<bdi dir="ltr">{`${hhmm(s.startsAt)} – ${hhmm(s.endsAt)}`}</bdi>} />
                  <Fact label={t('shifts.break')} value={t('shifts.minutes', { count: s.breakMinutes })} />
                  <Fact label={t('shifts.grace')} value={t('shifts.minutes', { count: s.graceMinutes })} />
                  <Fact label={t('shifts.rest')} value={s.restDays.map((d) => weekdays[d]).join('، ') || '—'} />
                </Box>
                <Box sx={{ bgcolor: '#F5F3FF', borderRadius: '8px', px: 1.25, py: 0.75, fontSize: 12.5 }}>
                  <Box component="b" sx={{ color: hr.violet }}>
                    {t('shifts.ramadan')}:{' '}
                  </Box>
                  {s.ramadanStartsAt ? <bdi dir="ltr">{`${hhmm(s.ramadanStartsAt)} – ${hhmm(s.ramadanEndsAt)}`}</bdi> : t('shifts.noRamadan')}
                </Box>
                <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{t(`shifts.lateFrom.${s.lateFrom}`)}</Typography>
                <Box sx={{ borderTop: `1px dashed ${hr.border}`, pt: 1 }}>
                  <Stack direction="row" sx={{ alignItems: 'center', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>
                      {t('shifts.assigned')} · {t('shifts.employees', { count: s.employees })}
                    </Typography>
                    {canSet && (
                      <Button size="small" startIcon={<Add />} onClick={() => setAssigning(s)}>
                        {t('shifts.assign')}
                      </Button>
                    )}
                  </Stack>
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                    {s.isDefault && <Chip size="small" label={t('shifts.assignedDefault')} />}
                    {s.assignments.map((a) => (
                      <Chip
                        key={a.id}
                        size="small"
                        variant="outlined"
                        label={
                          <span>
                            {localRef(a, ar)} · <bdi>{date(a.from)}</bdi>
                            {a.to ? <> – <bdi>{date(a.to)}</bdi></> : ''}
                          </span>
                        }
                        onDelete={canSet ? () => void remove(() => attendanceApi.unassign(a.id), localRef(a, ar)) : undefined}
                      />
                    ))}
                  </Stack>
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: '1.25fr 1fr' }, alignItems: 'start' }}>
            <Box sx={{ ...(hrCard as object), px: 2, pb: 2 }}>
              <Tabs value={year} onChange={(_, v: number) => setYear(v)} sx={{ borderBottom: `1px solid ${hr.border}`, mb: 1.5 }}>
                {[year - 1, year, year + 1].map((y) => (
                  <Tab key={y} value={y} label={t('shifts.holidays', { year: y })} />
                ))}
              </Tabs>
              {data.holidays.length === 0 ? (
                <HrEmptyState icon={<EventNoteOutlinedIcon />} title={t('shifts.noHolidays')} />
              ) : (
                <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
                  <Table size="small" sx={{ '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('shifts.cols.name')}</TableCell>
                        <TableCell>{t('shifts.cols.from')}</TableCell>
                        <TableCell>{t('shifts.cols.to')}</TableCell>
                        <TableCell>{t('shifts.cols.days')}</TableCell>
                        <TableCell>{t('shifts.cols.kind')}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.holidays.map((h) => (
                        <TableRow key={h.id} hover sx={{ cursor: canSet ? 'pointer' : undefined }} onClick={() => canSet && setHoliday(h)}>
                          <TableCell sx={{ fontWeight: 700 }}>{localRef(h, ar)}</TableCell>
                          <TableCell>{date(h.from)}</TableCell>
                          <TableCell>{date(h.to)}</TableCell>
                          <TableCell>{h.days}</TableCell>
                          <TableCell>
                            <HrStatusBadge label={t(`shifts.kind.${h.kind}`)} {...(h.kind === 'Ramadan' ? { color: '#0E7490', tint: '#CFFAFE' } : { color: hr.violet, tint: '#F5F3FF' })} />
                          </TableCell>
                          <TableCell align="right">
                            {canSet && (
                              <IconButton
                                size="small"
                                aria-label={t('shifts.delete')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void remove(() => attendanceApi.deleteHoliday(h.id), localRef(h, ar));
                                }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
            <Stack sx={{ gap: 1.75 }}>
              <SettingsCard data={data} canSet={canSet} onSaved={reload} />
              <Box sx={{ ...(hrCard as object), p: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5 }}>{t('shifts.rules')}</Typography>
                {(['absent', 'missing', 'late', 'early', 'device', 'holiday'] as const).map((k) => {
                  const [when, then] = t(`shifts.rule.${k}`, { returnObjects: true }) as string[];
                  return (
                    <Stack key={k} direction="row" sx={{ justifyContent: 'space-between', gap: 2, py: 0.9, borderBottom: `1px solid #EEF2F7` }}>
                      <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{when}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: 'end' }}>{then}</Typography>
                    </Stack>
                  );
                })}
                <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: 1 }}>{t('shifts.rulesNote')}</Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>
      )}
      {editing && (
        <ShiftDialog
          shift={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => (setEditing(null), reload())}
          onDelete={editing !== 'new' && !editing.isDefault ? () => void remove(() => attendanceApi.deleteShift(editing.id), localRef(editing, ar)).then(() => setEditing(null)) : undefined}
        />
      )}
      {assigning && <AssignDialog shift={assigning} departments={departments} onClose={() => setAssigning(null)} onSaved={() => (setAssigning(null), reload())} />}
      {holiday && <HolidayDialog holiday={holiday === 'new' ? null : holiday} year={year} onClose={() => setHoliday(null)} onSaved={() => (setHoliday(null), reload())} />}
    </HrScope>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: '#F8FAFC', borderRadius: '8px', px: 1.25, py: 0.75 }}>
      <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{label}</Typography>
      <Typography sx={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    </Box>
  );
}

function SettingsCard({ data, canSet, onSaved }: { data: AttendanceSetupData; canSet: boolean; onSaved: () => void }) {
  const { t } = useTranslation();
  const [matchBy, setMatchBy] = useState<MatchBy>(data.settings.matchBy);
  const [cycle, setCycle] = useState(String(data.settings.cycleStartDay));
  const [device, setDevice] = useState(data.settings.useDeviceMinutes);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = matchBy !== data.settings.matchBy || Number(cycle) !== data.settings.cycleStartDay || device !== data.settings.useDeviceMinutes;
  const save = async () => {
    setError(null);
    try {
      await attendanceApi.saveSettings({ matchBy, cycleStartDay: Number(cycle), useDeviceMinutes: device });
      setSaved(true);
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    }
  };
  return (
    <Box sx={{ ...(hrCard as object), p: 2, display: 'grid', gap: 1.25 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{t('shifts.settings')}</Typography>
      <TextField select size="small" label={t('shifts.matchBy')} value={matchBy} disabled={!canSet} onChange={(e) => (setMatchBy(e.target.value as MatchBy), setSaved(false))}>
        {matchBys.map((m) => (
          <MenuItem key={m} value={m}>
            {t(`shifts.matchByValue.${m}`)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        size="small"
        type="number"
        label={t('shifts.cycle')}
        value={cycle}
        disabled={!canSet}
        onChange={(e) => (setCycle(e.target.value), setSaved(false))}
        helperText={t('shifts.cycleHint')}
        slotProps={{ htmlInput: { min: 1, max: 28 } }}
      />
      <TextField select size="small" label={t('shifts.minutesFrom')} value={device ? 'device' : 'shift'} disabled={!canSet} onChange={(e) => (setDevice(e.target.value === 'device'), setSaved(false))}>
        <MenuItem value="device">{t('shifts.minutesFromValue.device')}</MenuItem>
        <MenuItem value="shift">{t('shifts.minutesFromValue.shift')}</MenuItem>
      </TextField>
      <ErrorMessage messageKey={error} />
      {saved && <Alert severity="success">{t('shifts.saved')}</Alert>}
      {canSet && (
        <Box>
          <Button variant="outlined" disabled={!dirty} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </Box>
      )}
    </Box>
  );
}

const blank: ShiftInput = { nameAr: '', nameEn: '', startsAt: '09:00', endsAt: '17:00', breakMinutes: 0, graceMinutes: 15, lateFrom: 'GraceEnd', restDays: [5, 6], ramadanStartsAt: null, ramadanEndsAt: null, isActive: true, isDefault: false };

function ShiftDialog({ shift, onClose, onSaved, onDelete }: { shift: Shift | null; onClose: () => void; onSaved: () => void; onDelete?: () => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState<ShiftInput>(() =>
    shift ? { ...shift, startsAt: hhmm(shift.startsAt)!, endsAt: hhmm(shift.endsAt)!, ramadanStartsAt: hhmm(shift.ramadanStartsAt), ramadanEndsAt: hhmm(shift.ramadanEndsAt) } : blank,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const weekdays = t('attendance.weekdays', { returnObjects: true }) as string[];
  const set = <K extends keyof ShiftInput>(k: K, value: ShiftInput[K]) => setV((s) => ({ ...s, [k]: value }));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await attendanceApi.saveShift(shift?.id ?? null, { ...v, ramadanStartsAt: v.ramadanStartsAt || null, ramadanEndsAt: v.ramadanEndsAt || null });
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{shift ? shift.nameAr : t('shifts.form.title')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr', pt: '8px !important' }}>
          <TextField size="small" required label={t('shifts.form.nameAr')} value={v.nameAr} onChange={(e) => set('nameAr', e.target.value)} />
          <TextField size="small" label={t('shifts.form.nameEn')} value={v.nameEn} onChange={(e) => set('nameEn', e.target.value)} slotProps={{ htmlInput: { dir: 'ltr' } }} />
          <TextField size="small" type="time" label={t('shifts.form.startsAt')} value={v.startsAt} onChange={(e) => set('startsAt', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField
            size="small"
            type="time"
            label={t('shifts.form.endsAt')}
            value={v.endsAt}
            onChange={(e) => set('endsAt', e.target.value)}
            helperText={v.endsAt <= v.startsAt ? t('shifts.form.overnight') : ' '}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField size="small" type="number" label={t('shifts.form.breakMinutes')} value={v.breakMinutes} onChange={(e) => set('breakMinutes', Number(e.target.value))} slotProps={{ htmlInput: { min: 0, max: 240 } }} />
          <TextField size="small" type="number" label={t('shifts.form.graceMinutes')} value={v.graceMinutes} onChange={(e) => set('graceMinutes', Number(e.target.value))} slotProps={{ htmlInput: { min: 0, max: 120 } }} />
          <TextField select size="small" label={t('shifts.form.lateFrom')} value={v.lateFrom} onChange={(e) => set('lateFrom', e.target.value as ShiftInput['lateFrom'])} sx={{ gridColumn: '1 / -1' }}>
            {(['GraceEnd', 'ShiftStart'] as const).map((k) => (
              <MenuItem key={k} value={k}>
                {t(`shifts.lateFrom.${k}`)}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography sx={{ fontSize: 12.5, color: hr.textMuted, mb: 0.5 }}>{t('shifts.form.restDays')}</Typography>
            <ToggleButtonGroup size="small" value={v.restDays} onChange={(_, days: number[]) => set('restDays', days)} sx={{ flexWrap: 'wrap' }}>
              {weekdays.map((w, i) => (
                <ToggleButton key={w} value={i} sx={{ px: 1.25 }}>
                  {w}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <TextField size="small" type="time" label={t('shifts.form.ramadanStartsAt')} value={v.ramadanStartsAt ?? ''} onChange={(e) => set('ramadanStartsAt', e.target.value || null)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="time" label={t('shifts.form.ramadanEndsAt')} value={v.ramadanEndsAt ?? ''} onChange={(e) => set('ramadanEndsAt', e.target.value || null)} slotProps={{ inputLabel: { shrink: true } }} />
          <Typography sx={{ gridColumn: '1 / -1', fontSize: 12, color: hr.textMuted, mt: -1 }}>{t('shifts.form.ramadanHint')}</Typography>
          <FormControlLabel sx={{ gridColumn: '1 / -1' }} control={<Checkbox checked={v.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />} label={t('shifts.form.isDefault')} />
          <FormControlLabel sx={{ gridColumn: '1 / -1', mt: -1.5 }} control={<Checkbox checked={v.isActive} onChange={(e) => set('isActive', e.target.checked)} />} label={t('shifts.form.isActive')} />
          <Box sx={{ gridColumn: '1 / -1' }}>
            <ErrorMessage messageKey={error} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !v.nameAr.trim()} onClick={() => void save()}>
            {t('common.save')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Box sx={{ flex: 1 }} />
          {onDelete && (
            <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={onDelete}>
              {t('shifts.delete')}
            </Button>
          )}
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

function AssignDialog({ shift, departments, onClose, onSaved }: { shift: Shift; departments: Department[]; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [to, setTo] = useState<'department' | 'employee'>('department');
  const [department, setDepartment] = useState('');
  const [employee, setEmployee] = useState<{ id: string; nameAr: string; nameEn: string } | null>(null);
  const [options, setOptions] = useState<{ id: string; nameAr: string; nameEn: string }[]>([]);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [until, setUntil] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (to !== 'employee') return;
    const timer = setTimeout(() => staffApi.pick(search).then(setOptions).catch(() => setOptions([])), 250);
    return () => clearTimeout(timer);
  }, [search, to]);
  const save = async () => {
    setError(null);
    try {
      await attendanceApi.assign({ shiftId: shift.id, departmentId: to === 'department' ? department || null : null, employeeId: to === 'employee' ? (employee?.id ?? null) : null, from, to: until || null });
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t('shifts.assignForm.title')} · {localRef(shift, ar)}
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <ToggleButtonGroup exclusive size="small" value={to} onChange={(_, v: 'department' | 'employee' | null) => v && setTo(v)}>
            <ToggleButton value="department">{t('shifts.assignForm.department')}</ToggleButton>
            <ToggleButton value="employee">{t('shifts.assignForm.employee')}</ToggleButton>
          </ToggleButtonGroup>
          {to === 'department' ? (
            <TextField select size="small" label={t('shifts.assignForm.pickDepartment')} value={department} onChange={(e) => setDepartment(e.target.value)}>
              {departments.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {ar ? d.nameAr : d.nameEn}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Autocomplete
              size="small"
              options={options}
              value={employee}
              onChange={(_, v) => setEmployee(v)}
              onInputChange={(_, v) => setSearch(v)}
              getOptionLabel={(o) => localRef(o, ar)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={(x) => x}
              renderInput={(params) => <TextField {...params} label={t('shifts.assignForm.pickEmployee')} />}
            />
          )}
          <TextField size="small" type="date" label={t('shifts.assignForm.from')} value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="date" label={t('shifts.assignForm.until')} value={until} onChange={(e) => setUntil(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={!from || (to === 'department' ? !department : !employee)} onClick={() => void save()}>
            {t('shifts.assign')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

function HolidayDialog({ holiday, year, onClose, onSaved }: { holiday: Holiday | null; year: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [nameAr, setNameAr] = useState(holiday?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(holiday?.nameEn ?? '');
  const [from, setFrom] = useState(holiday?.from ?? `${year}-01-01`);
  const [to, setTo] = useState(holiday?.to ?? `${year}-01-01`);
  const [kind, setKind] = useState<HolidayKind>(holiday?.kind ?? 'Official');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setError(null);
    try {
      await attendanceApi.saveHoliday(holiday?.id ?? null, { nameAr, nameEn: nameEn || null, from, to, kind });
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{holiday ? holiday.nameAr : t('shifts.holidayForm.title')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <TextField size="small" required label={t('shifts.holidayForm.nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          <TextField size="small" label={t('shifts.holidayForm.nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} slotProps={{ htmlInput: { dir: 'ltr' } }} />
          <TextField select size="small" label={t('shifts.holidayForm.kind')} value={kind} onChange={(e) => setKind(e.target.value as HolidayKind)}>
            {(['Official', 'Ramadan'] as const).map((k) => (
              <MenuItem key={k} value={k}>
                {t(`shifts.kind.${k}`)}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" sx={{ gap: 1 }}>
            <TextField size="small" fullWidth type="date" label={t('shifts.holidayForm.from')} value={from} onChange={(e) => (setFrom(e.target.value), to < e.target.value && setTo(e.target.value))} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" fullWidth type="date" label={t('shifts.holidayForm.to')} value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={!nameAr.trim() || !from || !to} onClick={() => void save()}>
            {t('common.save')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}
