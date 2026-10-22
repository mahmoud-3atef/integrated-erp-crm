import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Switch, TextField } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { returnsApi } from '../../api/operations';
import { useCrumb } from '../../app/breadcrumbs';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { RecordHero, SectionTitle, SummaryBand, SummaryCard, SummaryFact, SummaryGroup, SummaryNote } from '../../components/RecordLayout';
import { Badge } from '../../components/ui';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { useStateName } from './movements/movementMeta';
import { daysBetween, Journey, JourneyLine, WorkerFact, WorkerHead } from './recordParts';
import { ReturnStatusBadge } from './returns';
import { ReturnOrderWizard } from './ReturnOrderWizard';
import { DateField } from '../../components/DateField';
const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };
// Where the worker comes back from, by how they entered the housing.
const origin = { ReturnedWorker: 'Work', NewArrival: 'New', BackFromVacation: 'Vacation' };
/**
 * One return order — a single worker, so the page centres on them: the band with the number and actions, the approval
 * bar, the worker's card with the way back (from the project to the housing, with the days worked), the approval's
 * history, and beside them the reason, the customer's wish and the salary.
 */
export function ReturnOrderDetailPage({ editing = false } = {}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const [params] = useSearchParams();
    const { ar, date } = useCommercialFormat();
    const stateName = useStateName();
    const [order, setOrder] = useState(null);
    useCrumb(order?.summary.orderNo, `/operations/return-orders/${id}`);
    const [wizard, setWizard] = useState(editing);
    const [error, setError] = useState(params.get('error'));
    const [busy, setBusy] = useState(false);
    const [canceling, setCanceling] = useState(null);
    const [amending, setAmending] = useState(false);
    const [cancelingApproved, setCancelingApproved] = useState(null);
    const approval = useRecordApproval(order?.approval?.instanceId);
    const reload = useCallback(async () => {
        try {
            setOrder(await returnsApi.get(id));
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
    const from = origin[o.entry];
    const worked = daysBetween(order.workStartedOn, o.arrivedOn);
    return (_jsxs(Box, { children: [_jsx(RecordHero, { tone: "return", icon: _jsx(KeyboardReturnOutlinedIcon, {}), kind: t('operations.return.kind'), number: o.orderNo, status: _jsxs(_Fragment, { children: [_jsx(ReturnStatusBadge, { row: o }), o.source === 'Crm' && _jsx(Badge, { tone: "neutral", children: t('operations.delivery.fromCrm') })] }), actions: _jsxs(_Fragment, { children: [order.canEdit && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditOutlinedIcon, {}), onClick: () => setWizard(true), children: t('common.edit') })), order.canSubmit && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), disabled: busy, onClick: () => void run(() => returnsApi.submit(o.id)), children: t('operations.delivery.submit') })), canRun && (_jsx(RunProcessButton, { screen: "operations.return_order", recordId: o.id, title: `${o.orderNo} — ${o.name}`, onStarted: () => void reload().then(() => approval.reload()) })), order.canCancel && (_jsx(Button, { variant: "outlined", startIcon: _jsx(CancelOutlinedIcon, {}), onClick: () => setCanceling(''), children: t('operations.delivery.cancel') })), order.canAmend && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditNoteOutlinedIcon, {}), onClick: () => setAmending(true), children: t('operations.return.amend.action') })), order.canCancelApproved && (_jsx(Button, { variant: "outlined", color: "error", startIcon: _jsx(CancelOutlinedIcon, {}), onClick: () => setCancelingApproved(''), children: t('operations.return.amend.cancelAction') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: ar ? 'scaleX(-1)' : 'none' } }), onClick: () => navigate('/operations/return-orders'), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), order.amendedAt && o.status === 'Completed' && (_jsxs(Alert, { severity: "info", sx: { mb: 1.5 }, children: [t('operations.return.amend.amendedBy', { by: order.amendedByName, date: date(order.amendedAt) }), " \u2014 ", order.amendNote] })), o.status === 'CanceledAfterApproval' && (_jsxs(Alert, { severity: "warning", sx: { mb: 1.5 }, children: [t('operations.return.amend.canceledBy', { by: order.canceledByName, date: date(order.canceledAt) }), " \u2014 ", order.lastComment] })), o.source === 'System' && o.status === 'UnderPreparation' && order.awaitingApproval && (_jsx(Alert, { severity: "info", sx: { mb: `${tokens.gap}px` }, children: t('operations.return.creatorHint') })), o.source === 'System' && o.status === 'Completed' && (_jsx(Alert, { severity: "success", sx: { mb: `${tokens.gap}px` }, children: t('operations.return.completedHint') })), order.approval && (_jsx(ApprovalBar, { status: order.approval, detail: approval.detail, loading: approval.loading, onChanged: () => {
                    void approval.reload();
                    void reload();
                } })), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }, children: [_jsxs(SummaryCard, { children: [_jsx(SummaryBand, { tone: "return", label: t('operations.return.col.reason'), value: t(`operations.return.reasons.${o.reason}`), size: 21, chips: [{ label: t(`operations.return.entry.${o.entry}`) }] }), order.reasonNotes && _jsx(SummaryNote, { title: t('operations.return.reasonNotes'), children: order.reasonNotes }), _jsx(SummaryGroup, { title: t('operations.return.customerWish'), color: tokens.info, children: _jsx(SummaryFact, { icon: _jsx(QuestionAnswerOutlinedIcon, {}), color: tokens.info, label: t('operations.return.customerWish'), value: o.customerWish ? t(`operations.return.wishes.${o.customerWish}`) : t('operations.return.wishPending') }) }), _jsx(SummaryGroup, { title: t('operations.return.salaryInHousing'), color: o.stopSalary ? tokens.danger : tokens.success, children: _jsx(SummaryFact, { icon: _jsx(PaymentsOutlinedIcon, {}), color: o.stopSalary ? tokens.danger : tokens.success, label: t('operations.return.salaryInHousing'), value: o.stopSalary ? t('operations.return.salaryStops') : t('operations.return.salaryPaid') }) }), order.delayReason && _jsx(SummaryNote, { title: t('operations.delivery.delayReason'), children: order.delayReason }), order.notes && _jsx(SummaryNote, { title: t('operations.delivery.notes'), children: order.notes }), order.lastComment && _jsx(SummaryNote, { title: t('operations.delivery.lastComment'), children: order.lastComment })] }), _jsx(Stack, { spacing: `${tokens.gap}px`, sx: { minWidth: 0 }, children: _jsxs(Box, { sx: { ...card, overflow: 'hidden' }, children: [_jsx(WorkerHead, { tone: "return", label: t('operations.return.col.worker'), name: o.name, workerId: o.workerId, workerNo: o.workerNo, badge: _jsx(Badge, { tone: "info", children: t(`operations.return.entry.${o.entry}`) }), facts: _jsxs(_Fragment, { children: [_jsx(WorkerFact, { icon: _jsx(BadgeOutlinedIcon, {}), label: t('operations.delivery.col.iqama'), value: order.iqamaNo ?? '—', ltr: true }), _jsx(WorkerFact, { icon: _jsx(EngineeringOutlinedIcon, {}), label: t('operations.return.profession'), value: (ar ? order.professionAr : order.professionEn) ?? '—' }), _jsx(WorkerFact, { icon: _jsx(PublicOutlinedIcon, {}), label: t('operations.return.nationality'), value: (ar ? order.nationalityAr : order.nationalityEn) ?? '—' })] }) }), _jsxs(Box, { sx: { px: 2.5, pt: 2, pb: 2.5, borderTop: `1px solid ${tokens.gray100}` }, children: [_jsx(SectionTitle, { icon: _jsx(RouteOutlinedIcon, {}), title: t('operations.return.journey') }), _jsx(Journey, { from: { state: from, label: stateName(from), sub: o.projectName, lines: _jsx(JourneyLine, { label: t('operations.return.workStarted'), children: date(order.workStartedOn) }) }, to: { state: 'Housing', label: stateName('Housing'), sub: o.housingName, lines: _jsx(JourneyLine, { label: t('operations.return.col.arrivedOn'), children: date(o.arrivedOn) }) }, pill: worked !== null ? t('operations.return.workedDays', { count: worked }) : undefined })] })] }) })] }), canceling !== null && (_jsxs(Dialog, { open: true, onClose: () => setCanceling(null), fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('operations.delivery.cancelTitle', { no: o.orderNo }) }), _jsx(DialogContent, { dividers: true, children: _jsx(TextField, { label: t('operations.delivery.cancelReason'), value: canceling, onChange: (e) => setCanceling(e.target.value), fullWidth: true, multiline: true, minRows: 2 }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setCanceling(null), children: t('common.close') }), _jsx(Button, { variant: "contained", color: "error", disabled: busy, onClick: () => void run(async () => {
                                    await returnsApi.cancel(o.id, canceling.trim() || null);
                                    setCanceling(null);
                                }), children: t('operations.delivery.cancel') })] })] })), amending && _jsx(AmendDialog, { order: order, onClose: () => setAmending(false), onSaved: () => void run(async () => setAmending(false)) }), cancelingApproved !== null && (_jsxs(Dialog, { open: true, onClose: () => setCancelingApproved(null), fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('operations.return.amend.cancelTitle', { no: o.orderNo }) }), _jsxs(DialogContent, { dividers: true, children: [_jsx(Alert, { severity: "warning", sx: { mb: 2 }, children: t('operations.return.amend.cancelHint') }), _jsx(TextField, { required: true, label: t('operations.return.amend.reason'), value: cancelingApproved, onChange: (e) => setCancelingApproved(e.target.value), fullWidth: true, multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 500 } } })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setCancelingApproved(null), children: t('common.close') }), _jsx(Button, { variant: "contained", color: "error", disabled: busy || !cancelingApproved.trim(), onClick: () => void run(async () => {
                                    await returnsApi.cancelApproved(o.id, cancelingApproved.trim());
                                    setCancelingApproved(null);
                                }), children: t('operations.return.amend.cancelAction') })] })] })), wizard && (_jsx(ReturnOrderWizard, { id: o.id, onClose: () => (editing ? navigate(`/operations/return-orders/${o.id}`) : setWizard(false)), onSaved: (_, failed) => {
                    if (editing) {
                        navigate(`/operations/return-orders/${o.id}${failed ? `?error=errors.${failed.replace('.', '_')}` : ''}`);
                        return;
                    }
                    setWizard(false);
                    setError(failed ? `errors.${failed.replace('.', '_')}` : null);
                    void reload().then(() => approval.reload());
                } }))] }));
}
/**
 * Changing an approved order (its own permission): the arrival day, the reason, the salary in housing, the room and the
 * notes, with the reason for the change. The housing period and the room move with it on the server.
 */
function AmendDialog({ order, onClose, onSaved }) {
    const { t, i18n } = useTranslation();
    const o = order.summary;
    const [arrivedOn, setArrivedOn] = useState(o.arrivedOn ?? '');
    const [reason, setReason] = useState(o.reason);
    const [reasonNotes, setReasonNotes] = useState(order.reasonNotes ?? '');
    const [stopSalary, setStopSalary] = useState(o.stopSalary);
    const [roomId, setRoomId] = useState(order.roomId ?? '');
    const [rooms, setRooms] = useState([]);
    const [notes, setNotes] = useState(order.notes ?? '');
    const [why, setWhy] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        returnsApi.rooms().then(setRooms).catch(() => setRooms([]));
    }, []);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await returnsApi.amend(o.id, {
                arrivedOn, reason, reasonNotes: reasonNotes.trim() || null, stopSalary, housingName: roomId ? null : o.housingName, notes: notes.trim() || null,
                roomId: roomId || null, amendReason: why.trim(),
            });
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('operations.return.amend.title', { no: o.orderNo }) }), _jsx(DialogContent, { dividers: true, children: _jsxs(Stack, { sx: { gap: 2 }, children: [_jsx(Alert, { severity: "info", children: t('operations.return.amend.hint') }), _jsx(DateField, { required: true, label: t('operations.return.col.arrivedOn'), value: arrivedOn, onChange: (e) => setArrivedOn(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { select: true, required: true, label: t('operations.return.col.reason'), value: reason, onChange: (e) => setReason(e.target.value), children: ['ClientNoReason', 'WorkerRefuses', 'Sick', 'WorkerAbused', 'ContractCanceled', 'Other'].map((r) => (_jsx(MenuItem, { value: r, children: t(`operations.return.reasons.${r}`) }, r))) }), _jsx(TextField, { label: t('operations.return.reasonNotes'), value: reasonNotes, onChange: (e) => setReasonNotes(e.target.value), multiline: true, minRows: 2 }), _jsxs(TextField, { select: true, label: t('operations.return.room'), value: roomId, onChange: (e) => setRoomId(e.target.value), children: [_jsx(MenuItem, { value: "", children: "\u2014" }), rooms.map((r) => (_jsxs(MenuItem, { value: r.id, disabled: r.free <= 0 && r.id !== order.roomId, children: [_jsx("bdi", { children: r.label }), ` (${r.free})`] }, r.id)))] }), _jsx(FormControlLabel, { control: _jsx(Switch, { checked: stopSalary, onChange: (e) => setStopSalary(e.target.checked) }), label: t('operations.return.stopSalary') }), _jsx(TextField, { label: t('operations.delivery.notes'), value: notes, onChange: (e) => setNotes(e.target.value), multiline: true, minRows: 2 }), _jsx(TextField, { required: true, label: t('operations.return.amend.reason'), value: why, onChange: (e) => setWhy(e.target.value), multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 500 } } }), error && _jsx(Alert, { severity: "error", children: t(error) })] }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.close') }), _jsx(Button, { variant: "contained", disabled: busy || !why.trim() || !arrivedOn, onClick: () => void save(), dir: i18n.dir(), children: t('operations.return.amend.save') })] })] }));
}
