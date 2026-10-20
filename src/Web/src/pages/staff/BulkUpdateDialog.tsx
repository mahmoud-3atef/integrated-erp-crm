import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { staffApi, type BulkUpdateResult } from '../../api/staff';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrScope, hr } from '../../components/hr/Hr';

/**
 * Updating many staff files from an Excel sheet: download the template (the employees and what their files hold),
 * fill what should change, and upload it. The preview lists every change and every problem; a row with a problem is
 * left out, and an empty cell changes nothing.
 */
export function BulkUpdateDialog({ onClose, onApplied }: { onClose: () => void; onApplied: (changes: number) => void }) {
  const { t, i18n } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkUpdateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = async (f: File) => {
    setFile(f);
    setResult(null);
    setBusy(true);
    setError(null);
    try {
      setResult(await staffApi.bulkUpdate(f, false));
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
      const r = await staffApi.bulkUpdate(file, true);
      onApplied(r.changes);
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  };
  const field = (key: string | null) => (key ? t(`staff.bulk.fields.${key}`, { defaultValue: key }) : '—');
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('staff.bulk.title')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <Alert severity="info" sx={{ py: 0.25 }}>
            {t('staff.bulk.hint')}
          </Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1 }}>
            <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} component="a" href={staffApi.updateTemplateUrl(i18n.language === 'ar' ? 'ar' : 'en')} download>
              {t('staff.bulk.template')}
            </Button>
            <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} disabled={busy} onClick={() => input.current?.click()}>
              {file ? t('staff.bulk.another') : t('staff.bulk.upload')}
            </Button>
            <input
              ref={input}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void preview(f);
              }}
            />
            {file && <Typography sx={{ fontSize: 13, color: hr.textMuted, alignSelf: 'center' }}>{file.name}</Typography>}
          </Stack>
          {busy && <LinearProgress />}
          <ErrorMessage messageKey={error} />
          {result && (
            <>
              <Typography sx={{ fontSize: 13.5 }}>{t('staff.bulk.summary', { rows: result.rows, employees: result.employees, changes: result.changes, rejected: result.rejected })}</Typography>
              {result.problems.length > 0 && (
                <Box>
                  <Typography sx={{ fontWeight: 700, mb: 0.5, color: hr.danger }}>{t('staff.bulk.problemsTitle')}</Typography>
                  <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 180 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('staff.bulk.row')}</TableCell>
                          <TableCell>{t('staff.bulk.employee')}</TableCell>
                          <TableCell>{t('staff.bulk.field')}</TableCell>
                          <TableCell>{t('staff.bulk.problem')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.problems.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell>{p.row}</TableCell>
                            <TableCell>
                              <bdi>{p.employeeNo ?? '—'}</bdi>
                            </TableCell>
                            <TableCell>{field(p.field)}</TableCell>
                            <TableCell>
                              {t(`staff.bulk.problems.${p.problem}`)}
                              {p.value && (
                                <>
                                  {' '}
                                  · <bdi dir="ltr">{p.value}</bdi>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
              {result.items.length > 0 && (
                <Box>
                  <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('staff.bulk.changesTitle')}</Typography>
                  <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 300 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('staff.bulk.employee')}</TableCell>
                          <TableCell>{t('staff.bulk.field')}</TableCell>
                          <TableCell>{t('staff.bulk.from')}</TableCell>
                          <TableCell>{t('staff.bulk.to')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.items.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <b>{c.name}</b> · <bdi>{c.employeeNo}</bdi>
                            </TableCell>
                            <TableCell>{field(c.field)}</TableCell>
                            <TableCell sx={{ color: hr.textMuted }}>
                              <bdi>{c.from ?? '—'}</bdi>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              <bdi>{c.to ?? '—'}</bdi>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
              {result.changes === 0 && result.problems.length === 0 && <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('staff.bulk.nothing')}</Typography>}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !result || result.changes === 0} onClick={() => void apply()}>
            {result ? t('staff.bulk.apply', { count: result.changes }) : t('staff.bulk.applyNone')}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}
