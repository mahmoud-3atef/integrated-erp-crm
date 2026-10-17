import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import BlockIcon from '@mui/icons-material/Block';
import ForwardIcon from '@mui/icons-material/Forward';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyIcon from '@mui/icons-material/Reply';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { workflowApi } from '../../api/workflow';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { ApprovalTimeline } from '../ApprovalTimeline';
import { StageTracker } from '../StageTracker';
/**
 * The approval of one record, loaded with the actions open to the current user. People who may see the record but
 * take no part in its approval get the stage bar from the record's own status (no actions).
 */
export function useRecordApproval(instanceId) {
    const [detail, setDetail] = useState(null);
    const reload = useCallback(async () => {
        if (!instanceId) {
            setDetail(null);
            return;
        }
        try {
            setDetail(await workflowApi.instance(instanceId));
        }
        catch {
            setDetail(null);
        }
    }, [instanceId]);
    useEffect(() => {
        void reload();
    }, [reload]);
    return { detail, reload };
}
/** The stage bar above a record, with approve / reject on the current stage and the other actions under it. */
export function ApprovalBar({ status, detail, onChanged }) {
    const { t } = useTranslation();
    const [action, setAction] = useState(null);
    const [people, setPeople] = useState([]);
    const [error, setError] = useState(null);
    const actions = detail?.actions;
    useEffect(() => {
        if (actions?.canDelegate) {
            workflowApi.people().then(setPeople).catch(() => setPeople([]));
        }
    }, [actions?.canDelegate]);
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
    const more = actions && (actions.canReturn || actions.canDelegate || actions.canCancel);
    return (_jsxs(_Fragment, { children: [_jsx(ErrorMessage, { messageKey: error }), detail?.summary.status === 'Failed' && detail.summary.error && (_jsx(Alert, { severity: "error", sx: { mb: 2 }, action: actions?.canRetry ? (_jsx(Button, { color: "inherit", size: "small", startIcon: _jsx(ReplayIcon, {}), onClick: () => void retry(), children: t('approval.retry') })) : undefined, children: t('approval.failedBecause', { error: detail.summary.error }) })), _jsx(StageTracker, { status: detail?.status ?? status, actions: {
                    onApprove: actions?.canApprove ? () => setAction('Approve') : undefined,
                    onReject: actions?.canReject ? () => setAction('Reject') : undefined,
                }, footer: more && (_jsxs(Stack, { direction: "row", sx: { gap: 1, flexWrap: 'wrap', pt: 1, mt: 0.5, borderTop: `1px dashed ${tokens.border}` }, children: [actions.canReturn && (_jsx(Button, { size: "small", variant: "outlined", color: "warning", startIcon: _jsx(ReplyIcon, {}), onClick: () => setAction('Return'), children: t('approval.return') })), actions.canDelegate && (_jsx(Button, { size: "small", variant: "outlined", startIcon: _jsx(ForwardIcon, {}), onClick: () => setAction('Delegate'), children: t('approval.delegate') })), actions.canCancel && (_jsx(Button, { size: "small", color: "inherit", startIcon: _jsx(BlockIcon, {}), onClick: () => setAction('Cancel'), children: t('approval.cancel') }))] })) }), action && detail && (_jsx(ActionDialog, { detail: detail, action: action, people: people, onClose: () => setAction(null), onDone: () => {
                    setAction(null);
                    onChanged();
                } }))] }));
}
/** Every event of the approval (the detailed log, for the record page's approval tab). */
export function ApprovalLog({ status, detail }) {
    const { i18n } = useTranslation();
    const fieldName = (key) => {
        const field = detail?.record.find((r) => r.field.key === key)?.field;
        return field ? localName(field, i18n.language) : key;
    };
    return _jsx(ApprovalTimeline, { status: detail?.status ?? status, fieldName: fieldName });
}
function ActionDialog({ detail, action, people, onClose, onDone }) {
    const { t, i18n } = useTranslation();
    const [comment, setComment] = useState('');
    const [delegateTo, setDelegateTo] = useState('');
    const [fields, setFields] = useState(() => Object.fromEntries(detail.actions.requiredFields.map((f) => [f.field.key, f.value ?? ''])));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const needsReason = action !== 'Approve' && action !== 'Delegate';
    const missingField = action === 'Approve' && detail.actions.requiredFields.some((f) => !fields[f.field.key]?.trim());
    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            const itemId = detail.actions.workItemId;
            if (action === 'Delegate') {
                await workflowApi.delegate(itemId, delegateTo, comment);
            }
            else if (action === 'Cancel') {
                await workflowApi.cancel(detail.summary.id, comment);
            }
            else {
                await workflowApi.decide(itemId, action, comment, action === 'Approve' ? fields : {});
            }
            onDone();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const color = action === 'Approve' ? 'success' : action === 'Return' ? 'warning' : action === 'Reject' ? 'error' : 'primary';
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t(`approval.confirm.${action}`) }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Typography, { sx: { mb: 2, fontWeight: 600, color: tokens.navy800 }, children: detail.summary.title }), _jsxs(Stack, { spacing: 2, children: [action === 'Approve' &&
                                detail.actions.requiredFields.map(({ field }) => (_jsx(TextField, { label: localName(field, i18n.language), required: true, multiline: field.type === 'Text', minRows: field.type === 'Text' ? 2 : undefined, value: fields[field.key] ?? '', onChange: (e) => setFields((f) => ({ ...f, [field.key]: e.target.value })), helperText: t('approval.requiredFieldHint') }, field.key))), action === 'Delegate' && (_jsx(TextField, { select: true, label: t('approval.delegateTo'), value: delegateTo, onChange: (e) => setDelegateTo(e.target.value), required: true, children: people.map((p) => (_jsx(MenuItem, { value: p.userAccountId, children: p.displayName }, p.userAccountId))) })), _jsx(TextField, { label: needsReason ? t('approval.reason') : t('approval.comment'), value: comment, onChange: (e) => setComment(e.target.value), required: needsReason, multiline: true, minRows: 3, slotProps: { htmlInput: { maxLength: 1000 } } })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", color: color, onClick: () => void submit(), disabled: busy || (needsReason && !comment.trim()) || missingField || (action === 'Delegate' && !delegateTo), children: busy ? t('common.loading') : t(`approval.do.${action}`) })] })] }));
}
