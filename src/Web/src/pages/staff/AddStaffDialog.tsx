import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Link,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { staffApi, type CheckedEmployeeRow, type CreateEmployeesResult, type NewEmployee, type NewEmployeeOptions } from '../../api/staff';
import { ErrorMessage } from '../../auth/AuthLayout';
import { DateField } from '../../components/DateField';
import { wf } from '../../components/designKit';

const today = () => new Date().toISOString().slice(0, 10);
const empty = (): NewEmployee => ({
  nameEn: null,
  nameAr: null,
  nationality: null,
  idNumber: null,
  hireDate: today(),
  probationDays: 90,
  legalEntity: null,
  department: null,
  position: null,
  basic: null,
  housing: null,
  food: null,
  transport: null,
  mobile: null,
  project: null,
  other: null,
  mobileNumber: null,
  email: null,
});
const nz = (value: string) => (value.trim() === '' ? null : value);
const nn = (value: string) => (value.trim() === '' ? null : Number(value));

type Mode = 'one' | 'sheet';

/**
 * Adding employees (the user's request, 2026-10-25), like the workers but with an employee's data: no sponsor and no
 * border number; the job (registration, department, position with a free seat), the nationality and the salary. One
 * from the form, or many from the template, checked first; «اعتماد وإنشاء» creates the whole set when every row is clean.
 */
export function AddStaffDialog({ initialMode = 'one', onClose, onCreated }: { initialMode?: Mode; onClose: () => void; onCreated: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [options, setOptions] = useState<NewEmployeeOptions | null>(null);
  const [result, setResult] = useState<CreateEmployeesResult | null>(null);
  useEffect(() => {
    staffApi.newOptions().then(setOptions).catch(() => setOptions({ nationalities: [], legalEntities: [], departments: [], nextNumber: '' }));
  }, []);
  const done = (created: CreateEmployeesResult) => {
    setResult(created);
    onCreated(created.created.map((c) => c.id));
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth={mode === 'sheet' ? 'xl' : 'md'} slotProps={{ paper: { sx: { borderRadius: '18px' } } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {t('staff.create.title')}
        {!result && (
          <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v: Mode | null) => v && setMode(v)}>
            <ToggleButton value="one">{t('staff.create.one')}</ToggleButton>
            <ToggleButton value="sheet">{t('staff.create.sheet')}</ToggleButton>
          </ToggleButtonGroup>
        )}
      </DialogTitle>
      {result ? (
        <Created result={result} onClose={onClose} />
      ) : !options ? (
        <DialogContent>
          <LinearProgress />
        </DialogContent>
      ) : mode === 'one' ? (
        <OneEmployee options={options} onClose={onClose} onCreated={done} />
      ) : (
        <FromSheet options={options} onClose={onClose} onCreated={done} />
      )}
    </Dialog>
  );
}

function useIssue() {
  const { t } = useTranslation();
  return (field: string, code: string) => `${t(`staff.create.fields.${field}`)}: ${t(`staff.create.issues.${code}`)}`;
}

/** The positions of a department, with their free seats. */
function positionsOf(options: NewEmployeeOptions, department: string | null, ar: boolean, t: (k: string, o?: Record<string, unknown>) => string) {
  return (options.departments.find((d) => d.id === department)?.positions ?? []).map((p) => ({ id: p.id, label: t('staff.create.positionLabel', { title: ar ? p.jobTitleAr : p.jobTitleEn, free: p.free }), free: p.free }));
}

function OneEmployee({ options, onClose, onCreated }: { options: NewEmployeeOptions; onClose: () => void; onCreated: (r: CreateEmployeesResult) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const issue = useIssue();
  const [e, setE] = useState<NewEmployee>({ ...empty(), legalEntity: options.legalEntities.length === 1 ? options.legalEntities[0]!.id : null });
  const [issues, setIssues] = useState<CheckedEmployeeRow['issues']>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof NewEmployee>(key: K, value: NewEmployee[K]) => setE((x) => ({ ...x, [key]: value }));
  const errorOf = (field: string) => issues.find((i) => i.field === field);
  const helper = (field: string) => (errorOf(field) ? t(`staff.create.issues.${errorOf(field)!.code}`) : undefined);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await staffApi.createNew([e]);
      if (result.created.length > 0) onCreated(result);
      else setIssues(result.rows[0]?.issues ?? []);
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };
  const select = (field: 'nationality' | 'legalEntity' | 'department', list: { id: string; nameAr: string; nameEn: string }[], onPick?: () => void) => (
    <TextField
      select
      size="small"
      required
      label={t(`staff.create.fields.${field}`)}
      value={e[field] ?? ''}
      onChange={(ev) => {
        set(field, nz(ev.target.value));
        onPick?.();
      }}
      error={!!errorOf(field)}
      helperText={helper(field)}
    >
      <MenuItem value="">—</MenuItem>
      {list.map((o) => (
        <MenuItem key={o.id} value={o.id}>
          {ar ? o.nameAr : o.nameEn}
        </MenuItem>
      ))}
    </TextField>
  );
  const text = (field: 'nameEn' | 'nameAr' | 'idNumber' | 'mobileNumber' | 'email', ltr = false, required = false) => (
    <TextField size="small" required={required} label={t(`staff.create.fields.${field}`)} value={e[field] ?? ''} onChange={(ev) => set(field, nz(ev.target.value))} error={!!errorOf(field)} helperText={helper(field)} slotProps={{ htmlInput: { maxLength: field.startsWith('name') ? 300 : 200, dir: ltr ? 'ltr' : undefined } }} />
  );
  const money = (field: 'basic' | 'housing' | 'food' | 'transport' | 'mobile' | 'project' | 'other', required = false) => (
    <TextField size="small" type="number" required={required} label={t(`staff.create.fields.${field}`)} value={e[field] ?? ''} onChange={(ev) => set(field, nn(ev.target.value))} error={!!errorOf(field)} helperText={helper(field)} slotProps={{ htmlInput: { min: 0, step: 'any' } }} />
  );
  const grid = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.5 };
  const title = (key: string) => <Typography sx={{ fontWeight: 700, color: wf.navy, mt: 0.5 }}>{t(key)}</Typography>;
  const total = ['basic', 'housing', 'food', 'transport', 'mobile', 'project', 'other'].reduce((s, k) => s + (Number(e[k as keyof NewEmployee]) || 0), 0);
  return (
    <>
      <DialogContent>
        <Stack sx={{ gap: 1.5, pt: 1 }}>
          <ErrorMessage messageKey={error} />
          <Alert severity="info">{t('staff.create.numberHint', { number: options.nextNumber })}</Alert>
          {issues.length > 0 && <Alert severity="warning">{issues.map((i) => issue(i.field, i.code)).join(' · ')}</Alert>}
          {title('staff.profile.boxes.basic')}
          <Box sx={grid}>
            {text('nameEn', true, true)}
            {text('nameAr')}
            {select('nationality', options.nationalities)}
            {text('idNumber', true)}
            {text('mobileNumber', true)}
            {text('email', true)}
          </Box>
          {title('staff.profile.boxes.job')}
          <Box sx={grid}>
            {select('legalEntity', options.legalEntities)}
            {select('department', options.departments, () => set('position', null))}
            <TextField select size="small" required label={t('staff.create.fields.position')} value={e.position ?? ''} onChange={(ev) => set('position', nz(ev.target.value))} disabled={!e.department} error={!!errorOf('position')} helperText={helper('position')}>
              <MenuItem value="">—</MenuItem>
              {positionsOf(options, e.department, ar, t).map((p) => (
                <MenuItem key={p.id} value={p.id} disabled={p.free <= 0}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            <DateField size="small" required label={t('staff.create.fields.hireDate')} value={e.hireDate ?? ''} onChange={(ev) => set('hireDate', nz(ev.target.value))} error={!!errorOf('hireDate')} helperText={helper('hireDate')} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="number" label={t('staff.create.fields.probationDays')} value={e.probationDays ?? ''} onChange={(ev) => set('probationDays', nn(ev.target.value))} error={!!errorOf('probationDays')} helperText={helper('probationDays')} slotProps={{ htmlInput: { min: 0, max: 180 } }} />
          </Box>
          {title('staff.profile.boxes.salary')}
          <Box sx={grid}>
            {money('basic', true)}
            {money('housing')}
            {money('food')}
            {money('transport')}
            {money('mobile')}
            {money('project')}
            {money('other')}
          </Box>
          <Typography sx={{ fontWeight: 700, color: '#1f9d55' }}>
            {t('staff.profile.fields.total')}: <bdi>{total.toLocaleString('en-US')}</bdi>
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy} sx={{ bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }}>
          {t('staff.create.save')}
        </Button>
      </DialogActions>
    </>
  );
}

function FromSheet({ options, onClose, onCreated }: { options: NewEmployeeOptions; onClose: () => void; onCreated: (r: CreateEmployeesResult) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const issue = useIssue();
  const [rows, setRows] = useState<CheckedEmployeeRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };
  const read = (file: File) =>
    void run(async () => {
      setRows(await staffApi.readNew(file));
      setDirty(false);
    });
  const check = () =>
    void run(async () => {
      setRows(await staffApi.checkNew(rows!.map((r) => r.input)));
      setDirty(false);
    });
  const create = () =>
    void run(async () => {
      const result = await staffApi.createNew(rows!.map((r) => r.input));
      if (result.created.length > 0) onCreated(result);
      else setRows(result.rows);
    });
  const edit = (index: number, change: Partial<NewEmployee>) => {
    setRows((list) => list!.map((r, i) => (i === index ? { ...r, input: { ...r.input, ...change } } : r)));
    setDirty(true);
  };
  const wrong = rows?.filter((r) => r.issues.length > 0).length ?? 0;
  const columns = ['nameEn', 'nationality', 'legalEntity', 'department', 'position', 'hireDate', 'basic'];
  const shown = new Set(columns);
  const cellIssue = (r: CheckedEmployeeRow, field: string) => r.issues.find((i) => i.field === field);
  const typed = (r: CheckedEmployeeRow, field: keyof NewEmployee) => (cellIssue(r, field)?.code === 'unknown' ? String(r.input[field] ?? '') : '');
  const pick = (r: CheckedEmployeeRow, index: number, field: 'nationality' | 'legalEntity' | 'department', list: { id: string; nameAr: string; nameEn: string }[]) => (
    <Tooltip title={typed(r, field) ? t('staff.create.typed', { value: typed(r, field) }) : ''}>
      <TextField
        select
        size="small"
        fullWidth
        value={list.some((o) => o.id === r.input[field]) ? r.input[field] : ''}
        onChange={(ev) => edit(index, field === 'department' ? { department: ev.target.value, position: null } : { [field]: ev.target.value })}
        error={!!cellIssue(r, field)}
      >
        <MenuItem value="">—</MenuItem>
        {list.map((o) => (
          <MenuItem key={o.id} value={o.id}>
            {ar ? o.nameAr : o.nameEn}
          </MenuItem>
        ))}
      </TextField>
    </Tooltip>
  );
  return (
    <>
      <DialogContent>
        <Stack sx={{ gap: 1.5, pt: 1 }}>
          <ErrorMessage messageKey={error} />
          <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' } }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700, color: wf.navy }}>{t('workforce.create.step1')}</Typography>
              <Typography sx={{ fontSize: 13, color: wf.textSecondary }}>{t('staff.create.step1Hint')}</Typography>
            </Box>
            <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} component="a" href={staffApi.newTemplateUrl}>
              {t('workforce.create.template')}
            </Button>
            <Button variant="contained" startIcon={<FileUploadOutlinedIcon />} onClick={() => input.current?.click()} disabled={busy} sx={{ bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }}>
              {rows ? t('workforce.create.uploadAgain') : t('workforce.create.upload')}
            </Button>
            <input
              ref={input}
              type="file"
              hidden
              accept=".xlsx"
              onChange={(ev) => {
                const file = ev.target.files?.[0];
                ev.target.value = '';
                if (file) read(file);
              }}
            />
          </Stack>
          {busy && <LinearProgress />}
          {rows && (
            <>
              <Alert severity={wrong > 0 ? 'warning' : 'success'} icon={wrong > 0 ? <ErrorOutlineIcon /> : <CheckCircleOutlineIcon />}>
                {wrong > 0 ? t('workforce.create.summaryWrong', { total: rows.length, wrong }) : t('workforce.create.summaryOk', { total: rows.length })}
              </Alert>
              <TableContainer sx={{ maxHeight: '55vh', border: `1px solid ${wf.border}`, borderRadius: wf.control }}>
                <Table size="small" stickyHeader sx={{ '& th': { bgcolor: `${wf.navy} !important`, color: '#fff', fontSize: 12.5, whiteSpace: 'nowrap' }, '& td': { fontSize: 13, verticalAlign: 'top' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      {columns.map((f) => (
                        <TableCell key={f}>{t(`staff.create.fields.${f}`)}</TableCell>
                      ))}
                      <TableCell>{t('workforce.create.notes')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r, index) => (
                      <TableRow key={r.row} sx={r.issues.length > 0 ? { '& td': { bgcolor: `${wf.warning.bg} !important` } } : undefined}>
                        <TableCell>{r.row}</TableCell>
                        <TableCell sx={{ minWidth: 170 }}>
                          <TextField size="small" fullWidth value={r.input.nameEn ?? r.input.nameAr ?? ''} onChange={(ev) => edit(index, { nameEn: nz(ev.target.value) })} error={!!cellIssue(r, 'nameEn')} />
                        </TableCell>
                        <TableCell sx={{ minWidth: 140 }}>{pick(r, index, 'nationality', options.nationalities)}</TableCell>
                        <TableCell sx={{ minWidth: 140 }}>{pick(r, index, 'legalEntity', options.legalEntities)}</TableCell>
                        <TableCell sx={{ minWidth: 140 }}>{pick(r, index, 'department', options.departments)}</TableCell>
                        <TableCell sx={{ minWidth: 160 }}>
                          <Tooltip title={typed(r, 'position') ? t('staff.create.typed', { value: typed(r, 'position') }) : ''}>
                            <TextField select size="small" fullWidth value={positionsOf(options, r.input.department, ar, t).some((p) => p.id === r.input.position) ? r.input.position : ''} onChange={(ev) => edit(index, { position: ev.target.value })} error={!!cellIssue(r, 'position')} disabled={!r.input.department}>
                              <MenuItem value="">—</MenuItem>
                              {positionsOf(options, r.input.department, ar, t).map((p) => (
                                <MenuItem key={p.id} value={p.id}>
                                  {p.label}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ minWidth: 150 }}>
                          <DateField size="small" value={r.input.hireDate ?? ''} onChange={(ev) => edit(index, { hireDate: nz(ev.target.value) })} error={!!cellIssue(r, 'hireDate')} />
                        </TableCell>
                        <TableCell sx={{ minWidth: 110 }}>
                          <TextField size="small" fullWidth type="number" value={r.input.basic ?? ''} onChange={(ev) => edit(index, { basic: nn(ev.target.value) })} error={!!cellIssue(r, 'basic')} slotProps={{ htmlInput: { min: 0, step: 'any' } }} />
                        </TableCell>
                        <TableCell sx={{ minWidth: 220 }}>
                          {r.issues.length === 0 ? (
                            <Box component="span" sx={{ color: wf.success.fg, fontWeight: 600 }}>
                              {t('workforce.create.rowOk')}
                            </Box>
                          ) : (
                            <Stack sx={{ gap: 0.25 }}>
                              {r.issues.map((i) => (
                                <Typography key={`${i.field}${i.code}`} sx={{ fontSize: 12, color: shown.has(i.field) ? wf.danger.fg : wf.warning.fg }}>
                                  {issue(i.field, i.code)}
                                  {!shown.has(i.field) && ` ${t('workforce.create.fixInSheet')}`}
                                </Typography>
                              ))}
                            </Stack>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        {rows && (
          <Button variant="outlined" onClick={check} disabled={busy}>
            {t('workforce.create.check')}
          </Button>
        )}
        {rows && (
          <Tooltip title={wrong > 0 || dirty ? t('workforce.create.fixFirst') : ''}>
            <span>
              <Button variant="contained" onClick={create} disabled={busy || wrong > 0 || dirty} sx={{ bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }}>
                {t('workforce.create.approve', { count: rows.length })}
              </Button>
            </span>
          </Tooltip>
        )}
      </DialogActions>
    </>
  );
}

function Created({ result, onClose }: { result: CreateEmployeesResult; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <DialogContent>
        <Alert severity="success" sx={{ mb: 1.5 }}>
          {t('staff.create.done', { count: result.created.length })}
        </Alert>
        <Stack sx={{ gap: 0.5, maxHeight: '50vh', overflow: 'auto' }}>
          {result.created.map((c) => (
            <Link key={c.id} component={RouterLink} to={`/hr/employees/${c.id}`} onClick={onClose}>
              <bdi>{c.employeeNo}</bdi> — <bdi>{c.name}</bdi>
            </Link>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={onClose} sx={{ bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </>
  );
}
