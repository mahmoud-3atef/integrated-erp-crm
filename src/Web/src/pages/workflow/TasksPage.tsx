import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReplyIcon from '@mui/icons-material/Reply';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workflowApi, type Decision, type Task } from '../../api/workflow';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, EmptyState, PageHeader, Panel, type Tone } from '../../components/ui';

const decisionTone: Record<string, Tone> = { Approved: 'success', Rejected: 'danger', Returned: 'warning' };

/** The portal's pill tabs (.cp-tabs). */
export function PillTabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <Box role="tablist" sx={{ display: 'inline-flex', gap: 0.5, p: 0.5, borderRadius: 999, bgcolor: tokens.tint, mb: `${tokens.gap}px` }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <ButtonBase
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            sx={{
              px: 2,
              py: 0.9,
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              color: active ? tokens.navy700 : tokens.gray600,
              bgcolor: active ? '#fff' : 'transparent',
              boxShadow: active ? tokens.shadowXs : 'none',
            }}
          >
            {option.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export function TasksPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const ar = i18n.language === 'ar';
  const [scope, setScope] = useState<'pending' | 'done'>('pending');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deciding, setDeciding] = useState<{ task: Task; decision: Decision } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTasks(await workflowApi.tasks(scope));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const when = (value: string) =>
    new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));

  return (
    <Box>
      <PageHeader title={t('tasks.title')} subtitle={t('tasks.intro')} />
      <PillTabs
        value={scope}
        onChange={setScope}
        options={[
          { value: 'pending', label: t('tasks.pending') },
          { value: 'done', label: t('tasks.done') },
        ]}
      />
      <ErrorMessage messageKey={error} />
      <Panel>
        <TableContainer sx={{ borderRadius: '6px' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('tasks.document')}</TableCell>
                <TableCell>{t('tasks.stage')}</TableCell>
                <TableCell>{t('tasks.submittedBy')}</TableCell>
                <TableCell>{scope === 'pending' ? t('tasks.waitingSince') : t('tasks.decision')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} hover>
                  <TableCell sx={{ whiteSpace: 'normal', minWidth: 220 }}>
                    <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{ar ? task.documentTypeNameAr : task.documentTypeNameEn}</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.gray900 }}>{task.title}</Typography>
                  </TableCell>
                  <TableCell>
                    {t('tasks.stageOf', { order: task.stageOrder, count: task.stageCount })} — {ar ? task.stageNameAr : task.stageNameEn}
                    {task.isEscalated && (
                      <Box component="span" sx={{ marginInlineStart: 1 }}>
                        <Badge tone="warning">{t('tasks.escalated')}</Badge>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>{task.submittedBy}</TableCell>
                  <TableCell>
                    {scope === 'pending' ? (
                      when(task.submittedAt)
                    ) : (
                      <Stack spacing={0.25}>
                        <span>
                          <Badge tone={decisionTone[task.status] ?? 'neutral'}>{t(`approval.status.${task.status}`)}</Badge>
                        </span>
                        {task.decidedAt && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{when(task.decidedAt)}</Typography>}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    {task.link && (
                      <Tooltip title={t('tasks.open')}>
                        <IconButton size="small" onClick={() => navigate(task.link!)} aria-label={`${t('tasks.open')} ${task.title}`}>
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {scope === 'pending' && (
                      <>
                        <Tooltip title={t('approval.approve')}>
                          <IconButton size="small" sx={{ color: tokens.success }} onClick={() => setDeciding({ task, decision: 'Approve' })} aria-label={`${t('approval.approve')} ${task.title}`}>
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('approval.return')}>
                          <IconButton size="small" sx={{ color: tokens.warning }} onClick={() => setDeciding({ task, decision: 'Return' })} aria-label={`${t('approval.return')} ${task.title}`}>
                            <ReplyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('approval.reject')}>
                          <IconButton size="small" sx={{ color: tokens.danger }} onClick={() => setDeciding({ task, decision: 'Reject' })} aria-label={`${t('approval.reject')} ${task.title}`}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {tasks.length === 0 && <EmptyState text={scope === 'pending' ? t('tasks.emptyPending') : t('tasks.emptyDone')} />}
      </Panel>
      {deciding && (
        <DecisionDialog
          task={deciding.task}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
          onDone={() => {
            setDeciding(null);
            void load();
          }}
        />
      )}
    </Box>
  );
}

export function DecisionDialog({ task, decision, onClose, onDone }: { task: Task; decision: Decision; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsReason = decision !== 'Approve';
  const color = decision === 'Approve' ? 'success' : decision === 'Return' ? 'warning' : 'error';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await workflowApi.decide(task.id, decision, comment);
      onDone();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t(`approval.confirm.${decision}`)}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Typography sx={{ mb: 2, fontWeight: 600, color: tokens.navy800 }}>{task.title}</Typography>
        <TextField
          label={needsReason ? t('approval.reason') : t('approval.comment')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          required={needsReason}
          multiline
          minRows={3}
          autoFocus
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" color={color} onClick={() => void submit()} disabled={busy || (needsReason && !comment.trim())}>
          {busy ? t('common.loading') : t(`approval.${decision.toLowerCase()}`)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
