import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { returnsApi, type ReturnDetail } from '../../api/operations';
import { useCrumb } from '../../app/breadcrumbs';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { RecordHero, SectionTitle, SummaryBand, SummaryCard, SummaryFact, SummaryGroup, SummaryNote } from '../../components/RecordLayout';
import { Badge } from '../../components/ui';
import { ApprovalBar, ApprovalFeedLog, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { StateBubble, useStateName } from './movements/movementMeta';
import { ReturnStatusBadge } from './returns';

const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };

// Where the worker comes back from, by how they entered the housing.
const origin = { ReturnedWorker: 'Work', NewArrival: 'New', BackFromVacation: 'Vacation' } as const;

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter((part) => /\p{L}/u.test(part))
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '·'
  );
}

/** A fact about the worker, in a tinted tile. */
function WorkerFact({ icon, label, value, ltr = false }: { icon: ReactNode; label: string; value: ReactNode; ltr?: boolean }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px solid ${tokens.gray100}`, minWidth: 0 }}>
      <Box sx={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: '#fff', color: tokens.navy700, '& svg': { fontSize: 18 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{label}</Typography>
        <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ltr ? <span dir="ltr">{value}</span> : value}
        </Typography>
      </Box>
    </Stack>
  );
}

/**
 * One return order — a single worker, so the page centres on them: the band with the number and actions, the approval
 * bar, the worker's card with the way back (from the project to the housing, with the days worked), the approval's
 * history, and beside them the reason, the customer's wish and the salary.
 */
export function ReturnOrderDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { ar, date } = useCommercialFormat();
  const stateName = useStateName();
  const [order, setOrder] = useState<ReturnDetail | null>(null);
  useCrumb(order?.summary.orderNo);
  const [error, setError] = useState<string | null>(params.get('error'));
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState<string | null>(null);
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
  const worked = order.workStartedOn && o.arrivedOn ? Math.max(0, Math.round((new Date(o.arrivedOn).getTime() - new Date(order.workStartedOn).getTime()) / 86_400_000)) : null;
  return (
    <Box>
      <RecordHero
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
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/operations/return-orders/${o.id}/edit`)}>
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
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/operations/return-orders')}>
              {t('common.back')}
            </Button>
          </>
        }
      />

      <ErrorMessage messageKey={error} />
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
            <Stack direction="row" sx={{ alignItems: 'center', gap: 2, px: 2.5, py: 2, background: `linear-gradient(180deg, ${tokens.navy50} 0%, #fff 100%)` }}>
              <Box
                sx={{
                  flex: '0 0 auto',
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 21,
                  fontWeight: 800,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #0f4c6e, #13708f)',
                  boxShadow: '0 0 0 4px #fff, 0 4px 12px rgba(15,76,110,.25)',
                }}
              >
                {initials(o.name)}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('operations.return.col.worker')}</Typography>
                <Typography sx={{ fontSize: 19, fontWeight: 800, color: tokens.navy800, lineHeight: 1.3 }}>
                  {o.workerId ? (
                    <Link component={RouterLink} to={`/workforce/workers/${o.workerId}`} underline="hover" color="inherit">
                      {o.name}
                    </Link>
                  ) : (
                    o.name
                  )}
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>
                  <span dir="ltr">{o.workerNo}</span>
                </Typography>
              </Box>
              <Badge tone="info">{t(`operations.return.entry.${o.entry}`)}</Badge>
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.25, px: 2.5, pb: 2.25, pt: 0.5 }}>
              <WorkerFact icon={<BadgeOutlinedIcon />} label={t('operations.delivery.col.iqama')} value={order.iqamaNo ?? '—'} ltr />
              <WorkerFact icon={<EngineeringOutlinedIcon />} label={t('operations.return.profession')} value={(ar ? order.professionAr : order.professionEn) ?? '—'} />
              <WorkerFact icon={<PublicOutlinedIcon />} label={t('operations.return.nationality')} value={(ar ? order.nationalityAr : order.nationalityEn) ?? '—'} />
            </Box>

            <Box sx={{ px: 2.5, pt: 2, pb: 2.5, borderTop: `1px solid ${tokens.gray100}` }}>
              <SectionTitle icon={<RouteOutlinedIcon />} title={t('operations.return.journey')} />
              <Stack direction={{ xs: 'column', md: 'row' }} sx={{ alignItems: { md: 'center' }, gap: 2 }}>
                <Box sx={{ flex: '0 1 auto', minWidth: 0 }}>
                  <StateBubble state={from} label={stateName(from)} sub={o.projectName} big />
                  <Typography sx={{ mt: 0.75, fontSize: 12, color: tokens.gray500, paddingInlineStart: '64px' }}>
                    {t('operations.return.workStarted')}: <b style={{ color: tokens.navy800 }}>{date(order.workStartedOn)}</b>
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 80, position: 'relative', display: { xs: 'none', md: 'block' } }}>
                  <Box sx={{ height: 2, backgroundImage: 'linear-gradient(90deg, #b6c3d3 50%, transparent 50%)', backgroundSize: '12px 2px' }} />
                  <Box sx={{ position: 'absolute', insetInlineEnd: -2, top: -4, width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderInlineStart: '8px solid #b6c3d3' }} />
                  {worked !== null && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        insetInline: 0,
                        mx: 'auto',
                        width: 'fit-content',
                        transform: 'translateY(-50%)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1.25,
                        py: 0.25,
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        color: tokens.gold,
                        bgcolor: '#fbf4dc',
                        border: '1px solid rgba(179, 138, 15, .25)',
                        '& svg': { fontSize: 14 },
                      }}
                    >
                      <TimerOutlinedIcon />
                      {t('operations.return.workedDays', { count: worked })}
                    </Box>
                  )}
                </Box>
                <Box sx={{ flex: '0 1 auto', minWidth: 0 }}>
                  <StateBubble state="Housing" label={stateName('Housing')} sub={o.housingName} big />
                  <Typography sx={{ mt: 0.75, fontSize: 12, color: tokens.gray500, paddingInlineStart: '64px' }}>
                    {t('operations.return.col.arrivedOn')}: <b style={{ color: tokens.navy800 }}>{date(o.arrivedOn)}</b>
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Box>

          {order.approval && (
            <Box sx={{ ...card, p: 2.25 }}>
              <SectionTitle icon={<HistoryOutlinedIcon />} title={t('operations.delivery.tabs.approval')} />
              <ApprovalFeedLog status={order.approval} detail={approval.detail} />
            </Box>
          )}
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
    </Box>
  );
}
