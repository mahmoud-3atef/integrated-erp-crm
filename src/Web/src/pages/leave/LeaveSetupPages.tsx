import Add from '@mui/icons-material/Add';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
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
  InputAdornment,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { periodOf } from '../../api/attendance';
import { errorKey } from '../../api/auth';
import { daysText, leaveApi, leavePays, type BalanceRow, type LeaveSetup, type LeaveType, type LeaveTypeInput, type OpeningImport } from '../../api/leave';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrDrawer, HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { EmployeeLeavePanel, typeName } from './leave';

/** The balances of a type for every employee, the month's accrual, the year's carry-over and the opening balances' import. */
export function LeaveBalancesPage() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const navigate = useNavigate();
  const { can } = useSession();
  const [setup, setSetup] = useState<LeaveSetup | null>(null);
  const [typeId, setTypeId] = useState('');
  const [rows, setRows] = useState<BalanceRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<BalanceRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const manage = can('leave.manage', true);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    leaveApi
      .setup()
      .then((s) => (setSetup(s), setTypeId((v) => v || (s.types.find((x) => x.code === 'annual')?.id ?? ''))))
      .catch((f) => setError(errorKey(f)));
  }, []);
  useEffect(() => {
    if (!typeId) return;
    setRows(null);
    leaveApi
      .balances({ typeId, search: query })
      .then(setRows)
      .catch((f) => setError(errorKey(f)));
  }, [typeId, query, version]);

  const accrue = async () => {
    const period = periodOf(new Date());
    try {
      const r = await leaveApi.accrue(period);
      setNotice(t('leaveBalances.accrued', { period, employees: r.employees, days: daysText(r.days) }));
      setVersion((v) => v + 1);
    } catch (f) {
      setError(errorKey(f));
    }
  };
  const carry = async () => {
    const year = new Date().getFullYear() - 1;
    try {
      const r = await leaveApi.carryOver(year);
      setNotice(setup?.settings.carryOverLimit === null ? t('leaveBalances.noLimit') : t('leaveBalances.carried', { year, employees: r.employees, days: daysText(r.days) }));
      setVersion((v) => v + 1);
    } catch (f) {
      setError(errorKey(f));
    }
  };
  const balanceTypes = (setup?.types ?? []).filter((x) => x.hasBalance);

  return (
    <HrScope>
      <HrPageHeader
        icon={<BalanceOutlinedIcon />}
        title={t('leaveBalances.title')}
        subtitle={t('leaveBalances.intro')}
        actions={
          <>
            <Button variant="outlined" startIcon={<SettingsOutlinedIcon />} onClick={() => navigate('/hr/leave-types')}>
              {t('leaveBalances.types')}
            </Button>
            {manage && (
              <>
                <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => setImporting(true)}>
                  {t('leaveBalances.import')}
                </Button>
                <Button variant="outlined" onClick={() => void carry()}>
                  {t('leaveBalances.carryOver', { year: new Date().getFullYear() - 1 })}
                </Button>
                <Button variant="contained" startIcon={<PlayArrowOutlinedIcon />} onClick={() => void accrue()}>
                  {t('leaveBalances.accrue')}
                </Button>
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
      <Box sx={{ ...(hrCard as object), p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, mb: 1.5 }}>
          <TextField select size="small" label={t('leave.type')} value={typeId} onChange={(e) => setTypeId(e.target.value)} sx={{ width: { md: 220 } }}>
            {balanceTypes.map((x) => (
              <MenuItem key={x.id} value={x.id}>
                {typeName(x, ar)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('leave.search')}
            sx={{ width: { md: 300 } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': t('leave.search') } }}
          />
        </Stack>
        {!rows ? (
          <LinearProgress />
        ) : rows.length === 0 ? (
          <HrEmptyState icon={<BalanceOutlinedIcon />} title={t('leaveBalances.none')} />
        ) : (
          <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 680 }}>
            <Table size="small" stickyHeader sx={{ '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('leave.employee')}</TableCell>
                  <TableCell>{t('leaveBalances.cols.perYear')}</TableCell>
                  <TableCell>{t('leaveBalances.cols.opening')}</TableCell>
                  <TableCell>{t('leaveBalances.cols.accrued')}</TableCell>
                  <TableCell>{t('leaveBalances.cols.used')}</TableCell>
                  <TableCell>{t('leaveBalances.cols.reserved')}</TableCell>
                  <TableCell>{t('leaveBalances.cols.available')}</TableCell>
                  <TableCell>{t('leaveBalances.cols.sick')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.employeeId} hover sx={{ cursor: 'pointer' }} onClick={() => setOpen(r)}>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                        <HrAvatar name={r.name} />
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{r.name}</Typography>
                          <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>
                            <bdi>{r.employeeNo}</bdi>
                            {(ar ? r.departmentAr : r.departmentEn) ? ` · ${ar ? r.departmentAr : r.departmentEn}` : ''}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{daysText(r.perYear)}</TableCell>
                    <TableCell>{daysText(r.opening)}</TableCell>
                    <TableCell>{daysText(r.accruedThisYear)}</TableCell>
                    <TableCell>{daysText(r.usedThisYear)}</TableCell>
                    <TableCell sx={{ color: r.reserved ? hr.primary : undefined }}>{daysText(r.reserved)}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: r.available < 0 ? hr.danger : hr.success }}>{daysText(r.available)}</TableCell>
                    <TableCell>{daysText(r.sickUsedThisYear)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
      {open && (
        <HrDrawer open onClose={() => setOpen(null)} width={640} avatar={<HrAvatar name={open.name} size={44} />} title={open.name} subtitle={<bdi>{open.employeeNo}</bdi>}>
          <Box sx={{ overflowY: 'auto' }}>
            <EmployeeLeavePanel employee={{ id: open.employeeId, nameAr: open.name, nameEn: open.name }} onChanged={() => setVersion((v) => v + 1)} />
          </Box>
        </HrDrawer>
      )}
      {importing && typeId && <OpeningImportDialog typeId={typeId} onClose={() => setImporting(false)} onDone={(n) => (setImporting(false), setNotice(t('leaveBalances.imported', { count: n })), setVersion((v) => v + 1))} />}
    </HrScope>
  );
}

/** Opening balances from Excel: the file, its date, a preview of what is refused, then the import. */
function OpeningImportDialog({ typeId, onClose, onDone }: { typeId: string; onClose: () => void; onDone: (count: number) => void }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [asOf, setAsOf] = useState(`${new Date().getFullYear()}-01-01`);
  const [result, setResult] = useState<OpeningImport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (apply: boolean, f = file) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const r = await leaveApi.importOpenings(f, typeId, asOf, apply);
      if (apply) onDone(r.accepted);
      else setResult(r);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('leaveBalances.import')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('leaveBalances.importHint')}</Typography>
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
            <TextField size="small" type="date" label={t('leave.entry.asOf')} value={asOf} onChange={(e) => (setAsOf(e.target.value), setResult(null))} slotProps={{ inputLabel: { shrink: true } }} />
            <input
              ref={input}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f) void run(false, f);
              }}
            />
            <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => input.current?.click()}>
              {file ? file.name : t('attendance.dialog.choose')}
            </Button>
          </Stack>
          {busy && <LinearProgress />}
          {result && (
            <>
              <Alert severity={result.rejected ? 'warning' : 'success'}>{t('leaveBalances.previewLine', { rows: result.rows, accepted: result.accepted, rejected: result.rejected })}</Alert>
              {result.problems.length > 0 && (
                <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 240 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>{t('leaveBalances.key')}</TableCell>
                        <TableCell>{t('leave.employee')}</TableCell>
                        <TableCell>{t('leave.cols.status')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.problems.map((p) => (
                        <TableRow key={p.row}>
                          <TableCell>{p.row}</TableCell>
                          <TableCell>
                            <bdi>{p.key}</bdi>
                          </TableCell>
                          <TableCell>{p.name ?? '—'}</TableCell>
                          <TableCell>
                            <HrStatusBadge label={t(`leaveBalances.problems.${p.problem}`)} color="#B91C1C" tint="#FEE2E2" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !result || result.accepted === 0} onClick={() => void run(true)}>
            {t('leaveBalances.apply', { count: result?.accepted ?? 0 })}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

/** The leave types and their rules, and the leave settings (carry-over limit, monthly permission allowance). */
export function LeaveTypesPage() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { can } = useSession();
  const [setup, setSetup] = useState<LeaveSetup | null>(null);
  const [editing, setEditing] = useState<LeaveType | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const canSet = can('leave.settings', true);
  useCrumb(t('leaveTypes.title'));
  useEffect(() => {
    leaveApi
      .setup()
      .then(setSetup)
      .catch((f) => setError(errorKey(f)));
  }, [version]);
  const entitlement = (x: LeaveType) =>
    x.hasBalance
      ? t('leaveTypes.balanceRule', { days: x.daysPerYear ?? 0, senior: x.seniorDaysPerYear ?? x.daysPerYear ?? 0, years: x.seniorAfterYears ?? 0 })
      : [x.daysPerYear ? t('leaveTypes.perYear', { days: x.daysPerYear }) : null, x.maxDaysPerRequest ? t('leaveTypes.perRequest', { days: x.maxDaysPerRequest }) : null, x.oncePerService ? t('leaveTypes.once') : null]
          .filter(Boolean)
          .join(' · ') || '—';
  return (
    <HrScope>
      <HrPageHeader
        icon={<SettingsOutlinedIcon />}
        title={t('leaveTypes.title')}
        subtitle={t('leaveTypes.intro')}
        actions={
          canSet && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setEditing('new')}>
              {t('leaveTypes.new')}
            </Button>
          )
        }
      />
      <ErrorMessage messageKey={error} />
      {!setup ? (
        <LinearProgress />
      ) : (
        <Stack sx={{ gap: 1.75 }}>
          <TableContainer sx={{ ...(hrCard as object) }}>
            <Table size="small" sx={{ '& td': { height: 46 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('leaveTypes.cols.name')}</TableCell>
                  <TableCell>{t('leaveTypes.cols.pay')}</TableCell>
                  <TableCell>{t('leaveTypes.cols.entitlement')}</TableCell>
                  <TableCell>{t('leaveTypes.cols.dayCount')}</TableCell>
                  <TableCell>{t('leaveTypes.cols.attachment')}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {setup.types.map((x) => (
                  <TableRow key={x.id} sx={{ opacity: x.isActive ? 1 : 0.55 }}>
                    <TableCell sx={{ fontWeight: 700 }}>{typeName(x, ar)}</TableCell>
                    <TableCell>{t(`leave.pay.${x.pay}`)}</TableCell>
                    <TableCell>{entitlement(x)}</TableCell>
                    <TableCell>{t(`leaveTypes.dayCount.${x.dayCount}`)}</TableCell>
                    <TableCell>{x.needsAttachment ? t('leaveTypes.required') : '—'}</TableCell>
                    <TableCell>
                      {canSet && (
                        <Button size="small" onClick={() => setEditing(x)}>
                          {t('shifts.edit')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <SettingsCard setup={setup} canSet={canSet} onSaved={() => setVersion((v) => v + 1)} />
        </Stack>
      )}
      {editing && <TypeDialog type={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), setVersion((v) => v + 1))} />}
    </HrScope>
  );
}

function SettingsCard({ setup, canSet, onSaved }: { setup: LeaveSetup; canSet: boolean; onSaved: () => void }) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(setup.settings.carryOverLimit === null ? '' : String(setup.settings.carryOverLimit));
  const [hours, setHours] = useState(String(setup.settings.permissionMinutesPerMonth / 60));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    setError(null);
    try {
      await leaveApi.saveSettings({ carryOverLimit: limit === '' ? null : Number(limit), permissionMinutesPerMonth: Math.round(Number(hours) * 60) });
      setSaved(true);
      onSaved();
    } catch (f) {
      setError(errorKey(f));
    }
  };
  return (
    <Box sx={{ ...(hrCard as object), p: 2, display: 'grid', gap: 1.25, maxWidth: 760 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{t('leaveTypes.settings')}</Typography>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField size="small" type="number" label={t('leaveTypes.carryOver')} value={limit} disabled={!canSet} onChange={(e) => (setLimit(e.target.value), setSaved(false))} helperText={t('leaveTypes.carryOverHint')} />
        <TextField size="small" type="number" label={t('leaveTypes.permission')} value={hours} disabled={!canSet} onChange={(e) => (setHours(e.target.value), setSaved(false))} helperText={t('leaveTypes.permissionHint')} slotProps={{ htmlInput: { step: 0.5, min: 0 } }} />
      </Box>
      <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{t('leaveTypes.processNote')}</Typography>
      <ErrorMessage messageKey={error} />
      {saved && <Alert severity="success">{t('shifts.saved')}</Alert>}
      {canSet && (
        <Box>
          <Button variant="outlined" onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </Box>
      )}
    </Box>
  );
}

function TypeDialog({ type, onClose, onSaved }: { type: LeaveType | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState<LeaveTypeInput>(
    type ?? { nameAr: '', nameEn: '', pay: 'Full', hasBalance: false, daysPerYear: null, seniorDaysPerYear: null, seniorAfterYears: null, maxDaysPerRequest: null, oncePerService: false, dayCount: 'Calendar', needsAttachment: false, isActive: true, sortOrder: 50 },
  );
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof LeaveTypeInput>(k: K, value: LeaveTypeInput[K]) => setV((s) => ({ ...s, [k]: value }));
  const num = (s: string) => (s === '' ? null : Number(s));
  const save = async () => {
    setError(null);
    try {
      await leaveApi.saveType(type?.id ?? null, v);
      onSaved();
    } catch (f) {
      setError(errorKey(f));
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{type ? type.nameAr : t('leaveTypes.new')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr', pt: '8px !important' }}>
          <TextField size="small" required label={t('shifts.form.nameAr')} value={v.nameAr} onChange={(e) => set('nameAr', e.target.value)} />
          <TextField size="small" label={t('shifts.form.nameEn')} value={v.nameEn} onChange={(e) => set('nameEn', e.target.value)} slotProps={{ htmlInput: { dir: 'ltr' } }} />
          <TextField select size="small" label={t('leaveTypes.cols.pay')} value={v.pay} onChange={(e) => set('pay', e.target.value as LeaveTypeInput['pay'])}>
            {leavePays.map((p) => (
              <MenuItem key={p} value={p}>
                {t(`leave.pay.${p}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label={t('leaveTypes.cols.dayCount')} value={v.dayCount} onChange={(e) => set('dayCount', e.target.value as LeaveTypeInput['dayCount'])}>
            {(['Calendar', 'Working'] as const).map((d) => (
              <MenuItem key={d} value={d}>
                {t(`leaveTypes.dayCount.${d}`)}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel sx={{ gridColumn: '1 / -1' }} control={<Checkbox checked={v.hasBalance} onChange={(e) => set('hasBalance', e.target.checked)} />} label={t('leaveTypes.form.hasBalance')} />
          <TextField size="small" type="number" label={t('leaveTypes.form.daysPerYear')} value={v.daysPerYear ?? ''} onChange={(e) => set('daysPerYear', num(e.target.value))} />
          <TextField size="small" type="number" label={t('leaveTypes.form.maxPerRequest')} value={v.maxDaysPerRequest ?? ''} onChange={(e) => set('maxDaysPerRequest', num(e.target.value))} />
          {v.hasBalance && (
            <>
              <TextField size="small" type="number" label={t('leaveTypes.form.seniorDays')} value={v.seniorDaysPerYear ?? ''} onChange={(e) => set('seniorDaysPerYear', num(e.target.value))} />
              <TextField size="small" type="number" label={t('leaveTypes.form.seniorAfter')} value={v.seniorAfterYears ?? ''} onChange={(e) => set('seniorAfterYears', num(e.target.value))} />
            </>
          )}
          <FormControlLabel control={<Checkbox checked={v.oncePerService} onChange={(e) => set('oncePerService', e.target.checked)} />} label={t('leaveTypes.once')} />
          <FormControlLabel control={<Checkbox checked={v.needsAttachment} onChange={(e) => set('needsAttachment', e.target.checked)} />} label={t('leaveTypes.form.attachment')} />
          <FormControlLabel control={<Checkbox checked={v.isActive} onChange={(e) => set('isActive', e.target.checked)} />} label={t('shifts.form.isActive')} />
          <Box sx={{ gridColumn: '1 / -1' }}>
            <ErrorMessage messageKey={error} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={!v.nameAr.trim()} onClick={() => void save()}>
            {t('common.save')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}
