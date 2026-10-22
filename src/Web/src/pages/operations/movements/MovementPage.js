import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { movementsApi } from '../../../api/movements';
import { useCrumb } from '../../../app/breadcrumbs';
import { tokens } from '../../../app/theme';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { RecordHero, SectionTitle, SummaryBand, SummaryCard, SummaryFact, SummaryGroup, SummaryNote } from '../../../components/RecordLayout';
import { ApprovalBar, useRecordApproval, ShownStatus } from '../../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { sar } from '../../operations/delivery';
import { Journey, JourneyLine, WorkerFact, WorkerHead } from '../recordParts';
import { ActionDialog } from './ActionDialog';
import { gradient, lookOf, MovementStatusBadge, typeLook, useStateName } from './movementMeta';
import { DateField } from '../../../components/DateField';
const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };
/**
 * One worker action, in its type's colors: the band with its number and actions, the approval bar, the worker with the
 * change drawn (from where to where, and when), the worker's timeline and the approval's history; beside them the
 * action and its details.
 */
export function MovementPage({ editing = false } = {}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const { ar, date } = useCommercialFormat();
    const stateName = useStateName();
    const [m, setM] = useState(null);
    useCrumb(m?.movementNo, `/operations/movements/${id}`);
    const [wizard, setWizard] = useState(editing);
    const [canceling, setCanceling] = useState(null);
    const [amending, setAmending] = useState(false);
    const [cancelingApproved, setCancelingApproved] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const approval = useRecordApproval(m?.approval?.instanceId);
    const reload = useCallback(async () => {
        try {
            setM(await movementsApi.get(id));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    if (!m) {
        return _jsx(ErrorMessage, { messageKey: error });
    }
    const color = typeLook[m.type].from;
    const toSub = m.opensPeriod === 'Work' || m.opensPeriod === 'ClientVacation' ? (m.projectName ?? m.fromProjectName) : m.place;
    return (_jsxs(Box, { children: [_jsx(RecordHero, { tone: "movement", background: gradient(m.type), icon: typeLook[m.type].icon, kind: t(`movements.types.${m.type}`), number: m.movementNo, status: _jsx(Box, { sx: { bgcolor: '#fff', borderRadius: 99, px: 0.25 }, children: _jsx(ShownStatus, { approval: approval.detail, children: _jsx(MovementStatusBadge, { status: m.status }) }) }), actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(PersonOutlineIcon, {}), onClick: () => navigate(`/workforce/workers/${m.workerId}?tab=periods`), children: t('movements.openWorker') }), m.canEdit && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "contained", startIcon: _jsx(EditOutlinedIcon, {}), onClick: () => setWizard(true), children: t('movements.editAndResend') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(BlockOutlinedIcon, {}), onClick: () => setCanceling(''), children: t('movements.cancel') })] })), m.canAmend && (_jsx(Button, { variant: "outlined", startIcon: _jsx(EditNoteOutlinedIcon, {}), onClick: () => setAmending(true), children: t('movements.amend.action') })), m.canCancelApproved && (_jsx(Button, { variant: "outlined", color: "error", startIcon: _jsx(CancelOutlinedIcon, {}), onClick: () => setCancelingApproved(''), children: t('movements.amend.cancelAction') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: ar ? 'scaleX(-1)' : 'none' } }), onClick: () => navigate('/operations/movements'), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), m.lastComment && (m.status === 'Returned' || m.status === 'Rejected') && (_jsxs(Alert, { severity: m.status === 'Rejected' ? 'error' : 'warning', sx: { mb: `${tokens.gap}px` }, children: [t('operations.delivery.lastComment'), ": ", m.lastComment] })), m.amendedAt && m.status === 'Executed' && (_jsxs(Alert, { severity: "info", sx: { mb: `${tokens.gap}px` }, children: [t('movements.amend.amendedBy', { by: m.amendedByName, date: date(m.amendedAt) }), " \u2014 ", m.amendNote] })), m.status === 'CanceledAfterApproval' && (_jsxs(Alert, { severity: "warning", sx: { mb: `${tokens.gap}px` }, children: [t('movements.amend.canceledBy', { by: m.canceledByName, date: date(m.canceledAt) }), " \u2014 ", m.lastComment] })), m.approval && (_jsx(ApprovalBar, { status: m.approval, detail: approval.detail, loading: approval.loading, onChanged: () => {
                    void approval.reload();
                    void reload();
                } })), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }, children: [_jsxs(SummaryCard, { children: [_jsx(SummaryBand, { tone: "movement", background: gradient(m.type), label: t('movements.action'), value: t(`movements.types.${m.type}`), size: 21, chips: [{ label: `${t(`movements.dateLabel.${m.type}`)}: ${date(m.effectiveOn)}` }] }), _jsxs(SummaryGroup, { title: t('movements.details'), color: color, children: [_jsx(SummaryFact, { icon: _jsx(EventOutlinedIcon, {}), color: color, label: t(`movements.dateLabel.${m.type}`), value: date(m.effectiveOn), sub: m.expectedReturnOn ? `${t('movements.expectedReturn')}: ${date(m.expectedReturnOn)}` : null }), m.vacationKind && _jsx(SummaryFact, { icon: _jsx(HotelOutlinedIcon, {}), color: color, label: t('movements.vacationKind'), value: t(`movements.vacation.${m.vacationKind}`) }), m.returnTo && _jsx(SummaryFact, { icon: _jsx(RouteOutlinedIcon, {}), color: color, label: t('movements.returnTo'), value: t(`movements.return.${m.returnTo}`), sub: m.opensPeriod === 'Work' ? m.projectName : null }), m.suspensionReason && _jsx(SummaryFact, { icon: _jsx(ReportProblemOutlinedIcon, {}), color: color, label: t('movements.suspensionReason'), value: t(`movements.suspension.${m.suspensionReason}`) }), m.exitKind && _jsx(SummaryFact, { icon: _jsx(ReportProblemOutlinedIcon, {}), color: color, label: t('movements.exitKind'), value: t(`movements.exit.${m.exitKind}`) }), m.place && _jsx(SummaryFact, { icon: _jsx(HotelOutlinedIcon, {}), color: color, label: t(m.type === 'Absconding' ? 'movements.lastPlace' : 'movements.housingPlace'), value: m.place })] }), m.opensPeriod === 'Work' && (_jsx(SummaryGroup, { title: t('operations.delivery.value'), color: tokens.success, children: _jsx(SummaryFact, { icon: _jsx(PaymentsOutlinedIcon, {}), color: tokens.success, label: m.isSpecialPrice ? t('movements.specialPrice') : t('movements.packagePrice'), value: `${sar(m.totalPrice)} ${t('operations.delivery.sarUnit')}`, sub: m.specialReason ?? m.packageNo }) })), m.opensPeriod === 'Housing' && (_jsx(SummaryGroup, { title: t('movements.salaryInHousing'), color: m.paySalary ? tokens.success : tokens.danger, children: _jsx(SummaryFact, { icon: _jsx(PaymentsOutlinedIcon, {}), color: m.paySalary ? tokens.success : tokens.danger, label: t('movements.salaryInHousing'), value: m.paySalary ? t('movements.paid') : t('movements.stopped') }) })), m.delayReason && _jsx(SummaryNote, { title: t('movements.delayReason'), children: m.delayReason }), m.notes && _jsx(SummaryNote, { title: t('movements.notes'), children: m.notes })] }), _jsxs(Stack, { spacing: `${tokens.gap}px`, sx: { minWidth: 0 }, children: [_jsxs(Box, { sx: { ...card, overflow: 'hidden' }, children: [_jsx(WorkerHead, { tone: "movement", label: t('operations.return.col.worker'), name: m.workerName, workerId: m.workerId, workerNo: m.workerNo, facts: _jsxs(_Fragment, { children: [_jsx(WorkerFact, { icon: _jsx(BadgeOutlinedIcon, {}), label: t('operations.delivery.col.iqama'), value: m.iqamaNo ?? '—', ltr: true }), _jsx(WorkerFact, { icon: _jsx(EventOutlinedIcon, {}), label: t(`movements.dateLabel.${m.type}`), value: date(m.effectiveOn) }), _jsx(WorkerFact, { icon: _jsx(ManageAccountsOutlinedIcon, {}), label: m.executedAt ? t('movements.executed') : t('movements.created'), value: m.executedAt ? (m.executedByName ?? '—') : m.createdByName })] }) }), _jsxs(Box, { sx: { px: 2.5, pt: 2, pb: 2.5, borderTop: `1px solid ${tokens.gray100}` }, children: [_jsx(SectionTitle, { icon: _jsx(RouteOutlinedIcon, {}), title: t('movements.journey') }), _jsx(Journey, { from: { state: m.fromPlacement, label: stateName(m.fromPlacement), sub: m.fromProjectName }, to: { state: m.opensPeriod, label: stateName(m.opensPeriod), sub: toSub, lines: _jsx(JourneyLine, { label: t(`movements.dateLabel.${m.type}`), children: date(m.effectiveOn) }) }, pill: t(`movements.types.${m.type}`), pillIcon: typeLook[m.type].icon })] })] }), _jsxs(Box, { sx: { ...card, p: 2.25 }, children: [_jsx(SectionTitle, { icon: _jsx(TimelineOutlinedIcon, {}), title: t('movements.timeline') }), _jsxs(Box, { sx: { position: 'relative' }, children: [_jsx(Box, { sx: { position: 'absolute', top: 8, bottom: 8, insetInlineStart: 15, width: 2, bgcolor: tokens.gray100 } }), m.timeline.map((p) => {
                                                const look = lookOf(p.kind);
                                                const mine = p.sourceId === m.id;
                                                return (_jsxs(Stack, { direction: "row", sx: { position: 'relative', gap: 1.5, mb: 1.5 }, children: [_jsx(Box, { sx: {
                                                                width: 32,
                                                                height: 32,
                                                                flexShrink: 0,
                                                                borderRadius: '50%',
                                                                display: 'grid',
                                                                placeItems: 'center',
                                                                color: mine ? '#fff' : look.color,
                                                                background: mine ? gradient(m.type) : look.bg,
                                                                border: '2px solid #fff',
                                                                boxShadow: mine ? `0 0 0 3px ${color}40` : 'none',
                                                                '& svg': { fontSize: 17 },
                                                            }, children: look.icon }), _jsxs(Stack, { direction: "row", sx: { flex: 1, minWidth: 0, gap: 2, alignItems: 'center', p: mine ? 1 : 0, borderRadius: 2, bgcolor: mine ? `${color}0d` : 'transparent' }, children: [_jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsxs(Typography, { sx: { fontSize: 13, fontWeight: 800, color: look.color }, children: [stateName(p.kind), p.projectName && _jsxs("span", { style: { color: tokens.gray600, fontWeight: 600 }, children: [" \u00B7 ", p.projectName] })] }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: p.fromOldSystem ? t('workforce.periods.oldSystem') : p.sourceNo })] }), _jsxs(Typography, { sx: { fontSize: 12, color: tokens.gray500, whiteSpace: 'nowrap' }, children: [date(p.startsOn), " \u2013 ", p.endsOn ? date(p.endsOn) : t('movements.now')] })] })] }, p.id));
                                            }), m.timeline.length === 0 && _jsx(Typography, { sx: { color: tokens.gray500, fontSize: 13 }, children: t('movements.noTimeline') })] })] })] })] }), wizard && (_jsx(ActionDialog, { id: m.id, onClose: () => (editing ? navigate(`/operations/movements/${m.id}`) : setWizard(false)), onSent: () => {
                    if (editing) {
                        navigate(`/operations/movements/${m.id}`);
                        return;
                    }
                    void reload().then(() => approval.reload());
                } })), amending && (_jsx(MovementAmendDialog, { movement: m, onClose: () => setAmending(false), onSaved: () => {
                    setAmending(false);
                    void reload();
                } })), cancelingApproved !== null && (_jsxs(Dialog, { open: true, onClose: () => setCancelingApproved(null), maxWidth: "sm", fullWidth: true, children: [_jsx(DialogTitle, { children: t('movements.amend.cancelTitle', { no: m.movementNo }) }), _jsxs(DialogContent, { dividers: true, children: [_jsx(Alert, { severity: "warning", sx: { mb: 2 }, children: t('movements.amend.cancelHint') }), _jsx(TextField, { required: true, label: t('movements.amend.reason'), value: cancelingApproved, onChange: (e) => setCancelingApproved(e.target.value), fullWidth: true, multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 500 } } })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setCancelingApproved(null), children: t('common.close') }), _jsx(Button, { color: "error", variant: "contained", disabled: busy || !cancelingApproved.trim(), onClick: () => void (async () => {
                                    setBusy(true);
                                    setError(null);
                                    try {
                                        await movementsApi.cancelApproved(m.id, cancelingApproved.trim());
                                        setCancelingApproved(null);
                                        await reload();
                                    }
                                    catch (failure) {
                                        setError(errorKey(failure));
                                    }
                                    finally {
                                        setBusy(false);
                                    }
                                })(), children: t('movements.amend.cancelAction') })] })] })), canceling !== null && (_jsxs(Dialog, { open: true, onClose: () => setCanceling(null), maxWidth: "xs", fullWidth: true, children: [_jsx(DialogTitle, { children: t('movements.cancelTitle', { no: m.movementNo }) }), _jsx(DialogContent, { children: _jsx(TextField, { sx: { mt: 1 }, label: t('movements.cancelReason'), value: canceling, onChange: (e) => setCanceling(e.target.value), fullWidth: true, multiline: true, minRows: 2 }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setCanceling(null), children: t('common.close') }), _jsx(Button, { color: "error", variant: "contained", disabled: busy, onClick: () => void (async () => {
                                    setBusy(true);
                                    try {
                                        await movementsApi.cancel(m.id, canceling.trim() || null);
                                        setCanceling(null);
                                        await reload();
                                    }
                                    catch (failure) {
                                        setError(errorKey(failure));
                                    }
                                    finally {
                                        setBusy(false);
                                    }
                                })(), children: t('movements.cancel') })] })] }))] }));
}
/**
 * Changing an executed action (its type's own permission): its date (the period it opened moves with it), the expected
 * return of a vacation, the place (not for a return to work) and the notes, with the reason for the change.
 */
function MovementAmendDialog({ movement: m, onClose, onSaved }) {
    const { t } = useTranslation();
    const [effectiveOn, setEffectiveOn] = useState(m.effectiveOn);
    const [expectedReturnOn, setExpectedReturnOn] = useState(m.expectedReturnOn ?? '');
    const [place, setPlace] = useState(m.place ?? '');
    const [notes, setNotes] = useState(m.notes ?? '');
    const [why, setWhy] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await movementsApi.amend(m.id, {
                effectiveOn,
                expectedReturnOn: expectedReturnOn || null,
                place: place.trim() || null,
                notes: notes.trim() || null,
                amendReason: why.trim(),
            });
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('movements.amend.title', { no: m.movementNo }) }), _jsx(DialogContent, { dividers: true, children: _jsxs(Stack, { sx: { gap: 2 }, children: [_jsx(Alert, { severity: "info", children: t('movements.amend.hint') }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 2 }, children: [_jsx(DateField, { required: true, label: t(`movements.dateLabel.${m.type}`), value: effectiveOn, onChange: (e) => setEffectiveOn(e.target.value), slotProps: { inputLabel: { shrink: true } }, sx: { flex: 1 } }), m.type === 'VacationDeparture' && (_jsx(DateField, { label: t('movements.expectedReturn'), value: expectedReturnOn, onChange: (e) => setExpectedReturnOn(e.target.value), slotProps: { inputLabel: { shrink: true } }, sx: { flex: 1 } }))] }), m.opensPeriod !== 'Work' && (_jsx(TextField, { label: t(m.type === 'Absconding' ? 'movements.lastPlace' : 'movements.housingPlace'), value: place, onChange: (e) => setPlace(e.target.value), slotProps: { htmlInput: { maxLength: 200 } } })), _jsx(TextField, { label: t('movements.notes'), value: notes, onChange: (e) => setNotes(e.target.value), multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 1000 } } }), _jsx(TextField, { required: true, label: t('movements.amend.reason'), value: why, onChange: (e) => setWhy(e.target.value), multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 500 } } }), error && _jsx(Alert, { severity: "error", children: t(error) })] }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.close') }), _jsx(Button, { variant: "contained", disabled: busy || !why.trim() || !effectiveOn, onClick: () => void save(), children: t('movements.amend.save') })] })] }));
}
