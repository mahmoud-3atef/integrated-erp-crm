import Add from '@mui/icons-material/Add';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { staffApi, type Catalog, type Grade, type JobTitle } from '../../api/staff';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrPageHeader, HrScope, hr, hrCard } from '../../components/hr/Hr';

/** The job titles and the grades with their basic band (the positions of the organisation use them). */
export function CatalogPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<JobTitle | 'new' | null>(null);
  const [grade, setGrade] = useState<Grade | 'new' | null>(null);
  const canManage = can('staff.structure.manage', true);
  const reload = useCallback(async () => {
    try {
      setData(await staffApi.catalog());
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const money = (n: number | null) => (n === null ? '—' : n.toLocaleString('en-US'));

  return (
    <HrScope>
      <HrPageHeader icon={<CategoryOutlinedIcon />} title={t('catalog.title')} subtitle={t('catalog.intro')} />
      <ErrorMessage messageKey={error} />
      {!data ? (
        <LinearProgress />
      ) : (
        <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, alignItems: 'start' }}>
          <Box sx={{ ...(hrCard as object), p: 2 }}>
            <Stack direction="row" sx={{ alignItems: 'center', mb: 1.25 }}>
              <Typography sx={{ fontWeight: 700, flex: 1 }}>{t('catalog.jobTitles')}</Typography>
              {canManage && (
                <Button size="small" variant="contained" startIcon={<Add />} onClick={() => setTitle('new')}>
                  {t('catalog.newTitle')}
                </Button>
              )}
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('catalog.nameAr')}</TableCell>
                  <TableCell>{t('catalog.nameEn')}</TableCell>
                  <TableCell>{t('catalog.occupation')}</TableCell>
                  <TableCell align="right">{t('catalog.positions')}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {data.jobTitles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ color: hr.textMuted }}>{t('catalog.empty')}</TableCell>
                  </TableRow>
                )}
                {data.jobTitles.map((j) => (
                  <TableRow key={j.id} hover sx={{ opacity: j.isActive ? 1 : 0.55 }}>
                    <TableCell sx={{ fontWeight: 600 }}>{j.nameAr}</TableCell>
                    <TableCell>{j.nameEn}</TableCell>
                    <TableCell>
                      <bdi>{j.occupationCode ?? '—'}</bdi>
                    </TableCell>
                    <TableCell align="right">{j.positions}</TableCell>
                    <TableCell align="right">
                      {canManage && (
                        <IconButton size="small" onClick={() => setTitle(j)} aria-label={t('staff.profile.edit')}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          <Box sx={{ ...(hrCard as object), p: 2 }}>
            <Stack direction="row" sx={{ alignItems: 'center', mb: 1.25 }}>
              <Typography sx={{ fontWeight: 700, flex: 1 }}>{t('catalog.grades')}</Typography>
              {canManage && (
                <Button size="small" variant="contained" startIcon={<Add />} onClick={() => setGrade('new')}>
                  {t('catalog.newGrade')}
                </Button>
              )}
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('catalog.code')}</TableCell>
                  <TableCell>{t('catalog.nameAr')}</TableCell>
                  <TableCell>{t('catalog.band')}</TableCell>
                  <TableCell align="right">{t('catalog.positions')}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {data.grades.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ color: hr.textMuted }}>{t('catalog.empty')}</TableCell>
                  </TableRow>
                )}
                {data.grades.map((g) => (
                  <TableRow key={g.id} hover sx={{ opacity: g.isActive ? 1 : 0.55 }}>
                    <TableCell sx={{ fontWeight: 700 }}>
                      <bdi>{g.code}</bdi>
                    </TableCell>
                    <TableCell>{g.nameAr}</TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      <bdi>
                        {money(g.minBasic)} – {money(g.maxBasic)}
                      </bdi>
                    </TableCell>
                    <TableCell align="right">{g.positions}</TableCell>
                    <TableCell align="right">
                      {canManage && (
                        <IconButton size="small" onClick={() => setGrade(g)} aria-label={t('staff.profile.edit')}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}
      {title && <TitleDialog title={title === 'new' ? null : title} onClose={() => setTitle(null)} onSaved={() => (setTitle(null), void reload())} />}
      {grade && <GradeDialog grade={grade === 'new' ? null : grade} onClose={() => setGrade(null)} onSaved={() => (setGrade(null), void reload())} />}
    </HrScope>
  );
}

function useSave(onSaved: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function TitleDialog({ title, onClose, onSaved }: { title: JobTitle | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState({ nameAr: title?.nameAr ?? '', nameEn: title?.nameEn ?? '', occupationCode: title?.occupationCode ?? '', isActive: title?.isActive ?? true });
  const { busy, error, run } = useSave(onSaved);
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: `${hr.radius}px` } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{t('catalog.newTitle')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, pt: 1 }}>
          <ErrorMessage messageKey={error} />
          <TextField label={t('catalog.nameAr')} value={v.nameAr} onChange={(e) => setV({ ...v, nameAr: e.target.value })} required />
          <TextField label={t('catalog.nameEn')} value={v.nameEn} onChange={(e) => setV({ ...v, nameEn: e.target.value })} />
          <TextField label={t('catalog.occupation')} value={v.occupationCode} onChange={(e) => setV({ ...v, occupationCode: e.target.value })} />
          {title && <FormControlLabel control={<Checkbox checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} />} label={t('catalog.active')} />}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" disabled={busy || !v.nameAr.trim()} onClick={() => void run(() => staffApi.saveJobTitle(title?.id ?? null, { nameAr: v.nameAr, nameEn: v.nameEn || null, occupationCode: v.occupationCode || null, isActive: v.isActive }))}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function GradeDialog({ grade, onClose, onSaved }: { grade: Grade | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState({ code: grade?.code ?? '', nameAr: grade?.nameAr ?? '', minBasic: grade?.minBasic?.toString() ?? '', maxBasic: grade?.maxBasic?.toString() ?? '', isActive: grade?.isActive ?? true });
  const { busy, error, run } = useSave(onSaved);
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: `${hr.radius}px` } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{t('catalog.newGrade')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, pt: 1 }}>
          <ErrorMessage messageKey={error} />
          <Stack direction="row" sx={{ gap: 1.5 }}>
            <TextField label={t('catalog.code')} value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} required sx={{ width: 110 }} />
            <TextField label={t('catalog.nameAr')} value={v.nameAr} onChange={(e) => setV({ ...v, nameAr: e.target.value })} required fullWidth />
          </Stack>
          <Stack direction="row" sx={{ gap: 1.5 }}>
            <TextField type="number" label={t('catalog.min')} value={v.minBasic} onChange={(e) => setV({ ...v, minBasic: e.target.value })} fullWidth />
            <TextField type="number" label={t('catalog.max')} value={v.maxBasic} onChange={(e) => setV({ ...v, maxBasic: e.target.value })} fullWidth />
          </Stack>
          {grade && <FormControlLabel control={<Checkbox checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} />} label={t('catalog.active')} />}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" disabled={busy || !v.code.trim() || !v.nameAr.trim()} onClick={() => void run(() => staffApi.saveGrade(grade?.id ?? null, { code: v.code, nameAr: v.nameAr, minBasic: num(v.minBasic), maxBasic: num(v.maxBasic), isActive: v.isActive }))}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
