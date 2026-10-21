import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Switch, TextField } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import type { RoomOption } from '../../api/housing';
import { returnsApi, type ReturnDetail } from '../../api/operations';
import { useCrumb } from '../../app/breadcrumbs';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { RecordHero, SectionTitle, SummaryBand, SummaryCard, SummaryFact, SummaryGroup, SummaryNote } from '../../components/RecordLayout';
import { Badge } from '../../components/ui';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { useStateName } from './movements/movementMeta';
import { daysBetween, Journey, JourneyLine, WorkerFact, WorkerHead } from './recordParts';
import { ReturnStatusBadge } from './returns';
import { ReturnOrderWizard } from './ReturnOrderWizard';

const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };

// Where the worker comes back from, by how they entered the housing.
const origin = { ReturnedWorker: 'Work', NewArrival: 'New', BackFromVacation: 'Vacation' } as const;

/**
 * One return order — a single worker, so the page centres on them: the band with the number and actions, the approval
 * bar, the worker's card with the way back (from the project to the housing, with the days worked), the approval's
 * history, and beside them the reason, the customer's wish and the salary.
 */
export function ReturnOrderDetailPage({ editing = false }: { editing?: boolean } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { ar, date } = useCommercialFormat();
  const stateName = useStateName();
  const [order, setOrder] = useState<ReturnDetail | null>(null);
  useCrumb(order?.summary.orderNo, `/operations/return-orders/${id}`);
  const [wizard, setWizard] = useState(editing);
  const [error, setError] = useState<string | null>(params.get('error'));
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [amending, setAmending] = useState(false);
  const [cancelingApproved, setCancelingApproved] = useState<string | null>(null);
  const approval = useRecordApproval(order?.approval?.instanceId);

  const reload = useCallback(async () => {
    try {
      setOrder(await returnsApi.get(id!));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!order) {
    return <ErrorMessage messageKey={error} />;
  }

  const o = order.summary;
  const canRun = o.source === 'System' && ((!order.awaitingApproval && order.canEdit) || approval.detail?.summary.status === 'Failed');
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      await approval.reload();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const from = origin[o.entry];
  const worked = daysBetween(order.workStartedOn, o.arrivedOn);
  return (
    <Box>
      <RecordHero
        tone="return"
        icon={<KeyboardReturnOutlinedIcon />}
        kind={t('operations.return.kind')}
        number={o.orderNo}
        status={
          <>
            <ReturnStatusBadge row={o} />
            {o.source === 'Crm' && <Badge tone="neutral">{t('operations.delivery.fromCrm')}</Badge>}
          </>
        }
        actions={
          <>
            {order.canEdit && (
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setWizard(true)}>
                {t('common.edit')}
              </Button>
            )}
            {order.canSubmit && (
              <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy} onClick={() => void run(() => returnsApi.submit(o.id))}>
                {t('operations.delivery.submit')}
              </Button>
            )}
            {canRun && (
              <RunProcessButton screen="operations.return_order" recordId={o.id} title={`${o.orderNo} — ${o.name}`} onStarted={() => void reload().then(() => approval.reload())} />
            )}
            {order.canCancel && (
              <Button variant="outlined" startIcon={<CancelOutlinedIcon />} onClick={() => setCanceling('')}>
                {t('operations.delivery.cancel')}
              </Button>
            )}
            {order.canAmend && (
              <Button variant="outlined" startIcon={<EditNoteOutlinedIcon />} onClick={() => setAmending(true)}>
                {t('operations.return.amend.action')}
              </Button>
            )}
            {order.canCancelApproved && (
              <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => setCancelingApproved('')}>
                {t('operations.return.amend.cancelAction')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/operations/return-orders')}>
              {t('common.back')}
            </Button>
          </>
        }
      />

      <ErrorMessage messageKey={error} />
      {order.amendedAt && o.status === 'Completed' && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {t('operations.return.amend.amendedBy', { by: order.amendedByName, date: date(order.amendedAt) })} — {order.amendNote}
        </Alert>
      )}
      {o.status === 'CanceledAfterApproval' && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t('operations.return.amend.canceledBy', { by: order.canceledByName, date: date(order.canceledAt) })} — {order.lastComment}
        </Alert>
      )}
      {o.source === 'System' && o.status === 'UnderPreparation' && order.awaitingApproval && (
        <Alert severity="info" sx={{ mb: `${tokens.gap}px` }}>
          {t('operations.return.creatorHint')}
        </Alert>
      )}
      {o.source === 'System' && o.status === 'Completed' && (
        <Alert severity="success" sx={{ mb: `${tokens.gap}px` }}>
          {t('operations.return.completedHint')}
        </Alert>
      )}

      {order.approval && (
        <ApprovalBar
          status={order.approval}
          detail={approval.detail}
          loading={approval.loading}
          onChanged={() => {
            void approval.reload();
            void reload();
          }}
        />
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }}>
        {/* Why the worker is back, read top to bottom. */}
        <SummaryCard>
          <SummaryBand
            tone="return"
            label={t('operations.return.col.reason')}
            value={t(`operations.return.reasons.${o.reason}`)}
            size={21}
            chips={[{ label: t(`operations.return.entry.${o.entry}`) }]}
          />
          {order.reasonNotes && <SummaryNote title={t('operations.return.reasonNotes')}>{order.reasonNotes}</SummaryNote>}
          <SummaryGroup title={t('operations.return.customerWish')} color={tokens.info}>
            <SummaryFact
              icon={<QuestionAnswerOutlinedIcon />}
              color={tokens.info}
              label={t('operations.return.customerWish')}
              value={o.customerWish ? t(`operations.return.wishes.${o.customerWish}`) : t('operations.return.wishPending')}
            />
          </SummaryGroup>
          <SummaryGroup title={t('operations.return.salaryInHousing')} color={o.stopSalary ? tokens.danger : tokens.success}>
            <SummaryFact
              icon={<PaymentsOutlinedIcon />}
              color={o.stopSalary ? tokens.danger : tokens.success}
              label={t('operations.return.salaryInHousing')}
              value={o.stopSalary ? t('operations.return.salaryStops') : t('operations.return.salaryPaid')}
            />
          </SummaryGroup>
          {order.delayReason && <SummaryNote title={t('operations.delivery.delayReason')}>{order.delayReason}</SummaryNote>}
          {order.notes && <SummaryNote title={t('operations.delivery.notes')}>{order.notes}</SummaryNote>}
          {order.lastComment && <SummaryNote title={t('operations.delivery.lastComment')}>{order.lastComment}</SummaryNote>}
        </SummaryCard>

        <Stack spacing={`${tokens.gap}px`} sx={{ minWidth: 0 }}>
          {/* The worker, and the way back. */}
          <Box sx={{ ...card, overflow: 'hidden' }}>
            <WorkerHead
              tone="return"
              label={t('operations.return.col.worker')}
              name={o.name}
              workerId={o.workerId}
              workerNo={o.workerNo}
              badge={<Badge tone="info">{t(`operations.return.entry.${o.entry}`)}</Badge>}
              facts={
                <>
                  <WorkerFact icon={<BadgeOutlinedIcon />} label={t('operations.delivery.col.iqama')} value={order.iqamaNo ?? '—'} ltr />
                  <WorkerFact icon={<EngineeringOutlinedIcon />} label={t('operations.return.profession')} value={(ar ? order.professionAr : order.professionEn) ?? '—'} />
                  <WorkerFact icon={<PublicOutlinedIcon />} label={t('operations.return.nationality')} value={(ar ? order.nationalityAr : order.nationalityEn) ?? '—'} />
                </>
              }
            />
            <Box sx={{ px: 2.5, pt: 2, pb: 2.5, borderTop: `1px solid ${tokens.gray100}` }}>
              <SectionTitle icon={<RouteOutlinedIcon />} title={t('operations.return.journey')} />
              <Journey
                from={{ state: from, label: stateName(from), sub: o.projectName, lines: <JourneyLine label={t('operations.return.workStarted')}>{date(order.workStartedOn)}</JourneyLine> }}
                to={{ state: 'Housing', label: stateName('Housing'), sub: o.housingName, lines: <JourneyLine label={t('operations.return.col.arrivedOn')}>{date(o.arrivedOn)}</JourneyLine> }}
                pill={worked !== null ? t('operations.return.workedDays', { count: worked }) : undefined}
              />
            </Box>
          </Box>

        </Stack>
      </Box>

      {canceling !== null && (
        <Dialog open onClose={() => setCanceling(null)} fullWidth maxWidth="sm">
          <DialogTitle>{t('operations.delivery.cancelTitle', { no: o.orderNo })}</DialogTitle>
          <DialogContent dividers>
            <TextField label={t('operations.delivery.cancelReason')} value={canceling} onChange={(e) => setCanceling(e.target.value)} fullWidth multiline minRows={2} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCanceling(null)}>{t('common.close')}</Button>
            <Button
              variant="contained"
              color="error"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await returnsApi.cancel(o.id, canceling.trim() || null);
                  setCanceling(null);
                })
              }
            >
              {t('operations.delivery.cancel')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {amending && <AmendDialog order={order} onClose={() => setAmending(false)} onSaved={() => void run(async () => setAmending(false))} />}
      {cancelingApproved !== null && (
        <Dialog open onClose={() => setCancelingApproved(null)} fullWidth maxWidth="sm">
          <DialogTitle>{t('operations.return.amend.cancelTitle', { no: o.orderNo })}</DialogTitle>
          <DialogContent dividers>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('operations.return.amend.cancelHint')}
            </Alert>
            <TextField required label={t('operations.return.amend.reason')} value={cancelingApproved} onChange={(e) => setCancelingApproved(e.target.value)} fullWidth multiline minRows={2} slotProps={{ htmlInput: { maxLength: 500 } }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelingApproved(null)}>{t('common.close')}</Button>
            <Button
              variant="contained"
              color="error"
              disabled={busy || !cancelingApproved.trim()}
              onClick={() =>
                void run(async () => {
                  await returnsApi.cancelApproved(o.id, cancelingApproved.trim());
                  setCancelingApproved(null);
                })
              }
            >
              {t('operations.return.amend.cancelAction')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {wizard && (
        <ReturnOrderWizard
          id={o.id}
          onClose={() => (editing ? navigate(`/operations/return-orders/${o.id}`) : setWizard(false))}
          onSaved={(_, failed) => {
            if (editing) {
              navigate(`/operations/return-orders/${o.id}${failed ? `?error=errors.${failed.replace('.', '_')}` : ''}`);
              return;
            }
            setWizard(false);
            setError(failed ? `errors.${failed.replace('.', '_')}` : null);
            void reload().then(() => approval.reload());
          }}
        />
      )}
    </Box>
  );
}

/**
 * Changing an approved order (its own permission): the arrival day, the reason, the salary in housing, the room and the
 * notes, with the reason for the change. The housing period and the room move with it on the server.
 */
function AmendDialog({ order, onClose, onSaved }: { order: ReturnDetail; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const o = order.summary;
  const [arrivedOn, setArrivedOn] = useState(o.arrivedOn ?? '');
  const [reason, setReason] = useState(o.reason);
  const [reasonNotes, setReasonNotes] = useState(order.reasonNotes ?? '');
  const [stopSalary, setStopSalary] = useState(o.stopSalary);
  const [roomId, setRoomId] = useState(order.roomId ?? '');
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [notes, setNotes] = useState(order.notes ?? '');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    returnsApi.rooms().then(setRooms).catch(() => setRooms([]));
  }, []);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await returnsApi.amend(o.id, {
        arrivedOn, reason, reasonNotes: reasonNotes.trim() || null, stopSalary, housingName: roomId ? null : o.housingName, notes: notes.trim() || null,
        roomId: roomId || null, amendReason: why.trim(),
      });
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('operations.return.amend.title', { no: o.orderNo })}</DialogTitle>
      <DialogContent dividers>
        <Stack sx={{ gap: 2 }}>
          <Alert severity="info">{t('operations.return.amend.hint')}</Alert>
          <TextField type="date" required label={t('operations.return.col.arrivedOn')} value={arrivedOn} onChange={(e) => setArrivedOn(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select required label={t('operations.return.col.reason')} value={reason} onChange={(e) => setReason(e.target.value)}>
            {['ClientNoReason', 'WorkerRefuses', 'Sick', 'WorkerAbused', 'ContractCanceled', 'Other'].map((r) => (
              <MenuItem key={r} value={r}>
                {t(`operations.return.reasons.${r}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={t('operations.return.reasonNotes')} value={reasonNotes} onChange={(e) => setReasonNotes(e.target.value)} multiline minRows={2} />
          <TextField select label={t('operations.return.room')} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <MenuItem value="">—</MenuItem>
            {rooms.map((r) => (
              <MenuItem key={r.id} value={r.id} disabled={r.free <= 0 && r.id !== order.roomId}>
                <bdi>{r.label}</bdi>
                {` (${r.free})`}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel control={<Switch checked={stopSalary} onChange={(e) => setStopSalary(e.target.checked)} />} label={t('operations.return.stopSalary')} />
          <TextField label={t('operations.delivery.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
          <TextField required label={t('operations.return.amend.reason')} value={why} onChange={(e) => setWhy(e.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 500 } }} />
          {error && <Alert severity="error">{t(error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
        <Button variant="contained" disabled={busy || !why.trim() || !arrivedOn} onClick={() => void save()} dir={i18n.dir()}>
          {t('operations.return.amend.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
