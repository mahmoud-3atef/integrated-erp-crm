import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workflowApi, type InstanceSummary, type WorkItem } from '../../api/workflow';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { statusTone } from '../../components/ApprovalTimeline';
import { Badge, EmptyState, PageHeader, Panel, PillTabs, StatusDot, type Tone } from '../../components/ui';

const decisionTone: Record<string, Tone> = { Approved: 'success', Rejected: 'danger', Returned: 'warning', Delegated: 'neutral' };

export function useDates() {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
  return {
    dateTime: (v: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(v)),
    date: (v: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(v)),
  };
}

/** Tasks waiting for the current user (and those already decided), like CRM approval tasks. */
export function InboxPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { dateTime } = useDates();
  const ar = i18n.language === 'ar';
  const [scope, setScope] = useState<'pending' | 'done'>('pending');
  const [items, setItems] = useState<WorkItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await workflowApi.inbox(scope));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Box>
      <PageHeader title={t('tasks.title')} subtitle={t('tasks.intro')} />
      <PillTabs value={scope} onChange={setScope} options={[{ value: 'pending', label: t('tasks.pending') }, { value: 'done', label: t('tasks.done') }]} />
      <ErrorMessage messageKey={error} />
      <Panel>
        <TableContainer sx={{ borderRadius: '6px' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('tasks.document')}</TableCell>
                <TableCell>{t('tasks.stage')}</TableCell>
                <TableCell>{t('tasks.submittedBy')}</TableCell>
                <TableCell>{scope === 'pending' ? t('tasks.due') : t('tasks.decision')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(item.link ?? `/workflow/approvals/${item.instanceId}`)}>
                  <TableCell sx={{ whiteSpace: 'normal', minWidth: 220 }}>
                    <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{ar ? item.screenNameAr : item.screenNameEn}</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.gray900 }}>{item.title}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{ar ? item.stepNameAr : item.stepNameEn}</span>
                      {item.isDelegated && <Badge tone="neutral">{t('tasks.delegatedToMe')}</Badge>}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {item.submittedBy}
                    <Box sx={{ fontSize: 11.5, color: tokens.gray500 }}>{dateTime(item.submittedAt)}</Box>
                  </TableCell>
                  <TableCell>
                    {scope === 'pending' ? (
                      item.dueAt ? <Badge tone={item.isOverdue ? 'danger' : 'neutral'}>{item.isOverdue ? t('tasks.overdue') : dateTime(item.dueAt)}</Badge> : '—'
                    ) : (
                      <Stack spacing={0.25}>
                        <span>
                          <Badge tone={decisionTone[item.status] ?? 'neutral'}>{t(`approval.decided.${item.status}`)}</Badge>
                        </span>
                        {item.decidedAt && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{dateTime(item.decidedAt)}</Typography>}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={t('tasks.open')}>
                      <IconButton size="small" aria-label={`${t('tasks.open')} ${item.title}`}>
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {items.length === 0 && <EmptyState text={scope === 'pending' ? t('tasks.emptyPending') : t('tasks.emptyDone')} />}
      </Panel>
    </Box>
  );
}

/** A list of approvals: the user's own requests, or all of the company for monitoring. */
export function InstancesTable({ rows, empty }: { rows: InstanceSummary[]; empty: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { dateTime } = useDates();
  const ar = i18n.language === 'ar';
  return (
    <Panel>
      <TableContainer sx={{ borderRadius: '6px' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('tasks.document')}</TableCell>
              <TableCell>{t('process.process')}</TableCell>
              <TableCell>{t('tasks.submittedBy')}</TableCell>
              <TableCell>{t('common.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(row.link ?? `/workflow/approvals/${row.id}`)}>
                <TableCell sx={{ whiteSpace: 'normal', minWidth: 220 }}>
                  <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{ar ? row.screenNameAr : row.screenNameEn}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.gray900 }}>{row.title}</Typography>
                </TableCell>
                <TableCell>
                  {ar ? row.processNameAr : row.processNameEn}
                  <Box sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t('routes.version', { version: row.version })}</Box>
                </TableCell>
                <TableCell>
                  {row.submittedBy}
                  <Box sx={{ fontSize: 11.5, color: tokens.gray500 }}>{dateTime(row.submittedAt)}</Box>
                </TableCell>
                <TableCell>
                  <StatusDot tone={statusTone[row.status] ?? 'neutral'} label={t(`approval.instance.${row.status}`)} />
                  {row.status === 'InProgress' && (ar ? row.waitingStepAr : row.waitingStepEn) && (
                    <Box sx={{ fontSize: 11.5, color: tokens.gray500 }}>{ar ? row.waitingStepAr : row.waitingStepEn}</Box>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {rows.length === 0 && <EmptyState text={empty} />}
    </Panel>
  );
}

export function MyApprovalsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<InstanceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    workflowApi.myRequests().then(setRows).catch((failure: unknown) => setError(errorKey(failure)));
  }, []);
  return (
    <Box>
      <PageHeader title={t('myApprovals.title')} subtitle={t('myApprovals.intro')} />
      <ErrorMessage messageKey={error} />
      <InstancesTable rows={rows} empty={t('myApprovals.empty')} />
    </Box>
  );
}

const monitorStatuses = ['', 'InProgress', 'Failed', 'Approved', 'Rejected', 'Returned', 'Canceled'] as const;

export function MonitorPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<(typeof monitorStatuses)[number]>('');
  const [rows, setRows] = useState<InstanceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    workflowApi.instances(status).then(setRows).catch((failure: unknown) => setError(errorKey(failure)));
  }, [status]);
  return (
    <Box>
      <PageHeader title={t('monitor.title')} subtitle={t('monitor.intro')} />
      <PillTabs value={status} onChange={setStatus} options={monitorStatuses.map((s) => ({ value: s, label: s ? t(`approval.instance.${s}`) : t('monitor.all') }))} />
      <ErrorMessage messageKey={error} />
      <InstancesTable rows={rows} empty={t('myApprovals.empty')} />
    </Box>
  );
}
