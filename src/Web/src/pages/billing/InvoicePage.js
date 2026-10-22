import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Alert, Box, Button, ButtonBase, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, ListItemIcon, Menu, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TextField, Tooltip, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { invoiceApi, noteComponents } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { recordTones, RecordHero, SectionTitle } from '../../components/RecordLayout';
import { ApprovalBar, useRecordApproval, ShownStatus } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday, sar } from '../operations/delivery';
import { InvoiceKindBadge, InvoiceStatusBadge, signed } from './invoices';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ReceiptDialog } from './ReceiptDialog';
import { DateField } from '../../components/DateField';
const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };
const paymentLook = {
    paid: { fg: '#1f9d55', bg: '#e7f6ee' },
    partial: { fg: '#b8770a', bg: '#fff6e5' },
    overdue: { fg: '#c0392b', bg: '#fdeeee' },
    unpaid: { fg: '#5d6f7b', bg: '#eef1f5' },
};
/** A figure in a card with a colored top edge. */
function Figure({ color, label, value, foot }) {
    return (_jsxs(Box, { sx: { ...card, p: 2.25, borderTop: `4px solid ${color}` }, children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: label }), _jsx(Typography, { component: "div", sx: { fontSize: 27, fontWeight: 800, color, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }, children: value }), foot && (_jsx(Typography, { component: "div", sx: { fontSize: 12.5, color: tokens.gray600 }, children: foot }))] }));
}
/** One event of the invoice's journey, down the side: its mark on a line, what happened, when and by whom; a receipt or a note opens. */
function Event({ last, color, mark, label, lines, onClick }) {
    return (_jsxs(ButtonBase, { disabled: !onClick, onClick: onClick, sx: { display: 'flex', alignItems: 'stretch', gap: 1.5, width: '100%', textAlign: 'start', borderRadius: '10px', px: 0.75, '&:hover': onClick ? { bgcolor: tokens.gray50 } : {}, '&.Mui-disabled': { color: 'inherit' } }, children: [_jsxs(Stack, { sx: { alignItems: 'center', flex: '0 0 auto', pt: 1 }, children: [_jsx(Box, { sx: { width: 30, height: 30, borderRadius: '50%', bgcolor: color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, '& svg': { fontSize: 17 } }, children: mark }), !last && _jsx(Box, { "aria-hidden": true, sx: { flex: 1, width: 2, minHeight: 14, bgcolor: tokens.gray100, mt: 0.5 } })] }), _jsxs(Box, { sx: { flex: 1, minWidth: 0, py: 1, pb: last ? 1 : 1.5 }, children: [_jsx(Typography, { component: "div", sx: { fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }, children: label }), lines.map((line, n) => (_jsx(Typography, { component: "div", sx: { fontSize: 12, color: tokens.gray500 }, children: line }, n)))] }), onClick && _jsx(ChevronLeftIcon, { sx: { alignSelf: 'center', color: tokens.gray300, transform: 'scaleX(var(--flip, 1))' } })] }));
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
    const [inv, setInv] = useState(null);
    useCrumb(inv?.invoiceNo, `/billing/invoices/${id}`);
    const [editing, setEditing] = useState(false);
    const [noting, setNoting] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [menu, setMenu] = useState(null);
    const [receiving, setReceiving] = useState(false);
    const { can } = useSession();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const approval = useRecordApproval(inv?.approval?.instanceId);
    const reload = useCallback(async () => {
        try {
            setInv(await invoiceApi.get(id));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    if (!inv) {
        return _jsx(ErrorMessage, { messageKey: error });
    }
    const run = async (action) => {
        setBusy(true);
        setError(null);
        try {
            await action();
            await reload();
            await approval.reload();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
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
    const payment = !collectible ? null : inv.outstanding <= 0.005 ? 'paid' : daysToDue < 0 ? 'overdue' : inv.paid > 0 ? 'partial' : 'unpaid';
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
        ? { color: tokens.gray300, mark: _jsx("span", { children: "?" }) }
        : payment === 'paid'
            ? { color: '#1f9d55', mark: _jsx(CheckIcon, {}) }
            : daysToDue < 0
                ? { color: '#c0392b', mark: _jsx(PriorityHighIcon, {}) }
                : { color: '#d98a06', mark: _jsx(HourglassEmptyIcon, {}) };
    const dated = [
        ...(inv.payments ?? []).map((p) => ({
            key: `r-${p.receiptId}`,
            at: p.receiptDate,
            color: p.status === 'Approved' ? '#1f9d55' : '#d98a06',
            mark: p.status === 'Approved' ? _jsx(PaymentsOutlinedIcon, {}) : _jsx(HourglassEmptyIcon, {}),
            label: (_jsxs(_Fragment, { children: [t('invoices.board.collected', { amount: sar(p.amount) }), p.status !== 'Approved' && (_jsx(Box, { component: "span", sx: { marginInlineStart: 1, fontSize: 11.5, fontWeight: 700, color: '#b8770a' }, children: t('invoices.board.inReview') }))] })),
            lines: [
                _jsxs(_Fragment, { children: [t('receipts.voucher'), " ", _jsx("bdi", { style: { fontWeight: 800, color: recordTones.receipt.main }, children: p.receiptNo ?? t('invoices.board.unnumbered') }), " \u00B7 ", _jsx("bdi", { children: date(p.receiptDate) })] }),
            ],
            onClick: () => navigate(`/billing/receipts/${p.receiptId}`),
        })),
        ...inv.notes.map((note) => ({
            key: `n-${note.id}`,
            at: note.invoiceDate,
            color: note.kind === 'CreditNote' ? tokens.danger : '#2b7bd9',
            mark: note.kind === 'CreditNote' ? _jsx(RemoveCircleOutlineIcon, {}) : _jsx(AddCircleOutlineIcon, {}),
            label: `${t(`invoices.kind.${note.kind}`)} ${sar(signed(note.kind, note.total))}`,
            lines: [
                _jsxs(_Fragment, { children: [_jsx("bdi", { style: { fontWeight: 800 }, children: note.invoiceNo ?? t('invoices.noNumber') }), " \u00B7 ", _jsx("bdi", { children: date(note.invoiceDate) }), " \u00B7 ", t(`invoices.status.${note.status}`)] }),
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
                    lines: [_jsx("bdi", { children: date(inv.dueDate) }, "d"), ...(collectible && payment !== 'paid' && daysToDue < 0 ? [_jsx(Box, { component: "span", sx: { color: '#c0392b', fontWeight: 700 }, children: t('invoices.board.lateDays', { count: -daysToDue }) }, "l")] : [])],
                },
            ]
            : []),
    ].sort((x, y) => x.at.localeCompare(y.at));
    const lastPaid = (inv.payments ?? []).filter((p) => p.status === 'Approved').at(-1);
    const journey = [
        { key: 'made', at: inv.createdAt, color: '#1f9d55', mark: _jsx(CheckIcon, {}), label: t('invoices.board.made'), lines: [_jsxs(_Fragment, { children: [_jsx("bdi", { children: date(inv.createdAt) }), " \u00B7 ", inv.createdByName] })] },
        {
            key: 'issued',
            at: inv.issuedAt ?? '',
            color: issued ? '#1f9d55' : '#d98a06',
            mark: issued ? _jsx(CheckIcon, {}) : _jsx(HourglassEmptyIcon, {}),
            label: issued ? t('invoices.board.issued') : t(`invoices.status.${inv.status}`),
            lines: inv.issuedAt ? [_jsxs(_Fragment, { children: [_jsx("bdi", { children: date(inv.issuedAt) }), " \u00B7 ", inv.issuedByName ?? '—'] })] : [t('invoices.board.notIssued')],
        },
        ...dated,
        ...(inv.kind !== 'CreditNote'
            ? [
                {
                    key: 'settled',
                    at: '',
                    color: payment === 'paid' ? '#1f9d55' : tokens.gray300,
                    mark: payment === 'paid' ? _jsx(CheckIcon, {}) : _jsx("span", { children: "?" }),
                    label: t('invoices.board.settled'),
                    lines: [payment === 'paid' && lastPaid ? _jsx("bdi", { children: date(lastPaid.receiptDate) }, "p") : collectible ? t('invoices.board.leftToPay', { amount: sar(inv.outstanding) }) : '—'],
                },
            ]
            : []),
    ];
    return (_jsxs(Box, { children: [_jsx(RecordHero, { tone: "invoice", icon: _jsx(ReceiptLongOutlinedIcon, {}), kind: `${t(`invoices.kind.${inv.kind}`)} · ${monthName}`, number: inv.invoiceNo ?? t('invoices.noNumber'), status: _jsxs(_Fragment, { children: [_jsx(Box, { sx: { bgcolor: '#fff', borderRadius: 99, px: 0.25 }, children: _jsx(ShownStatus, { approval: approval.detail, children: _jsx(InvoiceStatusBadge, { status: inv.status }) }) }), payment && (_jsx(Box, { sx: { px: 1.25, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 800, color: paymentLook[payment].fg, bgcolor: paymentLook[payment].bg }, children: t(`invoices.payment.${payment}`) }))] }), title: inv.projectName, subtitle: `${inv.customer.name} · ${t('timesheets.cycle', { from: date(inv.periodFrom), to: date(inv.periodTo) })}`, actions: _jsxs(_Fragment, { children: [inv.canSubmit && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), disabled: busy, onClick: () => void run(() => invoiceApi.submit(inv.id)), children: t('invoices.submit') })), canRun && _jsx(RunProcessButton, { screen: "billing.invoice", recordId: inv.id, title: title, onStarted: () => void reload().then(() => approval.reload()) }), inv.canEdit && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditOutlinedIcon, {}), disabled: busy, onClick: () => setEditing(true), children: t('invoices.editTerms') })), canReceive && (_jsx(Button, { variant: "contained", startIcon: _jsx(AddCardOutlinedIcon, {}), onClick: () => setReceiving(true), children: t('invoices.board.addReceipt') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(PrintOutlinedIcon, {}), component: "a", href: `/billing/invoices/${inv.id}/print`, target: "_blank", rel: "noopener", children: t('invoices.printDoc') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(MoreHorizIcon, {}), onClick: (e) => setMenu(e.currentTarget), children: t('invoices.more') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: ar ? 'scaleX(-1)' : 'none' } }), onClick: () => navigate(`/billing/invoices?month=${inv.month}`), children: t('common.back') })] }) }), _jsxs(Menu, { anchorEl: menu, open: !!menu, onClose: () => setMenu(null), children: [inv.canNote && (_jsxs(MenuItem, { onClick: () => (setMenu(null), setNoting('CreditNote')), sx: { color: tokens.danger }, children: [_jsx(ListItemIcon, { sx: { color: 'inherit' }, children: _jsx(RemoveCircleOutlineIcon, { fontSize: "small" }) }), t('invoices.newCredit')] })), inv.canNote && (_jsxs(MenuItem, { onClick: () => (setMenu(null), setNoting('DebitNote')), children: [_jsx(ListItemIcon, { children: _jsx(AddCircleOutlineIcon, { fontSize: "small" }) }), t('invoices.newDebit')] })), isInvoice && (_jsxs(MenuItem, { component: "a", href: invoiceApi.attachmentUrl(inv.id), download: true, onClick: () => setMenu(null), children: [_jsx(ListItemIcon, { children: _jsx(FileDownloadOutlinedIcon, { fontSize: "small" }) }), t('invoices.attachment')] })), _jsxs(MenuItem, { onClick: () => navigate(`/billing/statements/${inv.projectId}`), children: [_jsx(ListItemIcon, { children: _jsx(AccountBalanceWalletOutlinedIcon, { fontSize: "small" }) }), t('receipts.statement')] }), inv.timesheetId && (_jsxs(MenuItem, { onClick: () => navigate(`/billing/timesheets/${inv.timesheetId}`), children: [_jsx(ListItemIcon, { children: _jsx(FactCheckOutlinedIcon, { fontSize: "small" }) }), t('invoices.openTimesheet', { number: inv.timesheetNo })] })), inv.originalInvoiceId && (_jsxs(MenuItem, { onClick: () => navigate(`/billing/invoices/${inv.originalInvoiceId}`), children: [_jsx(ListItemIcon, { children: _jsx(ReceiptLongOutlinedIcon, { fontSize: "small" }) }), t('invoices.openOriginal', { number: inv.originalInvoiceNo })] })), inv.canDelete && (_jsxs(MenuItem, { onClick: () => (setMenu(null), setDeleting(true)), sx: { color: tokens.danger }, children: [_jsx(ListItemIcon, { sx: { color: 'inherit' }, children: _jsx(DeleteOutlineIcon, { fontSize: "small" }) }), t('invoices.delete')] }))] }), _jsx(ErrorMessage, { messageKey: error }), inv.warnings.map((w) => (_jsx(Alert, { severity: "warning", sx: { mb: `${tokens.gap}px` }, children: t(`invoices.warnings.${w}`) }, w))), inv.reason && (_jsxs(Alert, { severity: "info", icon: _jsx(InfoOutlinedIcon, {}), sx: { mb: `${tokens.gap}px` }, children: [t('invoices.reason'), ": ", inv.reason] })), inv.lastComment && inv.status === 'Returned' && (_jsxs(Alert, { severity: "info", sx: { mb: `${tokens.gap}px` }, children: [t('operations.delivery.lastComment'), ": ", inv.lastComment] })), inv.approval && (_jsx(ApprovalBar, { status: inv.approval, detail: approval.detail, loading: approval.loading, onChanged: () => {
                    void approval.reload();
                    void reload();
                } })), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr 1fr' }, gap: `${tokens.gap}px`, mb: `${tokens.gap}px` }, children: [collectible ? (_jsxs(Box, { sx: { ...card, p: 2.25, display: 'flex', alignItems: 'center', gap: 2.25 }, children: [_jsxs(Box, { sx: { position: 'relative', width: 104, height: 104, flex: '0 0 auto' }, children: [_jsx(CircularProgress, { variant: "determinate", value: 100, size: 104, thickness: 5, sx: { color: tokens.gray100, position: 'absolute' } }), _jsx(CircularProgress, { variant: "determinate", value: paidShare, size: 104, thickness: 5, sx: { color: '#1f9d55', position: 'absolute', '& circle': { strokeLinecap: 'round' } } }), _jsxs(Typography, { sx: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, color: '#1f9d55' }, children: [paidShare, "%"] })] }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: t('invoices.board.left') }), _jsx(Typography, { sx: { fontSize: 28, fontWeight: 800, color: inv.outstanding > 0 ? look.main : '#1f9d55', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }, children: sar(inv.outstanding) }), _jsxs(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: [t('invoices.board.of', { total: sar(inv.total) }), " \u00B7", ' ', _jsx(Box, { component: "b", sx: { color: '#1f9d55' }, children: t('invoices.board.paid', { amount: sar(inv.paid) }) })] })] })] })) : (_jsx(Figure, { color: look.main, label: isInvoice ? t('invoices.tiles.net') : t('invoices.tiles.original'), value: isInvoice ? sar(inv.netAmount) : _jsx("span", { dir: "ltr", children: inv.originalInvoiceNo }), foot: isInvoice ? t('invoices.tiles.workers', { count: workers }) : undefined })), _jsx(Figure, { color: collectible && payment !== 'paid' ? (daysToDue < 0 ? '#c0392b' : '#d98a06') : tokens.gray600, label: t('invoices.board.due'), value: collectible && payment !== 'paid' ? (daysToDue < 0 ? t('invoices.board.lateDays', { count: -daysToDue }) : daysToDue === 0 ? t('invoices.board.dueToday') : t('invoices.board.inDays', { count: daysToDue })) : date(inv.dueDate), foot: `${t('invoices.board.dueOn', { date: date(inv.dueDate) })}${inv.paymentTermDays ? ` · ${t('invoices.termDays', { days: inv.paymentTermDays })}` : ''}` }), _jsx(Figure, { color: inv.kind === 'CreditNote' ? tokens.danger : tokens.navy800, label: t(`invoices.totalOf.${inv.kind}`), value: sar(signed(inv.kind, inv.total)), foot: t('invoices.board.withVat', { amount: sar(inv.amount), vat: sar(inv.vat), rate: Math.round(inv.vatRate * 100) }) })] }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }, children: [_jsxs(Stack, { spacing: `${tokens.gap}px`, children: [_jsxs(Box, { sx: { ...card, p: 2.25 }, children: [_jsx(SectionTitle, { icon: _jsx(DonutSmallOutlinedIcon, {}), title: t('invoices.board.components') }), lines.map((i, n) => (_jsxs(Box, { sx: { mb: 1.25 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 1 }, children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray700 }, children: t(`invoices.components.${i.component}`) }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }, children: sar(i.amount) })] }), i.description && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: i.description }), _jsx(Box, { sx: { height: 7, borderRadius: 99, bgcolor: tokens.gray100, mt: 0.5, overflow: 'hidden' }, children: _jsx(Box, { sx: { height: '100%', width: `${inv.amount > 0 ? Math.min(100, (i.amount / inv.amount) * 100) : 0}%`, borderRadius: 99, bgcolor: barColors[n % barColors.length] } }) })] }, i.lineNo))), discount && (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', py: 0.5 }, children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray700 }, children: t('invoices.components.Discount') }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 800, color: tokens.danger }, children: sar(discount.amount) })] })), _jsx(Box, { sx: { mt: 1, pt: 1, borderTop: `1px solid ${tokens.gray100}` }, children: [
                                            [t('timesheets.invoice.amount'), sar(inv.amount)],
                                            [t('timesheets.invoice.vat', { rate: Math.round(inv.vatRate * 100) }), sar(inv.vat)],
                                            [t(`invoices.totalOf.${inv.kind}`), sar(inv.total)],
                                            [t('commercial.col.customer'), inv.customer.name],
                                            [t('commercial.col.project'), inv.projectName],
                                            [t('invoices.tiles.date'), date(inv.invoiceDate)],
                                        ].map(([label, value], n) => (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 2, py: 0.75, fontSize: 13, borderBottom: n < 5 ? `1px solid ${tokens.gray100}` : 0 }, children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray500, flex: '0 0 auto' }, children: label }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: n === 2 ? 800 : 700, color: n === 2 ? look.main : tokens.navy800, textAlign: 'end' }, children: value })] }, label))) }), inv.remarks && _jsxs(Typography, { sx: { mt: 1.5, fontSize: 12.5, color: tokens.gray600 }, children: [t('invoices.remarks'), ": ", inv.remarks] })] }), _jsxs(Box, { sx: { ...card, p: 2.25 }, children: [_jsx(SectionTitle, { icon: _jsx(RouteOutlinedIcon, {}), title: t('invoices.board.journey'), extra: canReceive ? (_jsx(Tooltip, { title: t('invoices.board.addReceipt'), children: _jsx(IconButton, { size: "small", onClick: () => setReceiving(true), sx: { color: '#fff', bgcolor: recordTones.receipt.main, '&:hover': { bgcolor: '#0a5752' } }, children: _jsx(AddCardOutlinedIcon, { fontSize: "small" }) }) })) : undefined }), journey.map((e, n) => (_jsx(Event, { last: n === journey.length - 1, color: e.color, mark: e.mark, label: e.label, lines: e.lines, onClick: e.onClick }, e.key)))] })] }), _jsxs(Stack, { spacing: `${tokens.gap}px`, sx: { minWidth: 0 }, children: [isInvoice && inv.workers.length > 0 && (_jsxs(Box, { sx: { ...card, p: 2.25, minWidth: 0 }, children: [_jsx(SectionTitle, { icon: _jsx(GroupsOutlinedIcon, {}), title: t('invoices.tabs.workers', { count: inv.workers.length }) }), _jsx(WorkersTab, { inv: inv })] })), isInvoice && inv.notes.length > 0 && (_jsxs(Box, { sx: { ...card, p: 2.25 }, children: [_jsx(SectionTitle, { icon: _jsx(ReceiptLongOutlinedIcon, {}), title: t('invoices.tabs.notes', { count: inv.notes.length }) }), _jsx(NotesTab, { inv: inv })] }))] })] }), receiving && (_jsx(ReceiptDialog, { preset: { projectId: inv.projectId, kind: inv.kind === 'DebitNote' ? 'DebitNote' : 'Invoice', targetId: inv.id, amount: receivable }, onClose: () => setReceiving(false), onSaved: (receiptId) => navigate(`/billing/receipts/${receiptId}`) })), editing && (_jsx(EditDialog, { inv: inv, onClose: () => setEditing(false), onSaved: () => {
                    setEditing(false);
                    void reload();
                } })), noting && (_jsx(NoteDialog, { inv: inv, kind: noting, onClose: () => setNoting(null), onMade: (noteId) => {
                    setNoting(null);
                    navigate(`/billing/invoices/${noteId}`);
                } })), deleting && (_jsxs(Dialog, { open: true, onClose: () => setDeleting(false), maxWidth: "xs", fullWidth: true, children: [_jsx(DialogTitle, { children: t('invoices.deleteTitle') }), _jsx(DialogContent, { children: _jsx(Typography, { sx: { fontSize: 14 }, children: t('invoices.deleteHint') }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setDeleting(false), children: t('common.cancel') }), _jsx(Button, { color: "error", variant: "contained", disabled: busy, onClick: () => void (async () => {
                                    setBusy(true);
                                    try {
                                        await invoiceApi.remove(inv.id);
                                        navigate(inv.timesheetId ? `/billing/timesheets/${inv.timesheetId}` : inv.originalInvoiceId ? `/billing/invoices/${inv.originalInvoiceId}` : '/billing/invoices');
                                    }
                                    catch (failure) {
                                        setError(errorKey(failure));
                                        setDeleting(false);
                                    }
                                    finally {
                                        setBusy(false);
                                    }
                                })(), children: t('invoices.delete') })] })] }))] }));
}
function WorkersTab({ inv }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { ar, date } = useCommercialFormat();
    const sum = (pick) => sar(inv.workers.reduce((s, w) => s + pick(w), 0));
    return (_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { sx: { '& .MuiTableRow-root': { background: recordTones.invoice.dark }, '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': { bgcolor: 'transparent', color: '#fff', borderBottom: 0, borderRadius: 0 } }, children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { children: t('timesheets.col.period') }), _jsx(TableCell, { align: "center", children: t('timesheets.col.days') }), _jsx(TableCell, { align: "center", children: t('timesheets.col.price') }), _jsx(TableCell, { align: "center", children: t('invoices.col.salary') }), _jsx(TableCell, { align: "center", children: t('invoices.col.fees') }), _jsx(TableCell, { align: "center", children: t('invoices.col.adjustments') }), _jsx(TableCell, { align: "center", children: t('invoices.col.amount') }), _jsx(TableCell, { align: "center", children: t('invoices.col.total') })] }) }), _jsx(TableBody, { children: inv.workers.map((w, n) => {
                        const adjustments = w.overtime + w.clientAdditions - w.clientDeductions - w.customerLoans + w.otherCosts + w.gosi;
                        return (_jsxs(TableRow, { hover: true, children: [_jsxs(TableCell, { sx: { minWidth: 180, cursor: 'pointer' }, onClick: () => navigate(`/workforce/workers/${w.workerId}?tab=periods`), children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: w.name }), _jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: [_jsx("span", { dir: "ltr", children: w.workerNo }), " \u00B7 ", (ar ? w.professionAr : w.professionEn) ?? '—'] })] }), _jsxs(TableCell, { sx: { whiteSpace: 'nowrap', fontSize: 12.5 }, children: [date(w.lineFrom), " \u2013 ", date(w.lineTo)] }), _jsxs(TableCell, { align: "center", sx: { fontWeight: 700 }, children: [sar(w.workDays), w.absenceDays > 0 && _jsx(Typography, { sx: { fontSize: 11, color: tokens.danger }, children: t('invoices.absentDays', { days: sar(w.absenceDays) }) })] }), _jsx(TableCell, { align: "center", children: sar(w.monthlyPrice) }), _jsx(TableCell, { align: "center", children: sar(w.dueSalary - w.absenceAmount) }), _jsx(TableCell, { align: "center", children: sar(w.dueFees) }), _jsx(TableCell, { align: "center", sx: { color: adjustments < 0 ? tokens.danger : undefined }, children: adjustments === 0 ? '—' : sar(adjustments) }), _jsx(TableCell, { align: "center", sx: { fontWeight: 800, color: tokens.navy800 }, children: sar(w.amount) }), _jsx(TableCell, { align: "center", children: sar(w.total) })] }, `${w.workerId}-${n}`));
                    }) }), _jsx(TableFooter, { children: _jsxs(TableRow, { sx: { '& td': { fontWeight: 800, color: tokens.navy800, fontSize: 13 } }, children: [_jsx(TableCell, { colSpan: 2, children: t('timesheets.pay.total', { count: new Set(inv.workers.map((w) => w.workerId)).size }) }), _jsx(TableCell, { align: "center", children: sum((w) => w.workDays) }), _jsx(TableCell, {}), _jsx(TableCell, { align: "center", children: sum((w) => w.dueSalary - w.absenceAmount) }), _jsx(TableCell, { align: "center", children: sum((w) => w.dueFees) }), _jsx(TableCell, { align: "center", children: sum((w) => w.overtime + w.clientAdditions - w.clientDeductions - w.customerLoans + w.otherCosts + w.gosi) }), _jsx(TableCell, { align: "center", children: sum((w) => w.amount) }), _jsx(TableCell, { align: "center", children: sum((w) => w.total) })] }) })] }) }));
}
function NotesTab({ inv }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { date } = useCommercialFormat();
    if (inv.notes.length === 0) {
        return _jsx(Typography, { sx: { py: 4, textAlign: 'center', color: tokens.gray500 }, children: t('invoices.noNotes') });
    }
    return (_jsxs(_Fragment, { children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray600, mb: 1.5 }, children: t('invoices.netHint', { amount: sar(inv.amount), net: sar(inv.netAmount) }) }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { sx: { '& .MuiTableRow-root': { background: recordTones.invoice.dark }, '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': { bgcolor: 'transparent', color: '#fff', borderBottom: 0, borderRadius: 0 } }, children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('invoices.col.number') }), _jsx(TableCell, { children: t('invoices.col.date') }), _jsx(TableCell, { align: "center", children: t('invoices.col.amount') }), _jsx(TableCell, { align: "center", children: t('invoices.col.total') }), _jsx(TableCell, { children: t('invoices.col.status') })] }) }), _jsx(TableBody, { children: inv.notes.map((n) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/billing/invoices/${n.id}`), children: [_jsx(TableCell, { children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(InvoiceKindBadge, { kind: n.kind }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: n.invoiceNo ?? t('invoices.noNumber') })] }) }), _jsx(TableCell, { children: date(n.invoiceDate) }), _jsx(TableCell, { align: "center", children: sar(signed(n.kind, n.amount)) }), _jsx(TableCell, { align: "center", sx: { fontWeight: 800, color: n.kind === 'CreditNote' ? tokens.danger : tokens.navy800 }, children: sar(signed(n.kind, n.total)) }), _jsx(TableCell, { children: _jsx(InvoiceStatusBadge, { status: n.status }) })] }, n.id))) })] }) })] }));
}
function EditDialog({ inv, onClose, onSaved }) {
    const { t } = useTranslation();
    const [invoiceDate, setInvoiceDate] = useState(inv.invoiceDate);
    const [term, setTerm] = useState(inv.paymentTermDays === null ? '' : String(inv.paymentTermDays));
    const [remarks, setRemarks] = useState(inv.remarks ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('invoices.editTerms') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { spacing: 2, children: [_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 2, children: [_jsx(DateField, { sx: { flex: 1 }, label: t('invoices.col.date'), value: invoiceDate, onChange: (e) => setInvoiceDate(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { sx: { flex: 1 }, label: t('invoices.paymentTerm'), value: term, onChange: (e) => setTerm(e.target.value.replace(/[^\d]/g, '')), helperText: t('invoices.paymentTermHint'), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'numeric', maxLength: 3 } } })] }), _jsx(TextField, { label: t('invoices.remarks'), value: remarks, onChange: (e) => setRemarks(e.target.value), multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 1000 } } })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || !invoiceDate, onClick: () => {
                            setBusy(true);
                            setError(null);
                            invoiceApi
                                .edit(inv.id, { invoiceDate, paymentTermDays: term === '' ? null : Number(term), remarks: remarks.trim() || null })
                                .then(onSaved)
                                .catch((failure) => setError(errorKey(failure)))
                                .finally(() => setBusy(false));
                        }, children: t('common.save') })] })] }));
}
function NoteDialog({ inv, kind, onClose, onMade }) {
    const { t } = useTranslation();
    const [noteDate, setNoteDate] = useState(isoToday());
    const [reason, setReason] = useState('');
    const [lines, setLines] = useState([{ component: 'Salary', description: '', amount: '' }]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const amount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const vat = Math.round(amount * inv.vatRate * 100) / 100;
    const over = kind === 'CreditNote' && amount > inv.creditable;
    const change = (n, patch) => setLines(lines.map((l, i) => (i === n ? { ...l, ...patch } : l)));
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "md", children: [_jsx(DialogTitle, { children: t(`invoices.noteTitle.${kind}`, { number: inv.invoiceNo }) }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500, mb: 2 }, children: t(`invoices.noteHint.${kind}`, { creditable: sar(inv.creditable) }) }), _jsxs(Stack, { spacing: 2, children: [_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 2, children: [_jsx(DateField, { sx: { width: { sm: 200 } }, label: t('invoices.col.date'), value: noteDate, onChange: (e) => setNoteDate(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { sx: { flex: 1 }, required: true, label: t('invoices.reason'), value: reason, onChange: (e) => setReason(e.target.value), slotProps: { htmlInput: { maxLength: 1000 } } })] }), lines.map((l, n) => (_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 1.5, sx: { alignItems: { sm: 'center' } }, children: [_jsx(TextField, { select: true, sx: { width: { sm: 210 } }, label: t('invoices.component'), value: l.component, onChange: (e) => change(n, { component: e.target.value }), children: noteComponents.map((c) => (_jsx(MenuItem, { value: c, children: t(`invoices.components.${c}`) }, c))) }), _jsx(TextField, { sx: { flex: 1 }, label: t('invoices.description'), value: l.description, onChange: (e) => change(n, { description: e.target.value }), slotProps: { htmlInput: { maxLength: 300 } } }), _jsx(TextField, { sx: { width: { sm: 150 } }, label: t('invoices.col.amount'), value: l.amount, onChange: (e) => change(n, { amount: e.target.value.replace(/[^\d.]/g, '') }), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal' } } }), _jsx(IconButton, { disabled: lines.length === 1, onClick: () => setLines(lines.filter((_, i) => i !== n)), children: _jsx(DeleteOutlineIcon, { fontSize: "small" }) })] }, n))), _jsx(Box, { children: _jsx(Button, { size: "small", startIcon: _jsx(AddCircleOutlineIcon, {}), onClick: () => setLines([...lines, { component: 'Salary', description: '', amount: '' }]), children: t('invoices.addLine') }) }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'flex-end', gap: 3, fontSize: 13.5 }, children: [_jsxs("span", { children: [t('timesheets.invoice.amount'), ": ", _jsx("b", { children: sar(amount) })] }), _jsxs("span", { children: [t('invoices.tiles.vat', { rate: Math.round(inv.vatRate * 100) }), ": ", _jsx("b", { children: sar(vat) })] }), _jsxs("span", { style: { color: kind === 'CreditNote' ? tokens.danger : tokens.navy800 }, children: [t('invoices.tiles.total'), ": ", _jsx("b", { children: sar(amount + vat) })] })] }), over && _jsx(Alert, { severity: "error", children: t('errors.validation_invoice_note_over') })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || !reason.trim() || amount <= 0 || over || lines.some((l) => !(Number(l.amount) > 0)), onClick: () => {
                            setBusy(true);
                            setError(null);
                            invoiceApi
                                .note(inv.id, { kind, date: noteDate, reason: reason.trim(), items: lines.map((l) => ({ component: l.component, description: l.description.trim() || null, amount: Number(l.amount) })) })
                                .then((r) => onMade(r.id))
                                .catch((failure) => setError(errorKey(failure)))
                                .finally(() => setBusy(false));
                        }, children: t('invoices.makeNote') })] })] }));
}
