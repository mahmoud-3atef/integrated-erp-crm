import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AddCardOutlinedIcon from '@mui/icons-material/AddCardOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import DonutSmallOutlinedIcon from '@mui/icons-material/DonutSmallOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemIcon,
  Menu,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { invoiceApi, noteComponents, type InvoiceComponent, type InvoiceDetail, type NoteDraft } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { recordTones, RecordHero, SectionTitle } from '../../components/RecordLayout';
import { ApprovalBar, ApprovalFeedLog, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday, sar } from '../operations/delivery';
import { InvoiceKindBadge, InvoiceStatusBadge, signed } from './invoices';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ReceiptDialog } from './ReceiptDialog';

const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };

type Payment = 'paid' | 'partial' | 'overdue' | 'unpaid';
const paymentLook: Record<Payment, { fg: string; bg: string }> = {
  paid: { fg: '#1f9d55', bg: '#e7f6ee' },
  partial: { fg: '#b8770a', bg: '#fff6e5' },
  overdue: { fg: '#c0392b', bg: '#fdeeee' },
  unpaid: { fg: '#5d6f7b', bg: '#eef1f5' },
};

/** A figure in a card with a colored top edge. */
function Figure({ color, label, value, foot }: { color: string; label: string; value: ReactNode; foot?: ReactNode }) {
  return (
    <Box sx={{ ...card, p: 2.25, borderTop: `4px solid ${color}` }}>
      <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: 27, fontWeight: 800, color, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      {foot && (
        <Typography component="div" sx={{ fontSize: 12.5, color: tokens.gray600 }}>
          {foot}
        </Typography>
      )}
    </Box>
  );
}

/** One event of the invoice's journey, down the side: its mark on a line, what happened, when and by whom; a receipt or a note opens. */
function Event({ last, color, mark, label, lines, onClick }: { last: boolean; color: string; mark: ReactNode; label: ReactNode; lines: ReactNode[]; onClick?: () => void }) {
  return (
    <ButtonBase
      disabled={!onClick}
      onClick={onClick}
      sx={{ display: 'flex', alignItems: 'stretch', gap: 1.5, width: '100%', textAlign: 'start', borderRadius: '10px', px: 0.75, '&:hover': onClick ? { bgcolor: tokens.gray50 } : {}, '&.Mui-disabled': { color: 'inherit' } }}
    >
      <Stack sx={{ alignItems: 'center', flex: '0 0 auto', pt: 1 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, '& svg': { fontSize: 17 } }}>{mark}</Box>
        {!last && <Box aria-hidden sx={{ flex: 1, width: 2, minHeight: 14, bgcolor: tokens.gray100, mt: 0.5 }} />}
      </Stack>
      <Box sx={{ flex: 1, minWidth: 0, py: 1, pb: last ? 1 : 1.5 }}>
        <Typography component="div" sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }}>
          {label}
        </Typography>
        {lines.map((line, n) => (
          <Typography key={n} component="div" sx={{ fontSize: 12, color: tokens.gray500 }}>
            {line}
          </Typography>
        ))}
      </Box>
      {onClick && <ChevronLeftIcon sx={{ alignSelf: 'center', color: tokens.gray300, transform: 'scaleX(var(--flip, 1))' }} />}
    </ButtonBase>
  );
}

/**
 * A customer invoice or note, as a collection board: the band with its number and state, the approval bar, the money
 * left to collect, the days to its due date and its total; its journey from creation to payment; then its components,
 * the workers it bills, its notes and its approval's history.
 */
export function InvoicePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  useCrumb(inv?.invoiceNo, `/billing/invoices/${id}`);
  const [editing, setEditing] = useState(false);
  const [noting, setNoting] = useState<NoteDraft['kind'] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [receiving, setReceiving] = useState(false);
  const { can } = useSession();
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

  const look = recordTones.invoice;
  const isInvoice = inv.kind === 'Invoice';
  const issued = inv.status === 'Issued';
  const collectible = issued && inv.kind !== 'CreditNote';
  const workers = new Set(inv.workers.map((w) => w.workerId)).size;
  const canRun = (!inv.awaitingApproval && inv.canEdit) || approval.detail?.summary.status === 'Failed';
  const monthName = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(inv.month));
  const title = `${t(`invoices.kind.${inv.kind}`)} ${inv.invoiceNo ?? ''}`.trim();
  const daysToDue = Math.round((Date.parse(inv.dueDate) - Date.parse(isoToday())) / 86_400_000);
  const payment: Payment | null = !collectible ? null : inv.outstanding <= 0.005 ? 'paid' : daysToDue < 0 ? 'overdue' : inv.paid > 0 ? 'partial' : 'unpaid';
  const paidShare = inv.total > 0 ? Math.min(100, Math.round((inv.paid / inv.total) * 100)) : 0;
  const lines = inv.items.filter((i) => i.component !== 'Discount');
  const discount = inv.items.find((i) => i.component === 'Discount');
  const barColors = [look.main, '#5b7bd6', '#2a9bd1', '#7c4dcc', '#d98a06', '#5d6f7b'];

  // The journey: made, issued, the receipts and notes by date with the due date among them, then the full payment.
  // What is still free to receive: the outstanding less what receipts in review will already pay.
  const inReview = (inv.payments ?? []).filter((p) => p.status !== 'Approved').reduce((sum, p) => sum + p.amount, 0);
  const receivable = Math.max(0, Math.round((inv.outstanding - inReview) * 100) / 100);
  const canReceive = collectible && receivable > 0.005 && can('billing.receipts.manage', true);
  const due = !issued
    ? { color: tokens.gray300, mark: <span>?</span> }
    : payment === 'paid'
      ? { color: '#1f9d55', mark: <CheckIcon /> }
      : daysToDue < 0
        ? { color: '#c0392b', mark: <PriorityHighIcon /> }
        : { color: '#d98a06', mark: <HourglassEmptyIcon /> };
  type JourneyEvent = { key: string; at: string; color: string; mark: ReactNode; label: ReactNode; lines: ReactNode[]; onClick?: () => void };
  const dated: JourneyEvent[] = [
    ...(inv.payments ?? []).map((p) => ({
      key: `r-${p.receiptId}`,
      at: p.receiptDate,
      color: p.status === 'Approved' ? '#1f9d55' : '#d98a06',
      mark: p.status === 'Approved' ? <PaymentsOutlinedIcon /> : <HourglassEmptyIcon />,
      label: (
        <>
          {t('invoices.board.collected', { amount: sar(p.amount) })}
          {p.status !== 'Approved' && (
            <Box component="span" sx={{ marginInlineStart: 1, fontSize: 11.5, fontWeight: 700, color: '#b8770a' }}>
              {t('invoices.board.inReview')}
            </Box>
          )}
        </>
      ),
      lines: [
        <>
          {t('receipts.voucher')} <bdi style={{ fontWeight: 800, color: recordTones.receipt.main }}>{p.receiptNo ?? t('invoices.board.unnumbered')}</bdi> · <bdi>{date(p.receiptDate)}</bdi>
        </>,
      ],
      onClick: () => navigate(`/billing/receipts/${p.receiptId}`),
    })),
    ...inv.notes.map((note) => ({
      key: `n-${note.id}`,
      at: note.invoiceDate,
      color: note.kind === 'CreditNote' ? tokens.danger : '#2b7bd9',
      mark: note.kind === 'CreditNote' ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />,
      label: `${t(`invoices.kind.${note.kind}`)} ${sar(signed(note.kind, note.total))}`,
      lines: [
        <>
          <bdi style={{ fontWeight: 800 }}>{note.invoiceNo ?? t('invoices.noNumber')}</bdi> · <bdi>{date(note.invoiceDate)}</bdi> · {t(`invoices.status.${note.status}`)}
        </>,
      ],
      onClick: () => navigate(`/billing/invoices/${note.id}`),
    })),
    ...(inv.kind !== 'CreditNote'
      ? [
          {
            key: 'due',
            at: inv.dueDate,
            color: due.color,
            mark: due.mark,
            label: t('invoices.board.dueStop'),
            lines: [<bdi key="d">{date(inv.dueDate)}</bdi>, ...(collectible && payment !== 'paid' && daysToDue < 0 ? [<Box component="span" key="l" sx={{ color: '#c0392b', fontWeight: 700 }}>{t('invoices.board.lateDays', { count: -daysToDue })}</Box>] : [])],
          },
        ]
      : []),
  ].sort((x, y) => x.at.localeCompare(y.at));
  const lastPaid = (inv.payments ?? []).filter((p) => p.status === 'Approved').at(-1);
  const journey: JourneyEvent[] = [
    { key: 'made', at: inv.createdAt, color: '#1f9d55', mark: <CheckIcon />, label: t('invoices.board.made'), lines: [<><bdi>{date(inv.createdAt)}</bdi> · {inv.createdByName}</>] },
    {
      key: 'issued',
      at: inv.issuedAt ?? '',
      color: issued ? '#1f9d55' : '#d98a06',
      mark: issued ? <CheckIcon /> : <HourglassEmptyIcon />,
      label: issued ? t('invoices.board.issued') : t(`invoices.status.${inv.status}`),
      lines: inv.issuedAt ? [<><bdi>{date(inv.issuedAt)}</bdi> · {inv.issuedByName ?? '—'}</>] : [t('invoices.board.notIssued')],
    },
    ...dated,
    ...(inv.kind !== 'CreditNote'
      ? [
          {
            key: 'settled',
            at: '',
            color: payment === 'paid' ? '#1f9d55' : tokens.gray300,
            mark: payment === 'paid' ? <CheckIcon /> : <span>?</span>,
            label: t('invoices.board.settled'),
            lines: [payment === 'paid' && lastPaid ? <bdi key="p">{date(lastPaid.receiptDate)}</bdi> : collectible ? t('invoices.board.leftToPay', { amount: sar(inv.outstanding) }) : '—'],
          },
        ]
      : []),
  ];

  return (
    <Box>
      <RecordHero
        tone="invoice"
        icon={<ReceiptLongOutlinedIcon />}
        kind={`${t(`invoices.kind.${inv.kind}`)} · ${monthName}`}
        number={inv.invoiceNo ?? t('invoices.noNumber')}
        status={
          <>
            <Box sx={{ bgcolor: '#fff', borderRadius: 99, px: 0.25 }}>
              <InvoiceStatusBadge status={inv.status} />
            </Box>
            {payment && (
              <Box sx={{ px: 1.25, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 800, color: paymentLook[payment].fg, bgcolor: paymentLook[payment].bg }}>{t(`invoices.payment.${payment}`)}</Box>
            )}
          </>
        }
        title={inv.projectName}
        subtitle={`${inv.customer.name} · ${t('timesheets.cycle', { from: date(inv.periodFrom), to: date(inv.periodTo) })}`}
        actions={
          <>
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
            {canReceive && (
              <Button variant="contained" startIcon={<AddCardOutlinedIcon />} onClick={() => setReceiving(true)}>
                {t('invoices.board.addReceipt')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} component="a" href={`/billing/invoices/${inv.id}/print`} target="_blank" rel="noopener">
              {t('invoices.printDoc')}
            </Button>
            <Button variant="outlined" startIcon={<MoreHorizIcon />} onClick={(e) => setMenu(e.currentTarget)}>
              {t('invoices.more')}
            </Button>
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate(`/billing/invoices?month=${inv.month}`)}>
              {t('common.back')}
            </Button>
          </>
        }
      />
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
        {inv.canNote && (
          <MenuItem onClick={() => (setMenu(null), setNoting('CreditNote'))} sx={{ color: tokens.danger }}>
            <ListItemIcon sx={{ color: 'inherit' }}>
              <RemoveCircleOutlineIcon fontSize="small" />
            </ListItemIcon>
            {t('invoices.newCredit')}
          </MenuItem>
        )}
        {inv.canNote && (
          <MenuItem onClick={() => (setMenu(null), setNoting('DebitNote'))}>
            <ListItemIcon>
              <AddCircleOutlineIcon fontSize="small" />
            </ListItemIcon>
            {t('invoices.newDebit')}
          </MenuItem>
        )}
        {isInvoice && (
          <MenuItem component="a" href={invoiceApi.attachmentUrl(inv.id)} download onClick={() => setMenu(null)}>
            <ListItemIcon>
              <FileDownloadOutlinedIcon fontSize="small" />
            </ListItemIcon>
            {t('invoices.attachment')}
          </MenuItem>
        )}
        <MenuItem onClick={() => navigate(`/billing/statements/${inv.projectId}`)}>
          <ListItemIcon>
            <AccountBalanceWalletOutlinedIcon fontSize="small" />
          </ListItemIcon>
          {t('receipts.statement')}
        </MenuItem>
        {inv.timesheetId && (
          <MenuItem onClick={() => navigate(`/billing/timesheets/${inv.timesheetId}`)}>
            <ListItemIcon>
              <FactCheckOutlinedIcon fontSize="small" />
            </ListItemIcon>
            {t('invoices.openTimesheet', { number: inv.timesheetNo })}
          </MenuItem>
        )}
        {inv.originalInvoiceId && (
          <MenuItem onClick={() => navigate(`/billing/invoices/${inv.originalInvoiceId}`)}>
            <ListItemIcon>
              <ReceiptLongOutlinedIcon fontSize="small" />
            </ListItemIcon>
            {t('invoices.openOriginal', { number: inv.originalInvoiceNo })}
          </MenuItem>
        )}
        {inv.canDelete && (
          <MenuItem onClick={() => (setMenu(null), setDeleting(true))} sx={{ color: tokens.danger }}>
            <ListItemIcon sx={{ color: 'inherit' }}>
              <DeleteOutlineIcon fontSize="small" />
            </ListItemIcon>
            {t('invoices.delete')}
          </MenuItem>
        )}
      </Menu>

      <ErrorMessage messageKey={error} />
      {inv.warnings.map((w) => (
        <Alert key={w} severity="warning" sx={{ mb: `${tokens.gap}px` }}>
          {t(`invoices.warnings.${w}`)}
        </Alert>
      ))}
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

      {/* The money: what is left to collect, when it is due, and the total. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr 1fr' }, gap: `${tokens.gap}px`, mb: `${tokens.gap}px` }}>
        {collectible ? (
          <Box sx={{ ...card, p: 2.25, display: 'flex', alignItems: 'center', gap: 2.25 }}>
            <Box sx={{ position: 'relative', width: 104, height: 104, flex: '0 0 auto' }}>
              <CircularProgress variant="determinate" value={100} size={104} thickness={5} sx={{ color: tokens.gray100, position: 'absolute' }} />
              <CircularProgress variant="determinate" value={paidShare} size={104} thickness={5} sx={{ color: '#1f9d55', position: 'absolute', '& circle': { strokeLinecap: 'round' } }} />
              <Typography sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, color: '#1f9d55' }}>{paidShare}%</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('invoices.board.left')}</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 800, color: inv.outstanding > 0 ? look.main : '#1f9d55', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{sar(inv.outstanding)}</Typography>
              <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>
                {t('invoices.board.of', { total: sar(inv.total) })} ·{' '}
                <Box component="b" sx={{ color: '#1f9d55' }}>
                  {t('invoices.board.paid', { amount: sar(inv.paid) })}
                </Box>
              </Typography>
            </Box>
          </Box>
        ) : (
          <Figure
            color={look.main}
            label={isInvoice ? t('invoices.tiles.net') : t('invoices.tiles.original')}
            value={isInvoice ? sar(inv.netAmount) : <span dir="ltr">{inv.originalInvoiceNo}</span>}
            foot={isInvoice ? t('invoices.tiles.workers', { count: workers }) : undefined}
          />
        )}
        <Figure
          color={collectible && payment !== 'paid' ? (daysToDue < 0 ? '#c0392b' : '#d98a06') : tokens.gray600}
          label={t('invoices.board.due')}
          value={collectible && payment !== 'paid' ? (daysToDue < 0 ? t('invoices.board.lateDays', { count: -daysToDue }) : daysToDue === 0 ? t('invoices.board.dueToday') : t('invoices.board.inDays', { count: daysToDue })) : date(inv.dueDate)}
          foot={`${t('invoices.board.dueOn', { date: date(inv.dueDate) })}${inv.paymentTermDays ? ` · ${t('invoices.termDays', { days: inv.paymentTermDays })}` : ''}`}
        />
        <Figure
          color={inv.kind === 'CreditNote' ? tokens.danger : tokens.navy800}
          label={t(`invoices.totalOf.${inv.kind}`)}
          value={sar(signed(inv.kind, inv.total))}
          foot={t('invoices.board.withVat', { amount: sar(inv.amount), vat: sar(inv.vat), rate: Math.round(inv.vatRate * 100) })}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }}>
        <Stack spacing={`${tokens.gap}px`}>
        {/* What the invoice is made of. */}
        <Box sx={{ ...card, p: 2.25 }}>
          <SectionTitle icon={<DonutSmallOutlinedIcon />} title={t('invoices.board.components')} />
          {lines.map((i, n) => (
            <Box key={i.lineNo} sx={{ mb: 1.25 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ fontSize: 13, color: tokens.gray700 }}>{t(`invoices.components.${i.component}`)}</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{sar(i.amount)}</Typography>
              </Stack>
              {i.description && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{i.description}</Typography>}
              <Box sx={{ height: 7, borderRadius: 99, bgcolor: tokens.gray100, mt: 0.5, overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${inv.amount > 0 ? Math.min(100, (i.amount / inv.amount) * 100) : 0}%`, borderRadius: 99, bgcolor: barColors[n % barColors.length] }} />
              </Box>
            </Box>
          ))}
          {discount && (
            <Stack direction="row" sx={{ justifyContent: 'space-between', py: 0.5 }}>
              <Typography sx={{ fontSize: 13, color: tokens.gray700 }}>{t('invoices.components.Discount')}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: tokens.danger }}>{sar(discount.amount)}</Typography>
            </Stack>
          )}
          <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${tokens.gray100}` }}>
            {[
              [t('timesheets.invoice.amount'), sar(inv.amount)],
              [t('timesheets.invoice.vat', { rate: Math.round(inv.vatRate * 100) }), sar(inv.vat)],
              [t(`invoices.totalOf.${inv.kind}`), sar(inv.total)],
              [t('commercial.col.customer'), inv.customer.name],
              [t('commercial.col.project'), inv.projectName],
              [t('invoices.tiles.date'), date(inv.invoiceDate)],
            ].map(([label, value], n) => (
              <Stack key={label} direction="row" sx={{ justifyContent: 'space-between', gap: 2, py: 0.75, fontSize: 13, borderBottom: n < 5 ? `1px solid ${tokens.gray100}` : 0 }}>
                <Typography sx={{ fontSize: 13, color: tokens.gray500, flex: '0 0 auto' }}>{label}</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: n === 2 ? 800 : 700, color: n === 2 ? look.main : tokens.navy800, textAlign: 'end' }}>{value}</Typography>
              </Stack>
            ))}
          </Box>
          {inv.remarks && <Typography sx={{ mt: 1.5, fontSize: 12.5, color: tokens.gray600 }}>{t('invoices.remarks')}: {inv.remarks}</Typography>}
        </Box>

        {/* The journey, down the side: every event with its date; a receipt opens. */}
        <Box sx={{ ...card, p: 2.25 }}>
          <SectionTitle
            icon={<RouteOutlinedIcon />}
            title={t('invoices.board.journey')}
            extra={
              canReceive ? (
                <Tooltip title={t('invoices.board.addReceipt')}>
                  <IconButton size="small" onClick={() => setReceiving(true)} sx={{ color: '#fff', bgcolor: recordTones.receipt.main, '&:hover': { bgcolor: '#0a5752' } }}>
                    <AddCardOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : undefined
            }
          />
          {journey.map((e, n) => (
            <Event key={e.key} last={n === journey.length - 1} color={e.color} mark={e.mark} label={e.label} lines={e.lines} onClick={e.onClick} />
          ))}
        </Box>
        </Stack>

        <Stack spacing={`${tokens.gap}px`} sx={{ minWidth: 0 }}>
          {isInvoice && inv.workers.length > 0 && (
            <Box sx={{ ...card, p: 2.25, minWidth: 0 }}>
              <SectionTitle icon={<GroupsOutlinedIcon />} title={t('invoices.tabs.workers', { count: inv.workers.length })} />
              <WorkersTab inv={inv} />
            </Box>
          )}
          {isInvoice && inv.notes.length > 0 && (
            <Box sx={{ ...card, p: 2.25 }}>
              <SectionTitle icon={<ReceiptLongOutlinedIcon />} title={t('invoices.tabs.notes', { count: inv.notes.length })} />
              <NotesTab inv={inv} />
            </Box>
          )}
          {inv.approval && (
            <Box sx={{ ...card, p: 2.25 }}>
              <SectionTitle icon={<HistoryOutlinedIcon />} title={t('operations.delivery.tabs.approval')} />
              <ApprovalFeedLog status={inv.approval} detail={approval.detail} />
            </Box>
          )}
        </Stack>
      </Box>

      {receiving && (
        <ReceiptDialog
          preset={{ projectId: inv.projectId, kind: inv.kind === 'DebitNote' ? 'DebitNote' : 'Invoice', targetId: inv.id, amount: receivable }}
          onClose={() => setReceiving(false)}
          onSaved={(receiptId) => navigate(`/billing/receipts/${receiptId}`)}
        />
      )}
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

function WorkersTab({ inv }: { inv: InvoiceDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ar, date } = useCommercialFormat();
  const sum = (pick: (w: InvoiceDetail['workers'][number]) => number) => sar(inv.workers.reduce((s, w) => s + pick(w), 0));
  return (
    <TableContainer>
      <Table size="small">
        <TableHead sx={{ '& .MuiTableRow-root': { background: recordTones.invoice.dark }, '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': { bgcolor: 'transparent', color: '#fff', borderBottom: 0, borderRadius: 0 } }}>
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
          <TableHead sx={{ '& .MuiTableRow-root': { background: recordTones.invoice.dark }, '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': { bgcolor: 'transparent', color: '#fff', borderBottom: 0, borderRadius: 0 } }}>
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
