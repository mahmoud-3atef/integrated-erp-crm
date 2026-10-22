import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
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
import { transfersApi } from '../../api/operations';
import { useCrumb } from '../../app/breadcrumbs';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { recordTones, RecordHero, SectionTitle, SummaryBand, SummaryCard, SummaryFact, SummaryGroup, SummaryNote } from '../../components/RecordLayout';
import { Badge } from '../../components/ui';
import { ApprovalBar, useRecordApproval, ShownStatus } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from './delivery';
import { daysBetween, Journey, JourneyLine, WorkerFact, WorkerHead } from './recordParts';
import { TransferStatusBadge } from './transfers';
import { TransferOrderWizard } from './TransferOrderWizard';
import { DateField } from '../../components/DateField';
const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };
function initials(name) {
    return (name
        .split(/\s+/)
        .filter((part) => /\p{L}/u.test(part))
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || '·');
}
/** How the price changes with the move: the difference, green when it rises, red when it falls. */
function PriceChange({ from, to }) {
    if (from === null || from === to) {
        return null;
    }
    const up = to > from;
    return (_jsxs(Box, { component: "span", sx: { display: 'inline-block', marginInlineStart: 0.75, px: 0.9, borderRadius: 999, fontSize: 11.5, fontWeight: 800, color: up ? tokens.success : tokens.danger, bgcolor: up ? '#e7f6ee' : '#fdeeee' }, children: [up ? '▲' : '▼', " ", sar(Math.abs(to - from))] }));
}
/**
 * One transfer order. One worker: their card and the way they move (the project they leave, with its price, to the new
 * one, with the new price). Several: the way between the projects, then the workers' table with the old and new
 * prices. Beside them the new project, the value, the date and who receives; the approval's history under them.
 */
export function TransferOrderDetailPage({ editing = false } = {}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const [params] = useSearchParams();
    const { ar, date } = useCommercialFormat();
    const [order, setOrder] = useState(null);
    useCrumb(order?.summary.orderNo, `/operations/transfer-orders/${id}`);
    const [wizard, setWizard] = useState(editing);
    const [error, setError] = useState(params.get('error'));
    const [busy, setBusy] = useState(false);
    const [canceling, setCanceling] = useState(null);
    const [amending, setAmending] = useState(false);
    const [cancelingApproved, setCancelingApproved] = useState(null);
    const approval = useRecordApproval(order?.approval?.instanceId);
    const reload = useCallback(async () => {
        try {
            setOrder(await transfersApi.get(id));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    if (!order) {
        return _jsx(ErrorMessage, { messageKey: error });
    }
    const o = order.summary;
    // Run a process: on an order being prepared without an approval, or to replace an approval that stopped with an error.
    const canRun = (!order.awaitingApproval && order.canEdit) || approval.detail?.summary.status === 'Failed';
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
    const single = order.lines.length === 1 ? (order.lines[0] ?? null) : null;
    const price = (l) => (_jsxs(_Fragment, { children: [t('operations.transfer.price'), ": ", _jsx("b", { style: { color: tokens.navy800 }, children: sar(l.totalPrice) }), _jsx(PriceChange, { from: l.fromTotalPrice, to: l.totalPrice })] }));
    return (_jsxs(Box, { children: [_jsx(RecordHero, { tone: "transfer", icon: _jsx(SwapHorizIcon, {}), kind: t('operations.transfer.kind'), number: o.orderNo, status: _jsx(ShownStatus, { approval: approval.detail, children: _jsx(TransferStatusBadge, { status: o.status }) }), actions: _jsxs(_Fragment, { children: [order.canEdit && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditOutlinedIcon, {}), onClick: () => setWizard(true), children: t('common.edit') })), order.canSubmit && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), disabled: busy, onClick: () => void run(() => transfersApi.submit(o.id)), children: t('operations.delivery.submit') })), canRun && (_jsx(RunProcessButton, { screen: "operations.transfer_order", recordId: o.id, title: `${o.orderNo} — ${o.projectName}`, onStarted: () => void reload().then(() => approval.reload()) })), order.canCancel && (_jsx(Button, { variant: "outlined", startIcon: _jsx(CancelOutlinedIcon, {}), onClick: () => setCanceling(''), children: t('operations.transfer.cancel') })), order.canAmend && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditNoteOutlinedIcon, {}), onClick: () => setAmending(true), children: t('operations.transfer.amend.action') })), order.canCancelApproved && (_jsx(Button, { variant: "outlined", color: "error", startIcon: _jsx(CancelOutlinedIcon, {}), onClick: () => setCancelingApproved(''), children: t('operations.transfer.amend.cancelAction') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: ar ? 'scaleX(-1)' : 'none' } }), onClick: () => navigate('/operations/transfer-orders'), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), o.status === 'UnderPreparation' && order.awaitingApproval && (_jsx(Alert, { severity: "info", sx: { mb: `${tokens.gap}px` }, children: t('operations.transfer.creatorHint') })), o.status === 'Transferred' && (_jsx(Alert, { severity: "success", sx: { mb: `${tokens.gap}px` }, children: t('operations.transfer.transferredHint', { date: date(o.transferOn) }) })), order.amendedAt && o.status === 'Transferred' && (_jsxs(Alert, { severity: "info", sx: { mb: `${tokens.gap}px` }, children: [t('operations.transfer.amend.amendedBy', { by: order.amendedByName, date: date(order.amendedAt) }), " \u2014 ", order.amendNote] })), o.status === 'CanceledAfterApproval' && (_jsxs(Alert, { severity: "warning", sx: { mb: `${tokens.gap}px` }, children: [t('operations.transfer.amend.canceledBy', { by: order.canceledByName, date: date(order.canceledAt) }), " \u2014 ", order.lastComment] })), order.approval && (_jsx(ApprovalBar, { status: order.approval, detail: approval.detail, loading: approval.loading, onChanged: () => {
                    void approval.reload();
                    void reload();
                } })), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }, children: [_jsxs(SummaryCard, { children: [_jsx(SummaryBand, { tone: "transfer", label: t('operations.transfer.newProject'), value: o.projectName, size: 21, chips: [...(o.customerName ? [{ label: o.customerName }] : []), ...(order.projectManager ? [{ label: `${t('commercial.col.manager')}: ${order.projectManager}` }] : [])] }), _jsx(SummaryGroup, { title: t('operations.delivery.value'), color: tokens.success, children: _jsx(SummaryFact, { icon: _jsx(PaymentsOutlinedIcon, {}), color: tokens.success, label: t('operations.transfer.newMonthlyTotal'), value: `${sar(o.totalPrice)} ${t('operations.delivery.sarUnit')}`, sub: [t('operations.delivery.workersCount', { count: o.workers }), ...(o.specialPrices > 0 ? [t('operations.delivery.specialCount', { count: o.specialPrices })] : [])].join(' · ') }) }), _jsx(SummaryGroup, { title: t('operations.delivery.dates'), color: recordTones.transfer.main, children: _jsx(SummaryFact, { icon: _jsx(EventOutlinedIcon, {}), color: recordTones.transfer.main, label: t('operations.transfer.col.transferOn'), value: date(o.transferOn) }) }), order.receiverName && (_jsx(SummaryGroup, { title: t('operations.delivery.receiving'), color: tokens.gold, children: _jsx(SummaryFact, { icon: _jsx(BadgeOutlinedIcon, {}), color: tokens.gold, label: t('operations.transfer.receiverName'), value: order.receiverName, sub: order.receiverTitle }) })), order.delayReason && _jsx(SummaryNote, { title: t('operations.delivery.delayReason'), children: order.delayReason }), order.notes && _jsx(SummaryNote, { title: t('operations.delivery.notes'), children: order.notes }), order.lastComment && _jsx(SummaryNote, { title: t('operations.delivery.lastComment'), children: order.lastComment })] }), _jsx(Stack, { spacing: `${tokens.gap}px`, sx: { minWidth: 0 }, children: single ? (_jsxs(Box, { sx: { ...card, overflow: 'hidden' }, children: [_jsx(WorkerHead, { tone: "transfer", label: t('operations.return.col.worker'), name: single.name, workerId: single.workerId, workerNo: single.workerNo, badge: single.isSpecialPrice ? _jsx(Badge, { tone: "warning", children: t('commercial.prices.status.Special') }) : single.packageNo ? _jsx(Badge, { tone: "success", children: single.packageNo }) : undefined, facts: _jsxs(_Fragment, { children: [_jsx(WorkerFact, { icon: _jsx(BadgeOutlinedIcon, {}), label: t('operations.delivery.col.iqama'), value: single.iqamaNo ?? '—', ltr: true }), _jsx(WorkerFact, { icon: _jsx(EngineeringOutlinedIcon, {}), label: t('operations.return.profession'), value: (ar ? single.professionAr : single.professionEn) ?? '—' }), _jsx(WorkerFact, { icon: _jsx(PublicOutlinedIcon, {}), label: t('operations.return.nationality'), value: (ar ? single.nationalityAr : single.nationalityEn) ?? '—' })] }) }), _jsxs(Box, { sx: { px: 2.5, pt: 2, pb: 2.5, borderTop: `1px solid ${tokens.gray100}` }, children: [_jsx(SectionTitle, { icon: _jsx(RouteOutlinedIcon, {}), title: t('operations.transfer.journey') }), _jsx(Journey, { from: {
                                                state: 'Work',
                                                label: t('operations.transfer.currentProject'),
                                                sub: single.fromProjectName,
                                                lines: (_jsxs(_Fragment, { children: [_jsx(JourneyLine, { label: t('operations.transfer.startedOn'), children: date(single.fromStartedOn) }), _jsx(JourneyLine, { label: t('operations.transfer.price'), children: single.fromTotalPrice === null ? '—' : sar(single.fromTotalPrice) })] })),
                                            }, to: {
                                                state: 'Work',
                                                label: t('operations.transfer.newProject'),
                                                sub: o.projectName,
                                                lines: (_jsxs(_Fragment, { children: [_jsx(JourneyLine, { label: t('operations.transfer.col.transferOn'), children: date(o.transferOn) }), _jsx("div", { children: price(single) })] })),
                                            }, pill: (() => {
                                                const days = daysBetween(single.fromStartedOn, o.transferOn);
                                                return days === null ? undefined : t('operations.return.workedDays', { count: days });
                                            })() })] })] })) : (_jsxs(Box, { sx: { ...card, p: 2.25, minWidth: 0 }, children: [_jsx(SectionTitle, { icon: _jsx(RouteOutlinedIcon, {}), title: t('operations.transfer.journey') }), _jsx(Box, { sx: { mb: 2.5 }, children: _jsx(Journey, { from: { state: 'Work', label: t('operations.transfer.currentProject'), sub: o.fromProjects }, to: { state: 'Work', label: t('operations.transfer.newProject'), sub: o.projectName, lines: _jsx(JourneyLine, { label: t('operations.transfer.col.transferOn'), children: date(o.transferOn) }) }, pill: t('operations.delivery.workersCount', { count: o.workers }) }) }), _jsx(SectionTitle, { icon: _jsx(GroupsOutlinedIcon, {}), title: t('operations.delivery.tabs.workers', { count: order.lines.length }) }), _jsx(TableContainer, { sx: { border: `1px solid ${tokens.gray100}`, borderRadius: `${tokens.radius}px` }, children: _jsxs(Table, { size: "small", sx: {
                                            '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even) .MuiTableCell-body': { bgcolor: '#fff' },
                                            '& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-body': { borderBottom: 0 },
                                            '& .MuiTableCell-root': { px: 1.25 },
                                            '& .MuiTableCell-body': { py: 1.1 },
                                        }, children: [_jsx(TableHead, { sx: {
                                                    '& .MuiTableRow-root': { background: recordTones.transfer.dark },
                                                    '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': { bgcolor: 'transparent', color: '#fff', fontWeight: 700, fontSize: 12.5, borderBottom: 0, borderRadius: 0 },
                                                }, children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { children: t('commercial.prices.col.who') }), _jsx(TableCell, { children: t('operations.transfer.col.from') }), _jsx(TableCell, { children: t('operations.transfer.oldPrice') }), _jsx(TableCell, { children: t('operations.transfer.col.newPrice') })] }) }), _jsx(TableBody, { children: order.lines.map((l) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/workforce/workers/${l.workerId}?tab=periods`), children: [_jsx(TableCell, { sx: { minWidth: 210 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: recordTones.transfer.soft, color: recordTones.transfer.main, fontSize: 12, fontWeight: 800 }, children: initials(l.name) }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: l.name }), _jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: [_jsx("span", { dir: "ltr", children: l.workerNo }), l.iqamaNo && (_jsxs(_Fragment, { children: [' · ', t('operations.delivery.iqamaShort'), " ", _jsx("span", { dir: "ltr", children: l.iqamaNo })] }))] })] })] }) }), _jsxs(TableCell, { children: [(ar ? l.professionAr : l.professionEn) ?? '—', _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: (ar ? l.nationalityAr : l.nationalityEn) ?? '—' })] }), _jsxs(TableCell, { sx: { minWidth: 150 }, children: [l.fromProjectName ?? '—', l.fromStartedOn && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t('operations.transfer.since', { date: date(l.fromStartedOn) }) })] }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap', color: tokens.gray600 }, children: l.fromTotalPrice === null ? '—' : sar(l.fromTotalPrice) }), _jsxs(TableCell, { sx: { whiteSpace: 'nowrap' }, children: [_jsx(Typography, { component: "span", sx: { fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }, children: sar(l.totalPrice) }), _jsx(PriceChange, { from: l.fromTotalPrice, to: l.totalPrice }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: l.isSpecialPrice ? t('commercial.prices.status.Special') : (l.packageNo ?? '') })] })] }, l.id))) })] }) }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mt: 2, fontSize: 12.5, color: tokens.gray500 }, children: [_jsx(InfoOutlinedIcon, { sx: { fontSize: 16 } }), t('operations.transfer.parallelNote')] })] })) })] }), canceling !== null && (_jsxs(Dialog, { open: true, onClose: () => setCanceling(null), fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('operations.transfer.cancelTitle', { no: o.orderNo }) }), _jsx(DialogContent, { dividers: true, children: _jsx(TextField, { label: t('operations.delivery.cancelReason'), value: canceling, onChange: (e) => setCanceling(e.target.value), fullWidth: true, multiline: true, minRows: 2 }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setCanceling(null), children: t('common.close') }), _jsx(Button, { variant: "contained", color: "error", disabled: busy, onClick: () => void run(async () => {
                                    await transfersApi.cancel(o.id, canceling.trim() || null);
                                    setCanceling(null);
                                }), children: t('operations.transfer.cancel') })] })] })), amending && (_jsx(TransferAmendDialog, { order: order, onClose: () => setAmending(false), onSaved: () => void run(async () => {
                    setAmending(false);
                }) })), cancelingApproved !== null && (_jsxs(Dialog, { open: true, onClose: () => setCancelingApproved(null), fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('operations.transfer.amend.cancelTitle', { no: o.orderNo }) }), _jsxs(DialogContent, { dividers: true, children: [_jsx(Alert, { severity: "warning", sx: { mb: 2 }, children: t('operations.transfer.amend.cancelHint') }), _jsx(TextField, { required: true, label: t('operations.transfer.amend.reason'), value: cancelingApproved, onChange: (e) => setCancelingApproved(e.target.value), fullWidth: true, multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 500 } } })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setCancelingApproved(null), children: t('common.close') }), _jsx(Button, { variant: "contained", color: "error", disabled: busy || !cancelingApproved.trim(), onClick: () => void run(async () => {
                                    await transfersApi.cancelApproved(o.id, cancelingApproved.trim());
                                    setCancelingApproved(null);
                                }), children: t('operations.transfer.amend.cancelAction') })] })] })), wizard && (_jsx(TransferOrderWizard, { id: o.id, onClose: () => (editing ? navigate(`/operations/transfer-orders/${o.id}`) : setWizard(false)), onSaved: (_, failed) => {
                    if (editing) {
                        navigate(`/operations/transfer-orders/${o.id}${failed ? `?error=errors.${failed.replace('.', '_')}` : ''}`);
                        return;
                    }
                    setWizard(false);
                    setError(failed ? `errors.${failed.replace('.', '_')}` : null);
                    void reload().then(() => approval.reload());
                } }))] }));
}
/**
 * Changing a transferred order (its own permission): the transfer date (every worker's period on the new project moves
 * with it), the receiver and the notes, and each worker's monthly price (a new price is a special price with its
 * reason), with the reason for the change.
 */
function TransferAmendDialog({ order, onClose, onSaved }) {
    const { t } = useTranslation();
    const o = order.summary;
    const [transferOn, setTransferOn] = useState(o.transferOn);
    const [receiverName, setReceiverName] = useState(order.receiverName ?? '');
    const [receiverTitle, setReceiverTitle] = useState(order.receiverTitle ?? '');
    const [notes, setNotes] = useState(order.notes ?? '');
    const [lines, setLines] = useState(order.lines.map((l) => ({ lineId: l.id, name: l.name, workerNo: l.workerNo, price: String(l.totalPrice), was: l.totalPrice, specialReason: '' })));
    const [why, setWhy] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const set = (i, change) => setLines((all) => all.map((l, n) => (n === i ? { ...l, ...change } : l)));
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await transfersApi.amend(o.id, {
                transferOn,
                receiverName: receiverName.trim() || null,
                receiverTitle: receiverTitle.trim() || null,
                notes: notes.trim() || null,
                lines: lines.map((l) => ({ lineId: l.lineId, totalPrice: Number(l.price) || 0, specialReason: l.specialReason.trim() || null })),
                amendReason: why.trim(),
            });
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "md", children: [_jsx(DialogTitle, { children: t('operations.transfer.amend.title', { no: o.orderNo }) }), _jsx(DialogContent, { dividers: true, children: _jsxs(Stack, { sx: { gap: 2 }, children: [_jsx(Alert, { severity: "info", children: t('operations.transfer.amend.hint') }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 2 }, children: [_jsx(DateField, { required: true, label: t('operations.transfer.amend.transferOn'), value: transferOn, onChange: (e) => setTransferOn(e.target.value), slotProps: { inputLabel: { shrink: true } }, sx: { flex: 1 } }), _jsx(TextField, { label: t('operations.transfer.amend.receiver'), value: receiverName, onChange: (e) => setReceiverName(e.target.value), sx: { flex: 1 } }), _jsx(TextField, { label: t('operations.transfer.amend.receiverTitle'), value: receiverTitle, onChange: (e) => setReceiverTitle(e.target.value), sx: { flex: 1 } })] }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('operations.transfer.amend.worker') }), _jsx(TableCell, { children: t('operations.transfer.amend.price') }), _jsx(TableCell, { children: t('operations.transfer.amend.specialReason') })] }) }), _jsx(TableBody, { children: lines.map((l, i) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 600 }, children: _jsx("bdi", { children: l.name }) }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: _jsx("bdi", { children: l.workerNo }) })] }), _jsx(TableCell, { children: _jsx(TextField, { size: "small", type: "number", value: l.price, onChange: (e) => set(i, { price: e.target.value }), slotProps: { htmlInput: { min: 0, step: 0.01 } }, sx: { width: 130 } }) }), _jsx(TableCell, { children: _jsx(TextField, { size: "small", disabled: Number(l.price) === l.was, required: Number(l.price) !== l.was, value: l.specialReason, onChange: (e) => set(i, { specialReason: e.target.value }) }) })] }, l.lineId))) })] }) }), _jsx(TextField, { label: t('operations.transfer.amend.notes'), value: notes, onChange: (e) => setNotes(e.target.value), multiline: true, minRows: 2 }), _jsx(TextField, { required: true, label: t('operations.transfer.amend.reason'), value: why, onChange: (e) => setWhy(e.target.value), multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 500 } } }), error && _jsx(Alert, { severity: "error", children: t(error) })] }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.close') }), _jsx(Button, { variant: "contained", disabled: busy || !why.trim() || !transferOn, onClick: () => void save(), children: t('operations.transfer.amend.save') })] })] }));
}
