import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MoreTimeOutlinedIcon from '@mui/icons-material/MoreTimeOutlined';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import SearchIcon from '@mui/icons-material/Search';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Pagination,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import {
  attendanceApi,
  hhmm,
  hm,
  periodOf,
  rowStates,
  shiftPeriod,
  type AttendanceException,
  type AttendanceMonth,
  type ImportInfo,
  type MonthPage,
  type MonthStatus,
  type NamedRef,
  type Overtime,
  type RowState,
} from '../../api/attendance';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrAccents, hrCard, type HrAccent } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval, ShownStatus } from '../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { DaysDrawer } from './DaysDrawer';
import { ImportDialog } from './ImportDialog';
import { OvertimeDialog, OvertimeList } from './Overtime';

type View = 'employees' | 'exceptions' | 'overtime' | 'imports';

export const monthLook: Record<MonthStatus, { color: string; tint: string }> = {
  Open: { color: hr.success, tint: '#D1FAE5' },
  InApproval: { color: hr.primary, tint: '#EFF6FF' },
  Closed: { color: hr.textMuted, tint: hr.muted },
};

export const stateLook: Record<RowState, { color: string; tint: string }> = {
  Complete: { color: hr.success, tint: '#D1FAE5' },
  Exceptions: { color: hr.primary, tint: '#EFF6FF' },
  NoPunches: { color: '#B91C1C', tint: '#FEE2E2' },
  NoWorkDays: { color: hr.textMuted, tint: hr.muted },
};

export function useMonthName() {
  const { i18n } = useTranslation();
  return (period: string) => new Date(`${period}-01T00:00:00`).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' });
}

export const localRef = (r: { nameAr: string | null; nameEn: string | null } | NamedRef, ar: boolean) => (ar ? (r.nameAr ?? r.nameEn) : (r.nameEn ?? r.nameAr)) ?? '';

/** The attendance month: the header and its period, the cards, the employees (server paging and totals), the exceptions and the imported files. */
export function AttendanceMonthPage() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const monthName = useMonthName();
  const [params, setParams] = useSearchParams();
  const period = params.get('period') ?? periodOf(new Date());
  const [entity, setEntity] = useState('');
  const [view, setView] = useState<View>('employees');
  const [month, setMonth] = useState<AttendanceMonth | null>(null);
  const [rows, setRows] = useState<MonthPage | null>(null);
  const [exceptions, setExceptions] = useState<AttendanceException[] | null>(null);
  const [imports, setImports] = useState<ImportInfo[] | null>(null);
  const [overtime, setOvertime] = useState<Overtime[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [closing, setClosing] = useState<'submit' | 'reopen' | null>(null);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [shift, setShift] = useState('');
  const [state, setState] = useState('');
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: 'name', desc: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [drawer, setOpen] = useState<{ id: string; date?: string } | null>(null);
  const [version, setVersion] = useState(0);
  const latest = useRef(0);
  const canManage = can('attendance.manage', true);
  const approval = useRecordApproval(month?.approval?.instanceId);
  const open = month?.status === 'Open';
  const editable = canManage && open;

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setPage(1), [query, department, shift, state, entity, period, pageSize, sort]);

  useEffect(() => {
    setMonth(null);
    attendanceApi
      .month(period, entity || undefined)
      .then((m) => (setMonth(m), setError(null)))
      .catch((failure) => setError(errorKey(failure)));
    attendanceApi.exceptions(period, entity || undefined).then(setExceptions).catch(() => setExceptions([]));
    attendanceApi.overtimeOf(period).then(setOvertime).catch(() => setOvertime([]));
  }, [period, entity, version]);

  useEffect(() => {
    if (view === 'imports') attendanceApi.imports().then(setImports).catch(() => setImports([]));
  }, [view, version]);

  const q = useMemo(
    () => ({ legalEntityId: entity || undefined, search: query, departmentId: department || undefined, shiftId: shift || undefined, state: state || undefined, sort: sort.key, desc: sort.desc, page, pageSize }),
    [entity, query, department, shift, state, sort, page, pageSize],
  );
  useEffect(() => {
    const ticket = ++latest.current;
    attendanceApi
      .employees(period, q)
      .then((d) => ticket === latest.current && setRows(d))
      .catch((failure) => ticket === latest.current && setError(errorKey(failure)));
  }, [period, q, version]);

  const go = (by: number) => setParams((p) => (p.set('period', shiftPeriod(period, by)), p), { replace: true });
  const k = month?.kpis;
  const filtered = Boolean(query || department || shift || state);
  const from = rows && rows.total > 0 ? (page - 1) * pageSize + 1 : 0;
  const to = rows ? Math.min(rows.total, page * pageSize) : 0;

  const sortable = (key: string, label: string) => (
    <TableSortLabel active={sort.key === key} direction={sort.key === key && sort.desc ? 'desc' : 'asc'} onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'name' && key !== 'no' }))}>
      {label}
    </TableSortLabel>
  );

  return (
    <HrScope>
      <HrPageHeader
        icon={<AccessTimeOutlinedIcon />}
        title={t('attendance.title')}
        status={month && <ShownStatus approval={approval.detail}><HrStatusBadge label={t(`attendance.monthStatus.${month.status}`)} {...monthLook[month.status]} /></ShownStatus>}
        reference={`ATT-${period}`}
        subtitle={
          month ? (
            <>
              <bdi>{t('attendance.period', { from: date(month.from), to: date(month.to) })}</bdi>
              {' · '}
              {month.lastImport ? (
                <>
                  {t('attendance.lastImport')} <bdi>{month.lastImport.fileName}</bdi> · {date(month.lastImport.createdAt)} · {month.lastImport.createdByName}
                </>
              ) : (
                t('attendance.noImport')
              )}
            </>
          ) : (
            t('attendance.intro')
          )
        }
        period={
          <Stack direction="row" sx={{ alignItems: 'center', border: `1px solid ${hr.border}`, borderRadius: '8px', bgcolor: '#fff', height: 36 }}>
            <IconButton size="small" aria-label={t('attendance.prevMonth')} onClick={() => go(-1)}>
              {ar ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
            </IconButton>
            <Typography sx={{ fontWeight: 700, fontSize: 13, px: 1, minWidth: 110, textAlign: 'center' }}>{monthName(period)}</Typography>
            <IconButton size="small" aria-label={t('attendance.nextMonth')} onClick={() => go(1)}>
              {ar ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </IconButton>
          </Stack>
        }
        actions={
          <>
            <TextField select size="small" value={entity} onChange={(e) => setEntity(e.target.value)} sx={{ width: 210, bgcolor: '#fff' }} slotProps={{ select: { displayEmpty: true }, htmlInput: { 'aria-label': t('attendance.allEntities') } }}>
              <MenuItem value="">{t('attendance.allEntities')}</MenuItem>
              {(month?.legalEntities ?? []).map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {localRef(e, ar)}
                </MenuItem>
              ))}
            </TextField>
            {editable && (
              <>
                <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => setImporting(true)}>
                  {t('attendance.import')}
                </Button>
                <Button variant="contained" startIcon={<LockOutlinedIcon />} disabled={!month?.hasData} onClick={() => setClosing('submit')}>
                  {t('attendance.close.submit')}
                </Button>
              </>
            )}
            {month?.status === 'Closed' && can('attendance.month.reopen', true) && (
              <Button variant="outlined" startIcon={<LockOpenOutlinedIcon />} onClick={() => setClosing('reopen')}>
                {t('attendance.close.reopen')}
              </Button>
            )}
          </>
        }
      />
      <ErrorMessage messageKey={error} />
      {month?.approval && (
        <ApprovalBar
          status={month.approval}
          detail={approval.detail}
          onChanged={() => {
            setVersion((v) => v + 1);
            void approval.reload();
          }}
        />
      )}
      {month && !open && (
        <Alert severity="info" icon={<LockOutlinedIcon />} sx={{ mb: 1.5 }}>
          {month.status === 'Closed' ? t('attendance.close.closedNote', { date: date(month.closedAt) }) : t('attendance.close.inApprovalNote', { by: month.submittedByName ?? '', date: date(month.submittedAt) })}
        </Alert>
      )}
      {month && open && month.lastComment && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t('attendance.close.comment', { comment: month.lastComment })}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      <Box sx={{ display: 'grid', gap: 1.5, mb: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {k ? (
          <>
            <Kpi accent="violet" icon={<GroupsOutlinedIcon />} label={t('attendance.kpi.employees')} value={k.employees} unit={t('attendance.kpi.employeesUnit')} parts={[[t('attendance.kpi.full'), k.withFullPunches], [t('attendance.kpi.none'), k.withoutPunches], [t('attendance.kpi.allLeave'), k.onLeaveAllMonth]]} />
            <Kpi accent="rose" icon={<EventBusyOutlinedIcon />} label={t('attendance.kpi.absence')} value={k.absenceDays} unit={t('attendance.kpi.days')} parts={[[t('attendance.kpi.deduction'), k.deductionDays], [t('attendance.kpi.excused'), k.excusedDays]]} />
            <Kpi accent="amber" icon={<TimerOutlinedIcon />} label={t('attendance.kpi.late')} value={k.lateMinutes} unit={t('attendance.kpi.minutes')} parts={[[t('attendance.kpi.lateEmployees'), k.lateEmployees], [t('attendance.kpi.early'), k.earlyMinutes]]} />
            <Kpi accent="blue" icon={<PriorityHighIcon />} label={t('attendance.kpi.exceptions')} value={k.openExceptions} unit={t('attendance.kpi.exceptionsUnit')} parts={[[t('attendance.kpi.missing'), k.missingPunches], [t('attendance.kpi.unexcused'), k.openExceptions - k.missingPunches]]} />
            <Kpi accent="green" icon={<MoreTimeOutlinedIcon />} label={t('attendance.kpi.overtime')} value={Math.round(k.overtimeMinutes / 6) / 10} unit={t('attendance.kpi.hours')} parts={[[t('attendance.kpi.overtimePending'), k.overtimePending], [t('attendance.kpi.overtimeRequests'), overtime?.length ?? 0]]} />
          </>
        ) : (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} variant="rounded" height={118} />)
        )}
      </Box>
      <Box sx={{ ...(hrCard as object), px: 2, pb: 2 }}>
        <Tabs value={view} onChange={(_, v: View) => setView(v)} variant="scrollable" sx={{ borderBottom: `1px solid ${hr.border}`, mb: 1.5 }}>
          <Tab value="employees" label={t('attendance.tabs.employees', { count: k?.employees ?? 0 })} />
          <Tab value="exceptions" label={t('attendance.tabs.exceptions', { count: exceptions?.length ?? 0 })} />
          <Tab value="overtime" label={t('attendance.tabs.overtime', { count: overtime?.length ?? 0 })} />
          <Tab value="imports" label={t('attendance.tabs.imports')} />
        </Tabs>
        {view === 'employees' && (
          <>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, mb: 1.5 }}>
              <TextField
                size="small"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('attendance.filters.search')}
                sx={{ width: { md: 300 } }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': t('attendance.filters.search') } }}
              />
              <Filter label={t('attendance.filters.department')} all={t('attendance.filters.allDepartments')} value={department} onChange={setDepartment} options={(month?.departments ?? []).map((d) => [d.id, localRef(d, ar)])} />
              <Filter label={t('attendance.filters.shift')} all={t('attendance.filters.allShifts')} value={shift} onChange={setShift} options={(month?.shifts ?? []).map((s) => [s.id, localRef(s, ar)])} />
              <Filter label={t('attendance.filters.state')} all={t('attendance.filters.allStates')} value={state} onChange={setState} options={rowStates.map((s) => [s, t(`attendance.state.${s}`)])} />
            </Stack>
            {!rows ? (
              <LinearProgress />
            ) : rows.total === 0 ? (
              <HrEmptyState
                icon={<FactCheckOutlinedIcon />}
                title={filtered ? t('attendance.noResults') : t('attendance.empty')}
                hint={filtered ? undefined : t('attendance.emptyHint')}
                action={!filtered && canManage ? <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => setImporting(true)}>{t('attendance.import')}</Button> : undefined}
              />
            ) : (
              <>
                <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
                  <Table size="small" stickyHeader sx={{ '& td': { height: 46, fontVariantNumeric: 'tabular-nums' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell rowSpan={2}>{sortable('name', t('attendance.cols.employee'))}</TableCell>
                        <TableCell rowSpan={2}>{t('attendance.cols.shift')}</TableCell>
                        <TableCell colSpan={4} align="center">{t('attendance.cols.days')}</TableCell>
                        <TableCell colSpan={3} align="center">{t('attendance.cols.minutes')}</TableCell>
                        <TableCell rowSpan={2}>{sortable('deduction', t('attendance.cols.deduction'))}</TableCell>
                        <TableCell rowSpan={2}>{sortable('overtime', t('attendance.cols.overtime'))}</TableCell>
                        <TableCell rowSpan={2}>{t('attendance.cols.state')}</TableCell>
                        <TableCell rowSpan={2} />
                      </TableRow>
                      <TableRow sx={{ '& th': { top: 37 } }}>
                        <TableCell>{t('attendance.cols.workDays')}</TableCell>
                        <TableCell>{sortable('present', t('attendance.cols.present'))}</TableCell>
                        <TableCell>{sortable('absent', t('attendance.cols.absent'))}</TableCell>
                        <TableCell>{t('attendance.cols.leave')}</TableCell>
                        <TableCell>{sortable('late', t('attendance.cols.late'))}</TableCell>
                        <TableCell>{sortable('early', t('attendance.cols.early'))}</TableCell>
                        <TableCell>{sortable('missing', t('attendance.cols.missing'))}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.rows.map((r) => (
                        <TableRow key={r.employeeId} hover sx={{ cursor: 'pointer' }} onClick={() => setOpen({ id: r.employeeId })}>
                          <TableCell sx={{ minWidth: 230 }}>
                            <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                              <HrAvatar name={r.nameEn || r.nameAr || '?'} />
                              <Box>
                                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{ar ? (r.nameAr ?? r.nameEn) : r.nameEn}</Typography>
                                <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>
                                  <bdi>{r.employeeNo}</bdi>
                                  {(ar ? r.departmentAr : r.departmentEn) ? ` · ${ar ? r.departmentAr : r.departmentEn}` : ''}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{localRef({ nameAr: r.shiftAr, nameEn: r.shiftEn }, ar) || '—'}</TableCell>
                          <TableCell>{r.workDays}</TableCell>
                          <TableCell>{r.present}</TableCell>
                          <TableCell sx={{ color: r.absent ? '#BE123C' : undefined, fontWeight: r.absent ? 700 : undefined }}>{r.absent}</TableCell>
                          <TableCell>{r.leave}</TableCell>
                          <TableCell>{r.lateMinutes ? <bdi>{hm(r.lateMinutes)}</bdi> : 0}</TableCell>
                          <TableCell>{r.earlyMinutes ? <bdi>{hm(r.earlyMinutes)}</bdi> : 0}</TableCell>
                          <TableCell>{r.missingPunches}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{r.deduction || '—'}</TableCell>
                          <TableCell>{r.overtimeMinutes ? <bdi>{hm(r.overtimeMinutes)}</bdi> : '—'}</TableCell>
                          <TableCell>
                            <HrStatusBadge label={t(`attendance.state.${r.state}`)} {...stateLook[r.state]} />
                          </TableCell>
                          <TableCell>
                            <Button size="small" sx={{ fontWeight: 600 }}>
                              {t('attendance.days')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ '& td': { bgcolor: '#F8FAFC !important', fontWeight: 700, borderTop: `1px solid ${hr.border}` } }}>
                        <TableCell colSpan={2}>{t('attendance.totalAll', { count: rows.totals.employees })}</TableCell>
                        <TableCell>{rows.totals.workDays.toLocaleString('en-US')}</TableCell>
                        <TableCell>{rows.totals.present.toLocaleString('en-US')}</TableCell>
                        <TableCell>{rows.totals.absent}</TableCell>
                        <TableCell>{rows.totals.leave}</TableCell>
                        <TableCell><bdi>{hm(rows.totals.lateMinutes)}</bdi></TableCell>
                        <TableCell><bdi>{hm(rows.totals.earlyMinutes)}</bdi></TableCell>
                        <TableCell>{rows.totals.missingPunches}</TableCell>
                        <TableCell>{rows.totals.deduction}</TableCell>
                        <TableCell><bdi>{hm(rows.totals.overtimeMinutes)}</bdi></TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
                <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: 'center', gap: 1.5, mt: 1.5 }}>
                  <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>{t('attendance.shown', { from, to, total: rows.total })}</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Pagination count={Math.max(1, Math.ceil(rows.total / pageSize))} page={page} onChange={(_, p) => setPage(p)} shape="rounded" color="primary" size="small" />
                  <TextField select size="small" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} sx={{ width: 150 }}>
                    {[10, 25, 50, 100].map((n) => (
                      <MenuItem key={n} value={n}>
                        {t('attendance.perPage', { count: n })}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              </>
            )}
          </>
        )}
        {view === 'exceptions' &&
          (!exceptions ? (
            <LinearProgress />
          ) : exceptions.length === 0 ? (
            <HrEmptyState icon={<FactCheckOutlinedIcon />} title={t('attendance.noExceptions')} />
          ) : (
            <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 640 }}>
              <Table size="small" stickyHeader sx={{ '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('attendance.cols.date')}</TableCell>
                    <TableCell>{t('attendance.cols.employee')}</TableCell>
                    <TableCell>{t('attendance.cols.status')}</TableCell>
                    <TableCell>{t('attendance.cols.in')}</TableCell>
                    <TableCell>{t('attendance.cols.out')}</TableCell>
                    <TableCell>{t('attendance.cols.device')}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {exceptions.map((e) => (
                    <TableRow key={`${e.employeeId}-${e.date}`} hover sx={{ cursor: 'pointer' }} onClick={() => setOpen({ id: e.employeeId, date: e.date })}>
                      <TableCell>{date(e.date)}</TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{ar ? (e.nameAr ?? e.nameEn) : e.nameEn}</Typography>
                        <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>
                          <bdi>{e.employeeNo}</bdi>
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <HrStatusBadge label={t(`attendance.status.${e.status}`)} {...(e.status === 'Absent' ? { color: '#BE123C', tint: '#FFF1F2' } : e.status === 'DeviceLeave' ? { color: '#B45309', tint: '#FEF3C7' } : { color: hr.primary, tint: '#EFF6FF' })} />
                      </TableCell>
                      <TableCell><bdi>{hhmm(e.in) ?? '—'}</bdi></TableCell>
                      <TableCell><bdi>{hhmm(e.out) ?? '—'}</bdi></TableCell>
                      <TableCell sx={{ color: hr.textMuted }}>{e.deviceStatus ?? '—'}</TableCell>
                      <TableCell>
                        <Button size="small" sx={{ fontWeight: 600 }}>
                          {t('attendance.days')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ))}
        {view === 'overtime' && (
          <>
            {editable && (
              <Box sx={{ mb: 1.5 }}>
                <Button variant="outlined" startIcon={<MoreTimeOutlinedIcon />} onClick={() => setAsking(true)}>
                  {t('overtime.new')}
                </Button>
              </Box>
            )}
            <OvertimeList list={overtime} onOpen={(id) => navigate(`/hr/overtime/${id}`)} />
          </>
        )}
        {view === 'imports' &&
          (!imports ? (
            <LinearProgress />
          ) : imports.length === 0 ? (
            <HrEmptyState icon={<UploadFileOutlinedIcon />} title={t('attendance.noImports')} />
          ) : (
            <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
              <Table size="small" sx={{ '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('attendance.cols.file')}</TableCell>
                    <TableCell>{t('attendance.cols.range')}</TableCell>
                    <TableCell>{t('attendance.cols.rows')}</TableCell>
                    <TableCell>{t('attendance.cols.accepted')}</TableCell>
                    <TableCell>{t('attendance.cols.rejected')}</TableCell>
                    <TableCell>{t('attendance.kpi.employees')}</TableCell>
                    <TableCell>{t('attendance.cols.by')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {imports.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <bdi>{i.fileName}</bdi>
                      </TableCell>
                      <TableCell>
                        <bdi>{t('attendance.period', { from: date(i.from), to: date(i.to) })}</bdi>
                      </TableCell>
                      <TableCell>{i.rows.toLocaleString('en-US')}</TableCell>
                      <TableCell sx={{ color: hr.success, fontWeight: 700 }}>{i.accepted.toLocaleString('en-US')}</TableCell>
                      <TableCell sx={{ color: i.rejected ? '#B91C1C' : undefined }}>{i.rejected}</TableCell>
                      <TableCell>{i.employees}</TableCell>
                      <TableCell>
                        {i.createdByName} · {date(i.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ))}
      </Box>
      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onDone={(message, range) => {
            setImporting(false);
            setNotice(message);
            if (range && range.slice(0, 7) !== period) setParams((p) => (p.set('period', range.slice(0, 7)), p), { replace: true });
            setVersion((v) => v + 1);
          }}
        />
      )}
      {asking && <OvertimeDialog onClose={() => setAsking(false)} onSent={(id) => navigate(`/hr/overtime/${id}`)} />}
      {closing && month && (
        <CloseDialog
          kind={closing}
          period={period}
          month={month}
          onClose={() => setClosing(null)}
          onDone={() => {
            setClosing(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
      {drawer && (
        <DaysDrawer
          period={period}
          employeeId={drawer.id}
          initialDate={drawer.date}
          canManage={editable}
          onClose={() => setOpen(null)}
          onChanged={() => setVersion((v) => v + 1)}
        />
      )}
    </HrScope>
  );
}

function Kpi({ accent, icon, label, value, unit, parts }: { accent: HrAccent; icon: ReactNode; label: string; value: number; unit: string; parts: [string, number][] }) {
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
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString('en-US')}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function Filter({ label, all, value, onChange, options }: { label: string; all: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <TextField select size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ width: { md: 210 } }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
      <MenuItem value="">{all}</MenuItem>
      {options.map(([v, l]) => (
        <MenuItem key={v} value={v}>
          {l}
        </MenuItem>
      ))}
    </TextField>
  );
}

/** Sending the month for closing (its figures frozen), or reopening a closed month with the reason. */
function CloseDialog({ kind, period, month, onClose, onDone }: { kind: 'submit' | 'reopen'; period: string; month: AttendanceMonth; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const monthName = useMonthName();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const k = month.kpis;
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (kind === 'submit') await attendanceApi.submitMonth(period);
      else await attendanceApi.reopenMonth(period, reason.trim());
      onDone();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t(kind === 'submit' ? 'attendance.close.submitTitle' : 'attendance.close.reopenTitle', { month: monthName(period) })}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5 }}>
          {kind === 'submit' ? (
            <>
              <Typography sx={{ fontSize: 13.5 }}>{t('attendance.close.submitHint')}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                {(
                  [
                    [t('attendance.kpi.employees'), k.employees],
                    [t('attendance.kpi.deduction'), k.deductionDays],
                    [t('attendance.kpi.late'), hm(k.lateMinutes)],
                    [t('attendance.kpi.overtime'), hm(k.overtimeMinutes)],
                  ] as const
                ).map(([l, v]) => (
                  <Box key={l} sx={{ bgcolor: hr.muted, borderRadius: '10px', p: 1.25 }}>
                    <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{l}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
                      <bdi>{v}</bdi>
                    </Typography>
                  </Box>
                ))}
              </Box>
              {k.openExceptions > 0 && <Alert severity="warning">{t('attendance.close.openExceptions', { count: k.openExceptions })}</Alert>}
              {k.overtimePending > 0 && <Alert severity="warning">{t('attendance.close.pendingOvertime', { count: k.overtimePending })}</Alert>}
            </>
          ) : (
            <>
              <Typography sx={{ fontSize: 13.5 }}>{t('attendance.close.reopenHint')}</Typography>
              <TextField size="small" required multiline minRows={2} label={t('attendance.close.reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 400 } }} />
            </>
          )}
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || (kind === 'reopen' && !reason.trim())} onClick={() => void run()}>
            {t(kind === 'submit' ? 'attendance.close.submit' : 'attendance.close.reopen')}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}
