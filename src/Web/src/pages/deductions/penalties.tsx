import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import Add from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
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
import { periodOf } from '../../api/attendance';
import { errorKey } from '../../api/auth';
import { deductionsApi, type PenaltyCategory, type PenaltyDetail, type PenaltyInput, type PenaltyPreview, type PenaltyRow, type PenaltyStatus, type PenaltyType } from '../../api/deductions';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useMonthName } from '../attendance/AttendanceMonthPage';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { Money, NoteDialog, usePeople, usePeriods, type Person } from './advances';
import { DateField } from '../../components/DateField';

const look: Record<PenaltyStatus, { color: string; tint: string }> = {
  InApproval: { color: hr.primary, tint: '#EFF6FF' },
  Returned: { color: '#B45309', tint: '#FEF3C7' },
  Rejected: { color: '#B91C1C', tint: '#FEE2E2' },
  Applied: { color: hr.success, tint: '#D1FAE5' },
  Cancelled: { color: '#B91C1C', tint: '#FEE2E2' },
};

export function PenaltyStatusBadge({ status }: { status: PenaltyStatus }) {
  const { t } = useTranslation();
  return <HrStatusBadge label={t(`deductions.penaltyStatus.${status}`)} {...look[status]} />;
}

/** What the penalty takes: a warning, days of wage, an amount, or days of suspension. */
export function PenaltyValue({ row }: { row: PenaltyRow }) {
  const { t } = useTranslation();
  if (row.effect === 'Warning') return <>{t('deductions.penalty.noDeduction')}</>;
  if (row.effect === 'DeductAmount') return <Money value={row.amount} strong />;
  return <bdi>{t(row.effect === 'Suspension' ? 'deductions.penalty.suspensionValue' : 'deductions.penalty.daysValue', { days: row.days ?? 0 })}</bdi>;
}

const kindName = (r: PenaltyRow, t: (k: string) => string, ar: boolean) => (r.category === 'Other' ? t('deductions.other.kind') : ((ar ? r.typeAr : r.typeEn) ?? t(`deductions.effects.${r.effect}`)));

/**
 * A violation and its penalty (the type gives the effect: a warning, days of wage, an amount, a suspension) or another
 * deduction (damage, lost custody): the employee, the date, the description and the employee's statement, the payroll
 * month, with the legal limits and the month's deductions shown before sending.
 */
/** A new penalty or deduction, a returned one sent again, or (amend) an applied one changed before it is deducted, with the reason. */
export function PenaltyDialog({
  category,
  employee,
  penalty,
  amend = false,
  onClose,
  onSent,
}: {
  category: PenaltyCategory;
  employee?: Person;
  penalty?: PenaltyDetail;
  amend?: boolean;
  onClose: () => void;
  onSent: (id: string) => void;
}) {
  const [amendReason, setAmendReason] = useState('');
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const monthName = useMonthName();
  const p = penalty?.penalty;
  const other = category === 'Other';
  const [who, setWho] = useState<Person | null>(employee ?? (p ? { id: p.employeeId, nameAr: p.employeeName, nameEn: p.employeeName } : null));
  const [search, setSearch] = useState('');
  const people = usePeople(search, !employee && !penalty);
  const [types, setTypes] = useState<PenaltyType[]>([]);
  const [typeId, setTypeId] = useState('');
  const [day, setDay] = useState(p?.violationDate ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(p?.description ?? '');
  const [statement, setStatement] = useState(penalty?.statement ?? '');
  const [days, setDays] = useState(p?.days ? String(p.days) : '1');
  const [amount, setAmount] = useState(p?.amount ? String(p.amount) : '');
  const periods = usePeriods(p?.period);
  const [period, setPeriod] = useState(p?.period ?? periodOf(new Date()));
  const [aboveCap, setAboveCap] = useState(p?.aboveCap ?? false);
  const [preview, setPreview] = useState<PenaltyPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (other) return;
    deductionsApi
      .setup()
      .then((s) => {
        const active = s.penaltyTypes.filter((x) => x.isActive);
        setTypes(active);
        const current = p ? active.find((x) => x.id === p.penaltyTypeId) : undefined;
        setTypeId((current ?? active.find((x) => x.effect === 'DeductDays') ?? active[0])?.id ?? '');
      })
      .catch(() => setTypes([]));
  }, [other]);
  const effect = other ? 'DeductAmount' : (types.find((x) => x.id === typeId)?.effect ?? null);
  const needsDays = effect === 'DeductDays' || effect === 'Suspension';
  const needsAmount = effect === 'DeductAmount';
  const input: PenaltyInput | null =
    who && day && effect
      ? {
          employeeId: who.id,
          category,
          penaltyTypeId: other ? null : typeId,
          violationDate: day,
          description: description.trim(),
          statement: statement.trim() || null,
          days: needsDays ? Number(days) || null : null,
          amount: needsAmount ? Number(amount) || null : null,
          period,
          aboveCap,
        }
      : null;
  const key = input ? JSON.stringify({ ...input, description: input.description !== '', statement: null }) : '';
  useEffect(() => {
    if (!input) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      deductionsApi
        .previewPenalty({ ...input, description: input.description || '—' }, p?.id)
        .then((x) => (setPreview(x), setError(null)))
        .catch((f) => (setPreview(null), setError(errorKey(f))));
    }, 300);
    return () => clearTimeout(timer);
  }, [key]);
  const send = async () => {
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      if (p && amend) {
        const { employeeId: _employee, category: _category, ...fields } = input;
        await deductionsApi.amendPenalty(p.id, { ...fields, amendReason: amendReason.trim() });
        onSent(p.id);
        return;
      }
      const r = p ? await deductionsApi.resubmitPenalty(p.id, input) : await deductionsApi.sendPenalty(input);
      onSent(r.id);
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };
  const blocking = preview?.problems.filter((x) => x !== 'above_cap') ?? [];
  const canSend = Boolean(input && description.trim() && preview && blocking.length === 0 && (preview.needsAboveCap.length === 0 || aboveCap));
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{p ? (amend ? t('deductions.amend.penaltyTitle', { no: p.penaltyNo }) : p.penaltyNo) : other ? t('deductions.other.new') : t('deductions.penalty.new')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Autocomplete
              size="small"
              disabled={Boolean(employee || penalty)}
              options={people}
              value={who}
              onChange={(_, v) => setWho(v)}
              onInputChange={(_, v) => setSearch(v)}
              getOptionLabel={(o) => (ar ? o.nameAr : o.nameEn)}
              isOptionEqualToValue={(x, y) => x.id === y.id}
              filterOptions={(x) => x}
              renderInput={(params) => <TextField {...params} required label={t('deductions.employee')} />}
            />
            <DateField size="small" required label={other ? t('deductions.other.date') : t('deductions.penalty.date')} value={day} onChange={(e) => setDay(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>
          <TextField size="small" required label={other ? t('deductions.other.description') : t('deductions.penalty.description')} value={description} onChange={(e) => setDescription(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          {!other && <TextField size="small" multiline minRows={2} label={t('deductions.penalty.statement')} value={statement} onChange={(e) => setStatement(e.target.value)} slotProps={{ htmlInput: { maxLength: 1000 } }} />}
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: other ? '1fr 1fr' : '1fr 1fr 1fr' } }}>
            {!other && (
              <TextField select size="small" required label={t('deductions.penalty.type')} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                {types.map((x) => (
                  <MenuItem key={x.id} value={x.id}>
                    {ar ? x.nameAr : x.nameEn}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {needsDays && (
              <TextField size="small" required type="number" label={effect === 'Suspension' ? t('deductions.penalty.suspensionDays') : t('deductions.penalty.daysLabel')} value={days} onChange={(e) => setDays(e.target.value)} slotProps={{ htmlInput: { min: 0.5, step: 0.5, dir: 'ltr' } }} />
            )}
            {needsAmount && (
              <TextField
                size="small"
                required
                type="number"
                label={t('deductions.penalty.amount')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                slotProps={{ htmlInput: { min: 1, step: '0.01', dir: 'ltr' }, input: { endAdornment: <InputAdornment position="end">{t('deductions.sar')}</InputAdornment> } }}
              />
            )}
            {effect !== 'Warning' && (
              <TextField select size="small" label={t('deductions.penalty.period')} value={period} onChange={(e) => setPeriod(e.target.value)}>
                {periods.map((x) => (
                  <MenuItem key={x} value={x}>
                    {monthName(x)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Box>
          {input && (
            <Box sx={{ bgcolor: '#F8FAFC', border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.5 }}>
              {!preview ? (
                <LinearProgress />
              ) : (
                <>
                  <Typography sx={{ fontSize: 12.5 }}>
                    {effect === 'Warning'
                      ? t('deductions.penalty.warningNote')
                      : effect === 'DeductDays'
                        ? t('deductions.penalty.limits', { perViolation: preview.maxDaysPerViolation, perMonth: preview.maxDaysPerMonth, used: preview.daysThisMonth, month: monthName(period) })
                        : t('deductions.penalty.inMonth', { month: monthName(period) })}
                  </Typography>
                  {preview.monthCap !== null && preview.monthDeductions !== null && effect !== 'Warning' && (
                    <Typography component="div" sx={{ fontSize: 12, color: hr.textMuted, mt: 0.5 }}>
                      {t('deductions.penalty.monthTotal')} <Money value={preview.monthDeductions} /> / <Money value={preview.monthCap} />
                    </Typography>
                  )}
                  {blocking.map((x) => (
                    <Alert key={x} severity="error" sx={{ mt: 1, py: 0 }}>
                      {t(`deductions.penalty.problems.${x}`)}
                    </Alert>
                  ))}
                  {preview.needsAboveCap.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 1, py: 0, '& .MuiAlert-message': { width: '100%' } }}>
                      {t('deductions.aboveCap.month_cap')}
                      <FormControlLabel sx={{ display: 'flex', mt: 0.25 }} control={<Checkbox size="small" checked={aboveCap} onChange={(e) => setAboveCap(e.target.checked)} />} label={t('deductions.aboveCap.ask')} />
                    </Alert>
                  )}
                </>
              )}
            </Box>
          )}
          <Alert severity="info" sx={{ py: 0 }}>
            {amend ? t('deductions.amend.penaltyHint') : other ? t('deductions.other.route') : t('deductions.penalty.route')}
          </Alert>
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

export function PenaltiesTable({ rows, showEmployee = true, onOpen }: { rows: PenaltyRow[]; showEmployee?: boolean; onOpen: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { date } = useCommercialFormat();
  const monthName = useMonthName();
  if (rows.length === 0) return <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('deductions.penalty.none')}</Typography>;
  return (
    <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
      <Table size="small" sx={{ '& td': { height: 46, fontVariantNumeric: 'tabular-nums' }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700, color: '#334155' } }}>
        <TableHead>
          <TableRow>
            {showEmployee && <TableCell>{t('deductions.employee')}</TableCell>}
            <TableCell>{t('deductions.cols.no')}</TableCell>
            <TableCell>{t('deductions.penalty.kind')}</TableCell>
            <TableCell>{t('deductions.penalty.description')}</TableCell>
            <TableCell>{t('deductions.cols.date')}</TableCell>
            <TableCell>{t('deductions.penalty.value')}</TableCell>
            <TableCell>{t('deductions.penalty.period')}</TableCell>
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
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{r.employeeName}</Typography>
                  </Stack>
                </TableCell>
              )}
              <TableCell sx={{ fontWeight: 700 }}>
                <RouterLink to={`/hr/penalties/${r.id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <bdi>{r.penaltyNo}</bdi>
                </RouterLink>
              </TableCell>
              <TableCell>{kindName(r, t, ar)}</TableCell>
              <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description}>
                {r.description}
              </TableCell>
              <TableCell>{date(r.violationDate)}</TableCell>
              <TableCell>
                <PenaltyValue row={r} />
              </TableCell>
              <TableCell>{r.effect === 'Warning' ? '—' : monthName(r.period)}</TableCell>
              <TableCell>
                <PenaltyStatusBadge status={r.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

type View = 'all' | 'pending' | 'warnings' | 'deductions';

/** Penalties and other deductions: the tabs (all, waiting for approval, warnings, deductions) and the table. */
export function PenaltiesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const [view, setView] = useState<View>('all');
  const [rows, setRows] = useState<PenaltyRow[] | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<PenaltyCategory | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    deductionsApi
      .penalties({ tab: 'pending' })
      .then((r) => setPending(r.length))
      .catch(() => setPending(null));
  }, []);
  const load = useCallback(() => {
    setRows(null);
    setError(null);
    deductionsApi
      .penalties({ tab: view, search: query })
      .then(setRows)
      .catch((f) => setError(errorKey(f)));
  }, [view, query]);
  useEffect(load, [load]);
  return (
    <HrScope>
      <HrPageHeader
        icon={<BalanceOutlinedIcon />}
        title={t('deductions.penalty.title')}
        subtitle={t('deductions.penalty.intro')}
        actions={
          <>
            {can('deductions.view', true) && (
              <Button variant="outlined" startIcon={<SettingsOutlinedIcon />} onClick={() => navigate('/hr/deductions-settings')}>
                {t('deductions.settings.titleLimits')}
              </Button>
            )}
            {can('deductions.manage', true) && (
              <>
                <Button variant="outlined" startIcon={<Add />} onClick={() => setAsking('Other')}>
                  {t('deductions.other.new')}
                </Button>
                <Button variant="contained" startIcon={<Add />} onClick={() => setAsking('Penalty')}>
                  {t('deductions.penalty.new')}
                </Button>
              </>
            )}
          </>
        }
      />
      <Box sx={{ ...(hrCard as object), px: 2, pb: 2 }}>
        <Tabs value={view} onChange={(_, v: View) => setView(v)} variant="scrollable" sx={{ borderBottom: `1px solid ${hr.border}`, mb: 1.5 }}>
          <Tab value="all" label={t('deductions.penalty.tabs.all')} />
          <Tab value="pending" label={t('deductions.penalty.tabs.pending', { count: pending ?? 0 })} />
          <Tab value="warnings" label={t('deductions.penalty.tabs.warnings')} />
          <Tab value="deductions" label={t('deductions.penalty.tabs.deductions')} />
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
          <HrEmptyState icon={<BalanceOutlinedIcon />} title={query ? t('deductions.noResults') : t('deductions.penalty.none')} hint={query ? undefined : t('deductions.penalty.noneHint')} />
        ) : (
          <PenaltiesTable rows={rows} onOpen={(id) => navigate(`/hr/penalties/${id}`)} />
        )}
      </Box>
      {asking && <PenaltyDialog category={asking} onClose={() => setAsking(null)} onSent={(id) => navigate(`/hr/penalties/${id}`)} />}
    </HrScope>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" sx={{ gap: 2, borderBottom: `1px solid #EEF2F7`, pb: 1 }}>
      <Typography sx={{ width: 150, flex: '0 0 auto', color: hr.textMuted, fontSize: 13 }}>{label}</Typography>
      <Typography component="div" sx={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'pre-wrap' }}>
        {children}
      </Typography>
    </Stack>
  );
}

/** A penalty or another deduction: its approval bar, the violation, the statement and the decision, and «send again» once returned. */
export function PenaltyPage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const navigate = useNavigate();
  const monthName = useMonthName();
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const [d, setD] = useState<PenaltyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [amending, setAmending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const approval = useRecordApproval(d?.approval?.instanceId);
  useCrumb(d?.penalty.penaltyNo, `/hr/penalties/${id}`);
  const reload = useCallback(async () => {
    try {
      setD(await deductionsApi.penalty(id));
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
  const p = d.penalty;
  const other = p.category === 'Other';
  const done = () => {
    setEditing(false);
    setAmending(false);
    setCancelling(false);
    void reload();
    void approval.reload();
  };
  return (
    <HrScope>
      <HrPageHeader
        icon={<BalanceOutlinedIcon />}
        title={kindName(p, t, ar)}
        status={<PenaltyStatusBadge status={p.status} />}
        reference={p.penaltyNo}
        subtitle={
          <>
            <RouterLink to={`/hr/employees/${p.employeeId}`}>{p.employeeName}</RouterLink> · <bdi>{date(p.violationDate)}</bdi>
          </>
        }
        actions={
          <>
            {p.status === 'Returned' && can('deductions.manage', true) && (
              <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={() => setEditing(true)}>
                {t('deductions.resubmit')}
              </Button>
            )}
            {d.canAmend && (
              <Button variant="outlined" startIcon={<EditNoteOutlinedIcon />} onClick={() => setAmending(true)}>
                {t('deductions.amend.action')}
              </Button>
            )}
            {d.canCancelApproved && (
              <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => setCancelling(true)}>
                {other ? t('deductions.amend.cancelOther') : t('deductions.amend.cancelPenalty')}
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
      {d.amendedAt && p.status === 'Applied' && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {t('deductions.amend.amendedBy', { by: d.amendedByName, date: date(d.amendedAt) })} — {d.amendNote}
        </Alert>
      )}
      {d.canceledAt && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t('deductions.amend.canceledBy', { by: d.canceledByName, date: date(d.canceledAt) })} — {d.lastComment}
        </Alert>
      )}
      {d.lastComment && (p.status === 'Returned' || p.status === 'Rejected') && (
        <Alert severity={p.status === 'Rejected' ? 'error' : 'warning'} sx={{ mb: 1.5 }}>
          {d.lastComment}
        </Alert>
      )}
      <Box sx={{ ...(hrCard as object), p: 2, display: 'grid', gap: 1.25, maxWidth: 820 }}>
        <Row label={t('deductions.employee')}>{p.employeeName}</Row>
        <Row label={other ? t('deductions.other.description') : t('deductions.penalty.description')}>{p.description}</Row>
        {!other && <Row label={t('deductions.penalty.statement')}>{d.statement ?? '—'}</Row>}
        <Row label={t('deductions.penalty.kind')}>{kindName(p, t, ar)}</Row>
        <Row label={t('deductions.penalty.value')}>
          <PenaltyValue row={p} />
        </Row>
        {p.effect !== 'Warning' && <Row label={t('deductions.penalty.period')}>{monthName(p.period)}</Row>}
        {p.aboveCap && <Row label={t('deductions.aboveCap.badge')}>{t('deductions.aboveCap.approved')}</Row>}
        <Row label={t('deductions.requested')}>
          {d.createdByName} · <bdi>{date(p.createdAt)}</bdi>
        </Row>
        <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{p.effect === 'Warning' ? t('deductions.penalty.warningNote') : t('deductions.penalty.effectNote')}</Typography>
      </Box>
      {editing && <PenaltyDialog category={p.category} penalty={d} onClose={() => setEditing(false)} onSent={done} />}
      {amending && <PenaltyDialog category={p.category} penalty={d} amend onClose={() => setAmending(false)} onSent={done} />}
      {cancelling && (
        <NoteDialog
          title={other ? t('deductions.amend.cancelOther') : t('deductions.amend.cancelPenalty')}
          hint={t('deductions.amend.cancelPenaltyHint')}
          onClose={() => setCancelling(false)}
          onSave={async (note) => {
            await deductionsApi.cancelApprovedPenalty(p.id, note);
            done();
          }}
        />
      )}
    </HrScope>
  );
}
