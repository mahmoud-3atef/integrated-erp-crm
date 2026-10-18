import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { movementsApi, type MovementDetail } from '../../../api/movements';
import { useCrumb } from '../../../app/breadcrumbs';
import { tokens } from '../../../app/theme';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { RecordHero, SectionTitle, SummaryBand, SummaryCard, SummaryFact, SummaryGroup, SummaryNote } from '../../../components/RecordLayout';
import { ApprovalBar, ApprovalFeedLog, useRecordApproval } from '../../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { sar } from '../../operations/delivery';
import { Journey, JourneyLine, WorkerFact, WorkerHead } from '../recordParts';
import { ActionDialog } from './ActionDialog';
import { gradient, lookOf, MovementStatusBadge, typeLook, useStateName } from './movementMeta';

const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };

/**
 * One worker action, in its type's colors: the band with its number and actions, the approval bar, the worker with the
 * change drawn (from where to where, and when), the worker's timeline and the approval's history; beside them the
 * action and its details.
 */
export function MovementPage({ editing = false }: { editing?: boolean } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const stateName = useStateName();
  const [m, setM] = useState<MovementDetail | null>(null);
  useCrumb(m?.movementNo, `/operations/movements/${id}`);
  const [wizard, setWizard] = useState(editing);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approval = useRecordApproval(m?.approval?.instanceId);

  const reload = useCallback(async () => {
    try {
      setM(await movementsApi.get(id!));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!m) {
    return <ErrorMessage messageKey={error} />;
  }

  const color = typeLook[m.type].from;
  const toSub = m.opensPeriod === 'Work' || m.opensPeriod === 'ClientVacation' ? (m.projectName ?? m.fromProjectName) : m.place;

  return (
    <Box>
      <RecordHero
        tone="movement"
        background={gradient(m.type)}
        icon={typeLook[m.type].icon}
        kind={t(`movements.types.${m.type}`)}
        number={m.movementNo}
        status={
          <Box sx={{ bgcolor: '#fff', borderRadius: 99, px: 0.25 }}>
            <MovementStatusBadge status={m.status} />
          </Box>
        }
        actions={
          <>
            <Button variant="outlined" startIcon={<PersonOutlineIcon />} onClick={() => navigate(`/workforce/workers/${m.workerId}?tab=periods`)}>
              {t('movements.openWorker')}
            </Button>
            {m.canEdit && (
              <>
                <Button variant="contained" startIcon={<EditOutlinedIcon />} onClick={() => setWizard(true)}>
                  {t('movements.editAndResend')}
                </Button>
                <Button variant="outlined" startIcon={<BlockOutlinedIcon />} onClick={() => setCanceling('')}>
                  {t('movements.cancel')}
                </Button>
              </>
            )}
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/operations/movements')}>
              {t('common.back')}
            </Button>
          </>
        }
      />

      <ErrorMessage messageKey={error} />
      {m.lastComment && (m.status === 'Returned' || m.status === 'Rejected') && (
        <Alert severity={m.status === 'Rejected' ? 'error' : 'warning'} sx={{ mb: `${tokens.gap}px` }}>
          {t('operations.delivery.lastComment')}: {m.lastComment}
        </Alert>
      )}
      {m.approval && (
        <ApprovalBar
          status={m.approval}
          detail={approval.detail}
          onChanged={() => {
            void approval.reload();
            void reload();
          }}
        />
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }}>
        {/* The action and its details. */}
        <SummaryCard>
          <SummaryBand
            tone="movement"
            background={gradient(m.type)}
            label={t('movements.action')}
            value={t(`movements.types.${m.type}`)}
            size={21}
            chips={[{ label: `${t(`movements.dateLabel.${m.type}`)}: ${date(m.effectiveOn)}` }]}
          />
          <SummaryGroup title={t('movements.details')} color={color}>
            <SummaryFact icon={<EventOutlinedIcon />} color={color} label={t(`movements.dateLabel.${m.type}`)} value={date(m.effectiveOn)} sub={m.expectedReturnOn ? `${t('movements.expectedReturn')}: ${date(m.expectedReturnOn)}` : null} />
            {m.vacationKind && <SummaryFact icon={<HotelOutlinedIcon />} color={color} label={t('movements.vacationKind')} value={t(`movements.vacation.${m.vacationKind}`)} />}
            {m.returnTo && <SummaryFact icon={<RouteOutlinedIcon />} color={color} label={t('movements.returnTo')} value={t(`movements.return.${m.returnTo}`)} sub={m.opensPeriod === 'Work' ? m.projectName : null} />}
            {m.suspensionReason && <SummaryFact icon={<ReportProblemOutlinedIcon />} color={color} label={t('movements.suspensionReason')} value={t(`movements.suspension.${m.suspensionReason}`)} />}
            {m.exitKind && <SummaryFact icon={<ReportProblemOutlinedIcon />} color={color} label={t('movements.exitKind')} value={t(`movements.exit.${m.exitKind}`)} />}
            {m.place && <SummaryFact icon={<HotelOutlinedIcon />} color={color} label={t(m.type === 'Absconding' ? 'movements.lastPlace' : 'movements.housingPlace')} value={m.place} />}
          </SummaryGroup>
          {m.opensPeriod === 'Work' && (
            <SummaryGroup title={t('operations.delivery.value')} color={tokens.success}>
              <SummaryFact
                icon={<PaymentsOutlinedIcon />}
                color={tokens.success}
                label={m.isSpecialPrice ? t('movements.specialPrice') : t('movements.packagePrice')}
                value={`${sar(m.totalPrice)} ${t('operations.delivery.sarUnit')}`}
                sub={m.specialReason ?? m.packageNo}
              />
            </SummaryGroup>
          )}
          {m.opensPeriod === 'Housing' && (
            <SummaryGroup title={t('movements.salaryInHousing')} color={m.paySalary ? tokens.success : tokens.danger}>
              <SummaryFact icon={<PaymentsOutlinedIcon />} color={m.paySalary ? tokens.success : tokens.danger} label={t('movements.salaryInHousing')} value={m.paySalary ? t('movements.paid') : t('movements.stopped')} />
            </SummaryGroup>
          )}
          {m.delayReason && <SummaryNote title={t('movements.delayReason')}>{m.delayReason}</SummaryNote>}
          {m.notes && <SummaryNote title={t('movements.notes')}>{m.notes}</SummaryNote>}
        </SummaryCard>

        <Stack spacing={`${tokens.gap}px`} sx={{ minWidth: 0 }}>
          {/* The worker, and the change. */}
          <Box sx={{ ...card, overflow: 'hidden' }}>
            <WorkerHead
              tone="movement"
              label={t('operations.return.col.worker')}
              name={m.workerName}
              workerId={m.workerId}
              workerNo={m.workerNo}
              facts={
                <>
                  <WorkerFact icon={<BadgeOutlinedIcon />} label={t('operations.delivery.col.iqama')} value={m.iqamaNo ?? '—'} ltr />
                  <WorkerFact icon={<EventOutlinedIcon />} label={t(`movements.dateLabel.${m.type}`)} value={date(m.effectiveOn)} />
                  <WorkerFact
                    icon={<ManageAccountsOutlinedIcon />}
                    label={m.executedAt ? t('movements.executed') : t('movements.created')}
                    value={m.executedAt ? (m.executedByName ?? '—') : m.createdByName}
                  />
                </>
              }
            />
            <Box sx={{ px: 2.5, pt: 2, pb: 2.5, borderTop: `1px solid ${tokens.gray100}` }}>
              <SectionTitle icon={<RouteOutlinedIcon />} title={t('movements.journey')} />
              <Journey
                from={{ state: m.fromPlacement, label: stateName(m.fromPlacement), sub: m.fromProjectName }}
                to={{ state: m.opensPeriod, label: stateName(m.opensPeriod), sub: toSub, lines: <JourneyLine label={t(`movements.dateLabel.${m.type}`)}>{date(m.effectiveOn)}</JourneyLine> }}
                pill={t(`movements.types.${m.type}`)}
                pillIcon={typeLook[m.type].icon}
              />
            </Box>
          </Box>

          {/* The worker's timeline, latest first; this action's period marked. */}
          <Box sx={{ ...card, p: 2.25 }}>
            <SectionTitle icon={<TimelineOutlinedIcon />} title={t('movements.timeline')} />
            <Box sx={{ position: 'relative' }}>
              <Box sx={{ position: 'absolute', top: 8, bottom: 8, insetInlineStart: 15, width: 2, bgcolor: tokens.gray100 }} />
              {m.timeline.map((p) => {
                const look = lookOf(p.kind);
                const mine = p.sourceId === m.id;
                return (
                  <Stack key={p.id} direction="row" sx={{ position: 'relative', gap: 1.5, mb: 1.5 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        color: mine ? '#fff' : look.color,
                        background: mine ? gradient(m.type) : look.bg,
                        border: '2px solid #fff',
                        boxShadow: mine ? `0 0 0 3px ${color}40` : 'none',
                        '& svg': { fontSize: 17 },
                      }}
                    >
                      {look.icon}
                    </Box>
                    <Stack direction="row" sx={{ flex: 1, minWidth: 0, gap: 2, alignItems: 'center', p: mine ? 1 : 0, borderRadius: 2, bgcolor: mine ? `${color}0d` : 'transparent' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color: look.color }}>
                          {stateName(p.kind)}
                          {p.projectName && <span style={{ color: tokens.gray600, fontWeight: 600 }}> · {p.projectName}</span>}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{p.fromOldSystem ? t('workforce.periods.oldSystem') : p.sourceNo}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 12, color: tokens.gray500, whiteSpace: 'nowrap' }}>
                        {date(p.startsOn)} – {p.endsOn ? date(p.endsOn) : t('movements.now')}
                      </Typography>
                    </Stack>
                  </Stack>
                );
              })}
              {m.timeline.length === 0 && <Typography sx={{ color: tokens.gray500, fontSize: 13 }}>{t('movements.noTimeline')}</Typography>}
            </Box>
          </Box>

          {m.approval && (
            <Box sx={{ ...card, p: 2.25 }}>
              <SectionTitle icon={<HistoryOutlinedIcon />} title={t('operations.delivery.tabs.approval')} />
              <ApprovalFeedLog status={m.approval} detail={approval.detail} />
            </Box>
          )}
        </Stack>
      </Box>

      {wizard && (
        <ActionDialog
          id={m.id}
          onClose={() => (editing ? navigate(`/operations/movements/${m.id}`) : setWizard(false))}
          onSent={() => {
            if (editing) {
              navigate(`/operations/movements/${m.id}`);
              return;
            }
            void reload().then(() => approval.reload());
          }}
        />
      )}

      {canceling !== null && (
        <Dialog open onClose={() => setCanceling(null)} maxWidth="xs" fullWidth>
          <DialogTitle>{t('movements.cancelTitle', { no: m.movementNo })}</DialogTitle>
          <DialogContent>
            <TextField sx={{ mt: 1 }} label={t('movements.cancelReason')} value={canceling} onChange={(e) => setCanceling(e.target.value)} fullWidth multiline minRows={2} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCanceling(null)}>{t('common.close')}</Button>
            <Button
              color="error"
              variant="contained"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  try {
                    await movementsApi.cancel(m.id, canceling.trim() || null);
                    setCanceling(null);
                    await reload();
                  } catch (failure) {
                    setError(errorKey(failure));
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              {t('movements.cancel')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
