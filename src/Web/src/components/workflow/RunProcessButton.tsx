import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { workflowApi, type ProcessSummary } from '../../api/workflow';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';

/**
 * "Run an approval process" on one record, for administrators of processes (like "Run workflow" in the old CRM):
 * pick an active process of the screen and start it on the record, whatever its start condition.
 */
export function RunProcessButton({ screen, recordId, title, onStarted }: { screen: string; recordId: string; title: string; onStarted: () => void }) {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const [open, setOpen] = useState(false);
  const [processes, setProcesses] = useState<ProcessSummary[] | null>(null);
  const [processId, setProcessId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!can('workflow.processes.manage', true)) {
    return null;
  }

  const show = async () => {
    setOpen(true);
    setError(null);
    try {
      const list = (await workflowApi.processes()).filter((p) => p.screen === screen && p.isActive);
      setProcesses(list);
      setProcessId(list[0]?.id ?? '');
    } catch (failure) {
      setError(errorKey(failure));
    }
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await workflowApi.startInstance(screen, recordId, processId, title);
      setOpen(false);
      onStarted();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outlined" startIcon={<PlayCircleOutlinedIcon />} onClick={() => void show()}>
        {t('process.run.button')}
      </Button>
      {open && (
        <Dialog open onClose={() => setOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{t('process.run.title')}</DialogTitle>
          <DialogContent dividers>
            <ErrorMessage messageKey={error} />
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('process.run.hint')}
            </Alert>
            {processes && processes.length === 0 ? (
              <Alert severity="warning">{t('process.run.none')}</Alert>
            ) : (
              <TextField select fullWidth label={t('process.run.process')} value={processId} onChange={(e) => setProcessId(e.target.value)}>
                {(processes ?? []).map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {localName(p, i18n.language)} — v{p.currentVersion}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="contained" disabled={busy || !processId} onClick={() => void run()}>
              {t('process.run.start')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
