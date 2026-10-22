import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../../api/auth';
import { managementApi, type TaskRow, type TaskStatus, type Tasks, type TaskType } from '../../../api/management';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { DataTable, Donut, finCard, md, Pill, Rolling, useNumbers, type Column } from './mdKit';

type StatusFilter = 'pending' | TaskStatus | 'all';

const typeLook: Record<TaskType, { color: string; bg: string }> = {
  invoice: { color: md.teal, bg: md.glassHi },
  deliver: { color: '#1F78C8', bg: md.glassHi },
  housing: { color: md.brown, bg: md.glassHi },
  vacation: { color: md.amberDeep, bg: md.glassHi },
  permission: { color: '#7C5CBF', bg: md.glassHi },
  other: { color: md.muted, bg: md.glassHi },
};

const statusLook: Record<TaskStatus, { color: string; bg: string }> = {
  done: { color: md.greenDeep, bg: md.glassHi },
  late: { color: md.red, bg: md.glassHi },
  open: { color: md.blue, bg: md.glassHi },
};

/**
 * «المهام» as the old dashboard had it (docs/03-migration-plan/19): the old system's tasks of the period, read from the
 * CRM copy. A task is shown only (it cannot be opened or changed here: its record lives in the old system).
 */
export function TasksTab({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation();
  const f = useNumbers();
  const [data, setData] = useState<Tasks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [type, setType] = useState<TaskType | 'all'>('all');
  const [owner, setOwner] = useState<string | null>(null);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [shown, setShown] = useState<TaskRow | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    setOwner(null);
    managementApi
      .tasks(from, to)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errorKey(e)));
    return () => {
      live = false;
    };
  }, [from, to]);

  const rows = useMemo(
    () =>
      (data?.rows ?? []).filter(
        (r) =>
          (status === 'all' || (status === 'pending' ? r.status !== 'done' : r.status === status)) && (type === 'all' || r.type === type) && (!owner || r.owner === owner),
      ),
    [data, status, type, owner],
  );

  const columns = useMemo<Column<TaskRow>[]>(
    () => [
      {
        key: 'task',
        label: t('mgmt.tasks.col.task'),
        render: (r) => (
          <Box sx={{ minWidth: 0, maxWidth: 320, whiteSpace: 'normal' }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: md.ink }}>
              <bdi>{r.subject || '—'}</bdi>
            </Typography>
            {r.regarding && (
              <Typography sx={{ fontSize: 11, color: md.muted, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LinkOutlinedIcon sx={{ fontSize: 13 }} />
                <bdi>{r.regarding}</bdi>
              </Typography>
            )}
          </Box>
        ),
        text: (r) => `${r.subject} ${r.regarding ?? ''}`,
      },
      { key: 'owner', label: t('mgmt.tasks.col.owner'), render: (r) => <bdi>{r.owner}</bdi>, text: (r) => r.owner },
      { key: 'type', label: t('mgmt.tasks.col.type'), render: (r) => <Pill {...typeLook[r.type]}>{t(`mgmt.tasks.type.${r.type}`)}</Pill> },
      {
        key: 'created',
        label: t('mgmt.tasks.col.created'),
        render: (r) => (
          <>
            <bdi>{r.createdOn ?? '—'}</bdi>
            <Typography sx={{ fontSize: 10.5, color: md.muted }}>{t('mgmt.tasks.since', { count: r.ageDays })}</Typography>
          </>
        ),
      },
      {
        key: 'due',
        label: t('mgmt.tasks.col.due'),
        render: (r) => (
          <>
            <bdi>{r.dueOn ?? '—'}</bdi>
            <Box sx={{ mt: 0.25 }}>
              <Timing row={r} />
            </Box>
          </>
        ),
      },
      { key: 'status', label: t('mgmt.tasks.col.status'), render: (r) => <Pill {...statusLook[r.status]}>{t(`mgmt.tasks.status.${r.status}`)}</Pill> },
    ],
    [t],
  );

  if (error) return <ErrorMessage messageKey={error} />;
  if (!data) {
    return (
      <Stack sx={{ gap: 2 }}>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(5, minmax(0,1fr))' } }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={86} sx={{ borderRadius: '12px' }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={420} sx={{ borderRadius: '16px' }} />
      </Stack>
    );
  }

  const owners = data.owners.filter((o) => o.name.toLowerCase().includes(ownerSearch.trim().toLowerCase()));
  const typeTop = Math.max(1, ...data.byType.map((x) => x.total));

  return (
    <Stack sx={{ gap: 2 }}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(5, minmax(0,1fr))' } }}>
        <TaskKpi color={md.teal} icon={<ChecklistOutlinedIcon />} label={t('mgmt.tasks.total')} value={<Rolling value={data.total} />} foot={t('mgmt.inPeriod')} onClick={() => (setStatus('all'), setOwner(null))} />
        <TaskKpi
          color={md.green}
          icon={<CheckCircleOutlineOutlinedIcon />}
          label={t('mgmt.tasks.done')}
          value={<Rolling value={data.completed} />}
          foot={t('mgmt.tasks.completion', { rate: data.completionRate === null ? '—' : f.p(data.completionRate) })}
          footColor={md.greenDeep}
          onClick={() => setStatus('done')}
        />
        <TaskKpi color={md.blue} icon={<HourglassBottomOutlinedIcon />} label={t('mgmt.tasks.open')} value={<Rolling value={data.open} />} foot={t('mgmt.tasks.openFoot')} onClick={() => setStatus('pending')} />
        <TaskKpi color={md.red} icon={<WarningAmberOutlinedIcon />} label={t('mgmt.tasks.late')} value={<Rolling value={data.overdue} />} valueColor={md.red} foot={t('mgmt.tasks.lateFoot')} onClick={() => setStatus('late')} />
        <TaskKpi
          color={md.navy}
          icon={<ScheduleOutlinedIcon />}
          label={t('mgmt.tasks.onTime')}
          value={data.onTimeRate === null ? '—' : <><Rolling value={data.onTimeRate} decimals={1} />%</>}
          foot={t('mgmt.tasks.onTimeFoot')}
        />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 290px' }, alignItems: 'start' }}>
        <Box sx={finCard}>
          <DataTable
            title={owner ? t('mgmt.tasks.ofOwner', { name: owner }) : t('mgmt.tasks.all')}
            badge={t('mgmt.tasks.shown', { count: rows.length })}
            rows={rows}
            columns={columns}
            excel={managementApi.tasksExcel(from, to)}
            empty={t('mgmt.tasks.empty')}
            onRow={setShown}
            filters={
              <Stack sx={{ gap: 0.75, mb: 1.25 }}>
                <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                  {(['pending', 'late', 'open', 'done', 'all'] as StatusFilter[]).map((s) => (
                    <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                      {t(`mgmt.tasks.filter.${s}`)}
                    </Chip>
                  ))}
                  {owner && (
                    <Chip active onClick={() => setOwner(null)}>
                      {t('mgmt.tasks.allStaff')} ✕
                    </Chip>
                  )}
                </Stack>
                <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                  {(['all', 'invoice', 'deliver', 'housing', 'vacation', 'permission', 'other'] as const).map((k) => (
                    <Chip key={k} active={type === k} onClick={() => setType(k)} dot={k === 'all' ? undefined : typeLook[k].color}>
                      {k === 'all' ? t('mgmt.tasks.allTypes') : t(`mgmt.tasks.type.${k}`)}
                    </Chip>
                  ))}
                </Stack>
              </Stack>
            }
          />
          <Typography sx={{ fontSize: 11, color: md.muted, mt: 1 }}>{t('mgmt.tasks.listNote', { count: 300 })}</Typography>
        </Box>

        <Box sx={finCard}>
          <Typography component="h3" sx={{ fontSize: 14.5, fontWeight: 700, color: md.title }}>
            {t('mgmt.tasks.staff')}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: md.muted, mb: 1 }}>{t('mgmt.tasks.staffHint')}</Typography>
          <TextField size="small" fullWidth placeholder={t('mgmt.tasks.staffSearch')} value={ownerSearch} onChange={(e) => setOwnerSearch(e.target.value)} sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          <Stack sx={{ gap: 1, maxHeight: 640, overflowY: 'auto', scrollbarWidth: 'thin', pe: 0.5 }}>
            {owners.map((o) => {
              const late = o.overdue > 0;
              return (
                <ButtonBase
                  key={o.name}
                  onClick={() => (setOwner(owner === o.name ? null : o.name), setStatus('pending'))}
                  sx={{
                    display: 'flex',
                    gap: 1,
                    p: 1.25,
                    borderRadius: '12px',
                    textAlign: 'start',
                    border: `1px solid ${owner === o.name ? md.navy : md.border}`,
                    boxShadow: `inset -3px 0 0 ${late ? md.red : o.open ? md.blue : md.green}`,
                    bgcolor: owner === o.name ? md.glassHi : md.glass,
                  }}
                >
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: md.navy, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, flex: '0 0 auto' }}>
                    <bdi>{Array.from(o.name.trim())[0]?.toUpperCase() ?? '—'}</bdi>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: md.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <bdi>{o.name}</bdi>
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: md.muted }}>{t('mgmt.tasks.ownerSub', { total: o.total, completion: f.p(o.completionRate), onTime: f.p(o.onTimeRate) })}</Typography>
                    <Stack direction="row" sx={{ height: 5, borderRadius: 999, overflow: 'hidden', bgcolor: md.track, my: 0.5 }}>
                      <Box sx={{ width: `${(o.completed / Math.max(1, o.total)) * 100}%`, bgcolor: md.green }} />
                      <Box sx={{ width: `${((o.open - o.overdue) / Math.max(1, o.total)) * 100}%`, bgcolor: md.blue }} />
                      <Box sx={{ width: `${(o.overdue / Math.max(1, o.total)) * 100}%`, bgcolor: md.red }} />
                    </Stack>
                    {o.open > 0 && <Typography sx={{ fontSize: 10.5, color: late ? md.red : md.muted }}>{t('mgmt.tasks.oldest', { count: o.oldestPendingDays })}</Typography>}
                  </Box>
                  <Box sx={{ textAlign: 'center', flex: '0 0 auto' }}>
                    <Typography sx={{ fontSize: 18, fontWeight: 700, color: late ? md.red : o.open ? md.blue : md.green }}>{o.open}</Typography>
                    {late ? <Pill {...statusLook.late}>{t('mgmt.tasks.lateCount', { count: o.overdue })}</Pill> : <Typography sx={{ fontSize: 10.5, color: md.muted }}>{t('mgmt.tasks.pending')}</Typography>}
                  </Box>
                </ButtonBase>
              );
            })}
          </Stack>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.4fr) minmax(0, 1fr)' } }}>
        <Box sx={finCard}>
          <Typography component="h3" sx={{ fontSize: 14.5, fontWeight: 700, color: md.title, mb: 1.5 }}>
            {t('mgmt.tasks.byType')}
          </Typography>
          <Stack sx={{ gap: 1 }}>
            {data.byType.map((x) => (
              <ButtonBase key={x.type} onClick={() => (setType(x.type), setStatus('all'))} sx={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr) 64px', gap: 1.25, alignItems: 'center', textAlign: 'start', borderRadius: '8px', p: 0.5 }}>
                <Typography sx={{ fontSize: 12.5, color: md.text }}>{t(`mgmt.tasks.type.${x.type}`)}</Typography>
                <Stack direction="row" sx={{ height: 10, borderRadius: 999, overflow: 'hidden', bgcolor: md.track }}>
                  <Box sx={{ width: `${(x.done / typeTop) * 100}%`, bgcolor: md.green }} />
                  <Box sx={{ width: `${(x.open / typeTop) * 100}%`, bgcolor: '#E8890C' }} />
                </Stack>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: md.ink, textAlign: 'end' }}>{f.n(x.total)}</Typography>
              </ButtonBase>
            ))}
          </Stack>
          <Stack direction="row" sx={{ gap: 2, mt: 1.25, fontSize: 11.5, color: md.muted }}>
            <span>
              <Box component="span" sx={{ color: md.green }}>■</Box> {t('mgmt.tasks.status.done')}
            </span>
            <span>
              <Box component="span" sx={{ color: '#E8890C' }}>■</Box> {t('mgmt.tasks.pending')}
            </span>
          </Stack>
        </Box>
        <Box sx={finCard}>
          <Typography component="h3" sx={{ fontSize: 14.5, fontWeight: 700, color: md.title, mb: 1.5 }}>
            {t('mgmt.tasks.statuses')}
          </Typography>
          <Donut
            items={[
              { key: 'done', label: t('mgmt.tasks.status.done'), value: data.completed },
              { key: 'open', label: t('mgmt.tasks.status.open'), value: data.open - data.overdue },
              { key: 'late', label: t('mgmt.tasks.status.late'), value: data.overdue },
            ]}
            colors={[md.green, md.blue, md.red]}
          />
        </Box>
      </Box>

      <Dialog open={!!shown} onClose={() => setShown(null)} maxWidth="sm" fullWidth aria-labelledby="task-title">
        {shown && (
          <>
            <DialogTitle id="task-title" sx={{ fontWeight: 700, color: md.title }}>
              <bdi>{shown.subject || '—'}</bdi>
            </DialogTitle>
            <DialogContent dividers>
              <Stack sx={{ gap: 1.25 }}>
                <Fact label={t('mgmt.tasks.col.status')}>
                  <Pill {...statusLook[shown.status]}>{t(`mgmt.tasks.status.${shown.status}`)}</Pill> <Timing row={shown} />
                </Fact>
                <Fact label={t('mgmt.tasks.col.type')}>{t(`mgmt.tasks.type.${shown.type}`)}</Fact>
                <Fact label={t('mgmt.tasks.regarding')}>
                  <bdi>{shown.regarding ?? '—'}</bdi>
                </Fact>
                <Fact label={t('mgmt.tasks.col.owner')}>
                  <bdi>{shown.owner}</bdi>
                </Fact>
                <Fact label={t('mgmt.tasks.col.created')}>
                  <bdi>{shown.createdOn ?? '—'}</bdi>
                </Fact>
                <Fact label={t('mgmt.tasks.col.due')}>
                  <bdi>{shown.dueOn ?? '—'}</bdi>
                </Fact>
                {shown.doneOn && (
                  <Fact label={t('mgmt.tasks.doneOn')}>
                    <bdi>{shown.doneOn}</bdi>
                  </Fact>
                )}
                <Typography sx={{ fontSize: 12, color: md.muted, mt: 0.5 }}>{t('mgmt.tasks.viewOnly')}</Typography>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShown(null)} autoFocus>
                {t('common.close')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Stack>
  );
}

function Timing({ row }: { row: TaskRow }) {
  const { t } = useTranslation();
  const look =
    row.timing === 'late' || row.timing === 'lateNoDue' || row.timing === 'doneLate'
      ? statusLook.late
      : row.timing === 'doneOnTime'
        ? statusLook.done
        : { color: md.muted, bg: md.glassHi };
  return <Pill {...look}>{t(`mgmt.tasks.timing.${row.timing}`, { count: row.timingDays })}</Pill>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
      <Typography sx={{ fontSize: 12.5, color: md.muted, minWidth: 120 }}>{label}</Typography>
      <Box sx={{ fontSize: 13.5, fontWeight: 600, color: md.ink }}>{children}</Box>
    </Stack>
  );
}

function Chip({ active, onClick, dot, children }: { active: boolean; onClick: () => void; dot?: string; children: ReactNode }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{ gap: 0.75, px: 1.5, py: 0.6, borderRadius: 999, fontSize: 12, fontWeight: 700, color: active ? '#fff' : md.text, bgcolor: active ? md.navy : md.glassHi, border: `1px solid ${active ? md.navy : md.border}` }}
    >
      {dot && <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: dot }} />}
      {children}
    </ButtonBase>
  );
}

function TaskKpi({ color, icon, label, value, foot, footColor, valueColor, onClick }: { color: string; icon: ReactNode; label: string; value: ReactNode; foot: string; footColor?: string; valueColor?: string; onClick?: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={!onClick}
      sx={{ justifyContent: 'flex-start', gap: 1.5, p: '12px 14px', borderRadius: '12px', bgcolor: md.glass, border: `1px solid ${md.border}`, boxShadow: `inset 0 3px 0 ${color}, 0 4px 14px rgba(10,60,88,.07)`, textAlign: 'start' }}
    >
      <Box aria-hidden sx={{ width: 42, height: 42, borderRadius: '50%', bgcolor: color, color: '#fff', display: 'grid', placeItems: 'center', flex: '0 0 auto', '& svg': { fontSize: 21 } }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, color: md.label }}>{label}</Typography>
        <Typography component="div" sx={{ fontSize: 24, fontWeight: 700, color: valueColor ?? md.glow, textShadow: valueColor ? undefined : md.glowShadow, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: 11, color: footColor ?? md.muted }}>{foot}</Typography>
      </Box>
    </ButtonBase>
  );
}
