import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import WorkHistoryOutlinedIcon from '@mui/icons-material/WorkHistoryOutlined';
import { Alert, Box, Button, ButtonBase, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, Link, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { actionKinds, staffApi, type ActionKind, type ActionRow, type ActionStatus, type Department, type SalaryValues, type StaffActionDetail, type StaffProfile } from '../../api/staff';
import { useCrumb } from '../../app/breadcrumbs';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { useLegalEntities } from '../payroll/RunDialogs';

// Employment actions: a request on an employee through the approval process, applied to the file when approved.

export const actionIcon: Record<ActionKind, ReactNode> = {
  Promotion: <TrendingUpOutlinedIcon />,
  Transfer: <SwapHorizOutlinedIcon />,
  SalaryChange: <PaymentsOutlinedIcon />,
  Acting: <AssignmentIndOutlinedIcon />,
  ConfirmProbation: <CheckCircleOutlineOutlinedIcon />,
  ExtendProbation: <EventRepeatOutlinedIcon />,
  EndProbation: <LogoutOutlinedIcon />,
  RenewContract: <AutorenewIcon />,
  NotRenew: <BlockOutlinedIcon />,
};

const statusLook: Record<ActionStatus, { color: string; tint: string }> = {
  Draft: { color: '#475569', tint: '#F1F5F9' },
  InApproval: { color: hr.primary, tint: '#EFF6FF' },
  Returned: { color: '#B45309', tint: '#FEF3C7' },
  Rejected: { color: hr.danger, tint: '#FEE2E2' },
  Applied: { color: hr.success, tint: '#D1FAE5' },
};

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  const { t } = useTranslation();
  return <HrStatusBadge label={t(`staffActions.status.${status}`)} {...statusLook[status]} />;
}

/** Which actions fit the employee now (a probation decision only on probation, not renewing only with an end date). */
const kindsFor = (p: StaffProfile): ActionKind[] =>
  actionKinds.filter((k) => {
    if (k === 'ConfirmProbation' || k === 'ExtendProbation' || k === 'EndProbation') return p.status === 'Probation';
    if (k === 'NotRenew') return p.contractEndsOn !== null;
    if (k === 'SalaryChange') return p.canChangeSalary;
    return true;
  });

const salaryKeys: (keyof SalaryValues)[] = ['basic', 'housing', 'food', 'transport', 'mobile', 'project', 'other'];
const salaryLabel: Record<keyof SalaryValues, string> = { basic: 'basic', housing: 'housing', food: 'food', transport: 'transport', mobile: 'mobileAllowance', project: 'project', other: 'other' };

export function ActionDialog({ profile, departments, onClose, onSent }: { profile: StaffProfile; departments: Department[]; onClose: () => void; onSent: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const entities = useLegalEntities();
  const kinds = kindsFor(profile);
  const [kind, setKind] = useState<ActionKind>(kinds[0] ?? 'Transfer');
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [entity, setEntity] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [withSalary, setWithSalary] = useState(false);
  const s = profile.salary;
  const [salary, setSalary] = useState<SalaryValues>(s ? { basic: s.basic, housing: s.housing, food: s.food, transport: s.transport, mobile: s.mobile, project: s.project, other: s.other } : { basic: 0, housing: 0, food: 0, transport: 0, mobile: 0, project: 0, other: 0 });
  const [until, setUntil] = useState('');
  const [allowance, setAllowance] = useState('');
  const [contractKind, setContractKind] = useState<'Fixed' | 'Open'>('Fixed');
  const [months, setMonths] = useState('12');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allPositions = departments.flatMap((d) => d.positions.filter((p) => p.isActive).map((p) => ({ id: p.id, departmentId: d.id, label: `${ar ? p.jobTitleAr : p.jobTitleEn} — ${ar ? d.nameAr : d.nameEn} (${p.occupants.length}/${p.seats})` })));
  const positions = department ? allPositions.filter((p) => p.departmentId === department) : allPositions;
  const needsSalary = kind === 'SalaryChange' || ((kind === 'Promotion' || kind === 'Transfer') && withSalary);
  const total = salaryKeys.reduce((sum, k) => sum + (Number(salary[k]) || 0), 0);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await staffApi.requestAction(profile.id, {
        kind,
        effectiveFrom: from,
        reason: reason.trim(),
        newLegalEntityId: kind === 'Transfer' && entity ? entity : null,
        newDepartmentId: (kind === 'Transfer' || kind === 'Promotion') && department ? department : null,
        newPositionId: (kind === 'Transfer' || kind === 'Promotion' || kind === 'Acting') && position ? position : null,
        newSalary: needsSalary && profile.canChangeSalary ? salary : null,
        actingAllowance: kind === 'Acting' ? Number(allowance) || 0 : null,
        actingUntil: kind === 'Acting' && until ? until : null,
        newProbationEndsOn: kind === 'ExtendProbation' && until ? until : null,
        newContractKind: kind === 'RenewContract' ? contractKind : null,
        newContractMonths: kind === 'RenewContract' && contractKind === 'Fixed' ? Number(months) || null : null,
        newContractEndsOn: null,
      });
      onSent(r.id);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md" slotProps={{ paper: { sx: { borderRadius: '18px' } } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {t('staffActions.new')} · <span style={{ color: hr.textMuted, fontWeight: 600 }}>{profile.nameAr ?? profile.nameEn}</span>
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2 }}>
          <ErrorMessage messageKey={error} />
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{t('staffActions.choose')}</Typography>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }} role="radiogroup">
            {kinds.map((k) => (
              <ButtonBase
                key={k}
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                sx={{ justifyContent: 'flex-start', textAlign: 'start', gap: 1.25, p: 1.25, borderRadius: '12px', border: `1.5px solid ${kind === k ? hr.primary : hr.border}`, bgcolor: kind === k ? '#EFF6FF' : '#fff', '& svg': { color: kind === k ? hr.primary : hr.textMuted } }}
              >
                {actionIcon[k]}
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{t(`staffActions.kind.${k}`)}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: hr.textMuted, lineHeight: 1.4 }}>{t(`staffActions.kindHint.${k}`)}</Typography>
                </Box>
              </ButtonBase>
            ))}
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
            <TextField type="date" label={t('staffActions.effectiveFrom')} value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 200 }} />
            {kind === 'Transfer' && (
              <TextField select label={t('staffActions.newLegalEntity')} value={entity} onChange={(e) => setEntity(e.target.value)} fullWidth slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                <MenuItem value="">{t('staffActions.keep')}</MenuItem>
                {entities.map((e) => (
                  <MenuItem key={e.id} value={e.id}>
                    {localName(e, i18n.language)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>

          {(kind === 'Transfer' || kind === 'Promotion' || kind === 'Acting') && (
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
              {kind !== 'Acting' && (
                <TextField select label={t('staffActions.newDepartment')} value={department} onChange={(e) => (setDepartment(e.target.value), setPosition(''))} fullWidth slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  <MenuItem value="">{t('staffActions.keep')}</MenuItem>
                  {departments.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {ar ? d.nameAr : d.nameEn}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <TextField select label={kind === 'Acting' ? t('staffActions.actingPosition') : t('staffActions.newPosition')} value={position} onChange={(e) => setPosition(e.target.value)} fullWidth required={kind !== 'Transfer'} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                <MenuItem value="">{t('staffActions.keep')}</MenuItem>
                {positions.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          {kind === 'Acting' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
              <TextField type="date" label={t('staffActions.actingUntil')} value={until} onChange={(e) => setUntil(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth required />
              <TextField type="number" label={t('staffActions.actingAllowance')} value={allowance} onChange={(e) => setAllowance(e.target.value)} fullWidth />
            </Stack>
          )}
          {kind === 'ExtendProbation' && <TextField type="date" label={t('staffActions.probationUntil')} value={until} onChange={(e) => setUntil(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} required />}
          {kind === 'RenewContract' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
              <TextField select label={t('staffActions.contractKind')} value={contractKind} onChange={(e) => setContractKind(e.target.value as 'Fixed' | 'Open')} fullWidth>
                <MenuItem value="Fixed">{t('staffActions.contractKinds.Fixed')}</MenuItem>
                <MenuItem value="Open">{t('staffActions.contractKinds.Open')}</MenuItem>
              </TextField>
              {contractKind === 'Fixed' && <TextField type="number" label={t('staffActions.contractMonths')} value={months} onChange={(e) => setMonths(e.target.value)} fullWidth />}
            </Stack>
          )}
          {(kind === 'Promotion' || kind === 'Transfer') && profile.canChangeSalary && (
            <FormControlLabel control={<Checkbox checked={withSalary} onChange={(e) => setWithSalary(e.target.checked)} />} label={t('staffActions.withSalary')} />
          )}
          {needsSalary && profile.canChangeSalary && (
            <>
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                {salaryKeys.map((k) => (
                  <TextField key={k} type="number" size="small" label={t(`staff.profile.fields.${salaryLabel[k]}`)} value={salary[k]} onChange={(e) => setSalary({ ...salary, [k]: Number(e.target.value) })} />
                ))}
              </Box>
              <Typography sx={{ fontWeight: 700, color: hr.success }}>
                {t('staff.profile.fields.total')}: <bdi>{total.toLocaleString('en-US')}</bdi>
                {s && <span style={{ color: hr.textMuted, fontWeight: 500 }}> ({t('staffActions.before')}: <bdi>{s.total.toLocaleString('en-US')}</bdi>)</span>}
              </Typography>
            </>
          )}
          <TextField label={t('staffActions.reason')} value={reason} onChange={(e) => setReason(e.target.value)} required multiline minRows={2} />
          <Alert severity="info">{t('staffActions.sendHint')}</Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={() => void send()} disabled={busy || !reason.trim()}>
          {t('staffActions.send')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** One action: what it changes (before → after), the request, and its approval. */
export function StaffActionPage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { date } = useCommercialFormat();
  const ar = i18n.language === 'ar';
  const [a, setA] = useState<StaffActionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const approval = useRecordApproval(a?.approval?.instanceId);
  useCrumb(a?.actionNo, `/hr/actions/${id}`);
  const reload = useCallback(async () => {
    try {
      setA(await staffApi.action(id));
      setError(null);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!a) {
    return (
      <HrScope>
        <ErrorMessage messageKey={error} />
        {!error && <LinearProgress />}
      </HrScope>
    );
  }

  const name = (r: { nameAr: string; nameEn: string } | null) => (r ? (ar ? r.nameAr : r.nameEn) : '—');
  const money = (n: number | null) => (n === null ? '—' : n.toLocaleString('en-US'));
  const d = (v: string | null) => (v ? date(v) : '—');
  const rows: [string, ReactNode, ReactNode][] = [];
  if (['Promotion', 'Transfer'].includes(a.kind)) {
    if (name(a.before.legalEntity) !== name(a.after.legalEntity)) rows.push([t('staffActions.field.legalEntity'), name(a.before.legalEntity), name(a.after.legalEntity)]);
    rows.push([t('staffActions.field.department'), name(a.before.department), name(a.after.department)]);
    rows.push([t('staffActions.field.jobTitle'), name(a.before.jobTitle), name(a.after.jobTitle)]);
    rows.push([t('staffActions.field.grade'), a.before.grade ?? '—', a.after.grade ?? '—']);
  }
  if (a.kind === 'Acting') rows.push([t('staffActions.field.acting'), name(a.before.jobTitle), t('staffActions.actingValue', { title: name(a.after.jobTitle), date: d(a.actingUntil), amount: money(a.actingAllowance) })]);
  if (a.newSalaryTotal !== null) rows.push([t('staffActions.field.salary'), money(a.oldSalaryTotal), money(a.newSalaryTotal)]);
  if (a.kind === 'ExtendProbation' || a.kind === 'ConfirmProbation') rows.push([t('staffActions.field.probation'), d(a.oldProbationEndsOn), a.kind === 'ConfirmProbation' ? t('staffActions.kind.ConfirmProbation') : d(a.newProbationEndsOn)]);
  if (a.kind === 'EndProbation') rows.push([t('staffActions.ends'), '—', d(a.effectiveFrom)]);
  if (a.kind === 'RenewContract')
    rows.push([t('staffActions.field.contract'), d(a.oldContractEndsOn), t('staffActions.contractValue', { kind: t(`staffActions.contractKinds.${a.newContractKind ?? 'Fixed'}`), months: a.newContractMonths ? ` · ${a.newContractMonths} ${t('staff.profile.fields.months')}` : '' })]);
  if (a.kind === 'NotRenew') rows.push([t('staffActions.ends'), '—', d(a.oldContractEndsOn)]);

  return (
    <HrScope>
      <HrPageHeader
        icon={actionIcon[a.kind]}
        title={t(`staffActions.kind.${a.kind}`)}
        status={<ActionStatusBadge status={a.status} />}
        reference={a.actionNo}
        subtitle={
          <>
            <Link component={RouterLink} to={`/hr/employees/${a.employeeId}`}>
              {a.employeeName}
            </Link>{' '}
            · <bdi>{a.employeeNo}</bdi> · {t('staffActions.effectiveFrom')} <bdi>{date(a.effectiveFrom)}</bdi>
          </>
        }
        actions={
          <>
            {a.canResubmit && (
              <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={() => void staffApi.resubmit(a.id).then(reload).catch((f) => setError(errorKey(f)))}>
                {t('staffActions.resubmit')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') }} />} onClick={() => navigate(-1)}>
              {t('common.back')}
            </Button>
          </>
        }
      />
      <ErrorMessage messageKey={error} />
      {a.approval && (
        <ApprovalBar
          status={a.approval}
          detail={approval.detail}
          onChanged={() => {
            void reload();
            void approval.reload();
          }}
        />
      )}
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, alignItems: 'start' }}>
        <Box sx={{ ...(hrCard as object), p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1.25 }}>{t('staffActions.changes')}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>{t('staffActions.before')}</TableCell>
                <TableCell>{t('staffActions.after')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(([label, before, after]) => (
                <TableRow key={label}>
                  <TableCell sx={{ color: hr.textMuted, fontWeight: 600 }}>{label}</TableCell>
                  <TableCell sx={{ color: hr.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                    <bdi>{before}</bdi>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums' }}>
                    <bdi>{after}</bdi>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ ...(hrCard as object), p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('staffActions.details')}</Typography>
          <Typography sx={{ fontSize: 13.5, mb: 1.25, whiteSpace: 'pre-wrap' }}>{a.reason}</Typography>
          <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>{t('staffActions.requestedBy', { by: a.createdByName, date: date(a.createdAt.slice(0, 10)) })}</Typography>
          {a.appliedAt && <Typography sx={{ fontSize: 12.5, color: hr.success, mt: 0.5 }}>{t('staffActions.appliedOn', { date: date(a.appliedAt.slice(0, 10)) })}</Typography>}
          {a.lastComment && <Alert severity={a.status === 'Applied' ? 'success' : 'warning'} sx={{ mt: 1.25 }}>{a.lastComment}</Alert>}
        </Box>
      </Box>
    </HrScope>
  );
}

/** Every employment action, newest first, filtered by status. */
export function StaffActionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { date } = useCommercialFormat();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const [rows, setRows] = useState<ActionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    staffApi.actions({ status }).then(setRows).catch((f) => setError(errorKey(f)));
  }, [status]);
  return (
    <HrScope>
      <HrPageHeader icon={<WorkHistoryOutlinedIcon />} title={t('staffActions.title')} subtitle={t('staffActions.intro')} />
      <ErrorMessage messageKey={error} />
      <Box sx={{ ...(hrCard as object), p: 2 }}>
        <TextField select size="small" label={t('staff.cols.status')} value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {}, { replace: true })} sx={{ width: 220, mb: 1.5 }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">{t('staffActions.all')}</MenuItem>
          {(['InApproval', 'Applied', 'Returned', 'Rejected'] as ActionStatus[]).map((s) => (
            <MenuItem key={s} value={s}>
              {t(`staffActions.status.${s}`)}
            </MenuItem>
          ))}
        </TextField>
        {!rows ? (
          <LinearProgress />
        ) : rows.length === 0 ? (
          <HrEmptyState icon={<WorkHistoryOutlinedIcon />} title={t('staffActions.none')} />
        ) : (
          <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
            <Table size="small" sx={{ '& td': { height: 46 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('staffActions.cols.no')}</TableCell>
                  <TableCell>{t('staffActions.cols.employee')}</TableCell>
                  <TableCell>{t('staffActions.cols.kind')}</TableCell>
                  <TableCell>{t('staffActions.cols.effective')}</TableCell>
                  <TableCell>{t('staffActions.cols.status')}</TableCell>
                  <TableCell>{t('staffActions.cols.by')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/hr/actions/${r.id}`)}>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      <bdi>{r.actionNo}</bdi>
                    </TableCell>
                    <TableCell>{r.employeeName}</TableCell>
                    <TableCell>
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, '& svg': { fontSize: 18, color: hr.primary } }}>
                        {actionIcon[r.kind]}
                        {t(`staffActions.kind.${r.kind}`)}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{date(r.effectiveFrom)}</TableCell>
                    <TableCell>
                      <ActionStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell sx={{ color: hr.textMuted }}>{r.createdByName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </HrScope>
  );
}
