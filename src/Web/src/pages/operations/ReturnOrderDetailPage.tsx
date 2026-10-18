import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { returnsApi, type ReturnDetail } from '../../api/operations';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge } from '../../components/ui';
import { ApprovalBar, ApprovalLog, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { ReturnStatusBadge } from './returns';
import { useCrumb } from '../../app/breadcrumbs';

function SummaryItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, p: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50 }}>
      <Box sx={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: '10px', bgcolor: '#fff', color: tokens.navy700, '& svg': { fontSize: 19 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{label}</Typography>
        <Typography component="div" sx={{ fontSize: 14, fontWeight: 800, color: tokens.navy800 }}>
          {children}
        </Typography>
      </Box>
    </Stack>
  );
}

/** One return order: the worker and the return, its approval stages and history. */
export function ReturnOrderDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { ar, date } = useCommercialFormat();
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

  return (
    <Box>
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 60, height: 60, borderRadius: '18px', bgcolor: tokens.navy700, color: '#fff', fontSize: 24, fontWeight: 800 }}>
              {o.name.trim().charAt(0).toUpperCase()}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>
                {t('operations.return.orderNo')} <b dir="ltr">{o.orderNo}</b>
                {o.source === 'Crm' && (
                  <Box component="span" sx={{ marginInlineStart: 1 }}>
                    <Badge tone="neutral">{t('operations.delivery.fromCrm')}</Badge>
                  </Box>
                )}
              </Typography>
              <Typography component="h1" dir="ltr" sx={{ fontSize: 21, fontWeight: 800, color: tokens.navy800, textAlign: 'start' }}>
                {o.workerId ? (
                  <Link component={RouterLink} to={`/workforce/workers/${o.workerId}`} underline="hover" color="inherit">
                    {o.name}
                  </Link>
                ) : (
                  o.name
                )}
              </Typography>
              <Typography sx={{ fontSize: 13, color: tokens.gray600 }}>
                <span dir="ltr">{o.workerNo}</span> · {(ar ? order.professionAr : order.professionEn) ?? '—'} · {(ar ? order.nationalityAr : order.nationalityEn) ?? '—'}
                {order.iqamaNo && (
                  <>
                    {' · '}
                    <span dir="ltr">{order.iqamaNo}</span>
                  </>
                )}
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ minWidth: 220, p: 1.75, borderRadius: `${tokens.radius}px`, border: `1px solid ${tokens.navy50}`, bgcolor: '#fafbfd' }}>
            <Typography sx={{ fontSize: 12, color: tokens.gray500, mb: 0.75 }}>{t('operations.return.orderStatus')}</Typography>
            <ReturnStatusBadge row={o} />
            <Typography sx={{ fontSize: 12.5, color: tokens.gray600, mt: 1 }}>{t(`operations.return.entry.${o.entry}`)}</Typography>
          </Box>
          <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/operations/return-orders')}>
            {t('common.back')}
          </Button>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.5, mt: 2.5 }}>
          <SummaryItem icon={<AccountTreeOutlinedIcon />} label={t('operations.return.col.project')}>
            {o.projectName ?? '—'}
          </SummaryItem>
          <SummaryItem icon={<EventOutlinedIcon />} label={t('operations.return.workStarted')}>
            {date(order.workStartedOn)}
          </SummaryItem>
          <SummaryItem icon={<EventAvailableOutlinedIcon />} label={t('operations.return.col.arrivedOn')}>
            {date(o.arrivedOn)}
          </SummaryItem>
          <SummaryItem icon={<HotelOutlinedIcon />} label={t('operations.return.col.housing')}>
            {o.housingName ?? '—'}
          </SummaryItem>
          <SummaryItem icon={<ReportProblemOutlinedIcon />} label={t('operations.return.col.reason')}>
            {t(`operations.return.reasons.${o.reason}`)}
          </SummaryItem>
          <SummaryItem icon={<QuestionAnswerOutlinedIcon />} label={t('operations.return.customerWish')}>
            {o.customerWish ? t(`operations.return.wishes.${o.customerWish}`) : t('operations.return.wishPending')}
          </SummaryItem>
          <SummaryItem icon={<PaymentsOutlinedIcon />} label={t('operations.return.salaryInHousing')}>
            {o.stopSalary ? t('operations.return.salaryStops') : t('operations.return.salaryPaid')}
          </SummaryItem>
          <SummaryItem icon={<ManageAccountsOutlinedIcon />} label={t('operations.return.col.createdBy')}>
            {o.createdByName}
          </SummaryItem>
        </Box>

        {(order.reasonNotes || order.delayReason || order.notes || order.lastComment) && (
          <Stack spacing={0.5} sx={{ mt: 2, fontSize: 13, color: tokens.gray600 }}>
            {order.reasonNotes && <span>{t('operations.return.reasonNotes')}: {order.reasonNotes}</span>}
            {order.delayReason && <span>{t('operations.delivery.delayReason')}: {order.delayReason}</span>}
            {order.notes && <span>{t('operations.delivery.notes')}: {order.notes}</span>}
            {order.lastComment && <span>{t('operations.delivery.lastComment')}: {order.lastComment}</span>}
          </Stack>
        )}

        {(order.canEdit || order.canSubmit || order.canCancel || canRun) && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.25, mt: 2.5 }}>
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
              <Button color="error" startIcon={<CancelOutlinedIcon />} onClick={() => setCanceling('')}>
                {t('operations.delivery.cancel')}
              </Button>
            )}
          </Stack>
        )}
      </Box>
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
        <>
          <ApprovalBar
            status={order.approval}
            detail={approval.detail}
            onChanged={() => {
              void approval.reload();
              void reload();
            }}
          />
          <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800, mb: 1.5 }}>{t('operations.delivery.tabs.approval')}</Typography>
            <ApprovalLog status={order.approval} detail={approval.detail} />
          </Box>
        </>
      )}

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
