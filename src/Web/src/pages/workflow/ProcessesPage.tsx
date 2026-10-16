import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { workflowApi, type ProcessSummary, type Screen } from '../../api/workflow';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, EmptyState, PageHeader, Panel, StatusDot } from '../../components/ui';

/** Approval processes of the company, like the CRM list of workflow processes. */
export function ProcessesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProcessSummary[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = can('workflow.processes.manage', true);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([workflowApi.processes(), workflowApi.screens()]);
      setRows(p);
      setScreens(s);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ar = i18n.language === 'ar';
  const when = (value: string) => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(value));

  return (
    <Box>
      <PageHeader
        title={t('process.listTitle')}
        subtitle={t('process.listIntro')}
        actions={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
              {t('process.new')}
            </Button>
          )
        }
      />
      <ErrorMessage messageKey={error} />
      <Panel>
        <TableContainer sx={{ borderRadius: '6px' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('process.name')}</TableCell>
                <TableCell>{t('process.screen')}</TableCell>
                <TableCell>{t('process.priority')}</TableCell>
                <TableCell>{t('process.version')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/workflow/processes/${row.id}`)}>
                  <TableCell sx={{ fontWeight: 600, color: tokens.navy800 }}>{localName(row, i18n.language)}</TableCell>
                  <TableCell>{ar ? row.screenNameAr : row.screenNameEn}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.priority}</TableCell>
                  <TableCell>
                    <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                      {row.currentVersion > 0 ? <Badge tone="primary">{t('routes.version', { version: row.currentVersion })}</Badge> : '—'}
                      {row.hasUnpublishedChanges && <Badge tone="warning">{t('process.unpublished')}</Badge>}
                    </Stack>
                    {row.publishedAt && <Box sx={{ fontSize: 11.5, color: tokens.gray500 }}>{`${row.publishedBy} — ${when(row.publishedAt)}`}</Box>}
                  </TableCell>
                  <TableCell>
                    <StatusDot tone={row.isActive ? 'success' : 'neutral'} label={row.isActive ? t('process.activeStatus') : t('process.draftStatus')} />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={t('common.edit')}>
                      <IconButton size="small" aria-label={`${t('common.edit')} ${localName(row, i18n.language)}`}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {rows.length === 0 && <EmptyState text={t('process.empty')} />}
      </Panel>
      {creating && (
        <NewProcessDialog
          screens={screens}
          onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/workflow/processes/${id}`)}
        />
      )}
    </Box>
  );
}

function NewProcessDialog({ screens, onClose, onCreated }: { screens: Screen[]; onClose: () => void; onCreated: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const [screen, setScreen] = useState(screens[0]?.code ?? '');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [priority, setPriority] = useState('10');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await workflowApi.createProcess({ screen, nameAr, nameEn, priority: Number(priority) || 0 });
      onCreated(created.process.id);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('process.new')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Stack spacing={2}>
          <TextField select label={t('process.screen')} helperText={t('process.screenHint')} value={screen} onChange={(e) => setScreen(e.target.value)}>
            {screens.map((s) => (
              <MenuItem key={s.code} value={s.code}>
                {localName(s, i18n.language)}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={t('fields.NameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} required slotProps={{ htmlInput: { dir: 'rtl', maxLength: 200 } }} />
          <TextField label={t('fields.NameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required slotProps={{ htmlInput: { dir: 'ltr', maxLength: 200 } }} />
          <TextField label={t('process.priority')} helperText={t('process.priorityHint')} value={priority} onChange={(e) => setPriority(e.target.value.replace(/\D/g, '').slice(0, 4))} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={() => void create()} disabled={busy || !screen || !nameAr.trim() || !nameEn.trim()}>
          {busy ? t('common.loading') : t('process.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
