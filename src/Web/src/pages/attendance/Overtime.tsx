import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreTimeOutlinedIcon from '@mui/icons-material/MoreTimeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { attendanceApi, hm, type Overtime, type OvertimeStatus } from '../../api/attendance';
import { staffApi } from '../../api/staff';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval, ShownStatus } from '../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { localRef } from './AttendanceMonthPage';
import { DateField } from '../../components/DateField';

export const overtimeLook: Record<OvertimeStatus, { color: string; tint: string }> = {
  InApproval: { color: hr.primary, tint: '#EFF6FF' },
  Returned: { color: '#B45309', tint: '#FEF3C7' },
  Rejected: { color: '#B91C1C', tint: '#FEE2E2' },
  Approved: { color: hr.success, tint: '#D1FAE5' },
  Cancelled: { color: '#B91C1C', tint: '#FEE2E2' },
};

export function OvertimeBadge({ status }: { status: OvertimeStatus }) {
  const { t } = useTranslation();
  return <HrStatusBadge label={t(`overtime.status.${status}`)} {...overtimeLook[status]} />;
}

/** Requesting overtime, sending a returned request again, or (amend) changing an approved one with the reason. */
export function OvertimeDialog({ request, amend = false, onClose, onSent }: { request?: Overtime; amend?: boolean; onClose: () => void; onSent: (id: string) => void }) {
  const [amendReason, setAmendReason] = useState('');
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [employee, setEmployee] = useState<{ id: string; nameAr: string; nameEn: string } | null>(request ? { id: request.employeeId, nameAr: request.employeeName, nameEn: request.employeeName } : null);
  const [options, setOptions] = useState<{ id: string; nameAr: string; nameEn: string }[]>([]);
  const [search, setSearch] = useState('');
  const [day, setDay] = useState(request?.date ?? new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(request ? String(request.minutes / 60) : '2');
  const [reason, setReason] = useState(request?.reason ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (request) return;
    const timer = setTimeout(() => staffApi.pick(search).then(setOptions).catch(() => setOptions([])), 250);
    return () => clearTimeout(timer);
  }, [search, request]);
  const minutes = Math.round(Number(hours) * 60);
  const send = async () => {
    if (!employee) return;
    setBusy(true);
    setError(null);
    try {
      const input = { employeeId: employee.id, date: day, minutes, reason: reason.trim() };
      if (request && amend) {
        await attendanceApi.amendOvertime(request.id, { date: day, minutes, reason: reason.trim(), amendReason: amendReason.trim() });
        onSent(request.id);
        return;
      }
      const r = request ? await attendanceApi.resubmitOvertime(request.id, input) : await attendanceApi.requestOvertime(input);
      onSent(r.id);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{request ? (amend ? t('overtime.amend.title', { no: request.requestNo }) : request.requestNo) : t('overtime.new')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Autocomplete
            size="small"
            disabled={Boolean(request)}
            options={options}
            value={employee}
            onChange={(_, v) => setEmployee(v)}
            onInputChange={(_, v) => setSearch(v)}
            getOptionLabel={(o) => localRef(o, ar)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(x) => x}
            renderInput={(params) => <TextField {...params} required label={t('overtime.employee')} />}
          />
          <Stack direction="row" sx={{ gap: 1 }}>
            <DateField size="small" fullWidth label={t('overtime.date')} value={day} onChange={(e) => setDay(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" fullWidth type="number" label={t('overtime.hours')} value={hours} onChange={(e) => setHours(e.target.value)} slotProps={{ htmlInput: { min: 0.25, max: 12, step: 0.25 } }} />
          </Stack>
          <TextField size="small" required multiline minRows={2} label={t('overtime.reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          <Alert severity="info" sx={{ py: 0 }}>
            {amend ? t('overtime.amend.hint') : t('overtime.hint')}
          </Alert>
          {amend && (
            <TextField size="small" required multiline minRows={2} label={t('overtime.amend.reason')} value={amendReason} onChange={(e) => setAmendReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          )}
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={amend ? <EditNoteOutlinedIcon /> : <SendOutlinedIcon />}
            disabled={busy || !employee || !reason.trim() || !(minutes >= 15) || (amend && !amendReason.trim())}
            onClick={() => void send()}
          >
            {amend ? t('overtime.amend.save') : t('overtime.send')}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

/** The month's overtime requests (the month page's tab). */
export function OvertimeList({ list, onOpen }: { list: Overtime[] | null; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  if (!list) return <LinearProgress />;
  if (list.length === 0) return <HrEmptyState icon={<MoreTimeOutlinedIcon />} title={t('overtime.none')} hint={t('overtime.noneHint')} />;
  return (
    <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
      <Table size="small" sx={{ '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }}>
        <TableHead>
          <TableRow>
            <TableCell>{t('overtime.cols.no')}</TableCell>
            <TableCell>{t('overtime.employee')}</TableCell>
            <TableCell>{t('overtime.date')}</TableCell>
            <TableCell>{t('overtime.hours')}</TableCell>
            <TableCell>{t('overtime.reason')}</TableCell>
            <TableCell>{t('overtime.cols.status')}</TableCell>
            <TableCell>{t('overtime.cols.by')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((o) => (
            <TableRow key={o.id} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(o.id)}>
              <TableCell sx={{ fontWeight: 700 }}>
                <bdi>{o.requestNo}</bdi>
              </TableCell>
              <TableCell>{o.employeeName}</TableCell>
              <TableCell>{date(o.date)}</TableCell>
              <TableCell>
                <bdi>{hm(o.minutes)}</bdi>
              </TableCell>
              <TableCell sx={{ maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.reason}</TableCell>
              <TableCell>
                <OvertimeBadge status={o.status} />
              </TableCell>
              <TableCell>{o.createdByName}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** An overtime request: its approval bar, its details, and «send again» once returned. */
export function OvertimePage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const [o, setO] = useState<Overtime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [amending, setAmending] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const approval = useRecordApproval(o?.approval?.instanceId);
  useCrumb(o?.requestNo, `/hr/overtime/${id}`);
  const reload = useCallback(async () => {
    try {
      setO(await attendanceApi.overtime(id));
      setError(null);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!o) {
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
        icon={<MoreTimeOutlinedIcon />}
        title={t('overtime.title')}
        status={<ShownStatus approval={approval.detail}><OvertimeBadge status={o.status} /></ShownStatus>}
        reference={o.requestNo}
        subtitle={
          <>
            {o.employeeName} · <bdi>{date(o.date)}</bdi> · <bdi>{hm(o.minutes)}</bdi>
          </>
        }
        actions={
          <>
            {o.status === 'Returned' && can('attendance.manage', true) && (
              <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={() => setEditing(true)}>
                {t('overtime.resubmit')}
              </Button>
            )}
            {o.canAmend && (
              <Button variant="outlined" startIcon={<EditNoteOutlinedIcon />} onClick={() => setAmending(true)}>
                {t('overtime.amend.action')}
              </Button>
            )}
            {o.canCancelApproved && (
              <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => setCancelling('')}>
                {t('overtime.amend.cancelAction')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') }} />} onClick={() => navigate(-1)}>
              {t('common.back')}
            </Button>
          </>
        }
      />
      <ErrorMessage messageKey={error} />
      {o.approval && (
        <ApprovalBar
          status={o.approval}
          detail={approval.detail}
          onChanged={() => {
            void reload();
            void approval.reload();
          }}
        />
      )}
      {o.amendedAt && o.status === 'Approved' && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {t('overtime.amend.amendedBy', { by: o.amendedByName, date: date(o.amendedAt) })} — {o.amendNote}
        </Alert>
      )}
      {o.canceledAt && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t('overtime.amend.canceledBy', { by: o.canceledByName, date: date(o.canceledAt) })}
        </Alert>
      )}
      {o.lastComment && o.status !== 'Approved' && (
        <Alert severity={o.status === 'Rejected' ? 'error' : 'warning'} sx={{ mb: 1.5 }}>
          {o.lastComment}
        </Alert>
      )}
      <Box sx={{ ...(hrCard as object), p: 2, display: 'grid', gap: 1.25, maxWidth: 760 }}>
        {(
          [
            [t('overtime.employee'), o.employeeName],
            [t('overtime.date'), date(o.date)],
            [t('overtime.hours'), hm(o.minutes)],
            [t('overtime.reason'), o.reason],
            [t('overtime.requested'), <>{o.createdByName} · <bdi>{date(o.createdAt)}</bdi></>],
          ] as const
        ).map(([k, v]) => (
          <Stack key={k} direction="row" sx={{ gap: 2, borderBottom: `1px solid #EEF2F7`, pb: 1 }}>
            <Typography sx={{ width: 140, flex: '0 0 auto', color: hr.textMuted, fontSize: 13 }}>{k}</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{typeof v === 'string' ? <bdi>{v}</bdi> : v}</Typography>
          </Stack>
        ))}
        <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{t('overtime.factor')}</Typography>
      </Box>
      {amending && (
        <OvertimeDialog
          request={o}
          amend
          onClose={() => setAmending(false)}
          onSent={() => {
            setAmending(false);
            void reload();
          }}
        />
      )}
      {cancelling !== null && (
        <Dialog open onClose={() => setCancelling(null)} maxWidth="xs" fullWidth>
          <HrScope>
            <DialogTitle sx={{ fontWeight: 700 }}>{t('overtime.amend.cancelAction')}</DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
              <Typography sx={{ fontSize: 13 }}>{t('overtime.amend.cancelHint')}</Typography>
              <TextField size="small" required multiline minRows={2} label={t('overtime.amend.reason')} value={cancelling} onChange={(e) => setCancelling(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
              <Button
                variant="contained"
                color="error"
                disabled={!cancelling.trim()}
                onClick={() =>
                  void attendanceApi
                    .cancelApprovedOvertime(o.id, cancelling.trim())
                    .then(() => (setCancelling(null), reload()))
                    .catch((f) => (setCancelling(null), setError(errorKey(f))))
                }
              >
                {t('overtime.amend.cancelAction')}
              </Button>
              <Button onClick={() => setCancelling(null)}>{t('common.back')}</Button>
            </DialogActions>
          </HrScope>
        </Dialog>
      )}
      {editing && (
        <OvertimeDialog
          request={o}
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

/** /hr/attendance/months/:id (the approval inbox's link): to the month's page. */
export function AttendanceMonthLink() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    attendanceApi
      .monthPeriod(id)
      .then((r) => navigate(`/hr/attendance?period=${r.period}`, { replace: true }))
      .catch((failure) => setError(errorKey(failure)));
  }, [id, navigate]);
  return (
    <HrScope>
      <ErrorMessage messageKey={error} />
      {!error && <LinearProgress />}
    </HrScope>
  );
}
