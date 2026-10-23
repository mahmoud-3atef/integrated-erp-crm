import BlockIcon from '@mui/icons-material/Block';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ForwardIcon from '@mui/icons-material/Forward';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyIcon from '@mui/icons-material/Reply';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { workflowApi, type ApprovalStatus, type Decision, type FieldValue, type InstanceDetail, type MemberOption } from '../../api/workflow';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { ApprovalTimeline } from '../ApprovalTimeline';
import { flow, GlobalCompactApprovalBar } from './ApprovalBar';
import { ApprovalHistoryDrawer } from './ApprovalHistoryDrawer';
import { alreadyProcessed, newIdempotencyKey } from './approvalModel';

type Action = Decision | 'Delegate' | 'Reassign' | 'Cancel';

/**
 * The approval of one record, loaded with the actions open to the current user. People who may see the record but
 * take no part in its approval get the stage bar from the record's own status (no actions).
 */
export function useRecordApproval(instanceId: string | null | undefined) {
  const [detail, setDetail] = useState<InstanceDetail | null>(null);
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
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { detail, loading, reload };
}

/** Field names and choice names of the record, for the event log. */
function useFieldText(detail: InstanceDetail | null) {
  const { i18n } = useTranslation();
  const fieldName = (key: string) => {
    const field = detail?.record.find((r) => r.field.key === key)?.field;
    return field ? localName(field, i18n.language) : key;
  };
  // A choice shows its name (e.g. the order's state), not its stored value.
  const fieldValue = (key: string, value: string | null) => {
    const option = detail?.record.find((r) => r.field.key === key)?.field.options?.find((o) => o.value === value);
    return option ? (i18n.language === 'ar' ? option.nameAr : option.nameEn) : (value ?? '—');
  };
  return { fieldName, fieldValue };
}

/**
 * The shared approval bar above a record (GlobalCompactApprovalBar), its history drawer and the decision dialog.
 * Every page with a workflow-linked record uses this one component; none builds its own.
 */
export function ApprovalBar({
  status,
  detail,
  loading,
  onChanged,
}: {
  status: ApprovalStatus;
  detail: InstanceDetail | null;
  /** The user's actions are still loading. */
  loading?: boolean;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [action, setAction] = useState<Action | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [people, setPeople] = useState<MemberOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ key: string; values?: Record<string, string>; severity: 'info' | 'success' } | null>(null);
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
    } catch (failure) {
      setError(errorKey(failure));
    }
  };

  // Only one surface at a time: a decision taken from the drawer closes it first.
  const start = (next: Action) => {
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
      setNotice(
        next
          ? { key: 'approvalBar.approvedMoved', values: { stage: stage ?? '', next: i18n.language === 'ar' ? next.nameAr : next.nameEn }, severity: 'success' }
          : { key: 'approvalBar.approvedStage', values: { stage: stage ?? '' }, severity: 'success' },
      );
      onChanged();
    } catch (failure) {
      const code = errorKey(failure);
      if (alreadyProcessed(code)) {
        setNotice({ key: 'approvalBar.alreadyProcessed', severity: 'info' });
        onChanged();
      } else {
        setError(code);
      }
    } finally {
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
      ...(actions?.canReturn ? [{ key: 'return', label: t('approval.return'), icon: <ReplyIcon />, color: flow.amber, onClick: () => start('Return') }] : []),
      ...(actions?.canDelegate ? [{ key: 'delegate', label: t('approval.delegate'), icon: <ForwardIcon />, onClick: () => start('Delegate') }] : []),
      ...(canReassign ? [{ key: 'reassign', label: t('approval.reassign'), icon: <SwapHorizIcon />, onClick: () => start('Reassign') }] : []),
      ...(actions?.canCancel ? [{ key: 'cancel', label: t('approval.cancel'), icon: <BlockIcon />, color: tokens.gray600, onClick: () => start('Cancel') }] : []),
    ],
  };

  return (
    <>
      <ErrorMessage messageKey={error} />
      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 1.5 }}>
          {t(notice.key, notice.values)}
        </Alert>
      )}
      {detail?.summary.status === 'Failed' && detail.summary.error && (
        <Alert
          severity="error"
          sx={{ mb: 1.5 }}
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
      <GlobalCompactApprovalBar status={shown} actions={barActions} loadingActions={loading && !detail} onViewAll={() => setDrawer(true)} />
      <ApprovalHistoryDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        status={shown}
        title={detail?.summary.title}
        actions={barActions}
        canReturn={!!actions?.canReturn}
        onReturn={() => start('Return')}
        fieldName={fieldName}
        fieldValue={fieldValue}
      />
      <Dialog open={denied} onClose={() => setDenied(false)} maxWidth="xs" fullWidth aria-labelledby="denied-title">
        <DialogTitle id="denied-title" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: flow.amber }}>
          <LockOutlinedIcon />
          {t('approvalBar.noPermissionTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: flow.text, lineHeight: 1.8 }}>
            {t('approvalBar.noPermissionBody', { stage: (i18n.language === 'ar' ? shown.currentStepAr : shown.currentStepEn) ?? '' })}
          </Typography>
          {shown.waitingFor.length > 0 && (
            <Typography sx={{ fontSize: 13, color: flow.textMuted, mt: 1 }}>
              {t('approvalBar.waitingFor')}: <bdi>{shown.waitingFor.join('، ')}</bdi>
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setDenied(false)} autoFocus>
            {t('approvalBar.understood')}
          </Button>
        </DialogActions>
      </Dialog>
      {action && detail && (
        <DecisionDialog
          detail={detail}
          action={action}
          people={people}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            onChanged();
          }}
          onAlreadyProcessed={() => {
            setAction(null);
            setNotice({ key: 'approvalBar.alreadyProcessed', severity: 'info' });
            onChanged();
          }}
        />
      )}
    </>
  );
}

/**
 * A record's status as it shows: while in approval, the value the company added to the screen's status that the
 * approval set (docs/02-target-architecture/19); otherwise the record's own status badge.
 */
export function ShownStatus({ approval, children }: { approval: InstanceDetail | null; children: ReactNode }) {
  const { i18n } = useTranslation();
  const status = approval?.status;
  const value = status?.status === 'InProgress' ? (i18n.language === 'ar' ? status.statusValueAr : status.statusValueEn) : null;
  if (!value) {
    return <>{children}</>;
  }
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.3, borderRadius: 999, fontSize: 12.5, fontWeight: 800, color: tokens.navy700, bgcolor: '#fff', border: `1px solid ${tokens.navy100}`, whiteSpace: 'nowrap', '& svg': { fontSize: 15 } }}>
      <HourglassBottomOutlinedIcon />
      {value}
    </Box>
  );
}

/** Every event of the approval (the detailed log, for the approval's own page and the request's approval tab). */
export function ApprovalLog({ status, detail }: { status: ApprovalStatus; detail: InstanceDetail | null }) {
  const { fieldName } = useFieldText(detail);
  return <ApprovalTimeline status={detail?.status ?? status} fieldName={fieldName} />;
}

/**
 * DecisionDialog (spec 16 §3.3): the record, the current stage and the action; a reason is required to reject, return
 * or cancel. Each opening sends one idempotency key, so a double click or a retried request decides once; a task
 * already decided elsewhere closes the dialog with «تمت معالجة هذه المهمة بالفعل» and refreshes the page.
 */
function DecisionDialog({
  detail,
  action,
  people,
  onClose,
  onDone,
  onAlreadyProcessed,
}: {
  detail: InstanceDetail;
  action: Action;
  people: MemberOption[];
  onClose: () => void;
  onDone: () => void;
  onAlreadyProcessed: () => void;
}) {
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
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(detail.actions.requiredFields.map((f: FieldValue) => [f.field.key, f.value ?? ''])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      } else if (action === 'Delegate') {
        await workflowApi.delegate(itemId, delegateTo, comment);
      } else if (action === 'Cancel') {
        await workflowApi.cancel(detail.summary.id, comment);
      } else {
        await workflowApi.decide(itemId, action, comment, action === 'Approve' ? fields : {}, key, action === 'Return' ? returnTo : null);
      }
      onDone();
    } catch (failure) {
      const code = errorKey(failure);
      if (alreadyProcessed(code)) {
        onAlreadyProcessed();
        return;
      }
      setError(code);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const color = action === 'Approve' ? 'success' : action === 'Return' ? 'warning' : action === 'Reject' ? 'error' : 'primary';
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="decision-title">
      <DialogTitle id="decision-title">{t(`approval.confirm.${action}`)}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Box sx={{ mb: 2, p: 1.5, borderRadius: '10px', bgcolor: '#F6F8FC', border: `1px solid ${flow.border}` }}>
          <Typography sx={{ fontWeight: 700, color: flow.text }}>
            <bdi>{detail.summary.title}</bdi>
          </Typography>
          {step && (
            <Typography sx={{ fontSize: 13, color: flow.textMuted, mt: 0.25 }}>
              {t('approvalBar.currentStage')}: <b style={{ color: flow.blue }}>{step}</b>
            </Typography>
          )}
          {next && !all && <Typography sx={{ fontSize: 13, color: flow.textMuted, mt: 0.25 }}>{t('approvalBar.nextStage', { name: ar ? next.nameAr : next.nameEn })}</Typography>}
          {all && action === 'Approve' && <Typography sx={{ fontSize: 13, color: flow.textMuted, mt: 0.25 }}>{t('approvalBar.ruleAll')}</Typography>}
        </Box>
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
          {action === 'Return' && targets.length > 0 && (
            <TextField
              select
              label={t('approval.returnTo')}
              value={returnTo}
              onChange={(e) => setReturnTo(e.target.value)}
              helperText={returnTo ? t('approval.returnToStageHint') : t('approval.returnToSubmitterHint')}
            >
              <MenuItem value="">{t('approval.returnToSubmitter')}</MenuItem>
              {targets.map((s) => (
                <MenuItem key={s.stepId} value={s.stepId}>
                  {t('approval.returnToStage', { name: ar ? s.nameAr : s.nameEn })}
                </MenuItem>
              ))}
            </TextField>
          )}
          {action === 'Reassign' && open.length > 1 && (
            <TextField select label={t('approval.reassignTask')} value={task} onChange={(e) => (setTask(e.target.value), setDelegateTo(''))} required>
              {open.map((o) => (
                <MenuItem key={o.workItemId} value={o.workItemId}>
                  {o.assigneeName}
                </MenuItem>
              ))}
            </TextField>
          )}
          {action === 'Reassign' && holder && (
            <Typography sx={{ fontSize: 13, color: flow.textMuted }}>{t('approval.reassignFrom', { name: holder.assigneeName })}</Typography>
          )}
          {pick && (
            <TextField select label={action === 'Reassign' ? t('approval.reassignTo') : t('approval.delegateTo')} value={delegateTo} onChange={(e) => setDelegateTo(e.target.value)} required>
              {people
                .filter((p) => action !== 'Reassign' || (p.userAccountId !== holder?.assigneeUserId))
                .map((p) => (
                  <MenuItem key={p.userAccountId} value={p.userAccountId}>
                    {p.displayName}
                  </MenuItem>
                ))}
            </TextField>
          )}
          {action === 'Reassign' && (
            <Alert severity="info" sx={{ py: 0 }}>
              {t('approval.reassignHint')}
            </Alert>
          )}
          <TextField
            label={needsReason ? t('approval.reason') : t('approval.comment')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required={needsReason}
            multiline
            minRows={3}
            helperText={`${needsReason ? `${t('approvalBar.reasonRequired')} · ` : ''}${comment.length}/1000`}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            autoFocus
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" color={color} onClick={() => void submit()} disabled={busy || (needsReason && !comment.trim()) || missingField || (pick && !delegateTo) || (action === 'Reassign' && !task)}>
          {busy ? t('approvalBar.sending') : t(`approval.do.${action}`)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
