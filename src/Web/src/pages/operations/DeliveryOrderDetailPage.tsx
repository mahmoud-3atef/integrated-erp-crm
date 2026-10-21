import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
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
import { recordTones, RecordHero, SectionTitle, SummaryCard, SummaryDates, SummaryFact, SummaryGroup, SummaryNote, SummaryBand } from '../../components/RecordLayout';
import { Badge } from '../../components/ui';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { DeliveryStatusBadge, sar } from './delivery';
import { useCrumb } from '../../app/breadcrumbs';
import { DeliveryOrderWizard } from './DeliveryOrderWizard';

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
 * One delivery order: the band with its number and actions, the approval bar, then the order's summary on one side
 * and its workers (or the approval log) on the other.
 */
export function DeliveryOrderDetailPage({ editing = false }: { editing?: boolean } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { ar, date } = useCommercialFormat();
  const [order, setOrder] = useState<DeliveryDetail | null>(null);
  useCrumb(order?.summary.orderNo, `/operations/delivery-orders/${id}`);
  const [wizard, setWizard] = useState(editing);
  const [error, setError] = useState<string | null>(params.get('error'));
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [amending, setAmending] = useState(false);
  const [cancelingApproved, setCancelingApproved] = useState<string | null>(null);
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
      {/* The band: the order's number, its state, the project, and what can be done with it. */}
      <RecordHero
        tone="delivery"
        icon={<LocalShippingOutlinedIcon />}
        kind={t('operations.delivery.kind')}
        number={o.orderNo}
        status={
          <>
            <DeliveryStatusBadge row={o} />
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
              <Button variant="outlined" startIcon={<CancelOutlinedIcon />} onClick={() => setCanceling('')}>
                {t('operations.delivery.cancel')}
              </Button>
            )}
            {order.canAmend && (
              <Button variant="outlined" startIcon={<EditNoteOutlinedIcon />} onClick={() => setAmending(true)}>
                {t('operations.delivery.amend.action')}
              </Button>
            )}
            {order.canCancelApproved && (
              <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => setCancelingApproved('')}>
                {t('operations.delivery.amend.cancelAction')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/operations/delivery-orders')}>
              {t('common.back')}
            </Button>
          </>
        }
      />

      <ErrorMessage messageKey={error} />
      {order.amendedAt && o.status === 'Delivered' && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {t('operations.delivery.amend.amendedBy', { by: order.amendedByName, date: date(order.amendedAt) })} — {order.amendNote}
        </Alert>
      )}
      {o.status === 'CanceledAfterApproval' && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t('operations.delivery.amend.canceledBy', { by: order.canceledByName, date: date(order.canceledAt) })} — {order.lastComment}
        </Alert>
      )}
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
          loading={approval.loading}
          onChanged={() => {
            void approval.reload();
            void reload();
          }}
        />
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }}>
        {/* The order's summary, read top to bottom: the project, then each group in its color. */}
        <SummaryCard>
          <SummaryBand
            tone="delivery"
            label={t('commercial.col.project')}
            value={o.projectName}
            size={21}
            chips={[...(o.customerName ? [{ label: o.customerName }] : []), ...(o.projectManager ? [{ label: `${t('commercial.col.manager')}: ${o.projectManager}` }] : [])]}
          />
          <SummaryGroup title={t('operations.delivery.value')} color={tokens.success}>
            <SummaryFact
              icon={<PaymentsOutlinedIcon />}
              color={tokens.success}
              label={t('operations.delivery.monthlyTotal')}
              value={`${sar(o.totalPrice)} ${t('operations.delivery.sarUnit')}`}
              sub={[t('operations.delivery.workersCount', { count: o.workers }), ...(o.specialPrices > 0 ? [t('operations.delivery.specialCount', { count: o.specialPrices })] : [])].join(' · ')}
            />
          </SummaryGroup>
          <SummaryGroup title={t('operations.delivery.dates')} color={tokens.info}>
            <SummaryDates
              items={[
                { icon: <LocalShippingOutlinedIcon />, color: '#1f6fd1', label: t('operations.delivery.col.deliverOn'), value: date(o.deliverOn) },
                { icon: <EventOutlinedIcon />, color: '#7c4dcc', label: t('operations.delivery.col.startOn'), value: date(o.startOn) },
              ]}
            />
          </SummaryGroup>
          <SummaryGroup title={t('operations.delivery.receiving')} color={tokens.gold}>
            <SummaryFact icon={<BadgeOutlinedIcon />} color={tokens.gold} label={t('operations.delivery.receiverName')} value={o.receiverName} sub={order.receiverTitle} />
          </SummaryGroup>
          {order.delayReason && <SummaryNote title={t('operations.delivery.delayReason')}>{order.delayReason}</SummaryNote>}
          {order.notes && <SummaryNote title={t('operations.delivery.notes')}>{order.notes}</SummaryNote>}
          {order.lastComment && <SummaryNote title={t('operations.delivery.lastComment')}>{order.lastComment}</SummaryNote>}
        </SummaryCard>

        {/* The workers, then the approval's history under them. */}
        <Stack spacing={`${tokens.gap}px`} sx={{ minWidth: 0 }}>
        <Box sx={{ ...card, p: 2.25, minWidth: 0 }}>
          <SectionTitle icon={<GroupsOutlinedIcon />} title={t('operations.delivery.tabs.workers', { count: order.lines.length })} />
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
                    '& .MuiTableRow-root': { background: recordTones.delivery.dark },
                    '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': {
                      bgcolor: 'transparent',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 12.5,
                      borderBottom: 0,
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
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 2, fontSize: 12.5, color: tokens.gray500 }}>
            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
            {o.source === 'Crm' ? t('operations.delivery.crmNote') : t('operations.delivery.parallelNote')}
          </Stack>
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
      {amending && <DeliveryAmendDialog order={order} onClose={() => setAmending(false)} onSaved={() => void run(async () => setAmending(false))} />}
      {cancelingApproved !== null && (
        <Dialog open onClose={() => setCancelingApproved(null)} fullWidth maxWidth="sm">
          <DialogTitle>{t('operations.delivery.amend.cancelTitle', { no: o.orderNo })}</DialogTitle>
          <DialogContent dividers>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('operations.delivery.amend.cancelHint')}
            </Alert>
            <TextField required label={t('operations.delivery.amend.reason')} value={cancelingApproved} onChange={(e) => setCancelingApproved(e.target.value)} fullWidth multiline minRows={2} slotProps={{ htmlInput: { maxLength: 500 } }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelingApproved(null)}>{t('common.close')}</Button>
            <Button
              variant="contained"
              color="error"
              disabled={busy || !cancelingApproved.trim()}
              onClick={() =>
                void run(async () => {
                  await operationsApi.cancelApproved(o.id, cancelingApproved.trim());
                  setCancelingApproved(null);
                })
              }
            >
              {t('operations.delivery.amend.cancelAction')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {wizard && (
        <DeliveryOrderWizard
          id={o.id}
          onClose={() => (editing ? navigate(`/operations/delivery-orders/${o.id}`) : setWizard(false))}
          onSaved={(_, failed) => {
            if (editing) {
              navigate(`/operations/delivery-orders/${o.id}${failed ? `?error=errors.${failed.replace('.', '_')}` : ''}`);
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
 * Changing a delivered order (its own permission): the receiver and the notes, and each worker's start of work and
 * monthly price (a new price is a special price with its reason), with the reason for the change. The work periods
 * follow on the server.
 */
function DeliveryAmendDialog({ order, onClose, onSaved }: { order: DeliveryDetail; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const o = order.summary;
  const [receiverName, setReceiverName] = useState(o.receiverName);
  const [receiverTitle, setReceiverTitle] = useState(order.receiverTitle ?? '');
  const [notes, setNotes] = useState(order.notes ?? '');
  const [lines, setLines] = useState(order.lines.map((l) => ({ lineId: l.id, name: l.name, workerNo: l.workerNo, startedOn: l.startedOn ?? '', price: String(l.totalPrice), was: l.totalPrice, specialReason: '' })));
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (i: number, change: Partial<(typeof lines)[number]>) => setLines((all) => all.map((l, n) => (n === i ? { ...l, ...change } : l)));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await operationsApi.amend(o.id, {
        receiverName: receiverName.trim(),
        receiverTitle: receiverTitle.trim() || null,
        notes: notes.trim() || null,
        lines: lines.map((l) => ({ lineId: l.lineId, startedOn: l.startedOn, totalPrice: Number(l.price) || 0, specialReason: l.specialReason.trim() || null })),
        amendReason: why.trim(),
      });
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('operations.delivery.amend.title', { no: o.orderNo })}</DialogTitle>
      <DialogContent dividers>
        <Stack sx={{ gap: 2 }}>
          <Alert severity="info">{t('operations.delivery.amend.hint')}</Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
            <TextField required label={t('operations.delivery.amend.receiver')} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} sx={{ flex: 1 }} />
            <TextField label={t('operations.delivery.amend.receiverTitle')} value={receiverTitle} onChange={(e) => setReceiverTitle(e.target.value)} sx={{ flex: 1 }} />
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('operations.delivery.amend.worker')}</TableCell>
                  <TableCell>{t('operations.delivery.amend.startedOn')}</TableCell>
                  <TableCell>{t('operations.delivery.amend.price')}</TableCell>
                  <TableCell>{t('operations.delivery.amend.specialReason')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={l.lineId}>
                    <TableCell>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                        <bdi>{l.name}</bdi>
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                        <bdi>{l.workerNo}</bdi>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField size="small" type="date" value={l.startedOn} onChange={(e) => set(i, { startedOn: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" type="number" value={l.price} onChange={(e) => set(i, { price: e.target.value })} slotProps={{ htmlInput: { min: 0, step: 0.01 } }} sx={{ width: 130 }} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" disabled={Number(l.price) === l.was} required={Number(l.price) !== l.was} value={l.specialReason} onChange={(e) => set(i, { specialReason: e.target.value })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TextField label={t('operations.delivery.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
          <TextField required label={t('operations.delivery.amend.reason')} value={why} onChange={(e) => setWhy(e.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 500 } }} />
          {error && <Alert severity="error">{t(error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
        <Button variant="contained" disabled={busy || !why.trim() || !receiverName.trim() || lines.some((l) => !l.startedOn)} onClick={() => void save()}>
          {t('operations.delivery.amend.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
