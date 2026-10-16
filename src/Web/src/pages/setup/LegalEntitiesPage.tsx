import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
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
import { setupApi, type LegalEntityRecord } from '../../api/setup';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HistoryDialog } from '../../components/HistoryDialog';
import { EmptyState, PageHeader, Panel, StatusDot } from '../../components/ui';

export function LegalEntitiesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const [rows, setRows] = useState<LegalEntityRecord[]>([]);
  const [editing, setEditing] = useState<LegalEntityRecord | 'new' | null>(null);
  const [history, setHistory] = useState<LegalEntityRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = can('organization.legal_entities.manage', true);

  const load = useCallback(async () => {
    try {
      setRows(await setupApi.legalEntities());
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadHistory = useCallback(() => setupApi.legalEntityHistory(history!.id), [history]);

  return (
    <Box>
      <PageHeader
        title={t('legalEntities.title')}
        subtitle={t('legalEntities.intro')}
        actions={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
              {t('legalEntities.new')}
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
                <TableCell>{t('legalEntities.name')}</TableCell>
                <TableCell>{t('fields.CommercialRegistrationNo')}</TableCell>
                <TableCell>{t('fields.VatNumber')}</TableCell>
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
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.commercialRegistrationNo}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.vatNumber ?? '—'}</TableCell>
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
        <LegalEntityDialog
          entity={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {history && <HistoryDialog title={history.code} load={loadHistory} onClose={() => setHistory(null)} />}
    </Box>
  );
}

function LegalEntityDialog({ entity, onClose, onSaved }: { entity: LegalEntityRecord | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [code, setCode] = useState(entity?.code ?? '');
  const [nameAr, setNameAr] = useState(entity?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(entity?.nameEn ?? '');
  const [cr, setCr] = useState(entity?.commercialRegistrationNo ?? '');
  const [vat, setVat] = useState(entity?.vatNumber ?? '');
  const [active, setActive] = useState(entity?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const details = { nameAr, nameEn, commercialRegistrationNo: cr, vatNumber: vat.trim() || null };
      await (entity ? setupApi.updateLegalEntity(entity.id, { ...details, isActive: active }) : setupApi.createLegalEntity({ code, ...details }));
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const digits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={phone}>
      <DialogTitle>{entity ? `${t('common.edit')} — ${entity.code}` : t('legalEntities.new')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Stack spacing={2}>
          {entity ? (
            <TextField label={t('fields.Code')} value={entity.code} disabled helperText={t('legalEntities.codeFixed')} slotProps={{ htmlInput: { dir: 'ltr' } }} />
          ) : (
            <TextField label={t('fields.Code')} value={code} onChange={(e) => setCode(e.target.value)} required helperText={t('legalEntities.codeHint')} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 30 } }} />
          )}
          <TextField label={t('fields.NameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} required slotProps={{ htmlInput: { dir: 'rtl', lang: 'ar' } }} />
          <TextField label={t('fields.NameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required slotProps={{ htmlInput: { dir: 'ltr', lang: 'en' } }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label={t('fields.CommercialRegistrationNo')}
              value={cr}
              onChange={(e) => setCr(digits(e.target.value, 10))}
              required
              helperText={t('legalEntities.crHint')}
              slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
            />
            <TextField
              label={t('fields.VatNumber')}
              value={vat}
              onChange={(e) => setVat(digits(e.target.value, 15))}
              helperText={t('legalEntities.vatHint')}
              slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
            />
          </Stack>
          {entity && <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label={t('fields.IsActive')} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || !nameAr.trim() || !nameEn.trim() || cr.length !== 10 || (!entity && !code.trim())}>
          {busy ? t('common.loading') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
