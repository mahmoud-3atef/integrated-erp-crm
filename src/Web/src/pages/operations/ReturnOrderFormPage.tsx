import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import {
  Autocomplete,
  Alert,
  Box,
  Button,
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
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import type { RoomOption } from '../../api/housing';
import { returnReasons, returnsApi, type AvailableWorker, type ReturnInput } from '../../api/operations';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday } from './delivery';

const daysAgo = (iso: string) => Math.floor((Date.parse(isoToday()) - Date.parse(iso)) / 86400000);

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 2, color: tokens.navy800, '& svg': { color: tokens.navy700 } }}>
        {icon}
        <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{title}</Typography>
      </Stack>
      {children}
    </Box>
  );
}

/** New or returned return order: the worker on the job, then the arrival in housing, the reason and the salary option. */
export function ReturnOrderFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
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
    returnsApi.onJobWorkers(id).then(setWorkers).catch((failure: unknown) => setError(errorKey(failure)));
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
  const late = arrivedOn && daysAgo(arrivedOn) > 2;
  const valid = !!workerId && !!arrivedOn && !!reason && (reason !== 'Other' || reasonNotes.trim() !== '') && (!late || delayReason.trim() !== '');

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
      navigate(`/operations/return-orders/${saved.id}${saved.approvalError ? `?error=errors.${saved.approvalError.replace('.', '_')}` : ''}`);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 2, bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: '16px 20px', mb: `${tokens.gap}px` }}>
        <Box sx={{ display: 'grid', placeItems: 'center', width: 52, height: 52, borderRadius: '16px', bgcolor: tokens.navy700, color: '#fff' }}>
          <KeyboardReturnOutlinedIcon />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{orderNo ? t('operations.return.editOrder', { no: orderNo }) : t('operations.return.new')}</Typography>
          <Typography component="h1" dir={chosen ? 'ltr' : undefined} sx={{ fontSize: 20, fontWeight: 800, color: tokens.navy800, textAlign: 'start' }}>
            {chosen?.name ?? t('operations.return.title')}
          </Typography>
        </Box>
        <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate(-1)}>
          {t('common.back')}
        </Button>
      </Stack>
      <ErrorMessage messageKey={error} />

      <Section title={t('operations.return.sections.worker', { count: workers?.length ?? 0 })} icon={<EngineeringOutlinedIcon />}>
        <Typography sx={{ fontSize: 12.5, color: tokens.gray500, mb: 1.5 }}>{t('operations.return.workerHint')}</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, mb: 1.5 }}>
          <TextField
            size="small"
            sx={{ flex: 2 }}
            placeholder={t('operations.return.workerSearch')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          <TextField select size="small" sx={{ flex: 1, minWidth: 220 }} label={t('commercial.col.project')} value={project} onChange={(e) => setProject(e.target.value)}>
            <MenuItem value="">{t('operations.delivery.available.any')}</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        {!workers && !error && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer sx={{ maxHeight: 360, border: `1px solid ${tokens.navy50}`, borderRadius: `${tokens.radius}px` }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>{t('workforce.col.name')}</TableCell>
                <TableCell>{t('operations.delivery.col.iqama')}</TableCell>
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
                      <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                        {w.name}
                      </Typography>
                      <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                        {w.workerNo}
                      </Typography>
                    </TableCell>
                    <TableCell dir="ltr">{w.iqamaNo ?? '—'}</TableCell>
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
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: tokens.gray500 }}>
                    {t('operations.delivery.noWorkersFound')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Section>

      <Section title={t('operations.return.sections.details')} icon={<KeyboardReturnOutlinedIcon />}>
        {chosen && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('operations.return.chosen', { project: chosen.projectName ?? '—', since: date(chosen.projectJoinedOn) })}
          </Alert>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          <TextField
            type="date"
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
          {rooms && rooms.length > 0 ? (
            <Autocomplete
              options={rooms}
              value={rooms.find((r) => r.id === roomId) ?? null}
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
            <TextField label={t('operations.return.col.housing')} value={housingName} onChange={(e) => setHousingName(e.target.value)} helperText={t('operations.return.housingHint')} slotProps={{ htmlInput: { maxLength: 200 } }} />
          )}
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
          <Box sx={{ gridColumn: { md: '1 / -1' } }}>
            <FormControlLabel control={<Switch checked={stopSalary} onChange={(e) => setStopSalary(e.target.checked)} />} label={t('operations.return.stopSalary')} />
            <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('operations.return.stopSalaryHint')}</Typography>
          </Box>
          <TextField sx={{ gridColumn: { md: '1 / -1' } }} label={t('operations.delivery.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} slotProps={{ htmlInput: { maxLength: 2000 } }} />
        </Box>
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('operations.return.flowHint')}
        </Alert>
        <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1.5, mt: 2.5 }}>
          <Button onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
          <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy || !valid} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </Stack>
      </Section>
    </Box>
  );
}
