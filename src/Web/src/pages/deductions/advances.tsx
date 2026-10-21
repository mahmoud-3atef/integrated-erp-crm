import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import Add from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import UpcomingOutlinedIcon from '@mui/icons-material/UpcomingOutlined';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { periodOf, shiftPeriod } from '../../api/attendance';
import { errorKey } from '../../api/auth';
import {
  deductionsApi,
  sar,
  type AdvanceDetail,
  type AdvanceInput,
  type AdvanceKpis,
  type AdvancePreview,
  type AdvanceRow,
  type AdvanceStatus,
  type Installment,
  type InstallmentStatus,
} from '../../api/deductions';
import { staffApi } from '../../api/staff';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrAccents, hrCard, type HrAccent } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useMonthName } from '../attendance/AttendanceMonthPage';
import { useCommercialFormat } from '../commercial/ProjectsPage';

export type Person = { id: string; nameAr: string; nameEn: string };

const look: Record<AdvanceStatus, { color: string; tint: string }> = {
  Cancelled: { color: '#B91C1C', tint: '#FEE2E2' },
  InApproval: { color: hr.primary, tint: '#EFF6FF' },
  Returned: { color: '#B45309', tint: '#FEF3C7' },
  Rejected: { color: '#B91C1C', tint: '#FEE2E2' },
  Approved: { color: hr.violet, tint: '#F5F3FF' },
  Disbursed: { color: hr.success, tint: '#D1FAE5' },
  Settled: { color: hr.textMuted, tint: hr.muted },
};

const installmentLook: Record<InstallmentStatus, { color: string; tint: string }> = {
  Scheduled: { color: hr.primary, tint: '#EFF6FF' },
  Deferred: { color: '#B45309', tint: '#FEF3C7' },
  Deducted: { color: hr.success, tint: '#D1FAE5' },
  Postponed: { color: hr.textMuted, tint: hr.muted },
  Settled: { color: hr.textMuted, tint: hr.muted },
};

export function AdvanceStatusBadge({ status }: { status: AdvanceStatus }) {
  const { t } = useTranslation();
  return <HrStatusBadge label={t(`deductions.advanceStatus.${status}`)} {...look[status]} />;
}

/** Money with the riyal sign after it, in tabular digits. */
export function Money({ value, strong = false }: { value: number | null | undefined; strong?: boolean }) {
  const { t } = useTranslation();
  if (value === null || value === undefined) return <>—</>;
  return (
    <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 700 : undefined, whiteSpace: 'nowrap' }}>
      <bdi>{sar(value)}</bdi> <Box component="span" sx={{ fontSize: '0.8em', color: hr.textMuted, fontWeight: 500 }}>{t('deductions.sar')}</Box>
    </Box>
  );
}

export function usePeople(search: string, enabled = true) {
  const [options, setOptions] = useState<Person[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => staffApi.pick(search).then(setOptions).catch(() => setOptions([])), 250);
    return () => clearTimeout(timer);
  }, [search, enabled]);
  return options;
}

/** The next payroll months to start deducting from (this month and the five after it). */
export function usePeriods(current?: string) {
  const now = periodOf(new Date());
  const list = Array.from({ length: 6 }, (_, i) => shiftPeriod(now, i));
  return current && !list.includes(current) ? [current, ...list] : list;
}

export function Kpi({ accent, icon, label, value, parts }: { accent: HrAccent; icon: ReactNode; label: string; value: ReactNode; parts: [string, ReactNode][] }) {
  const a = hrAccents[accent];
  return (
    <Box sx={{ ...(hrCard as object), bgcolor: a.tint, p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{label}</Typography>
          <Typography component="div" sx={{ fontSize: 25, fontWeight: 700, color: hr.text, lineHeight: 1.3 }}>
            {value}
          </Typography>
        </Box>
        <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: '#fff', color: a.main, display: 'grid', placeItems: 'center', '& svg': { fontSize: 19 } }}>{icon}</Box>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${parts.length}, 1fr)`, gap: 1, borderTop: '1px dashed rgba(15,39,71,.12)', pt: 0.75 }}>
        {parts.map(([l, v]) => (
          <Box key={l}>
            <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{l}</Typography>
            <Typography component="div" sx={{ fontSize: 12.5, fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums' }}>
              {v}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * An advance request (or a returned one sent again): employee, amount, months and the first payroll month, with a live
 * preview — the salary and the cap (for those who may see salaries), the installment, the month's deductions, the
 * conditions — and «above the cap» for the approvers to decide when the cap is passed.
 */
/** A new advance, a returned one sent again, or (amend) an approved one changed before it is paid, with the reason. */
export function AdvanceDialog({ employee, advance, amend = false, onClose, onSent }: { employee?: Person; advance?: AdvanceDetail; amend?: boolean; onClose: () => void; onSent: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const monthName = useMonthName();
  const a = advance?.advance;
  const [who, setWho] = useState<Person | null>(employee ?? (a ? { id: a.employeeId, nameAr: a.employeeName, nameEn: a.employeeName } : null));
  const [search, setSearch] = useState('');
  const people = usePeople(search, !employee && !advance);
  const [amount, setAmount] = useState(a ? String(a.amount) : '');
  const [months, setMonths] = useState(a?.months ?? 1);
  const [maxMonths, setMaxMonths] = useState(3);
  const [capPercent, setCapPercent] = useState<number | null>(null);
  const periods = usePeriods(a?.firstPeriod);
  const [first, setFirst] = useState(a?.firstPeriod ?? shiftPeriod(periodOf(new Date()), 1));
  const [reason, setReason] = useState(advance?.reason ?? '');
  const [amendReason, setAmendReason] = useState('');
  const [aboveCap, setAboveCap] = useState(a?.aboveCap ?? false);
  const [preview, setPreview] = useState<AdvancePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    deductionsApi
      .setup()
      .then((s) => (setMaxMonths(s.settings.advanceMaxMonths), setCapPercent(s.settings.advanceCapPercent)))
      .catch(() => undefined);
  }, []);
  const value = Number(amount);
  const input: AdvanceInput | null = who && value > 0 ? { employeeId: who.id, amount: value, months, firstPeriod: first, reason: reason.trim(), aboveCap } : null;
  const key = input ? `${input.employeeId}|${value}|${months}|${first}|${aboveCap}|${reason.trim() !== ''}` : '';
  useEffect(() => {
    if (!input) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      deductionsApi
        .previewAdvance({ ...input, reason: input.reason || '—' }, a?.id)
        .then((p) => (setPreview(p), setError(null)))
        .catch((f) => (setPreview(null), setError(errorKey(f))));
    }, 300);
    return () => clearTimeout(timer);
  }, [key]);
  const send = async () => {
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      if (a && amend) {
        await deductionsApi.amendAdvance(a.id, { amount: input.amount, months: input.months, firstPeriod: input.firstPeriod, reason: input.reason, aboveCap: input.aboveCap, amendReason: amendReason.trim() });
        onSent(a.id);
        return;
      }
      const r = a ? await deductionsApi.resubmitAdvance(a.id, input) : await deductionsApi.sendAdvance(input);
      onSent(r.id);
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };
  const blocking = preview?.problems.filter((p) => p !== 'above_cap') ?? [];
  const canSend = Boolean(input && reason.trim() && preview && blocking.length === 0 && (preview.needsAboveCap.length === 0 || aboveCap));
  const checks: [string, boolean][] = preview
    ? [
        [t('deductions.advance.checks.probation'), !preview.problems.includes('on_probation')],
        [t('deductions.advance.checks.service'), !preview.problems.includes('short_service')],
        [t('deductions.advance.checks.open'), !preview.problems.includes('open_advance')],
        [t('deductions.advance.checks.months', { max: preview.maxMonths }), !preview.problems.includes('too_many_months')],
      ]
    : [];
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{a ? (amend ? t('deductions.amend.advanceTitle', { no: a.advanceNo }) : a.advanceNo) : t('deductions.advance.new')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Autocomplete
              size="small"
              disabled={Boolean(employee || advance)}
              options={people}
              value={who}
              onChange={(_, v) => setWho(v)}
              onInputChange={(_, v) => setSearch(v)}
              getOptionLabel={(o) => (ar ? o.nameAr : o.nameEn)}
              isOptionEqualToValue={(x, y) => x.id === y.id}
              filterOptions={(x) => x}
              renderInput={(params) => <TextField {...params} required label={t('deductions.employee')} />}
            />
            <TextField
              size="small"
              required
              type="number"
              label={t('deductions.advance.amount')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              slotProps={{ htmlInput: { min: 1, step: '0.01', dir: 'ltr' }, input: { endAdornment: <InputAdornment position="end">{t('deductions.sar')}</InputAdornment> } }}
            />
            <TextField select size="small" label={t('deductions.advance.months')} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {Array.from({ length: Math.max(maxMonths, months) }, (_, i) => i + 1).map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label={t('deductions.advance.firstPeriod')} value={first} onChange={(e) => setFirst(e.target.value)}>
              {periods.map((p) => (
                <MenuItem key={p} value={p}>
                  {monthName(p)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ bgcolor: '#F8FAFC', border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.5 }}>
            {!input ? (
              <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('deductions.advance.pick')}</Typography>
            ) : !preview ? (
              <LinearProgress />
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                  {(
                    [
                      [t('deductions.advance.salary'), preview.salary],
                      [t('deductions.advance.cap', { percent: capPercent ?? '—' }), preview.cap],
                      [t('deductions.advance.installment'), preview.installment],
                    ] as const
                  ).map(([l, v]) => (
                    <Box key={l}>
                      <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{l}</Typography>
                      <Typography component="div" sx={{ fontWeight: 700, fontSize: 17 }} title={v === null ? t('deductions.advance.hidden') : undefined}>
                        <Money value={v} />
                      </Typography>
                    </Box>
                  ))}
                  <Box>
                    <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{t('deductions.advance.monthShare')}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: 17, color: preview.needsAboveCap.includes('month_cap') ? hr.warning : hr.text }} title={preview.monthShare === null ? t('deductions.advance.hidden') : undefined}>
                      <bdi>{preview.monthShare === null ? '—' : `${preview.monthShare}%`}</bdi>
                    </Typography>
                  </Box>
                </Box>
                <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.25, mt: 1 }}>
                  {checks.map(([l, ok]) => (
                    <Typography key={l} sx={{ fontSize: 12, color: ok ? hr.success : hr.danger, display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      {ok ? <CheckIcon sx={{ fontSize: 14 }} /> : '✕'} {l}
                    </Typography>
                  ))}
                </Stack>
                <Typography sx={{ fontSize: 11.5, color: hr.textMuted, mt: 0.5 }}>{t('deductions.monthCapNote')}</Typography>
                {blocking.map((p) => (
                  <Alert key={p} severity="error" sx={{ mt: 1, py: 0 }}>
                    {t(`deductions.advance.problems.${p}`)}
                  </Alert>
                ))}
                {preview.needsAboveCap.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 1, py: 0, '& .MuiAlert-message': { width: '100%' } }}>
                    {preview.needsAboveCap.map((c) => t(`deductions.aboveCap.${c}`)).join(' ')}
                    <FormControlLabel sx={{ display: 'flex', mt: 0.25 }} control={<Checkbox size="small" checked={aboveCap} onChange={(e) => setAboveCap(e.target.checked)} />} label={t('deductions.aboveCap.ask')} />
                  </Alert>
                )}
              </>
            )}
          </Box>
          <TextField size="small" required multiline minRows={2} label={t('deductions.advance.reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          {preview && !amend && <Alert severity="info" sx={{ py: 0 }}>{preview.managerLinked ? t('deductions.advance.route.manager', { name: preview.managerName }) : t('deductions.advance.route.hr')}</Alert>}
          {amend && <Alert severity="info" sx={{ py: 0 }}>{t('deductions.amend.advanceHint')}</Alert>}
          {amend && (
            <TextField size="small" required multiline minRows={2} label={t('deductions.amend.reason')} value={amendReason} onChange={(e) => setAmendReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          )}
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" startIcon={amend ? <EditNoteOutlinedIcon /> : <SendOutlinedIcon />} disabled={busy || !canSend || (amend && !amendReason.trim())} onClick={() => void send()}>
            {amend ? t('deductions.amend.save') : t('deductions.send')}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

export function AdvancesTable({ rows, showEmployee = true, onOpen }: { rows: AdvanceRow[]; showEmployee?: boolean; onOpen: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const monthName = useMonthName();
  if (rows.length === 0) return <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('deductions.advance.none')}</Typography>;
  return (
    <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
      <Table size="small" sx={{ '& td': { height: 46, fontVariantNumeric: 'tabular-nums' }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700, color: '#334155' } }}>
        <TableHead>
          <TableRow>
            {showEmployee && <TableCell>{t('deductions.employee')}</TableCell>}
            <TableCell>{t('deductions.cols.no')}</TableCell>
            <TableCell>{t('deductions.advance.amount')}</TableCell>
            <TableCell>{t('deductions.advance.months')}</TableCell>
            <TableCell>{t('deductions.advance.firstPeriod')}</TableCell>
            <TableCell>{t('deductions.advance.remaining')}</TableCell>
            <TableCell>{t('deductions.cols.status')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(r.id)}>
              {showEmployee && (
                <TableCell>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                    <HrAvatar name={r.employeeName} />
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{r.employeeName}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{(ar ? r.departmentAr : r.departmentEn) ?? '—'}</Typography>
                    </Box>
                  </Stack>
                </TableCell>
              )}
              <TableCell sx={{ fontWeight: 700 }}>
                <RouterLink to={`/hr/advances/${r.id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <bdi>{r.advanceNo}</bdi>
                </RouterLink>
              </TableCell>
              <TableCell>
                <Money value={r.amount} strong />
                {r.aboveCap && <Typography sx={{ fontSize: 11, color: hr.warning }}>{t('deductions.aboveCap.badge')}</Typography>}
              </TableCell>
              <TableCell>{r.months}</TableCell>
              <TableCell>{monthName(r.firstPeriod)}</TableCell>
              <TableCell>
                <Money value={r.status === 'Rejected' ? null : r.remaining} />
              </TableCell>
              <TableCell>
                <AdvanceStatusBadge status={r.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

type View = 'all' | 'pending' | 'disburse' | 'open';

/** Advances: the cards, the tabs (all, waiting for approval, to be paid, open) and the table. */
export function AdvancesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const monthName = useMonthName();
  const { can } = useSession();
  const [view, setView] = useState<View>('all');
  const [kpis, setKpis] = useState<AdvanceKpis | null>(null);
  const [rows, setRows] = useState<AdvanceRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const loadKpis = useCallback(() => deductionsApi.advanceKpis().then(setKpis).catch((f) => setError(errorKey(f))), []);
  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);
  const load = useCallback(() => {
    setRows(null);
    setError(null);
    deductionsApi
      .advances({ tab: view, search: query })
      .then(setRows)
      .catch((f) => setError(errorKey(f)));
  }, [view, query]);
  useEffect(load, [load]);
  return (
    <HrScope>
      <HrPageHeader
        icon={<CreditCardOutlinedIcon />}
        title={t('deductions.advance.title')}
        subtitle={t('deductions.advance.intro')}
        actions={
          <>
            {can('deductions.view', true) && (
              <Button variant="outlined" startIcon={<SettingsOutlinedIcon />} onClick={() => navigate('/hr/deductions-settings')}>
                {t('deductions.settings.title')}
              </Button>
            )}
            {can('deductions.manage', true) && (
              <Button variant="contained" startIcon={<Add />} onClick={() => setAsking(true)}>
                {t('deductions.advance.new')}
              </Button>
            )}
          </>
        }
      />
      <Box sx={{ display: 'grid', gap: 1.5, mb: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
        {kpis ? (
          <>
            <Kpi accent="violet" icon={<SavingsOutlinedIcon />} label={t('deductions.kpi.open')} value={<Money value={kpis.openBalance} />} parts={[[t('deductions.kpi.employees'), kpis.openEmployees]]} />
            <Kpi accent="blue" icon={<HourglassEmptyOutlinedIcon />} label={t('deductions.kpi.pending')} value={kpis.pending} parts={[[t('deductions.kpi.amount'), <Money key="a" value={kpis.pendingAmount} />], [t('deductions.kpi.toDisburse'), kpis.toDisburse]]} />
            <Kpi accent="green" icon={<PaymentsOutlinedIcon />} label={t('deductions.kpi.paid')} value={<Money value={kpis.paidThisMonth} />} parts={[[t('deductions.kpi.count'), kpis.paidThisMonthCount]]} />
            <Kpi accent="amber" icon={<UpcomingOutlinedIcon />} label={t('deductions.kpi.due', { month: monthName(kpis.nextPeriod) })} value={<Money value={kpis.dueNextMonth} />} parts={[[t('deductions.kpi.dueNote'), '']]} />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="rounded" height={118} />)
        )}
      </Box>
      <Box sx={{ ...(hrCard as object), px: 2, pb: 2 }}>
        <Tabs value={view} onChange={(_, v: View) => setView(v)} variant="scrollable" sx={{ borderBottom: `1px solid ${hr.border}`, mb: 1.5 }}>
          <Tab value="all" label={t('deductions.advance.tabs.all')} />
          <Tab value="pending" label={t('deductions.advance.tabs.pending', { count: kpis?.pending ?? 0 })} />
          <Tab value="disburse" label={t('deductions.advance.tabs.disburse', { count: kpis?.toDisburse ?? 0 })} />
          <Tab value="open" label={t('deductions.advance.tabs.open')} />
        </Tabs>
        <TextField
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('deductions.search')}
          sx={{ width: { xs: '100%', md: 300 }, mb: 1.5 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': t('deductions.search') } }}
        />
        {error ? (
          <Stack sx={{ gap: 1, alignItems: 'flex-start' }}>
            <ErrorMessage messageKey={error} />
            <Button variant="outlined" size="small" onClick={load}>
              {t('deductions.retry')}
            </Button>
          </Stack>
        ) : !rows ? (
          <Stack sx={{ gap: 0.75 }}>
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="rounded" height={42} />)}
          </Stack>
        ) : rows.length === 0 ? (
          <HrEmptyState icon={<CreditCardOutlinedIcon />} title={query ? t('deductions.noResults') : t('deductions.advance.none')} hint={query ? undefined : t('deductions.advance.noneHint')} />
        ) : (
          <AdvancesTable rows={rows} onOpen={(id) => navigate(`/hr/advances/${id}`)} />
        )}
      </Box>
      {asking && <AdvanceDialog onClose={() => setAsking(false)} onSent={(id) => navigate(`/hr/advances/${id}`)} />}
    </HrScope>
  );
}

/** A note for an early settlement or a postponed installment. */
export function NoteDialog({ title, hint, onClose, onSave }: { title: string; hint: string; onClose: () => void; onSave: (note: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(note.trim());
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{hint}</Typography>
          <TextField size="small" required multiline minRows={2} label={t('deductions.note')} value={note} onChange={(e) => setNote(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !note.trim()} onClick={() => void save()}>
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

const methods = ['Transfer', 'Cash', 'Cheque'] as const;

/** Finance records the payment: the date, the method and its reference. */
function DisburseDialog({ advance, onClose, onSaved }: { advance: AdvanceRow; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>('Transfer');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await deductionsApi.disburse(advance.id, { paidOn, method, reference: reference.trim() || null });
      onSaved();
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('deductions.disburse.title', { no: advance.advanceNo })}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Typography sx={{ fontSize: 13 }}>
            {t('deductions.disburse.amount')} <Money value={advance.amount} strong />
          </Typography>
          <TextField size="small" type="date" label={t('deductions.disburse.paidOn')} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select size="small" label={t('deductions.disburse.method')} value={method} onChange={(e) => setMethod(e.target.value)}>
            {methods.map((m) => (
              <MenuItem key={m} value={m}>
                {t(`deductions.disburse.methods.${m}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label={t('deductions.disburse.reference')} value={reference} onChange={(e) => setReference(e.target.value)} slotProps={{ htmlInput: { maxLength: 100, dir: 'ltr' } }} />
          <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{t('deductions.disburse.note')}</Typography>
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" startIcon={<PaymentsOutlinedIcon />} disabled={busy || !paidOn} onClick={() => void save()}>
            {t('deductions.disburse.save')}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" sx={{ gap: 2, borderBottom: `1px solid #EEF2F7`, py: 1, justifyContent: 'space-between' }}>
      <Typography sx={{ color: hr.textMuted, fontSize: 13 }}>{label}</Typography>
      <Typography component="div" sx={{ fontWeight: 600, fontSize: 13.5, textAlign: 'end' }}>
        {children}
      </Typography>
    </Stack>
  );
}

/** An advance: its approval bar, its data, then (once approved) the deduction schedule, the payment, and the postponement or the early settlement. */
export function AdvancePage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const navigate = useNavigate();
  const monthName = useMonthName();
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const [d, setD] = useState<AdvanceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'edit' | 'amend' | 'cancelApproved' | 'disburse' | 'settle' | Installment>(null);
  const approval = useRecordApproval(d?.approval?.instanceId);
  useCrumb(d?.advance.advanceNo, `/hr/advances/${id}`);
  const reload = useCallback(async () => {
    try {
      setD(await deductionsApi.advance(id));
      setError(null);
    } catch (f) {
      setError(errorKey(f));
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
  const a = d.advance;
  const open = a.status === 'Disbursed' || a.status === 'Approved';
  const done = () => {
    setDialog(null);
    void reload();
    void approval.reload();
  };
  return (
    <HrScope>
      <HrPageHeader
        icon={<CreditCardOutlinedIcon />}
        title={t('deductions.advance.pageTitle', { amount: sar(a.amount) })}
        status={<AdvanceStatusBadge status={a.status} />}
        reference={a.advanceNo}
        subtitle={
          <>
            <RouterLink to={`/hr/employees/${a.employeeId}`}>{a.employeeName}</RouterLink>
            {(ar ? a.departmentAr : a.departmentEn) && ` · ${ar ? a.departmentAr : a.departmentEn}`} · {t('deductions.advance.over', { months: a.months, month: monthName(a.firstPeriod) })}
          </>
        }
        actions={
          <>
            {a.status === 'Returned' && can('deductions.manage', true) && (
              <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={() => setDialog('edit')}>
                {t('deductions.resubmit')}
              </Button>
            )}
            {d.canAmend && (
              <Button variant="outlined" startIcon={<EditNoteOutlinedIcon />} onClick={() => setDialog('amend')}>
                {t('deductions.amend.action')}
              </Button>
            )}
            {d.canCancelApproved && (
              <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => setDialog('cancelApproved')}>
                {t('deductions.amend.cancelAdvance')}
              </Button>
            )}
            {a.status === 'Approved' && can('deductions.disburse', true) && (
              <Button variant="contained" startIcon={<PaymentsOutlinedIcon />} onClick={() => setDialog('disburse')}>
                {t('deductions.disburse.action')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') }} />} onClick={() => navigate(-1)}>
              {t('common.back')}
            </Button>
          </>
        }
      />
      <ErrorMessage messageKey={error} />
      {d.approval && <ApprovalBar status={d.approval} detail={approval.detail} onChanged={done} />}
      {d.amendedAt && a.status === 'Approved' && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {t('deductions.amend.amendedBy', { by: d.amendedByName, date: date(d.amendedAt) })} — {d.amendNote}
        </Alert>
      )}
      {d.canceledAt && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t('deductions.amend.canceledBy', { by: d.canceledByName, date: date(d.canceledAt) })} — {d.lastComment}
        </Alert>
      )}
      {d.lastComment && (a.status === 'Returned' || a.status === 'Rejected') && (
        <Alert severity={a.status === 'Rejected' ? 'error' : 'warning'} sx={{ mb: 1.5 }}>
          {d.lastComment}
        </Alert>
      )}
      {a.aboveCap && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t('deductions.aboveCap.approved')}
        </Alert>
      )}
      <Box sx={{ ...(hrCard as object), p: 2, mb: 2 }}>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('deductions.advance.dataTitle')}</Typography>
        <Box sx={{ display: 'grid', columnGap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' } }}>
          <Row label={t('deductions.employee')}>
            <RouterLink to={`/hr/employees/${a.employeeId}`}>{a.employeeName}</RouterLink>
          </Row>
          <Row label={t('deductions.advance.department')}>{(ar ? a.departmentAr : a.departmentEn) ?? '—'}</Row>
          <Row label={t('deductions.advance.amount')}>
            <Money value={a.amount} strong />
          </Row>
          <Row label={t('deductions.advance.months')}>{a.months}</Row>
          <Row label={t('deductions.advance.firstPeriod')}>{monthName(a.firstPeriod)}</Row>
          <Row label={t('deductions.advance.installment')}>
            <Money value={Math.floor((a.amount / a.months) * 100) / 100} />
          </Row>
          {d.salaryAtRequest !== null && (
            <Row label={t('deductions.advance.salaryAtRequest')}>
              <Money value={d.salaryAtRequest} />
            </Row>
          )}
          <Row label={t('deductions.aboveCap.badge')}>{a.aboveCap ? t('common.yes') : t('deductions.advance.withinCap')}</Row>
          <Row label={t('deductions.requested')}>
            {d.createdByName} · <bdi>{date(a.createdAt)}</bdi>
          </Row>
        </Box>
        <Row label={t('deductions.advance.reason')}>{d.reason}</Row>
      </Box>
      {d.installments.length === 0 ? (
        <Box sx={{ ...(hrCard as object), p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{t('deductions.schedule.title')}</Typography>
          <Typography sx={{ fontSize: 13, color: hr.textMuted }}>
            {a.status === 'Rejected' ? t('deductions.schedule.rejected') : t('deductions.schedule.afterApproval', { amount: sar(Math.floor((a.amount / a.months) * 100) / 100) })}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, alignItems: 'start' }}>
          <Box sx={{ ...(hrCard as object), p: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 1.25 }}>{t('deductions.schedule.title')}</Typography>
              <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
                <Table size="small" sx={{ '& td': { height: 44, fontVariantNumeric: 'tabular-nums' }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('deductions.schedule.period')}</TableCell>
                      <TableCell>{t('deductions.schedule.amount')}</TableCell>
                      <TableCell>{t('deductions.schedule.deducted')}</TableCell>
                      <TableCell>{t('deductions.cols.status')}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {d.installments.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{monthName(i.period)}</TableCell>
                        <TableCell>
                          <Money value={i.amount} />
                        </TableCell>
                        <TableCell>{i.deducted > 0 ? <Money value={i.deducted} /> : '—'}</TableCell>
                        <TableCell>
                          <HrStatusBadge label={t(`deductions.installmentStatus.${i.status}`)} {...installmentLook[i.status]} />
                          {i.note && <Typography sx={{ fontSize: 11, color: hr.textMuted, mt: 0.25 }}>{i.note}</Typography>}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'end' }}>
                          {open && i.status === 'Scheduled' && i.deducted === 0 && can('deductions.manage', true) && (
                            <Button size="small" startIcon={<EventRepeatOutlinedIcon />} onClick={() => setDialog(i)}>
                              {t('deductions.schedule.postpone')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: 1 }}>{t('deductions.monthCapNote')}</Typography>
          </Box>
          <Box sx={{ ...(hrCard as object), p: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('deductions.payment.title')}</Typography>
            <Row label={t('deductions.payment.paidOn')}>{d.paidOn ? <bdi>{date(d.paidOn)}</bdi> : t('deductions.payment.notYet')}</Row>
            <Row label={t('deductions.payment.method')}>{d.paymentMethod ? t(`deductions.disburse.methods.${d.paymentMethod}`, { defaultValue: d.paymentMethod }) : '—'}</Row>
            <Row label={t('deductions.payment.reference')}>{d.paymentReference ? <bdi dir="ltr">{d.paymentReference}</bdi> : '—'}</Row>
            <Row label={t('deductions.payment.paidBy')}>{d.paidBy ?? '—'}</Row>
            <Row label={t('deductions.advance.remaining')}>
              <Money value={a.remaining} strong />
            </Row>
            {a.status === 'Disbursed' && can('deductions.disburse', true) && (
              <Button sx={{ mt: 1.5 }} variant="outlined" startIcon={<TaskAltOutlinedIcon />} onClick={() => setDialog('settle')}>
                {t('deductions.settle.action')}
              </Button>
            )}
          </Box>
        </Box>
      )}
      {dialog === 'edit' && <AdvanceDialog advance={d} onClose={() => setDialog(null)} onSent={done} />}
      {dialog === 'amend' && <AdvanceDialog advance={d} amend onClose={() => setDialog(null)} onSent={done} />}
      {dialog === 'cancelApproved' && (
        <NoteDialog
          title={t('deductions.amend.cancelAdvance')}
          hint={t('deductions.amend.cancelAdvanceHint')}
          onClose={() => setDialog(null)}
          onSave={async (note) => {
            await deductionsApi.cancelApprovedAdvance(a.id, note);
            done();
          }}
        />
      )}
      {dialog === 'disburse' && <DisburseDialog advance={a} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog === 'settle' && (
        <NoteDialog
          title={t('deductions.settle.title')}
          hint={t('deductions.settle.hint', { amount: sar(a.remaining) })}
          onClose={() => setDialog(null)}
          onSave={async (note) => {
            await deductionsApi.settle(a.id, note);
            done();
          }}
        />
      )}
      {dialog && typeof dialog === 'object' && (
        <NoteDialog
          title={t('deductions.schedule.postponeTitle', { month: monthName(dialog.period) })}
          hint={t('deductions.schedule.postponeHint')}
          onClose={() => setDialog(null)}
          onSave={async (note) => {
            await deductionsApi.postpone(a.id, dialog.id, note);
            done();
          }}
        />
      )}
    </HrScope>
  );
}
