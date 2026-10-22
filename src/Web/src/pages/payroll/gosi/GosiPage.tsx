import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import Add from '@mui/icons-material/Add';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CheckIcon from '@mui/icons-material/Check';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
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
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { periodOf, shiftPeriod } from '../../../api/attendance';
import { errorKey } from '../../../api/auth';
import { gosiApi, gosiTaskKinds, type GosiStatement, type GosiStatementQuery, type GosiTask, type GosiTaskKind, type SaudizationRow, type SaudizationSettings } from '../../../api/gosi';
import { useSession } from '../../../app/session';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrAccents, hrCard, type HrAccent } from '../../../components/hr/Hr';
import { useMonthName as usePeriodName } from '../../attendance/AttendanceMonthPage';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { money } from '../payroll';
import { useLegalEntities } from '../RunDialogs';
import { DateField } from '../../../components/DateField';

type View = 'statement' | 'tasks' | 'saudization';

const taskLook: Record<GosiTaskKind, { color: string; tint: string }> = {
  WageUpdate: { color: '#B45309', tint: '#FEF3C7' },
  Register: { color: '#1D4ED8', tint: '#DBEAFE' },
  Exclude: { color: '#475569', tint: '#E2E8F0' },
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * GOSI (docs/03-migration-plan/12, 4.9): a registration's monthly statement from its approved runs (staff and
 * workers) with GOSI's invoice reconciled against it, the tasks HR does on GOSI's portal, and Saudization.
 */
export function GosiPage() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { can } = useSession();
  const periodName = usePeriodName();
  const entities = useLegalEntities();
  const [entity, setEntity] = useState('');
  const [period, setPeriod] = useState(() => shiftPeriod(periodOf(new Date()), -1));
  const [view, setView] = useState<View>('statement');
  const [openTasks, setOpenTasks] = useState<number | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!entity && entities[0]) setEntity(entities[0].id);
  }, [entities, entity]);
  useEffect(() => {
    gosiApi
      .tasks('open')
      .then((list) => setOpenTasks(list.length))
      .catch(() => setOpenTasks(null));
  }, [version]);
  const refresh = () => setVersion((v) => v + 1);
  const flip = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'none' : 'scaleX(-1)') };

  if (!can('payroll.gosi.view', true)) {
    return (
      <HrScope>
        <HrEmptyState icon={<ShieldOutlinedIcon />} title={t('gosi.noAccess')} />
      </HrScope>
    );
  }

  return (
    <HrScope>
      <HrPageHeader
        icon={<ShieldOutlinedIcon />}
        title={t('gosi.title')}
        subtitle={t('gosi.intro')}
        period={
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
            <TextField select size="small" value={entity} onChange={(e) => setEntity(e.target.value)} sx={{ minWidth: 170 }} slotProps={{ htmlInput: { 'aria-label': t('gosi.legalEntity') } }}>
              {entities.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {ar ? e.nameAr : e.nameEn}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" sx={{ alignItems: 'center', border: `1px solid ${hr.border}`, borderRadius: '8px', bgcolor: '#fff', height: 36 }}>
              <IconButton size="small" aria-label={periodName(shiftPeriod(period, -1))} onClick={() => setPeriod((p) => shiftPeriod(p, -1))}>
                <ChevronRightIcon fontSize="small" sx={flip} />
              </IconButton>
              <Typography sx={{ fontSize: 13, fontWeight: 700, px: 1, whiteSpace: 'nowrap' }}>{periodName(period)}</Typography>
              <IconButton size="small" aria-label={periodName(shiftPeriod(period, 1))} disabled={period >= periodOf(new Date())} onClick={() => setPeriod((p) => shiftPeriod(p, 1))}>
                <ChevronLeftIcon fontSize="small" sx={flip} />
              </IconButton>
            </Stack>
          </Stack>
        }
        actions={
          <>
            {can('payroll.settings.manage', true) && (
              <Button variant="outlined" startIcon={<SettingsOutlinedIcon />} onClick={() => setSettings(true)}>
                {t('gosi.settings.title')}
              </Button>
            )}
            {can('payroll.gosi.invoice', true) && (
              <Button variant="contained" startIcon={<Add />} disabled={!entity} onClick={() => setInvoicing(true)}>
                {t('gosi.invoice.record')}
              </Button>
            )}
          </>
        }
      />
      <Box sx={{ ...(hrCard as object), px: 2, pb: 2 }}>
        <Tabs value={view} onChange={(_, v: View) => setView(v)} sx={{ borderBottom: `1px solid ${hr.border}`, mb: 1.5 }}>
          <Tab value="statement" label={t('gosi.tabs.statement')} />
          <Tab value="tasks" label={openTasks === null ? t('gosi.tabs.tasks') : t('gosi.tabs.tasksCount', { count: openTasks })} />
          <Tab value="saudization" label={t('gosi.tabs.saudization')} />
        </Tabs>
        {view === 'statement' && entity && <StatementTab key={`${entity}-${period}-${version}`} entity={entity} period={period} onInvoice={() => setInvoicing(true)} />}
        {view === 'tasks' && <TasksTab key={version} onChanged={refresh} />}
        {view === 'saudization' && <SaudizationTab key={version} />}
      </Box>
      {invoicing && entity && (
        <InvoiceDialog
          entity={entity}
          entityName={(ar ? entities.find((e) => e.id === entity)?.nameAr : entities.find((e) => e.id === entity)?.nameEn) ?? ''}
          period={period}
          onClose={() => setInvoicing(false)}
          onSaved={() => (setInvoicing(false), refresh())}
        />
      )}
      {settings && <SaudizationSettingsDialog onClose={() => setSettings(false)} onSaved={() => (setSettings(false), refresh())} />}
    </HrScope>
  );
}

/** A statement figure: tinted card, round icon, the value in riyals and two parts under it (no trend: none is known). */
function GosiKpi({ label, value, icon, accent, parts, loading }: { label: string; value: number | null; icon: ReactNode; accent: HrAccent; parts: { label: string; value: ReactNode; color?: string }[]; loading: boolean }) {
  const { t } = useTranslation();
  const a = hrAccents[accent];
  return (
    <Box sx={{ ...(hrCard as object), bgcolor: a.tint, p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{label}</Typography>
          {loading ? (
            <Skeleton width={120} height={36} />
          ) : (
            <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {value === null ? '—' : money(value)} <Box component="span" sx={{ fontSize: 12, fontWeight: 500, color: hr.textMuted }}>{t('hr.sar')}</Box>
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: '0 0 auto', width: 38, height: 38, borderRadius: '50%', bgcolor: '#fff', color: a.main, display: 'grid', placeItems: 'center', '& svg': { fontSize: 19 } }}>{icon}</Box>
      </Stack>
      <Stack direction="row" sx={{ justifyContent: 'space-between', borderTop: '1px dashed rgba(15,39,71,.12)', pt: 0.75, fontSize: 11.5, color: hr.textMuted }}>
        {parts.map((p, i) => (
          <span key={p.label} style={{ textAlign: i === 0 ? 'start' : 'end' }}>
            {p.label}
            <Box component="b" sx={{ display: 'block', color: p.color ?? hr.text, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
              {loading ? '…' : p.value}
            </Box>
          </span>
        ))}
      </Stack>
    </Box>
  );
}

/** The registration's month: the figures, the members from the approved runs (paged on the server) and the invoice. */
function StatementTab({ entity, period, onInvoice }: { entity: string; period: string; onInvoice: () => void }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<GosiStatementQuery['kind']>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<GosiStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  useEffect(() => {
    const h = setTimeout(() => (setSearch(typed.trim()), setPage(1)), 350);
    return () => clearTimeout(h);
  }, [typed]);
  const load = useCallback(() => {
    setError(null);
    gosiApi
      .statement({ legalEntityId: entity, period, search, kind, page, pageSize })
      .then(setData)
      .catch((f) => setError(errorKey(f)));
  }, [entity, period, search, kind, page, pageSize]);
  useEffect(load, [load]);

  if (error) {
    return (
      <Stack sx={{ gap: 1, alignItems: 'flex-start' }}>
        <ErrorMessage messageKey={error} />
        <Button size="small" variant="outlined" onClick={load}>
          {t('gosi.retry')}
        </Button>
      </Stack>
    );
  }

  const d = data;
  const loading = !d;
  const n = (v: number) => v.toLocaleString('en-US');
  const flagLook = { not_registered: { color: '#B45309', tint: '#FEF3C7' }, wage_update: { color: '#B45309', tint: '#FEF3C7' } } as const;
  const diffColor = d?.difference ? hr.warning : hr.success;
  return (
    <Stack sx={{ gap: 1.5 }}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' } }}>
        <Box sx={{ ...(hrCard as object), bgcolor: hrAccents.violet.tint, p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{t('gosi.kpi.members')}</Typography>
              {loading ? <Skeleton width={90} height={36} /> : <Typography sx={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{n(d.members)}</Typography>}
            </Box>
            <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: '#fff', color: hrAccents.violet.main, display: 'grid', placeItems: 'center' }}>
              <GroupsOutlinedIcon sx={{ fontSize: 19 }} />
            </Box>
          </Stack>
          <Stack direction="row" sx={{ justifyContent: 'space-between', borderTop: '1px dashed rgba(15,39,71,.12)', pt: 0.75, fontSize: 11.5, color: hr.textMuted }}>
            <span>
              {t('gosi.kpi.staff')}
              <Box component="b" sx={{ display: 'block', color: hr.text, fontSize: 12.5 }}>{loading ? '…' : n(d.staff)}</Box>
            </span>
            <span style={{ textAlign: 'end' }}>
              {t('gosi.kpi.workers')}
              <Box component="b" sx={{ display: 'block', color: hr.text, fontSize: 12.5 }}>{loading ? '…' : n(d.workers)}</Box>
            </span>
          </Stack>
        </Box>
        <GosiKpi
          label={t('gosi.kpi.base')}
          value={d?.base ?? null}
          icon={<AttachMoneyIcon />}
          accent="blue"
          loading={loading}
          parts={[
            { label: t('gosi.kpi.saudi'), value: d ? money(d.saudiBase) : '' },
            { label: t('gosi.kpi.nonSaudi'), value: d ? money(d.nonSaudiBase) : '' },
          ]}
        />
        <GosiKpi
          label={t('gosi.kpi.employee')}
          value={d?.employee ?? null}
          icon={<RemoveIcon />}
          accent="amber"
          loading={loading}
          parts={[{ label: t('gosi.kpi.employeeHint'), value: '' }]}
        />
        <GosiKpi
          label={t('gosi.kpi.employer')}
          value={d?.employer ?? null}
          icon={<ApartmentOutlinedIcon />}
          accent="green"
          loading={loading}
          parts={[{ label: t('gosi.kpi.hazards'), value: d ? money(d.hazards) : '' }]}
        />
        <GosiKpi
          label={t('gosi.kpi.due')}
          value={d?.due ?? null}
          icon={<DragHandleIcon />}
          accent="rose"
          loading={loading}
          parts={[
            { label: t('gosi.kpi.invoice'), value: d?.invoice == null ? '—' : money(d.invoice) },
            { label: t('gosi.kpi.difference'), value: d?.difference == null ? '—' : <bdi>{money(d.difference)}</bdi>, color: d?.difference == null ? undefined : diffColor },
          ]}
        />
      </Box>

      {d && d.openRuns > 0 && (
        <Alert severity="warning" sx={{ py: 0 }}>
          {t('gosi.openRuns', { count: d.openRuns })}
        </Alert>
      )}
      {d && d.approvedRuns === 0 && d.openRuns === 0 && (
        <Alert severity="info" sx={{ py: 0 }}>
          {t('gosi.noRuns')}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' }, alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" sx={{ gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t('gosi.search')}
              sx={{ width: 260 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': t('gosi.search') } }}
            />
            <TextField select size="small" value={kind} onChange={(e) => (setKind(e.target.value as GosiStatementQuery['kind']), setPage(1))} sx={{ width: 190 }} slotProps={{ select: { displayEmpty: true }, htmlInput: { 'aria-label': t('gosi.kind.label') } }}>
              <MenuItem value="">{t('gosi.kind.all')}</MenuItem>
              <MenuItem value="Staff">{t('gosi.kind.Staff')}</MenuItem>
              <MenuItem value="Worker">{t('gosi.kind.Worker')}</MenuItem>
              <MenuItem value="flags">{t('gosi.kind.flags')}</MenuItem>
            </TextField>
          </Stack>
          {!d ? (
            <Stack sx={{ gap: 0.75 }}>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rounded" height={40} />)}</Stack>
          ) : d.members === 0 ? (
            <HrEmptyState icon={<ShieldOutlinedIcon />} title={t('gosi.empty')} hint={t('gosi.emptyHint')} />
          ) : d.items.length === 0 ? (
            <HrEmptyState icon={<SearchIcon />} title={t('gosi.noResults')} />
          ) : (
            <>
              <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 620 }}>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& td': { height: 42, fontVariantNumeric: 'tabular-nums', fontSize: 12.5 },
                    '& th': { fontSize: 11.5 },
                    '& thead tr:nth-of-type(2) th': { top: 30 },
                    '& th.grp': { textAlign: 'center' },
                    '& th.g-emp': { bgcolor: '#FDF1DC', color: '#B45309' },
                    '& th.g-co': { bgcolor: '#E3F6EC', color: '#047857' },
                    '& td.g-emp': { backgroundImage: 'linear-gradient(rgba(217,119,6,.05), rgba(217,119,6,.05))' },
                    '& td.g-co': { backgroundImage: 'linear-gradient(rgba(5,150,105,.045), rgba(5,150,105,.045))' },
                    '& .gs': { borderInlineStart: `2px solid ${hr.border}` },
                    '& tfoot td': { position: 'sticky', bottom: 0, bgcolor: '#F8FAFC', fontWeight: 700, color: hr.text, borderTop: `1px solid ${hr.border}` },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell rowSpan={2}>{t('gosi.cols.member')}</TableCell>
                      <TableCell rowSpan={2}>{t('gosi.cols.kind')}</TableCell>
                      <TableCell rowSpan={2}>{t('gosi.cols.category')}</TableCell>
                      <TableCell rowSpan={2} align="right">{t('gosi.cols.base')}</TableCell>
                      <TableCell rowSpan={2}>{t('gosi.cols.flag')}</TableCell>
                      <TableCell className="grp g-emp gs">{t('gosi.cols.employee')}</TableCell>
                      <TableCell className="grp g-co gs">{t('gosi.cols.employer')}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" className="g-emp gs">{t('gosi.cols.amount')}</TableCell>
                      <TableCell align="right" className="g-co gs">{t('gosi.cols.amount')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {d.items.map((l) => (
                      <TableRow key={`${l.kind}-${l.personId}`} hover>
                        <TableCell>
                          <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                            <HrAvatar name={l.name} size={26} />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{l.name}</Typography>
                              <Typography sx={{ fontSize: 11, color: hr.textMuted }}>
                                <bdi>{l.no}</bdi>
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>{t(`gosi.kind.${l.kind}`)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{l.category ? t(`staffPayroll.gosiCategory.${l.category}`) : '—'}</TableCell>
                        <TableCell align="right">{money(l.base)}</TableCell>
                        <TableCell>{l.flag ? <HrStatusBadge label={t(`gosi.flags.${l.flag}`)} {...flagLook[l.flag]} /> : <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{t('gosi.flags.ok')}</Typography>}</TableCell>
                        <TableCell align="right" className="g-emp gs">{money(l.employee)}</TableCell>
                        <TableCell align="right" className="g-co gs">{money(l.employer)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3}>{t('gosi.totalAll', { count: d.members })}</TableCell>
                      <TableCell align="right">{money(d.base)}</TableCell>
                      <TableCell />
                      <TableCell align="right" className="gs">{money(d.employee)}</TableCell>
                      <TableCell align="right" className="gs">{money(d.employer)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
              <Stack direction="row" sx={{ mt: 1, gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>
                  {t('gosi.shown', { from: (d.page - 1) * d.pageSize + 1, to: Math.min(d.total, d.page * d.pageSize), total: d.total })}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Pagination count={Math.max(1, Math.ceil(d.total / d.pageSize))} page={d.page} onChange={(_, p) => setPage(p)} shape="rounded" color="primary" size="small" />
                <TextField select size="small" value={pageSize} onChange={(e) => (setPageSize(Number(e.target.value)), setPage(1))} sx={{ width: 150 }} slotProps={{ htmlInput: { 'aria-label': t('staffPayroll.perPage', { count: pageSize }) } }}>
                  {[10, 25, 50, 100].map((v) => (
                    <MenuItem key={v} value={v}>
                      {t('staffPayroll.perPage', { count: v })}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </>
          )}
        </Box>

        <Box sx={{ ...(hrCard as object), p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('gosi.invoice.title')}</Typography>
          {[
            [t('gosi.invoice.due'), d ? money(d.due) : '…', undefined],
            [t('gosi.invoice.amount'), d?.invoice == null ? '—' : money(d.invoice), undefined],
            [t('gosi.invoice.difference'), d?.difference == null ? '—' : money(d.difference), d?.difference == null ? undefined : diffColor],
          ].map(([label, value, color]) => (
            <Stack key={label} direction="row" sx={{ justifyContent: 'space-between', py: 0.9, borderBottom: '1px solid #EEF2F7', fontSize: 13 }}>
              <span>{label}</span>
              <Box component="b" sx={{ fontVariantNumeric: 'tabular-nums', color }}>
                <bdi>{value}</bdi>
              </Box>
            </Stack>
          ))}
          {d?.invoiceNote && <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: 1 }}>{d.invoiceNote}</Typography>}
          {d?.invoiceBy && <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{t('gosi.invoice.by', { name: d.invoiceBy })}</Typography>}
          {d && d.difference != null && d.difference !== 0 && (
            <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: 1 }}>{t('gosi.invoice.differenceHint')}</Typography>
          )}
          {d && d.difference === 0 && (
            <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', mt: 1, color: hr.success, fontSize: 12.5 }}>
              <CheckIcon sx={{ fontSize: 16 }} />
              {t('gosi.invoice.matches')}
            </Stack>
          )}
          {d?.invoice == null && (
            <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: 1 }}>{t('gosi.invoice.none')}</Typography>
          )}
          {can('payroll.gosi.invoice', true) && (
            <Button size="small" variant="outlined" sx={{ mt: 1.5 }} startIcon={<AccountBalanceOutlinedIcon />} onClick={onInvoice}>
              {d?.invoice == null ? t('gosi.invoice.record') : t('gosi.invoice.edit')}
            </Button>
          )}
          {d && d.categories.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>{t('gosi.byCategory')}</Typography>
              {d.categories.map((c) => (
                <Stack key={c.category} direction="row" sx={{ justifyContent: 'space-between', py: 0.6, fontSize: 12.5, borderBottom: '1px solid #EEF2F7' }}>
                  <span>
                    {c.category ? t(`staffPayroll.gosiCategory.${c.category}`) : '—'} <Box component="span" sx={{ color: hr.textMuted }}>({c.members.toLocaleString('en-US')})</Box>
                  </span>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{money(c.employee + c.employer)}</b>
                </Stack>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Stack>
  );
}

/** The tasks on GOSI's portal: open ones by kind, each closed with what was done there; and the done ones. */
function TasksTab({ onChanged }: { onChanged: () => void }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const [status, setStatus] = useState<'open' | 'done'>('open');
  const [kind, setKind] = useState<GosiTaskKind | ''>('');
  const [tasks, setTasks] = useState<GosiTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState<GosiTask | null>(null);
  const load = useCallback(() => {
    setTasks(null);
    setError(null);
    gosiApi
      .tasks(status)
      .then(setTasks)
      .catch((f) => setError(errorKey(f)));
  }, [status]);
  useEffect(load, [load]);
  const shown = tasks?.filter((x) => !kind || x.kind === kind) ?? [];
  const count = (k: GosiTaskKind) => tasks?.filter((x) => x.kind === k).length ?? 0;
  return (
    <Stack sx={{ gap: 1.25 }}>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToggleButtonGroup size="small" exclusive value={status} onChange={(_, v: 'open' | 'done' | null) => v && setStatus(v)}>
          <ToggleButton value="open">{t('gosi.tasks.open')}</ToggleButton>
          <ToggleButton value="done">{t('gosi.tasks.done')}</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ width: 8 }} />
        {gosiTaskKinds.map((k) => (
          <Chip
            key={k}
            size="small"
            label={`${t(`gosi.taskKind.${k}`)} (${count(k)})`}
            onClick={() => setKind((c) => (c === k ? '' : k))}
            variant={kind === k ? 'filled' : 'outlined'}
            sx={{ fontWeight: 600, color: taskLook[k].color, bgcolor: kind === k ? taskLook[k].tint : undefined, borderColor: taskLook[k].tint }}
          />
        ))}
      </Stack>
      {error ? (
        <Stack sx={{ gap: 1, alignItems: 'flex-start' }}>
          <ErrorMessage messageKey={error} />
          <Button size="small" variant="outlined" onClick={load}>
            {t('gosi.retry')}
          </Button>
        </Stack>
      ) : !tasks ? (
        <Stack sx={{ gap: 0.75 }}>{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="rounded" height={42} />)}</Stack>
      ) : shown.length === 0 ? (
        <HrEmptyState icon={<CheckIcon />} title={status === 'open' ? t('gosi.tasks.none') : t('gosi.tasks.noneDone')} hint={status === 'open' ? t('gosi.tasks.noneHint') : undefined} />
      ) : (
        <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
          <Table size="small" sx={{ '& td': { height: 44, fontVariantNumeric: 'tabular-nums', fontSize: 12.5 } }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('gosi.tasks.kind')}</TableCell>
                <TableCell>{t('gosi.tasks.employee')}</TableCell>
                <TableCell align="right">{t('gosi.tasks.oldWage')}</TableCell>
                <TableCell align="right">{t('gosi.tasks.newWage')}</TableCell>
                <TableCell>{t('gosi.tasks.eventOn')}</TableCell>
                {status === 'done' ? (
                  <>
                    <TableCell>{t('gosi.tasks.doneOn')}</TableCell>
                    <TableCell>{t('gosi.tasks.reference')}</TableCell>
                  </>
                ) : (
                  <TableCell>{t('gosi.tasks.action')}</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((x) => (
                <TableRow key={x.id} hover>
                  <TableCell>
                    <HrStatusBadge label={t(`gosi.taskKind.${x.kind}`)} {...taskLook[x.kind]} />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{x.name}</Typography>
                    <Typography sx={{ fontSize: 11, color: hr.textMuted }}>
                      <bdi>{x.employeeNo}</bdi>
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{x.oldWage == null ? '—' : money(x.oldWage)}</TableCell>
                  <TableCell align="right">{x.newWage == null ? '—' : money(x.newWage)}</TableCell>
                  <TableCell>{x.eventOn ? <bdi>{date(x.eventOn)}</bdi> : '—'}</TableCell>
                  {status === 'done' ? (
                    <>
                      <TableCell>
                        {x.doneOn ? <bdi>{date(x.doneOn)}</bdi> : '—'}
                        {x.doneByName && <Typography sx={{ fontSize: 11, color: hr.textMuted }}>{x.doneByName}</Typography>}
                      </TableCell>
                      <TableCell>{x.reference ?? '—'}</TableCell>
                    </>
                  ) : (
                    <TableCell>
                      {can('payroll.gosi.manage', true) ? (
                        <Button size="small" variant="outlined" startIcon={<CheckIcon />} onClick={() => setClosing(x)}>
                          {t(`gosi.close.action.${x.kind}`)}
                        </Button>
                      ) : (
                        <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{t('gosi.tasks.readOnly')}</Typography>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {closing && <CloseTaskDialog task={closing} onClose={() => setClosing(null)} onDone={() => (setClosing(null), load(), onChanged())} />}
    </Stack>
  );
}

/** Closing a task with what was done on GOSI's portal. */
function CloseTaskDialog({ task, onClose, onDone }: { task: GosiTask; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [doneOn, setDoneOn] = useState(today());
  const [wage, setWage] = useState(task.newWage == null ? '' : String(task.newWage));
  const [gosiNo, setGosiNo] = useState('');
  const [since, setSince] = useState(task.eventOn ?? '');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const register = task.kind === 'Register';
  const exclude = task.kind === 'Exclude';
  const valid = Boolean(doneOn) && (exclude || Number(wage) > 0) && (!register || gosiNo.trim().length > 0);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await gosiApi.closeTask(task.id, {
        doneOn,
        wage: exclude ? null : Number(wage),
        gosiNo: register ? gosiNo.trim() : null,
        since: register && since ? since : null,
        reference: reference.trim() || null,
      });
      onDone();
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t(`gosi.close.title.${task.kind}`, { name: task.name })}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            {!exclude && (
              <TextField
                size="small"
                required
                type="number"
                label={t('gosi.close.wage')}
                value={wage}
                onChange={(e) => setWage(e.target.value)}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">{t('hr.sar')}</InputAdornment> } }}
              />
            )}
            <DateField size="small" required label={t(`gosi.close.doneOn.${task.kind}`)} value={doneOn} onChange={(e) => setDoneOn(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            {register && (
              <>
                <TextField size="small" required label={t('gosi.close.gosiNo')} value={gosiNo} onChange={(e) => setGosiNo(e.target.value)} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 30 } }} />
                <DateField size="small" label={t('gosi.close.since')} value={since} onChange={(e) => setSince(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              </>
            )}
          </Box>
          <TextField size="small" label={t('gosi.close.reference')} value={reference} onChange={(e) => setReference(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
          <Alert severity="info" sx={{ py: 0 }}>
            {t(`gosi.close.hint.${task.kind}`)}
          </Alert>
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !valid} onClick={() => void save()}>
            {t('common.save')}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

/** GOSI's invoice for the registration's month, entered by finance; the statement shows the difference. */
function InvoiceDialog({ entity, entityName, period, onClose, onSaved }: { entity: string; entityName: string; period: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const periodName = usePeriodName();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    gosiApi
      .statement({ legalEntityId: entity, period, page: 1, pageSize: 1 })
      .then((s) => (s.invoice != null && setAmount(String(s.invoice)), s.invoiceNote && setNote(s.invoiceNote)))
      .catch(() => undefined);
  }, [entity, period]);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await gosiApi.saveInvoice({ legalEntityId: entity, period, amount: Number(amount), note: note.trim() || null });
      onSaved();
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('gosi.invoice.dialog', { entity: entityName, month: periodName(period) })}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <TextField
            size="small"
            required
            type="number"
            label={t('gosi.invoice.amount')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">{t('hr.sar')}</InputAdornment> } }}
          />
          <TextField size="small" label={t('gosi.invoice.note')} value={note} onChange={(e) => setNote(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !(Number(amount) >= 0) || amount === ''} onClick={() => void save()}>
            {t('common.save')}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

/** Saudization by registration: the counted share against the required one. */
function SaudizationTab() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [rows, setRows] = useState<SaudizationRow[] | null>(null);
  const [fullWage, setFullWage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    Promise.all([gosiApi.saudization(), gosiApi.saudizationSettings()])
      .then(([r, s]) => (setRows(r), setFullWage(s.fullWage)))
      .catch((f) => setError(errorKey(f)));
  }, []);
  useEffect(load, [load]);
  if (error) {
    return (
      <Stack sx={{ gap: 1, alignItems: 'flex-start' }}>
        <ErrorMessage messageKey={error} />
        <Button size="small" variant="outlined" onClick={load}>
          {t('gosi.retry')}
        </Button>
      </Stack>
    );
  }
  if (!rows) {
    return (
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Skeleton variant="rounded" height={260} />
        <Skeleton variant="rounded" height={260} />
      </Box>
    );
  }
  if (rows.length === 0) return <HrEmptyState icon={<GroupsOutlinedIcon />} title={t('gosi.saudization.none')} />;
  const below = rows.filter((r) => r.below);
  const wage = money(fullWage ?? 4000);
  return (
    <Stack sx={{ gap: 1.5 }}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        {rows.map((r) => {
          const color = r.requiredPercent == null ? hr.primary : r.below ? hr.danger : hr.success;
          const share = Math.max(0, Math.min(100, r.percent));
          const line = (label: string, value: ReactNode) => (
            <Stack direction="row" key={label} sx={{ justifyContent: 'space-between', py: 0.9, borderBottom: '1px solid #EEF2F7', fontSize: 13 }}>
              <span style={{ color: hr.textMuted }}>{label}</span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</b>
            </Stack>
          );
          return (
            <Box key={r.legalEntityId} sx={{ ...(hrCard as object), p: 2 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{ar ? r.nameAr : r.nameEn}</Typography>
                {r.requiredPercent == null ? (
                  <HrStatusBadge label={t('gosi.saudization.noTarget')} color="#475569" tint="#E2E8F0" />
                ) : r.below ? (
                  <HrStatusBadge label={t('gosi.saudization.below')} color={hr.danger} tint="#FEE2E2" />
                ) : (
                  <HrStatusBadge label={t('gosi.saudization.meets')} color={hr.success} tint="#D1FAE5" />
                )}
              </Stack>
              <Stack direction="row" sx={{ gap: 2, alignItems: 'center', mb: 1 }}>
                <Box
                  role="img"
                  aria-label={`${r.percent}%`}
                  sx={{ flex: '0 0 auto', width: 108, height: 108, borderRadius: '50%', background: `conic-gradient(${color} 0 ${share}%, #E2E8F0 ${share}% 100%)`, display: 'grid', placeItems: 'center' }}
                >
                  <Box sx={{ width: 84, height: 84, borderRadius: '50%', bgcolor: '#fff', display: 'grid', placeItems: 'center', fontSize: 19, fontWeight: 700, color }}>
                    <bdi>{r.percent.toFixed(1)}%</bdi>
                  </Box>
                </Box>
                <Box sx={{ fontSize: 13 }}>
                  <Typography sx={{ fontSize: 13 }}>{t('gosi.saudization.counted', { counted: r.counted.toLocaleString('en-US'), total: r.total.toLocaleString('en-US') })}</Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    {r.requiredPercent == null ? t('gosi.saudization.requiredNone') : t('gosi.saudization.required', { percent: r.requiredPercent.toFixed(1) })}
                  </Typography>
                </Box>
              </Stack>
              {line(t('gosi.saudization.staffSaudis'), r.halfCounted > 0 ? t('gosi.saudization.withHalf', { count: r.staffSaudis, half: r.halfCounted, wage }) : r.staffSaudis.toLocaleString('en-US'))}
              {line(t('gosi.saudization.workerSaudis'), r.workerSaudis.toLocaleString('en-US'))}
              {line(t('gosi.saudization.nonSaudis'), (r.total - r.saudis).toLocaleString('en-US'))}
              {r.requiredPercent != null && line(t('gosi.saudization.needed'), r.needed > 0 ? t('gosi.saudization.neededCount', { count: r.needed }) : '—')}
            </Box>
          );
        })}
      </Box>
      {below.length > 0 && (
        <Alert severity="error" sx={{ py: 0 }}>
          {t('gosi.saudization.belowAlert', { names: below.map((r) => (ar ? r.nameAr : r.nameEn)).join('، ') })}
        </Alert>
      )}
      <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{t('gosi.saudization.rule', { wage })}</Typography>
    </Stack>
  );
}

/** The full wage and each registration's required share (until HR's figures from Nitaqat are confirmed). */
function SaudizationSettingsDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [value, setValue] = useState<SaudizationSettings | null>(null);
  const [wage, setWage] = useState('');
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    gosiApi
      .saudizationSettings()
      .then((s) => {
        setValue(s);
        setWage(String(s.fullWage));
        setTargets(Object.fromEntries(s.targets.map((x) => [x.legalEntityId, x.requiredPercent == null ? '' : String(x.requiredPercent)])));
      })
      .catch((f) => setError(errorKey(f)));
  }, []);
  const save = async () => {
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await gosiApi.saveSaudizationSettings({
        fullWage: Number(wage),
        targets: value.targets.map((x) => ({ ...x, requiredPercent: targets[x.legalEntityId] === '' ? null : Number(targets[x.legalEntityId]) })),
      });
      onSaved();
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('gosi.settings.title')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          {!value ? (
            <Skeleton variant="rounded" height={120} />
          ) : (
            <>
              <TextField
                size="small"
                required
                type="number"
                label={t('gosi.settings.fullWage')}
                helperText={t('gosi.settings.fullWageHint')}
                value={wage}
                onChange={(e) => setWage(e.target.value)}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">{t('hr.sar')}</InputAdornment> } }}
              />
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{t('gosi.settings.required')}</Typography>
              {value.targets.map((x) => (
                <TextField
                  key={x.legalEntityId}
                  size="small"
                  type="number"
                  label={(ar ? x.nameAr : x.nameEn) ?? ''}
                  value={targets[x.legalEntityId] ?? ''}
                  onChange={(e) => setTargets((c) => ({ ...c, [x.legalEntityId]: e.target.value }))}
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> }, htmlInput: { min: 0, max: 100, step: 0.1 } }}
                />
              ))}
              <Alert severity="info" sx={{ py: 0 }}>
                {t('gosi.settings.hint')}
              </Alert>
            </>
          )}
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !value || !(Number(wage) > 0)} onClick={() => void save()}>
            {t('common.save')}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}
