import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { billingApi, type LegacyImportReport } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge } from '../../components/ui';
import { sar } from '../operations/delivery';

/** The old system's invoice number on a timesheet made from it, with its status there. */
export function LegacyBadge({ number, status }: { number: string; status?: number | null }) {
  const { t } = useTranslation();
  return (
    <Badge tone="info">
      {t('timesheets.legacy.badge')} · <bdi>{number}</bdi>
      {status ? ` · ${t(`timesheets.legacy.status.${status}`, { defaultValue: String(status) })}` : ''}
    </Badge>
  );
}

/**
 * «نقل فواتير النظام القديم»: the old system's invoices from June 2026 as draft timesheets, then what was done — the
 * drafts, the invoices left out and why, and the lines balanced to the old amounts.
 */
export function LegacyImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LegacyImportReport | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await billingApi.importLegacy());
      onDone();
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md" aria-labelledby="legacy-title">
      <DialogTitle id="legacy-title" sx={{ fontWeight: 800, color: tokens.navy800 }}>
        {t('timesheets.legacy.title')}
      </DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        {!report ? (
          <Stack sx={{ gap: 1.5 }}>
            <Typography sx={{ fontSize: 14, lineHeight: 1.8 }}>{t('timesheets.legacy.intro')}</Typography>
            <Alert severity="info">{t('timesheets.legacy.rules')}</Alert>
          </Stack>
        ) : (
          <Stack sx={{ gap: 2 }}>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' } }}>
              {[
                [t('timesheets.legacy.imported'), String(report.imported)],
                [t('timesheets.legacy.lines'), String(report.lines)],
                [t('timesheets.legacy.workers'), String(report.workers)],
                [t('timesheets.legacy.amount'), sar(report.invoiceAmount)],
              ].map(([label, value]) => (
                <Box key={label} sx={{ p: 1.25, borderRadius: '12px', bgcolor: tokens.navy50 }}>
                  <Typography sx={{ fontSize: 12, color: tokens.gray600 }}>{label}</Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, color: tokens.navy800 }}>{value}</Typography>
                </Box>
              ))}
            </Box>
            {report.missingWorkers > 0 && <Alert severity="warning">{t('timesheets.legacy.missingWorkers', { count: report.missingWorkers })}</Alert>}
            {report.balanced.length > 0 && (
              <Box>
                <Typography sx={{ fontWeight: 800, color: tokens.navy800, mb: 0.5 }}>{t('timesheets.legacy.balanced', { count: report.balanced.length })}</Typography>
                <Typography sx={{ fontSize: 12.5, color: tokens.gray600, mb: 1 }}>{t('timesheets.legacy.balancedHint')}</Typography>
                <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('timesheets.legacy.col.invoice')}</TableCell>
                        <TableCell>{t('timesheets.legacy.col.timesheet')}</TableCell>
                        <TableCell>{t('timesheets.legacy.col.project')}</TableCell>
                        <TableCell align="center">{t('timesheets.legacy.col.lines')}</TableCell>
                        <TableCell align="right">{t('timesheets.legacy.col.invoiceDiff')}</TableCell>
                        <TableCell align="right">{t('timesheets.legacy.col.payDiff')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {report.balanced.map((b) => (
                        <TableRow key={b.invoiceNo}>
                          <TableCell><bdi>{b.invoiceNo}</bdi></TableCell>
                          <TableCell><bdi>{b.timesheetNo}</bdi></TableCell>
                          <TableCell>{b.project}</TableCell>
                          <TableCell align="center">{b.lines}</TableCell>
                          <TableCell align="right"><bdi>{sar(b.invoiceDifference)}</bdi></TableCell>
                          <TableCell align="right"><bdi>{sar(b.payDifference)}</bdi></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            )}
            {report.skipped.length > 0 && (
              <Box>
                <Typography sx={{ fontWeight: 800, color: tokens.navy800, mb: 1 }}>{t('timesheets.legacy.skipped', { count: report.skipped.length })}</Typography>
                <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('timesheets.legacy.col.invoice')}</TableCell>
                        <TableCell>{t('timesheets.legacy.col.project')}</TableCell>
                        <TableCell>{t('timesheets.legacy.col.month')}</TableCell>
                        <TableCell>{t('timesheets.legacy.col.reason')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {report.skipped.map((s) => (
                        <TableRow key={s.invoiceNo + s.month}>
                          <TableCell><bdi>{s.invoiceNo}</bdi></TableCell>
                          <TableCell>{s.project}</TableCell>
                          <TableCell><bdi>{s.month.slice(0, 7)}</bdi></TableCell>
                          <TableCell>{t(`timesheets.legacy.reasons.${s.reason}`)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {report ? t('common.close') : t('common.cancel')}
        </Button>
        {!report && (
          <Button variant="contained" disabled={busy} onClick={() => void run()}>
            {busy ? t('timesheets.legacy.running') : t('timesheets.legacy.run')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
