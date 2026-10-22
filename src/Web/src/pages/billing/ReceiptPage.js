import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';
import { keyframes } from '@emotion/react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { receivablesApi } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { AttachmentsDialog } from '../../components/AttachmentsDialog';
import { recordTones, SectionTitle } from '../../components/RecordLayout';
import { ApprovalBar, useRecordApproval, ShownStatus } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from '../operations/delivery';
import { ReceiptStatusBadge } from './receipts';
import { useCrumb } from '../../app/breadcrumbs';
import { ReceiptDialog } from './ReceiptDialog';
const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };
const stampIn = keyframes `
  0% { opacity: 0; transform: rotate(-12deg) scale(1.6); }
  70% { opacity: 1; transform: rotate(-12deg) scale(.94); }
  100% { opacity: 1; transform: rotate(-12deg) scale(1); }
`;
/** The approval stamp, as on a paper voucher: who approved it and when, slanted over the card. */
function Stamp({ name, at }) {
    const { t } = useTranslation();
    return (_jsxs(Box, { "aria-hidden": true, sx: {
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
        }, children: [_jsx(Typography, { sx: { fontSize: 16, fontWeight: 800, lineHeight: 1.3 }, children: t('receipts.stamp') }), _jsxs(Typography, { sx: { fontSize: 10.5, fontWeight: 700 }, children: [name, " \u00B7 ", _jsx("span", { dir: "ltr", children: at })] })] }));
}
/** A receipt voucher: the money received as a bank card (stamped once approved), where it went, and its review. */
export function ReceiptPage({ editing = false } = {}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const { ar, date } = useCommercialFormat();
    const [r, setR] = useState(null);
    useCrumb(r?.receiptNo, `/billing/receipts/${id}`);
    const [files, setFiles] = useState(false);
    const [dialog, setDialog] = useState(editing);
    const [allocating, setAllocating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const approval = useRecordApproval(r?.approval?.instanceId);
    const reload = useCallback(async () => {
        try {
            setR(await receivablesApi.receipt(id));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    if (!r) {
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
    const canRun = (!r.awaitingApproval && r.canEdit) || approval.detail?.summary.status === 'Failed';
    const look = recordTones.receipt;
    const approved = r.status === 'Approved';
    const share = r.amount > 0 ? Math.round((r.allocated / r.amount) * 100) : 0;
    // What is left on an item after this receipt: once approved the ledger already counts it.
    const leftOf = (a) => (a.itemOutstanding === null ? null : approved ? a.itemOutstanding : Math.max(0, a.itemOutstanding - a.amount));
    const stamp = (at) => new Date(at).toLocaleDateString('en-CA').replaceAll('-', '/');
    return (_jsxs(Box, { children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 2 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.75, flex: 1, minWidth: 0 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 52, height: 52, borderRadius: '15px', display: 'grid', placeItems: 'center', color: '#fff', background: look.dark, '& svg': { fontSize: 27 } }, children: _jsx(PaymentsOutlinedIcon, {}) }), _jsxs(Box, { children: [_jsx(Typography, { component: "h1", sx: { fontSize: 22, fontWeight: 800, color: '#0a5752', lineHeight: 1.2 }, children: t('receipts.voucher') }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 24, fontWeight: 800, color: '#c0392b', letterSpacing: '.5px', lineHeight: 1.2, textAlign: 'start', fontVariantNumeric: 'tabular-nums' }, children: r.receiptNo ?? t('receipts.noNumber') })] }), _jsx(ShownStatus, { approval: approval.detail, children: _jsx(ReceiptStatusBadge, { status: r.status }) })] }), _jsxs(Stack, { direction: "row", sx: { flexWrap: 'wrap', gap: 1 }, children: [r.canEdit && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), disabled: busy, onClick: () => void run(() => receivablesApi.submit(r.id)), sx: { background: look.dark }, children: t('receipts.submit') })), canRun && _jsx(RunProcessButton, { screen: "billing.receipt", recordId: r.id, title: `${t('receipts.voucher')} — ${r.projectName}`, onStarted: () => void reload().then(() => approval.reload()) }), r.canEdit && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditOutlinedIcon, {}), onClick: () => setDialog(true), children: t('receipts.edit') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(AttachFileOutlinedIcon, {}), onClick: () => setFiles(true), children: t('receipts.proof') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(ReceiptLongOutlinedIcon, {}), onClick: () => navigate(`/billing/statements/${r.projectId}`), children: t('receipts.statement') }), r.canEdit && (_jsx(Button, { color: "error", startIcon: _jsx(DeleteOutlineIcon, {}), disabled: busy, onClick: () => setDeleting(true), children: t('receipts.delete') })), _jsx(Button, { startIcon: _jsx(ArrowBackIcon, { sx: { transform: ar ? 'scaleX(-1)' : 'none' } }), onClick: () => navigate('/billing/receipts'), children: t('common.back') })] })] }), _jsx(ErrorMessage, { messageKey: error }), r.lastComment && r.status === 'Returned' && (_jsxs(Alert, { severity: "warning", sx: { mb: `${tokens.gap}px` }, children: [t('operations.delivery.lastComment'), ": ", r.lastComment] })), r.approval && (_jsx(ApprovalBar, { status: r.approval, detail: approval.detail, loading: approval.loading, onChanged: () => {
                    void approval.reload();
                    void reload();
                } })), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '380px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }, children: [_jsxs(Stack, { spacing: `${tokens.gap}px`, children: [_jsxs(Box, { sx: { position: 'relative' }, children: [_jsxs(Box, { sx: {
                                            position: 'relative',
                                            overflow: 'hidden',
                                            borderRadius: '22px',
                                            p: 2.75,
                                            color: '#fff',
                                            background: recordTones.receipt.band,
                                            boxShadow: '0 18px 40px rgba(6,90,82,.32)',
                                            minHeight: 220,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            '&::before': { content: '""', position: 'absolute', width: 260, height: 260, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.07)', top: -120, insetInlineEnd: -80 },
                                            '&::after': { content: '""', position: 'absolute', width: 180, height: 180, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.06)', bottom: -90, insetInlineStart: -40 },
                                        }, children: [_jsx(Stack, { direction: "row", sx: { position: 'relative', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75, opacity: 0.92, '& svg': { fontSize: 18 } }, children: [r.method === 'Cash' ? _jsx(PaymentsOutlinedIcon, {}) : _jsx(AccountBalanceOutlinedIcon, {}), t(`receipts.method.${r.method}`)] }) }), r.bankAccountName && (_jsx(Typography, { sx: { position: 'relative', mt: 0.25, fontSize: 13, fontWeight: 800, maxWidth: approved ? 'calc(100% - 200px)' : '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: r.bankAccountName })), _jsxs(Box, { sx: { position: 'relative', mt: 2.25 }, children: [_jsx(Typography, { sx: { fontSize: 12, opacity: 0.8 }, children: t('receipts.received') }), _jsxs(Typography, { sx: { fontSize: 34, fontWeight: 800, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }, children: [sar(r.amount), _jsx(Box, { component: "span", sx: { fontSize: 15, opacity: 0.85, marginInlineStart: 1 }, children: t('operations.delivery.sarUnit') })] })] }), r.reference && (_jsx(Typography, { dir: "ltr", sx: { position: 'relative', mt: 1.5, fontSize: 16, letterSpacing: '2.5px', opacity: 0.95, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }, children: r.reference })), _jsx(Box, { sx: { flex: 1 } }), _jsxs(Stack, { direction: "row", sx: { position: 'relative', justifyContent: 'space-between', gap: 2, mt: 1.75, fontSize: 12 }, children: [_jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 11.5, opacity: 0.75 }, children: t('receipts.from') }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: r.customerName ?? r.projectName })] }), _jsxs(Box, { sx: { flex: '0 0 auto', textAlign: 'end' }, children: [_jsx(Typography, { sx: { fontSize: 11.5, opacity: 0.75 }, children: t('receipts.col.date') }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 800 }, children: date(r.receiptDate) })] })] })] }), approved && r.approvedAt && _jsx(Stamp, { name: r.approvedByName ?? '—', at: stamp(r.approvedAt) })] }), _jsx(Box, { sx: { ...card, px: 2.25, py: 1 }, children: [
                                    [t('commercial.col.project'), r.projectName],
                                    [t('receipts.reference'), r.reference ? _jsx("span", { dir: "ltr", children: r.reference }) : '—'],
                                    [t('receipts.recordedBy'), r.createdByName],
                                    ...(r.notes ? [[t('receipts.notes'), r.notes]] : []),
                                ].map(([label, value], index) => (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 2, py: 1, fontSize: 13, '&:not(:last-of-type)': { borderBottom: `1px solid ${tokens.gray100}` } }, children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray500, flex: '0 0 auto' }, children: label }), _jsx(Typography, { component: "div", sx: { fontSize: 13, fontWeight: 800, color: tokens.navy800, textAlign: 'end' }, children: value })] }, index))) })] }), _jsx(Stack, { spacing: `${tokens.gap}px`, sx: { minWidth: 0 }, children: _jsxs(Box, { sx: { ...card, p: 2.5 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 2, mb: 2 }, children: [_jsxs(Box, { sx: { position: 'relative', width: 92, height: 92, flex: '0 0 auto' }, children: [_jsx(CircularProgress, { variant: "determinate", value: 100, size: 92, thickness: 5, sx: { color: tokens.gray100, position: 'absolute' } }), _jsx(CircularProgress, { variant: "determinate", value: share, size: 92, thickness: 5, sx: { color: look.main, position: 'absolute', '& circle': { strokeLinecap: 'round' } } })] }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: t('receipts.allocatedShare') }), _jsxs(Typography, { sx: { fontSize: 26, fontWeight: 800, color: '#0a5752', lineHeight: 1.2 }, children: [share, "%"] }), _jsxs(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: [t('receipts.allocatedOf', { amount: sar(r.allocated) }), r.unallocated > 0 && (_jsxs(Box, { component: "b", sx: { color: '#b8770a' }, children: [' · ', t('receipts.leftCredit', { amount: sar(r.unallocated) })] }))] })] }), r.canAllocate && (_jsx(Button, { variant: "outlined", startIcon: _jsx(AutoFixHighOutlinedIcon, {}), disabled: busy, onClick: () => setAllocating(true), sx: { color: look.main, borderColor: look.main }, children: t('receipts.allocateRemainder') }))] }), _jsx(SectionTitle, { icon: _jsx(SwapVertOutlinedIcon, {}), title: t('receipts.movements') }), r.allocations.length === 0 && r.unallocated <= 0 && _jsx(Typography, { sx: { py: 3, textAlign: 'center', color: tokens.gray500 }, children: t('receipts.noAllocations') }), r.allocations.map((a) => {
                                    const left = leftOf(a);
                                    const full = left !== null && left <= 0.005;
                                    const tone = full ? { fg: '#1f9d55', bg: '#e7f6ee' } : { fg: '#b8770a', bg: '#fff6e5' };
                                    return (_jsxs(Stack, { direction: "row", onClick: () => a.kind !== 'OpeningBalance' && navigate(`/billing/invoices/${a.targetId}`), sx: {
                                            alignItems: 'center',
                                            gap: 1.75,
                                            py: 1.5,
                                            px: 0.5,
                                            borderTop: `1px solid ${tokens.gray100}`,
                                            cursor: a.kind === 'OpeningBalance' ? 'default' : 'pointer',
                                            borderRadius: '10px',
                                            '&:hover': a.kind === 'OpeningBalance' ? {} : { bgcolor: tokens.gray50 },
                                        }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 40, height: 40, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: tone.bg, color: tone.fg, fontWeight: 800, '& svg': { fontSize: 20 } }, children: full ? _jsx(CheckIcon, {}) : '½' }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsxs(Typography, { sx: { fontSize: 13.5, color: tokens.gray500 }, children: [_jsx(Box, { component: "b", dir: "ltr", sx: { color: tokens.navy800 }, children: a.number }), ' · ', t(`receipts.kind.${a.kind}`)] }), _jsxs(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: [a.dueDate ? `${t('receipts.dueOn', { date: date(a.dueDate) })} · ` : '', left !== null && t('receipts.leftOnItem', { amount: sar(left) })] })] }), _jsxs(Box, { sx: { textAlign: 'end' }, children: [_jsxs(Typography, { dir: "ltr", sx: { fontSize: 17, fontWeight: 800, color: '#0a5752', fontVariantNumeric: 'tabular-nums' }, children: ["\u2212 ", sar(a.amount)] }), _jsx(Box, { sx: { display: 'inline-block', px: 1.1, borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: tone.fg, bgcolor: tone.bg }, children: full ? t('receipts.paidFull') : t('receipts.paidPart') })] })] }, `${a.kind}:${a.targetId}`));
                                }), r.unallocated > 0 && (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.75, py: 1.5, px: 0.5, borderTop: `1px dashed ${tokens.gray300}` }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 40, height: 40, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: tokens.gray100, color: tokens.gray600, '& svg': { fontSize: 20 } }, children: _jsx(SavingsOutlinedIcon, {}) }), _jsxs(Box, { sx: { flex: 1 }, children: [_jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 800, color: tokens.gray600 }, children: t('receipts.creditLeft') }), _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: t('receipts.creditLeftHint') })] }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 17, fontWeight: 800, color: tokens.gray600, fontVariantNumeric: 'tabular-nums' }, children: sar(r.unallocated) })] }))] }) })] }), allocating && (_jsx(AllocateDialog, { receipt: r, onClose: () => setAllocating(false), onDone: () => {
                    setAllocating(false);
                    void reload();
                } })), files && (_jsx(AttachmentsDialog, { title: `${t('receipts.voucher')} ${r.receiptNo ?? ''}`.trim(), ownerType: "billing.receipt", ownerId: r.id, canManage: r.canEdit || r.status === 'Approved', onClose: () => setFiles(false) })), deleting && (_jsxs(Dialog, { open: true, onClose: () => setDeleting(false), maxWidth: "xs", fullWidth: true, children: [_jsx(DialogTitle, { children: t('receipts.deleteTitle') }), _jsx(DialogContent, { children: _jsx(Typography, { sx: { fontSize: 14 }, children: t('receipts.deleteHint') }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setDeleting(false), children: t('common.cancel') }), _jsx(Button, { color: "error", variant: "contained", disabled: busy, onClick: () => void (async () => {
                                    setBusy(true);
                                    try {
                                        await receivablesApi.remove(r.id);
                                        navigate('/billing/receipts');
                                    }
                                    catch (failure) {
                                        setError(errorKey(failure));
                                        setDeleting(false);
                                    }
                                    finally {
                                        setBusy(false);
                                    }
                                })(), children: t('receipts.delete') })] })] })), dialog && (_jsx(ReceiptDialog, { id: r.id, onClose: () => (editing ? navigate(`/billing/receipts/${r.id}`) : setDialog(false)), onSaved: () => {
                    if (editing) {
                        navigate(`/billing/receipts/${r.id}`);
                        return;
                    }
                    setDialog(false);
                    void reload();
                } }))] }));
}
/** An approved receipt's credit put against the project's open invoices: by hand, or filled oldest due first. */
function AllocateDialog({ receipt, onClose, onDone }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const [open, setOpen] = useState(null);
    const [amounts, setAmounts] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const key = (kind, id) => `${kind}:${id}`;
    useEffect(() => {
        receivablesApi
            .open(receipt.projectId)
            .then(setOpen)
            .catch((failure) => setError(errorKey(failure)));
    }, [receipt.projectId]);
    const items = (open?.items ?? []).filter((i) => i.available > 0);
    const total = Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0);
    const over = total > receipt.unallocated + 0.001 || items.some((i) => (Number(amounts[key(i.kind, i.id)]) || 0) > i.available + 0.001);
    const fill = () => {
        let left = receipt.unallocated;
        const next = {};
        for (const i of [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
            if (left <= 0)
                break;
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
            await receivablesApi.allocate(receipt.id, items.map((i) => ({ kind: i.kind, targetId: i.id, amount: Number(amounts[key(i.kind, i.id)]) || 0 })).filter((a) => a.amount > 0));
            onDone();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "md", children: [_jsx(DialogTitle, { children: t('receipts.allocateTitle', { amount: sar(receipt.unallocated) }) }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), !open && !error && _jsx(LinearProgress, { sx: { borderRadius: 2 } }), open && items.length === 0 && _jsx(Alert, { severity: "info", children: t('receipts.nothingToAllocate') }), items.length > 0 && (_jsxs(_Fragment, { children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.5, mb: 1.5 }, children: [_jsx(Typography, { sx: { flex: 1, fontSize: 12.5, color: tokens.gray500 }, children: t('receipts.allocateHint') }), _jsx(Button, { size: "small", variant: "outlined", startIcon: _jsx(AutoFixHighOutlinedIcon, {}), onClick: fill, children: t('receipts.autoAllocate') })] }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('receipts.col.item') }), _jsx(TableCell, { children: t('receipts.col.due') }), _jsx(TableCell, { align: "center", children: t('receipts.col.outstanding') }), _jsx(TableCell, { align: "center", sx: { width: 170 }, children: t('receipts.col.allocate') })] }) }), _jsx(TableBody, { children: items.map((i) => {
                                                const k = key(i.kind, i.id);
                                                return (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: i.number }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t(`receipts.kind.${i.kind}`) })] }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(i.dueDate) }), _jsx(TableCell, { align: "center", sx: { fontWeight: 700 }, children: sar(i.available) }), _jsx(TableCell, { align: "center", children: _jsx(TextField, { size: "small", value: amounts[k] ?? '', error: (Number(amounts[k]) || 0) > i.available + 0.001, onChange: (e) => setAmounts({ ...amounts, [k]: e.target.value.replace(/[^\d.]/g, '') }), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal', style: { textAlign: 'center' } } } }) })] }, k));
                                            }) })] }) }), _jsxs(Typography, { sx: { mt: 1.5, fontSize: 13.5, textAlign: 'end' }, children: [t('receipts.allocated'), ": ", _jsx("b", { children: sar(total) }), " \u00B7 ", t('receipts.toCredit'), ": ", _jsx("b", { children: sar(Math.max(0, receipt.unallocated - total)) })] }), over && (_jsx(Alert, { severity: "error", sx: { mt: 1 }, children: t('errors.validation_receipt_over_item') }))] }))] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || total <= 0 || over, onClick: () => void save(), children: t('receipts.allocateSave') })] })] }));
}
