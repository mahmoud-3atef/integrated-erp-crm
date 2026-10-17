import AddIcon from '@mui/icons-material/Add';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { housingApi, type BuildingDetail, type Occupant, type RoomRow } from '../../api/housing';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday } from '../operations/delivery';
import { AssignDialog, BuildingDialog, Occupancy, RoomDialog } from './housing';

/** One building: its details and occupancy, and its rooms with who lives in each. */
export function BuildingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { can } = useSession();
  const { ar, date } = useCommercialFormat();
  const [data, setData] = useState<BuildingDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [room, setRoom] = useState<RoomRow | 'new' | null>(null);
  const [assignTo, setAssignTo] = useState<RoomRow | null>(null);
  const [moving, setMoving] = useState<Occupant | null>(null);
  const [leaving, setLeaving] = useState<Occupant | null>(null);
  const [leaveOn, setLeaveOn] = useState(isoToday());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = can('housing.manage', true);
  const canAssign = can('housing.assign', true);

  const reload = useCallback(async () => {
    try {
      setData(await housingApi.building(id!));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!data) {
    return <ErrorMessage messageKey={error} />;
  }

  const b = data.building;
  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 60, height: 60, borderRadius: '18px', bgcolor: tokens.navy700, color: '#fff' }}>
              <ApartmentOutlinedIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                <Typography component="h1" sx={{ fontSize: 21, fontWeight: 800, color: tokens.navy800 }}>
                  {b.name}
                </Typography>
                <Badge tone={b.isActive ? 'primary' : 'neutral'}>{b.isActive ? t(`housing.types.${b.type}`) : t('housing.inactive')}</Badge>
              </Stack>
              <Typography sx={{ fontSize: 13, color: tokens.gray600 }}>
                {[b.city, b.address, b.type === 'Project' ? b.projectName : null].filter(Boolean).join(' · ') || '—'}
              </Typography>
              {b.notes && <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{b.notes}</Typography>}
            </Box>
          </Stack>
          <Box sx={{ minWidth: 240 }}>
            <Typography sx={{ fontSize: 12, color: tokens.gray500, mb: 0.5 }}>{t('housing.cards.rooms', { count: b.rooms })}</Typography>
            <Occupancy occupied={b.occupied} capacity={b.capacity} />
          </Box>
          <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/housing')}>
            {t('common.back')}
          </Button>
        </Stack>
        {canManage && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.25, mt: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setRoom('new')}>
              {t('housing.newRoom')}
            </Button>
            <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(true)}>
              {t('common.edit')}
            </Button>
            <Button color={b.isActive ? 'error' : 'primary'} disabled={busy} onClick={() => void act(() => housingApi.setBuildingActive(b.id, !b.isActive))}>
              {b.isActive ? t('housing.deactivate') : t('housing.activate')}
            </Button>
          </Stack>
        )}
      </Box>
      <ErrorMessage messageKey={error} />

      {data.rooms.length === 0 ? (
        <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 5, textAlign: 'center', color: tokens.gray500 }}>{t('housing.noRooms')}</Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: `${tokens.gap}px` }}>
          {[...data.rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' })).map((r) => {
            const full = r.occupants.length >= r.capacity;
            return (
              <Box key={r.id} sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2, opacity: r.isActive ? 1 : 0.6 }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography dir="auto" sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800 }}>
                      {r.number}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>
                      {r.floor ? t('housing.floorN', { floor: r.floor }) : '—'}
                      {!r.isActive && ` · ${t('housing.inactive')}`}
                    </Typography>
                  </Box>
                  {canManage && (
                    <Tooltip title={t('common.edit')}>
                      <IconButton size="small" onClick={() => setRoom(r)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Occupancy occupied={r.occupants.length} capacity={r.capacity} />
                <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                  {r.occupants.map((o) => (
                    <Stack key={o.assignmentId} direction="row" sx={{ alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: '8px', bgcolor: '#fafbfd', '&:hover .actions': { opacity: 1 } }}>
                      <Box sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/workforce/workers/${o.workerId}`)}>
                        <Typography dir="ltr" noWrap sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                          {o.name}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>
                          <span dir="ltr">{o.workerNo}</span> · {t('housing.since', { date: date(o.since) })}
                          {o.sourceNo && ` · ${o.sourceNo}`}
                        </Typography>
                      </Box>
                      {canAssign && (
                        <Stack className="actions" direction="row" sx={{ opacity: { xs: 1, md: 0.35 }, transition: 'opacity .15s' }}>
                          <Tooltip title={t('housing.move')}>
                            <IconButton size="small" onClick={() => setMoving(o)}>
                              <SwapHorizIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('housing.leave')}>
                            <IconButton size="small" onClick={() => (setLeaveOn(isoToday()), setLeaving(o))}>
                              <LogoutOutlinedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )}
                    </Stack>
                  ))}
                </Stack>
                {canAssign && r.isActive && b.isActive && (
                  <Button size="small" startIcon={<PersonAddAlt1OutlinedIcon />} disabled={full} onClick={() => setAssignTo(r)} sx={{ mt: 1 }}>
                    {full ? t('housing.full') : t('housing.addOccupant')}
                  </Button>
                )}
                {canManage && r.occupants.length === 0 && (
                  <Button size="small" color={r.isActive ? 'error' : 'primary'} disabled={busy} onClick={() => void act(() => housingApi.setRoomActive(r.id, !r.isActive))} sx={{ mt: 1, marginInlineStart: 1 }}>
                    {r.isActive ? t('housing.deactivate') : t('housing.activate')}
                  </Button>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {editing && (
        <BuildingDialog
          building={b}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void reload();
          }}
        />
      )}
      {room && (
        <RoomDialog
          buildingId={b.id}
          room={room === 'new' ? null : room}
          onClose={() => setRoom(null)}
          onSaved={() => {
            setRoom(null);
            void reload();
          }}
        />
      )}
      {assignTo && (
        <AssignDialog
          room={{ id: assignTo.id, buildingId: b.id, buildingName: b.name, roomNo: assignTo.number, capacity: assignTo.capacity, occupied: assignTo.occupants.length, isActive: true, free: assignTo.capacity - assignTo.occupants.length, label: `${b.name} — ${assignTo.number}` }}
          onClose={() => setAssignTo(null)}
          onSaved={() => {
            setAssignTo(null);
            void reload();
          }}
        />
      )}
      {moving && (
        <AssignDialog
          worker={{ id: moving.workerId, workerNo: moving.workerNo, name: moving.name }}
          onClose={() => setMoving(null)}
          onSaved={() => {
            setMoving(null);
            void reload();
          }}
        />
      )}
      {leaving && (
        <Dialog open onClose={() => setLeaving(null)} fullWidth maxWidth="xs">
          <DialogTitle>{t('housing.leaveTitle', { name: leaving.name })}</DialogTitle>
          <DialogContent dividers>
            <Typography sx={{ fontSize: 13, color: tokens.gray600, mb: 2 }}>{t('housing.leaveHint')}</Typography>
            <TextField type="date" fullWidth label={t('housing.leaveOn')} value={leaveOn} onChange={(e) => setLeaveOn(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLeaving(null)}>{t('common.cancel')}</Button>
            <Button
              variant="contained"
              color="error"
              disabled={busy || !leaveOn}
              onClick={() =>
                void act(async () => {
                  await housingApi.leave(leaving.workerId, leaveOn);
                  setLeaving(null);
                })
              }
            >
              {t('housing.leave')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
