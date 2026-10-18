import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { invoiceApi, noteComponents, type InvoiceComponent, type InvoiceDetail, type NoteDraft } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { PillTabs } from '../../components/ui';
import { ApprovalBar, ApprovalLog, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday, sar } from '../operations/delivery';
import { InvoiceKindBadge, InvoiceStatusBadge, signed } from './invoices';
import { useCrumb } from '../../app/breadcrumbs';

type Tab = 'items' | 'workers' | 'notes' | 'approval';

function Tile({ label, value, tone = tokens.navy800, foot }: { label: string; value: ReactNode; tone?: string; foot?: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50 }}>
      <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 19, fontWeight: 800, color: tone, lineHeight: 1.3 }}>{value}</Typography>
      {foot && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{foot}</Typography>}
    </Box>
  );
}

/** A customer invoice or note: its totals, the workers attached, its notes, the review and the issue. */
export function InvoicePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  useCrumb(inv?.invoiceNo);
  const [tab, setTab] = useState<Tab>('items');
  const [editing, setEditing] = useState(false);
  const [noting, setNoting] = useState<NoteDraft['kind'] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approval = useRecordApproval(inv?.approval?.instanceId);

  const reload = useCallback(async () => {
    try {
      setInv(await invoiceApi.get(id!));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [id]);

  useEffect(() => {
    setTab('items');
    void reload();
  }, [reload]);

  if (!inv) {
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

  const isInvoice = inv.kind === 'Invoice';
  const workers = new Set(inv.workers.map((w) => w.workerId)).size;
  const canRun = (!inv.awaitingApproval && inv.canEdit) || approval.detail?.summary.status === 'Failed';
  const monthName = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(inv.month));
  const title = `${t(`invoices.kind.${inv.kind}`)} ${inv.invoiceNo ?? ''}`.trim();

  return (
    <Box>
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.5 }}>
              <InvoiceKindBadge kind={inv.kind} />
              <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 800, color: inv.invoiceNo ? tokens.navy800 : tokens.gray500 }}>
                {inv.invoiceNo ?? t('invoices.noNumber')}
              </Typography>
            </Stack>
            <Typography component="h1" sx={{ fontSize: 21, fontWeight: 800, color: tokens.navy800 }}>
              {inv.projectName}
            </Typography>
            <Typography sx={{ fontSize: 13, color: tokens.gray600 }}>
              {t('commercial.col.customer')}: {inv.customer.name} · {t('invoices.monthOf', { month: monthName })} · {t('timesheets.cycle', { from: date(inv.periodFrom), to: date(inv.periodTo) })}
            </Typography>
          </Box>
          <Stack sx={{ alignItems: { md: 'flex-end' }, gap: 0.75 }}>
            <InvoiceStatusBadge status={inv.status} />
            <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
              {inv.issuedAt
                ? t('invoices.issuedBy', { name: inv.issuedByName ?? '—', at: new Date(inv.issuedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) })
                : t('invoices.createdBy', { name: inv.createdByName, at: new Date(inv.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) })}
            </Typography>
          </Stack>
          <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate(`/billing/invoices?month=${inv.month}`)}>
            {t('common.back')}
          </Button>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' }, gap: 1.25, mt: 2 }}>
          <Tile label={t('invoices.tiles.amount')} value={sar(signed(inv.kind, inv.amount))} />
          <Tile label={t('invoices.tiles.vat', { rate: Math.round(inv.vatRate * 100) })} value={sar(signed(inv.kind, inv.vat))} />
          <Tile label={t('invoices.tiles.total')} value={sar(signed(inv.kind, inv.total))} tone={inv.kind === 'CreditNote' ? tokens.danger : tokens.teal} />
          <Tile label={t('invoices.tiles.date')} value={date(inv.invoiceDate)} />
          <Tile label={t('invoices.tiles.due')} value={date(inv.dueDate)} foot={inv.paymentTermDays ? t('invoices.termDays', { days: inv.paymentTermDays }) : t('invoices.dueOnDate')} />
          {inv.status === 'Issued' && inv.kind !== 'CreditNote' ? (
            <Tile
              label={t('invoices.tiles.outstanding')}
              value={sar(inv.outstanding)}
              tone={inv.outstanding > 0 ? tokens.danger : '#1f9d55'}
              foot={inv.paid > 0 ? t('invoices.tiles.paid', { amount: sar(inv.paid) }) : t('invoices.tiles.notPaid')}
            />
          ) : isInvoice ? (
            <Tile label={t('invoices.tiles.net')} value={sar(inv.netAmount)} foot={t('invoices.tiles.workers', { count: workers })} />
          ) : (
            <Tile label={t('invoices.tiles.original')} value={<span dir="ltr">{inv.originalInvoiceNo}</span>} />
          )}
        </Box>

        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.25, mt: 2 }}>
          {inv.canSubmit && (
            <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy} onClick={() => void run(() => invoiceApi.submit(inv.id))}>
              {t('invoices.submit')}
            </Button>
          )}
          {canRun && <RunProcessButton screen="billing.invoice" recordId={inv.id} title={title} onStarted={() => void reload().then(() => approval.reload())} />}
          {inv.canEdit && (
            <Button variant="outlined" startIcon={<EditOutlinedIcon />} disabled={busy} onClick={() => setEditing(true)}>
              {t('invoices.editTerms')}
            </Button>
          )}
          {inv.canNote && (
            <>
              <Button variant="outlined" color="error" startIcon={<RemoveCircleOutlineIcon />} disabled={busy} onClick={() => setNoting('CreditNote')}>
                {t('invoices.newCredit')}
              </Button>
              <Button variant="outlined" startIcon={<AddCircleOutlineIcon />} disabled={busy} onClick={() => setNoting('DebitNote')}>
                {t('invoices.newDebit')}
              </Button>
            </>
          )}
          <Button startIcon={<PrintOutlinedIcon />} component="a" href={`/billing/invoices/${inv.id}/print`} target="_blank" rel="noopener">
            {t('invoices.printDoc')}
          </Button>
          {isInvoice && (
            <Button startIcon={<FileDownloadOutlinedIcon />} component="a" href={invoiceApi.attachmentUrl(inv.id)} download>
              {t('invoices.attachment')}
            </Button>
          )}
          <Button startIcon={<ReceiptLongOutlinedIcon />} onClick={() => navigate(`/billing/statements/${inv.projectId}`)}>
            {t('receipts.statement')}
          </Button>
          {inv.timesheetId && (
            <Button startIcon={<FactCheckOutlinedIcon />} onClick={() => navigate(`/billing/timesheets/${inv.timesheetId}`)}>
              {t('invoices.openTimesheet', { number: inv.timesheetNo })}
            </Button>
          )}
          {inv.originalInvoiceId && (
            <Button startIcon={<ReceiptLongOutlinedIcon />} onClick={() => navigate(`/billing/invoices/${inv.originalInvoiceId}`)}>
              {t('invoices.openOriginal', { number: inv.originalInvoiceNo })}
            </Button>
          )}
          {inv.canDelete && (
            <Button color="error" startIcon={<DeleteOutlineIcon />} disabled={busy} onClick={() => setDeleting(true)}>
              {t('invoices.delete')}
            </Button>
          )}
        </Stack>
      </Box>

      <ErrorMessage messageKey={error} />
      {inv.warnings.map((w) => (
        <Alert key={w} severity="warning" sx={{ mb: `${tokens.gap}px` }}>
          {t(`invoices.warnings.${w}`)}
        </Alert>
      ))}
      {inv.status === 'Issued' && (
        <Alert severity="success" sx={{ mb: `${tokens.gap}px` }}>
          {t('invoices.issuedHint')}
        </Alert>
      )}
      {inv.reason && (
        <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: `${tokens.gap}px` }}>
          {t('invoices.reason')}: {inv.reason}
        </Alert>
      )}
      {inv.lastComment && inv.status === 'Returned' && (
        <Alert severity="info" sx={{ mb: `${tokens.gap}px` }}>
          {t('operations.delivery.lastComment')}: {inv.lastComment}
        </Alert>
      )}
      {inv.approval && (
        <ApprovalBar
          status={inv.approval}
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
            { value: 'items', label: t('invoices.tabs.items') },
            ...(isInvoice ? [{ value: 'workers' as const, label: t('invoices.tabs.workers', { count: inv.workers.length }) }] : []),
            ...(isInvoice ? [{ value: 'notes' as const, label: t('invoices.tabs.notes', { count: inv.notes.length }) }] : []),
            ...(inv.approval ? [{ value: 'approval' as const, label: t('operations.delivery.tabs.approval') }] : []),
          ]}
        />
        {tab === 'items' && <ItemsTab inv={inv} />}
        {tab === 'workers' && <WorkersTab inv={inv} />}
        {tab === 'notes' && <NotesTab inv={inv} />}
        {tab === 'approval' && inv.approval && <ApprovalLog status={inv.approval} detail={approval.detail} />}
      </Box>

      {editing && (
        <EditDialog
          inv={inv}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void reload();
          }}
        />
      )}
      {noting && (
        <NoteDialog
          inv={inv}
          kind={noting}
          onClose={() => setNoting(null)}
          onMade={(noteId) => {
            setNoting(null);
            navigate(`/billing/invoices/${noteId}`);
          }}
        />
      )}
      {deleting && (
        <Dialog open onClose={() => setDeleting(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{t('invoices.deleteTitle')}</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: 14 }}>{t('invoices.deleteHint')}</Typography>
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
                    await invoiceApi.remove(inv.id);
                    navigate(inv.timesheetId ? `/billing/timesheets/${inv.timesheetId}` : inv.originalInvoiceId ? `/billing/invoices/${inv.originalInvoiceId}` : '/billing/invoices');
                  } catch (failure) {
                    setError(errorKey(failure));
                    setDeleting(false);
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              {t('invoices.delete')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

function ItemsTab({ inv }: { inv: InvoiceDetail }) {
  const { t } = useTranslation();
  const lines = inv.items.filter((i) => i.component !== 'Discount');
  const discount = inv.items.find((i) => i.component === 'Discount');
  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5, fontSize: 12.5, color: tokens.gray500 }}>
        <InfoOutlinedIcon sx={{ fontSize: 16 }} />
        {t(inv.kind === 'Invoice' ? 'invoices.itemsHint' : 'invoices.noteItemsHint')}
      </Stack>
      <Box sx={{ maxWidth: 620 }}>
        {lines.map((i) => (
          <Stack key={i.lineNo} direction="row" sx={{ justifyContent: 'space-between', gap: 2, py: 0.75, borderBottom: `1px dashed ${tokens.gray200}` }}>
            <Box>
              <Typography sx={{ fontSize: 13.5, color: tokens.gray700 }}>{t(`invoices.components.${i.component}`)}</Typography>
              {i.description && <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{i.description}</Typography>}
            </Box>
            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{sar(i.amount)}</Typography>
          </Stack>
        ))}
        {discount && (
          <Stack direction="row" sx={{ justifyContent: 'space-between', py: 0.75, borderBottom: `1px dashed ${tokens.gray200}` }}>
            <Typography sx={{ fontSize: 13.5, color: tokens.gray700 }}>{t('invoices.components.Discount')}</Typography>
            <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: tokens.danger }}>{sar(discount.amount)}</Typography>
          </Stack>
        )}
        <Stack direction="row" sx={{ justifyContent: 'space-between', py: 1, mt: 0.5 }}>
          <Typography sx={{ fontWeight: 800 }}>{t('timesheets.invoice.amount')}</Typography>
          <Typography sx={{ fontWeight: 800 }}>{sar(inv.amount)}</Typography>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between', py: 0.5 }}>
          <Typography>{t('timesheets.invoice.vat', { rate: Math.round(inv.vatRate * 100) })}</Typography>
          <Typography sx={{ fontWeight: 700 }}>{sar(inv.vat)}</Typography>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between', py: 1.25, px: 1.5, mt: 1, borderRadius: `${tokens.radius}px`, bgcolor: inv.kind === 'CreditNote' ? tokens.danger : tokens.navy700, color: '#fff' }}>
          <Typography sx={{ fontWeight: 800 }}>{t(`invoices.totalOf.${inv.kind}`)}</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{sar(inv.total)}</Typography>
        </Stack>
        {inv.remarks && <Typography sx={{ mt: 2, fontSize: 13, color: tokens.gray600 }}>{t('invoices.remarks')}: {inv.remarks}</Typography>}
      </Box>
    </>
  );
}

function WorkersTab({ inv }: { inv: InvoiceDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ar, date } = useCommercialFormat();
  const sum = (pick: (w: InvoiceDetail['workers'][number]) => number) => sar(inv.workers.reduce((s, w) => s + pick(w), 0));
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('workforce.col.name')}</TableCell>
            <TableCell>{t('timesheets.col.period')}</TableCell>
            <TableCell align="center">{t('timesheets.col.days')}</TableCell>
            <TableCell align="center">{t('timesheets.col.price')}</TableCell>
            <TableCell align="center">{t('invoices.col.salary')}</TableCell>
            <TableCell align="center">{t('invoices.col.fees')}</TableCell>
            <TableCell align="center">{t('invoices.col.adjustments')}</TableCell>
            <TableCell align="center">{t('invoices.col.amount')}</TableCell>
            <TableCell align="center">{t('invoices.col.total')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {inv.workers.map((w, n) => {
            const adjustments = w.overtime + w.clientAdditions - w.clientDeductions - w.customerLoans + w.otherCosts + w.gosi;
            return (
              <TableRow key={`${w.workerId}-${n}`} hover>
                <TableCell sx={{ minWidth: 180, cursor: 'pointer' }} onClick={() => navigate(`/workforce/workers/${w.workerId}?tab=periods`)}>
                  <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                    {w.name}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                    <span dir="ltr">{w.workerNo}</span> · {(ar ? w.professionAr : w.professionEn) ?? '—'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>
                  {date(w.lineFrom)} – {date(w.lineTo)}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  {sar(w.workDays)}
                  {w.absenceDays > 0 && <Typography sx={{ fontSize: 11, color: tokens.danger }}>{t('invoices.absentDays', { days: sar(w.absenceDays) })}</Typography>}
                </TableCell>
                <TableCell align="center">{sar(w.monthlyPrice)}</TableCell>
                <TableCell align="center">{sar(w.dueSalary - w.absenceAmount)}</TableCell>
                <TableCell align="center">{sar(w.dueFees)}</TableCell>
                <TableCell align="center" sx={{ color: adjustments < 0 ? tokens.danger : undefined }}>
                  {adjustments === 0 ? '—' : sar(adjustments)}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                  {sar(w.amount)}
                </TableCell>
                <TableCell align="center">{sar(w.total)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow sx={{ '& td': { fontWeight: 800, color: tokens.navy800, fontSize: 13 } }}>
            <TableCell colSpan={2}>{t('timesheets.pay.total', { count: new Set(inv.workers.map((w) => w.workerId)).size })}</TableCell>
            <TableCell align="center">{sum((w) => w.workDays)}</TableCell>
            <TableCell />
            <TableCell align="center">{sum((w) => w.dueSalary - w.absenceAmount)}</TableCell>
            <TableCell align="center">{sum((w) => w.dueFees)}</TableCell>
            <TableCell align="center">{sum((w) => w.overtime + w.clientAdditions - w.clientDeductions - w.customerLoans + w.otherCosts + w.gosi)}</TableCell>
            <TableCell align="center">{sum((w) => w.amount)}</TableCell>
            <TableCell align="center">{sum((w) => w.total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>
  );
}

function NotesTab({ inv }: { inv: InvoiceDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { date } = useCommercialFormat();
  if (inv.notes.length === 0) {
    return <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('invoices.noNotes')}</Typography>;
  }

  return (
    <>
      <Typography sx={{ fontSize: 13, color: tokens.gray600, mb: 1.5 }}>{t('invoices.netHint', { amount: sar(inv.amount), net: sar(inv.netAmount) })}</Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('invoices.col.number')}</TableCell>
              <TableCell>{t('invoices.col.date')}</TableCell>
              <TableCell align="center">{t('invoices.col.amount')}</TableCell>
              <TableCell align="center">{t('invoices.col.total')}</TableCell>
              <TableCell>{t('invoices.col.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inv.notes.map((n) => (
              <TableRow key={n.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/billing/invoices/${n.id}`)}>
                <TableCell>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                    <InvoiceKindBadge kind={n.kind} />
                    <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>
                      {n.invoiceNo ?? t('invoices.noNumber')}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>{date(n.invoiceDate)}</TableCell>
                <TableCell align="center">{sar(signed(n.kind, n.amount))}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, color: n.kind === 'CreditNote' ? tokens.danger : tokens.navy800 }}>
                  {sar(signed(n.kind, n.total))}
                </TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={n.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

function EditDialog({ inv, onClose, onSaved }: { inv: InvoiceDetail; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [invoiceDate, setInvoiceDate] = useState(inv.invoiceDate);
  const [term, setTerm] = useState(inv.paymentTermDays === null ? '' : String(inv.paymentTermDays));
  const [remarks, setRemarks] = useState(inv.remarks ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('invoices.editTerms')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField sx={{ flex: 1 }} type="date" label={t('invoices.col.date')} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField
              sx={{ flex: 1 }}
              label={t('invoices.paymentTerm')}
              value={term}
              onChange={(e) => setTerm(e.target.value.replace(/[^\d]/g, ''))}
              helperText={t('invoices.paymentTermHint')}
              slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric', maxLength: 3 } }}
            />
          </Stack>
          <TextField label={t('invoices.remarks')} value={remarks} onChange={(e) => setRemarks(e.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 1000 } }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={busy || !invoiceDate}
          onClick={() => {
            setBusy(true);
            setError(null);
            invoiceApi
              .edit(inv.id, { invoiceDate, paymentTermDays: term === '' ? null : Number(term), remarks: remarks.trim() || null })
              .then(onSaved)
              .catch((failure: unknown) => setError(errorKey(failure)))
              .finally(() => setBusy(false));
          }}
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface NoteLine {
  component: InvoiceComponent;
  description: string;
  amount: string;
}

function NoteDialog({ inv, kind, onClose, onMade }: { inv: InvoiceDetail; kind: NoteDraft['kind']; onClose: () => void; onMade: (id: string) => void }) {
  const { t } = useTranslation();
  const [noteDate, setNoteDate] = useState(isoToday());
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<NoteLine[]>([{ component: 'Salary', description: '', amount: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const vat = Math.round(amount * inv.vatRate * 100) / 100;
  const over = kind === 'CreditNote' && amount > inv.creditable;
  const change = (n: number, patch: Partial<NoteLine>) => setLines(lines.map((l, i) => (i === n ? { ...l, ...patch } : l)));

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t(`invoices.noteTitle.${kind}`, { number: inv.invoiceNo })}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Typography sx={{ fontSize: 12.5, color: tokens.gray500, mb: 2 }}>{t(`invoices.noteHint.${kind}`, { creditable: sar(inv.creditable) })}</Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField sx={{ width: { sm: 200 } }} type="date" label={t('invoices.col.date')} value={noteDate} onChange={(e) => setNoteDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField sx={{ flex: 1 }} required label={t('invoices.reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 1000 } }} />
          </Stack>
          {lines.map((l, n) => (
            <Stack key={n} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
              <TextField select sx={{ width: { sm: 210 } }} label={t('invoices.component')} value={l.component} onChange={(e) => change(n, { component: e.target.value as InvoiceComponent })}>
                {noteComponents.map((c) => (
                  <MenuItem key={c} value={c}>
                    {t(`invoices.components.${c}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField sx={{ flex: 1 }} label={t('invoices.description')} value={l.description} onChange={(e) => change(n, { description: e.target.value })} slotProps={{ htmlInput: { maxLength: 300 } }} />
              <TextField
                sx={{ width: { sm: 150 } }}
                label={t('invoices.col.amount')}
                value={l.amount}
                onChange={(e) => change(n, { amount: e.target.value.replace(/[^\d.]/g, '') })}
                slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }}
              />
              <IconButton disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, i) => i !== n))}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Box>
            <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={() => setLines([...lines, { component: 'Salary', description: '', amount: '' }])}>
              {t('invoices.addLine')}
            </Button>
          </Box>
          <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 3, fontSize: 13.5 }}>
            <span>
              {t('timesheets.invoice.amount')}: <b>{sar(amount)}</b>
            </span>
            <span>
              {t('invoices.tiles.vat', { rate: Math.round(inv.vatRate * 100) })}: <b>{sar(vat)}</b>
            </span>
            <span style={{ color: kind === 'CreditNote' ? tokens.danger : tokens.navy800 }}>
              {t('invoices.tiles.total')}: <b>{sar(amount + vat)}</b>
            </span>
          </Stack>
          {over && <Alert severity="error">{t('errors.validation_invoice_note_over')}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={busy || !reason.trim() || amount <= 0 || over || lines.some((l) => !(Number(l.amount) > 0))}
          onClick={() => {
            setBusy(true);
            setError(null);
            invoiceApi
              .note(inv.id, { kind, date: noteDate, reason: reason.trim(), items: lines.map((l) => ({ component: l.component, description: l.description.trim() || null, amount: Number(l.amount) })) })
              .then((r) => onMade(r.id))
              .catch((failure: unknown) => setError(errorKey(failure)))
              .finally(() => setBusy(false));
          }}
        >
          {t('invoices.makeNote')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
