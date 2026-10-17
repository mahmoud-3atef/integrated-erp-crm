import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { operationsApi, type DeliveryDetail } from '../../api/operations';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PillTabs } from '../../components/ui';
import { ApprovalBar, ApprovalLog, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { DeliveryStatusBadge, sar } from './delivery';

function SummaryItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, p: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50 }}>
      <Box sx={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: '10px', bgcolor: '#fff', color: tokens.navy700, '& svg': { fontSize: 19 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{label}</Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: tokens.navy800 }}>{children}</Typography>
      </Box>
    </Stack>
  );
}

/** One delivery order, as the old order page: header with its status, the summary, the workers, and its approval. */
export function DeliveryOrderDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { ar, date } = useCommercialFormat();
  const [order, setOrder] = useState<DeliveryDetail | null>(null);
  const [tab, setTab] = useState<'workers' | 'approval'>('workers');
  const [error, setError] = useState<string | null>(params.get('error'));
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState<string | null>(null);
  const approval = useRecordApproval(order?.approval?.instanceId);

  const reload = useCallback(async () => {
    try {
      setOrder(await operationsApi.get(id!));
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
  // Run a process: on an order being prepared without an approval, or to replace an approval that stopped with an error.
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
      {/* Header (.transfer-order-hero): the order, its project and its status card. */}
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 60, height: 60, borderRadius: '18px', bgcolor: tokens.navy700, color: '#fff', fontSize: 24, fontWeight: 800 }}>
              {o.projectName.trim().charAt(0).toUpperCase()}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>
                {t('operations.delivery.orderNo')} <b dir="ltr">{o.orderNo}</b>
                {o.source === 'Crm' && (
                  <Box component="span" sx={{ marginInlineStart: 1 }}>
                    <Badge tone="neutral">{t('operations.delivery.fromCrm')}</Badge>
                  </Box>
                )}
              </Typography>
              <Typography component="h1" sx={{ fontSize: 21, fontWeight: 800, color: tokens.navy800 }}>
                {o.projectName}
              </Typography>
              <Typography sx={{ fontSize: 13, color: tokens.gray600 }}>
                {t('commercial.col.manager')}: {o.projectManager ?? '—'} · {t('commercial.col.customer')}: {o.customerName ?? '—'}
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ minWidth: 220, p: 1.75, borderRadius: `${tokens.radius}px`, border: `1px solid ${tokens.navy50}`, bgcolor: '#fafbfd' }}>
            <Typography sx={{ fontSize: 12, color: tokens.gray500, mb: 0.75 }}>{t('operations.delivery.orderStatus')}</Typography>
            <DeliveryStatusBadge row={o} />
            <Typography sx={{ fontSize: 12.5, color: tokens.gray600, mt: 1 }}>
              {t('operations.delivery.workersCount', { count: o.workers })}
              {o.specialPrices > 0 && ` · ${t('operations.delivery.specialCount', { count: o.specialPrices })}`}
            </Typography>
          </Box>
          <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/operations/delivery-orders')}>
            {t('common.back')}
          </Button>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 1.5, mt: 2.5 }}>
          <SummaryItem icon={<EventOutlinedIcon />} label={t('operations.delivery.col.deliverOn')}>
            {date(o.deliverOn)}
          </SummaryItem>
          <SummaryItem icon={<EventAvailableOutlinedIcon />} label={t('operations.delivery.col.startOn')}>
            {date(o.startOn)}
          </SummaryItem>
          <SummaryItem icon={<GroupsOutlinedIcon />} label={t('operations.delivery.col.workers')}>
            {o.workers}
          </SummaryItem>
          <SummaryItem icon={<PaymentsOutlinedIcon />} label={t('operations.delivery.monthlyTotal')}>
            {sar(o.totalPrice)}
          </SummaryItem>
          <SummaryItem icon={<BadgeOutlinedIcon />} label={t('operations.delivery.receiverName')}>
            {o.receiverName}
            {order.receiverTitle && <Typography component="span" sx={{ fontSize: 12, color: tokens.gray500, fontWeight: 400 }}> — {order.receiverTitle}</Typography>}
          </SummaryItem>
          <SummaryItem icon={<ManageAccountsOutlinedIcon />} label={t('operations.delivery.createdBy')}>
            {o.createdByName}
          </SummaryItem>
        </Box>

        {(order.delayReason || order.notes || order.lastComment) && (
          <Stack spacing={0.5} sx={{ mt: 2, fontSize: 13, color: tokens.gray600 }}>
            {order.delayReason && <span>{t('operations.delivery.delayReason')}: {order.delayReason}</span>}
            {order.notes && <span>{t('operations.delivery.notes')}: {order.notes}</span>}
            {order.lastComment && <span>{t('operations.delivery.lastComment')}: {order.lastComment}</span>}
          </Stack>
        )}

        {(order.canEdit || order.canSubmit || order.canCancel || canRun) && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.25, mt: 2.5 }}>
            {order.canEdit && (
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/operations/delivery-orders/${o.id}/edit`)}>
                {t('common.edit')}
              </Button>
            )}
            {order.canSubmit && (
              <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy} onClick={() => void run(() => operationsApi.submit(o.id))}>
                {t('operations.delivery.submit')}
              </Button>
            )}
            {canRun && (
              <RunProcessButton
                screen="operations.delivery_order"
                recordId={o.id}
                title={`${o.orderNo} — ${o.projectName}`}
                onStarted={() => void reload().then(() => approval.reload())}
              />
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
          {t('operations.delivery.creatorHint')}
        </Alert>
      )}
      {o.status === 'Delivered' && o.source === 'System' && (
        <Alert severity="success" sx={{ mb: `${tokens.gap}px` }}>
          {t('operations.delivery.deliveredHint')}
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

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }}>
        <PillTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'workers', label: t('operations.delivery.tabs.workers', { count: order.lines.length }) },
            ...(order.approval ? [{ value: 'approval' as const, label: t('operations.delivery.tabs.approval') }] : []),
          ]}
        />
        {tab === 'approval' && order.approval ? (
          <ApprovalLog status={order.approval} detail={approval.detail} />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('workforce.col.name')}</TableCell>
                  <TableCell>{t('operations.delivery.col.iqama')}</TableCell>
                  <TableCell>{t('commercial.prices.col.who')}</TableCell>
                  <TableCell>{t('commercial.prices.col.package')}</TableCell>
                  <TableCell align="center">{t('commercial.prices.col.salary')}</TableCell>
                  <TableCell align="center">{t('operations.delivery.col.housingTransport')}</TableCell>
                  <TableCell align="center">{t('commercial.prices.col.total')}</TableCell>
                  <TableCell>{t('operations.delivery.col.workerStart')}</TableCell>
                  {o.source === 'Crm' && <TableCell>{t('commercial.prices.col.workStart')}</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {order.lines.map((l) => (
                  <TableRow key={l.id} hover sx={{ cursor: l.workerId ? 'pointer' : 'default' }} onClick={() => l.workerId && navigate(`/workforce/workers/${l.workerId}`)}>
                    <TableCell sx={{ minWidth: 170 }}>
                      <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                        {l.name}
                      </Typography>
                      <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                        {l.workerNo}
                      </Typography>
                    </TableCell>
                    <TableCell dir="ltr">{l.iqamaNo ?? '—'}</TableCell>
                    <TableCell>
                      {(ar ? l.professionAr : l.professionEn) ?? '—'}
                      <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{(ar ? l.nationalityAr : l.nationalityEn) ?? '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      {l.isSpecialPrice ? (
                        <>
                          <Badge tone="warning">{t('commercial.prices.status.Special')}</Badge>
                          {l.specialReason && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{l.specialReason}</Typography>}
                        </>
                      ) : l.packageNo ? (
                        <Badge tone="success">{l.packageNo}</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="center">{sar(l.salary)}</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>
                      {sar(l.housing)} / {sar(l.transport)}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                      {sar(l.totalPrice)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {l.startedOn ? (
                        <Badge tone="success">{date(l.startedOn)}</Badge>
                      ) : (
                        date(l.startOn ?? o.startOn)
                      )}
                    </TableCell>
                    {o.source === 'Crm' && <TableCell dir="ltr">{l.workStartNo ?? '—'}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 2.5, fontSize: 12.5, color: tokens.gray500 }}>
          <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          {o.source === 'Crm' ? t('operations.delivery.crmNote') : t('operations.delivery.parallelNote')}
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
                  await operationsApi.cancel(o.id, canceling.trim() || null);
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
