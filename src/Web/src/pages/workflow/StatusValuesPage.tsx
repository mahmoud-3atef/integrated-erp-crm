import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Skeleton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { workflowApi, type Screen, type ScreenStatuses, type StatusValue } from '../../api/workflow';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { GlassHero, glassPanel } from '../../components/glass';

/**
 * «قيم الحالات» (docs/02-target-architecture/19): a screen's fixed statuses (locked, from the code) and the values the
 * company adds under «in approval» — a process's update step sets them and the record shows them as its status.
 * Added values are renamed, ordered and stopped; never deleted.
 */
export function StatusValuesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const manage = can('workflow.processes.manage', true);
  const ar = i18n.language === 'ar';
  const [screens, setScreens] = useState<Screen[]>([]);
  const [screen, setScreen] = useState('');
  const [data, setData] = useState<ScreenStatuses | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StatusValue | 'new' | null>(null);

  useEffect(() => {
    workflowApi
      .screens()
      .then((all) => {
        const withStatus = all.filter((s) => s.fields.some((f) => f.key === 'status' && f.type === 'Choice'));
        setScreens(withStatus);
        setScreen((current) => current || withStatus[0]?.code || '');
      })
      .catch((e) => setError(errorKey(e)));
  }, []);

  const load = useCallback(() => {
    if (!screen) return;
    setData(null);
    workflowApi
      .statusValues(screen)
      .then(setData)
      .catch((e) => setError(errorKey(e)));
  }, [screen]);
  useEffect(load, [load]);

  const name = (x: { nameAr: string; nameEn: string }) => (ar ? x.nameAr : x.nameEn);
  const sorted = useMemo(() => [...(data?.added ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [data]);

  const save = async (value: StatusValue, change: Partial<StatusValue>) => {
    setError(null);
    try {
      await workflowApi.updateStatusValue(value.id, { nameAr: change.nameAr ?? value.nameAr, nameEn: change.nameEn ?? value.nameEn, sortOrder: change.sortOrder ?? value.sortOrder, isActive: change.isActive ?? value.isActive });
      load();
    } catch (e) {
      setError(errorKey(e));
    }
  };

  // Moving a value swaps its order with its neighbour's.
  const move = async (index: number, by: -1 | 1) => {
    const a = sorted[index];
    const b = sorted[index + by];
    if (!a || !b) return;
    await save(a, { sortOrder: b.sortOrder });
    await save(b, { sortOrder: a.sortOrder });
  };

  return (
    <Box>
      <GlassHero
        tint="list"
        overline={t('statusValues.overline')}
        title={t('statusValues.title')}
        subtitle={t('statusValues.subtitle')}
        actions={
          manage && (
            <Button variant="contained" startIcon={<AddIcon />} disabled={!data} onClick={() => setEditing('new')} sx={{ bgcolor: '#fff', color: tokens.navy800, '&:hover': { bgcolor: '#eef4ff' } }}>
              {t('statusValues.add')}
            </Button>
          )
        }
      >
        <TextField
          select
          size="small"
          label={t('statusValues.screen')}
          value={screen}
          onChange={(e) => setScreen(e.target.value)}
          sx={{ mt: 2, minWidth: 320, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,.95)', borderRadius: '10px' } }}
        >
          {screens.map((s) => (
            <MenuItem key={s.code} value={s.code}>
              {name(s)}
            </MenuItem>
          ))}
        </TextField>
      </GlassHero>

      <ErrorMessage messageKey={error} />

      {!data ? (
        <Skeleton variant="rounded" height={260} sx={{ borderRadius: '16px' }} />
      ) : (
        <Stack sx={{ gap: 2 }}>
          <Box sx={{ ...(glassPanel as object), p: 2.5 }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
              <LockOutlinedIcon sx={{ fontSize: 19, color: tokens.gray600 }} />
              <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, color: tokens.navy800 }}>
                {t('statusValues.system')}
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: 12.5, color: tokens.gray600, mb: 1.5 }}>{t('statusValues.systemHint')}</Typography>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {data.system.map((s) => (
                <Chip key={s.value} icon={<LockOutlinedIcon />} label={name(s)} variant="outlined" sx={{ bgcolor: tokens.gray50 }} />
              ))}
            </Stack>
          </Box>

          <Box sx={{ ...(glassPanel as object), p: 2.5 }}>
            <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, color: tokens.navy800 }}>
              {t('statusValues.added')}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: tokens.gray600, mb: 1.5 }}>{t('statusValues.addedHint')}</Typography>
            {sorted.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: '12px' }}>
                {t('statusValues.empty')}
              </Alert>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('statusValues.nameAr')}</TableCell>
                      <TableCell>{t('statusValues.nameEn')}</TableCell>
                      <TableCell>{t('statusValues.code')}</TableCell>
                      <TableCell>{t('statusValues.under')}</TableCell>
                      <TableCell align="center">{t('statusValues.inUse')}</TableCell>
                      <TableCell align="center">{t('statusValues.active')}</TableCell>
                      {manage && <TableCell align="center">{t('statusValues.order')}</TableCell>}
                      {manage && <TableCell />}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sorted.map((v, index) => (
                      <TableRow key={v.id} sx={{ opacity: v.isActive ? 1 : 0.55 }}>
                        <TableCell sx={{ fontWeight: 700 }}>{v.nameAr}</TableCell>
                        <TableCell>
                          <bdi>{v.nameEn}</bdi>
                        </TableCell>
                        <TableCell>
                          <Box component="code" dir="ltr" sx={{ fontSize: 12, color: tokens.gray600 }}>
                            {v.code}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={t('statusValues.inApproval')} sx={{ bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700 }} />
                        </TableCell>
                        <TableCell align="center">{v.inUse}</TableCell>
                        <TableCell align="center">
                          <Switch checked={v.isActive} disabled={!manage} onChange={(e) => void save(v, { isActive: e.target.checked })} slotProps={{ input: { 'aria-label': t('statusValues.active') } }} />
                        </TableCell>
                        {manage && (
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                            <IconButton size="small" disabled={index === 0} onClick={() => void move(index, -1)} aria-label={t('statusValues.up')}>
                              <ArrowUpwardIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" disabled={index === sorted.length - 1} onClick={() => void move(index, 1)} aria-label={t('statusValues.down')}>
                              <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                        {manage && (
                          <TableCell align="center">
                            <Tooltip title={t('statusValues.edit')}>
                              <IconButton size="small" onClick={() => setEditing(v)} aria-label={t('statusValues.edit')}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        </Stack>
      )}

      {editing && data && (
        <ValueDialog
          value={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (nameAr, nameEn) => {
            if (editing === 'new') {
              await workflowApi.createStatusValue({ screen: data.screen, nameAr, nameEn });
            } else {
              await workflowApi.updateStatusValue(editing.id, { nameAr, nameEn, sortOrder: editing.sortOrder, isActive: editing.isActive });
            }
            setEditing(null);
            load();
          }}
        />
      )}
    </Box>
  );
}

function ValueDialog({ value, onClose, onSave }: { value: StatusValue | null; onClose: () => void; onSave: (nameAr: string, nameEn: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [nameAr, setNameAr] = useState(value?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(value?.nameEn ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = nameAr.trim() && nameEn.trim();
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(nameAr, nameEn);
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth aria-labelledby="value-title">
      <DialogTitle id="value-title">{value ? t('statusValues.editTitle') : t('statusValues.addTitle')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Stack sx={{ gap: 2 }}>
          <Alert severity="info" sx={{ py: 0 }}>
            {t('statusValues.underHint')}
          </Alert>
          <TextField label={t('statusValues.nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} required autoFocus slotProps={{ htmlInput: { maxLength: 100 } }} />
          <TextField label={t('statusValues.nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required slotProps={{ htmlInput: { maxLength: 100, dir: 'ltr' } }} />
          {value && (
            <Typography sx={{ fontSize: 12, color: tokens.gray600 }}>
              {t('statusValues.codeFixed')}{' '}
              <Box component="code" dir="ltr">
                {value.code}
              </Box>
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" disabled={!valid || busy} onClick={() => void submit()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
