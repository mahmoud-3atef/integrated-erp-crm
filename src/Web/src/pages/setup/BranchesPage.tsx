import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import HistoryIcon from '@mui/icons-material/History';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { setupApi, type Branch, type LegalEntityRecord } from '../../api/setup';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { AttachmentsDialog } from '../../components/AttachmentsDialog';
import { HistoryDialog } from '../../components/HistoryDialog';
import { EmptyState, PageHeader, Panel, StatusDot } from '../../components/ui';

const allEntities = 'all';

export function BranchesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const [rows, setRows] = useState<Branch[]>([]);
  const [entities, setEntities] = useState<LegalEntityRecord[]>([]);
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);
  const [history, setHistory] = useState<Branch | null>(null);
  const [files, setFiles] = useState<Branch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = can('organization.branches.manage', true);

  const load = useCallback(async () => {
    try {
      const [b, e] = await Promise.all([setupApi.branches(), can('organization.legal_entities.view') ? setupApi.legalEntities() : Promise.resolve([])]);
      setRows(b);
      setEntities(e);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [can]);

  useEffect(() => {
    void load();
  }, [load]);

  const entityLabel = (id: string | null) => {
    if (!id) {
      return t('users.allEntities');
    }
    const entity = entities.find((e) => e.id === id);
    return entity ? `${entity.code} — ${localName(entity, i18n.language)}` : '…';
  };
  const loadHistory = useCallback(() => setupApi.branchHistory(history!.id), [history]);

  return (
    <Box>
      <PageHeader
        title={t('branches.title')}
        subtitle={t('branches.intro')}
        actions={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
              {t('branches.new')}
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
                <TableCell>{t('fields.Code')}</TableCell>
                <TableCell>{t('branches.name')}</TableCell>
                <TableCell>{t('fields.LegalEntityId')}</TableCell>
                <TableCell>{t('fields.City')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ fontWeight: 600, color: tokens.navy800 }} dir="ltr">
                    {row.code}
                  </TableCell>
                  <TableCell sx={{ color: tokens.gray900 }}>{localName(row, i18n.language)}</TableCell>
                  <TableCell>{entityLabel(row.legalEntityId)}</TableCell>
                  <TableCell>{row.city ?? '—'}</TableCell>
                  <TableCell>
                    <StatusDot tone={row.isActive ? 'success' : 'neutral'} label={row.isActive ? t('common.active') : t('common.inactive')} />
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    {canManage && (
                      <Tooltip title={t('common.edit')}>
                        <IconButton size="small" onClick={() => setEditing(row)} aria-label={`${t('common.edit')} ${row.code}`}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={t('attachments.title')}>
                      <IconButton size="small" onClick={() => setFiles(row)} aria-label={`${t('attachments.title')} ${row.code}`}>
                        <AttachFileIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('history.title')}>
                      <IconButton size="small" onClick={() => setHistory(row)} aria-label={`${t('history.title')} ${row.code}`}>
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {rows.length === 0 && <EmptyState text={t('common.empty')} />}
      </Panel>
      {editing && (
        <BranchDialog
          branch={editing === 'new' ? null : editing}
          entities={entities}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {files && (
        <AttachmentsDialog title={files.code} ownerType="organization.branch" ownerId={files.id} canManage={canManage} onClose={() => setFiles(null)} />
      )}
      {history && (
        <HistoryDialog
          title={history.code}
          load={loadHistory}
          formatValue={(field, value) => (field === 'LegalEntityId' ? entityLabel(String(value)) : null)}
          onClose={() => setHistory(null)}
        />
      )}
    </Box>
  );
}

interface BranchDialogProps {
  branch: Branch | null;
  entities: LegalEntityRecord[];
  onClose: () => void;
  onSaved: () => void;
}

function BranchDialog({ branch, entities, onClose, onSaved }: BranchDialogProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [code, setCode] = useState(branch?.code ?? '');
  const [nameAr, setNameAr] = useState(branch?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(branch?.nameEn ?? '');
  const [entity, setEntity] = useState(branch?.legalEntityId ?? allEntities);
  const [city, setCity] = useState(branch?.city ?? '');
  const [active, setActive] = useState(branch?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const details = { nameAr, nameEn, legalEntityId: entity === allEntities ? null : entity, city: city.trim() || null, isActive: active };
      await (branch ? setupApi.updateBranch(branch.id, details) : setupApi.createBranch({ code, ...details }));
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={phone}>
      <DialogTitle>{branch ? `${t('common.edit')} — ${branch.code}` : t('branches.new')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Stack spacing={2}>
          {branch ? (
            <TextField label={t('fields.Code')} value={branch.code} disabled helperText={t('legalEntities.codeFixed')} slotProps={{ htmlInput: { dir: 'ltr' } }} />
          ) : (
            <TextField label={t('fields.Code')} value={code} onChange={(e) => setCode(e.target.value)} required helperText={t('branches.codeHint')} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 30 } }} />
          )}
          <TextField label={t('fields.NameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} required slotProps={{ htmlInput: { dir: 'rtl', lang: 'ar' } }} />
          <TextField label={t('fields.NameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required slotProps={{ htmlInput: { dir: 'ltr', lang: 'en' } }} />
          <TextField select label={t('fields.LegalEntityId')} value={entity} onChange={(e) => setEntity(e.target.value)}>
            <MenuItem value={allEntities}>{t('users.allEntities')}</MenuItem>
            {entities.map((e) => (
              <MenuItem key={e.id} value={e.id}>{`${e.code} — ${localName(e, i18n.language)}`}</MenuItem>
            ))}
          </TextField>
          <TextField label={t('fields.City')} value={city} onChange={(e) => setCity(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
          {branch && <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label={t('fields.IsActive')} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || !nameAr.trim() || !nameEn.trim() || (!branch && !code.trim())}>
          {busy ? t('common.loading') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
