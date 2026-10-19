import Add from '@mui/icons-material/Add';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SyncIcon from '@mui/icons-material/Sync';
import { Alert, Box, Button, InputAdornment, LinearProgress, MenuItem, Pagination, Skeleton, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { staffApi, type Department, type StaffKpis, type StaffPage, type StaffTab } from '../../api/staff';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrPageHeader, HrScope, hr, hrAccents, hrCard } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { useLegalEntities } from '../payroll/RunDialogs';
import { HireDialog } from './StaffDialogs';
import { daysUntil, StaffStatusBadge } from './staff';

const tabs: StaffTab[] = ['all', 'active', 'probation', 'ending', 'incomplete', 'left'];

/** The staff directory: the cards, the tabs and filters, and the employees page by page from the server. */
export function StaffDirectoryPage({ creating = false }: { creating?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const entities = useLegalEntities();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as StaffTab | null) ?? 'all';
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<StaffPage | null>(null);
  const [kpis, setKpis] = useState<StaffKpis | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hire, setHire] = useState(creating);
  const [version, setVersion] = useState(0);
  const latest = useRef(0);
  const canManage = can('staff.manage', true);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setPage(1), [query, department, entity, tab, pageSize]);

  useEffect(() => {
    staffApi.kpis().then(setKpis).catch(() => setKpis(null));
    staffApi.structure().then((s) => setDepartments(s.departments)).catch(() => setDepartments([]));
  }, [version]);

  const q = useMemo(() => ({ search: query, tab, departmentId: department || undefined, legalEntityId: entity || undefined, page, pageSize }), [query, tab, department, entity, page, pageSize]);
  useEffect(() => {
    const ticket = ++latest.current;
    staffApi
      .employees(q)
      .then((d) => ticket === latest.current && (setData(d), setError(null)))
      .catch((failure) => ticket === latest.current && setError(errorKey(failure)));
  }, [q, version]);

  const runImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await staffApi.importOld();
      setNotice(t('staff.imported', r));
      setVersion((v) => v + 1);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const cards: [string, number | null, string, string, string][] = kpis
    ? [
        [t('staff.kpi.employees'), kpis.employees, t('staff.kpi.employeesSub', { active: kpis.active, probation: kpis.probation, suspended: kpis.suspended }), hr.text, hrAccents.violet.tint],
        [t('staff.kpi.probation'), kpis.probation, t('staff.kpi.probationSub', { count: kpis.probationEndingIn30 }), hr.primary, hrAccents.blue.tint],
        [t('staff.kpi.ending'), kpis.contractsEndingIn90, t('staff.kpi.endingSub', { in60: kpis.contractsEndingIn60, in30: kpis.contractsEndingIn30 }), '#B45309', hrAccents.amber.tint],
        [t('staff.kpi.incomplete'), kpis.incomplete, t('staff.kpi.incompleteSub'), '#B91C1C', hrAccents.rose.tint],
        [t('staff.kpi.vacancies'), kpis.vacancies, t('staff.kpi.vacanciesSub', { count: kpis.departmentsWithVacancies }), hr.success, hrAccents.green.tint],
      ]
    : [];
  const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;

  return (
    <HrScope>
      <HrPageHeader
        icon={<BadgeOutlinedIcon />}
        title={t('staff.title')}
        subtitle={t('staff.intro')}
        actions={
          canManage && (
            <>
              <Button variant="outlined" startIcon={<SyncIcon />} disabled={busy} onClick={() => void runImport()}>
                {t('staff.import')}
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => setHire(true)}>
                {t('staff.new')}
              </Button>
            </>
          )
        }
      />
      <ErrorMessage messageKey={error} />
      {notice && (
        <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      <Box sx={{ display: 'grid', gap: 1.5, mb: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {kpis
          ? cards.map(([label, value, sub, color, tint]) => (
              <Box key={label} sx={{ ...(hrCard as object), bgcolor: tint, p: 1.75 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{label}</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value?.toLocaleString('en-US') ?? '—'}</Typography>
                <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{sub}</Typography>
              </Box>
            ))
          : Array.from({ length: 5 }, (_, i) => <Skeleton key={i} variant="rounded" height={96} />)}
      </Box>
      <Box sx={{ ...(hrCard as object), px: 2, pb: 2 }}>
        <Tabs value={tab} onChange={(_, v: StaffTab) => setParams((p) => (p.set('tab', v), p), { replace: true })} variant="scrollable" sx={{ borderBottom: `1px solid ${hr.border}`, mb: 1.5 }}>
          {tabs.map((k) => (
            <Tab key={k} value={k} label={t(`staff.tabs.${k}`)} />
          ))}
        </Tabs>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, mb: 1.5 }}>
          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('staff.filters.search')}
            sx={{ width: { md: 320 }, flex: { md: '0 0 320px' } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': t('staff.filters.search') } }}
          />
          <TextField select size="small" label={t('staff.filters.department')} value={department} onChange={(e) => setDepartment(e.target.value)} sx={{ width: { md: 240 } }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value="">{t('staff.filters.allDepartments')}</MenuItem>
            {departments.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {i18n.language === 'ar' ? d.nameAr : d.nameEn}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label={t('staff.filters.legalEntity')} value={entity} onChange={(e) => setEntity(e.target.value)} sx={{ width: { md: 220 } }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value="">{t('staff.filters.allEntities')}</MenuItem>
            {entities.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {localName(e, i18n.language)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        {!data ? (
          <LinearProgress />
        ) : data.total === 0 ? (
          <HrEmptyState icon={<PersonSearchOutlinedIcon />} title={query || department || entity || tab !== 'all' ? t('staff.noResults') : t('staff.empty')} hint={query || department || entity ? undefined : t('staff.emptyHint')} />
        ) : (
          <>
            <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
              <Table size="small" sx={{ '& td': { height: 46 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('staff.cols.employee')}</TableCell>
                    <TableCell>{t('staff.cols.number')}</TableCell>
                    <TableCell>{t('staff.cols.department')}</TableCell>
                    <TableCell>{t('staff.cols.jobTitle')}</TableCell>
                    <TableCell>{t('staff.cols.status')}</TableCell>
                    <TableCell>{t('staff.cols.hire')}</TableCell>
                    <TableCell>{t('staff.cols.contractEnd')}</TableCell>
                    <TableCell>{t('staff.cols.file')}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((r) => {
                    const left = daysUntil(r.contractEndsOn);
                    const ar = i18n.language === 'ar';
                    return (
                      <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/hr/employees/${r.id}`)}>
                        <TableCell>
                          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                            <HrAvatar name={r.nameEn || r.name} size={30} />
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{r.name}</Typography>
                              <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{(ar ? r.nationalityAr : r.nationalityEn) ?? ''}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', color: hr.textMuted }}>
                          <bdi>{r.employeeNo}</bdi>
                        </TableCell>
                        <TableCell>{(ar ? r.departmentAr : r.departmentEn) ?? t('staff.unset')}</TableCell>
                        <TableCell>{(ar ? r.jobTitleAr : r.jobTitleEn) ?? t('staff.unset')}</TableCell>
                        <TableCell>
                          <StaffStatusBadge status={r.status} />
                        </TableCell>
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.hireDate ? date(r.hireDate) : '—'}</TableCell>
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', color: left !== null && left >= 0 && left <= 90 ? '#B45309' : undefined, fontWeight: left !== null && left >= 0 && left <= 90 ? 700 : undefined }}>
                          {r.contractEndsOn ? date(r.contractEndsOn) : '—'}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 64, height: 6, borderRadius: 99, bgcolor: '#EEF2F7', overflow: 'hidden' }} role="img" aria-label={`${r.completeness}%`}>
                              <Box sx={{ height: '100%', width: `${r.completeness}%`, bgcolor: r.completeness >= 80 ? hr.success : r.completeness >= 50 ? hr.warning : hr.danger }} />
                            </Box>
                            <Typography component="span" sx={{ fontSize: 12, color: hr.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                              <bdi>{r.completeness}%</bdi>
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Button size="small" sx={{ fontWeight: 600 }}>
                            {t('staff.open')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: 'center', gap: 1.5, mt: 1.5 }}>
              <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>{t('staff.shown', { from, to, total: data.total })}</Typography>
              <Box sx={{ flex: 1 }} />
              <Pagination count={Math.max(1, Math.ceil(data.total / data.pageSize))} page={data.page} onChange={(_, p) => setPage(p)} shape="rounded" color="primary" size="small" />
              <TextField select size="small" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} sx={{ width: 150 }}>
                {[10, 25, 50, 100].map((n) => (
                  <MenuItem key={n} value={n}>
                    {t('staff.perPage', { count: n })}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </>
        )}
      </Box>
      <HireDialog
        open={hire}
        departments={departments}
        onClose={() => {
          setHire(false);
          if (creating) navigate('/hr/employees');
        }}
        onSaved={(id) => navigate(`/hr/employees/${id}`)}
      />
    </HrScope>
  );
}
