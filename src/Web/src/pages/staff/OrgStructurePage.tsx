import Add from '@mui/icons-material/Add';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, LinearProgress, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { staffApi, type Catalog, type Department, type NamedRef, type Position, type Structure } from '../../api/staff';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrPageHeader, HrScope, hr, hrCard } from '../../components/hr/Hr';

const colors = ['#2563EB', '#059669', '#7C3AED', '#D97706', '#0E7490', '#DB2777', '#475569'];

/** The organisation: the departments (by level) as cards with their manager and positions, seats taken and vacant. */
export function OrgStructurePage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const [data, setData] = useState<Structure | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [department, setDepartment] = useState<Department | 'new' | null>(null);
  const [position, setPosition] = useState<{ position: Position | null; departmentId: string } | null>(null);
  const canManage = can('staff.structure.manage', true);
  const ar = i18n.language === 'ar';

  const reload = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([staffApi.structure(), staffApi.catalog()]);
      setData(s);
      setCatalog(c);
      setError(null);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const remove = async (work: () => Promise<void>) => {
    try {
      await work();
      await reload();
    } catch (failure) {
      setError(errorKey(failure));
    }
  };

  // Departments in tree order (each followed by its sections), with their depth.
  const ordered: { d: Department; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) =>
    data?.departments.filter((d) => d.parentId === parent).forEach((d) => {
      ordered.push({ d, depth });
      walk(d.id, depth + 1);
    });
  walk(null, 0);
  const nameOf = (id: string | null) => data?.departments.find((d) => d.id === id);

  return (
    <HrScope>
      <HrPageHeader
        icon={<AccountTreeOutlinedIcon />}
        title={t('org.title')}
        subtitle={t('org.intro')}
        actions={
          canManage && (
            <>
              <Button variant="outlined" startIcon={<Add />} disabled={!data?.departments.length || !catalog?.jobTitles.length} onClick={() => setPosition({ position: null, departmentId: data!.departments[0]!.id })}>
                {t('org.newPosition')}
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => setDepartment('new')}>
                {t('org.newDepartment')}
              </Button>
            </>
          )
        }
      />
      <ErrorMessage messageKey={error} />
      {!data ? (
        <LinearProgress />
      ) : (
        <>
          <Box sx={{ ...(hrCard as object), p: 2, mb: 1.75, display: 'flex', alignItems: 'center', gap: 1.75, flexWrap: 'wrap' }}>
            <Box sx={{ width: 50, height: 50, borderRadius: '14px', background: `linear-gradient(135deg, ${hr.navy}, ${hr.primary})`, color: '#fff', display: 'grid', placeItems: 'center' }}>
              <AccountTreeOutlinedIcon />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{t('org.top')}</Typography>
              <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>{t('org.topSub', { departments: data.departments.length, employees: data.employees, vacancies: data.vacancies })}</Typography>
            </Box>
            {data.unassigned > 0 && <Chip component={RouterLink} to="/hr/employees?tab=incomplete" clickable label={t('org.unassigned', { count: data.unassigned })} sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 600 }} />}
          </Box>
          {ordered.length === 0 ? (
            <Box sx={{ ...(hrCard as object) }}>
              <HrEmptyState icon={<AccountTreeOutlinedIcon />} title={t('org.empty')} hint={t('org.emptyHint')} />
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
              {ordered.map(({ d, depth }, n) => {
                const color = colors[n % colors.length]!;
                const parent = nameOf(d.parentId);
                return (
                  <Box key={d.id} sx={{ ...(hrCard as object), p: 1.75, borderTop: `3px solid ${color}`, opacity: d.isActive ? 1 : 0.6 }}>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>{ar ? d.nameAr : d.nameEn}</Typography>
                        <Typography sx={{ fontSize: 12, color: hr.textMuted }}>
                          {d.manager ? t('org.manager', { name: d.manager.nameAr }) : t('org.noManager')}
                          {d.costCenter && ` · ${t('org.costCenter', { code: d.costCenter })}`}
                          {depth > 0 && parent && ` · ${t('org.sub', { name: ar ? parent.nameAr : parent.nameEn })}`}
                        </Typography>
                      </Box>
                      <Chip size="small" label={t('org.employees', { count: d.employees })} sx={{ bgcolor: hr.muted, color: '#475569', fontWeight: 600 }} />
                      {canManage && (
                        <>
                          <Tooltip title={t('staff.profile.edit')}>
                            <IconButton size="small" onClick={() => setDepartment(d)} aria-label={t('staff.profile.edit')}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('org.delete')}>
                            <IconButton size="small" onClick={() => void remove(() => staffApi.deleteDepartment(d.id))} aria-label={t('org.delete')}>
                              <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Stack>
                    <Stack sx={{ gap: 0.75, mt: 1.25 }}>
                      {d.positions.map((p) => {
                        const free = Math.max(0, p.seats - p.occupants.length);
                        const first = p.occupants[0];
                        return (
                          <Stack key={p.id} direction="row" sx={{ alignItems: 'center', gap: 1, px: 1.25, py: 0.75, borderRadius: '8px', bgcolor: '#F8FAFC', fontSize: 12.5, opacity: p.isActive ? 1 : 0.6 }}>
                            {first ? <HrAvatar name={first.nameEn} size={24} /> : <Box sx={{ width: 24, textAlign: 'center', color: hr.textMuted }}>＋</Box>}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <b>{ar ? p.jobTitleAr : p.jobTitleEn}</b>
                              {p.grade && <span style={{ color: hr.textMuted }}> · {p.grade}</span>}
                            </Box>
                            <Typography component="span" sx={{ fontSize: 12, color: free ? '#B45309' : hr.textMuted, whiteSpace: 'nowrap' }}>
                              {p.seats === 1 ? (first ? <RouterLink to={`/hr/employees/${first.id}`}>{first.nameAr}</RouterLink> : t('org.vacant')) : t('org.seats', { taken: p.occupants.length, seats: p.seats })}
                            </Typography>
                            {canManage && (
                              <IconButton size="small" onClick={() => setPosition({ position: p, departmentId: d.id })} aria-label={t('staff.profile.edit')}>
                                <EditOutlinedIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            )}
                          </Stack>
                        );
                      })}
                      {canManage && catalog && catalog.jobTitles.length > 0 && (
                        <Button size="small" startIcon={<Add />} onClick={() => setPosition({ position: null, departmentId: d.id })} sx={{ alignSelf: 'flex-start', border: `1.5px dashed #CBD5E1`, borderRadius: '8px', px: 1.5, color: hr.textMuted }}>
                          {t('org.newPosition')}
                        </Button>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          )}
        </>
      )}
      {department && data && (
        <DepartmentDialog
          department={department === 'new' ? null : department}
          departments={data.departments}
          onClose={() => setDepartment(null)}
          onSaved={() => {
            setDepartment(null);
            void reload();
          }}
        />
      )}
      {position && data && catalog && (
        <PositionDialog
          position={position.position}
          departmentId={position.departmentId}
          departments={data.departments}
          catalog={catalog}
          onClose={() => setPosition(null)}
          onDelete={position.position ? () => void remove(() => staffApi.deletePosition(position.position!.id)).then(() => setPosition(null)) : undefined}
          onSaved={() => {
            setPosition(null);
            void reload();
          }}
        />
      )}
    </HrScope>
  );
}

function DepartmentDialog({ department, departments, onClose, onSaved }: { department: Department | null; departments: Department[]; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const [v, setV] = useState({ nameAr: department?.nameAr ?? '', nameEn: department?.nameEn ?? '', parentId: department?.parentId ?? '', costCenter: department?.costCenter ?? '', sortOrder: department?.sortOrder ?? departments.length + 1, isActive: department?.isActive ?? true });
  const [manager, setManager] = useState<NamedRef | null>(department?.manager ?? null);
  const [options, setOptions] = useState<NamedRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = (text: string) => staffApi.pick(text).then(setOptions).catch(() => setOptions([]));
  useEffect(() => {
    void search('');
  }, []);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await staffApi.saveDepartment(department?.id ?? null, { nameAr: v.nameAr, nameEn: v.nameEn || null, parentId: v.parentId || null, costCenter: v.costCenter || null, managerId: manager?.id ?? null, sortOrder: Number(v.sortOrder), isActive: v.isActive });
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: `${hr.radius}px` } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{t('org.department.title')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, pt: 1 }}>
          <ErrorMessage messageKey={error} />
          <Stack direction="row" sx={{ gap: 1.5 }}>
            <TextField label={t('org.department.nameAr')} value={v.nameAr} onChange={(e) => setV({ ...v, nameAr: e.target.value })} fullWidth required />
            <TextField label={t('org.department.nameEn')} value={v.nameEn} onChange={(e) => setV({ ...v, nameEn: e.target.value })} fullWidth />
          </Stack>
          <TextField select label={t('org.department.parent')} value={v.parentId} onChange={(e) => setV({ ...v, parentId: e.target.value })} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value="">{t('org.department.none')}</MenuItem>
            {departments.filter((d) => d.id !== department?.id).map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {i18n.language === 'ar' ? d.nameAr : d.nameEn}
              </MenuItem>
            ))}
          </TextField>
          <Autocomplete
            options={options}
            value={manager}
            onChange={(_, value) => setManager(value)}
            onInputChange={(_, text) => void search(text)}
            getOptionLabel={(o) => o.nameAr}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(x) => x}
            renderInput={(params) => <TextField {...params} label={t('org.department.manager')} />}
          />
          <Stack direction="row" sx={{ gap: 1.5 }}>
            <TextField label={t('org.department.costCenter')} value={v.costCenter} onChange={(e) => setV({ ...v, costCenter: e.target.value })} fullWidth />
            <TextField type="number" label={t('org.department.sortOrder')} value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) })} fullWidth />
          </Stack>
          {department && <FormControlLabel control={<Checkbox checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} />} label={t('org.department.active')} />}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || !v.nameAr.trim()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PositionDialog({ position, departmentId, departments, catalog, onClose, onSaved, onDelete }: { position: Position | null; departmentId: string; departments: Department[]; catalog: Catalog; onClose: () => void; onSaved: () => void; onDelete?: () => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [v, setV] = useState({ departmentId: position?.departmentId ?? departmentId, jobTitleId: position?.jobTitleId ?? catalog.jobTitles[0]?.id ?? '', gradeId: position?.gradeId ?? '', reportsToId: position?.reportsToId ?? '', seats: position?.seats ?? 1, isActive: position?.isActive ?? true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const peers = departments.flatMap((d) => d.positions.filter((p) => p.id !== position?.id).map((p) => ({ id: p.id, label: `${ar ? p.jobTitleAr : p.jobTitleEn} — ${ar ? d.nameAr : d.nameEn}` })));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await staffApi.savePosition(position?.id ?? null, { departmentId: v.departmentId, jobTitleId: v.jobTitleId, gradeId: v.gradeId || null, reportsToId: v.reportsToId || null, seats: Number(v.seats), isActive: v.isActive });
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: `${hr.radius}px` } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{t('org.position.title')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, pt: 1 }}>
          <ErrorMessage messageKey={error} />
          <TextField select label={t('org.position.department')} value={v.departmentId} onChange={(e) => setV({ ...v, departmentId: e.target.value })}>
            {departments.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {ar ? d.nameAr : d.nameEn}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" sx={{ gap: 1.5 }}>
            <TextField select label={t('org.position.jobTitle')} value={v.jobTitleId} onChange={(e) => setV({ ...v, jobTitleId: e.target.value })} fullWidth>
              {catalog.jobTitles.filter((j) => j.isActive || j.id === v.jobTitleId).map((j) => (
                <MenuItem key={j.id} value={j.id}>
                  {ar ? j.nameAr : j.nameEn}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label={t('org.position.grade')} value={v.gradeId} onChange={(e) => setV({ ...v, gradeId: e.target.value })} fullWidth slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value="">—</MenuItem>
              {catalog.grades.filter((g) => g.isActive || g.id === v.gradeId).map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.code} · {g.nameAr}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField select label={t('org.position.reportsTo')} value={v.reportsToId} onChange={(e) => setV({ ...v, reportsToId: e.target.value })} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value="">{t('org.position.none')}</MenuItem>
            {peers.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
            <TextField type="number" label={t('org.position.seats')} value={v.seats} onChange={(e) => setV({ ...v, seats: Number(e.target.value) })} sx={{ width: 160 }} slotProps={{ htmlInput: { min: 1, max: 500 } }} />
            {position && <FormControlLabel control={<Checkbox checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} />} label={t('org.position.active')} />}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {onDelete && (
          <Button color="error" onClick={onDelete} disabled={busy} sx={{ marginInlineEnd: 'auto' }}>
            {t('org.delete')}
          </Button>
        )}
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || !v.jobTitleId}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
