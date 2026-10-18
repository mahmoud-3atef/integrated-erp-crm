import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
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
import { useCrumb } from '../../app/breadcrumbs';

function SummaryItem({ icon, label, children, sub }: { icon: React.ReactNode; label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, py: 1.4, '&:not(:last-of-type)': { borderBottom: `1px solid ${tokens.gray100}` } }}>
      <Box sx={{ flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '11px', bgcolor: tokens.navy50, color: tokens.navy700, '& svg': { fontSize: 20 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{label}</Typography>
        <Typography component="div" sx={{ fontSize: 14, fontWeight: 800, color: tokens.navy800, overflowWrap: 'anywhere' }}>
          {children}
        </Typography>
        {sub && <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{sub}</Typography>}
      </Box>
    </Stack>
  );
}

/** The two letters of a worker's name, for the avatar in the workers table. */
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

const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };

/**
 * One delivery order: a slim header with its actions, the approval bar, then the order's summary on one side and its
 * workers (or the approval log) on the other.
 */
export function DeliveryOrderDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { ar, date } = useCommercialFormat();
  const [order, setOrder] = useState<DeliveryDetail | null>(null);
  useCrumb(order?.summary.orderNo);
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
      {/* Header: the order, its state, and what can be done with it. */}
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800, color: tokens.navy800 }}>
              {t('operations.delivery.orderNo')} <span dir="ltr">{o.orderNo}</span>
            </Typography>
            <DeliveryStatusBadge row={o} />
            {o.source === 'Crm' && <Badge tone="neutral">{t('operations.delivery.fromCrm')}</Badge>}
          </Stack>
          <Typography sx={{ fontSize: 13, color: tokens.gray500, mt: 0.25 }}>
            {o.projectName}
            {o.customerName ? ` · ${o.customerName}` : ''}
          </Typography>
        </Box>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
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
          <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/operations/delivery-orders')}>
            {t('common.back')}
          </Button>
        </Stack>
      </Stack>

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

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '290px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }}>
        {/* The order's summary. */}
        <Box sx={{ ...card, p: 2.25, position: { lg: 'sticky' }, top: { lg: 84 } }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.5 }}>
            <AssignmentOutlinedIcon sx={{ color: tokens.navy700 }} />
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: tokens.navy800 }}>{t('operations.delivery.summaryTitle')}</Typography>
          </Stack>
          <SummaryItem icon={<PersonOutlineOutlinedIcon />} label={t('operations.delivery.createdBy')} sub={date(o.createdAt)}>
            {o.createdByName}
          </SummaryItem>
          <SummaryItem icon={<ApartmentOutlinedIcon />} label={t('commercial.col.project')} sub={o.customerName}>
            {o.projectName}
          </SummaryItem>
          <SummaryItem icon={<ManageAccountsOutlinedIcon />} label={t('commercial.col.manager')}>
            {o.projectManager ?? '—'}
          </SummaryItem>
          <SummaryItem icon={<EventOutlinedIcon />} label={t('operations.delivery.col.deliverOn')} sub={`${t('operations.delivery.col.startOn')}: ${date(o.startOn)}`}>
            {date(o.deliverOn)}
          </SummaryItem>
          <SummaryItem
            icon={<GroupsOutlinedIcon />}
            label={t('operations.delivery.col.workers')}
            sub={o.specialPrices > 0 ? t('operations.delivery.specialCount', { count: o.specialPrices }) : undefined}
          >
            {t('operations.delivery.workersCount', { count: o.workers })}
          </SummaryItem>
          <SummaryItem icon={<PaymentsOutlinedIcon />} label={t('operations.delivery.monthlyTotal')}>
            {sar(o.totalPrice)}
          </SummaryItem>
          <SummaryItem icon={<BadgeOutlinedIcon />} label={t('operations.delivery.receiverName')} sub={order.receiverTitle}>
            {o.receiverName}
          </SummaryItem>
          {(order.delayReason || order.notes || order.lastComment) && (
            <Stack spacing={0.75} sx={{ mt: 1, p: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, fontSize: 12.5, color: tokens.gray600 }}>
              {order.delayReason && (
                <span>
                  <b>{t('operations.delivery.delayReason')}:</b> {order.delayReason}
                </span>
              )}
              {order.notes && (
                <span>
                  <b>{t('operations.delivery.notes')}:</b> {order.notes}
                </span>
              )}
              {order.lastComment && (
                <span>
                  <b>{t('operations.delivery.lastComment')}:</b> {order.lastComment}
                </span>
              )}
            </Stack>
          )}
        </Box>

        {/* The workers, or the approval log. */}
        <Box sx={{ ...card, p: 2.25, minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
            <PillTabs
              value={tab}
              onChange={setTab}
              options={[
                { value: 'workers', label: t('operations.delivery.tabs.workers', { count: order.lines.length }) },
                ...(order.approval ? [{ value: 'approval' as const, label: t('operations.delivery.tabs.approval') }] : []),
              ]}
            />
          </Stack>
          {tab === 'approval' && order.approval ? (
            <ApprovalLog status={order.approval} detail={approval.detail} />
          ) : (
            <TableContainer sx={{ border: `1px solid ${tokens.gray100}`, borderRadius: `${tokens.radius}px` }}>
              <Table
                size="small"
                sx={{
                  '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even) .MuiTableCell-body': { bgcolor: '#fff' },
                  '& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-body': { borderBottom: 0 },
                  '& .MuiTableCell-root': { px: 1.25 },
                  '& .MuiTableCell-body': { py: 1.1 },
                }}
              >
                <TableHead
                  sx={{
                    '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': {
                      bgcolor: tokens.gray50,
                      color: tokens.gray600,
                      fontWeight: 700,
                      fontSize: 12,
                      borderBottom: `1px solid ${tokens.gray100}`,
                      borderRadius: 0,
                    },
                  }}
                >
                  <TableRow>
                    <TableCell>{t('workforce.col.name')}</TableCell>
                    <TableCell>{t('commercial.prices.col.who')}</TableCell>
                    <TableCell>{t('commercial.prices.col.package')}</TableCell>
                    <TableCell>{t('operations.delivery.col.price')}</TableCell>
                    <TableCell>{t('operations.delivery.col.workerStart')}</TableCell>
                    {o.source === 'Crm' && <TableCell>{t('commercial.prices.col.workStart')}</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {order.lines.map((l) => (
                    <TableRow key={l.id} hover sx={{ cursor: l.workerId ? 'pointer' : 'default' }} onClick={() => l.workerId && navigate(`/workforce/workers/${l.workerId}`)}>
                      <TableCell sx={{ minWidth: 210 }}>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                          <Box sx={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: tokens.navy50, color: tokens.navy700, fontSize: 12, fontWeight: 800 }}>
                            {initials(l.name)}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{l.name}</Typography>
                            <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                              <span dir="ltr">{l.workerNo}</span>
                              {l.iqamaNo && (
                                <>
                                  {' · '}
                                  {t('operations.delivery.iqamaShort')} <span dir="ltr">{l.iqamaNo}</span>
                                </>
                              )}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
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
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }}>{sar(l.totalPrice)}</Typography>
                        <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                          {[
                            t('operations.delivery.pricePart.salary', { value: sar(l.salary) }),
                            ...(l.housing ? [t('operations.delivery.pricePart.housing', { value: sar(l.housing) })] : []),
                            ...(l.transport ? [t('operations.delivery.pricePart.transport', { value: sar(l.transport) })] : []),
                          ].join(' · ')}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {l.startedOn ? (
                          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, color: tokens.success, fontSize: 12.5, fontWeight: 700 }}>
                            <CheckCircleOutlineIcon sx={{ fontSize: 17 }} />
                            {date(l.startedOn)}
                          </Stack>
                        ) : (
                          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, color: tokens.warning, fontSize: 12.5, fontWeight: 700 }}>
                            <ScheduleOutlinedIcon sx={{ fontSize: 17 }} />
                            {date(l.startOn ?? o.startOn)}
                          </Stack>
                        )}
                      </TableCell>
                      {o.source === 'Crm' && <TableCell dir="ltr">{l.workStartNo ?? '—'}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 2, fontSize: 12.5, color: tokens.gray500 }}>
            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
            {o.source === 'Crm' ? t('operations.delivery.crmNote') : t('operations.delivery.parallelNote')}
          </Stack>
        </Box>
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
