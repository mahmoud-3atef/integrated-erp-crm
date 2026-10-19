import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { attendanceApi, fileFields, hhmm, type FileField, type ImportPreview } from '../../api/attendance';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrScope, HrStatusBadge, hr } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';

const required: FileField[] = ['key', 'date'];

/**
 * Importing the fingerprint file: choose it, check how its columns were matched (and correct them), see what would be
 * accepted, rejected or warned about, then import. Nothing is written before the last step.
 */
export function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: (message: string, from: string | null) => void }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<FileField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const steps = t('attendance.dialog.steps', { returnObjects: true }) as string[];

  const read = async (f: File, m?: Partial<Record<FileField, string>>, next?: number) => {
    setBusy(true);
    setError(null);
    try {
      const p = await attendanceApi.preview(f, m);
      setPreview(p);
      setMapping(p.mapping);
      if (next !== undefined) setStep(next);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await attendanceApi.apply(file, mapping);
      onDone(t('attendance.dialog.done', { accepted: r.accepted, employees: r.employees }), r.from);
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  };

  const mappedOk = required.every((f) => mapping[f]);
  const statusOf = (rejected: boolean) => (rejected ? { color: '#B91C1C', tint: '#FEE2E2' } : { color: '#B45309', tint: '#FEF3C7' });

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="lg" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t('attendance.dialog.title')}
          {file && (
            <Typography component="div" sx={{ fontSize: 12.5, color: hr.textMuted }}>
              <bdi>{file.name}</bdi>
              {preview && ` · ${t('attendance.dialog.rows', { count: preview.rows })}`}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2 }}>
          <Stepper activeStep={step} alternativeLabel sx={{ pt: 1 }}>
            {steps.map((s) => (
              <Step key={s}>
                <StepLabel>{s}</StepLabel>
              </Step>
            ))}
          </Stepper>
          {busy && <LinearProgress />}
          <ErrorMessage messageKey={error} />
          {step === 0 && (
            <Box sx={{ border: `1.5px dashed #CBD5E1`, borderRadius: '12px', p: 4, textAlign: 'center', display: 'grid', gap: 1, justifyItems: 'center' }}>
              <UploadFileOutlinedIcon sx={{ fontSize: 40, color: '#94A3B8' }} />
              <Typography sx={{ fontWeight: 700 }}>{t('attendance.dialog.pick')}</Typography>
              <Typography sx={{ fontSize: 13, color: hr.textMuted, maxWidth: 520 }}>{t('attendance.dialog.pickHint')}</Typography>
              <input
                ref={input}
                type="file"
                accept=".xlsx"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    void read(f, undefined, 1);
                  }
                }}
              />
              <Button variant="contained" disabled={busy} onClick={() => input.current?.click()}>
                {t('attendance.dialog.choose')}
              </Button>
            </Box>
          )}
          {step === 1 && preview && (
            <Box sx={{ display: 'grid', gap: 1 }}>
              <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('attendance.dialog.mappingHint')}</Typography>
              <Alert severity="info" sx={{ py: 0 }}>
                {t('attendance.dialog.matchBy', { value: t(`shifts.matchByValue.${preview.matchBy}`) })} — {t('attendance.dialog.matchByChange')}
              </Alert>
              <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('attendance.dialog.field')}</TableCell>
                      <TableCell>{t('attendance.dialog.fileColumn')}</TableCell>
                      <TableCell>{t('attendance.dialog.samples')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fileFields.map((f) => {
                      const col = preview.columns.find((c) => c.header === mapping[f]);
                      return (
                        <TableRow key={f}>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {t(`attendance.dialog.fields.${f}`)}
                            {required.includes(f) && <Typography component="span" sx={{ color: hr.danger, ms: 0.5 }}> *</Typography>}
                          </TableCell>
                          <TableCell sx={{ width: 280 }}>
                            <TextField
                              select
                              size="small"
                              fullWidth
                              value={mapping[f] ?? ''}
                              onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value }))}
                              slotProps={{ select: { displayEmpty: true }, htmlInput: { 'aria-label': t(`attendance.dialog.fields.${f}`) } }}
                            >
                              <MenuItem value="">{t('attendance.dialog.none')}</MenuItem>
                              {preview.columns.map((c) => (
                                <MenuItem key={c.header} value={c.header}>
                                  {c.header}
                                </MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell sx={{ color: hr.textMuted, fontSize: 12 }}>
                            <bdi>{col?.samples.join(' · ') ?? '—'}</bdi>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          {step === 2 && preview && (
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
                {(
                  [
                    ['accepted', preview.accepted, hr.success, '#ECFDF5'],
                    ['rejected', preview.rejected, '#B91C1C', '#FFF1F2'],
                    ['warnings', preview.warnings, '#B45309', '#FFFBEB'],
                    ['employees', preview.employees, hr.primary, '#EFF6FF'],
                    ['skipped', preview.skipped, hr.textMuted, hr.muted],
                  ] as const
                ).map(([k, v, c, b]) => (
                  <Box key={k} sx={{ bgcolor: b, border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.25 }}>
                    <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{t(`attendance.dialog.summary.${k}`)}</Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 700, color: c, fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString('en-US')}</Typography>
                  </Box>
                ))}
              </Box>
              {preview.from && (
                <Typography sx={{ fontSize: 13 }}>
                  <bdi>{t('attendance.dialog.range', { from: date(preview.from), to: date(preview.to) })}</bdi>
                </Typography>
              )}
              {preview.unmatched.length > 0 && (
                <Alert severity="warning">
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{t('attendance.dialog.unmatched', { count: preview.unmatched.length })}</Typography>
                  <Typography sx={{ fontSize: 12.5 }}>{t('attendance.dialog.unmatchedHint')}</Typography>
                  <Typography sx={{ fontSize: 12.5, mt: 0.5 }}>
                    {preview.unmatched.slice(0, 20).map((u, i) => (
                      <span key={u.key}>
                        {i > 0 && '، '}
                        <bdi>{u.key}</bdi>
                        {u.name ? <> (<bdi>{u.name.trim()}</bdi>)</> : ''}
                      </span>
                    ))}
                    {preview.unmatched.length > 20 && ' …'}
                  </Typography>
                </Alert>
              )}
              <Typography sx={{ fontWeight: 700 }}>{t('attendance.dialog.problems')}</Typography>
              {preview.problems.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: hr.success }}>{t('attendance.dialog.noProblems')}</Typography>
              ) : (
                <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 300 }}>
                  <Table size="small" stickyHeader sx={{ '& td': { fontVariantNumeric: 'tabular-nums' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>{t('attendance.dialog.fields.key')}</TableCell>
                        <TableCell>{t('attendance.cols.employee')}</TableCell>
                        <TableCell>{t('attendance.cols.date')}</TableCell>
                        <TableCell>{t('attendance.cols.in')}</TableCell>
                        <TableCell>{t('attendance.cols.out')}</TableCell>
                        <TableCell>{t('attendance.cols.status')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.problems.slice(0, 200).map((p) => (
                        <TableRow key={`${p.row}-${p.code}`}>
                          <TableCell>{p.row}</TableCell>
                          <TableCell>
                            <bdi>{p.key}</bdi>
                          </TableCell>
                          <TableCell>{p.name ?? '—'}</TableCell>
                          <TableCell>{date(p.date)}</TableCell>
                          <TableCell><bdi>{hhmm(p.in) ?? '—'}</bdi></TableCell>
                          <TableCell><bdi>{hhmm(p.out) ?? '—'}</bdi></TableCell>
                          <TableCell>
                            <HrStatusBadge label={t(`attendance.dialog.codes.${p.code}`)} {...statusOf(p.rejected)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              <Alert severity="info">{t('attendance.dialog.note')}</Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, justifyContent: 'flex-start' }}>
          {step === 1 && (
            <>
              <Button variant="contained" disabled={busy || !mappedOk || !file} onClick={() => file && void read(file, mapping, 2)}>
                {t('attendance.dialog.next')}
              </Button>
              <Button disabled={busy} onClick={() => setStep(0)}>
                {t('attendance.dialog.back')}
              </Button>
            </>
          )}
          {step === 2 && preview && (
            <>
              <Button variant="contained" disabled={busy || preview.accepted === 0} onClick={() => void apply()}>
                {t('attendance.dialog.apply', { count: preview.accepted })}
              </Button>
              <Button disabled={busy} onClick={() => file && void read(file, mapping)}>
                {t('attendance.dialog.reread')}
              </Button>
              <Button disabled={busy} onClick={() => setStep(1)}>
                {t('attendance.dialog.back')}
              </Button>
            </>
          )}
          <Box sx={{ flex: 1 }} />
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}
