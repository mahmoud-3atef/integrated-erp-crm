import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { transfersApi, type TransferDetail, type TransferLine } from '../../api/operations';
import { useCrumb } from '../../app/breadcrumbs';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { recordTones, RecordHero, SectionTitle, SummaryBand, SummaryCard, SummaryFact, SummaryGroup, SummaryNote } from '../../components/RecordLayout';
import { Badge } from '../../components/ui';
import { ApprovalBar, ApprovalFeedLog, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from './delivery';
import { daysBetween, Journey, JourneyLine, WorkerFact, WorkerHead } from './recordParts';
import { TransferStatusBadge } from './transfers';
import { TransferOrderWizard } from './TransferOrderWizard';

const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };

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

/** How the price changes with the move: the difference, green when it rises, red when it falls. */
function PriceChange({ from, to }: { from: number | null; to: number }) {
  if (from === null || from === to) {
    return null;
  }
  const up = to > from;
  return (
    <Box
      component="span"
      sx={{ display: 'inline-block', marginInlineStart: 0.75, px: 0.9, borderRadius: 999, fontSize: 11.5, fontWeight: 800, color: up ? tokens.success : tokens.danger, bgcolor: up ? '#e7f6ee' : '#fdeeee' }}
    >
      {up ? '▲' : '▼'} {sar(Math.abs(to - from))}
    </Box>
  );
}

/**
 * One transfer order. One worker: their card and the way they move (the project they leave, with its price, to the new
 * one, with the new price). Several: the way between the projects, then the workers' table with the old and new
 * prices. Beside them the new project, the value, the date and who receives; the approval's history under them.
 */
export function TransferOrderDetailPage({ editing = false }: { editing?: boolean } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { ar, date } = useCommercialFormat();
  const [order, setOrder] = useState<TransferDetail | null>(null);
  useCrumb(order?.summary.orderNo, `/operations/transfer-orders/${id}`);
  const [wizard, setWizard] = useState(editing);
  const [error, setError] = useState<string | null>(params.get('error'));
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState<string | null>(null);
  const approval = useRecordApproval(order?.approval?.instanceId);

  const reload = useCallback(async () => {
    try {
      setOrder(await transfersApi.get(id!));
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
  const canRun = (!order.awaitingApproval && order.canEdit) || approval.detail?.summary.status === 'Failed';
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

  const single: TransferLine | null = order.lines.length === 1 ? (order.lines[0] ?? null) : null;
  const price = (l: TransferLine) => (
    <>
      {t('operations.transfer.price')}: <b style={{ color: tokens.navy800 }}>{sar(l.totalPrice)}</b>
      <PriceChange from={l.fromTotalPrice} to={l.totalPrice} />
    </>
  );

  return (
    <Box>
      <RecordHero
        tone="transfer"
        icon={<SwapHorizIcon />}
        kind={t('operations.transfer.kind')}
        number={o.orderNo}
        status={<TransferStatusBadge status={o.status} />}
        actions={
          <>
            {order.canEdit && (
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setWizard(true)}>
                {t('common.edit')}
              </Button>
            )}
            {order.canSubmit && (
              <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy} onClick={() => void run(() => transfersApi.submit(o.id))}>
                {t('operations.delivery.submit')}
              </Button>
            )}
            {canRun && (
              <RunProcessButton
                screen="operations.transfer_order"
                recordId={o.id}
                title={`${o.orderNo} — ${o.projectName}`}
                onStarted={() => void reload().then(() => approval.reload())}
              />
            )}
            {order.canCancel && (
              <Button variant="outlined" startIcon={<CancelOutlinedIcon />} onClick={() => setCanceling('')}>
                {t('operations.transfer.cancel')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/operations/transfer-orders')}>
              {t('common.back')}
            </Button>
          </>
        }
      />

      <ErrorMessage messageKey={error} />
      {o.status === 'UnderPreparation' && order.awaitingApproval && (
        <Alert severity="info" sx={{ mb: `${tokens.gap}px` }}>
          {t('operations.transfer.creatorHint')}
        </Alert>
      )}
      {o.status === 'Transferred' && (
        <Alert severity="success" sx={{ mb: `${tokens.gap}px` }}>
          {t('operations.transfer.transferredHint', { date: date(o.transferOn) })}
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
        {/* Where the workers go, read top to bottom. */}
        <SummaryCard>
          <SummaryBand
            tone="transfer"
            label={t('operations.transfer.newProject')}
            value={o.projectName}
            size={21}
            chips={[...(o.customerName ? [{ label: o.customerName }] : []), ...(order.projectManager ? [{ label: `${t('commercial.col.manager')}: ${order.projectManager}` }] : [])]}
          />
          <SummaryGroup title={t('operations.delivery.value')} color={tokens.success}>
            <SummaryFact
              icon={<PaymentsOutlinedIcon />}
              color={tokens.success}
              label={t('operations.transfer.newMonthlyTotal')}
              value={`${sar(o.totalPrice)} ${t('operations.delivery.sarUnit')}`}
              sub={[t('operations.delivery.workersCount', { count: o.workers }), ...(o.specialPrices > 0 ? [t('operations.delivery.specialCount', { count: o.specialPrices })] : [])].join(' · ')}
            />
          </SummaryGroup>
          <SummaryGroup title={t('operations.delivery.dates')} color={recordTones.transfer.main}>
            <SummaryFact icon={<EventOutlinedIcon />} color={recordTones.transfer.main} label={t('operations.transfer.col.transferOn')} value={date(o.transferOn)} />
          </SummaryGroup>
          {order.receiverName && (
            <SummaryGroup title={t('operations.delivery.receiving')} color={tokens.gold}>
              <SummaryFact icon={<BadgeOutlinedIcon />} color={tokens.gold} label={t('operations.transfer.receiverName')} value={order.receiverName} sub={order.receiverTitle} />
            </SummaryGroup>
          )}
          {order.delayReason && <SummaryNote title={t('operations.delivery.delayReason')}>{order.delayReason}</SummaryNote>}
          {order.notes && <SummaryNote title={t('operations.delivery.notes')}>{order.notes}</SummaryNote>}
          {order.lastComment && <SummaryNote title={t('operations.delivery.lastComment')}>{order.lastComment}</SummaryNote>}
        </SummaryCard>

        <Stack spacing={`${tokens.gap}px`} sx={{ minWidth: 0 }}>
          {single ? (
            /* One worker: their card and the way they move. */
            <Box sx={{ ...card, overflow: 'hidden' }}>
              <WorkerHead
                tone="transfer"
                label={t('operations.return.col.worker')}
                name={single.name}
                workerId={single.workerId}
                workerNo={single.workerNo}
                badge={single.isSpecialPrice ? <Badge tone="warning">{t('commercial.prices.status.Special')}</Badge> : single.packageNo ? <Badge tone="success">{single.packageNo}</Badge> : undefined}
                facts={
                  <>
                    <WorkerFact icon={<BadgeOutlinedIcon />} label={t('operations.delivery.col.iqama')} value={single.iqamaNo ?? '—'} ltr />
                    <WorkerFact icon={<EngineeringOutlinedIcon />} label={t('operations.return.profession')} value={(ar ? single.professionAr : single.professionEn) ?? '—'} />
                    <WorkerFact icon={<PublicOutlinedIcon />} label={t('operations.return.nationality')} value={(ar ? single.nationalityAr : single.nationalityEn) ?? '—'} />
                  </>
                }
              />
              <Box sx={{ px: 2.5, pt: 2, pb: 2.5, borderTop: `1px solid ${tokens.gray100}` }}>
                <SectionTitle icon={<RouteOutlinedIcon />} title={t('operations.transfer.journey')} />
                <Journey
                  from={{
                    state: 'Work',
                    label: t('operations.transfer.currentProject'),
                    sub: single.fromProjectName,
                    lines: (
                      <>
                        <JourneyLine label={t('operations.transfer.startedOn')}>{date(single.fromStartedOn)}</JourneyLine>
                        <JourneyLine label={t('operations.transfer.price')}>{single.fromTotalPrice === null ? '—' : sar(single.fromTotalPrice)}</JourneyLine>
                      </>
                    ),
                  }}
                  to={{
                    state: 'Work',
                    label: t('operations.transfer.newProject'),
                    sub: o.projectName,
                    lines: (
                      <>
                        <JourneyLine label={t('operations.transfer.col.transferOn')}>{date(o.transferOn)}</JourneyLine>
                        <div>{price(single)}</div>
                      </>
                    ),
                  }}
                  pill={(() => {
                    const days = daysBetween(single.fromStartedOn, o.transferOn);
                    return days === null ? undefined : t('operations.return.workedDays', { count: days });
                  })()}
                />
              </Box>
            </Box>
          ) : (
            /* Several workers: the way between the projects, then the table. */
            <Box sx={{ ...card, p: 2.25, minWidth: 0 }}>
              <SectionTitle icon={<RouteOutlinedIcon />} title={t('operations.transfer.journey')} />
              <Box sx={{ mb: 2.5 }}>
                <Journey
                  from={{ state: 'Work', label: t('operations.transfer.currentProject'), sub: o.fromProjects }}
                  to={{ state: 'Work', label: t('operations.transfer.newProject'), sub: o.projectName, lines: <JourneyLine label={t('operations.transfer.col.transferOn')}>{date(o.transferOn)}</JourneyLine> }}
                  pill={t('operations.delivery.workersCount', { count: o.workers })}
                />
              </Box>
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
                      '& .MuiTableRow-root': { background: recordTones.transfer.dark },
                      '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': { bgcolor: 'transparent', color: '#fff', fontWeight: 700, fontSize: 12.5, borderBottom: 0, borderRadius: 0 },
                    }}
                  >
                    <TableRow>
                      <TableCell>{t('workforce.col.name')}</TableCell>
                      <TableCell>{t('commercial.prices.col.who')}</TableCell>
                      <TableCell>{t('operations.transfer.col.from')}</TableCell>
                      <TableCell>{t('operations.transfer.oldPrice')}</TableCell>
                      <TableCell>{t('operations.transfer.col.newPrice')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.lines.map((l) => (
                      <TableRow key={l.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/workforce/workers/${l.workerId}?tab=periods`)}>
                        <TableCell sx={{ minWidth: 210 }}>
                          <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                            <Box
                              sx={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: recordTones.transfer.soft, color: recordTones.transfer.main, fontSize: 12, fontWeight: 800 }}
                            >
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
                        <TableCell sx={{ minWidth: 150 }}>
                          {l.fromProjectName ?? '—'}
                          {l.fromStartedOn && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t('operations.transfer.since', { date: date(l.fromStartedOn) })}</Typography>}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: tokens.gray600 }}>{l.fromTotalPrice === null ? '—' : sar(l.fromTotalPrice)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography component="span" sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }}>
                            {sar(l.totalPrice)}
                          </Typography>
                          <PriceChange from={l.fromTotalPrice} to={l.totalPrice} />
                          <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                            {l.isSpecialPrice ? t('commercial.prices.status.Special') : (l.packageNo ?? '')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 2, fontSize: 12.5, color: tokens.gray500 }}>
                <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                {t('operations.transfer.parallelNote')}
              </Stack>
            </Box>
          )}

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
          <DialogTitle>{t('operations.transfer.cancelTitle', { no: o.orderNo })}</DialogTitle>
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
                  await transfersApi.cancel(o.id, canceling.trim() || null);
                  setCanceling(null);
                })
              }
            >
              {t('operations.transfer.cancel')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {wizard && (
        <TransferOrderWizard
          id={o.id}
          onClose={() => (editing ? navigate(`/operations/transfer-orders/${o.id}`) : setWizard(false))}
          onSaved={(_, failed) => {
            if (editing) {
              navigate(`/operations/transfer-orders/${o.id}${failed ? `?error=errors.${failed.replace('.', '_')}` : ''}`);
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
