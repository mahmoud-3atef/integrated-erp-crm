import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
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
  Link,
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
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { payrollApi, payrollNotes, type LineQuery, type PayrollExclusion, type PayrollLine, type PayrollLineDetail, type PayrollLinePage, type PayrollRun, type PayrollRunItem } from '../../api/payroll';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrCoverageCard, HrDrawer, HrEmptyState, HrKpiCard, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { exclusionLook, money, noteLook, RunStatusBadge, useMonthName } from './payroll';
import { SponsorsDialog } from './RunDialogs';

type TabKey = 'workers' | 'summary' | 'exclusions';

/**
 * A payroll run (docs/02-target-architecture/15 §6): the header with the period and the actions, the approval bar,
 * five KPI cards from the run's own totals, then the workers' grid (paged, filtered and sorted on the server), the
 * financial summary and the exclusions; a worker's pay opens in a drawer.
 */
export function PayrollRunPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const monthName = useMonthName();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as TabKey | null) ?? 'workers';
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [siblings, setSiblings] = useState<PayrollRunItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'submit' | 'delete' | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [sponsors, setSponsors] = useState(false);
  const [exclusions, setExclusions] = useState<PayrollExclusion[] | null>(null);
  const [scope, setScope] = useState<LineQuery>({});
  const [version, setVersion] = useState(0);
  const approval = useRecordApproval(run?.approval?.instanceId);
  useCrumb(run ? `${monthName(run.to)} · ${run.runNo}` : undefined, `/payroll/runs/${id}`);

  const reload = useCallback(async () => {
    try {
      const loaded = await payrollApi.get(id);
      setRun(loaded);
      setError(null);
      setExclusions(await payrollApi.exclusions(id));
      setSiblings(await payrollApi.runs(loaded.legalEntityId));
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

  // The runs of the registration in order: the period selector moves to the run before or after.
  const ordered = [...siblings].sort((a, b) => a.from.localeCompare(b.from));
  const at = ordered.findIndex((r) => r.id === run.id);
  const before = at > 0 ? ordered[at - 1] : null;
  const after = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null;
  const trend = (pick: (x: PayrollRun['totals']) => number) => [...run.trend.map((p) => pick(p.totals)), pick(run.totals)];
  const comparison = run.previous ? monthName(run.previous.to) : null;
  const canManage = run.canEdit;

  return (
    <HrScope>
      <HrPageHeader
        icon={<RequestQuoteOutlinedIcon />}
        title={`${t('payroll.runTitle')} · ${monthName(run.to)}`}
        status={<RunStatusBadge status={run.status} />}
        reference={run.runNo}
        subtitle={
          <>
            {t('payroll.group')} · {run.legalEntityName} · <bdi>{t('payroll.period', { from: date(run.from), to: date(run.to) })}</bdi> · {t('payroll.calculatedAt', { at: `${date(run.calculatedAt.slice(0, 10))} ${new Date(run.calculatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` })}
          </>
        }
        period={
          <Stack direction="row" sx={{ alignItems: 'center', border: `1px solid ${hr.border}`, borderRadius: '8px', bgcolor: '#fff', height: 36 }}>
            <IconButton size="small" aria-label={before ? monthName(before.to) : undefined} disabled={!before} onClick={() => before && navigate(`/payroll/runs/${before.id}`)}>
              <ChevronRightIcon fontSize="small" sx={{ transform: (theme) => (theme.direction === 'rtl' ? 'none' : 'scaleX(-1)') }} />
            </IconButton>
            <Typography sx={{ fontSize: 13, fontWeight: 700, px: 1, whiteSpace: 'nowrap' }}>{monthName(run.to)}</Typography>
            <IconButton size="small" aria-label={after ? monthName(after.to) : undefined} disabled={!after} onClick={() => after && navigate(`/payroll/runs/${after.id}`)}>
              <ChevronLeftIcon fontSize="small" sx={{ transform: (theme) => (theme.direction === 'rtl' ? 'none' : 'scaleX(-1)') }} />
            </IconButton>
          </Stack>
        }
        actions={
          <>
            {canManage && (
              <Button variant="outlined" startIcon={<SyncIcon />} disabled={busy} onClick={() => void act(async () => { await payrollApi.recalculate(run.id); await reload(); }, t('payroll.recalculated'))}>
                {t('payroll.recalculate')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} component="a" href={payrollApi.excelUrl(run.id, scope)} download>
              {t('payroll.excel')}
            </Button>
            <Button variant="outlined" endIcon={<ArrowDropDownIcon />} onClick={(e) => setMoreAnchor(e.currentTarget)}>
              {t('payroll.more')}
            </Button>
            {canManage && (
              <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy || run.totals.workers === 0} onClick={() => setConfirm('submit')}>
                {t('payroll.submit')}
              </Button>
            )}
            <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
              {can('payroll.settings.manage', true) && (
                <MenuItem onClick={() => { setMoreAnchor(null); setSponsors(true); }}>
                  <ListItemIcon><LinkOutlinedIcon fontSize="small" /></ListItemIcon>
                  {t('payroll.sponsors')}
                </MenuItem>
              )}
              {run.canDelete && (
                <MenuItem onClick={() => { setMoreAnchor(null); setConfirm('delete'); }} sx={{ color: hr.danger }}>
                  <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: hr.danger }} /></ListItemIcon>
                  {t('payroll.delete')}
                </MenuItem>
              )}
            </Menu>
          </>
        }
      />
      <ErrorMessage messageKey={error} />
      {notice && (
        <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {run.approval && (
        <ApprovalBar
          status={run.approval}
          detail={approval.detail}
          onChanged={() => {
            void reload();
            void approval.reload();
          }}
        />
      )}

      <Box sx={{ display: 'grid', gap: 1.5, mb: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))' }}>
        <HrCoverageCard
          label={t('payroll.kpi.workers')}
          value={run.coverage.paid}
          unit={t('payroll.kpi.workersUnit')}
          of={t('payroll.kpi.of', { count: run.coverage.eligible })}
          parts={[
            { label: t('payroll.kpi.paid'), value: run.coverage.paid },
            { label: t('payroll.kpi.notApproved'), value: run.coverage.timesheetNotApproved },
            { label: t('payroll.kpi.noTimesheet'), value: run.coverage.noTimesheet },
            { label: t('payroll.kpi.paidElsewhere'), value: run.coverage.paidElsewhere },
          ]}
        />
        <HrKpiCard label={t('payroll.kpi.base')} value={run.totals.base} unit={t('hr.sar')} icon={<AttachMoneyIcon />} accent="blue" trend={trend((x) => x.base)} previous={run.previous?.totals.base ?? null} comparisonLabel={comparison} />
        <HrKpiCard label={t('payroll.kpi.allowances')} value={run.totals.allowances} unit={t('hr.sar')} icon={<AddCircleOutlineIcon />} accent="green" trend={trend((x) => x.allowances)} previous={run.previous?.totals.allowances ?? null} comparisonLabel={comparison} />
        <HrKpiCard label={t('payroll.kpi.deductions')} value={run.totals.deductions} unit={t('hr.sar')} icon={<RemoveCircleOutlineIcon />} accent="amber" trend={trend((x) => x.deductions)} previous={run.previous?.totals.deductions ?? null} comparisonLabel={comparison} />
        <HrKpiCard label={t('payroll.kpi.net')} value={run.totals.net} unit={t('hr.sar')} icon={<CheckCircleOutlineIcon />} accent="rose" trend={trend((x) => x.net)} previous={run.previous?.totals.net ?? null} comparisonLabel={comparison} />
      </Box>

      <Box sx={{ ...(hrCard as object), px: 2, pb: 2 }}>
        <Tabs value={tab} onChange={(_, v: TabKey) => setParams((p) => { p.set('tab', v); return p; }, { replace: true })} sx={{ borderBottom: `1px solid ${hr.border}`, mb: 1.5 }}>
          <Tab value="workers" label={t('payroll.tabs.workers')} />
          <Tab value="summary" label={t('payroll.tabs.summary')} />
          <Tab value="exclusions" label={t('payroll.tabs.exclusions', { count: exclusions?.length ?? 0 })} />
        </Tabs>
        {tab === 'workers' && <WorkersTab run={run} version={version} onScope={setScope} />}
        {tab === 'summary' && <SummaryTab run={run} />}
        {tab === 'exclusions' && <ExclusionsTab list={exclusions} />}
      </Box>

      <ConfirmDialog
        open={confirm === 'submit'}
        title={t('payroll.submit')}
        text={t('payroll.submitConfirm', { no: run.runNo, workers: run.totals.workers, net: money(run.totals.net) })}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void act(async () => { await payrollApi.submit(run.id); setConfirm(null); await reload(); })}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title={t('payroll.delete')}
        text={t('payroll.deleteConfirm', { no: run.runNo })}
        busy={busy}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => void act(async () => { await payrollApi.remove(run.id); navigate('/payroll/runs'); })}
      />
      <SponsorsDialog open={sponsors} onClose={() => setSponsors(false)} />
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

/** The workers of the run: search, note and project filters, server pages, the grouped head and the scope's total. */
function WorkersTab({ run, version, onScope }: { run: PayrollRun; version: number; onScope: (q: LineQuery) => void }) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [project, setProject] = useState('');
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: '', desc: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dense, setDense] = useState(true);
  const [data, setData] = useState<PayrollLinePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<PayrollLine | null>(null);
  const latest = useRef(0);

  // Search waits for the typing to pause; a newer request wins over a slower older one.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const q = useMemo<LineQuery>(() => ({ search: query, note: note || undefined, project: project || undefined, sort: sort.key || undefined, desc: sort.desc, page, pageSize }), [query, note, project, sort, page, pageSize]);

  useEffect(() => {
    onScope({ ...q, page: undefined, pageSize: undefined });
    const ticket = ++latest.current;
    payrollApi
      .lines(run.id, q)
      .then((d) => {
        if (ticket === latest.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((failure) => ticket === latest.current && setError(errorKey(failure)));
  }, [run.id, q, version, onScope]);

  useEffect(() => setPage(1), [query, note, project, pageSize]);

  const filtered = Boolean(query.trim() || note || project);
  const sortBy = (key: string) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' && key !== 'project' }));
  const head = (key: string, label: string, align: 'left' | 'right' = 'left') => (
    <TableCell align={align} rowSpan={2} sortDirection={sort.key === key ? (sort.desc ? 'desc' : 'asc') : false}>
      <ButtonBase onClick={() => sortBy(key)} sx={{ font: 'inherit', fontWeight: 600, color: 'inherit', gap: 0.25 }} aria-label={label}>
        {label}
        {sort.key === key && <span aria-hidden>{sort.desc ? '↓' : '↑'}</span>}
      </ButtonBase>
    </TableCell>
  );
  const rowHeight = dense ? 40 : 50;
  const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, mb: 1.5, alignItems: { md: 'center' } }}>
        <TextField
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('payroll.filters.search')}
          sx={{ width: { md: 300 }, flex: { md: '0 0 300px' } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': t('payroll.filters.search') } }}
        />
        <TextField select size="small" label={t('payroll.filters.notes')} value={note} onChange={(e) => setNote(e.target.value)} sx={{ minWidth: 190 }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">{t('payroll.filters.allNotes')}</MenuItem>
          <MenuItem value="any">{t('payroll.filters.anyNote')}</MenuItem>
          <MenuItem value="none">{t('payroll.filters.noNote')}</MenuItem>
          {payrollNotes.map((n) => (
            <MenuItem key={n} value={n}>
              {t(`payroll.notes.${n}`)} {run.notes[n] ? `(${run.notes[n]})` : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label={t('payroll.filters.project')} value={project} onChange={(e) => setProject(e.target.value)} sx={{ minWidth: 220 }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">{t('payroll.filters.allProjects')}</MenuItem>
          {run.projects.map((p) => (
            <MenuItem key={p.projectCrmId} value={p.projectCrmId}>
              {p.projectName} ({p.workers})
            </MenuItem>
          ))}
        </TextField>
        {filtered && (
          <Button size="small" startIcon={<FilterAltOffOutlinedIcon />} onClick={() => { setSearch(''); setQuery(''); setNote(''); setProject(''); }}>
            {t('payroll.clearFilters')}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup size="small" exclusive value={dense ? 'compact' : 'comfortable'} onChange={(_, v: string | null) => v && setDense(v === 'compact')} aria-label={t('payroll.filters.density')}>
          <ToggleButton value="compact">{t('payroll.filters.compact')}</ToggleButton>
          <ToggleButton value="comfortable">{t('payroll.filters.comfortable')}</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <ErrorMessage messageKey={error} />
      {!data ? (
        <Stack sx={{ gap: 1 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={rowHeight} />
          ))}
        </Stack>
      ) : data.total === 0 ? (
        <HrEmptyState icon={<PersonSearchOutlinedIcon />} title={filtered ? t('payroll.noResults') : t('payroll.exclusionsEmpty')} />
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
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell rowSpan={2}>#</TableCell>
                  <TableCell rowSpan={2} className="pin">
                    <ButtonBase onClick={() => sortBy('name')} sx={{ font: 'inherit', fontWeight: 600, color: 'inherit' }}>
                      {t('payroll.cols.worker')} {sort.key === 'name' && (sort.desc ? '↓' : '↑')}
                    </ButtonBase>
                  </TableCell>
                  <TableCell rowSpan={2}>{t('payroll.cols.number')}</TableCell>
                  {head('project', t('payroll.cols.project'))}
                  <TableCell rowSpan={2}>{t('payroll.cols.profession')}</TableCell>
                  <TableCell rowSpan={2}>{t('payroll.cols.workerStatus')}</TableCell>
                  {head('days', t('payroll.cols.days'), 'right')}
                  {head('base', t('payroll.cols.base'), 'right')}
                  <TableCell colSpan={5} align="center" sx={{ borderBottom: '1px solid #DBE3EE' }}>
                    {t('payroll.cols.allowancesGroup')}
                  </TableCell>
                  {head('deductions', t('payroll.cols.deductions'), 'right')}
                  {head('net', t('payroll.cols.net'), 'right')}
                  <TableCell rowSpan={2}>{t('payroll.cols.actions')}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell align="right">{t('payroll.cols.housing')}</TableCell>
                  <TableCell align="right">{t('payroll.cols.transport')}</TableCell>
                  <TableCell align="right">{t('payroll.cols.food')}</TableCell>
                  <TableCell align="right">{t('payroll.cols.other')}</TableCell>
                  <TableCell align="right" sortDirection={sort.key === 'allowances' ? (sort.desc ? 'desc' : 'asc') : false}>
                    <ButtonBase onClick={() => sortBy('allowances')} sx={{ font: 'inherit', fontWeight: 600, color: 'inherit' }}>
                      {t('payroll.cols.allowances')} {sort.key === 'allowances' && (sort.desc ? '↓' : '↑')}
                    </ButtonBase>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((l, i) => (
                  <TableRow key={l.id} hover>
                    <TableCell sx={{ color: hr.textMuted }}>{from + i}</TableCell>
                    <TableCell className="pin">
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                        <HrAvatar name={l.name} size={28} />
                        <Typography component="span" sx={{ fontWeight: 700, fontSize: 12.5, maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.name}>
                          {l.name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell className="num">
                      <bdi>{l.workerNo}</bdi>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.projectName}>
                      {l.projectName}
                      {l.projects > 1 && <Box component="span" sx={{ color: hr.textMuted }}> +{l.projects - 1}</Box>}
                    </TableCell>
                    <TableCell>{(i18n.language === 'ar' ? l.professionAr : l.professionEn) ?? l.professionCode ?? '—'}</TableCell>
                    <TableCell>
                      <Stack direction="row" sx={{ gap: 0.5 }}>
                        {(i18n.language === 'ar' ? l.statusAr : l.statusEn) && <HrStatusBadge label={(i18n.language === 'ar' ? l.statusAr : l.statusEn)!} color={hr.success} tint="#D1FAE5" />}
                        {l.notes.slice(0, 2).map((n) => (
                          <HrStatusBadge key={n} label={t(`payroll.notes.${n}`)} {...noteLook[n]} />
                        ))}
                        {l.notes.length > 2 && (
                          <Tooltip title={l.notes.slice(2).map((n) => t(`payroll.notes.${n}`)).join('، ')}>
                            <Box component="span" sx={{ fontSize: 12, color: hr.textMuted }}>
                              +{l.notes.length - 2}
                            </Box>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="right" className="num">
                      {money(l.paidDays)}
                    </TableCell>
                    <TableCell align="right" className="num">
                      {money(l.base)}
                    </TableCell>
                    <TableCell align="right" className="num">
                      {money(l.housing)}
                    </TableCell>
                    <TableCell align="right" className="num">
                      {money(l.transport)}
                    </TableCell>
                    <TableCell align="right" className="num">
                      {money(l.food)}
                    </TableCell>
                    <TableCell align="right" className="num">
                      {money(l.otherAllowances + l.overtime + l.additions)}
                    </TableCell>
                    <TableCell align="right" className="num" sx={{ fontWeight: 600 }}>
                      {money(l.allowances)}
                    </TableCell>
                    <TableCell align="right" className="num" sx={{ color: l.deductions ? '#B45309' : undefined }}>
                      {money(l.deductions)}
                    </TableCell>
                    <TableCell align="right" className="num" sx={{ fontWeight: 700, color: l.net <= 0 ? hr.danger : hr.text }}>
                      {money(l.net)}
                    </TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => setOpen(l)} sx={{ minWidth: 0, fontWeight: 600 }}>
                        {t('payroll.details')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="pin">
                    {filtered ? t('payroll.totalScope', { count: data.sums.workers }) : t('payroll.totalAll', { count: data.sums.workers })}
                  </TableCell>
                  <TableCell colSpan={4} />
                  <TableCell align="right" className="num">{money(data.sums.paidDays)}</TableCell>
                  <TableCell align="right" className="num" sx={{ color: hr.primary }}>{money(data.sums.base)}</TableCell>
                  <TableCell align="right" className="num">{money(data.sums.housing)}</TableCell>
                  <TableCell align="right" className="num">{money(data.sums.transport)}</TableCell>
                  <TableCell align="right" className="num">{money(data.sums.food)}</TableCell>
                  <TableCell align="right" className="num">{money(data.sums.otherAllowances + data.sums.overtime + data.sums.additions)}</TableCell>
                  <TableCell align="right" className="num">{money(data.sums.allowances)}</TableCell>
                  <TableCell align="right" className="num" sx={{ color: '#B45309' }}>{money(data.sums.deductions)}</TableCell>
                  <TableCell align="right" className="num" sx={{ color: hr.success }}>{money(data.sums.net)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: 'center', gap: 1.5, mt: 1.5, '& .MuiPagination-ul': { flexWrap: 'nowrap' } }}>
            <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>{t('payroll.shown', { from, to, total: data.total })}</Typography>
            <Box sx={{ flex: 1 }} />
            <Pagination count={Math.max(1, Math.ceil(data.total / data.pageSize))} page={data.page} onChange={(_, p) => setPage(p)} shape="rounded" color="primary" size="small" />
            <TextField select size="small" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} sx={{ width: 150, flex: '0 0 auto' }} slotProps={{ htmlInput: { 'aria-label': t('payroll.perPage', { count: pageSize }) } }}>
              {[10, 25, 50, 100].map((n) => (
                <MenuItem key={n} value={n}>
                  {t('payroll.perPage', { count: n })}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </>
      )}
      {open && <WorkerDrawer runId={run.id} line={open} onClose={() => setOpen(null)} />}
    </Box>
  );
}

/** One worker's pay in the run: each amount with how it is made, and the approved timesheets it comes from. */
function WorkerDrawer({ runId, line, onClose }: { runId: string; line: PayrollLine; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { date } = useCommercialFormat();
  const [detail, setDetail] = useState<PayrollLineDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    payrollApi.line(runId, line.id).then(setDetail).catch((failure) => setError(errorKey(failure)));
  }, [runId, line.id]);

  const row = (label: string, value: number, hint?: ReactNode, color?: string) => (
    <Stack direction="row" key={label} sx={{ justifyContent: 'space-between', gap: 1, py: 0.9, borderBottom: '1px solid #EEF2F7', fontSize: 13 }}>
      <span>
        {label}
        {hint && <Box component="span" sx={{ color: hr.textMuted, fontSize: 12, marginInlineStart: 0.75 }}>{hint}</Box>}
      </span>
      <Box component="b" sx={{ fontVariantNumeric: 'tabular-nums', color }}>{money(value)}</Box>
    </Stack>
  );
  const sourceNet = detail?.sources.reduce((s, x) => s + x.net, 0) ?? 0;

  return (
    <HrDrawer
      open
      onClose={onClose}
      avatar={<HrAvatar name={line.name} size={46} />}
      title={line.name}
      subtitle={
        <>
          <bdi>{line.workerNo}</bdi> · {(i18n.language === 'ar' ? line.professionAr : line.professionEn) ?? '—'} · {line.projectName}
        </>
      }
    >
      <ErrorMessage messageKey={error} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        {[
          [t('payroll.drawer.days'), `${money(line.paidDays)} / 30`, hr.text],
          [t('payroll.drawer.monthly'), money(line.monthlySalary), hr.text],
          [t('payroll.drawer.net'), `${money(line.net)} ${t('hr.sar')}`, hr.success],
        ].map(([label, value, color]) => (
          <Box key={label} sx={{ ...(hrCard as object), p: 1.25 }}>
            <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{label}</Typography>
            <Typography sx={{ fontSize: 17, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
              <bdi>{value}</bdi>
            </Typography>
          </Box>
        ))}
      </Box>
      {line.notes.length > 0 && (
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
          {line.notes.map((n) => (
            <HrStatusBadge key={n} label={t(`payroll.notes.${n}`)} {...noteLook[n]} />
          ))}
        </Stack>
      )}
      <Box>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('payroll.drawer.earnings')}</Typography>
        {row(t('payroll.drawer.base'), line.base)}
        {line.housing !== 0 && row(t('payroll.drawer.housing'), line.housing)}
        {line.transport !== 0 && row(t('payroll.drawer.transport'), line.transport)}
        {line.food !== 0 && row(t('payroll.drawer.food'), line.food)}
        {line.otherAllowances !== 0 && row(t('payroll.drawer.other'), line.otherAllowances)}
        {line.overtime !== 0 && row(t('payroll.drawer.overtime'), line.overtime)}
        {detail && detail.clientAdditions !== 0 && row(t('payroll.drawer.clientAdditions'), detail.clientAdditions)}
        {detail && detail.internalAdditions !== 0 && row(t('payroll.drawer.internalAdditions'), detail.internalAdditions)}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('payroll.drawer.deductions')}</Typography>
        {detail && detail.clientDeductions + detail.customerLoans + detail.internalDeductions === 0 && <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('payroll.drawer.none')}</Typography>}
        {detail && detail.clientDeductions !== 0 && row(t('payroll.drawer.clientDeductions'), detail.clientDeductions, undefined, '#B45309')}
        {detail && detail.customerLoans !== 0 && row(t('payroll.drawer.customerLoans'), detail.customerLoans, undefined, '#B45309')}
        {detail && detail.internalDeductions !== 0 && row(t('payroll.drawer.internalDeductions'), detail.internalDeductions, undefined, '#B45309')}
        {line.absenceDays > 0 && <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: 0.75 }}>{t('payroll.drawer.absenceNote', { days: money(line.absenceDays), paid: money(line.paidDays) })}</Typography>}
      </Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', bgcolor: '#ECFDF5', borderRadius: '10px', p: 1.5, fontWeight: 700 }}>
        <span>{t('payroll.drawer.net')}</span>
        <Box component="span" sx={{ color: hr.success, fontVariantNumeric: 'tabular-nums' }}>
          {money(line.net)} {t('hr.sar')}
        </Box>
      </Stack>
      <Box>
        <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{t('payroll.drawer.sources')}</Typography>
        {!detail ? (
          <Skeleton variant="rounded" height={52} />
        ) : (
          <Stack sx={{ gap: 0.75 }}>
            {detail.sources.map((s) => (
              <Box key={s.timesheetLineId} sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.25 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                  <Link component={RouterLink} to={`/billing/timesheets/${s.timesheetId}`} sx={{ fontWeight: 700, color: hr.primary }}>
                    <bdi>{s.timesheetNo}</bdi>
                  </Link>
                  <Box component="b" sx={{ fontVariantNumeric: 'tabular-nums' }}>{money(s.net)}</Box>
                </Stack>
                <Typography sx={{ fontSize: 12, color: hr.textMuted }}>
                  {s.projectName} · <bdi>{t('payroll.drawer.source', { days: money(s.workDays), from: date(s.lineFrom), to: date(s.lineTo) })}</bdi>
                </Typography>
              </Box>
            ))}
            {Math.abs(sourceNet - line.net) < 0.005 && (
              <Typography sx={{ fontSize: 12.5, color: hr.success, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
                {t('payroll.drawer.matches')}
              </Typography>
            )}
          </Stack>
        )}
      </Box>
    </HrDrawer>
  );
}

/** The run's elements and its net by project. */
function SummaryTab({ run }: { run: PayrollRun }) {
  const { t } = useTranslation();
  const x = run.totals;
  const items: [string, number][] = [
    [t('payroll.summary.base'), x.base],
    [t('payroll.summary.housing'), x.housing],
    [t('payroll.summary.transport'), x.transport],
    [t('payroll.summary.food'), x.food],
    [t('payroll.summary.other'), x.otherAllowances],
    [t('payroll.summary.overtime'), x.overtime],
    [t('payroll.summary.additions'), x.additions],
  ];
  const gross = items.reduce((s, [, v]) => s + v, 0) || 1;
  const colours = [hr.primary, '#0E7490', '#7C3AED', '#059669', '#64748B', '#D97706', '#DB2777'];
  const maxProject = Math.max(...run.projects.map((p) => p.net), 1);
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
      <Box>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('payroll.summary.elements')}</Typography>
        {items.map(([label, value], i) => (
          <Box key={label} sx={{ mb: 1.1 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', fontSize: 13 }}>
              <span>{label}</span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{money(value)}</b>
            </Stack>
            <Box sx={{ height: 6, borderRadius: 99, bgcolor: '#EEF2F7', mt: 0.5, overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${Math.max(0, (value / gross) * 100)}%`, bgcolor: colours[i] }} />
            </Box>
          </Box>
        ))}
        <Stack direction="row" sx={{ justifyContent: 'space-between', borderTop: `1px solid ${hr.border}`, pt: 1, mt: 1, fontSize: 13.5 }}>
          <span>{t('payroll.summary.deductions')}</span>
          <b style={{ color: '#B45309', fontVariantNumeric: 'tabular-nums' }}>−{money(x.deductions)}</b>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.75, fontSize: 15, fontWeight: 700 }}>
          <span>{t('payroll.summary.net')}</span>
          <span style={{ color: hr.success, fontVariantNumeric: 'tabular-nums' }}>{money(x.net)}</span>
        </Stack>
        <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: 0.5 }}>
          {t('payroll.summary.paidDays')}: <bdi>{money(x.paidDays)}</bdi>
        </Typography>
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('payroll.summary.byProject')}</Typography>
        {run.projects.map((p) => (
          <Box key={p.projectCrmId} sx={{ mb: 1.1 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', fontSize: 13, gap: 1 }}>
              <span>
                {p.projectName} <Box component="span" sx={{ color: hr.textMuted }}>· {t('payroll.summary.workers', { count: p.workers })}</Box>
              </span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{money(p.net)}</b>
            </Stack>
            <Box sx={{ height: 6, borderRadius: 99, bgcolor: '#EEF2F7', mt: 0.5, overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${(p.net / maxProject) * 100}%`, bgcolor: hr.primary }} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** The registration's workers the run does not pay, and why. */
function ExclusionsTab({ list }: { list: PayrollExclusion[] | null }) {
  const { t } = useTranslation();
  if (!list) {
    return <LinearProgress />;
  }
  if (list.length === 0) {
    return <HrEmptyState icon={<CheckCircleOutlineIcon />} title={t('payroll.exclusionsEmpty')} />;
  }
  return (
    <Box>
      <Typography sx={{ fontSize: 13, color: hr.textMuted, mb: 1.25 }}>{t('payroll.exclusionsHint')}</Typography>
      <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 560 }}>
        <Table stickyHeader size="small" sx={{ '& th': { bgcolor: hr.muted, color: '#475569', fontWeight: 600 }, '& td': { height: 42 } }}>
          <TableHead>
            <TableRow>
              <TableCell>{t('payroll.cols.worker')}</TableCell>
              <TableCell>{t('payroll.cols.number')}</TableCell>
              <TableCell>{t('payroll.cols.project')}</TableCell>
              <TableCell>{t('payroll.cols.status')}</TableCell>
              <TableCell>{t('payroll.reference')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                    <HrAvatar name={e.name} size={26} />
                    <b>{e.name}</b>
                  </Stack>
                </TableCell>
                <TableCell>
                  <bdi>{e.workerNo}</bdi>
                </TableCell>
                <TableCell>{e.projectName ?? '—'}</TableCell>
                <TableCell>
                  <HrStatusBadge label={t(`payroll.exclusion.${e.kind}`)} {...exclusionLook[e.kind]} />
                </TableCell>
                <TableCell>
                  <bdi>{e.reference ?? '—'}</bdi>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
