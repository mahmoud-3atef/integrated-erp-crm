import Add from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Pagination,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { periodOf, shiftPeriod } from '../../api/attendance';
import { errorKey } from '../../api/auth';
import { daysText, leaveApi, type LeaveDetail, type LeaveKpis, type LeaveRow, type LeaveType, type Permission } from '../../api/leave';
import { hm } from '../../api/attendance';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrEmptyState, HrPageHeader, HrScope, hr, hrAccents, hrCard, type HrAccent } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useMonthName } from '../attendance/AttendanceMonthPage';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { LeaveRequestDialog, LeaveStatusBadge, RequestsTable, leaveLook, typeName } from './leave';
import { PermissionDialog, PermissionsTable } from './permissions';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { DateField } from '../../components/DateField';

type View = 'all' | 'pending' | 'current' | 'permissions' | 'calendar';

function Kpi({ accent, icon, label, value, unit, parts }: { accent: HrAccent; icon: ReactNode; label: string; value: number; unit: string; parts: [string, string | number][] }) {
  const a = hrAccents[accent];
  return (
    <Box sx={{ ...(hrCard as object), bgcolor: a.tint, p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{label}</Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>
            {value.toLocaleString('en-US')} <Box component="span" sx={{ fontSize: 12, fontWeight: 500, color: hr.textMuted }}>{unit}</Box>
          </Typography>
        </Box>
        <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: '#fff', color: a.main, display: 'grid', placeItems: 'center', '& svg': { fontSize: 19 } }}>{icon}</Box>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${parts.length}, 1fr)`, gap: 1, borderTop: '1px dashed rgba(15,39,71,.12)', pt: 0.75 }}>
        {parts.map(([l, v]) => (
          <Box key={l}>
            <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{l}</Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Leave and permissions: the cards, the requests (all, waiting, current) and the month's leave calendar. */
export function LeavePage() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const navigate = useNavigate();
  const { can } = useSession();
  const [view, setView] = useState<View>('all');
  const [kpis, setKpis] = useState<LeaveKpis | null>(null);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [rows, setRows] = useState<{ rows: LeaveRow[]; total: number } | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [typeId, setTypeId] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [permitting, setPermitting] = useState(false);
  const [permissions, setPermissions] = useState<Permission[] | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setPage(1), [query, typeId, view]);
  useEffect(() => {
    leaveApi.kpis().then(setKpis).catch((f) => setError(errorKey(f)));
    leaveApi
      .setup()
      .then((s) => setTypes(s.types))
      .catch(() => setTypes([]));
  }, []);
  useEffect(() => {
    if (view === 'permissions') {
      setPermissions(null);
      leaveApi.permissions({}).then(setPermissions).catch((f) => setError(errorKey(f)));
      return;
    }
    if (view === 'calendar') return;
    setRows(null);
    leaveApi
      .requests({ tab: view, typeId: typeId || undefined, search: query, page, pageSize: 25 })
      .then(setRows)
      .catch((f) => setError(errorKey(f)));
  }, [view, typeId, query, page]);

  return (
    <HrScope>
      <HrPageHeader
        icon={<BeachAccessOutlinedIcon />}
        title={t('leave.title')}
        subtitle={t('leave.intro')}
        actions={
          can('leave.manage', true) && (
            <>
              <Button variant="outlined" startIcon={<TimerOutlinedIcon />} onClick={() => setPermitting(true)}>
                {t('permissions.new')}
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => setAsking(true)}>
                {t('leave.new')}
              </Button>
            </>
          )
        }
      />
      <ErrorMessage messageKey={error} />
      <Box sx={{ display: 'grid', gap: 1.5, mb: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {kpis ? (
          <>
            <Kpi accent="green" icon={<BeachAccessOutlinedIcon />} label={t('leave.kpi.today')} value={kpis.onLeaveToday} unit={t('leave.kpi.employees')} parts={[[t('leave.kpi.annual'), kpis.todayAnnual], [t('leave.kpi.sick'), kpis.todaySick], [t('leave.kpi.other'), kpis.todayOther]]} />
            <Kpi accent="blue" icon={<HourglassEmptyOutlinedIcon />} label={t('leave.kpi.pending')} value={kpis.pending} unit={t('leave.kpi.requests')} parts={[[t('leave.kpi.returned'), kpis.returned]]} />
            <Kpi accent="violet" icon={<EventAvailableOutlinedIcon />} label={t('leave.kpi.upcoming')} value={kpis.upcoming} unit={t('leave.kpi.requests')} parts={[[t('leave.kpi.days'), daysText(kpis.upcomingDays)], [t('leave.kpi.returns'), kpis.returnsToConfirm]]} />
            <Kpi accent="amber" icon={<TimerOutlinedIcon />} label={t('leave.kpi.permissions')} value={kpis.permissionsThisMonth} unit={t('leave.kpi.permissionsUnit')} parts={[[t('leave.kpi.hours'), hm(kpis.permissionMinutesThisMonth)], [t('leave.kpi.pending'), kpis.permissionsPending]]} />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="rounded" height={118} />)
        )}
      </Box>
      <Box sx={{ ...(hrCard as object), px: 2, pb: 2 }}>
        <Tabs value={view} onChange={(_, v: View) => setView(v)} variant="scrollable" sx={{ borderBottom: `1px solid ${hr.border}`, mb: 1.5 }}>
          <Tab value="all" label={t('leave.tabs.all')} />
          <Tab value="pending" label={t('leave.tabs.pending', { count: kpis?.pending ?? 0 })} />
          <Tab value="current" label={t('leave.tabs.current')} />
          <Tab value="permissions" label={t('leave.tabs.permissions')} />
          <Tab value="calendar" label={t('leave.tabs.calendar')} />
        </Tabs>
        {view === 'permissions' ? (
          !permissions ? <LinearProgress /> : <PermissionsTable rows={permissions} onOpen={(id) => navigate(`/hr/permissions/${id}`)} />
        ) : view === 'calendar' ? (
          <LeaveCalendar onOpen={(id) => navigate(`/hr/leave/${id}`)} />
        ) : (
          <>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, mb: 1.5 }}>
              <TextField
                size="small"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('leave.search')}
                sx={{ width: { md: 300 } }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': t('leave.search') } }}
              />
              <TextField select size="small" label={t('leave.type')} value={typeId} onChange={(e) => setTypeId(e.target.value)} sx={{ width: { md: 220 } }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                <MenuItem value="">{t('leave.allTypes')}</MenuItem>
                {types.map((x) => (
                  <MenuItem key={x.id} value={x.id}>
                    {typeName(x, ar)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            {!rows ? (
              <LinearProgress />
            ) : rows.total === 0 ? (
              <HrEmptyState icon={<EventBusyOutlinedIcon />} title={t('leave.none')} hint={t('leave.noneHint')} />
            ) : (
              <>
                <RequestsTable rows={rows.rows} onOpen={(id) => navigate(`/hr/leave/${id}`)} />
                {rows.total > 25 && (
                  <Stack direction="row" sx={{ justifyContent: 'center', mt: 1.5 }}>
                    <Pagination count={Math.ceil(rows.total / 25)} page={page} onChange={(_, p) => setPage(p)} shape="rounded" color="primary" size="small" />
                  </Stack>
                )}
              </>
            )}
          </>
        )}
      </Box>
      {asking && <LeaveRequestDialog onClose={() => setAsking(false)} onSent={(id) => navigate(`/hr/leave/${id}`)} />}
      {permitting && <PermissionDialog onClose={() => setPermitting(false)} onSent={(id) => navigate(`/hr/permissions/${id}`)} />}
    </HrScope>
  );
}

/** The month's leaves (approved and in approval), one row per employee, a bar per leave. */
function LeaveCalendar({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const monthName = useMonthName();
  const [period, setPeriod] = useState(periodOf(new Date()));
  const [list, setList] = useState<LeaveRow[] | null>(null);
  useEffect(() => {
    setList(null);
    leaveApi.calendar(period).then(setList).catch(() => setList([]));
  }, [period]);
  const [y, m] = period.split('-').map(Number) as [number, number];
  const daysIn = new Date(y, m, 0).getDate();
  const people = [...new Map((list ?? []).map((r) => [r.employeeId, r.employeeName])).entries()];
  const colours = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0E7490'];
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5 }}>
        <IconButton size="small" aria-label={t('attendance.prevMonth')} onClick={() => setPeriod(shiftPeriod(period, -1))}>
          {ar ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
        <Typography sx={{ fontWeight: 700, minWidth: 120, textAlign: 'center' }}>{monthName(period)}</Typography>
        <IconButton size="small" aria-label={t('attendance.nextMonth')} onClick={() => setPeriod(shiftPeriod(period, 1))}>
          {ar ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Stack>
      {!list ? (
        <LinearProgress />
      ) : people.length === 0 ? (
        <HrEmptyState icon={<EventBusyOutlinedIcon />} title={t('leave.calendarEmpty')} />
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: `200px repeat(${daysIn}, minmax(22px, 1fr))`, minWidth: 900, fontSize: 11 }}>
            <Box />
            {Array.from({ length: daysIn }, (_, i) => (
              <Box key={i} sx={{ textAlign: 'center', color: hr.textMuted, fontVariantNumeric: 'tabular-nums', py: 0.5 }}>
                {i + 1}
              </Box>
            ))}
            {people.map(([id, name], row) => (
              <Box key={id} sx={{ display: 'contents' }}>
                <Box sx={{ fontWeight: 700, fontSize: 12.5, py: 0.75, borderTop: `1px solid #EEF2F7`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</Box>
                {Array.from({ length: daysIn }, (_, i) => {
                  const day = `${period}-${String(i + 1).padStart(2, '0')}`;
                  const leave = list.find((r) => r.employeeId === id && r.from <= day && r.to >= day);
                  return (
                    <Box key={i} sx={{ borderTop: `1px solid #EEF2F7`, display: 'flex', alignItems: 'center', px: '1px' }}>
                      {leave && (
                        <Box
                          component="button"
                          type="button"
                          title={`${leave.requestNo} · ${typeName(leave, ar)}`}
                          onClick={() => onOpen(leave.id)}
                          sx={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', height: 14, borderRadius: '4px', bgcolor: leave.status === 'Approved' ? colours[row % colours.length] : leaveLook.InApproval.tint, border: leave.status === 'Approved' ? 'none' : `1px dashed ${hr.primary}` }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: 11.5, color: hr.textMuted, mt: 1 }}>{t('leave.calendarHint')}</Typography>
        </Box>
      )}
    </Box>
  );
}

/** A leave request: its approval bar, its details and balance, «send again» once returned, «cancel» before it starts. */
export function LeaveRequestPage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const navigate = useNavigate();
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const [d, setD] = useState<LeaveDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [returning, setReturning] = useState(false);
  const [amending, setAmending] = useState(false);
  const [cancellingApproved, setCancellingApproved] = useState(false);
  const approval = useRecordApproval(d?.approval?.instanceId);
  useCrumb(d?.request.requestNo, `/hr/leave/${id}`);
  const reload = useCallback(async () => {
    try {
      setD(await leaveApi.request(id));
      setError(null);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);
  if (!d) {
    return (
      <HrScope>
        <ErrorMessage messageKey={error} />
        {!error && <LinearProgress />}
      </HrScope>
    );
  }
  const r = d.request;
  const manage = can('leave.manage', true);
  return (
    <HrScope>
      <HrPageHeader
        icon={<BeachAccessOutlinedIcon />}
        title={t('leave.requestTitle', { type: typeName(r, ar) })}
        status={<LeaveStatusBadge status={r.status} />}
        reference={r.requestNo}
        subtitle={
          <>
            <RouterLink to={`/hr/employees/${r.employeeId}`}>{r.employeeName}</RouterLink> · <bdi>{date(r.from)}</bdi> – <bdi>{date(r.to)}</bdi> · {t('leave.daysCount', { days: daysText(r.days) })}
          </>
        }
        actions={
          <>
            {r.status === 'Returned' && manage && (
              <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={() => setEditing(true)}>
                {t('leave.resubmit')}
              </Button>
            )}
            {d.canConfirmReturn && manage && (
              <Button variant="contained" startIcon={<LoginOutlinedIcon />} onClick={() => setReturning(true)}>
                {t('leave.return.confirm')}
              </Button>
            )}
            {d.canAmend && (
              <Button variant="outlined" startIcon={<EditNoteOutlinedIcon />} onClick={() => setAmending(true)}>
                {t('leave.amend.action')}
              </Button>
            )}
            {d.canCancelApproved ? (
              <Button variant="outlined" color="error" startIcon={<ReplayOutlinedIcon />} onClick={() => setCancellingApproved(true)}>
                {t('leave.amend.cancelAction')}
              </Button>
            ) : (
              d.canCancel &&
              manage && (
                <Button variant="outlined" color="error" startIcon={<ReplayOutlinedIcon />} onClick={() => setCancelling(true)}>
                  {t('leave.cancel')}
                </Button>
              )
            )}
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') }} />} onClick={() => navigate(-1)}>
              {t('common.back')}
            </Button>
          </>
        }
      />
      <ErrorMessage messageKey={error} />
      {d.approval && (
        <ApprovalBar
          status={d.approval}
          detail={approval.detail}
          onChanged={() => {
            void reload();
            void approval.reload();
          }}
        />
      )}
      {d.amendedAt && r.status === 'Approved' && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {t('leave.amend.amendedBy', { by: d.amendedByName, date: date(d.amendedAt) })} — {d.amendNote}
        </Alert>
      )}
      {d.canceledAt && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t('leave.amend.canceledBy', { by: d.canceledByName, date: date(d.canceledAt) })}
        </Alert>
      )}
      {d.lastComment && r.status !== 'Approved' && (
        <Alert severity={r.status === 'Rejected' ? 'error' : 'warning'} sx={{ mb: 1.5 }}>
          {d.lastComment}
        </Alert>
      )}
      {d.returnedOn && (
        <Alert severity={d.expectedReturn && d.returnedOn > d.expectedReturn ? 'warning' : 'success'} sx={{ mb: 1.5 }}>
          {t(d.expectedReturn && d.returnedOn > d.expectedReturn ? 'leave.return.late' : 'leave.return.done', { date: date(d.returnedOn), expected: date(d.expectedReturn) })}
          {d.returnNote ? ` · ${d.returnNote}` : ''}
        </Alert>
      )}
      <Box sx={{ ...(hrCard as object), p: 2, display: 'grid', gap: 1.25, maxWidth: 820 }}>
        {(
          [
            [t('leave.employee'), r.employeeName],
            [t('leave.type'), `${typeName(r, ar)} · ${t(`leave.pay.${r.pay}`)}`],
            [t('leave.period'), <><bdi>{date(r.from)}</bdi> – <bdi>{date(r.to)}</bdi></>],
            [t('leave.cols.days'), daysText(r.days)],
            ...(r.hasBalance && d.available !== null ? [[t('leave.preview.available'), daysText(d.available)] as const] : []),
            [t('leave.substitute'), d.substituteName ?? '—'],
            [t('leave.ticket'), d.ticket ? t('leave.yes') : t('leave.no')],
            [t('leave.reason'), d.reason ?? '—'],
            [t('leave.requested'), <>{r.createdByName} · <bdi>{date(r.createdAt)}</bdi></>],
          ] as const
        ).map(([k, v]) => (
          <Stack key={k} direction="row" sx={{ gap: 2, borderBottom: `1px solid #EEF2F7`, pb: 1 }}>
            <Typography sx={{ width: 150, flex: '0 0 auto', color: hr.textMuted, fontSize: 13 }}>{k}</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{v}</Typography>
          </Stack>
        ))}
      </Box>
      {editing && (
        <LeaveRequestDialog
          request={{ id: r.id, employeeName: r.employeeName, input: { employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, from: r.from, to: r.to, reason: d.reason, substituteId: null, ticket: d.ticket } }}
          onClose={() => setEditing(false)}
          onSent={() => {
            setEditing(false);
            void reload();
            void approval.reload();
          }}
        />
      )}
      {returning && (
        <ReturnDialog
          expected={d.expectedReturn}
          onClose={() => setReturning(false)}
          onConfirm={async (on, note) => {
            await leaveApi.confirmReturn(r.id, on, note);
            setReturning(false);
            await reload();
          }}
        />
      )}
      {amending && (
        <LeaveAmendDialog
          detail={d}
          onClose={() => setAmending(false)}
          onSaved={() => {
            setAmending(false);
            void reload();
          }}
        />
      )}
      {cancellingApproved && (
        <CancelDialog
          title={t('leave.amend.cancelAction')}
          hint={t('leave.amend.cancelHint')}
          onClose={() => setCancellingApproved(false)}
          onCancel={async (reason) => {
            await leaveApi.cancelApproved(r.id, reason);
            setCancellingApproved(false);
            await reload();
          }}
        />
      )}
      {cancelling && (
        <CancelDialog
          onClose={() => setCancelling(false)}
          onCancel={async (reason) => {
            await leaveApi.cancel(r.id, reason);
            setCancelling(false);
            await reload();
          }}
        />
      )}
    </HrScope>
  );
}

function ReturnDialog({ expected, onClose, onConfirm }: { expected: string | null; onClose: () => void; onConfirm: (on: string, note: string | null) => Promise<void> }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const [on, setOn] = useState(expected ?? new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('leave.return.confirm')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Typography sx={{ fontSize: 13 }}>{t('leave.return.hint', { expected: date(expected) })}</Typography>
          <DateField size="small" label={t('leave.return.on')} value={on} onChange={(e) => setOn(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          {expected && on < expected && <Alert severity="info" sx={{ py: 0 }}>{t('leave.return.earlyNote')}</Alert>}
          {expected && on > expected && <Alert severity="warning" sx={{ py: 0 }}>{t('leave.return.lateNote')}</Alert>}
          <TextField size="small" label={t('leave.reason')} value={note} onChange={(e) => setNote(e.target.value)} />
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={!on} onClick={() => void onConfirm(on, note.trim() || null).catch((f) => setError(errorKey(f)))}>
            {t('leave.return.confirm')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

function CancelDialog({ title, hint, onClose, onCancel }: { title?: string; hint?: string; onClose: () => void; onCancel: (reason: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{title ?? t('leave.cancel')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Typography sx={{ fontSize: 13 }}>{hint ?? t('leave.cancelHint')}</Typography>
          <TextField size="small" required multiline minRows={2} label={t('leave.reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" color="error" disabled={!reason.trim()} onClick={() => void onCancel(reason.trim()).catch((f) => setError(errorKey(f)))}>
            {title ?? t('leave.cancel')}
          </Button>
          <Button onClick={onClose}>{t('common.back')}</Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

/**
 * Changing an approved leave (its own permission): its days (counted again by its type; the balance follows), the
 * reason and the ticket, with the reason for the change. Not while its attendance month is closing or closed, nor while
 * a settlement made from it stands.
 */
function LeaveAmendDialog({ detail, onClose, onSaved }: { detail: LeaveDetail; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const r = detail.request;
  const [from, setFrom] = useState(r.from);
  const [to, setTo] = useState(r.to);
  const [reason, setReason] = useState(detail.reason ?? '');
  const [ticket, setTicket] = useState(detail.ticket);
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await leaveApi.amend(r.id, { from, to, reason: reason.trim() || null, substituteId: null, ticket, amendReason: why.trim() });
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('leave.amend.title', { no: r.requestNo })}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Alert severity="info">{t('leave.amend.hint')}</Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
            <DateField size="small" label={t('leave.from')} value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
            <DateField size="small" label={t('leave.to')} value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
          </Stack>
          <TextField size="small" multiline minRows={2} label={t('leave.reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          <FormControlLabel control={<Checkbox checked={ticket} onChange={(e) => setTicket(e.target.checked)} />} label={t('leave.ticket')} />
          <TextField size="small" required multiline minRows={2} label={t('leave.amend.reason')} value={why} onChange={(e) => setWhy(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !why.trim() || !from || !to} onClick={() => void save()}>
            {t('leave.amend.save')}
          </Button>
          <Button onClick={onClose}>{t('common.back')}</Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}
