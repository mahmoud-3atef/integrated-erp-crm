import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BlockIcon from '@mui/icons-material/Block';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ForwardIcon from '@mui/icons-material/Forward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyIcon from '@mui/icons-material/Reply';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { workflowApi, type Decision, type FieldValue, type InstanceDetail, type MemberOption, type RecordField } from '../../api/workflow';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { ApprovalTimeline } from '../../components/ApprovalTimeline';
import { PageHeader, Panel } from '../../components/ui';

type Action = Decision | 'Delegate' | 'Cancel';

/** One approval: the record's fields, the actions open to the current user, and the full history. */
export function ApprovalDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [detail, setDetail] = useState<InstanceDetail | null>(null);
  const [people, setPeople] = useState<MemberOption[]>([]);
  const [action, setAction] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ar = i18n.language === 'ar';

  const load = useCallback(async () => {
    try {
      setDetail(await workflowApi.instance(id!));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [id]);

  useEffect(() => {
    void load();
    workflowApi.people().then(setPeople).catch(() => setPeople([]));
  }, [load]);

  const fieldName = (key: string) => {
    const field = detail?.record.find((r) => r.field.key === key)?.field;
    return field ? localName(field, i18n.language) : key;
  };
  const display = (field: RecordField, value: string | null) => {
    if (value === null || value === '') {
      return '—';
    }
    if (field.type === 'Choice') {
      const option = field.options?.find((o) => o.value === value);
      return option ? localName(option, i18n.language) : value;
    }
    if (field.type === 'User') {
      return people.find((p) => p.userAccountId === value)?.displayName ?? value;
    }
    if (field.type === 'Boolean') {
      return value === 'true' ? t('common.yes') : t('common.no');
    }
    if (field.type === 'Money' || field.type === 'Number') {
      return new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { maximumFractionDigits: 2 }).format(Number(value));
    }
    return value;
  };

  if (!detail) {
    return <ErrorMessage messageKey={error} />;
  }

  const { summary, status, record, actions } = detail;
  const retry = async () => {
    setError(null);
    try {
      await workflowApi.retry(summary.id);
      await load();
    } catch (failure) {
      setError(errorKey(failure));
    }
  };

  return (
    <Box>
      <PageHeader
        title={summary.title}
        subtitle={`${ar ? summary.screenNameAr : summary.screenNameEn} — ${ar ? summary.processNameAr : summary.processNameEn}`}
        actions={
          <Stack direction="row" spacing={1}>
            {summary.link && (
              <Button variant="outlined" startIcon={<OpenInNewIcon />} onClick={() => navigate(summary.link!)}>
                {t('approval.openRecord')}
              </Button>
            )}
            <Button startIcon={<ArrowBackIcon sx={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate(-1)}>
              {t('common.back')}
            </Button>
          </Stack>
        }
      />
      <ErrorMessage messageKey={error} />
      {summary.status === 'Failed' && summary.error && (
        <Alert severity="error" sx={{ mb: 2 }} action={actions.canRetry ? <Button color="inherit" size="small" startIcon={<ReplayIcon />} onClick={() => void retry()}>{t('approval.retry')}</Button> : undefined}>
          {t('approval.failedBecause', { error: summary.error })}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 420px' }, gap: `${tokens.gap}px`, alignItems: 'start' }}>
        <Stack spacing={`${tokens.gap}px`}>
          {(actions.canApprove || actions.canCancel) && (
            <Panel padding={2.5}>
              <Typography sx={{ fontWeight: 700, color: tokens.navy800, mb: 1.5 }}>{actions.canApprove ? t('approval.yourDecision') : t('approval.actions')}</Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {actions.canApprove && (
                  <Button variant="contained" color="success" startIcon={<CheckIcon />} onClick={() => setAction('Approve')}>
                    {t('approval.approve')}
                  </Button>
                )}
                {actions.canReturn && (
                  <Button variant="outlined" color="warning" startIcon={<ReplyIcon />} onClick={() => setAction('Return')}>
                    {t('approval.return')}
                  </Button>
                )}
                {actions.canReject && (
                  <Button variant="outlined" color="error" startIcon={<CloseIcon />} onClick={() => setAction('Reject')}>
                    {t('approval.reject')}
                  </Button>
                )}
                {actions.canDelegate && (
                  <Button variant="outlined" startIcon={<ForwardIcon />} onClick={() => setAction('Delegate')}>
                    {t('approval.delegate')}
                  </Button>
                )}
                {actions.canCancel && (
                  <Button color="inherit" startIcon={<BlockIcon />} onClick={() => setAction('Cancel')}>
                    {t('approval.cancel')}
                  </Button>
                )}
              </Stack>
            </Panel>
          )}
          <Panel padding={2.5}>
            <Typography sx={{ fontWeight: 700, color: tokens.navy800, mb: 1.5 }}>{t('approval.recordData')}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              {record.map(({ field, value }) => (
                <Box key={field.key}>
                  <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{localName(field, i18n.language)}</Typography>
                  <Typography sx={{ fontSize: 13.5, color: tokens.gray900, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{display(field, value)}</Typography>
                </Box>
              ))}
            </Box>
          </Panel>
        </Stack>
        <Panel padding={2.5}>
          <Typography sx={{ fontWeight: 700, color: tokens.navy800, mb: 1.5 }}>{t('approval.history')}</Typography>
          <ApprovalTimeline status={status} fieldName={fieldName} />
        </Panel>
      </Box>

      {action && (
        <ActionDialog
          detail={detail}
          action={action}
          people={people}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            void load();
          }}
        />
      )}
    </Box>
  );
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
