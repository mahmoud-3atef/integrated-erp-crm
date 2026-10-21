import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { hm } from '../../api/attendance';
import { errorKey } from '../../api/auth';
import { leaveApi, permissionKinds, type Permission, type PermissionInput, type PermissionKind, type PermissionPreview } from '../../api/leave';
import { staffApi } from '../../api/staff';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrPageHeader, HrScope, hr, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { LeaveStatusBadge } from './leave';

type Person = { id: string; nameAr: string; nameEn: string };
const hhmm = (t: string) => t.slice(0, 5);

/** A permission (or a returned one sent again): employee, day, from and to, kind, with the month's allowance shown. */
export function PermissionDialog({ employee, request, onClose, onSent }: { employee?: Person; request?: Permission; onClose: () => void; onSent: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [who, setWho] = useState<Person | null>(employee ?? (request ? { id: request.employeeId, nameAr: request.employeeName, nameEn: request.employeeName } : null));
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [day, setDay] = useState(request?.date ?? new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState(request ? hhmm(request.from) : '09:00');
  const [to, setTo] = useState(request ? hhmm(request.to) : '10:00');
  const [kind, setKind] = useState<PermissionKind>(request?.kind ?? 'LateArrival');
  const [reason, setReason] = useState(request?.reason ?? '');
  const [preview, setPreview] = useState<PermissionPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (employee || request) return;
    const timer = setTimeout(() => staffApi.pick(search).then(setPeople).catch(() => setPeople([])), 250);
    return () => clearTimeout(timer);
  }, [search, employee, request]);
  const input: PermissionInput | null = who && day && from && to ? { employeeId: who.id, date: day, from, to, kind, reason: reason.trim() || null } : null;
  const key = input ? `${input.employeeId}|${day}|${from}|${to}|${kind}` : '';
  useEffect(() => {
    if (!input) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      leaveApi
        .previewPermission(input, request?.id)
        .then((p) => (setPreview(p), setError(null)))
        .catch((f) => (setPreview(null), setError(errorKey(f))));
    }, 250);
    return () => clearTimeout(timer);
  }, [key]);
  const send = async () => {
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      const r = request ? await leaveApi.resubmitPermission(request.id, input) : await leaveApi.sendPermission(input);
      onSent(r.id);
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{request ? request.requestNo : t('permissions.new')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
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
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
            <TextField select size="small" label={t('permissions.kind')} value={kind} onChange={(e) => setKind(e.target.value as PermissionKind)}>
              {permissionKinds.map((k) => (
                <MenuItem key={k} value={k}>
                  {t(`permissions.kinds.${k}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField size="small" type="date" label={t('permissions.date')} value={day} onChange={(e) => setDay(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="time" label={t('permissions.from')} value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="time" label={t('permissions.to')} value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>
          <Box sx={{ bgcolor: '#F8FAFC', border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.5 }}>
            {!input ? (
              <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('permissions.pick')}</Typography>
            ) : !preview ? (
              <LinearProgress />
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                  {(
                    [
                      [t('permissions.duration'), hm(preview.minutes)],
                      [t('permissions.usedThisMonth'), `${hm(preview.usedThisMonth)} / ${hm(preview.allowance)}`],
                      [t('permissions.remaining'), preview.mission ? '—' : hm(preview.remaining)],
                    ] as const
                  ).map(([l, v]) => (
                    <Box key={l}>
                      <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{l}</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
                        <bdi>{v}</bdi>
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {preview.mission && <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: 0.75 }}>{t('permissions.missionNote')}</Typography>}
                {preview.overAllowance > 0 && (
                  <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                    {t('permissions.over', { minutes: hm(preview.overAllowance) })}
                  </Alert>
                )}
                {preview.problems.map((p) => (
                  <Alert key={p} severity="error" sx={{ mt: 1, py: 0 }}>
                    {t(`permissions.problems.${p}`)}
                  </Alert>
                ))}
              </>
            )}
          </Box>
          <TextField size="small" multiline minRows={2} label={t('leave.reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          {preview && <Alert severity="info" sx={{ py: 0 }}>{preview.managerLinked ? t('permissions.route.manager', { name: preview.managerName }) : t('permissions.route.hr')}</Alert>}
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

export function PermissionsTable({ rows, showEmployee = true, onOpen }: { rows: Permission[]; showEmployee?: boolean; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  if (rows.length === 0) return <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('permissions.none')}</Typography>;
  return (
    <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
      <Table size="small" sx={{ '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }}>
        <TableHead>
          <TableRow>
            {showEmployee && <TableCell>{t('leave.employee')}</TableCell>}
            <TableCell>{t('leave.cols.no')}</TableCell>
            <TableCell>{t('permissions.kind')}</TableCell>
            <TableCell>{t('permissions.date')}</TableCell>
            <TableCell>{t('permissions.time')}</TableCell>
            <TableCell>{t('permissions.duration')}</TableCell>
            <TableCell>{t('leave.cols.status')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(p.id)}>
              {showEmployee && <TableCell sx={{ fontWeight: 700 }}>{p.employeeName}</TableCell>}
              <TableCell sx={{ fontWeight: 700 }}>
                <bdi>{p.requestNo}</bdi>
              </TableCell>
              <TableCell>{t(`permissions.kinds.${p.kind}`)}</TableCell>
              <TableCell>{date(p.date)}</TableCell>
              <TableCell>
                <bdi dir="ltr">{`${hhmm(p.from)} – ${hhmm(p.to)}`}</bdi>
              </TableCell>
              <TableCell>
                <bdi>{hm(p.minutes)}</bdi>
              </TableCell>
              <TableCell>
                <LeaveStatusBadge status={p.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** A permission: its approval bar, its details, and «send again» once returned. */
export function PermissionPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const [p, setP] = useState<Permission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [amending, setAmending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const approval = useRecordApproval(p?.approval?.instanceId);
  useCrumb(p?.requestNo, `/hr/permissions/${id}`);
  const reload = useCallback(async () => {
    try {
      setP(await leaveApi.permission(id));
      setError(null);
    } catch (f) {
      setError(errorKey(f));
    }
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);
  if (!p) {
    return (
      <HrScope>
        <ErrorMessage messageKey={error} />
        {!error && <LinearProgress />}
      </HrScope>
    );
  }
  return (
    <HrScope>
      <HrPageHeader
        icon={<TimerOutlinedIcon />}
        title={t('permissions.title', { kind: t(`permissions.kinds.${p.kind}`) })}
        status={<LeaveStatusBadge status={p.status} />}
        reference={p.requestNo}
        subtitle={
          <>
            <RouterLink to={`/hr/employees/${p.employeeId}`}>{p.employeeName}</RouterLink> · <bdi>{date(p.date)}</bdi> · <bdi dir="ltr">{`${hhmm(p.from)} – ${hhmm(p.to)}`}</bdi>
          </>
        }
        actions={
          <>
            {p.status === 'Returned' && can('leave.manage', true) && (
              <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={() => setEditing(true)}>
                {t('leave.resubmit')}
              </Button>
            )}
            {p.canAmend && (
              <Button variant="outlined" startIcon={<EditNoteOutlinedIcon />} onClick={() => setAmending(true)}>
                {t('permissions.amend.action')}
              </Button>
            )}
            {p.canCancelApproved && (
              <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => setCancelling(true)}>
                {t('permissions.amend.cancelAction')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') }} />} onClick={() => navigate(-1)}>
              {t('common.back')}
            </Button>
          </>
        }
      />
      <ErrorMessage messageKey={error} />
      {p.approval && (
        <ApprovalBar
          status={p.approval}
          detail={approval.detail}
          onChanged={() => {
            void reload();
            void approval.reload();
          }}
        />
      )}
      {p.amendedAt && p.status === 'Approved' && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {t('permissions.amend.amendedBy', { by: p.amendedByName, date: date(p.amendedAt) })} — {p.amendNote}
        </Alert>
      )}
      {p.canceledAt && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t('permissions.amend.canceledBy', { by: p.canceledByName, date: date(p.canceledAt) })}
        </Alert>
      )}
      {p.lastComment && p.status !== 'Approved' && <Alert severity={p.status === 'Rejected' ? 'error' : 'warning'} sx={{ mb: 1.5 }}>{p.lastComment}</Alert>}
      <Box sx={{ ...(hrCard as object), p: 2, display: 'grid', gap: 1.25, maxWidth: 760 }}>
        {(
          [
            [t('leave.employee'), p.employeeName],
            [t('permissions.kind'), t(`permissions.kinds.${p.kind}`)],
            [t('permissions.date'), <bdi key="d">{date(p.date)}</bdi>],
            [t('permissions.time'), <bdi key="t" dir="ltr">{`${hhmm(p.from)} – ${hhmm(p.to)}`}</bdi>],
            [t('permissions.duration'), <bdi key="m">{hm(p.minutes)}</bdi>],
            [t('leave.reason'), p.reason ?? '—'],
            [t('leave.requested'), <span key="r">{p.createdByName} · <bdi>{date(p.createdAt)}</bdi></span>],
          ] as const
        ).map(([k, v]) => (
          <Stack key={k} direction="row" sx={{ gap: 2, borderBottom: `1px solid #EEF2F7`, pb: 1 }}>
            <Typography sx={{ width: 140, flex: '0 0 auto', color: hr.textMuted, fontSize: 13 }}>{k}</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{v}</Typography>
          </Stack>
        ))}
        <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{t('permissions.effect')}</Typography>
      </Box>
      {amending && (
        <PermissionAmendDialog
          permission={p}
          onClose={() => setAmending(false)}
          onSaved={() => {
            setAmending(false);
            void reload();
          }}
        />
      )}
      {cancelling && (
        <PermissionCancelDialog
          onClose={() => setCancelling(false)}
          onCancel={async (reason) => {
            await leaveApi.cancelApprovedPermission(p.id, reason);
            setCancelling(false);
            await reload();
          }}
        />
      )}
      {editing && (
        <PermissionDialog
          request={p}
          onClose={() => setEditing(false)}
          onSent={() => {
            setEditing(false);
            void reload();
            void approval.reload();
          }}
        />
      )}
    </HrScope>
  );
}

/** Changing an approved permission (its own permission): its day, times, kind and reason, with the reason for the change. */
function PermissionAmendDialog({ permission: p, onClose, onSaved }: { permission: Permission; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [day, setDay] = useState(p.date);
  const [from, setFrom] = useState(hhmm(p.from));
  const [to, setTo] = useState(hhmm(p.to));
  const [kind, setKind] = useState<PermissionKind>(p.kind);
  const [reason, setReason] = useState(p.reason ?? '');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await leaveApi.amendPermission(p.id, { date: day, from, to, kind, reason: reason.trim() || null, amendReason: why.trim() });
      onSaved();
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('permissions.amend.title', { no: p.requestNo })}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Alert severity="info">{t('permissions.amend.hint')}</Alert>
          <TextField size="small" select label={t('permissions.kind')} value={kind} onChange={(e) => setKind(e.target.value as PermissionKind)}>
            {permissionKinds.map((k) => (
              <MenuItem key={k} value={k}>
                {t(`permissions.kinds.${k}`)}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
            <TextField size="small" type="date" label={t('permissions.date')} value={day} onChange={(e) => setDay(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
            <TextField size="small" type="time" label={t('permissions.from')} value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
            <TextField size="small" type="time" label={t('permissions.to')} value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
          </Stack>
          <TextField size="small" multiline minRows={2} label={t('leave.reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          <TextField size="small" required multiline minRows={2} label={t('permissions.amend.reason')} value={why} onChange={(e) => setWhy(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !why.trim() || !day || !from || !to} onClick={() => void save()}>
            {t('permissions.amend.save')}
          </Button>
          <Button onClick={onClose}>{t('common.back')}</Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

function PermissionCancelDialog({ onClose, onCancel }: { onClose: () => void; onCancel: (reason: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('permissions.amend.cancelAction')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Typography sx={{ fontSize: 13 }}>{t('permissions.amend.cancelHint')}</Typography>
          <TextField size="small" required multiline minRows={2} label={t('permissions.amend.reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" color="error" disabled={!reason.trim()} onClick={() => void onCancel(reason.trim()).catch((f) => setError(errorKey(f)))}>
            {t('permissions.amend.cancelAction')}
          </Button>
          <Button onClick={onClose}>{t('common.back')}</Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}
