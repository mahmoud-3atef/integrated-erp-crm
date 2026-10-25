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
import { workforceApi, type CheckedRow, type CreateOptions, type CreateResult, type NewWorker } from '../../api/workforce';
import { ErrorMessage } from '../../auth/AuthLayout';
import { DateField } from '../../components/DateField';
import { wf } from '../../components/designKit';

const empty: NewWorker = {
  nameEn: null,
  nameAr: null,
  nationality: null,
  profession: null,
  iqamaProfession: null,
  sponsor: null,
  iqama: null,
  iqamaExpiresOn: null,
  borderNumber: null,
  passport: null,
  arrivedOn: null,
  recruitmentAgent: null,
  basic: null,
  housing: null,
  food: null,
  transport: null,
  other: null,
  supplierMonthlyCost: null,
  costMethod: null,
};

// A worker on another sponsor than the company's (Care-Pro) comes from a supplier: their monthly cost is required.
const isSupplier = (sponsor: string | null) => !!sponsor && !sponsor.trim().toLowerCase().startsWith('care-pro');
const nz = (value: string) => (value.trim() === '' ? null : value);
const nn = (value: string) => (value.trim() === '' ? null : Number(value));

type Mode = 'one' | 'sheet';

/**
 * Adding workers (the user's request, 2026-10-25): one from a form whose lists are picked, not typed; or many from the
 * template, which is read and checked first. Each wrong value is shown on its row to fix here (or in the sheet, then
 * uploaded again), and «اعتماد وإنشاء» creates the whole set only when every row is clean.
 */
export function AddWorkersDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('one');
  const [options, setOptions] = useState<CreateOptions | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  useEffect(() => {
    workforceApi.newOptions().then(setOptions).catch(() => setOptions({ nationalities: [], professions: [], sponsors: [], nextNumber: '' }));
  }, []);
  const done = (created: CreateResult) => {
    setResult(created);
    onCreated();
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth={mode === 'sheet' ? 'xl' : 'md'} slotProps={{ paper: { sx: { borderRadius: '18px' } } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {t('workforce.create.title')}
        {!result && (
          <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v: Mode | null) => v && setMode(v)}>
            <ToggleButton value="one">{t('workforce.create.one')}</ToggleButton>
            <ToggleButton value="sheet">{t('workforce.create.sheet')}</ToggleButton>
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
        <OneWorker options={options} onClose={onClose} onCreated={done} />
      ) : (
        <FromSheet options={options} onClose={onClose} onCreated={done} />
      )}
    </Dialog>
  );
}

/** The issue of a field in words: «الجنسية: غير موجودة في القائمة». */
function useIssue() {
  const { t } = useTranslation();
  return (field: string, code: string) => `${t(`workforce.create.fields.${field}`)}: ${t(`workforce.create.issues.${code}`)}`;
}

function OneWorker({ options, onClose, onCreated }: { options: CreateOptions; onClose: () => void; onCreated: (r: CreateResult) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const issue = useIssue();
  const [w, setW] = useState<NewWorker>({ ...empty, costMethod: 'MonthlyFixed' });
  const [issues, setIssues] = useState<CheckedRow['issues']>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof NewWorker>(key: K, value: NewWorker[K]) => setW((x) => ({ ...x, [key]: value }));
  const errorOf = (field: string) => issues.find((i) => i.field === field);
  const helper = (field: string) => (errorOf(field) ? t(`workforce.create.issues.${errorOf(field)!.code}`) : undefined);
  const supplier = isSupplier(w.sponsor);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await workforceApi.createNew([{ ...w, supplierMonthlyCost: supplier ? w.supplierMonthlyCost : null }]);
      if (result.created.length > 0) onCreated(result);
      else setIssues(result.rows[0]?.issues ?? []);
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };
  const pick = (field: 'nationality' | 'profession' | 'iqamaProfession', list: CreateOptions['professions'], required: boolean) => (
    <TextField select size="small" required={required} label={t(`workforce.create.fields.${field}`)} value={w[field] ?? ''} onChange={(e) => set(field, nz(e.target.value))} error={!!errorOf(field)} helperText={helper(field)}>
      <MenuItem value="">—</MenuItem>
      {list.map((o) => (
        <MenuItem key={o.code} value={o.code}>
          {ar ? o.nameAr : o.nameEn}
        </MenuItem>
      ))}
    </TextField>
  );
  const text = (field: 'nameEn' | 'nameAr' | 'iqama' | 'borderNumber' | 'passport' | 'recruitmentAgent', required = false, ltr = false) => (
    <TextField size="small" required={required} label={t(`workforce.create.fields.${field}`)} value={w[field] ?? ''} onChange={(e) => set(field, nz(e.target.value))} error={!!errorOf(field)} helperText={helper(field)} slotProps={{ htmlInput: { maxLength: field.startsWith('name') ? 300 : 50, dir: ltr ? 'ltr' : undefined } }} />
  );
  const money = (field: 'basic' | 'housing' | 'food' | 'transport' | 'other' | 'supplierMonthlyCost', required = false) => (
    <TextField size="small" type="number" required={required} label={t(`workforce.create.fields.${field === 'supplierMonthlyCost' ? 'cost' : field}`)} value={w[field] ?? ''} onChange={(e) => set(field, nn(e.target.value))} error={!!errorOf(field === 'supplierMonthlyCost' ? 'cost' : field)} helperText={helper(field === 'supplierMonthlyCost' ? 'cost' : field)} slotProps={{ htmlInput: { min: 0, step: 'any' } }} />
  );
  const grid = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.5 };
  const title = (key: string) => <Typography sx={{ fontWeight: 700, color: wf.navy, mt: 0.5 }}>{t(key)}</Typography>;
  return (
    <>
      <DialogContent>
        <Stack sx={{ gap: 1.5, pt: 1 }}>
          <ErrorMessage messageKey={error} />
          <Alert severity="info">{t('workforce.create.numberHint', { number: options.nextNumber })}</Alert>
          {issues.length > 0 && <Alert severity="warning">{issues.map((i) => issue(i.field, i.code)).join(' · ')}</Alert>}
          {title('workforce.sections.basic')}
          <Box sx={grid}>
            {text('nameEn', true, true)}
            {text('nameAr')}
            {pick('nationality', options.nationalities, true)}
            {text('iqama', false, true)}
            <DateField size="small" label={t('workforce.create.fields.iqamaExpiresOn')} value={w.iqamaExpiresOn ?? ''} onChange={(e) => set('iqamaExpiresOn', nz(e.target.value))} slotProps={{ inputLabel: { shrink: true } }} />
            {text('borderNumber', false, true)}
            {text('passport', false, true)}
            <DateField size="small" required label={t('workforce.create.fields.arrivedOn')} value={w.arrivedOn ?? ''} onChange={(e) => set('arrivedOn', nz(e.target.value))} error={!!errorOf('arrivedOn')} helperText={helper('arrivedOn')} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>
          <Typography sx={{ fontSize: 12.5, color: wf.textSecondary }}>{t('workforce.create.identityHint')}</Typography>
          {title('workforce.sections.job')}
          <Box sx={grid}>
            {pick('profession', options.professions, true)}
            {pick('iqamaProfession', options.professions, false)}
            <TextField select size="small" required label={t('workforce.create.fields.sponsor')} value={w.sponsor ?? ''} onChange={(e) => set('sponsor', nz(e.target.value))} error={!!errorOf('sponsor')} helperText={helper('sponsor')}>
              <MenuItem value="">—</MenuItem>
              {options.sponsors.map((s) => (
                <MenuItem key={s} value={s}>
                  <bdi>{s}</bdi>
                </MenuItem>
              ))}
            </TextField>
            {text('recruitmentAgent')}
          </Box>
          {supplier && (
            <>
              {title('workforce.create.supplierCost')}
              <Box sx={grid}>
                {money('supplierMonthlyCost', true)}
                <TextField select size="small" label={t('workforce.create.fields.method')} value={w.costMethod ?? 'MonthlyFixed'} onChange={(e) => set('costMethod', e.target.value)}>
                  <MenuItem value="MonthlyFixed">{t('workforce.create.methods.MonthlyFixed')}</MenuItem>
                  <MenuItem value="ByWorkingDays">{t('workforce.create.methods.ByWorkingDays')}</MenuItem>
                </TextField>
              </Box>
            </>
          )}
          {title('workforce.sections.salary')}
          <Box sx={grid}>
            {money('basic')}
            {money('housing')}
            {money('food')}
            {money('transport')}
            {money('other')}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy} sx={{ bgcolor: wf.navy, '&:hover': { bgcolor: wf.navyHover } }}>
          {t('workforce.create.save')}
        </Button>
      </DialogActions>
    </>
  );
}

/** The sheet: download the template, upload it, fix what is wrong on its rows, then create them all. */
function FromSheet({ options, onClose, onCreated }: { options: CreateOptions; onClose: () => void; onCreated: (r: CreateResult) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const issue = useIssue();
  const [rows, setRows] = useState<CheckedRow[] | null>(null);
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
      setRows(await workforceApi.readNew(file));
      setDirty(false);
    });
  const check = () =>
    void run(async () => {
      setRows(await workforceApi.checkNew(rows!.map((r) => r.input)));
      setDirty(false);
    });
  const create = () =>
    void run(async () => {
      const result = await workforceApi.createNew(rows!.map((r) => r.input));
      if (result.created.length > 0) onCreated(result);
      else setRows(result.rows);
    });
  const edit = (index: number, change: Partial<NewWorker>) => {
    setRows((list) => list!.map((r, i) => (i === index ? { ...r, input: { ...r.input, ...change }, isSupplier: isSupplier(change.sponsor ?? r.input.sponsor) } : r)));
    setDirty(true);
  };
  const wrong = rows?.filter((r) => r.issues.length > 0).length ?? 0;
  const shown = new Set(['nameEn', 'nationality', 'profession', 'sponsor', 'iqama', 'borderNumber', 'arrivedOn', 'cost']);
  const cellIssue = (r: CheckedRow, field: string) => r.issues.find((i) => i.field === field);
  const typed = (r: CheckedRow, field: 'nationality' | 'profession' | 'sponsor') => (cellIssue(r, field)?.code === 'unknown' ? r.input[field] : null);
  const select = (r: CheckedRow, index: number, field: 'nationality' | 'profession', list: CreateOptions['professions']) => {
    const known = list.some((o) => o.code === r.input[field]);
    return (
      <Tooltip title={typed(r, field) ? t('workforce.create.typed', { value: typed(r, field) }) : ''}>
        <TextField select size="small" fullWidth value={known ? r.input[field] : ''} onChange={(e) => edit(index, { [field]: e.target.value })} error={!!cellIssue(r, field)}>
          <MenuItem value="">—</MenuItem>
          {list.map((o) => (
            <MenuItem key={o.code} value={o.code}>
              {ar ? o.nameAr : o.nameEn}
            </MenuItem>
          ))}
        </TextField>
      </Tooltip>
    );
  };
  return (
    <>
      <DialogContent>
        <Stack sx={{ gap: 1.5, pt: 1 }}>
          <ErrorMessage messageKey={error} />
          <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' } }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700, color: wf.navy }}>{t('workforce.create.step1')}</Typography>
              <Typography sx={{ fontSize: 13, color: wf.textSecondary }}>{t('workforce.create.step1Hint')}</Typography>
            </Box>
            <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} component="a" href={workforceApi.newTemplateUrl}>
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
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
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
                      {['nameEn', 'nationality', 'profession', 'sponsor', 'iqama', 'borderNumber', 'arrivedOn', 'cost'].map((f) => (
                        <TableCell key={f}>{t(`workforce.create.fields.${f}`)}</TableCell>
                      ))}
                      <TableCell>{t('workforce.create.notes')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r, index) => (
                      <TableRow key={r.row} sx={r.issues.length > 0 ? { '& td': { bgcolor: `${wf.warning.bg} !important` } } : undefined}>
                        <TableCell>{r.row}</TableCell>
                        <TableCell sx={{ minWidth: 170 }}>
                          <TextField size="small" fullWidth value={r.input.nameEn ?? ''} onChange={(e) => edit(index, { nameEn: nz(e.target.value) })} error={!!cellIssue(r, 'nameEn')} slotProps={{ htmlInput: { dir: 'ltr' } }} />
                        </TableCell>
                        <TableCell sx={{ minWidth: 140 }}>{select(r, index, 'nationality', options.nationalities)}</TableCell>
                        <TableCell sx={{ minWidth: 140 }}>{select(r, index, 'profession', options.professions)}</TableCell>
                        <TableCell sx={{ minWidth: 140 }}>
                          <Tooltip title={typed(r, 'sponsor') ? t('workforce.create.typed', { value: typed(r, 'sponsor') }) : ''}>
                            <TextField select size="small" fullWidth value={options.sponsors.includes(r.input.sponsor ?? '') ? r.input.sponsor : ''} onChange={(e) => edit(index, { sponsor: e.target.value })} error={!!cellIssue(r, 'sponsor')}>
                              <MenuItem value="">—</MenuItem>
                              {options.sponsors.map((s) => (
                                <MenuItem key={s} value={s}>
                                  <bdi>{s}</bdi>
                                </MenuItem>
                              ))}
                            </TextField>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <TextField size="small" fullWidth value={r.input.iqama ?? ''} onChange={(e) => edit(index, { iqama: nz(e.target.value) })} error={!!cellIssue(r, 'iqama')} slotProps={{ htmlInput: { dir: 'ltr' } }} />
                        </TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <TextField size="small" fullWidth value={r.input.borderNumber ?? ''} onChange={(e) => edit(index, { borderNumber: nz(e.target.value) })} error={!!cellIssue(r, 'borderNumber')} slotProps={{ htmlInput: { dir: 'ltr' } }} />
                        </TableCell>
                        <TableCell sx={{ minWidth: 150 }}>
                          <DateField size="small" value={r.input.arrivedOn ?? ''} onChange={(e) => edit(index, { arrivedOn: nz(e.target.value) })} error={!!cellIssue(r, 'arrivedOn')} />
                        </TableCell>
                        <TableCell sx={{ minWidth: 110 }}>
                          {isSupplier(r.input.sponsor) ? (
                            <TextField size="small" fullWidth type="number" value={r.input.supplierMonthlyCost ?? ''} onChange={(e) => edit(index, { supplierMonthlyCost: nn(e.target.value) })} error={!!cellIssue(r, 'cost')} slotProps={{ htmlInput: { min: 0, step: 'any' } }} />
                          ) : (
                            <Typography sx={{ fontSize: 12, color: wf.textSecondary, pt: 1 }}>{t('workforce.create.companySponsor')}</Typography>
                          )}
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

/** What was created: each new worker with a link to their file. */
function Created({ result, onClose }: { result: CreateResult; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <DialogContent>
        <Alert severity="success" sx={{ mb: 1.5 }}>
          {t('workforce.create.done', { count: result.created.length })}
        </Alert>
        <Stack sx={{ gap: 0.5, maxHeight: '50vh', overflow: 'auto' }}>
          {result.created.map((c) => (
            <Link key={c.id} component={RouterLink} to={`/workforce/workers/${c.id}`} onClick={onClose}>
              <bdi>{c.workerNo}</bdi> — <bdi>{c.name}</bdi>
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
