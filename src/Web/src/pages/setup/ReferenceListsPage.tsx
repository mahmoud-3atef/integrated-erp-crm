import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HistoryIcon from '@mui/icons-material/History';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import {
  Box,
  Button,
  ButtonBase,
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
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { setupApi, type ReferenceItem, type ReferenceList } from '../../api/setup';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HistoryDialog } from '../../components/HistoryDialog';
import { Badge, EmptyState, PageHeader, Panel, StatusDot } from '../../components/ui';

export function ReferenceListsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const { list: selected } = useParams();
  const [lists, setLists] = useState<ReferenceList[]>([]);
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [editing, setEditing] = useState<ReferenceItem | 'new' | null>(null);
  const [history, setHistory] = useState<ReferenceItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = can('organization.reference_data.manage', true);
  const current = lists.find((l) => l.code === selected);

  const loadLists = useCallback(async () => {
    try {
      setLists(await setupApi.referenceLists());
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, []);

  const loadItems = useCallback(async () => {
    if (!selected) {
      return;
    }
    try {
      setItems(await setupApi.items(selected));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [selected]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    // Open the first list when none is chosen.
    const first = lists[0];
    if (!selected && first) {
      navigate(`/setup/reference-lists/${first.code}`, { replace: true });
    }
  }, [selected, lists, navigate]);

  useEffect(() => {
    setItems([]);
    void loadItems();
  }, [loadItems]);

  const loadHistory = useCallback(() => setupApi.itemHistory(selected!, history!.id), [selected, history]);

  return (
    <Box>
      <PageHeader title={t('reference.title')} subtitle={t('reference.intro')} />
      <ErrorMessage messageKey={error} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }}>
        <Panel padding={1.25}>
          <Stack component="nav" aria-label={t('reference.title')} spacing={0.5}>
            {lists.map((list) => {
              const active = list.code === selected;
              return (
                <ButtonBase
                  key={list.code}
                  onClick={() => navigate(`/setup/reference-lists/${list.code}`)}
                  aria-current={active ? 'page' : undefined}
                  sx={{
                    justifyContent: 'space-between',
                    gap: 1,
                    px: 1.75,
                    py: 1.1,
                    borderRadius: 999,
                    fontSize: 13.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#fff' : tokens.navy800,
                    bgcolor: active ? tokens.navy700 : 'transparent',
                    textAlign: 'start',
                    '&:hover': { bgcolor: active ? tokens.navy700 : tokens.tint },
                  }}
                >
                  <span>{localName(list, i18n.language)}</span>
                  <Box
                    component="span"
                    sx={{ minWidth: 24, px: 0.9, borderRadius: 999, fontSize: 11, fontWeight: 700, textAlign: 'center', bgcolor: active ? '#fff' : tokens.navy50, color: tokens.navy700 }}
                  >
                    {list.itemCount}
                  </Box>
                </ButtonBase>
              );
            })}
          </Stack>
        </Panel>

        <Panel>
          {current && (
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: tokens.navy800 }}>{localName(current, i18n.language)}</Typography>
                <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>{i18n.language === 'ar' ? current.descriptionAr : current.descriptionEn}</Typography>
              </Box>
              {canManage && (
                <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
                  {t('reference.newItem')}
                </Button>
              )}
            </Stack>
          )}
          <TableContainer sx={{ borderRadius: '6px' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('fields.Code')}</TableCell>
                  <TableCell>{t('fields.NameAr')}</TableCell>
                  <TableCell>{t('fields.NameEn')}</TableCell>
                  <TableCell>{t('fields.SortOrder')}</TableCell>
                  <TableCell>{t('common.status')}</TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ fontWeight: 600, color: tokens.navy800, whiteSpace: 'nowrap' }}>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                        <span dir="ltr">{item.code}</span>
                        {item.isSystem && (
                          <Tooltip title={t('reference.systemHint')}>
                            <span>
                              <Badge tone="primary" icon={<LockOutlinedIcon />}>
                                {t('reference.system')}
                              </Badge>
                            </span>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ color: tokens.gray900 }} lang="ar" dir="rtl">
                      {item.nameAr}
                    </TableCell>
                    <TableCell lang="en" dir="ltr" sx={{ textAlign: 'start' }}>
                      {item.nameEn}
                    </TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{item.sortOrder}</TableCell>
                    <TableCell>
                      <StatusDot tone={item.isActive ? 'success' : 'neutral'} label={item.isActive ? t('common.active') : t('common.inactive')} />
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      {canManage && (
                        <Tooltip title={t('common.edit')}>
                          <IconButton size="small" onClick={() => setEditing(item)} aria-label={`${t('common.edit')} ${item.code}`}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={t('history.title')}>
                        <IconButton size="small" onClick={() => setHistory(item)} aria-label={`${t('history.title')} ${item.code}`}>
                          <HistoryIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {items.length === 0 && <EmptyState text={t('reference.empty')} />}
        </Panel>
      </Box>
      {editing && selected && (
        <ItemDialog
          list={selected}
          item={editing === 'new' ? null : editing}
          nextOrder={items.reduce((max, i) => Math.max(max, i.sortOrder), 0) + 1}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void loadItems();
            void loadLists();
          }}
        />
      )}
      {history && <HistoryDialog title={history.code} load={loadHistory} onClose={() => setHistory(null)} />}
    </Box>
  );
}

interface ItemDialogProps {
  list: string;
  item: ReferenceItem | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

function ItemDialog({ list, item, nextOrder, onClose, onSaved }: ItemDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [code, setCode] = useState(item?.code ?? '');
  const [nameAr, setNameAr] = useState(item?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(item?.nameEn ?? '');
  const [order, setOrder] = useState(String(item?.sortOrder ?? nextOrder));
  const [active, setActive] = useState(item?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const sortOrder = Number.parseInt(order, 10) || 0;
      await (item
        ? setupApi.updateItem(list, item.id, { nameAr, nameEn, sortOrder, isActive: active })
        : setupApi.createItem(list, { code, nameAr, nameEn, sortOrder }));
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={phone}>
      <DialogTitle>{item ? `${t('common.edit')} — ${item.code}` : t('reference.newItem')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Stack spacing={2}>
          {item ? (
            <TextField label={t('fields.Code')} value={item.code} disabled helperText={t('reference.codeFixed')} slotProps={{ htmlInput: { dir: 'ltr' } }} />
          ) : (
            <TextField label={t('fields.Code')} value={code} onChange={(e) => setCode(e.target.value)} required helperText={t('reference.codeHint')} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 30 } }} />
          )}
          <TextField label={t('fields.NameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} required slotProps={{ htmlInput: { dir: 'rtl', lang: 'ar' } }} />
          <TextField label={t('fields.NameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required slotProps={{ htmlInput: { dir: 'ltr', lang: 'en' } }} />
          <TextField label={t('fields.SortOrder')} value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, '').slice(0, 5))} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }} />
          {item && (
            <FormControlLabel
              control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} disabled={item.isSystem} />}
              label={item.isSystem ? t('reference.systemHint') : t('fields.IsActive')}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || !nameAr.trim() || !nameEn.trim() || (!item && !code.trim())}>
          {busy ? t('common.loading') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
