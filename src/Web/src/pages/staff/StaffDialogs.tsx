import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { staffApi, staffStatuses, type Department, type SalaryValues, type StaffProfile, type StaffStatus } from '../../api/staff';
import { ErrorMessage } from '../../auth/AuthLayout';
import { useLegalEntities } from '../payroll/RunDialogs';

// The employee file's dialogs: a new hire, and the edits of a box of the file (personal data, job, contract, salary).

const salaryKeys: (keyof SalaryValues)[] = ['basic', 'housing', 'food', 'transport', 'mobile', 'project', 'other'];
const salaryLabel: Record<keyof SalaryValues, string> = { basic: 'basic', housing: 'housing', food: 'food', transport: 'transport', mobile: 'mobileAllowance', project: 'project', other: 'other' };
const emptySalary: SalaryValues = { basic: 0, housing: 0, food: 0, transport: 0, mobile: 0, project: 0, other: 0 };
const nz = (v: string) => (v.trim() === '' ? null : v.trim());

function Frame({ open, title, busy, error, onClose, onSave, saveDisabled, children }: { open: boolean; title: string; busy: boolean; error: string | null; onClose: () => void; onSave: () => void; saveDisabled?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: '18px' } } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{title}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, pt: 1 }}>
          <ErrorMessage messageKey={error} />
          {children}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={onSave} disabled={busy || saveDisabled}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function useSave(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onDone();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function SalaryFields({ value, onChange }: { value: SalaryValues; onChange: (v: SalaryValues) => void }) {
  const { t } = useTranslation();
  const total = salaryKeys.reduce((s, k) => s + (Number(value[k]) || 0), 0);
  return (
    <>
      <Stack sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        {salaryKeys.map((k) => (
          <TextField key={k} type="number" size="small" label={t(`staff.profile.fields.${salaryLabel[k]}`)} value={value[k]} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })} slotProps={{ htmlInput: { min: 0, step: 'any' } }} />
        ))}
      </Stack>
      <Typography sx={{ fontWeight: 700, color: '#1f9d55' }}>
        {t('staff.profile.fields.total')}: <bdi>{total.toLocaleString('en-US')}</bdi>
      </Typography>
    </>
  );
}

/** The positions of a department with their free seats, for the job pickers. */
function positionsOf(departments: Department[], departmentId: string, language: string, t: (k: string, o?: Record<string, unknown>) => string) {
  return (departments.find((d) => d.id === departmentId)?.positions ?? [])
    .filter((p) => p.isActive)
    .map((p) => ({ id: p.id, label: t('staff.dialogs.positionLabel', { title: language === 'ar' ? p.jobTitleAr : p.jobTitleEn, taken: p.occupants.length, seats: p.seats }) }));
}

export function HireDialog({ open, departments, onClose, onSaved }: { open: boolean; departments: Department[]; onClose: () => void; onSaved: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const entities = useLegalEntities();
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [hireDate, setHireDate] = useState(new Date().toISOString().slice(0, 10));
  const [probation, setProbation] = useState(90);
  const [entity, setEntity] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState<SalaryValues>(emptySalary);
  const [created, setCreated] = useState<string | null>(null);
  const { busy, error, run } = useSave(() => created && onSaved(created));
  useEffect(() => {
    if (created) onSaved(created);
  }, [created, onSaved]);

  return (
    <Frame
      open={open}
      title={t('staff.dialogs.hire')}
      busy={busy}
      error={error}
      onClose={onClose}
      saveDisabled={!nameAr.trim() && !nameEn.trim()}
      onSave={() =>
        void run(async () =>
          setCreated(
            (await staffApi.hire({ nameAr: nz(nameAr), nameEn: nameEn.trim() || nameAr.trim(), hireDate, probationDays: probation, legalEntityId: entity || null, departmentId: department || null, positionId: position || null, salary })).id,
          ),
        )
      }
    >
      <Stack direction="row" sx={{ gap: 1.5 }}>
        <TextField label={t('staff.profile.fields.nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} fullWidth />
        <TextField label={t('staff.profile.fields.nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} fullWidth />
      </Stack>
      <Stack direction="row" sx={{ gap: 1.5 }}>
        <TextField type="date" label={t('staff.profile.fields.hireDate')} value={hireDate} onChange={(e) => setHireDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
        <TextField type="number" label={t('staff.dialogs.probationDays')} value={probation} onChange={(e) => setProbation(Number(e.target.value))} fullWidth />
      </Stack>
      <TextField select label={t('staff.profile.fields.legalEntity')} value={entity} onChange={(e) => setEntity(e.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
        <MenuItem value="">{t('staff.dialogs.noEntity')}</MenuItem>
        {entities.map((e) => (
          <MenuItem key={e.id} value={e.id}>
            {localName(e, i18n.language)}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction="row" sx={{ gap: 1.5 }}>
        <TextField select label={t('staff.profile.fields.department')} value={department} onChange={(e) => (setDepartment(e.target.value), setPosition(''))} fullWidth slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">{t('staff.dialogs.noDepartment')}</MenuItem>
          {departments.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {i18n.language === 'ar' ? d.nameAr : d.nameEn}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label={t('staff.profile.fields.position')} value={position} onChange={(e) => setPosition(e.target.value)} fullWidth disabled={!department} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">{t('staff.dialogs.noPosition')}</MenuItem>
          {positionsOf(departments, department, i18n.language, t).map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <SalaryFields value={salary} onChange={setSalary} />
    </Frame>
  );
}

export function PersonalDialog({ profile, onClose, onSaved }: { profile: StaffProfile; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const [v, setV] = useState({
    nameAr: profile.nameAr ?? '',
    nameEn: profile.nameEn,
    idNumber: profile.idNumber ?? '',
    nationalityCode: profile.nationalityCode ?? '',
    birthDate: profile.birthDate ?? '',
    mobile: profile.mobile ?? '',
    email: profile.email ?? '',
    gosiNo: profile.gosiNo ?? '',
  });
  const [nationalities, setNationalities] = useState<{ code: string; nameAr: string; nameEn: string }[]>([]);
  useEffect(() => {
    staffApi.nationalities().then(setNationalities).catch(() => setNationalities([]));
  }, []);
  const { busy, error, run } = useSave(onSaved);
  const field = (key: keyof typeof v, label: string, type = 'text') => (
    <TextField type={type} label={t(`staff.profile.fields.${label}`)} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} fullWidth slotProps={type === 'date' ? { inputLabel: { shrink: true } } : undefined} />
  );
  return (
    <Frame
      open
      title={t('staff.dialogs.personal')}
      busy={busy}
      error={error}
      onClose={onClose}
      saveDisabled={!v.nameEn.trim()}
      onSave={() =>
        void run(() =>
          staffApi.setPersonal(profile.id, { nameAr: nz(v.nameAr), nameEn: v.nameEn.trim(), idNumber: nz(v.idNumber), nationalityCode: nz(v.nationalityCode), birthDate: nz(v.birthDate), mobile: nz(v.mobile), email: nz(v.email), gosiNo: nz(v.gosiNo) }),
        )
      }
    >
      <Stack direction="row" sx={{ gap: 1.5 }}>
        {field('nameAr', 'nameAr')}
        {field('nameEn', 'nameEn')}
      </Stack>
      <Stack direction="row" sx={{ gap: 1.5 }}>
        {field('idNumber', 'idNumber')}
        <TextField select label={t('staff.profile.fields.nationality')} value={v.nationalityCode} onChange={(e) => setV({ ...v, nationalityCode: e.target.value })} fullWidth>
          <MenuItem value="">—</MenuItem>
          {nationalities.map((n) => (
            <MenuItem key={n.code} value={n.code}>
              {i18n.language === 'ar' ? n.nameAr : n.nameEn}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Stack direction="row" sx={{ gap: 1.5 }}>
        {field('birthDate', 'birthDate', 'date')}
        {field('mobile', 'mobile')}
      </Stack>
      <Stack direction="row" sx={{ gap: 1.5 }}>
        {field('email', 'email')}
        {field('gosiNo', 'gosiNo')}
      </Stack>
    </Frame>
  );
}

export function JobDialog({ profile, departments, onClose, onSaved }: { profile: StaffProfile; departments: Department[]; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const entities = useLegalEntities();
  const [entity, setEntity] = useState(profile.legalEntity?.id ?? '');
  const [department, setDepartment] = useState(profile.department?.id ?? '');
  const [position, setPosition] = useState(profile.positionId ?? '');
  const [hire, setHire] = useState(profile.hireDate ?? '');
  const [probation, setProbation] = useState(profile.probationEndsOn ?? '');
  const [status, setStatus] = useState<StaffStatus>(profile.status);
  const { busy, error, run } = useSave(onSaved);
  return (
    <Frame
      open
      title={t('staff.dialogs.job')}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={() => void run(() => staffApi.setJob(profile.id, { legalEntityId: entity || null, departmentId: department || null, positionId: position || null, hireDate: nz(hire), probationEndsOn: nz(probation), status }))}
    >
      <TextField select label={t('staff.profile.fields.legalEntity')} value={entity} onChange={(e) => setEntity(e.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
        <MenuItem value="">{t('staff.dialogs.noEntity')}</MenuItem>
        {entities.map((e) => (
          <MenuItem key={e.id} value={e.id}>
            {localName(e, i18n.language)}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction="row" sx={{ gap: 1.5 }}>
        <TextField select label={t('staff.profile.fields.department')} value={department} onChange={(e) => (setDepartment(e.target.value), setPosition(''))} fullWidth slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">{t('staff.dialogs.noDepartment')}</MenuItem>
          {departments.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {i18n.language === 'ar' ? d.nameAr : d.nameEn}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label={t('staff.profile.fields.position')} value={position} onChange={(e) => setPosition(e.target.value)} fullWidth disabled={!department} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">{t('staff.dialogs.noPosition')}</MenuItem>
          {positionsOf(departments, department, i18n.language, t).map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Stack direction="row" sx={{ gap: 1.5 }}>
        <TextField type="date" label={t('staff.profile.fields.hireDate')} value={hire} onChange={(e) => setHire(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="date" label={t('staff.profile.fields.probationEnds')} value={probation} onChange={(e) => setProbation(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
      </Stack>
      <TextField select label={t('staff.profile.fields.status')} value={status} onChange={(e) => setStatus(e.target.value as StaffStatus)}>
        {staffStatuses.map((s) => (
          <MenuItem key={s} value={s}>
            {t(`staff.status.${s}`)}
          </MenuItem>
        ))}
      </TextField>
    </Frame>
  );
}

export function ContractDialog({ profile, onClose, onSaved }: { profile: StaffProfile; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [start, setStart] = useState(profile.contractStartsOn ?? '');
  const [months, setMonths] = useState(profile.contractMonths?.toString() ?? '');
  const [end, setEnd] = useState(profile.contractEndsOn ?? '');
  const { busy, error, run } = useSave(onSaved);
  return (
    <Frame open title={t('staff.dialogs.contract')} busy={busy} error={error} onClose={onClose} onSave={() => void run(() => staffApi.setContract(profile.id, { startsOn: nz(start), months: months ? Number(months) : null, endsOn: nz(end) }))}>
      <Stack direction="row" sx={{ gap: 1.5 }}>
        <TextField type="date" label={t('staff.profile.fields.contractStart')} value={start} onChange={(e) => setStart(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="number" label={t('staff.profile.fields.contractMonths')} value={months} onChange={(e) => setMonths(e.target.value)} fullWidth />
      </Stack>
      <TextField type="date" label={t('staff.profile.fields.contractEnd')} value={end} onChange={(e) => setEnd(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    </Frame>
  );
}

export function SalaryDialog({ profile, onClose, onSaved }: { profile: StaffProfile; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const current = profile.salary;
  const [salary, setSalary] = useState<SalaryValues>(current ? { basic: current.basic, housing: current.housing, food: current.food, transport: current.transport, mobile: current.mobile, project: current.project, other: current.other } : emptySalary);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const { busy, error, run } = useSave(onSaved);
  return (
    <Frame open title={t('staff.dialogs.salary')} busy={busy} error={error} onClose={onClose} saveDisabled={!reason.trim()} onSave={() => void run(() => staffApi.changeSalary(profile.id, { effectiveFrom: from, salary, reason: reason.trim() }))}>
      <Alert severity="info">{t('staff.dialogs.salaryHint')}</Alert>
      <TextField type="date" label={t('staff.dialogs.effectiveFrom')} value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <SalaryFields value={salary} onChange={setSalary} />
      <TextField label={t('staff.dialogs.reason')} value={reason} onChange={(e) => setReason(e.target.value)} required multiline minRows={2} />
    </Frame>
  );
}
