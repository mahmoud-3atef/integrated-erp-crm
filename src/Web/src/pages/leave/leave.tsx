import Add from '@mui/icons-material/Add';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
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
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { daysText, leaveApi, type EmployeeLeave, type LeaveInput, type LeavePreview, type LeaveRow, type LeaveType, type RequestStatus } from '../../api/leave';
import { staffApi } from '../../api/staff';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrScope, HrStatusBadge, hr } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';

export const leaveLook: Record<RequestStatus, { color: string; tint: string }> = {
  InApproval: { color: hr.primary, tint: '#EFF6FF' },
  Returned: { color: '#B45309', tint: '#FEF3C7' },
  Rejected: { color: '#B91C1C', tint: '#FEE2E2' },
  Approved: { color: hr.success, tint: '#D1FAE5' },
  Cancelled: { color: hr.textMuted, tint: hr.muted },
};

export function LeaveStatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useTranslation();
  return <HrStatusBadge label={t(`leave.status.${status}`)} {...leaveLook[status]} />;
}

export const typeName = (r: { typeAr: string; typeEn: string } | { nameAr: string; nameEn: string }, ar: boolean) =>
  'typeAr' in r ? (ar ? r.typeAr : r.typeEn) : ar ? r.nameAr : r.nameEn;

type Person = { id: string; nameAr: string; nameEn: string };

function usePeople(search: string, enabled = true) {
  const [options, setOptions] = useState<Person[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => staffApi.pick(search).then(setOptions).catch(() => setOptions([])), 250);
    return () => clearTimeout(timer);
  }, [search, enabled]);
  return options;
}

/**
 * A leave request (or a returned one sent again): employee, type and period, with a live preview — the days as the type
 * counts them, the balance before and after, the return day, the sick tiers, who approves first — before sending.
 */
export function LeaveRequestDialog({
  employee,
  request,
  onClose,
  onSent,
}: {
  employee?: Person;
  request?: { id: string; input: LeaveInput; employeeName: string };
  onClose: () => void;
  onSent: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { date } = useCommercialFormat();
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [who, setWho] = useState<Person | null>(employee ?? (request ? { id: request.input.employeeId, nameAr: request.employeeName, nameEn: request.employeeName } : null));
  const [search, setSearch] = useState('');
  const people = usePeople(search, !employee && !request);
  const [typeId, setTypeId] = useState(request?.input.leaveTypeId ?? '');
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(request?.input.from ?? today);
  const [to, setTo] = useState(request?.input.to ?? today);
  const [reason, setReason] = useState(request?.input.reason ?? '');
  const [substitute, setSubstitute] = useState<Person | null>(null);
  const [subSearch, setSubSearch] = useState('');
  const subs = usePeople(subSearch);
  const [ticket, setTicket] = useState(request?.input.ticket ?? false);
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    leaveApi
      .setup()
      .then((s) => {
        const active = s.types.filter((x) => x.isActive);
        setTypes(active);
        setTypeId((v) => v || (active.find((x) => x.code === 'annual')?.id ?? active[0]?.id ?? ''));
      })
      .catch(() => setTypes([]));
  }, []);

  const input: LeaveInput | null = who && typeId && from && to ? { employeeId: who.id, leaveTypeId: typeId, from, to, reason: reason.trim() || null, substituteId: substitute?.id ?? null, ticket } : null;
  const key = input ? `${input.employeeId}|${input.leaveTypeId}|${input.from}|${input.to}` : '';
  useEffect(() => {
    if (!input) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      leaveApi
        .preview(input, request?.id)
        .then((p) => (setPreview(p), setError(null)))
        .catch((failure) => (setPreview(null), setError(errorKey(failure))));
    }, 250);
    return () => clearTimeout(timer);
  }, [key]);

  const type = types.find((x) => x.id === typeId);
  const send = async () => {
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      const r = request ? await leaveApi.resubmit(request.id, input) : await leaveApi.send(input);
      onSent(r.id);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{request ? t('leave.resubmitTitle') : t('leave.new')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Autocomplete
              size="small"
              disabled={Boolean(employee || request)}
              options={people}
              value={who}
              onChange={(_, v) => setWho(v)}
              onInputChange={(_, v) => setSearch(v)}
              getOptionLabel={(o) => (ar ? o.nameAr : o.nameEn)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={(x) => x}
              renderInput={(params) => <TextField {...params} required label={t('leave.employee')} />}
            />
            <TextField select size="small" required label={t('leave.type')} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {types.map((x) => (
                <MenuItem key={x.id} value={x.id}>
                  {typeName(x, ar)} · {t(`leave.pay.${x.pay}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField size="small" type="date" required label={t('leave.from')} value={from} onChange={(e) => (setFrom(e.target.value), to < e.target.value && setTo(e.target.value))} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="date" required label={t('leave.to')} value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>
          <Box sx={{ bgcolor: '#F8FAFC', border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.5 }}>
            {!input ? (
              <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('leave.preview.pick')}</Typography>
            ) : !preview ? (
              <LinearProgress />
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                  {(
                    [
                      [t('leave.preview.days'), daysText(preview.days), hr.text],
                      [t('leave.preview.available'), preview.available === null ? '—' : daysText(preview.available), hr.text],
                      [t('leave.preview.after'), preview.after === null ? '—' : daysText(preview.after), preview.after !== null && preview.after < 0 ? hr.danger : hr.success],
                      [t('leave.preview.returns'), date(preview.returnsOn), hr.text],
                    ] as const
                  ).map(([l, v, c]) => (
                    <Box key={l}>
                      <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{l}</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: 18, color: c, fontVariantNumeric: 'tabular-nums' }}>
                        <bdi>{v}</bdi>
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: 0.75 }}>
                  {t(`leave.preview.counted.${preview.dayCount}`, { days: preview.calendarDays })}
                  {preview.sick && ` · ${t('leave.preview.sick', { full: daysText(preview.sick.full), part: daysText(preview.sick.threeQuarters), unpaid: daysText(preview.sick.unpaid) })}`}
                </Typography>
                {preview.problems.map((p) => (
                  <Alert key={p} severity="error" sx={{ mt: 1, py: 0 }}>
                    {t(`leave.problems.${p}`)}
                  </Alert>
                ))}
              </>
            )}
          </Box>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Autocomplete
              size="small"
              options={subs.filter((p) => p.id !== who?.id)}
              value={substitute}
              onChange={(_, v) => setSubstitute(v)}
              onInputChange={(_, v) => setSubSearch(v)}
              getOptionLabel={(o) => (ar ? o.nameAr : o.nameEn)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={(x) => x}
              renderInput={(params) => <TextField {...params} label={t('leave.substitute')} />}
            />
            <FormControlLabel control={<Checkbox checked={ticket} onChange={(e) => setTicket(e.target.checked)} />} label={t('leave.ticket')} />
          </Box>
          <TextField size="small" multiline minRows={2} label={t('leave.reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          {type?.needsAttachment && <Alert severity="warning" sx={{ py: 0 }}>{t('leave.attachmentNote')}</Alert>}
          {preview && (
            <Alert severity="info" sx={{ py: 0 }}>
              {preview.managerLinked ? t('leave.route.manager', { name: preview.managerName }) : preview.managerName ? t('leave.route.notLinked', { name: preview.managerName }) : t('leave.route.hr')}
            </Alert>
          )}
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy || !preview || preview.problems.length > 0} onClick={() => void send()}>
            {t('leave.send')}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

/** An opening balance or an adjustment for an employee and a balance type (an entry, with its reason). */
export function EntryDialog({ employeeId, kind, types, onClose, onSaved }: { employeeId: string; kind: 'opening' | 'adjustment'; types: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const [date, setDate] = useState(kind === 'opening' ? `${new Date().getFullYear()}-01-01` : new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState('');
  const [reason, setReason] = useState(kind === 'opening' ? t('leave.entry.openingReason') : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const input = { leaveTypeId: typeId, date, days: Number(days), reason: reason.trim() };
      if (kind === 'opening') await leaveApi.opening(employeeId, input);
      else await leaveApi.adjustment(employeeId, input);
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t(`leave.entry.${kind}`)}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t(`leave.entry.${kind}Hint`)}</Typography>
          <TextField select size="small" label={t('leave.type')} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((x) => (
              <MenuItem key={x.id} value={x.id}>
                {x.name}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" sx={{ gap: 1 }}>
            <TextField size="small" fullWidth type="date" label={t(kind === 'opening' ? 'leave.entry.asOf' : 'leave.entry.date')} value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField
              size="small"
              fullWidth
              type="number"
              label={t('leave.entry.days')}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              helperText={kind === 'adjustment' ? t('leave.entry.signHint') : ' '}
              slotProps={{ htmlInput: { step: 0.25 } }}
            />
          </Stack>
          <TextField size="small" required label={t('leave.reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !typeId || !days || Number(days) === 0 || !reason.trim()} onClick={() => void save()}>
            {t('common.save')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

/** An employee's leave: each type's balance, the actions (request, opening balance, adjustment), the entries and the requests. */
export function EmployeeLeavePanel({ employee, onChanged }: { employee: Person; onChanged?: () => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { date } = useCommercialFormat();
  const { can } = useSession();
  const navigate = useNavigate();
  const [data, setData] = useState<EmployeeLeave | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<'request' | 'opening' | 'adjustment' | null>(null);
  const canManage = can('leave.manage', true);
  useEffect(() => {
    leaveApi
      .employee(employee.id)
      .then((d) => (setData(d), setError(null)))
      .catch((failure) => setError(errorKey(failure)));
  }, [employee.id, version]);
  const changed = () => {
    setDialog(null);
    setVersion((v) => v + 1);
    onChanged?.();
  };
  if (!data) return error ? <ErrorMessage messageKey={error} /> : <LinearProgress />;
  const balanceTypes = data.balances.filter((b) => b.hasBalance).map((b) => ({ id: b.leaveTypeId, name: typeName(b, ar) }));
  const kindColor = (d: number) => (d > 0 ? hr.success : d < 0 ? '#B91C1C' : hr.textMuted);
  return (
    <HrScope>
      <Stack sx={{ gap: 1.75 }}>
        {canManage && (
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialog('request')}>
              {t('leave.new')}
            </Button>
            <Button variant="outlined" onClick={() => setDialog('opening')} disabled={balanceTypes.length === 0}>
              {t('leave.entry.opening')}
            </Button>
            <Button variant="outlined" startIcon={<TuneOutlinedIcon />} onClick={() => setDialog('adjustment')} disabled={balanceTypes.length === 0}>
              {t('leave.entry.adjustment')}
            </Button>
          </Stack>
        )}
        <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {data.balances.map((b) => (
            <Box key={b.leaveTypeId} sx={{ border: `1px solid ${hr.border}`, borderRadius: '12px', p: 1.5, bgcolor: b.hasBalance ? '#ECFDF5' : '#fff' }}>
              <Typography sx={{ fontWeight: 700 }}>{typeName(b, ar)}</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 700, color: b.available < 0 ? hr.danger : b.hasBalance ? hr.success : hr.text, fontVariantNumeric: 'tabular-nums' }}>
                <bdi>{daysText(b.available)}</bdi> <Box component="span" sx={{ fontSize: 12, color: hr.textMuted, fontWeight: 500 }}>{t('leave.daysAvailable')}</Box>
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>
                {b.hasBalance
                  ? t('leave.balanceLine', { perYear: daysText(b.perYear), accrued: daysText(b.accruedThisYear), used: daysText(b.usedThisYear), reserved: daysText(b.reserved) })
                  : t('leave.limitLine', { limit: daysText(b.yearLimit ?? 0), used: daysText(b.usedThisYear) })}
              </Typography>
            </Box>
          ))}
        </Box>
        <Typography sx={{ fontWeight: 700 }}>{t('leave.requestsTitle')}</Typography>
        <RequestsTable rows={data.requests} showEmployee={false} onOpen={(id) => navigate(`/hr/leave/${id}`)} />
        <Typography sx={{ fontWeight: 700 }}>{t('leave.entriesTitle')}</Typography>
        {data.entries.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('leave.noEntries')}</Typography>
        ) : (
          <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 360 }}>
            <Table size="small" stickyHeader sx={{ '& td': { fontVariantNumeric: 'tabular-nums' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('leave.cols.date')}</TableCell>
                  <TableCell>{t('leave.type')}</TableCell>
                  <TableCell>{t('leave.cols.entry')}</TableCell>
                  <TableCell>{t('leave.cols.days')}</TableCell>
                  <TableCell>{t('leave.cols.balance')}</TableCell>
                  <TableCell>{t('leave.cols.by')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{date(e.date)}</TableCell>
                    <TableCell>{balanceTypes.find((x) => x.id === e.leaveTypeId)?.name ?? '—'}</TableCell>
                    <TableCell>
                      {t(`leave.entryKind.${e.kind}`)} · {e.requestNo ? <bdi>{e.requestNo}</bdi> : e.reason}
                    </TableCell>
                    <TableCell sx={{ color: kindColor(e.days), fontWeight: 700 }}>
                      <bdi>{e.days > 0 ? `+${daysText(e.days)}` : daysText(e.days)}</bdi>
                    </TableCell>
                    <TableCell>{daysText(e.running)}</TableCell>
                    <TableCell>{e.createdByName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>
      {dialog === 'request' && <LeaveRequestDialog employee={employee} onClose={() => setDialog(null)} onSent={(id) => navigate(`/hr/leave/${id}`)} />}
      {(dialog === 'opening' || dialog === 'adjustment') && <EntryDialog employeeId={employee.id} kind={dialog} types={balanceTypes} onClose={() => setDialog(null)} onSaved={changed} />}
    </HrScope>
  );
}

/** Leave requests as a table. */
export function RequestsTable({ rows, showEmployee = true, onOpen }: { rows: LeaveRow[]; showEmployee?: boolean; onOpen: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { date } = useCommercialFormat();
  if (rows.length === 0) return <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('leave.none')}</Typography>;
  return (
    <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
      <Table size="small" sx={{ '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }}>
        <TableHead>
          <TableRow>
            {showEmployee && <TableCell>{t('leave.employee')}</TableCell>}
            <TableCell>{t('leave.cols.no')}</TableCell>
            <TableCell>{t('leave.type')}</TableCell>
            <TableCell>{t('leave.from')}</TableCell>
            <TableCell>{t('leave.to')}</TableCell>
            <TableCell>{t('leave.cols.days')}</TableCell>
            <TableCell>{t('leave.cols.status')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(r.id)}>
              {showEmployee && (
                <TableCell>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{r.employeeName}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{(ar ? r.departmentAr : r.departmentEn) ?? ''}</Typography>
                </TableCell>
              )}
              <TableCell sx={{ fontWeight: 700 }}>
                <RouterLink to={`/hr/leave/${r.id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <bdi>{r.requestNo}</bdi>
                </RouterLink>
              </TableCell>
              <TableCell>{typeName(r, ar)}</TableCell>
              <TableCell>{date(r.from)}</TableCell>
              <TableCell>{date(r.to)}</TableCell>
              <TableCell>{daysText(r.days)}</TableCell>
              <TableCell>
                <LeaveStatusBadge status={r.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
