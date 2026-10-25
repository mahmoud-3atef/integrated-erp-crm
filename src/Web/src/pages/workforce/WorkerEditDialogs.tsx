import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import { Alert, Box, Button, LinearProgress, Link, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workforceApi, type EditOption, type Salary, type SalaryChange, type SalaryInput, type WorkerDetail } from '../../api/workforce';
import { useCrumb } from '../../app/breadcrumbs';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { DateField } from '../../components/DateField';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { ApprovalBar, ShownStatus, useRecordApproval } from '../../components/workflow/RecordApproval';
import { Frame, useSave } from '../staff/StaffDialogs';

const salaryParts = ['basic', 'housing', 'food', 'transport', 'overtime', 'other', 'project', 'hardship'] as const;

const nz = (value: string) => (value.trim() === '' ? null : value.trim());
const num = (value: string) => (value.trim() === '' ? null : Number(value));
const text = (value: number | null) => (value === null ? '' : String(value));
const money = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The edit form's lists (nationalities and professions), loaded once per dialog. */
function useOptions() {
  const [options, setOptions] = useState<{ nationalities: EditOption[]; professions: EditOption[] } | null>(null);
  useEffect(() => {
    workforceApi.editOptions().then(setOptions).catch(() => setOptions({ nationalities: [], professions: [] }));
  }, []);
  return options;
}

/** Tells the editor that the old system still wins in the parallel phase (the user's decision, 2026-10-25). */
function SyncNote() {
  const { t } = useTranslation();
  return <Alert severity="info">{t('workforce.edit.syncNote')}</Alert>;
}

/**
 * All of a worker's data (the user's decision, 2026-10-25), with «workforce.workers.edit»: identity, job, contract and
 * leave. The project, the status and the work days come from the movements and are not edited here.
 */
export function WorkerDataDialog({ worker, onClose, onSaved }: { worker: WorkerDetail; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const options = useOptions();
  const w = worker.summary;
  const iqama = worker.identifiers.find((i) => i.type === 'Iqama' && i.isCurrent);
  const [f, setF] = useState({
    nameEn: w.name,
    nameAr: worker.nameAr ?? '',
    iqama: iqama?.number ?? '',
    iqamaExpiresOn: iqama?.expiresOn ?? '',
    nationalityCode: worker.nationalityCode ?? '',
    arrivedOn: worker.arrivedOn ?? '',
    professionCode: worker.professionCode ?? '',
    iqamaProfessionCode: worker.iqamaProfessionCode ?? '',
    sponsor: w.sponsor ?? '',
    recruitmentAgent: worker.recruitmentAgent ?? '',
    contractStartsOn: worker.contract.startsOn ?? '',
    contractMonths: text(worker.contract.months),
    contractEndsOn: worker.contract.endsOn ?? '',
    annualLeaveDays: text(worker.leave.annualDays),
    leaveBalance: text(worker.leave.balance),
    leaveConsumed: text(worker.leave.consumed),
    leaveOldConsumed: text(worker.leave.oldConsumed),
    leaveRemaining: text(worker.leave.remaining),
  });
  const set = (key: keyof typeof f) => (value: string) => setF((x) => ({ ...x, [key]: value }));
  const { busy, error, run } = useSave(onSaved);
  const pick = (list: EditOption[] | undefined, key: 'nationalityCode' | 'professionCode' | 'iqamaProfessionCode', label: string) => (
    <TextField select size="small" label={label} value={f[key]} onChange={(e) => set(key)(e.target.value)} disabled={!list}>
      <MenuItem value="">—</MenuItem>
      {(list ?? []).map((o) => (
        <MenuItem key={o.code} value={o.code}>
          {ar ? o.nameAr : o.nameEn}
        </MenuItem>
      ))}
    </TextField>
  );
  const save = () =>
    void run(() =>
      workforceApi.saveData(w.id, {
        nameEn: f.nameEn.trim(),
        nameAr: nz(f.nameAr),
        iqama: nz(f.iqama),
        iqamaExpiresOn: nz(f.iqamaExpiresOn),
        nationalityCode: nz(f.nationalityCode),
        arrivedOn: nz(f.arrivedOn),
        professionCode: nz(f.professionCode),
        iqamaProfessionCode: nz(f.iqamaProfessionCode),
        sponsor: nz(f.sponsor),
        recruitmentAgent: nz(f.recruitmentAgent),
        contractStartsOn: nz(f.contractStartsOn),
        contractMonths: num(f.contractMonths),
        contractEndsOn: nz(f.contractEndsOn),
        annualLeaveDays: num(f.annualLeaveDays),
        leaveBalance: num(f.leaveBalance),
        leaveConsumed: num(f.leaveConsumed),
        leaveOldConsumed: num(f.leaveOldConsumed),
        leaveRemaining: num(f.leaveRemaining),
      }),
    );
  const grid = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 };
  const date = (key: keyof typeof f, label: string) => <DateField size="small" label={label} value={f[key]} onChange={(e) => set(key)(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />;
  const number = (key: keyof typeof f, label: string) => (
    <TextField size="small" type="number" label={label} value={f[key]} onChange={(e) => set(key)(e.target.value)} slotProps={{ htmlInput: { min: 0, step: 'any' } }} />
  );
  return (
    <Frame open title={t('workforce.edit.dataTitle')} busy={busy} error={error} onClose={onClose} saveDisabled={!f.nameEn.trim()} onSave={save}>
      <SyncNote />
      <Typography sx={{ fontWeight: 700, color: tokens.navy800 }}>{t('workforce.sections.basic')}</Typography>
      <Box sx={grid}>
        <TextField size="small" required label={t('workforce.edit.nameEn')} value={f.nameEn} onChange={(e) => set('nameEn')(e.target.value)} slotProps={{ htmlInput: { maxLength: 300, dir: 'ltr' } }} />
        <TextField size="small" label={t('workforce.edit.nameAr')} value={f.nameAr} onChange={(e) => set('nameAr')(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
        <TextField size="small" label={t('workforce.field.iqama')} value={f.iqama} onChange={(e) => set('iqama')(e.target.value)} slotProps={{ htmlInput: { maxLength: 50, dir: 'ltr' } }} />
        {date('iqamaExpiresOn', t('workforce.overview.iqamaEnds'))}
        {pick(options?.nationalities, 'nationalityCode', t('workforce.col.nationality'))}
        {date('arrivedOn', t('workforce.field.arrived'))}
      </Box>
      <Typography sx={{ fontWeight: 700, color: tokens.navy800 }}>{t('workforce.sections.job')}</Typography>
      <Box sx={grid}>
        {pick(options?.professions, 'professionCode', t('workforce.col.profession'))}
        {pick(options?.professions, 'iqamaProfessionCode', t('workforce.field.iqamaProfession'))}
        <TextField size="small" label={t('workforce.col.sponsor')} value={f.sponsor} onChange={(e) => set('sponsor')(e.target.value)} slotProps={{ htmlInput: { maxLength: 100, dir: 'ltr' } }} />
        <TextField size="small" label={t('workforce.field.agent')} value={f.recruitmentAgent} onChange={(e) => set('recruitmentAgent')(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
      </Box>
      <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('workforce.edit.projectNote')}</Typography>
      <Typography sx={{ fontWeight: 700, color: tokens.navy800 }}>{t('workforce.sections.contract')}</Typography>
      <Box sx={grid}>
        {date('contractStartsOn', t('workforce.field.contractStart'))}
        {number('contractMonths', t('workforce.field.contractMonths'))}
        {date('contractEndsOn', t('workforce.field.contractEnd'))}
      </Box>
      <Typography sx={{ fontWeight: 700, color: tokens.navy800 }}>{t('workforce.sections.leave')}</Typography>
      <Box sx={grid}>
        {number('annualLeaveDays', t('workforce.leave.annual'))}
        {number('leaveBalance', t('workforce.leave.balance'))}
        {number('leaveOldConsumed', t('workforce.leave.oldConsumed'))}
        {number('leaveConsumed', t('workforce.leave.consumed'))}
        {number('leaveRemaining', t('workforce.leave.remaining'))}
      </Box>
    </Frame>
  );
}

function SalaryFields({ value, onChange }: { value: SalaryInput; onChange: (v: SalaryInput) => void }) {
  const { t } = useTranslation();
  const total = salaryParts.reduce((s, k) => s + (Number(value[k]) || 0), 0);
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        {salaryParts.map((k) => (
          <TextField
            key={k}
            type="number"
            size="small"
            label={t(`workforce.salary.${k}`)}
            value={value[k]}
            onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) || 0 })}
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
          />
        ))}
      </Box>
      <Typography sx={{ fontWeight: 700, color: '#1f9d55' }}>
        {t('workforce.salary.total')}: <bdi>{money(total)}</bdi>
      </Typography>
    </>
  );
}

const partsOf = (s: Salary): SalaryInput => ({ basic: s.basic, housing: s.housing, food: s.food, transport: s.transport, overtime: s.overtime, other: s.other, project: s.project, hardship: s.hardship });

/**
 * The salary: changed directly («workforce.workers.salary_edit»), or asked for with an effective date and a reason
 * («workforce.salary_changes.request»), which goes through approval and changes the file only once approved.
 */
export function WorkerSalaryDialog({ workerId, salary, request, onClose, onSaved }: { workerId: string; salary: Salary; request: boolean; onClose: () => void; onSaved: (changeId?: string) => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState<SalaryInput>(partsOf(salary));
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const created = useRef<string | undefined>(undefined);
  const { busy, error, run } = useSave(() => onSaved(created.current));
  const save = () =>
    void run(async () => {
      if (request) {
        const result = await workforceApi.requestSalaryChange(workerId, { salary: value, effectiveFrom: from, reason: nz(reason) });
        created.current = result.id;
      } else {
        await workforceApi.saveSalary(workerId, value);
      }
    });
  return (
    <Frame open title={t(request ? 'workforce.edit.requestTitle' : 'workforce.edit.salaryTitle')} busy={busy} error={error} onClose={onClose} saveDisabled={request && !reason.trim()} onSave={save}>
      {request ? <Alert severity="info">{t('workforce.edit.requestHint')}</Alert> : <SyncNote />}
      {request && <DateField size="small" label={t('workforce.edit.effectiveFrom')} value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />}
      <SalaryFields value={value} onChange={setValue} />
      {request && <TextField label={t('workforce.edit.reason')} value={reason} onChange={(e) => setReason(e.target.value)} required multiline minRows={2} slotProps={{ htmlInput: { maxLength: 1000 } }} />}
    </Frame>
  );
}

/** A salary change's state as a small badge. */
function ChangeStatus({ status }: { status: SalaryChange['status'] }) {
  const { t } = useTranslation();
  const look = { InApproval: ['#8A5700', '#FFF4DB'], Applied: ['#16734B', '#EAF6EF'], Returned: ['#475569', '#F1F5F9'], Rejected: ['#B42318', '#FEECEB'] }[status];
  return (
    <Box component="span" sx={{ px: 1.1, py: 0.3, borderRadius: 999, fontSize: 12, fontWeight: 600, color: look[0], bgcolor: look[1], whiteSpace: 'nowrap' }}>
      {t(`workforce.edit.status.${status}`)}
    </Box>
  );
}

/** The worker's salary changes under the salary box (for those who see salaries). */
export function SalaryChangesList({ workerId, version }: { workerId: string; version: number }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<SalaryChange[] | null>(null);
  useEffect(() => {
    workforceApi.salaryChanges(workerId).then(setRows).catch(() => setRows([]));
  }, [workerId, version]);
  if (!rows || rows.length === 0) return null;
  return (
    <Box sx={{ gridColumn: '1 / -1', mt: 0.5 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, mb: 0.75 }}>{t('workforce.edit.changes')}</Typography>
      <Stack spacing={0.75}>
        {rows.map((c) => (
          <Stack key={c.id} direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', fontSize: 13, p: 1, borderRadius: '10px', border: `1px solid ${tokens.border}` }}>
            <Link component={RouterLink} to={`/workforce/salary-changes/${c.id}`} sx={{ fontWeight: 700 }}>
              <bdi>{c.changeNo}</bdi>
            </Link>
            <ChangeStatus status={c.status} />
            <Box component="span" sx={{ flex: 1, color: tokens.gray600, fontVariantNumeric: 'tabular-nums' }}>
              <bdi>{money(c.oldSalary.total)}</bdi> ← <bdi>{money(c.newSalary.total)}</bdi>
            </Box>
            <Box component="span" sx={{ color: tokens.gray500, fontSize: 12 }}>
              <bdi>{c.effectiveFrom}</bdi>
            </Box>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

/** A salary change (/workforce/salary-changes/:id): its approval bar, the salary before and after, and the reason. */
export function SalaryChangePage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [c, setC] = useState<SalaryChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const approval = useRecordApproval(c?.approval?.instanceId);
  useCrumb(c?.changeNo, `/workforce/salary-changes/${id}`);
  const reload = useCallback(async () => {
    try {
      setC(await workforceApi.salaryChange(id));
      setError(null);
    } catch (f) {
      setError(errorKey(f));
    }
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);
  if (!c) {
    return (
      <>
        <ErrorMessage messageKey={error} />
        {!error && <LinearProgress />}
      </>
    );
  }
  const done = () => {
    void reload();
    void approval.reload();
  };
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ width: 46, height: 46, borderRadius: '12px', bgcolor: '#e9f7ef', color: '#1f9d55', display: 'grid', placeItems: 'center' }}>
          <PaidOutlinedIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h1" sx={{ fontSize: 21, fontWeight: 700, color: tokens.navy800 }}>
            {t('workforce.edit.changeTitle')} <bdi>{c.changeNo}</bdi>
          </Typography>
          <Typography sx={{ fontSize: 13, color: tokens.gray600 }}>
            <Link component={RouterLink} to={`/workforce/workers/${c.workerId}`}>
              <bdi>{c.workerName}</bdi>
            </Link>{' '}
            · <bdi>{c.workerNo}</bdi> · {t('workforce.edit.requestedBy', { by: c.requestedBy })}
          </Typography>
        </Box>
        <ShownStatus approval={approval.detail}>
          <ChangeStatus status={c.status} />
        </ShownStatus>
        <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') }} />} onClick={() => navigate(-1)}>
          {t('common.back')}
        </Button>
      </Stack>
      <ErrorMessage messageKey={error} />
      {c.approval && <ApprovalBar status={c.approval} detail={approval.detail} onChanged={done} />}
      {c.lastComment && c.status !== 'Applied' && (
        <Alert severity={c.status === 'Rejected' ? 'error' : 'warning'} sx={{ mb: 2 }}>
          {c.lastComment}
        </Alert>
      )}
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, display: 'grid', gap: 2.5 }}>
        <FieldSection title={t('workforce.edit.changeTitle')} icon={<PaidOutlinedIcon />} tone="green">
          <FieldBox label={t('workforce.edit.effectiveFrom')} icon={<PaidOutlinedIcon />}>
            <bdi>{c.effectiveFrom}</bdi>
          </FieldBox>
          <FieldBox label={t('workforce.edit.difference')} icon={<PaidOutlinedIcon />}>
            <bdi>{money(c.newSalary.total - c.oldSalary.total)}</bdi>
          </FieldBox>
          {c.reason && (
            <FieldBox label={t('workforce.edit.reason')} icon={<PaidOutlinedIcon />} wide multiline>
              {c.reason}
            </FieldBox>
          )}
        </FieldSection>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('workforce.edit.part')}</TableCell>
              <TableCell align="center">{t('workforce.edit.before')}</TableCell>
              <TableCell align="center">{t('workforce.edit.after')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...salaryParts, 'total' as const].map((k) => (
              <TableRow key={k} sx={k === 'total' ? { '& td': { fontWeight: 800 } } : undefined}>
                <TableCell>{t(`workforce.salary.${k}`)}</TableCell>
                <TableCell align="center">
                  <bdi>{money(c.oldSalary[k])}</bdi>
                </TableCell>
                <TableCell align="center" sx={{ color: c.newSalary[k] !== c.oldSalary[k] ? '#1d4f91' : undefined, fontWeight: c.newSalary[k] !== c.oldSalary[k] ? 700 : undefined }}>
                  <bdi>{money(c.newSalary[k])}</bdi>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
