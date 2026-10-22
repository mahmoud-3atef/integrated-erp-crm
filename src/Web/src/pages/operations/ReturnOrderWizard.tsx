import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Autocomplete,
  Box,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Radio,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import type { RoomOption } from '../../api/housing';
import { returnReasons, returnsApi, type AvailableWorker, type ReturnInput } from '../../api/operations';
import { tokens } from '../../app/theme';
import { Badge } from '../../components/ui';
import { WizardAside, WizardCard, WizardDialog, WizardFact } from '../../components/WizardDialog';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday } from './delivery';
import { useStateName } from './movements/movementMeta';
import { daysBetween, Journey, JourneyLine } from './recordParts';
import { DateField } from '../../components/DateField';

const daysAgo = (iso: string) => Math.floor((Date.parse(isoToday()) - Date.parse(iso)) / 86400000);

/**
 * A new or returned return order, in three steps: the worker on the job, the return (arrival in housing, reason,
 * room, salary), then a review drawing the way back before it goes for approval.
 */
export function ReturnOrderWizard({ id, initialWorkerId, onClose, onSaved }: { id?: string; initialWorkerId?: string; onClose: () => void; onSaved: (id: string, approvalError: string | null) => void }) {
  const { t } = useTranslation();
  const { ar, date } = useCommercialFormat();
  const stateName = useStateName();
  const [step, setStep] = useState(0);
  const [workers, setWorkers] = useState<AvailableWorker[] | null>(null);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [project, setProject] = useState('');
  const [arrivedOn, setArrivedOn] = useState(isoToday());
  const [reason, setReason] = useState('');
  const [reasonNotes, setReasonNotes] = useState('');
  const [stopSalary, setStopSalary] = useState(true);
  const [housingName, setHousingName] = useState('');
  const [rooms, setRooms] = useState<RoomOption[] | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [delayReason, setDelayReason] = useState('');
  const [notes, setNotes] = useState('');
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    returnsApi
      .onJobWorkers(id)
      .then((list) => {
        setWorkers(list);
        // From a worker's page («إجراء جديد»): that worker is chosen.
        if (!id && initialWorkerId && list.some((w) => w.worker.id === initialWorkerId && !w.busyOrderNo)) {
          setWorkerId(initialWorkerId);
          setStep(1);
        }
      })
      .catch((failure: unknown) => setError(errorKey(failure)));
    returnsApi.rooms().then(setRooms).catch(() => setRooms([]));
    if (id) {
      returnsApi
        .get(id)
        .then((o) => {
          setOrderNo(o.summary.orderNo);
          setWorkerId(o.summary.workerId);
          setArrivedOn(o.summary.arrivedOn ?? isoToday());
          setReason(o.summary.reason);
          setReasonNotes(o.reasonNotes ?? '');
          setStopSalary(o.summary.stopSalary);
          setHousingName(o.summary.housingName ?? '');
          setRoomId(o.roomId);
          setDelayReason(o.delayReason ?? '');
          setNotes(o.notes ?? '');
        })
        .catch((failure: unknown) => setError(errorKey(failure)));
    }
  }, [id]);

  const projects = useMemo(() => [...new Set((workers ?? []).map((w) => w.worker.projectName ?? '—'))].sort(), [workers]);
  const shown = useMemo(() => {
    const q = filter.trim().toUpperCase();
    return (workers ?? []).filter(({ worker: w }) => {
      if (project && (w.projectName ?? '—') !== project) return false;
      return !q || [w.workerNo, w.name, w.iqamaNo, w.projectName].some((v) => v?.toUpperCase().includes(q));
    });
  }, [workers, filter, project]);
  const chosen = workers?.find((w) => w.worker.id === workerId)?.worker ?? null;
  const room = rooms?.find((r) => r.id === roomId) ?? null;
  const housing = room ? room.label : housingName.trim();
  const late = !!arrivedOn && daysAgo(arrivedOn) > 2;
  const detailsReady = !!arrivedOn && !!reason && (reason !== 'Other' || reasonNotes.trim() !== '') && (!late || delayReason.trim() !== '');
  const ready = [!!workerId, detailsReady, !!workerId && detailsReady];

  const save = async () => {
    setBusy(true);
    setError(null);
    const input: ReturnInput = {
      workerId: workerId!,
      arrivedOn,
      reason,
      reasonNotes: reasonNotes.trim() || null,
      stopSalary,
      housingName: roomId ? null : housingName.trim() || null,
      roomId,
      delayReason: late ? delayReason.trim() || null : null,
      notes: notes.trim() || null,
    };
    try {
      const saved = id ? await returnsApi.update(id, input) : await returnsApi.create(input);
      onSaved(saved.id, saved.approvalError);
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  };

  const steps = [
    { key: 'worker', label: t('operations.return.wizard.worker') },
    { key: 'details', label: t('operations.return.wizard.details') },
    { key: 'review', label: t('operations.return.wizard.review') },
  ];
  const worked = daysBetween(chosen?.projectJoinedOn, arrivedOn);

  return (
    <WizardDialog
      tone="return"
      icon={<KeyboardReturnOutlinedIcon />}
      title={orderNo ? t('operations.return.editOrder', { no: orderNo }) : t('operations.return.new')}
      subtitle={chosen ? `${chosen.name} · ${chosen.workerNo}` : t('operations.return.wizard.hint')}
      steps={steps}
      step={step}
      onStep={setStep}
      canNext={ready[step] ?? false}
      onClose={onClose}
      onFinish={() => void save()}
      finishLabel={t('operations.delivery.submit')}
      busy={busy}
      error={error}
      aside={
        <WizardAside tone="return" title={t('operations.return.wizard.summary')}>
          <WizardFact icon={<EngineeringOutlinedIcon />} label={t('operations.return.col.worker')} value={chosen?.name} sub={chosen?.workerNo} />
          <WizardFact icon={<ApartmentOutlinedIcon />} label={t('operations.return.col.project')} value={chosen?.projectName} sub={chosen ? `${t('operations.return.workStarted')}: ${date(chosen.projectJoinedOn)}` : null} />
          <WizardFact icon={<EventOutlinedIcon />} label={t('operations.return.col.arrivedOn')} value={arrivedOn ? date(arrivedOn) : null} />
          <WizardFact icon={<ReportProblemOutlinedIcon />} label={t('operations.return.col.reason')} value={reason ? t(`operations.return.reasons.${reason}`) : null} />
          <WizardFact icon={<HotelOutlinedIcon />} label={t('operations.return.col.housing')} value={housing} />
          <WizardFact icon={<PaymentsOutlinedIcon />} label={t('operations.return.salaryInHousing')} value={stopSalary ? t('operations.return.salaryStops') : t('operations.return.salaryPaid')} />
        </WizardAside>
      }
    >
      {step === 0 && (
        <WizardCard title={t('operations.return.sections.worker', { count: workers?.length ?? 0 })} icon={<EngineeringOutlinedIcon />}>
          <Typography sx={{ fontSize: 12.5, color: tokens.gray500, mb: 1.5 }}>{t('operations.return.workerHint')}</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, mb: 1.5 }}>
            <TextField
              size="small"
              sx={{ flex: 2 }}
              placeholder={t('operations.return.workerSearch')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <TextField select size="small" sx={{ flex: 1, minWidth: 200 }} label={t('commercial.col.project')} value={project} onChange={(e) => setProject(e.target.value)}>
              <MenuItem value="">{t('operations.delivery.available.any')}</MenuItem>
              {projects.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {!workers && !error && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
          <TableContainer sx={{ maxHeight: 380, border: `1px solid ${tokens.gray100}`, borderRadius: `${tokens.radius}px` }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>{t('workforce.col.name')}</TableCell>
                  <TableCell>{t('commercial.prices.col.who')}</TableCell>
                  <TableCell>{t('commercial.col.project')}</TableCell>
                  <TableCell>{t('workforce.col.joined')}</TableCell>
                  <TableCell>{t('workforce.col.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.map(({ worker: w, busyOrderNo }) => {
                  const disabled = !!busyOrderNo;
                  return (
                    <TableRow
                      key={w.id}
                      hover={!disabled}
                      selected={workerId === w.id}
                      sx={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }}
                      onClick={() => !disabled && setWorkerId(w.id)}
                    >
                      <TableCell padding="checkbox">
                        <Radio checked={workerId === w.id} disabled={disabled} size="small" />
                      </TableCell>
                      <TableCell sx={{ minWidth: 190 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{w.name}</Typography>
                        <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                          <span dir="ltr">{w.workerNo}</span>
                          {w.iqamaNo && (
                            <>
                              {' · '}
                              <span dir="ltr">{w.iqamaNo}</span>
                            </>
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {(ar ? w.professionAr : w.professionEn) ?? '—'}
                        <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{(ar ? w.nationalityAr : w.nationalityEn) ?? '—'}</Typography>
                      </TableCell>
                      <TableCell>{w.projectName ?? '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(w.projectJoinedOn)}</TableCell>
                      <TableCell>
                        {busyOrderNo ? <Badge tone="warning">{t('operations.delivery.busy', { no: busyOrderNo })}</Badge> : <Badge tone="success">{(ar ? w.statusAr : w.statusEn) ?? '—'}</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {workers && shown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: tokens.gray500 }}>
                      {t('operations.delivery.noWorkersFound')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </WizardCard>
      )}

      {step === 1 && (
        <WizardCard title={t('operations.return.sections.details')} icon={<KeyboardReturnOutlinedIcon />}>
          {chosen && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('operations.return.chosen', { project: chosen.projectName ?? '—', since: date(chosen.projectJoinedOn) })}
            </Alert>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <DateField
              label={t('operations.return.col.arrivedOn')}
              value={arrivedOn}
              onChange={(e) => setArrivedOn(e.target.value)}
              required
              helperText={t('operations.return.arrivedHint')}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: isoToday() } }}
            />
            <TextField select label={t('operations.return.col.reason')} value={reason} onChange={(e) => setReason(e.target.value)} required>
              {returnReasons.map((r) => (
                <MenuItem key={r} value={r}>
                  {t(`operations.return.reasons.${r}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              sx={{ gridColumn: { md: '1 / -1' } }}
              label={t('operations.return.reasonNotes')}
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              required={reason === 'Other'}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
            {rooms && rooms.length > 0 ? (
              <Autocomplete
                sx={{ gridColumn: { md: '1 / -1' } }}
                options={rooms}
                value={room}
                onChange={(_, v) => setRoomId(v?.id ?? null)}
                getOptionLabel={(r) => r.label}
                getOptionDisabled={(r) => r.free === 0 && r.id !== roomId}
                groupBy={(r) => r.buildingName}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderOption={(props, r) => (
                  <li {...props} key={r.id}>
                    <Stack direction="row" sx={{ width: '100%', justifyContent: 'space-between', gap: 2 }}>
                      <span>{r.roomNo}</span>
                      <Typography component="span" sx={{ fontSize: 12.5, color: r.free === 0 ? tokens.danger : tokens.gray500 }}>
                        {r.free === 0 ? t('housing.full') : t('housing.freeCount', { count: r.free })}
                      </Typography>
                    </Stack>
                  </li>
                )}
                renderInput={(params) => <TextField {...params} label={t('operations.return.room')} helperText={t('operations.return.roomHint')} />}
              />
            ) : (
              <TextField
                sx={{ gridColumn: { md: '1 / -1' } }}
                label={t('operations.return.col.housing')}
                value={housingName}
                onChange={(e) => setHousingName(e.target.value)}
                helperText={t('operations.return.housingHint')}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
            )}
            {late && (
              <TextField
                sx={{ gridColumn: { md: '1 / -1' } }}
                label={t('operations.delivery.delayReason')}
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                required
                helperText={t('operations.return.delayHint')}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
            )}
            <Box sx={{ gridColumn: { md: '1 / -1' }, p: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px solid ${tokens.gray100}` }}>
              <FormControlLabel control={<Switch checked={stopSalary} onChange={(e) => setStopSalary(e.target.checked)} />} label={t('operations.return.stopSalary')} />
              <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('operations.return.stopSalaryHint')}</Typography>
            </Box>
            <TextField sx={{ gridColumn: { md: '1 / -1' } }} label={t('operations.delivery.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} slotProps={{ htmlInput: { maxLength: 2000 } }} />
          </Box>
        </WizardCard>
      )}

      {step === 2 && (
        <>
          <WizardCard title={t('operations.return.journey')} icon={<FactCheckOutlinedIcon />}>
            <Journey
              from={{ state: 'Work', label: stateName('Work'), sub: chosen?.projectName, lines: <JourneyLine label={t('operations.return.workStarted')}>{date(chosen?.projectJoinedOn ?? null)}</JourneyLine> }}
              to={{ state: 'Housing', label: stateName('Housing'), sub: housing || null, lines: <JourneyLine label={t('operations.return.col.arrivedOn')}>{date(arrivedOn)}</JourneyLine> }}
              pill={worked !== null ? t('operations.return.workedDays', { count: worked }) : undefined}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mt: 2.5 }}>
              {[
                [t('operations.return.col.reason'), reason ? t(`operations.return.reasons.${reason}`) : '—'],
                [t('operations.return.salaryInHousing'), stopSalary ? t('operations.return.salaryStops') : t('operations.return.salaryPaid')],
                [t('operations.return.reasonNotes'), reasonNotes.trim() || '—'],
              ].map(([label, value]) => (
                <Box key={label} sx={{ p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px solid ${tokens.gray100}` }}>
                  <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{label}</Typography>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }}>{value}</Typography>
                </Box>
              ))}
            </Box>
          </WizardCard>
          <Alert severity="info">{t('operations.return.flowHint')}</Alert>
        </>
      )}
    </WizardDialog>
  );
}
