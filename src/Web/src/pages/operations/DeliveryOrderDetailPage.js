import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { operationsApi } from '../../api/operations';
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
import { DateField } from '../../components/DateField';
/** The two letters of a worker's name, for the avatar in the workers table. */
function initials(name) {
    return (name
        .split(/\s+/)
        .filter((part) => /\p{L}/u.test(part))
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || '·');
}
const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };
/**
 * One delivery order: the band with its number and actions, the approval bar, then the order's summary on one side
 * and its workers (or the approval log) on the other.
 */
export function DeliveryOrderDetailPage({ editing = false } = {}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const [params] = useSearchParams();
    const { ar, date } = useCommercialFormat();
    const [order, setOrder] = useState(null);
    useCrumb(order?.summary.orderNo, `/operations/delivery-orders/${id}`);
    const [wizard, setWizard] = useState(editing);
    const [error, setError] = useState(params.get('error'));
    const [busy, setBusy] = useState(false);
    const [canceling, setCanceling] = useState(null);
    const [amending, setAmending] = useState(false);
    const [cancelingApproved, setCancelingApproved] = useState(null);
    const approval = useRecordApproval(order?.approval?.instanceId);
    const reload = useCallback(async () => {
        try {
            setOrder(await operationsApi.get(id));
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
    const canRun = o.source === 'System' && ((!order.awaitingApproval && order.canEdit) || approval.detail?.summary.status === 'Failed');
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
    return (_jsxs(Box, { children: [_jsx(RecordHero, { tone: "delivery", icon: _jsx(LocalShippingOutlinedIcon, {}), kind: t('operations.delivery.kind'), number: o.orderNo, status: _jsxs(_Fragment, { children: [_jsx(DeliveryStatusBadge, { row: o }), o.source === 'Crm' && _jsx(Badge, { tone: "neutral", children: t('operations.delivery.fromCrm') })] }), actions: _jsxs(_Fragment, { children: [order.canEdit && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditOutlinedIcon, {}), onClick: () => setWizard(true), children: t('common.edit') })), order.canSubmit && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), disabled: busy, onClick: () => void run(() => operationsApi.submit(o.id)), children: t('operations.delivery.submit') })), canRun && (_jsx(RunProcessButton, { screen: "operations.delivery_order", recordId: o.id, title: `${o.orderNo} — ${o.projectName}`, onStarted: () => void reload().then(() => approval.reload()) })), order.canCancel && (_jsx(Button, { variant: "outlined", startIcon: _jsx(CancelOutlinedIcon, {}), onClick: () => setCanceling(''), children: t('operations.delivery.cancel') })), order.canAmend && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditNoteOutlinedIcon, {}), onClick: () => setAmending(true), children: t('operations.delivery.amend.action') })), order.canCancelApproved && (_jsx(Button, { variant: "outlined", color: "error", startIcon: _jsx(CancelOutlinedIcon, {}), onClick: () => setCancelingApproved(''), children: t('operations.delivery.amend.cancelAction') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: ar ? 'scaleX(-1)' : 'none' } }), onClick: () => navigate('/operations/delivery-orders'), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), order.amendedAt && o.status === 'Delivered' && (_jsxs(Alert, { severity: "info", sx: { mb: 1.5 }, children: [t('operations.delivery.amend.amendedBy', { by: order.amendedByName, date: date(order.amendedAt) }), " \u2014 ", order.amendNote] })), o.status === 'CanceledAfterApproval' && (_jsxs(Alert, { severity: "warning", sx: { mb: 1.5 }, children: [t('operations.delivery.amend.canceledBy', { by: order.canceledByName, date: date(order.canceledAt) }), " \u2014 ", order.lastComment] })), o.source === 'System' && o.status === 'UnderPreparation' && order.awaitingApproval && (_jsx(Alert, { severity: "info", sx: { mb: `${tokens.gap}px` }, children: t('operations.delivery.creatorHint') })), o.status === 'Delivered' && o.source === 'System' && (_jsx(Alert, { severity: "success", sx: { mb: `${tokens.gap}px` }, children: t('operations.delivery.deliveredHint') })), order.approval && (_jsx(ApprovalBar, { status: order.approval, detail: approval.detail, loading: approval.loading, onChanged: () => {
                    void approval.reload();
                    void reload();
                } })), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }, children: [_jsxs(SummaryCard, { children: [_jsx(SummaryBand, { tone: "delivery", label: t('commercial.col.project'), value: o.projectName, size: 21, chips: [...(o.customerName ? [{ label: o.customerName }] : []), ...(o.projectManager ? [{ label: `${t('commercial.col.manager')}: ${o.projectManager}` }] : [])] }), _jsx(SummaryGroup, { title: t('operations.delivery.value'), color: tokens.success, children: _jsx(SummaryFact, { icon: _jsx(PaymentsOutlinedIcon, {}), color: tokens.success, label: t('operations.delivery.monthlyTotal'), value: `${sar(o.totalPrice)} ${t('operations.delivery.sarUnit')}`, sub: [t('operations.delivery.workersCount', { count: o.workers }), ...(o.specialPrices > 0 ? [t('operations.delivery.specialCount', { count: o.specialPrices })] : [])].join(' · ') }) }), _jsx(SummaryGroup, { title: t('operations.delivery.dates'), color: tokens.info, children: _jsx(SummaryDates, { items: [
                                        { icon: _jsx(LocalShippingOutlinedIcon, {}), color: '#1f6fd1', label: t('operations.delivery.col.deliverOn'), value: date(o.deliverOn) },
                                        { icon: _jsx(EventOutlinedIcon, {}), color: '#7c4dcc', label: t('operations.delivery.col.startOn'), value: date(o.startOn) },
                                    ] }) }), _jsx(SummaryGroup, { title: t('operations.delivery.receiving'), color: tokens.gold, children: _jsx(SummaryFact, { icon: _jsx(BadgeOutlinedIcon, {}), color: tokens.gold, label: t('operations.delivery.receiverName'), value: o.receiverName, sub: order.receiverTitle }) }), order.delayReason && _jsx(SummaryNote, { title: t('operations.delivery.delayReason'), children: order.delayReason }), order.notes && _jsx(SummaryNote, { title: t('operations.delivery.notes'), children: order.notes }), order.lastComment && _jsx(SummaryNote, { title: t('operations.delivery.lastComment'), children: order.lastComment })] }), _jsx(Stack, { spacing: `${tokens.gap}px`, sx: { minWidth: 0 }, children: _jsxs(Box, { sx: { ...card, p: 2.25, minWidth: 0 }, children: [_jsx(SectionTitle, { icon: _jsx(GroupsOutlinedIcon, {}), title: t('operations.delivery.tabs.workers', { count: order.lines.length }) }), _jsx(TableContainer, { sx: { border: `1px solid ${tokens.gray100}`, borderRadius: `${tokens.radius}px` }, children: _jsxs(Table, { size: "small", sx: {
                                            '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even) .MuiTableCell-body': { bgcolor: '#fff' },
                                            '& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-body': { borderBottom: 0 },
                                            '& .MuiTableCell-root': { px: 1.25 },
                                            '& .MuiTableCell-body': { py: 1.1 },
                                        }, children: [_jsx(TableHead, { sx: {
                                                    '& .MuiTableRow-root': { background: recordTones.delivery.dark },
                                                    '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': {
                                                        bgcolor: 'transparent',
                                                        color: '#fff',
                                                        fontWeight: 700,
                                                        fontSize: 12.5,
                                                        borderBottom: 0,
                                                        borderRadius: 0,
                                                    },
                                                }, children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { children: t('commercial.prices.col.who') }), _jsx(TableCell, { children: t('commercial.prices.col.package') }), _jsx(TableCell, { children: t('operations.delivery.col.price') }), _jsx(TableCell, { children: t('operations.delivery.col.workerStart') }), o.source === 'Crm' && _jsx(TableCell, { children: t('commercial.prices.col.workStart') })] }) }), _jsx(TableBody, { children: order.lines.map((l) => (_jsxs(TableRow, { hover: true, sx: { cursor: l.workerId ? 'pointer' : 'default' }, onClick: () => l.workerId && navigate(`/workforce/workers/${l.workerId}`), children: [_jsx(TableCell, { sx: { minWidth: 210 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: tokens.navy50, color: tokens.navy700, fontSize: 12, fontWeight: 800 }, children: initials(l.name) }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: l.name }), _jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: [_jsx("span", { dir: "ltr", children: l.workerNo }), l.iqamaNo && (_jsxs(_Fragment, { children: [' · ', t('operations.delivery.iqamaShort'), " ", _jsx("span", { dir: "ltr", children: l.iqamaNo })] }))] })] })] }) }), _jsxs(TableCell, { children: [(ar ? l.professionAr : l.professionEn) ?? '—', _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: (ar ? l.nationalityAr : l.nationalityEn) ?? '—' })] }), _jsx(TableCell, { children: l.isSpecialPrice ? (_jsxs(_Fragment, { children: [_jsx(Badge, { tone: "warning", children: t('commercial.prices.status.Special') }), l.specialReason && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: l.specialReason })] })) : l.packageNo ? (_jsx(Badge, { tone: "success", children: l.packageNo })) : ('—') }), _jsxs(TableCell, { sx: { whiteSpace: 'nowrap' }, children: [_jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }, children: sar(l.totalPrice) }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: [
                                                                        t('operations.delivery.pricePart.salary', { value: sar(l.salary) }),
                                                                        ...(l.housing ? [t('operations.delivery.pricePart.housing', { value: sar(l.housing) })] : []),
                                                                        ...(l.transport ? [t('operations.delivery.pricePart.transport', { value: sar(l.transport) })] : []),
                                                                    ].join(' · ') })] }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: l.startedOn ? (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.5, color: tokens.success, fontSize: 12.5, fontWeight: 700 }, children: [_jsx(CheckCircleOutlineIcon, { sx: { fontSize: 17 } }), date(l.startedOn)] })) : (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.5, color: tokens.warning, fontSize: 12.5, fontWeight: 700 }, children: [_jsx(ScheduleOutlinedIcon, { sx: { fontSize: 17 } }), date(l.startOn ?? o.startOn)] })) }), o.source === 'Crm' && _jsx(TableCell, { dir: "ltr", children: l.workStartNo ?? '—' })] }, l.id))) })] }) }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mt: 2, fontSize: 12.5, color: tokens.gray500 }, children: [_jsx(InfoOutlinedIcon, { sx: { fontSize: 16 } }), o.source === 'Crm' ? t('operations.delivery.crmNote') : t('operations.delivery.parallelNote')] })] }) })] }), canceling !== null && (_jsxs(Dialog, { open: true, onClose: () => setCanceling(null), fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('operations.delivery.cancelTitle', { no: o.orderNo }) }), _jsx(DialogContent, { dividers: true, children: _jsx(TextField, { label: t('operations.delivery.cancelReason'), value: canceling, onChange: (e) => setCanceling(e.target.value), fullWidth: true, multiline: true, minRows: 2 }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setCanceling(null), children: t('common.close') }), _jsx(Button, { variant: "contained", color: "error", disabled: busy, onClick: () => void run(async () => {
                                    await operationsApi.cancel(o.id, canceling.trim() || null);
                                    setCanceling(null);
                                }), children: t('operations.delivery.cancel') })] })] })), amending && _jsx(DeliveryAmendDialog, { order: order, onClose: () => setAmending(false), onSaved: () => void run(async () => setAmending(false)) }), cancelingApproved !== null && (_jsxs(Dialog, { open: true, onClose: () => setCancelingApproved(null), fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('operations.delivery.amend.cancelTitle', { no: o.orderNo }) }), _jsxs(DialogContent, { dividers: true, children: [_jsx(Alert, { severity: "warning", sx: { mb: 2 }, children: t('operations.delivery.amend.cancelHint') }), _jsx(TextField, { required: true, label: t('operations.delivery.amend.reason'), value: cancelingApproved, onChange: (e) => setCancelingApproved(e.target.value), fullWidth: true, multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 500 } } })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setCancelingApproved(null), children: t('common.close') }), _jsx(Button, { variant: "contained", color: "error", disabled: busy || !cancelingApproved.trim(), onClick: () => void run(async () => {
                                    await operationsApi.cancelApproved(o.id, cancelingApproved.trim());
                                    setCancelingApproved(null);
                                }), children: t('operations.delivery.amend.cancelAction') })] })] })), wizard && (_jsx(DeliveryOrderWizard, { id: o.id, onClose: () => (editing ? navigate(`/operations/delivery-orders/${o.id}`) : setWizard(false)), onSaved: (_, failed) => {
                    if (editing) {
                        navigate(`/operations/delivery-orders/${o.id}${failed ? `?error=errors.${failed.replace('.', '_')}` : ''}`);
                        return;
                    }
                    setWizard(false);
                    setError(failed ? `errors.${failed.replace('.', '_')}` : null);
                    void reload().then(() => approval.reload());
                } }))] }));
}
/**
 * Changing a delivered order (its own permission): the receiver and the notes, and each worker's start of work and
 * monthly price (a new price is a special price with its reason), with the reason for the change. The work periods
 * follow on the server.
 */
function DeliveryAmendDialog({ order, onClose, onSaved }) {
    const { t } = useTranslation();
    const o = order.summary;
    const [receiverName, setReceiverName] = useState(o.receiverName);
    const [receiverTitle, setReceiverTitle] = useState(order.receiverTitle ?? '');
    const [notes, setNotes] = useState(order.notes ?? '');
    const [lines, setLines] = useState(order.lines.map((l) => ({ lineId: l.id, name: l.name, workerNo: l.workerNo, startedOn: l.startedOn ?? '', price: String(l.totalPrice), was: l.totalPrice, specialReason: '' })));
    const [why, setWhy] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const set = (i, change) => setLines((all) => all.map((l, n) => (n === i ? { ...l, ...change } : l)));
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
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "md", children: [_jsx(DialogTitle, { children: t('operations.delivery.amend.title', { no: o.orderNo }) }), _jsx(DialogContent, { dividers: true, children: _jsxs(Stack, { sx: { gap: 2 }, children: [_jsx(Alert, { severity: "info", children: t('operations.delivery.amend.hint') }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 2 }, children: [_jsx(TextField, { required: true, label: t('operations.delivery.amend.receiver'), value: receiverName, onChange: (e) => setReceiverName(e.target.value), sx: { flex: 1 } }), _jsx(TextField, { label: t('operations.delivery.amend.receiverTitle'), value: receiverTitle, onChange: (e) => setReceiverTitle(e.target.value), sx: { flex: 1 } })] }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('operations.delivery.amend.worker') }), _jsx(TableCell, { children: t('operations.delivery.amend.startedOn') }), _jsx(TableCell, { children: t('operations.delivery.amend.price') }), _jsx(TableCell, { children: t('operations.delivery.amend.specialReason') })] }) }), _jsx(TableBody, { children: lines.map((l, i) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 600 }, children: _jsx("bdi", { children: l.name }) }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: _jsx("bdi", { children: l.workerNo }) })] }), _jsx(TableCell, { children: _jsx(DateField, { size: "small", value: l.startedOn, onChange: (e) => set(i, { startedOn: e.target.value }) }) }), _jsx(TableCell, { children: _jsx(TextField, { size: "small", type: "number", value: l.price, onChange: (e) => set(i, { price: e.target.value }), slotProps: { htmlInput: { min: 0, step: 0.01 } }, sx: { width: 130 } }) }), _jsx(TableCell, { children: _jsx(TextField, { size: "small", disabled: Number(l.price) === l.was, required: Number(l.price) !== l.was, value: l.specialReason, onChange: (e) => set(i, { specialReason: e.target.value }) }) })] }, l.lineId))) })] }) }), _jsx(TextField, { label: t('operations.delivery.notes'), value: notes, onChange: (e) => setNotes(e.target.value), multiline: true, minRows: 2 }), _jsx(TextField, { required: true, label: t('operations.delivery.amend.reason'), value: why, onChange: (e) => setWhy(e.target.value), multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 500 } } }), error && _jsx(Alert, { severity: "error", children: t(error) })] }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.close') }), _jsx(Button, { variant: "contained", disabled: busy || !why.trim() || !receiverName.trim() || lines.some((l) => !l.startedOn), onClick: () => void save(), children: t('operations.delivery.amend.save') })] })] }));
}
