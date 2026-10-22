import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { buildingTypes, housingApi, type BuildingInput, type BuildingRow, type RoomInput, type RoomOption, type RoomRow } from '../../api/housing';
import type { ProjectOption, WorkerCard } from '../../api/operations';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { isoToday } from '../operations/delivery';
import { DateField } from '../../components/DateField';

/** How full a room or building is: a bar and "occupied / capacity". */
export function Occupancy({ occupied, capacity }: { occupied: number; capacity: number }) {
  const { t } = useTranslation();
  const ratio = capacity > 0 ? Math.min(100, (occupied / capacity) * 100) : 0;
  const color = occupied >= capacity && capacity > 0 ? tokens.danger : ratio >= 80 ? tokens.warning : tokens.success;
  return (
    <Box sx={{ minWidth: 120 }}>
      <LinearProgress variant="determinate" value={ratio} sx={{ height: 8, borderRadius: 4, bgcolor: tokens.navy50, '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 } }} />
      <Typography sx={{ fontSize: 12, color: tokens.gray600, mt: 0.5 }}>{t('housing.occupancy', { occupied, capacity, free: Math.max(0, capacity - occupied) })}</Typography>
    </Box>
  );
}

/** Add or change a building. */
export function BuildingDialog({ building, onClose, onSaved }: { building: BuildingRow | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { t } = useTranslation();
  const [input, setInput] = useState<BuildingInput>({
    name: building?.name ?? '',
    type: building?.type ?? 'Company',
    city: building?.city ?? '',
    address: building?.address ?? '',
    projectId: building?.projectId ?? null,
    notes: building?.notes ?? '',
  });
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (input.type === 'Project' && projects.length === 0) {
      housingApi.projects().then(setProjects).catch((failure: unknown) => setError(errorKey(failure)));
    }
  }, [input.type, projects.length]);

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = { ...input, city: input.city?.trim() || null, address: input.address?.trim() || null, notes: input.notes?.trim() || null, projectId: input.type === 'Project' ? input.projectId : null };
    try {
      if (building) {
        await housingApi.updateBuilding(building.id, body);
        onSaved(building.id);
      } else {
        onSaved((await housingApi.createBuilding(body)).id);
      }
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{building ? t('housing.editBuilding') : t('housing.newBuilding')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Stack spacing={2}>
          <TextField label={t('housing.buildingName')} value={input.name} onChange={(e) => setInput({ ...input, name: e.target.value })} required autoFocus slotProps={{ htmlInput: { maxLength: 200 } }} />
          <TextField select label={t('housing.type')} value={input.type} onChange={(e) => setInput({ ...input, type: e.target.value as BuildingInput['type'] })}>
            {buildingTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {t(`housing.types.${type}`)}
              </MenuItem>
            ))}
          </TextField>
          {input.type === 'Project' && (
            <Autocomplete
              options={projects}
              value={projects.find((p) => p.id === input.projectId) ?? null}
              onChange={(_, v) => setInput({ ...input, projectId: v?.id ?? null })}
              getOptionLabel={(p) => `${p.name} (${p.code})`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} label={t('commercial.col.project')} required />}
            />
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField sx={{ flex: 1 }} label={t('housing.city')} value={input.city ?? ''} onChange={(e) => setInput({ ...input, city: e.target.value })} slotProps={{ htmlInput: { maxLength: 100 } }} />
            <TextField sx={{ flex: 2 }} label={t('housing.address')} value={input.address ?? ''} onChange={(e) => setInput({ ...input, address: e.target.value })} slotProps={{ htmlInput: { maxLength: 500 } }} />
          </Stack>
          <TextField label={t('operations.delivery.notes')} value={input.notes ?? ''} onChange={(e) => setInput({ ...input, notes: e.target.value })} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={busy || !input.name.trim() || (input.type === 'Project' && !input.projectId)} onClick={() => void save()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Add or change a room of a building. */
export function RoomDialog({ buildingId, room, onClose, onSaved }: { buildingId: string; room: RoomRow | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [input, setInput] = useState<RoomInput>({ number: room?.number ?? '', floor: room?.floor ?? '', capacity: room?.capacity ?? 4, notes: room?.notes ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = { ...input, floor: input.floor?.trim() || null, notes: input.notes?.trim() || null };
    try {
      await (room ? housingApi.updateRoom(room.id, body) : housingApi.createRoom(buildingId, body));
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{room ? t('housing.editRoom', { no: room.number }) : t('housing.newRoom')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Stack spacing={2}>
          <TextField label={t('housing.roomNo')} value={input.number} onChange={(e) => setInput({ ...input, number: e.target.value })} required autoFocus helperText={t('housing.roomNoHint')} slotProps={{ htmlInput: { maxLength: 100 } }} />
          <Stack direction="row" spacing={2}>
            <TextField sx={{ flex: 1 }} label={t('housing.floor')} value={input.floor ?? ''} onChange={(e) => setInput({ ...input, floor: e.target.value })} slotProps={{ htmlInput: { maxLength: 50 } }} />
            <TextField
              sx={{ flex: 1 }}
              type="number"
              label={t('housing.capacity')}
              value={input.capacity}
              onChange={(e) => setInput({ ...input, capacity: Number(e.target.value) })}
              required
              helperText={room && room.occupants.length > 0 ? t('housing.capacityHint', { count: room.occupants.length }) : undefined}
              slotProps={{ htmlInput: { min: Math.max(1, room?.occupants.length ?? 1), max: 500 } }}
            />
          </Stack>
          <TextField label={t('operations.delivery.notes')} value={input.notes ?? ''} onChange={(e) => setInput({ ...input, notes: e.target.value })} slotProps={{ htmlInput: { maxLength: 1000 } }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={busy || !input.number.trim() || !(input.capacity >= 1)} onClick={() => void save()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * House a worker in a room. Given a worker (from the "without a room" list or an occupant to move), choose the room;
 * given a room, choose the worker among those in housing without a room.
 */
export function AssignDialog({ worker, room, onClose, onSaved }: { worker?: { id: string; workerNo: string; name: string }; room?: RoomOption; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [workers, setWorkers] = useState<WorkerCard[]>([]);
  const [roomId, setRoomId] = useState<string | null>(room?.id ?? null);
  const [workerId, setWorkerId] = useState<string | null>(worker?.id ?? null);
  const [from, setFrom] = useState(isoToday());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!room) housingApi.rooms().then(setRooms).catch((failure: unknown) => setError(errorKey(failure)));
    if (!worker) housingApi.withoutRoom().then(setWorkers).catch((failure: unknown) => setError(errorKey(failure)));
  }, [room, worker]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await housingApi.assign(workerId!, roomId!, from || null);
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{worker ? t('housing.assignWorker', { name: worker.name }) : t('housing.assignRoom', { room: room?.label })}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Stack spacing={2}>
          {worker ? (
            <Autocomplete
              options={rooms}
              value={rooms.find((r) => r.id === roomId) ?? null}
              onChange={(_, v) => setRoomId(v?.id ?? null)}
              getOptionLabel={(r) => r.label}
              getOptionDisabled={(r) => r.free === 0}
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
              renderInput={(params) => <TextField {...params} label={t('housing.room')} required autoFocus />}
            />
          ) : (
            <Autocomplete
              options={workers}
              value={workers.find((w) => w.id === workerId) ?? null}
              onChange={(_, v) => setWorkerId(v?.id ?? null)}
              getOptionLabel={(w) => `${w.workerNo} — ${w.name}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} label={t('housing.workerWithoutRoom')} required autoFocus helperText={t('housing.workerWithoutRoomHint', { count: workers.length })} />}
            />
          )}
          <DateField label={t('housing.from')} value={from} onChange={(e) => setFrom(e.target.value)} required slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={busy || !roomId || !workerId || !from} onClick={() => void save()}>
          {t('housing.assign')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
