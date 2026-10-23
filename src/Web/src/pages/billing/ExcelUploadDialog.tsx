import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey, upload } from '../../api/auth';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { sar } from '../operations/delivery';

interface ExcelPreview {
  rows: number;
  problems: { row: number; workerNo: string | null; code: string; column: string | null }[];
  changes: { workerId: string; workerNo: string; name: string; type: string; current: number; uploaded: number; reason: string }[];
}

/**
 * «رفع Excel» (one button for both, the user's request, 2026-10-23): first download this timesheet's file, then upload
 * it filled in — a preview (its problems, or the changes it makes), then, when it has no problem, applying it.
 * Nothing is saved before the confirmation.
 */
export function ExcelUploadDialog({ timesheetId, onClose, onApplied }: { timesheetId: string; onClose: () => void; onApplied: () => void }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExcelPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (path: 'preview' | 'apply', chosen: File) => {
    const form = new FormData();
    form.append('file', chosen);
    return upload<ExcelPreview>(`/api/v1/billing/timesheets/${timesheetId}/excel/${path}`, form);
  };

  const choose = async (chosen: File | undefined) => {
    if (!chosen) return;
    setFile(chosen);
    setPreview(null);
    setBusy(true);
    setError(null);
    try {
      setPreview(await send('preview', chosen));
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await send('apply', file!);
      if (result.problems.length > 0) {
        setPreview(result);
      } else {
        onApplied();
      }
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const ok = preview && preview.problems.length === 0;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('timesheets.excel.uploadTitle')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Typography sx={{ fontSize: 13, color: tokens.gray600, mb: 2 }}>{t('timesheets.excel.uploadHint')}</Typography>
        <input ref={input} type="file" accept=".xlsx" hidden onChange={(e) => void choose(e.target.files?.[0])} />
        <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, mb: 2 }}>
          <Step number={1} title={t('timesheets.excel.step1')} hint={t('timesheets.excel.step1Hint')}>
            <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} component="a" href={`/api/v1/billing/timesheets/${timesheetId}/excel`} download>
              {t('timesheets.excel.download')}
            </Button>
          </Step>
          <Step number={2} title={t('timesheets.excel.step2')} hint={file ? file.name : t('timesheets.excel.step2Hint')}>
            <Button variant="contained" startIcon={<UploadFileOutlinedIcon />} disabled={busy} onClick={() => (input.current && ((input.current.value = ''), input.current.click()))}>
              {file ? t('timesheets.excel.chooseOther') : t('timesheets.excel.choose')}
            </Button>
          </Step>
        </Box>
        {busy && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}

        {preview && preview.problems.length > 0 && (
          <>
            <Alert severity="error" icon={<ErrorOutlineIcon />} sx={{ mb: 1.5 }}>
              {t('timesheets.excel.problems', { count: preview.problems.length })}
            </Alert>
            <TableContainer sx={{ maxHeight: 320 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('timesheets.excel.row')}</TableCell>
                    <TableCell>{t('workforce.col.name')}</TableCell>
                    <TableCell>{t('timesheets.excel.problem')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.problems.map((p, n) => (
                    <TableRow key={n}>
                      <TableCell>{p.row > 0 ? p.row : '—'}</TableCell>
                      <TableCell dir="ltr" sx={{ textAlign: 'start' }}>
                        {p.workerNo ?? '—'}
                      </TableCell>
                      <TableCell sx={{ color: tokens.danger }}>{t(`timesheets.excel.codes.${p.code}`)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {ok && (
          <>
            <Alert severity={preview.changes.length > 0 ? 'success' : 'info'} icon={<CheckCircleOutlineIcon />} sx={{ mb: 1.5 }}>
              {preview.changes.length > 0 ? t('timesheets.excel.ready', { rows: preview.rows, count: preview.changes.length }) : t('timesheets.excel.noChanges', { rows: preview.rows })}
            </Alert>
            {preview.changes.length > 0 && (
              <TableContainer sx={{ maxHeight: 360 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('workforce.col.name')}</TableCell>
                      <TableCell>{t('timesheets.adjustmentType')}</TableCell>
                      <TableCell align="center">{t('timesheets.excel.current')}</TableCell>
                      <TableCell align="center">{t('timesheets.excel.uploaded')}</TableCell>
                      <TableCell>{t('timesheets.reason')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.changes.map((c, n) => (
                      <TableRow key={n}>
                        <TableCell>
                          <Typography dir="ltr" sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                            {c.name}
                          </Typography>
                          <Typography dir="ltr" sx={{ fontSize: 11, color: tokens.gray500, textAlign: 'start' }}>
                            {c.workerNo}
                          </Typography>
                        </TableCell>
                        <TableCell>{t(`timesheets.adjustments.${c.type}`)}</TableCell>
                        <TableCell align="center" sx={{ color: tokens.gray500 }}>
                          {sar(c.current)}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                          {sar(c.uploaded)}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12.5 }}>{c.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
        {!preview && !busy && (
          <Box sx={{ p: 3, textAlign: 'center', borderRadius: `${tokens.radius}px`, border: `2px dashed ${tokens.gray200}`, color: tokens.gray500, fontSize: 13 }}>{t('timesheets.excel.empty')}</Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
        <Button variant="contained" disabled={busy || !ok || preview.changes.length === 0} onClick={() => void apply()}>
          {t('timesheets.excel.apply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** One step of the dialog: its number, what to do, and its button. */
function Step({ number, title, hint, children }: { number: number; title: string; hint: string; children: ReactNode }) {
  return (
    <Stack sx={{ gap: 1, p: 1.5, borderRadius: `${tokens.radius}px`, border: `1px solid ${tokens.gray100}`, bgcolor: tokens.gray50 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 800, color: '#fff', bgcolor: tokens.navy700 }}>{number}</Box>
        <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }}>{title}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 12.5, color: tokens.gray600, overflowWrap: 'anywhere' }}>{hint}</Typography>
      <Box>{children}</Box>
    </Stack>
  );
}
