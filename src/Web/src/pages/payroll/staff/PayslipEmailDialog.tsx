import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../../api/auth';
import { payslipEmailApi, type PayslipEmailPreview, type PayslipEmailResult, type PayslipEmailRow, type PayslipEmailScope } from '../../../api/payslips';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { HrScope, HrStatusBadge, hr } from '../../../components/hr/Hr';

const look = {
  Sent: { color: '#047857', tint: '#D1FAE5' },
  Pending: { color: '#1D4ED8', tint: '#DBEAFE' },
  Failed: { color: '#B91C1C', tint: '#FEE2E2' },
} as const;

/**
 * Emailing an approved staff run's payslips (4.12b): who will get it (the grid's filter), who has no address in
 * their file, sending once (or again on purpose), and how each email went.
 */
export function PayslipEmailDialog({ runId, scope: given, onClose }: { runId: string; scope: PayslipEmailScope; onClose: () => void }) {
  const { t } = useTranslation();
  // The grid's filter as values (the object itself is new on each render of the page).
  const { search, department, note } = given;
  const scope = useMemo(() => ({ search, department, note }), [search, department, note]);
  const [preview, setPreview] = useState<PayslipEmailPreview | null>(null);
  const [rows, setRows] = useState<PayslipEmailRow[] | null>(null);
  const [resend, setResend] = useState(false);
  const [result, setResult] = useState<PayslipEmailResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([payslipEmailApi.preview(runId, scope), payslipEmailApi.status(runId)])
      .then(([p, s]) => (setPreview(p), setRows(s)))
      .catch((f) => setError(errorKey(f)));
  }, [runId, scope]);
  useEffect(load, [load]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await payslipEmailApi.send(runId, scope, resend));
      setResend(false);
      load();
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };

  const toSend = preview ? (resend ? preview.withEmail : preview.withEmail - preview.alreadySent) : 0;
  const counts = rows ? { Sent: rows.filter((r) => r.status === 'Sent').length, Pending: rows.filter((r) => r.status === 'Pending').length, Failed: rows.filter((r) => r.status === 'Failed').length } : null;
  const line = (ok: boolean, text: string) => (
    <Stack direction="row" key={text} sx={{ gap: 0.75, alignItems: 'center' }}>
      {ok ? <CheckCircleOutlineIcon sx={{ fontSize: 17, color: hr.success }} /> : <WarningAmberOutlinedIcon sx={{ fontSize: 17, color: hr.warning }} />}
      <Typography sx={{ fontSize: 13 }}>{text}</Typography>
    </Stack>
  );

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('payslip.email.title')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          {!preview ? (
            error ? null : <LinearProgress />
          ) : (
            <>
              {!preview.configured && <Alert severity="warning">{t('payslip.email.notConfigured')}</Alert>}
              <Box sx={{ bgcolor: '#F8FAFC', border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.5, display: 'grid', gap: 0.6 }}>
                {preview.configured && line(true, t('payslip.email.from', { from: preview.fromAddress }))}
                {line(preview.withEmail > 0, t('payslip.email.withEmail', { count: preview.withEmail, total: preview.total }))}
                {preview.withoutEmailCount > 0 && line(false, t('payslip.email.withoutEmail', { count: preview.withoutEmailCount }))}
                {preview.alreadySent > 0 && line(true, t('payslip.email.alreadySent', { count: preview.alreadySent }))}
              </Box>
              {preview.withoutEmail.length > 0 && (
                <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>
                  {t('payslip.email.withoutList')}{' '}
                  {preview.withoutEmail.map((r, i) => (
                    <span key={r.employeeNo}>
                      {i > 0 && '، '}
                      {r.name} (<bdi>{r.employeeNo}</bdi>)
                    </span>
                  ))}
                  {preview.withoutEmailCount > preview.withoutEmail.length && ` ${t('payslip.email.andMore', { count: preview.withoutEmailCount - preview.withoutEmail.length })}`}
                </Typography>
              )}
              {preview.alreadySent > 0 && (
                <FormControlLabel
                  control={<Checkbox size="small" checked={resend} onChange={(e) => setResend(e.target.checked)} />}
                  label={<Typography sx={{ fontSize: 13 }}>{t('payslip.email.resend', { count: preview.alreadySent })}</Typography>}
                />
              )}
              <Alert severity="info" sx={{ py: 0 }}>
                {t('payslip.email.hint')}
              </Alert>
            </>
          )}
          {result && (
            <Alert severity="success" sx={{ py: 0 }}>
              {t('payslip.email.queued', { count: result.queued })}
            </Alert>
          )}
          <ErrorMessage messageKey={error} />

          {rows && rows.length > 0 && (
            <Box>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.75 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{t('payslip.email.log')}</Typography>
                {counts && (
                  <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>
                    {t('payslip.email.counts', counts)}
                  </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                <IconButton size="small" aria-label={t('payslip.email.refresh')} onClick={load}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Stack>
              <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 300 }}>
                <Table size="small" stickyHeader sx={{ '& td': { fontSize: 12.5 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('payslip.email.cols.employee')}</TableCell>
                      <TableCell>{t('payslip.email.cols.email')}</TableCell>
                      <TableCell>{t('payslip.email.cols.status')}</TableCell>
                      <TableCell>{t('payslip.email.cols.by')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.employeeId}>
                        <TableCell>
                          {r.name} <Typography component="span" sx={{ fontSize: 11, color: hr.textMuted }}>(<bdi>{r.employeeNo}</bdi>)</Typography>
                        </TableCell>
                        <TableCell>
                          <bdi>{r.email}</bdi>
                        </TableCell>
                        <TableCell>
                          <HrStatusBadge label={t(`payslip.email.status.${r.status}`)} {...look[r.status]} />
                          {r.error && <Typography sx={{ fontSize: 11, color: hr.danger }}>{r.error}</Typography>}
                        </TableCell>
                        <TableCell sx={{ color: hr.textMuted }}>
                          {r.queuedByName} · <bdi>{r.queuedAt.slice(0, 16).replace('T', ' ')}</bdi>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !preview || !preview.configured || !preview.approved || toSend <= 0} onClick={() => void send()}>
            {t('payslip.email.send', { count: Math.max(0, toSend) })}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}
