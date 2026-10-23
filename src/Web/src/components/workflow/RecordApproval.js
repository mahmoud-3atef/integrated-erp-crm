import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import BlockIcon from '@mui/icons-material/Block';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ForwardIcon from '@mui/icons-material/Forward';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyIcon from '@mui/icons-material/Reply';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { workflowApi } from '../../api/workflow';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { ApprovalTimeline } from '../ApprovalTimeline';
import { flow, GlobalCompactApprovalBar } from './ApprovalBar';
import { ApprovalHistoryDrawer } from './ApprovalHistoryDrawer';
import { alreadyProcessed, newIdempotencyKey } from './approvalModel';
/**
 * The approval of one record, loaded with the actions open to the current user. People who may see the record but
 * take no part in its approval get the stage bar from the record's own status (no actions).
 */
export function useRecordApproval(instanceId) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(!!instanceId);
    const reload = useCallback(async () => {
        if (!instanceId) {
            setDetail(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            setDetail(await workflowApi.instance(instanceId));
        }
        catch {
            setDetail(null);
        }
        finally {
            setLoading(false);
        }
    }, [instanceId]);
    useEffect(() => {
        void reload();
    }, [reload]);
    return { detail, loading, reload };
}
/** Field names and choice names of the record, for the event log. */
function useFieldText(detail) {
    const { i18n } = useTranslation();
    const fieldName = (key) => {
        const field = detail?.record.find((r) => r.field.key === key)?.field;
        return field ? localName(field, i18n.language) : key;
    };
    // A choice shows its name (e.g. the order's state), not its stored value.
    const fieldValue = (key, value) => {
        const option = detail?.record.find((r) => r.field.key === key)?.field.options?.find((o) => o.value === value);
        return option ? (i18n.language === 'ar' ? option.nameAr : option.nameEn) : (value ?? '—');
    };
    return { fieldName, fieldValue };
}
/**
 * The shared approval bar above a record (GlobalCompactApprovalBar), its history drawer and the decision dialog.
 * Every page with a workflow-linked record uses this one component; none builds its own.
 */
export function ApprovalBar({ status, detail, loading, onChanged, }) {
    const { t, i18n } = useTranslation();
    const [action, setAction] = useState(null);
    const [drawer, setDrawer] = useState(false);
    const [people, setPeople] = useState([]);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [denied, setDenied] = useState(false);
    const [approving, setApproving] = useState(false);
    const actions = detail?.actions;
    const shown = detail?.status ?? status;
    const { fieldName, fieldValue } = useFieldText(detail);
    const canReassign = (actions?.reassignable?.length ?? 0) > 0;
    useEffect(() => {
        if (actions?.canDelegate || canReassign) {
            workflowApi.people().then(setPeople).catch(() => setPeople([]));
        }
    }, [actions?.canDelegate, canReassign]);
    const retry = async () => {
        setError(null);
        try {
            await workflowApi.retry(status.instanceId);
            onChanged();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    };
    // Only one surface at a time: a decision taken from the drawer closes it first.
    const start = (next) => {
        setDrawer(false);
        setNotice(null);
        setAction(next);
    };
    // «موافقة» decides at once (one idempotency key per click, so a double click decides once); a stage asking for
    // fields on approval opens the dialog for them. The server checks the user may approve either way.
    const approve = async () => {
        if (!actions?.canApprove) {
            setDrawer(false);
            setDenied(true);
            return;
        }
        if (actions.requiredFields.length > 0 || !detail) {
            start('Approve');
            return;
        }
        if (approving) {
            return;
        }
        setDrawer(false);
        setNotice(null);
        setError(null);
        setApproving(true);
        const stage = i18n.language === 'ar' ? shown.currentStepAr : shown.currentStepEn;
        const next = shown.stages.find((s) => s.state === 'Current')?.rule === 'All' ? undefined : shown.planned?.[0];
        try {
            await workflowApi.decide(actions.workItemId ?? '', 'Approve', '', {}, newIdempotencyKey());
            setNotice(next
                ? { key: 'approvalBar.approvedMoved', values: { stage: stage ?? '', next: i18n.language === 'ar' ? next.nameAr : next.nameEn }, severity: 'success' }
                : { key: 'approvalBar.approvedStage', values: { stage: stage ?? '' }, severity: 'success' });
            onChanged();
        }
        catch (failure) {
            const code = errorKey(failure);
            if (alreadyProcessed(code)) {
                setNotice({ key: 'approvalBar.alreadyProcessed', severity: 'info' });
                onChanged();
            }
            else {
                setError(code);
            }
        }
        finally {
            setApproving(false);
        }
    };
    // «موافقة» and «رفض» show to every reader while the approval runs; those who may not decide are told so.
    const running = shown.status === 'InProgress';
    const barActions = {
        onApprove: running ? () => void approve() : undefined,
        onReject: running ? () => (actions?.canReject ? start('Reject') : (setDrawer(false), setDenied(true))) : undefined,
        approving,
        more: [
            ...(actions?.canReturn ? [{ key: 'return', label: t('approval.return'), icon: _jsx(ReplyIcon, {}), color: flow.amber, onClick: () => start('Return') }] : []),
            ...(actions?.canDelegate ? [{ key: 'delegate', label: t('approval.delegate'), icon: _jsx(ForwardIcon, {}), onClick: () => start('Delegate') }] : []),
            ...(canReassign ? [{ key: 'reassign', label: t('approval.reassign'), icon: _jsx(SwapHorizIcon, {}), onClick: () => start('Reassign') }] : []),
            ...(actions?.canCancel ? [{ key: 'cancel', label: t('approval.cancel'), icon: _jsx(BlockIcon, {}), color: tokens.gray600, onClick: () => start('Cancel') }] : []),
        ],
    };
    return (_jsxs(_Fragment, { children: [_jsx(ErrorMessage, { messageKey: error }), notice && (_jsx(Alert, { severity: notice.severity, onClose: () => setNotice(null), sx: { mb: 1.5 }, children: t(notice.key, notice.values) })), detail?.summary.status === 'Failed' && detail.summary.error && (_jsx(Alert, { severity: "error", sx: { mb: 1.5 }, action: actions?.canRetry ? (_jsx(Button, { color: "inherit", size: "small", startIcon: _jsx(ReplayIcon, {}), onClick: () => void retry(), children: t('approval.retry') })) : undefined, children: t('approval.failedBecause', { error: detail.summary.error }) })), _jsx(GlobalCompactApprovalBar, { status: shown, actions: barActions, loadingActions: loading && !detail, onViewAll: () => setDrawer(true) }), _jsx(ApprovalHistoryDrawer, { open: drawer, onClose: () => setDrawer(false), status: shown, title: detail?.summary.title, actions: barActions, canReturn: !!actions?.canReturn, onReturn: () => start('Return'), fieldName: fieldName, fieldValue: fieldValue }), _jsxs(Dialog, { open: denied, onClose: () => setDenied(false), maxWidth: "xs", fullWidth: true, "aria-labelledby": "denied-title", children: [_jsxs(DialogTitle, { id: "denied-title", sx: { display: 'flex', alignItems: 'center', gap: 1, color: flow.amber }, children: [_jsx(LockOutlinedIcon, {}), t('approvalBar.noPermissionTitle')] }), _jsxs(DialogContent, { children: [_jsx(Typography, { sx: { fontSize: 14, color: flow.text, lineHeight: 1.8 }, children: t('approvalBar.noPermissionBody', { stage: (i18n.language === 'ar' ? shown.currentStepAr : shown.currentStepEn) ?? '' }) }), shown.waitingFor.length > 0 && (_jsxs(Typography, { sx: { fontSize: 13, color: flow.textMuted, mt: 1 }, children: [t('approvalBar.waitingFor'), ": ", _jsx("bdi", { children: shown.waitingFor.join('، ') })] }))] }), _jsx(DialogActions, { children: _jsx(Button, { variant: "contained", onClick: () => setDenied(false), autoFocus: true, children: t('approvalBar.understood') }) })] }), action && detail && (_jsx(DecisionDialog, { detail: detail, action: action, people: people, onClose: () => setAction(null), onDone: () => {
                    setAction(null);
                    onChanged();
                }, onAlreadyProcessed: () => {
                    setAction(null);
                    setNotice({ key: 'approvalBar.alreadyProcessed', severity: 'info' });
                    onChanged();
                } }))] }));
}
/**
 * A record's status as it shows: while in approval, the value the company added to the screen's status that the
 * approval set (docs/02-target-architecture/19); otherwise the record's own status badge.
 */
export function ShownStatus({ approval, children }) {
    const { i18n } = useTranslation();
    const status = approval?.status;
    const value = status?.status === 'InProgress' ? (i18n.language === 'ar' ? status.statusValueAr : status.statusValueEn) : null;
    if (!value) {
        return _jsx(_Fragment, { children: children });
    }
    return (_jsxs(Box, { component: "span", sx: { display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.3, borderRadius: 999, fontSize: 12.5, fontWeight: 800, color: tokens.navy700, bgcolor: '#fff', border: `1px solid ${tokens.navy100}`, whiteSpace: 'nowrap', '& svg': { fontSize: 15 } }, children: [_jsx(HourglassBottomOutlinedIcon, {}), value] }));
}
/** Every event of the approval (the detailed log, for the approval's own page and the request's approval tab). */
export function ApprovalLog({ status, detail }) {
    const { fieldName } = useFieldText(detail);
    return _jsx(ApprovalTimeline, { status: detail?.status ?? status, fieldName: fieldName });
}
/**
 * DecisionDialog (spec 16 §3.3): the record, the current stage and the action; a reason is required to reject, return
 * or cancel. Each opening sends one idempotency key, so a double click or a retried request decides once; a task
 * already decided elsewhere closes the dialog with «تمت معالجة هذه المهمة بالفعل» and refreshes the page.
 */
function DecisionDialog({ detail, action, people, onClose, onDone, onAlreadyProcessed, }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [comment, setComment] = useState('');
    const [delegateTo, setDelegateTo] = useState('');
    // Return: to the submitter (empty), or back to one of the stages the approval has already passed.
    const [returnTo, setReturnTo] = useState('');
    const targets = detail.actions.returnTargets ?? [];
    const open = detail.actions.reassignable ?? [];
    const [task, setTask] = useState(open[0]?.workItemId ?? '');
    const holder = open.find((o) => o.workItemId === task);
    const [fields, setFields] = useState(() => Object.fromEntries(detail.actions.requiredFields.map((f) => [f.field.key, f.value ?? ''])));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [key] = useState(newIdempotencyKey);
    const sending = useRef(false);
    const needsReason = action !== 'Approve';
    const pick = action === 'Delegate' || action === 'Reassign';
    const missingField = action === 'Approve' && detail.actions.requiredFields.some((f) => !fields[f.field.key]?.trim());
    const status = detail.status;
    const step = ar ? status.currentStepAr : status.currentStepEn;
    const next = action === 'Approve' ? status.planned?.[0] : undefined;
    const all = status.stages.find((s) => s.state === 'Current')?.rule === 'All';
    const submit = async () => {
        // A second click while the first is on its way does nothing (the key also guards the server).
        if (sending.current) {
            return;
        }
        sending.current = true;
        setBusy(true);
        setError(null);
        try {
            const itemId = detail.actions.workItemId ?? '';
            if (action === 'Reassign') {
                await workflowApi.reassign(task, delegateTo, comment);
            }
            else if (action === 'Delegate') {
                await workflowApi.delegate(itemId, delegateTo, comment);
            }
            else if (action === 'Cancel') {
                await workflowApi.cancel(detail.summary.id, comment);
            }
            else {
                await workflowApi.decide(itemId, action, comment, action === 'Approve' ? fields : {}, key, action === 'Return' ? returnTo : null);
            }
            onDone();
        }
        catch (failure) {
            const code = errorKey(failure);
            if (alreadyProcessed(code)) {
                onAlreadyProcessed();
                return;
            }
            setError(code);
        }
        finally {
            sending.current = false;
            setBusy(false);
        }
    };
    const color = action === 'Approve' ? 'success' : action === 'Return' ? 'warning' : action === 'Reject' ? 'error' : 'primary';
    return (_jsxs(Dialog, { open: true, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "sm", "aria-labelledby": "decision-title", children: [_jsx(DialogTitle, { id: "decision-title", children: t(`approval.confirm.${action}`) }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Box, { sx: { mb: 2, p: 1.5, borderRadius: '10px', bgcolor: '#F6F8FC', border: `1px solid ${flow.border}` }, children: [_jsx(Typography, { sx: { fontWeight: 700, color: flow.text }, children: _jsx("bdi", { children: detail.summary.title }) }), step && (_jsxs(Typography, { sx: { fontSize: 13, color: flow.textMuted, mt: 0.25 }, children: [t('approvalBar.currentStage'), ": ", _jsx("b", { style: { color: flow.blue }, children: step })] })), next && !all && _jsx(Typography, { sx: { fontSize: 13, color: flow.textMuted, mt: 0.25 }, children: t('approvalBar.nextStage', { name: ar ? next.nameAr : next.nameEn }) }), all && action === 'Approve' && _jsx(Typography, { sx: { fontSize: 13, color: flow.textMuted, mt: 0.25 }, children: t('approvalBar.ruleAll') })] }), _jsxs(Stack, { spacing: 2, children: [action === 'Approve' &&
                                detail.actions.requiredFields.map(({ field }) => (_jsx(TextField, { label: localName(field, i18n.language), required: true, multiline: field.type === 'Text', minRows: field.type === 'Text' ? 2 : undefined, value: fields[field.key] ?? '', onChange: (e) => setFields((f) => ({ ...f, [field.key]: e.target.value })), helperText: t('approval.requiredFieldHint') }, field.key))), action === 'Return' && targets.length > 0 && (_jsxs(TextField, { select: true, label: t('approval.returnTo'), value: returnTo, onChange: (e) => setReturnTo(e.target.value), helperText: returnTo ? t('approval.returnToStageHint') : t('approval.returnToSubmitterHint'), children: [_jsx(MenuItem, { value: "", children: t('approval.returnToSubmitter') }), targets.map((s) => (_jsx(MenuItem, { value: s.stepId, children: t('approval.returnToStage', { name: ar ? s.nameAr : s.nameEn }) }, s.stepId)))] })), action === 'Reassign' && open.length > 1 && (_jsx(TextField, { select: true, label: t('approval.reassignTask'), value: task, onChange: (e) => (setTask(e.target.value), setDelegateTo('')), required: true, children: open.map((o) => (_jsx(MenuItem, { value: o.workItemId, children: o.assigneeName }, o.workItemId))) })), action === 'Reassign' && holder && (_jsx(Typography, { sx: { fontSize: 13, color: flow.textMuted }, children: t('approval.reassignFrom', { name: holder.assigneeName }) })), pick && (_jsx(TextField, { select: true, label: action === 'Reassign' ? t('approval.reassignTo') : t('approval.delegateTo'), value: delegateTo, onChange: (e) => setDelegateTo(e.target.value), required: true, children: people
                                    .filter((p) => action !== 'Reassign' || (p.userAccountId !== holder?.assigneeUserId))
                                    .map((p) => (_jsx(MenuItem, { value: p.userAccountId, children: p.displayName }, p.userAccountId))) })), action === 'Reassign' && (_jsx(Alert, { severity: "info", sx: { py: 0 }, children: t('approval.reassignHint') })), _jsx(TextField, { label: needsReason ? t('approval.reason') : t('approval.comment'), value: comment, onChange: (e) => setComment(e.target.value), required: needsReason, multiline: true, minRows: 3, helperText: `${needsReason ? `${t('approvalBar.reasonRequired')} · ` : ''}${comment.length}/1000`, slotProps: { htmlInput: { maxLength: 1000 } }, autoFocus: true })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", color: color, onClick: () => void submit(), disabled: busy || (needsReason && !comment.trim()) || missingField || (pick && !delegateTo) || (action === 'Reassign' && !task), children: busy ? t('approvalBar.sending') : t(`approval.do.${action}`) })] })] }));
}
