import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';
import { keyframes } from '@emotion/react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
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
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { receivablesApi, type ProjectOpen, type ReceiptDetail } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { AttachmentsDialog } from '../../components/AttachmentsDialog';
import { recordTones, SectionTitle } from '../../components/RecordLayout';
import { ApprovalBar, ApprovalFeedLog, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from '../operations/delivery';
import { ReceiptStatusBadge } from './receipts';
import { useCrumb } from '../../app/breadcrumbs';
import { ReceiptDialog } from './ReceiptDialog';

const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };

const stampIn = keyframes`
  0% { opacity: 0; transform: rotate(-12deg) scale(1.6); }
  70% { opacity: 1; transform: rotate(-12deg) scale(.94); }
  100% { opacity: 1; transform: rotate(-12deg) scale(1); }
`;

/** The approval stamp, as on a paper voucher: who approved it and when, slanted over the card. */
function Stamp({ name, at }: { name: string; at: string }) {
  const { t } = useTranslation();
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        zIndex: 2,
        insetInlineEnd: 14,
        top: 12,
        transform: 'rotate(-12deg)',
        border: '3px double #1f9d55',
        color: '#1f9d55',
        bgcolor: 'rgba(255,255,255,.94)',
        borderRadius: '12px',
        px: 2,
        py: 0.5,
        textAlign: 'center',
        boxShadow: '0 6px 16px rgba(0,0,0,.12)',
        animation: `${stampIn} .45s cubic-bezier(.2,.8,.2,1) both`,
      }}
    >
      <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>{t('receipts.stamp')}</Typography>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700 }}>
        {name} · <span dir="ltr">{at}</span>
      </Typography>
    </Box>
  );
}

/** A receipt voucher: the money received as a bank card (stamped once approved), where it went, and its review. */
export function ReceiptPage({ editing = false }: { editing?: boolean } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const [r, setR] = useState<ReceiptDetail | null>(null);
  useCrumb(r?.receiptNo, `/billing/receipts/${id}`);
  const [files, setFiles] = useState(false);
  const [dialog, setDialog] = useState(editing);
  const [allocating, setAllocating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approval = useRecordApproval(r?.approval?.instanceId);

  const reload = useCallback(async () => {
    try {
      setR(await receivablesApi.receipt(id!));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!r) {
    return <ErrorMessage messageKey={error} />;
  }

  const run = async (action: () => Promise<unknown>) => {
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

  const canRun = (!r.awaitingApproval && r.canEdit) || approval.detail?.summary.status === 'Failed';
  const look = recordTones.receipt;
  const approved = r.status === 'Approved';
  const share = r.amount > 0 ? Math.round((r.allocated / r.amount) * 100) : 0;
  // What is left on an item after this receipt: once approved the ledger already counts it.
  const leftOf = (a: ReceiptDetail['allocations'][number]) => (a.itemOutstanding === null ? null : approved ? a.itemOutstanding : Math.max(0, a.itemOutstanding - a.amount));
  const stamp = (at: string) => new Date(at).toLocaleDateString('en-CA').replaceAll('-', '/');

  return (
    <Box>
      {/* The voucher's title and number, in red as printed. */}
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 2 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.75, flex: 1, minWidth: 0 }}>
          <Box sx={{ flex: '0 0 auto', width: 52, height: 52, borderRadius: '15px', display: 'grid', placeItems: 'center', color: '#fff', background: look.dark, '& svg': { fontSize: 27 } }}>
            <PaymentsOutlinedIcon />
          </Box>
          <Box>
            <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800, color: '#0a5752', lineHeight: 1.2 }}>
              {t('receipts.voucher')}
            </Typography>
            <Typography dir="ltr" sx={{ fontSize: 24, fontWeight: 800, color: '#c0392b', letterSpacing: '.5px', lineHeight: 1.2, textAlign: 'start', fontVariantNumeric: 'tabular-nums' }}>
              {r.receiptNo ?? t('receipts.noNumber')}
            </Typography>
          </Box>
          <ReceiptStatusBadge status={r.status} />
        </Stack>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {r.canEdit && (
            <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy} onClick={() => void run(() => receivablesApi.submit(r.id))} sx={{ background: look.dark }}>
              {t('receipts.submit')}
            </Button>
          )}
          {canRun && <RunProcessButton screen="billing.receipt" recordId={r.id} title={`${t('receipts.voucher')} — ${r.projectName}`} onStarted={() => void reload().then(() => approval.reload())} />}
          {r.canEdit && (
            <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setDialog(true)}>
              {t('receipts.edit')}
            </Button>
          )}
          <Button variant="outlined" startIcon={<AttachFileOutlinedIcon />} onClick={() => setFiles(true)}>
            {t('receipts.proof')}
          </Button>
          <Button variant="outlined" startIcon={<ReceiptLongOutlinedIcon />} onClick={() => navigate(`/billing/statements/${r.projectId}`)}>
            {t('receipts.statement')}
          </Button>
          {r.canEdit && (
            <Button color="error" startIcon={<DeleteOutlineIcon />} disabled={busy} onClick={() => setDeleting(true)}>
              {t('receipts.delete')}
            </Button>
          )}
          <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/billing/receipts')}>
            {t('common.back')}
          </Button>
        </Stack>
      </Stack>

      <ErrorMessage messageKey={error} />
      {r.lastComment && r.status === 'Returned' && (
        <Alert severity="warning" sx={{ mb: `${tokens.gap}px` }}>
          {t('operations.delivery.lastComment')}: {r.lastComment}
        </Alert>
      )}
      {r.approval && (
        <ApprovalBar
          status={r.approval}
          detail={approval.detail}
          onChanged={() => {
            void approval.reload();
            void reload();
          }}
        />
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '380px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }}>
        {/* The money received, as a bank card. */}
        <Stack spacing={`${tokens.gap}px`}>
          <Box sx={{ position: 'relative' }}>
            <Box
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '22px',
                p: 2.75,
                color: '#fff',
                background: 'linear-gradient(135deg, #043b38 0%, #0b6e66 50%, #17a596 100%)',
                boxShadow: '0 18px 40px rgba(6,90,82,.32)',
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                '&::before': { content: '""', position: 'absolute', width: 260, height: 260, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.07)', top: -120, insetInlineEnd: -80 },
                '&::after': { content: '""', position: 'absolute', width: 180, height: 180, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.06)', bottom: -90, insetInlineStart: -40 },
              }}
            >
              <Stack direction="row" sx={{ position: 'relative', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, opacity: 0.92, '& svg': { fontSize: 18 } }}>
                  {r.method === 'Cash' ? <PaymentsOutlinedIcon /> : <AccountBalanceOutlinedIcon />}
                  {t(`receipts.method.${r.method}`)}
                </Stack>
              </Stack>
              {r.bankAccountName && (
                <Typography sx={{ position: 'relative', mt: 0.25, fontSize: 13, fontWeight: 800, maxWidth: approved ? 'calc(100% - 200px)' : '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.bankAccountName}
                </Typography>
              )}
              <Box sx={{ position: 'relative', mt: 2.25 }}>
                <Typography sx={{ fontSize: 12, opacity: 0.8 }}>{t('receipts.received')}</Typography>
                <Typography sx={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
                  {sar(r.amount)}
                  <Box component="span" sx={{ fontSize: 15, opacity: 0.85, marginInlineStart: 1 }}>
                    {t('operations.delivery.sarUnit')}
                  </Box>
                </Typography>
              </Box>
              {r.reference && (
                <Typography dir="ltr" sx={{ position: 'relative', mt: 1.5, fontSize: 16, letterSpacing: '2.5px', opacity: 0.95, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
                  {r.reference}
                </Typography>
              )}
              <Box sx={{ flex: 1 }} />
              <Stack direction="row" sx={{ position: 'relative', justifyContent: 'space-between', gap: 2, mt: 1.75, fontSize: 12 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11.5, opacity: 0.75 }}>{t('receipts.from')}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customerName ?? r.projectName}</Typography>
                </Box>
                <Box sx={{ flex: '0 0 auto', textAlign: 'end' }}>
                  <Typography sx={{ fontSize: 11.5, opacity: 0.75 }}>{t('receipts.col.date')}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{date(r.receiptDate)}</Typography>
                </Box>
              </Stack>
            </Box>
            {approved && r.approvedAt && <Stamp name={r.approvedByName ?? '—'} at={stamp(r.approvedAt)} />}
          </Box>

          <Box sx={{ ...card, px: 2.25, py: 1 }}>
            {[
              [t('commercial.col.project'), r.projectName],
              [t('receipts.reference'), r.reference ? <span dir="ltr">{r.reference}</span> : '—'],
              [t('receipts.recordedBy'), r.createdByName],
              ...(r.notes ? [[t('receipts.notes'), r.notes]] : []),
            ].map(([label, value], index) => (
              <Stack key={index} direction="row" sx={{ justifyContent: 'space-between', gap: 2, py: 1, fontSize: 13, '&:not(:last-of-type)': { borderBottom: `1px solid ${tokens.gray100}` } }}>
                <Typography sx={{ fontSize: 13, color: tokens.gray500, flex: '0 0 auto' }}>{label}</Typography>
                <Typography component="div" sx={{ fontSize: 13, fontWeight: 800, color: tokens.navy800, textAlign: 'end' }}>
                  {value}
                </Typography>
              </Stack>
            ))}
          </Box>
        </Stack>

        <Stack spacing={`${tokens.gap}px`} sx={{ minWidth: 0 }}>
          {/* Where the money went. */}
          <Box sx={{ ...card, p: 2.5 }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ position: 'relative', width: 92, height: 92, flex: '0 0 auto' }}>
                <CircularProgress variant="determinate" value={100} size={92} thickness={5} sx={{ color: tokens.gray100, position: 'absolute' }} />
                <CircularProgress variant="determinate" value={share} size={92} thickness={5} sx={{ color: look.main, position: 'absolute', '& circle': { strokeLinecap: 'round' } }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('receipts.allocatedShare')}</Typography>
                <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#0a5752', lineHeight: 1.2 }}>{share}%</Typography>
                <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>
                  {t('receipts.allocatedOf', { amount: sar(r.allocated) })}
                  {r.unallocated > 0 && (
                    <Box component="b" sx={{ color: '#b8770a' }}>
                      {' · '}
                      {t('receipts.leftCredit', { amount: sar(r.unallocated) })}
                    </Box>
                  )}
                </Typography>
              </Box>
              {r.canAllocate && (
                <Button variant="outlined" startIcon={<AutoFixHighOutlinedIcon />} disabled={busy} onClick={() => setAllocating(true)} sx={{ color: look.main, borderColor: look.main }}>
                  {t('receipts.allocateRemainder')}
                </Button>
              )}
            </Stack>

            <SectionTitle icon={<SwapVertOutlinedIcon />} title={t('receipts.movements')} />
            {r.allocations.length === 0 && r.unallocated <= 0 && <Typography sx={{ py: 3, textAlign: 'center', color: tokens.gray500 }}>{t('receipts.noAllocations')}</Typography>}
            {r.allocations.map((a) => {
              const left = leftOf(a);
              const full = left !== null && left <= 0.005;
              const tone = full ? { fg: '#1f9d55', bg: '#e7f6ee' } : { fg: '#b8770a', bg: '#fff6e5' };
              return (
                <Stack
                  key={`${a.kind}:${a.targetId}`}
                  direction="row"
                  onClick={() => a.kind !== 'OpeningBalance' && navigate(`/billing/invoices/${a.targetId}`)}
                  sx={{
                    alignItems: 'center',
                    gap: 1.75,
                    py: 1.5,
                    px: 0.5,
                    borderTop: `1px solid ${tokens.gray100}`,
                    cursor: a.kind === 'OpeningBalance' ? 'default' : 'pointer',
                    borderRadius: '10px',
                    '&:hover': a.kind === 'OpeningBalance' ? {} : { bgcolor: tokens.gray50 },
                  }}
                >
                  <Box sx={{ flex: '0 0 auto', width: 40, height: 40, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: tone.bg, color: tone.fg, fontWeight: 800, '& svg': { fontSize: 20 } }}>
                    {full ? <CheckIcon /> : '½'}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13.5, color: tokens.gray500 }}>
                      <Box component="b" dir="ltr" sx={{ color: tokens.navy800 }}>
                        {a.number}
                      </Box>
                      {' · '}
                      {t(`receipts.kind.${a.kind}`)}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>
                      {a.dueDate ? `${t('receipts.dueOn', { date: date(a.dueDate) })} · ` : ''}
                      {left !== null && t('receipts.leftOnItem', { amount: sar(left) })}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'end' }}>
                    <Typography dir="ltr" sx={{ fontSize: 17, fontWeight: 800, color: '#0a5752', fontVariantNumeric: 'tabular-nums' }}>
                      − {sar(a.amount)}
                    </Typography>
                    <Box sx={{ display: 'inline-block', px: 1.1, borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: tone.fg, bgcolor: tone.bg }}>{full ? t('receipts.paidFull') : t('receipts.paidPart')}</Box>
                  </Box>
                </Stack>
              );
            })}
            {r.unallocated > 0 && (
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1.75, py: 1.5, px: 0.5, borderTop: `1px dashed ${tokens.gray300}` }}>
                <Box sx={{ flex: '0 0 auto', width: 40, height: 40, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: tokens.gray100, color: tokens.gray600, '& svg': { fontSize: 20 } }}>
                  <SavingsOutlinedIcon />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.gray600 }}>{t('receipts.creditLeft')}</Typography>
                  <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('receipts.creditLeftHint')}</Typography>
                </Box>
                <Typography dir="ltr" sx={{ fontSize: 17, fontWeight: 800, color: tokens.gray600, fontVariantNumeric: 'tabular-nums' }}>
                  {sar(r.unallocated)}
                </Typography>
              </Stack>
            )}
          </Box>

          {r.approval && (
            <Box sx={{ ...card, p: 2.25 }}>
              <SectionTitle icon={<HistoryOutlinedIcon />} title={t('operations.delivery.tabs.approval')} />
              <ApprovalFeedLog status={r.approval} detail={approval.detail} />
            </Box>
          )}
        </Stack>
      </Box>

      {allocating && (
        <AllocateDialog
          receipt={r}
          onClose={() => setAllocating(false)}
          onDone={() => {
            setAllocating(false);
            void reload();
          }}
        />
      )}
      {files && (
        <AttachmentsDialog title={`${t('receipts.voucher')} ${r.receiptNo ?? ''}`.trim()} ownerType="billing.receipt" ownerId={r.id} canManage={r.canEdit || r.status === 'Approved'} onClose={() => setFiles(false)} />
      )}
      {deleting && (
        <Dialog open onClose={() => setDeleting(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{t('receipts.deleteTitle')}</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: 14 }}>{t('receipts.deleteHint')}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleting(false)}>{t('common.cancel')}</Button>
            <Button
              color="error"
              variant="contained"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  try {
                    await receivablesApi.remove(r.id);
                    navigate('/billing/receipts');
                  } catch (failure) {
                    setError(errorKey(failure));
                    setDeleting(false);
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              {t('receipts.delete')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {dialog && (
        <ReceiptDialog
          id={r.id}
          onClose={() => (editing ? navigate(`/billing/receipts/${r.id}`) : setDialog(false))}
          onSaved={() => {
            if (editing) {
              navigate(`/billing/receipts/${r.id}`);
              return;
            }
            setDialog(false);
            void reload();
          }}
        />
      )}
    </Box>
  );
}

/** An approved receipt's credit put against the project's open invoices: by hand, or filled oldest due first. */
function AllocateDialog({ receipt, onClose, onDone }: { receipt: ReceiptDetail; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const [open, setOpen] = useState<ProjectOpen | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = (kind: string, id: string) => `${kind}:${id}`;

  useEffect(() => {
    receivablesApi
      .open(receipt.projectId)
      .then(setOpen)
      .catch((failure: unknown) => setError(errorKey(failure)));
  }, [receipt.projectId]);

  const items = (open?.items ?? []).filter((i) => i.available > 0);
  const total = Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const over = total > receipt.unallocated + 0.001 || items.some((i) => (Number(amounts[key(i.kind, i.id)]) || 0) > i.available + 0.001);

  const fill = () => {
    let left = receipt.unallocated;
    const next: Record<string, string> = {};
    for (const i of [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
      if (left <= 0) break;
      const take = Math.min(left, i.available);
      next[key(i.kind, i.id)] = String(Math.round(take * 100) / 100);
      left = Math.round((left - take) * 100) / 100;
    }

    setAmounts(next);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await receivablesApi.allocate(
        receipt.id,
        items.map((i) => ({ kind: i.kind, targetId: i.id, amount: Number(amounts[key(i.kind, i.id)]) || 0 })).filter((a) => a.amount > 0),
      );
      onDone();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('receipts.allocateTitle', { amount: sar(receipt.unallocated) })}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        {!open && !error && <LinearProgress sx={{ borderRadius: 2 }} />}
        {open && items.length === 0 && <Alert severity="info">{t('receipts.nothingToAllocate')}</Alert>}
        {items.length > 0 && (
          <>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Typography sx={{ flex: 1, fontSize: 12.5, color: tokens.gray500 }}>{t('receipts.allocateHint')}</Typography>
              <Button size="small" variant="outlined" startIcon={<AutoFixHighOutlinedIcon />} onClick={fill}>
                {t('receipts.autoAllocate')}
              </Button>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('receipts.col.item')}</TableCell>
                    <TableCell>{t('receipts.col.due')}</TableCell>
                    <TableCell align="center">{t('receipts.col.outstanding')}</TableCell>
                    <TableCell align="center" sx={{ width: 170 }}>
                      {t('receipts.col.allocate')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((i) => {
                    const k = key(i.kind, i.id);
                    return (
                      <TableRow key={k}>
                        <TableCell>
                          <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                            {i.number}
                          </Typography>
                          <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t(`receipts.kind.${i.kind}`)}</Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(i.dueDate)}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          {sar(i.available)}
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            size="small"
                            value={amounts[k] ?? ''}
                            error={(Number(amounts[k]) || 0) > i.available + 0.001}
                            onChange={(e) => setAmounts({ ...amounts, [k]: e.target.value.replace(/[^\d.]/g, '') })}
                            slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal', style: { textAlign: 'center' } } }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography sx={{ mt: 1.5, fontSize: 13.5, textAlign: 'end' }}>
              {t('receipts.allocated')}: <b>{sar(total)}</b> · {t('receipts.toCredit')}: <b>{sar(Math.max(0, receipt.unallocated - total))}</b>
            </Typography>
            {over && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {t('errors.validation_receipt_over_item')}
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={busy || total <= 0 || over} onClick={() => void save()}>
          {t('receipts.allocateSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
