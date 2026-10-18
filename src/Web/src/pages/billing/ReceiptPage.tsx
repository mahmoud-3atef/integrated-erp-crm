import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
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
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { receivablesApi, type ReceiptDetail } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { AttachmentsDialog } from '../../components/AttachmentsDialog';
import { PillTabs } from '../../components/ui';
import { ApprovalBar, ApprovalLog, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from '../operations/delivery';
import { ReceiptStatusBadge } from './receipts';

function Tile({ label, value, tone = tokens.navy800, foot }: { label: string; value: ReactNode; tone?: string; foot?: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50 }}>
      <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 19, fontWeight: 800, color: tone, lineHeight: 1.3 }}>{value}</Typography>
      {foot && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{foot}</Typography>}
    </Box>
  );
}

/** A receipt voucher: the payment, how it pays the project's invoices, its proof, and its review. */
export function ReceiptPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const [r, setR] = useState<ReceiptDetail | null>(null);
  const [tab, setTab] = useState<'allocations' | 'approval'>('allocations');
  const [files, setFiles] = useState(false);
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

  return (
    <Box>
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>
              {t('receipts.voucher')} · <b dir="ltr">{r.receiptNo ?? t('receipts.noNumber')}</b>
            </Typography>
            <Typography component="h1" sx={{ fontSize: 21, fontWeight: 800, color: tokens.navy800 }}>
              {r.projectName}
            </Typography>
            <Typography sx={{ fontSize: 13, color: tokens.gray600 }}>
              {t('commercial.col.customer')}: {r.customerName ?? '—'} · {t(`receipts.method.${r.method}`)}
              {r.bankAccountName && ` · ${r.bankAccountName}`}
              {r.reference && (
                <>
                  {' · '}
                  {t('receipts.reference')}: <span dir="ltr">{r.reference}</span>
                </>
              )}
            </Typography>
          </Box>
          <Stack sx={{ alignItems: { md: 'flex-end' }, gap: 0.75 }}>
            <ReceiptStatusBadge status={r.status} />
            <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
              {r.approvedAt
                ? t('receipts.approvedBy', { name: r.approvedByName ?? '—', at: new Date(r.approvedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) })
                : t('invoices.createdBy', { name: r.createdByName, at: new Date(r.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) })}
            </Typography>
          </Stack>
          <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/billing/receipts')}>
            {t('common.back')}
          </Button>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.25, mt: 2 }}>
          <Tile label={t('receipts.col.date')} value={date(r.receiptDate)} />
          <Tile label={t('receipts.col.amount')} value={sar(r.amount)} tone={tokens.teal} />
          <Tile label={t('receipts.allocated')} value={sar(r.allocated)} />
          <Tile label={t('receipts.toCredit')} value={sar(r.unallocated)} tone={r.unallocated > 0 ? '#2b7bd9' : tokens.gray500} />
        </Box>

        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.25, mt: 2 }}>
          {r.canEdit && (
            <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy} onClick={() => void run(() => receivablesApi.submit(r.id))}>
              {t('receipts.submit')}
            </Button>
          )}
          {canRun && <RunProcessButton screen="billing.receipt" recordId={r.id} title={`${t('receipts.voucher')} — ${r.projectName}`} onStarted={() => void reload().then(() => approval.reload())} />}
          {r.canEdit && (
            <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/billing/receipts/${r.id}/edit`)}>
              {t('receipts.edit')}
            </Button>
          )}
          {r.canAllocate && (
            <Button variant="outlined" startIcon={<AutoFixHighOutlinedIcon />} disabled={busy} onClick={() => void run(() => receivablesApi.allocate(r.id))}>
              {t('receipts.allocateRemainder')}
            </Button>
          )}
          <Button startIcon={<AttachFileOutlinedIcon />} onClick={() => setFiles(true)}>
            {t('receipts.proof')}
          </Button>
          <Button startIcon={<ReceiptLongOutlinedIcon />} onClick={() => navigate(`/billing/statements/${r.projectId}`)}>
            {t('receipts.statement')}
          </Button>
          {r.canEdit && (
            <Button color="error" startIcon={<DeleteOutlineIcon />} disabled={busy} onClick={() => setDeleting(true)}>
              {t('receipts.delete')}
            </Button>
          )}
        </Stack>
      </Box>

      <ErrorMessage messageKey={error} />
      {r.notes && (
        <Alert severity="info" sx={{ mb: `${tokens.gap}px` }}>
          {t('receipts.notes')}: {r.notes}
        </Alert>
      )}
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

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }}>
        <PillTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'allocations', label: t('receipts.tabs.allocations', { count: r.allocations.length }) },
            ...(r.approval ? [{ value: 'approval' as const, label: t('operations.delivery.tabs.approval') }] : []),
          ]}
        />
        {tab === 'allocations' &&
          (r.allocations.length === 0 ? (
            <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('receipts.noAllocations')}</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('receipts.col.item')}</TableCell>
                    <TableCell>{t('receipts.col.due')}</TableCell>
                    <TableCell align="center">{t('receipts.col.allocate')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {r.allocations.map((a) => (
                    <TableRow
                      key={`${a.kind}:${a.targetId}`}
                      hover
                      sx={{ cursor: a.kind === 'OpeningBalance' ? 'default' : 'pointer' }}
                      onClick={() => a.kind !== 'OpeningBalance' && navigate(`/billing/invoices/${a.targetId}`)}
                    >
                      <TableCell>
                        <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                          {a.number}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t(`receipts.kind.${a.kind}`)}</Typography>
                      </TableCell>
                      <TableCell>{a.dueDate ? date(a.dueDate) : '—'}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                        {sar(a.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ))}
        {tab === 'approval' && r.approval && <ApprovalLog status={r.approval} detail={approval.detail} />}
      </Box>

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
    </Box>
  );
}
