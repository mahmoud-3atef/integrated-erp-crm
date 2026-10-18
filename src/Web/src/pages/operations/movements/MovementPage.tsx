import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { movementsApi, type MovementDetail } from '../../../api/movements';
import { tokens } from '../../../app/theme';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { ApprovalBar, ApprovalLog, useRecordApproval } from '../../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { sar } from '../../operations/delivery';
import { gradient, lookOf, MovementStatusBadge, rise, Transition, typeLook, useStateName } from './movementMeta';
import { useCrumb } from '../../../app/breadcrumbs';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50 }}>
      <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mb: 0.25 }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: 14, fontWeight: 700, color: tokens.navy800 }}>
        {children}
      </Typography>
    </Box>
  );
}

/** One movement: the change drawn large on the type's colors, its details, its review, and the worker's timeline. */
export function MovementPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const stateName = useStateName();
  const [m, setM] = useState<MovementDetail | null>(null);
  useCrumb(m?.movementNo);
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

  const toSub = m.opensPeriod === 'Work' || m.opensPeriod === 'ClientVacation' ? (m.projectName ?? m.fromProjectName) : m.place;

  return (
    <Box>
      {/* The banner: the type's gradient, the worker, and the change. */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: `${tokens.radiusLg}px`,
          mb: 2.5,
          color: '#fff',
          background: gradient(m.type),
          boxShadow: `0 16px 36px ${typeLook[m.type].from}40`,
          animation: `${rise} .45s ease both`,
          '&::before': { content: '""', position: 'absolute', width: 320, height: 320, borderRadius: '50%', top: -160, insetInlineEnd: -80, background: 'rgba(255,255,255,.10)' },
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ position: 'relative', zIndex: 1, gap: 2, p: { xs: 2.5, md: 3 }, alignItems: { md: 'center' } }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '30%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.2)', '& svg': { fontSize: 34 } }}>{typeLook[m.type].icon}</Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, opacity: 0.85 }}>
              {t(`movements.types.${m.type}`)} · <b dir="ltr">{m.movementNo}</b>
            </Typography>
            <Typography component="h1" sx={{ fontSize: 23, fontWeight: 800 }}>
              {m.workerName}
            </Typography>
            <Typography sx={{ fontSize: 13, opacity: 0.85 }}>
              <span dir="ltr">{m.workerNo}</span>
              {m.iqamaNo && (
                <>
                  {' · '}
                  {t('movements.iqama')} <span dir="ltr">{m.iqamaNo}</span>
                </>
              )}
            </Typography>
          </Box>
          <Stack sx={{ alignItems: { md: 'flex-end' }, gap: 1 }}>
            <Box sx={{ bgcolor: '#fff', borderRadius: 99, px: 0.5, alignSelf: { xs: 'flex-start', md: 'flex-end' } }}>
              <MovementStatusBadge status={m.status} />
            </Box>
            <Typography sx={{ fontSize: 12, opacity: 0.85 }}>
              {m.executedAt
                ? t('movements.executedBy', { name: m.executedByName ?? '—', at: new Date(m.executedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) })
                : t('movements.createdBy', { name: m.createdByName, at: new Date(m.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) })}
            </Typography>
          </Stack>
        </Stack>

        <Box sx={{ position: 'relative', zIndex: 1, mx: { xs: 1.5, md: 3 }, mb: { xs: 1.5, md: 3 }, p: { xs: 2, md: 2.5 }, borderRadius: `${tokens.radius + 4}px`, bgcolor: '#fff' }}>
          <Transition big from={m.fromPlacement} fromLabel={stateName(m.fromPlacement)} fromSub={m.fromProjectName} to={m.opensPeriod} toLabel={stateName(m.opensPeriod)} toSub={toSub} />
          <Typography sx={{ mt: 1.5, fontSize: 13, color: tokens.gray600, textAlign: 'center' }}>
            {t(`movements.dateLabel.${m.type}`)}: <b>{date(m.effectiveOn)}</b>
          </Typography>
        </Box>
      </Box>

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.25, mb: 2 }}>
        <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/operations/movements')}>
          {t('common.back')}
        </Button>
        <Button startIcon={<PersonOutlineIcon />} onClick={() => navigate(`/workforce/workers/${m.workerId}?tab=periods`)}>
          {t('movements.openWorker')}
        </Button>
        {m.canEdit && (
          <>
            <Button variant="contained" startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/operations/movements/${m.id}/edit`)} sx={{ background: gradient(m.type) }}>
              {t('movements.editAndResend')}
            </Button>
            <Button color="error" startIcon={<BlockOutlinedIcon />} onClick={() => setCanceling('')}>
              {t('movements.cancel')}
            </Button>
          </>
        )}
      </Stack>

      <ErrorMessage messageKey={error} />
      {m.lastComment && (m.status === 'Returned' || m.status === 'Rejected') && (
        <Alert severity={m.status === 'Rejected' ? 'error' : 'warning'} sx={{ mb: 2 }}>
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

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 380px' }, gap: 2.5, alignItems: 'start' }}>
        <Stack spacing={2.5}>
          <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, animation: `${rise} .4s ease both`, animationDelay: '80ms' }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800, mb: 1.5 }}>{t('movements.details')}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1.25 }}>
              <Fact label={t(`movements.dateLabel.${m.type}`)}>{date(m.effectiveOn)}</Fact>
              {m.expectedReturnOn && <Fact label={t('movements.expectedReturn')}>{date(m.expectedReturnOn)}</Fact>}
              {m.vacationKind && <Fact label={t('movements.vacationKind')}>{t(`movements.vacation.${m.vacationKind}`)}</Fact>}
              {m.returnTo && <Fact label={t('movements.returnTo')}>{t(`movements.return.${m.returnTo}`)}</Fact>}
              {m.projectName && m.opensPeriod === 'Work' && <Fact label={t('commercial.col.project')}>{m.projectName}</Fact>}
              {m.opensPeriod === 'Work' && (
                <Fact label={m.isSpecialPrice ? t('movements.specialPrice') : t('movements.packagePrice')}>
                  {sar(m.totalPrice)}
                  {m.packageNo && (
                    <Typography component="span" dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, marginInlineStart: 1 }}>
                      {m.packageNo}
                    </Typography>
                  )}
                </Fact>
              )}
              {m.specialReason && <Fact label={t('movements.specialReason')}>{m.specialReason}</Fact>}
              {m.suspensionReason && <Fact label={t('movements.suspensionReason')}>{t(`movements.suspension.${m.suspensionReason}`)}</Fact>}
              {m.exitKind && <Fact label={t('movements.exitKind')}>{t(`movements.exit.${m.exitKind}`)}</Fact>}
              {m.place && <Fact label={t(m.type === 'Absconding' ? 'movements.lastPlace' : 'movements.housingPlace')}>{m.place}</Fact>}
              {m.opensPeriod === 'Housing' && <Fact label={t('movements.salaryInHousing')}>{m.paySalary ? t('movements.paid') : t('movements.stopped')}</Fact>}
              {m.delayReason && <Fact label={t('movements.delayReason')}>{m.delayReason}</Fact>}
            </Box>
            {m.notes && <Typography sx={{ mt: 1.5, fontSize: 13, color: tokens.gray600 }}>{t('movements.notes')}: {m.notes}</Typography>}
          </Box>
          {m.approval && (
            <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }}>
              <ApprovalLog status={m.approval} detail={approval.detail} />
            </Box>
          )}
        </Stack>

        {/* The worker's timeline, latest first; this movement's period marked. */}
        <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, animation: `${rise} .4s ease both`, animationDelay: '140ms' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800, mb: 2 }}>{t('movements.timeline')}</Typography>
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 8, bottom: 8, insetInlineStart: 15, width: 2, bgcolor: tokens.gray100 }} />
            {m.timeline.map((p) => {
              const look = lookOf(p.kind);
              const mine = p.sourceId === m.id;
              return (
                <Stack key={p.id} direction="row" sx={{ position: 'relative', gap: 1.5, mb: 1.75 }}>
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
                      border: `2px solid #fff`,
                      boxShadow: mine ? `0 0 0 3px ${typeLook[m.type].from}40` : 'none',
                      '& svg': { fontSize: 17 },
                    }}
                  >
                    {look.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0, p: mine ? 1 : 0, borderRadius: 2, bgcolor: mine ? `${typeLook[m.type].from}0d` : 'transparent' }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: look.color }}>
                      {stateName(p.kind)}
                      {p.projectName && <span style={{ color: tokens.gray600, fontWeight: 600 }}> · {p.projectName}</span>}
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                      {date(p.startsOn)} – {p.endsOn ? date(p.endsOn) : t('movements.now')}
                      {p.fromOldSystem ? ` · ${t('workforce.periods.oldSystem')}` : ` · ${p.sourceNo}`}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
            {m.timeline.length === 0 && <Typography sx={{ color: tokens.gray500, fontSize: 13 }}>{t('movements.noTimeline')}</Typography>}
          </Box>
        </Box>
      </Box>

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
