import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SyncIcon from '@mui/icons-material/Sync';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  ListItemIcon,
  Menu,
  MenuItem,
  Pagination,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { staffNotes, staffPayrollApi, type StaffDeferred, type StaffLine, type StaffLineDetail, type StaffLinePage, type StaffLineQuery, type StaffNote, type StaffRun, type StaffRunItem } from '../../../api/staffPayroll';
import { useCrumb } from '../../../app/breadcrumbs';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { HrAvatar, HrCoverageCard, HrDrawer, HrEmptyState, HrKpiCard, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../../components/hr/Hr';
import { ApprovalBar, useRecordApproval } from '../../../components/workflow/RecordApproval';
import { useMonthName as usePeriodName } from '../../attendance/AttendanceMonthPage';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { money, RunStatusBadge } from '../payroll';

type TabKey = 'employees' | 'summary' | 'gosi' | 'deferred';

export const staffNoteLook: Record<StaffNote, { color: string; tint: string }> = {
  joined: { color: hr.primary, tint: '#EFF6FF' },
  left: { color: '#475569', tint: '#F1F5F9' },
  no_iban: { color: '#B45309', tint: '#FEF3C7' },
  no_attendance: { color: '#B91C1C', tint: '#FEE2E2' },
  salary_changed: { color: '#6D28D9', tint: '#EDE9FE' },
  deferred: { color: '#B45309', tint: '#FEF3C7' },
  above_cap: { color: '#0E7490', tint: '#CFFAFE' },
  no_gosi_rate: { color: '#B91C1C', tint: '#FEE2E2' },
  net_not_positive: { color: hr.danger, tint: '#FEE2E2' },
};

/**
 * A staff payroll run (docs/03-migration-plan/11, the payroll page's anatomy of 15 §6): the header with the attendance
 * month and the actions, the approval bar, five KPI cards from the run's own totals, then the employees' grid (paged,
 * filtered and sorted on the server), the summary by department, GOSI and what the month's cap deferred; an
 * employee's pay opens in a drawer, where an adjustment is added with its reason while the run is open.
 */
export function StaffRunPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { date } = useCommercialFormat();
  const periodName = usePeriodName();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as TabKey | null) ?? 'employees';
  const [run, setRun] = useState<StaffRun | null>(null);
  const [siblings, setSiblings] = useState<StaffRunItem[]>([]);
  const [deferred, setDeferred] = useState<StaffDeferred[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'submit' | 'delete' | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [scope, setScope] = useState<StaffLineQuery>({});
  const [version, setVersion] = useState(0);
  const approval = useRecordApproval(run?.approval?.instanceId);
  useCrumb(run ? `${periodName(run.period)} · ${run.runNo}` : undefined, `/payroll/staff/${id}`);

  const reload = useCallback(async () => {
    try {
      const loaded = await staffPayrollApi.get(id);
      setRun(loaded);
      setError(null);
      setDeferred(await staffPayrollApi.deferred(id));
      setSiblings(await staffPayrollApi.runs({ legalEntityId: loaded.legalEntityId }));
      setVersion((v) => v + 1);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = async (work: () => Promise<void>, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      if (done) setNotice(done);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  if (!run) {
    return (
      <HrScope>
        <ErrorMessage messageKey={error} />
        {!error && <LinearProgress />}
      </HrScope>
    );
  }

  const ordered = [...siblings].sort((a, b) => a.period.localeCompare(b.period));
  const at = ordered.findIndex((r) => r.id === run.id);
  const before = at > 0 ? ordered[at - 1] : null;
  const after = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null;
  const trend = (pick: (x: StaffRun['totals']) => number) => [...run.trend.map((p) => pick(p.totals)), pick(run.totals)];
  const comparison = run.previous ? periodName(run.previous.period) : null;
  const x = run.totals;

  return (
    <HrScope>
      <HrPageHeader
        icon={<RequestQuoteOutlinedIcon />}
        title={`${t('staffPayroll.runTitle')} · ${periodName(run.period)}`}
        status={<RunStatusBadge status={run.status} />}
        reference={run.runNo}
        subtitle={
          <>
            {run.legalEntityName} · <bdi>{t('staffPayroll.periodLine', { from: date(run.from), to: date(run.to) })}</bdi> · {t('staffPayroll.calculatedAt', { at: `${date(run.calculatedAt.slice(0, 10))} ${new Date(run.calculatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` })}
          </>
        }
        period={
          <Stack direction="row" sx={{ alignItems: 'center', border: `1px solid ${hr.border}`, borderRadius: '8px', bgcolor: '#fff', height: 36 }}>
            <IconButton size="small" aria-label={before ? periodName(before.period) : undefined} disabled={!before} onClick={() => before && navigate(`/payroll/staff/${before.id}`)}>
              <ChevronRightIcon fontSize="small" sx={{ transform: (theme) => (theme.direction === 'rtl' ? 'none' : 'scaleX(-1)') }} />
            </IconButton>
            <Typography sx={{ fontSize: 13, fontWeight: 700, px: 1, whiteSpace: 'nowrap' }}>{periodName(run.period)}</Typography>
            <IconButton size="small" aria-label={after ? periodName(after.period) : undefined} disabled={!after} onClick={() => after && navigate(`/payroll/staff/${after.id}`)}>
              <ChevronLeftIcon fontSize="small" sx={{ transform: (theme) => (theme.direction === 'rtl' ? 'none' : 'scaleX(-1)') }} />
            </IconButton>
          </Stack>
        }
        actions={
          <>
            {run.canEdit && (
              <Button variant="outlined" startIcon={<SyncIcon />} disabled={busy} onClick={() => void act(async () => { await staffPayrollApi.recalculate(run.id); await reload(); }, t('staffPayroll.recalculated'))}>
                {t('staffPayroll.recalculate')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} component="a" href={staffPayrollApi.excelUrl(run.id, scope)} download>
              {t('staffPayroll.excel')}
            </Button>
            {run.canEdit && (
              <>
                <Button variant="outlined" endIcon={<ArrowDropDownIcon />} onClick={(e) => setMoreAnchor(e.currentTarget)}>
                  {t('staffPayroll.more')}
                </Button>
                <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy || x.employees === 0} onClick={() => setConfirm('submit')}>
                  {t('staffPayroll.submit')}
                </Button>
                <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
                  <MenuItem onClick={() => { setMoreAnchor(null); setConfirm('delete'); }} sx={{ color: hr.danger }}>
                    <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: hr.danger }} /></ListItemIcon>
                    {t('staffPayroll.delete')}
                  </MenuItem>
                </Menu>
              </>
            )}
          </>
        }
      />
      <ErrorMessage messageKey={error} />
      {notice && (
        <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {run.lastComment && run.status === 'Returned' && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {run.lastComment}
        </Alert>
      )}
      {run.approval && <ApprovalBar status={run.approval} detail={approval.detail} onChanged={() => { void reload(); void approval.reload(); }} />}

      <Box sx={{ display: 'grid', gap: 1.5, mb: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))' }}>
        <HrCoverageCard
          label={t('staffPayroll.kpi.employees')}
          value={x.employees}
          unit={t('staffPayroll.kpi.employeesUnit')}
          of={`${t('staffPayroll.kpi.of', { count: x.employees + x.noSalary })} · ${t('staffPayroll.kpi.noIban')} ${x.withoutIban} · ${t('staffPayroll.kpi.joiners')} ${x.joiners}`}
          parts={[
            { label: t('staffPayroll.kpi.inRun'), value: x.employees },
            { label: t('staffPayroll.kpi.noSalary'), value: x.noSalary },
          ]}
        />
        <HrKpiCard label={t('staffPayroll.kpi.basic')} value={x.basic} unit={t('hr.sar')} icon={<AttachMoneyIcon />} accent="blue" trend={trend((v) => v.basic)} previous={run.previous?.totals.basic ?? null} comparisonLabel={comparison} />
        <HrKpiCard label={t('staffPayroll.kpi.allowances')} value={x.allowances} unit={t('hr.sar')} icon={<AddCircleOutlineIcon />} accent="green" trend={trend((v) => v.allowances)} previous={run.previous?.totals.allowances ?? null} comparisonLabel={comparison} />
        <HrKpiCard label={t('staffPayroll.kpi.deductions')} value={x.deductions} unit={t('hr.sar')} icon={<RemoveCircleOutlineIcon />} accent="amber" trend={trend((v) => v.deductions)} previous={run.previous?.totals.deductions ?? null} comparisonLabel={comparison} />
        <HrKpiCard label={t('staffPayroll.kpi.net')} value={x.net} unit={t('hr.sar')} icon={<CheckCircleOutlineIcon />} accent="rose" trend={trend((v) => v.net)} previous={run.previous?.totals.net ?? null} comparisonLabel={comparison} />
      </Box>

      <Box sx={{ ...(hrCard as object), px: 2, pb: 2 }}>
        <Tabs value={tab} variant="scrollable" onChange={(_, v: TabKey) => setParams((p) => { p.set('tab', v); return p; }, { replace: true })} sx={{ borderBottom: `1px solid ${hr.border}`, mb: 1.5 }}>
          <Tab value="employees" label={t('staffPayroll.tabs.employees')} />
          <Tab value="summary" label={t('staffPayroll.tabs.summary')} />
          <Tab value="gosi" label={t('staffPayroll.tabs.gosi')} />
          <Tab value="deferred" label={t('staffPayroll.tabs.deferred', { count: deferred?.length ?? 0 })} />
        </Tabs>
        {tab === 'employees' && <EmployeesTab run={run} version={version} onScope={setScope} onChanged={reload} />}
        {tab === 'summary' && <SummaryTab run={run} />}
        {tab === 'gosi' && <GosiTab run={run} />}
        {tab === 'deferred' && <DeferredTab list={deferred} />}
      </Box>

      <ConfirmDialog
        open={confirm === 'submit'}
        title={t('staffPayroll.submit')}
        text={t('staffPayroll.submitConfirm', { no: run.runNo, count: x.employees, net: money(x.net) })}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void act(async () => { await staffPayrollApi.submit(run.id); setConfirm(null); await reload(); })}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title={t('staffPayroll.delete')}
        text={t('staffPayroll.deleteConfirm', { no: run.runNo })}
        busy={busy}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => void act(async () => { await staffPayrollApi.remove(run.id); navigate('/payroll/staff'); })}
      />
    </HrScope>
  );
}

function ConfirmDialog({ open, title, text, busy, danger, onCancel, onConfirm }: { open: boolean; title: string; text: string; busy: boolean; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: `${hr.radius}px` } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14 }}>{text}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={onConfirm} disabled={busy}>
          {title}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** The run's employees: search, department and note filters, server pages, the grouped head and the scope's total. */
function EmployeesTab({ run, version, onScope, onChanged }: { run: StaffRun; version: number; onScope: (q: StaffLineQuery) => void; onChanged: () => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [department, setDepartment] = useState('');
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: '', desc: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dense, setDense] = useState(true);
  const [data, setData] = useState<StaffLinePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<StaffLine | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const q = useMemo<StaffLineQuery>(() => ({ search: query, note: note || undefined, department: department || undefined, sort: sort.key || undefined, desc: sort.desc, page, pageSize }), [query, note, department, sort, page, pageSize]);

  useEffect(() => {
    onScope({ ...q, page: undefined, pageSize: undefined });
    const ticket = ++latest.current;
    staffPayrollApi
      .lines(run.id, q)
      .then((d) => {
        if (ticket === latest.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((failure) => ticket === latest.current && setError(errorKey(failure)));
  }, [run.id, q, version, onScope]);

  useEffect(() => setPage(1), [query, note, department, pageSize]);

  const filtered = Boolean(query.trim() || note || department);
  const sortBy = (key: string) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' && key !== 'department' }));
  const head = (key: string, label: string, align: 'left' | 'right' = 'left', rowSpan = 2) => (
    <TableCell align={align} rowSpan={rowSpan} sortDirection={sort.key === key ? (sort.desc ? 'desc' : 'asc') : false}>
      <ButtonBase onClick={() => sortBy(key)} sx={{ font: 'inherit', fontWeight: 600, color: 'inherit', gap: 0.25 }}>
        {label}
        {sort.key === key && <span aria-hidden>{sort.desc ? '↓' : '↑'}</span>}
      </ButtonBase>
    </TableCell>
  );
  const rowHeight = dense ? 40 : 50;
  const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  const num = (v: number, sx?: object) => (
    <TableCell align="right" className="num" sx={sx}>
      {money(v)}
    </TableCell>
  );

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, mb: 1.5, alignItems: { md: 'center' } }}>
        <TextField
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('staffPayroll.filters.search')}
          sx={{ width: { md: 280 }, flex: { md: '0 0 280px' } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': t('staffPayroll.filters.search') } }}
        />
        <TextField select size="small" label={t('staffPayroll.cols.department')} value={department} onChange={(e) => setDepartment(e.target.value)} sx={{ minWidth: 200 }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">{t('staffPayroll.filters.allDepartments')}</MenuItem>
          {run.departments.filter((d) => d.departmentId).map((d) => (
            <MenuItem key={d.departmentId} value={d.departmentId!}>
              {(ar ? d.nameAr : d.nameEn) ?? '—'} ({d.employees})
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label={t('staffPayroll.filters.notes')} value={note} onChange={(e) => setNote(e.target.value)} sx={{ minWidth: 190 }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">{t('staffPayroll.filters.allNotes')}</MenuItem>
          <MenuItem value="any">{t('staffPayroll.filters.anyNote')}</MenuItem>
          {staffNotes.filter((n) => run.notes[n]).map((n) => (
            <MenuItem key={n} value={n}>
              {t(`staffPayroll.notes.${n}`)} ({run.notes[n]})
            </MenuItem>
          ))}
        </TextField>
        {filtered && (
          <Button size="small" startIcon={<FilterAltOffOutlinedIcon />} onClick={() => { setSearch(''); setQuery(''); setNote(''); setDepartment(''); }}>
            {t('staffPayroll.clearFilters')}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup size="small" exclusive value={dense ? 'compact' : 'comfortable'} onChange={(_, v: string | null) => v && setDense(v === 'compact')} aria-label={t('staffPayroll.filters.density')}>
          <ToggleButton value="compact">{t('staffPayroll.filters.compact')}</ToggleButton>
          <ToggleButton value="comfortable">{t('staffPayroll.filters.comfortable')}</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <ErrorMessage messageKey={error} />
      {!data ? (
        <Stack sx={{ gap: 1 }}>
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rounded" height={rowHeight} />)}
        </Stack>
      ) : data.total === 0 ? (
        <HrEmptyState icon={<PersonSearchOutlinedIcon />} title={filtered ? t('staffPayroll.noResults') : t('staffPayroll.empty')} />
      ) : (
        <>
          <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 640 }}>
            <Table
              stickyHeader
              size="small"
              sx={{
                '& th': { bgcolor: hr.muted, color: '#475569', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', py: 0.75 },
                '& thead tr:nth-of-type(2) th': { top: 33 },
                '& td': { height: rowHeight, whiteSpace: 'nowrap', fontSize: 12.5, borderBottomColor: '#EEF2F7' },
                '& .num': { fontVariantNumeric: 'tabular-nums' },
                '& .pin': { position: 'sticky', insetInlineStart: 0, zIndex: 2, bgcolor: '#fff', boxShadow: `inset -1px 0 0 ${hr.border}` },
                '& th.pin': { zIndex: 4, bgcolor: hr.muted },
                '& tfoot td': { position: 'sticky', bottom: 0, bgcolor: '#F8FAFC', fontWeight: 700, borderTop: `1px solid ${hr.border}`, zIndex: 1 },
                '& tbody tr': { cursor: 'pointer' },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell rowSpan={2} className="pin">
                    <ButtonBase onClick={() => sortBy('name')} sx={{ font: 'inherit', fontWeight: 600, color: 'inherit' }}>
                      {t('staffPayroll.cols.employee')} {sort.key === 'name' && (sort.desc ? '↓' : '↑')}
                    </ButtonBase>
                  </TableCell>
                  <TableCell rowSpan={2}>{t('staffPayroll.cols.number')}</TableCell>
                  {head('department', t('staffPayroll.cols.department'))}
                  {head('days', t('staffPayroll.cols.days'), 'right')}
                  {head('basic', t('staffPayroll.cols.basic'), 'right')}
                  <TableCell colSpan={4} align="center" sx={{ borderBottom: '1px solid #DBE3EE' }}>
                    {t('staffPayroll.cols.allowancesGroup')}
                  </TableCell>
                  <TableCell colSpan={6} align="center" sx={{ borderBottom: '1px solid #DBE3EE' }}>
                    {t('staffPayroll.cols.deductionsGroup')}
                  </TableCell>
                  {head('net', t('staffPayroll.cols.net'), 'right')}
                </TableRow>
                <TableRow>
                  <TableCell align="right">{t('staffPayroll.cols.housing')}</TableCell>
                  <TableCell align="right">{t('staffPayroll.cols.other')}</TableCell>
                  <TableCell align="right">{t('staffPayroll.cols.overtime')}</TableCell>
                  {head('allowances', t('staffPayroll.cols.total'), 'right', 1)}
                  <TableCell align="right">{t('staffPayroll.cols.absence')}</TableCell>
                  <TableCell align="right">{t('staffPayroll.cols.penalties')}</TableCell>
                  <TableCell align="right">{t('staffPayroll.cols.advances')}</TableCell>
                  <TableCell align="right">{t('staffPayroll.cols.otherDeductions')}</TableCell>
                  <TableCell align="right">{t('staffPayroll.cols.gosi')}</TableCell>
                  {head('deductions', t('staffPayroll.cols.total'), 'right', 1)}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((l) => (
                  <TableRow key={l.id} hover onClick={() => setOpen(l)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(l)}>
                    <TableCell className="pin">
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                        <HrAvatar name={l.name} size={28} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 12.5, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.name}>
                            {l.name}
                          </Typography>
                          <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
                            <Typography sx={{ fontSize: 11, color: hr.textMuted }}>{(ar ? l.jobTitleAr : l.jobTitleEn) ?? ''}</Typography>
                            {l.notes.slice(0, 1).map((n) => (
                              <HrStatusBadge key={n} label={t(`staffPayroll.notes.${n}`)} {...staffNoteLook[n]} />
                            ))}
                            {l.notes.length > 1 && (
                              <Tooltip title={l.notes.slice(1).map((n) => t(`staffPayroll.notes.${n}`)).join('، ')}>
                                <Box component="span" sx={{ fontSize: 11, color: hr.textMuted }}>
                                  +{l.notes.length - 1}
                                </Box>
                              </Tooltip>
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell className="num">
                      <bdi>{l.employeeNo}</bdi>
                    </TableCell>
                    <TableCell>{(ar ? l.departmentAr : l.departmentEn) ?? '—'}</TableCell>
                    {num(l.paidDays)}
                    {num(l.basic)}
                    {num(l.housing)}
                    {num(l.otherAllowances + l.additions)}
                    {num(l.overtime)}
                    {num(l.allowances, { fontWeight: 600 })}
                    {num(l.absence)}
                    {num(l.penalties)}
                    {num(l.advances)}
                    {num(l.otherDeductions)}
                    {num(l.gosiEmployee)}
                    {num(l.deductions, { fontWeight: 600, color: l.deductions ? '#B45309' : undefined })}
                    {num(l.net, { fontWeight: 700, color: l.net <= 0 ? hr.danger : hr.text })}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pin">{filtered ? t('staffPayroll.totalScope', { count: data.sums.employees }) : t('staffPayroll.totalAll', { count: data.sums.employees })}</TableCell>
                  <TableCell colSpan={3} />
                  {num(data.sums.basic, { color: hr.primary })}
                  {num(data.sums.housing)}
                  {num(data.sums.otherAllowances)}
                  {num(data.sums.overtime)}
                  {num(data.sums.allowances)}
                  {num(data.sums.absence)}
                  {num(data.sums.penalties)}
                  {num(data.sums.advances)}
                  {num(data.sums.otherDeductions)}
                  {num(data.sums.gosiEmployee)}
                  {num(data.sums.deductions, { color: '#B45309' })}
                  {num(data.sums.net, { color: hr.success })}
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: 'center', gap: 1.5, mt: 1.5, '& .MuiPagination-ul': { flexWrap: 'nowrap' } }}>
            <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>{t('staffPayroll.shown', { from, to, total: data.total })}</Typography>
            <Box sx={{ flex: 1 }} />
            <Pagination count={Math.max(1, Math.ceil(data.total / data.pageSize))} page={data.page} onChange={(_, p) => setPage(p)} shape="rounded" color="primary" size="small" />
            <TextField select size="small" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} sx={{ width: 150, flex: '0 0 auto' }} slotProps={{ htmlInput: { 'aria-label': t('staffPayroll.perPage', { count: pageSize }) } }}>
              {[10, 25, 50, 100].map((n) => (
                <MenuItem key={n} value={n}>
                  {t('staffPayroll.perPage', { count: n })}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </>
      )}
      {open && (
        <LineDrawer
          run={run}
          line={open}
          onClose={() => setOpen(null)}
          onChanged={async () => {
            await onChanged();
          }}
        />
      )}
    </Box>
  );
}

/** One employee's pay: each amount with how it is made and where it comes from, GOSI, the cap, the bank, and the adjustments. */
function LineDrawer({ run, line, onClose, onChanged }: { run: StaffRun; line: StaffLine; onClose: () => void; onChanged: () => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [detail, setDetail] = useState<StaffLineDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<'Addition' | 'Deduction' | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    staffPayrollApi
      .line(run.id, line.id)
      .then((d) => (setDetail(d), setError(null)))
      .catch((failure) => setError(errorKey(failure)));
  }, [run.id, line.id]);
  useEffect(load, [load]);

  const row = (label: string, value: number, hint?: ReactNode, color?: string) => (
    <Stack direction="row" key={label + (typeof hint === 'string' ? hint : '')} sx={{ justifyContent: 'space-between', gap: 1, py: 0.9, borderBottom: '1px solid #EEF2F7', fontSize: 13 }}>
      <span>
        {label}
        {hint && <Box component="span" sx={{ color: hr.textMuted, fontSize: 12, marginInlineStart: 0.75 }}>{hint}</Box>}
      </span>
      <Box component="b" sx={{ fontVariantNumeric: 'tabular-nums', color }}>{money(value)}</Box>
    </Stack>
  );
  const save = async () => {
    if (!adding) return;
    setBusy(true);
    setError(null);
    try {
      await staffPayrollApi.addAdjustment(run.id, { employeeId: line.employeeId, kind: adding, amount: Number(amount), reason: reason.trim() });
      setAdding(null);
      setAmount('');
      setReason('');
      await onChanged();
      onClose();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (adjustmentId: string) => {
    setBusy(true);
    try {
      await staffPayrollApi.removeAdjustment(run.id, adjustmentId);
      await onChanged();
      onClose();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };
  const d = detail;
  const l = d?.line ?? line;
  const deductionItems = d?.items.filter((i) => i.kind !== 'Addition') ?? [];

  return (
    <HrDrawer
      open
      onClose={onClose}
      avatar={<HrAvatar name={line.name} size={46} />}
      title={line.name}
      subtitle={
        <>
          <bdi>{line.employeeNo}</bdi> · {(ar ? line.jobTitleAr : line.jobTitleEn) ?? '—'} · {(ar ? line.departmentAr : line.departmentEn) ?? '—'}
        </>
      }
    >
      <ErrorMessage messageKey={error} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        {[
          [t('staffPayroll.drawer.days'), `${money(l.paidDays)} / 30`, hr.text],
          [t('staffPayroll.drawer.monthly'), money(l.monthlySalary), hr.text],
          [t('staffPayroll.drawer.net'), `${money(l.net)} ${t('hr.sar')}`, hr.success],
        ].map(([label, value, color]) => (
          <Box key={label} sx={{ ...(hrCard as object), p: 1.25 }}>
            <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{label}</Typography>
            <Typography sx={{ fontSize: 17, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
              <bdi>{value}</bdi>
            </Typography>
          </Box>
        ))}
      </Box>
      {l.notes.length > 0 && (
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
          {l.notes.map((n) => (
            <HrStatusBadge key={n} label={t(`staffPayroll.notes.${n}`)} {...staffNoteLook[n]} />
          ))}
        </Stack>
      )}
      {!d ? (
        <Skeleton variant="rounded" height={260} />
      ) : (
        <>
          <Box>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('staffPayroll.drawer.earnings')}</Typography>
            {row(t('staffPayroll.drawer.basic'), l.basic, t('staffPayroll.drawer.share', { monthly: money(d.monthlyBasic), days: money(l.serviceDays) }))}
            {l.housing !== 0 && row(t('staffPayroll.drawer.housing'), l.housing)}
            {l.otherAllowances !== 0 && row(t('staffPayroll.drawer.other'), l.otherAllowances)}
            {l.overtime !== 0 && row(t('staffPayroll.drawer.overtime', { hours: money(d.overtimeHours) }), l.overtime, t('staffPayroll.drawer.overtimeHint'))}
            {d.items.filter((i) => i.kind === 'Addition').map((i) => row(t('staffPayroll.drawer.addition'), i.deducted, i.description))}
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('staffPayroll.drawer.deductions')}</Typography>
            {d.absenceOnly !== 0 && row(t('staffPayroll.drawer.absence', { days: money(d.unpaidDays) }), d.absenceOnly, t('staffPayroll.drawer.dayWage', { wage: money(l.monthlySalary / 30) }), '#B45309')}
            {d.late !== 0 && row(t('staffPayroll.drawer.late', { minutes: d.lateMinutes }), d.late, undefined, '#B45309')}
            {d.sickPart !== 0 && row(t('staffPayroll.drawer.sick', { days: money(d.sickPartDays) }), d.sickPart, undefined, '#B45309')}
            {deductionItems.filter((i) => i.kind !== 'Suspension').map((i) =>
              row(t(`staffPayroll.items.${i.kind}`), i.deducted, <><bdi>{i.reference === 'adjustment' ? i.description : i.reference}</bdi>{i.deferred && ` · ${t('staffPayroll.drawer.deferredPart', { amount: money(i.due - i.deducted) })}`}</>, '#B45309'),
            )}
            {l.gosiEmployee !== 0 && row(t('staffPayroll.drawer.gosi'), l.gosiEmployee, t('staffPayroll.drawer.gosiHint', { base: money(d.gosiBase), employer: money(d.gosiEmployer) }), '#B45309')}
            {l.deductions === 0 && <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('staffPayroll.drawer.none')}</Typography>}
            <Box sx={{ mt: 1, bgcolor: '#FFFBEB', borderRadius: '8px', p: 1, fontSize: 12.5 }}>
              {t('staffPayroll.drawer.cap', { cap: money(d.capLimit), used: money(l.penalties + l.advances + deductionItems.filter((i) => i.kind === 'Other').reduce((s, i) => s + i.deducted, 0)) })}
              {l.deferred > 0 && ` ${t('staffPayroll.drawer.deferred', { amount: money(l.deferred) })}`}
            </Box>
          </Box>
          <Stack direction="row" sx={{ justifyContent: 'space-between', bgcolor: '#ECFDF5', borderRadius: '10px', p: 1.5, fontWeight: 700 }}>
            <span>{t('staffPayroll.drawer.net')}</span>
            <Box component="span" sx={{ color: hr.success, fontVariantNumeric: 'tabular-nums' }}>
              {money(l.net)} {t('hr.sar')}
            </Box>
          </Stack>
          <Box>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('staffPayroll.drawer.payment')}</Typography>
            <Typography sx={{ fontSize: 13, color: d.iban ? hr.text : '#B45309' }}>
              {d.iban ? (
                <>
                  {t('staffPayroll.drawer.transfer')} · {d.bankName ?? '—'} · <bdi dir="ltr">{d.iban.replace(/(.{4})/g, '$1 ').trim()}</bdi>
                </>
              ) : (
                t('staffPayroll.drawer.noIban')
              )}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('staffPayroll.drawer.adjustments')}</Typography>
            {d.adjustments.length === 0 && <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('staffPayroll.drawer.noAdjustments')}</Typography>}
            {d.adjustments.map((a) => (
              <Stack key={a.id} direction="row" sx={{ alignItems: 'center', gap: 1, py: 0.5, borderBottom: '1px solid #EEF2F7', fontSize: 13 }}>
                <Box sx={{ flex: 1 }}>
                  {t(`staffPayroll.adjustment.${a.kind}`)} · {a.reason}
                  <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{a.createdByName}</Typography>
                </Box>
                <b style={{ fontVariantNumeric: 'tabular-nums', color: a.kind === 'Deduction' ? '#B45309' : hr.success }}>{a.kind === 'Deduction' ? '−' : '+'}{money(a.amount)}</b>
                {run.canEdit && (
                  <IconButton size="small" aria-label={t('staffPayroll.adjustment.remove')} disabled={busy} onClick={() => void remove(a.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            ))}
            {run.canEdit &&
              (adding ? (
                <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
                  <TextField size="small" type="number" label={t(`staffPayroll.adjustment.${adding}`)} value={amount} onChange={(e) => setAmount(e.target.value)} slotProps={{ htmlInput: { min: 1, step: '0.01', dir: 'ltr' }, input: { endAdornment: <InputAdornment position="end">{t('hr.sar')}</InputAdornment> } }} />
                  <TextField size="small" required label={t('staffPayroll.adjustment.reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
                  <Stack direction="row" sx={{ gap: 1 }}>
                    <Button variant="contained" size="small" disabled={busy || !(Number(amount) > 0) || !reason.trim()} onClick={() => void save()}>
                      {t('common.save')}
                    </Button>
                    <Button size="small" disabled={busy} onClick={() => setAdding(null)}>
                      {t('common.cancel')}
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Stack direction="row" sx={{ gap: 1, mt: 1 }}>
                  <Button size="small" variant="outlined" onClick={() => setAdding('Addition')}>
                    {t('staffPayroll.adjustment.addAddition')}
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => setAdding('Deduction')}>
                    {t('staffPayroll.adjustment.addDeduction')}
                  </Button>
                </Stack>
              ))}
            <Typography sx={{ fontSize: 11.5, color: hr.textMuted, mt: 0.75 }}>{t('staffPayroll.adjustment.hint')}</Typography>
          </Box>
        </>
      )}
    </HrDrawer>
  );
}

/** The run's elements and its net by department. */
function SummaryTab({ run }: { run: StaffRun }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const x = run.totals;
  const items: [string, number][] = [
    [t('staffPayroll.summary.basic'), x.basic],
    [t('staffPayroll.summary.housing'), x.housing],
    [t('staffPayroll.summary.other'), x.otherAllowances],
    [t('staffPayroll.summary.overtime'), x.overtime],
    [t('staffPayroll.summary.additions'), x.additions],
  ];
  const cuts: [string, number][] = [
    [t('staffPayroll.summary.absence'), x.absence],
    [t('staffPayroll.summary.penalties'), x.penalties],
    [t('staffPayroll.summary.advances'), x.advances],
    [t('staffPayroll.summary.otherDeductions'), x.otherDeductions],
    [t('staffPayroll.summary.gosi'), x.gosiEmployee],
  ];
  const gross = items.reduce((s, [, v]) => s + v, 0) || 1;
  const maxDept = Math.max(...run.departments.map((d) => d.net), 1);
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
      <Box>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('staffPayroll.summary.elements')}</Typography>
        {items.map(([label, value]) => (
          <Box key={label} sx={{ mb: 1.1 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', fontSize: 13 }}>
              <span>{label}</span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{money(value)}</b>
            </Stack>
            <Box sx={{ height: 6, borderRadius: 99, bgcolor: '#EEF2F7', mt: 0.5, overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${Math.max(0, (value / gross) * 100)}%`, bgcolor: hr.primary }} />
            </Box>
          </Box>
        ))}
        {cuts.map(([label, value]) => (
          <Stack key={label} direction="row" sx={{ justifyContent: 'space-between', fontSize: 13, py: 0.5, borderTop: '1px solid #EEF2F7' }}>
            <span>{label}</span>
            <b style={{ color: '#B45309', fontVariantNumeric: 'tabular-nums' }}>−{money(value)}</b>
          </Stack>
        ))}
        <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.75, fontSize: 15, fontWeight: 700, borderTop: `1px solid ${hr.border}`, pt: 1 }}>
          <span>{t('staffPayroll.summary.net')}</span>
          <span style={{ color: hr.success, fontVariantNumeric: 'tabular-nums' }}>{money(x.net)}</span>
        </Stack>
        {x.deferred > 0 && <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: 0.5 }}>{t('staffPayroll.summary.deferred', { amount: money(x.deferred) })}</Typography>}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('staffPayroll.summary.byDepartment')}</Typography>
        {run.departments.map((d) => (
          <Box key={d.departmentId ?? 'none'} sx={{ mb: 1.1 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', fontSize: 13, gap: 1 }}>
              <span>
                {(ar ? d.nameAr : d.nameEn) ?? t('staffPayroll.summary.noDepartment')} <Box component="span" sx={{ color: hr.textMuted }}>· {t('staffPayroll.summary.employees', { count: d.employees })}</Box>
              </span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{money(d.net)}</b>
            </Stack>
            <Box sx={{ height: 6, borderRadius: 99, bgcolor: '#EEF2F7', mt: 0.5, overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${(d.net / maxDept) * 100}%`, bgcolor: hr.primary }} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** GOSI by category: the wage it is on, the employees' share (deducted) and the company's (a cost outside the net). */
function GosiTab({ run }: { run: StaffRun }) {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography sx={{ fontSize: 13, color: hr.textMuted, mb: 1.25 }}>{t('staffPayroll.gosi.hint')}</Typography>
      <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
        <Table size="small" sx={{ '& th': { bgcolor: hr.muted, color: '#475569', fontWeight: 600 }, '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }}>
          <TableHead>
            <TableRow>
              <TableCell>{t('staffPayroll.gosi.category')}</TableCell>
              <TableCell align="right">{t('staffPayroll.cols.employees')}</TableCell>
              <TableCell align="right">{t('staffPayroll.gosi.base')}</TableCell>
              <TableCell align="right">{t('staffPayroll.gosi.employee')}</TableCell>
              <TableCell align="right">{t('staffPayroll.gosi.employer')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {run.gosi.map((g) => (
              <TableRow key={g.category}>
                <TableCell sx={{ fontWeight: 600 }}>{t(`staffPayroll.gosiCategory.${g.category}`)}</TableCell>
                <TableCell align="right">{g.employees}</TableCell>
                <TableCell align="right">{money(g.base)}</TableCell>
                <TableCell align="right">{money(g.employee)}</TableCell>
                <TableCell align="right">{money(g.employer)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow sx={{ '& td': { fontWeight: 700, color: hr.text } }}>
              <TableCell>{t('staffPayroll.gosi.total')}</TableCell>
              <TableCell align="right">{run.gosi.reduce((s, g) => s + g.employees, 0)}</TableCell>
              <TableCell align="right">{money(run.gosi.reduce((s, g) => s + g.base, 0))}</TableCell>
              <TableCell align="right">{money(run.totals.gosiEmployee)}</TableCell>
              <TableCell align="right">{money(run.totals.gosiEmployer)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </Box>
  );
}

/** What the month's cap left for the next payroll month. */
function DeferredTab({ list }: { list: StaffDeferred[] | null }) {
  const { t } = useTranslation();
  if (!list) return <LinearProgress />;
  if (list.length === 0) return <HrEmptyState icon={<CheckCircleOutlineIcon />} title={t('staffPayroll.deferredEmpty')} />;
  return (
    <Box>
      <Typography sx={{ fontSize: 13, color: hr.textMuted, mb: 1.25 }}>{t('staffPayroll.deferredHint')}</Typography>
      <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 560 }}>
        <Table stickyHeader size="small" sx={{ '& th': { bgcolor: hr.muted, color: '#475569', fontWeight: 600 }, '& td': { height: 42, fontVariantNumeric: 'tabular-nums' } }}>
          <TableHead>
            <TableRow>
              <TableCell>{t('staffPayroll.cols.employee')}</TableCell>
              <TableCell>{t('staffPayroll.deferredCols.kind')}</TableCell>
              <TableCell>{t('staffPayroll.deferredCols.reference')}</TableCell>
              <TableCell align="right">{t('staffPayroll.deferredCols.due')}</TableCell>
              <TableCell align="right">{t('staffPayroll.deferredCols.deducted')}</TableCell>
              <TableCell align="right">{t('staffPayroll.deferredCols.deferred')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((d) => (
              <TableRow key={`${d.lineId}-${d.reference}`} hover>
                <TableCell>
                  <b>{d.name}</b> · <bdi>{d.employeeNo}</bdi>
                </TableCell>
                <TableCell>{t(`staffPayroll.items.${d.kind}`)}</TableCell>
                <TableCell>
                  <bdi>{d.reference}</bdi>
                </TableCell>
                <TableCell align="right">{money(d.due)}</TableCell>
                <TableCell align="right">{money(d.deducted)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#B45309' }}>
                  {money(d.deferred)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
