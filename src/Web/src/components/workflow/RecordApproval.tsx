import BlockIcon from '@mui/icons-material/Block';
import ForwardIcon from '@mui/icons-material/Forward';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyIcon from '@mui/icons-material/Reply';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { workflowApi, type ApprovalStatus, type Decision, type FieldValue, type InstanceDetail, type MemberOption } from '../../api/workflow';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { ApprovalTimeline } from '../ApprovalTimeline';
import { StageTracker } from '../StageTracker';

type Action = Decision | 'Delegate' | 'Cancel';

/**
 * The approval of one record, loaded with the actions open to the current user. People who may see the record but
 * take no part in its approval get the stage bar from the record's own status (no actions).
 */
export function useRecordApproval(instanceId: string | null | undefined) {
  const [detail, setDetail] = useState<InstanceDetail | null>(null);
  const reload = useCallback(async () => {
    if (!instanceId) {
      setDetail(null);
      return;
    }
    try {
      setDetail(await workflowApi.instance(instanceId));
    } catch {
      setDetail(null);
    }
  }, [instanceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { detail, reload };
}

/** The stage bar above a record, with approve / reject on the current stage and the other actions under it. */
export function ApprovalBar({ status, detail, onChanged }: { status: ApprovalStatus; detail: InstanceDetail | null; onChanged: () => void }) {
  const { t } = useTranslation();
  const [action, setAction] = useState<Action | null>(null);
  const [people, setPeople] = useState<MemberOption[]>([]);
  const [error, setError] = useState<string | null>(null);
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
    } catch (failure) {
      setError(errorKey(failure));
    }
  };

  const more = actions && (actions.canReturn || actions.canDelegate || actions.canCancel);
  return (
    <>
      <ErrorMessage messageKey={error} />
      {detail?.summary.status === 'Failed' && detail.summary.error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            actions?.canRetry ? (
              <Button color="inherit" size="small" startIcon={<ReplayIcon />} onClick={() => void retry()}>
                {t('approval.retry')}
              </Button>
            ) : undefined
          }
        >
          {t('approval.failedBecause', { error: detail.summary.error })}
        </Alert>
      )}
      <StageTracker
        status={detail?.status ?? status}
        actions={{
          onApprove: actions?.canApprove ? () => setAction('Approve') : undefined,
          onReject: actions?.canReject ? () => setAction('Reject') : undefined,
        }}
        footer={
          more && (
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', pt: 1, mt: 0.5, borderTop: `1px dashed ${tokens.border}` }}>
              {actions.canReturn && (
                <Button size="small" variant="outlined" color="warning" startIcon={<ReplyIcon />} onClick={() => setAction('Return')}>
                  {t('approval.return')}
                </Button>
              )}
              {actions.canDelegate && (
                <Button size="small" variant="outlined" startIcon={<ForwardIcon />} onClick={() => setAction('Delegate')}>
                  {t('approval.delegate')}
                </Button>
              )}
              {actions.canCancel && (
                <Button size="small" color="inherit" startIcon={<BlockIcon />} onClick={() => setAction('Cancel')}>
                  {t('approval.cancel')}
                </Button>
              )}
            </Stack>
          )
        }
      />
      {action && detail && (
        <ActionDialog
          detail={detail}
          action={action}
          people={people}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

/** Every event of the approval (the detailed log, for the record page's approval tab). */
export function ApprovalLog({ status, detail }: { status: ApprovalStatus; detail: InstanceDetail | null }) {
  const { i18n } = useTranslation();
  const fieldName = (key: string) => {
    const field = detail?.record.find((r) => r.field.key === key)?.field;
    return field ? localName(field, i18n.language) : key;
  };
  return <ApprovalTimeline status={detail?.status ?? status} fieldName={fieldName} />;
}

function ActionDialog({ detail, action, people, onClose, onDone }: { detail: InstanceDetail; action: Action; people: MemberOption[]; onClose: () => void; onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const [comment, setComment] = useState('');
  const [delegateTo, setDelegateTo] = useState('');
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(detail.actions.requiredFields.map((f: FieldValue) => [f.field.key, f.value ?? ''])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsReason = action !== 'Approve' && action !== 'Delegate';
  const missingField = action === 'Approve' && detail.actions.requiredFields.some((f) => !fields[f.field.key]?.trim());

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const itemId = detail.actions.workItemId!;
      if (action === 'Delegate') {
        await workflowApi.delegate(itemId, delegateTo, comment);
      } else if (action === 'Cancel') {
        await workflowApi.cancel(detail.summary.id, comment);
      } else {
        await workflowApi.decide(itemId, action, comment, action === 'Approve' ? fields : {});
      }
      onDone();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const color = action === 'Approve' ? 'success' : action === 'Return' ? 'warning' : action === 'Reject' ? 'error' : 'primary';
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t(`approval.confirm.${action}`)}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Typography sx={{ mb: 2, fontWeight: 600, color: tokens.navy800 }}>{detail.summary.title}</Typography>
        <Stack spacing={2}>
          {action === 'Approve' &&
            detail.actions.requiredFields.map(({ field }) => (
              <TextField
                key={field.key}
                label={localName(field, i18n.language)}
                required
                multiline={field.type === 'Text'}
                minRows={field.type === 'Text' ? 2 : undefined}
                value={fields[field.key] ?? ''}
                onChange={(e) => setFields((f) => ({ ...f, [field.key]: e.target.value }))}
                helperText={t('approval.requiredFieldHint')}
              />
            ))}
          {action === 'Delegate' && (
            <TextField select label={t('approval.delegateTo')} value={delegateTo} onChange={(e) => setDelegateTo(e.target.value)} required>
              {people.map((p) => (
                <MenuItem key={p.userAccountId} value={p.userAccountId}>
                  {p.displayName}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label={needsReason ? t('approval.reason') : t('approval.comment')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required={needsReason}
            multiline
            minRows={3}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" color={color} onClick={() => void submit()} disabled={busy || (needsReason && !comment.trim()) || missingField || (action === 'Delegate' && !delegateTo)}>
          {busy ? t('common.loading') : t(`approval.do.${action}`)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
