import Add from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SyncIcon from '@mui/icons-material/Sync';
import TableViewOutlinedIcon from '@mui/icons-material/TableViewOutlined';
import { Alert, Box, Button, Chip, InputAdornment, Link, MenuItem, Pagination, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { staffApi, type Department, type StaffPage, type StaffTab } from '../../api/staff';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrScope, hr } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { useLegalEntities } from '../payroll/RunDialogs';
import { card, wf } from '../workforce/workforceUi';
import { AddStaffDialog } from './AddStaffDialog';
import { BulkUpdateDialog } from './BulkUpdateDialog';
import { daysUntil, StaffStatusBadge } from './staff';

const tabs: StaffTab[] = ['all', 'active', 'probation', 'ending', 'incomplete', 'left'];

/**
 * The staff directory, laid out as the workers list (the user's choice, 2026-10-24; an exception to the HR spec's page
 * header and KPI row, docs/02-target-architecture/22): one toolbar — search, status, department, registration, the
 * total and the actions — the applied filters, and a dense table with a navy header and the employee column held in
 * place; the employees come page by page from the server, as before.
 */
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hire, setHire] = useState(creating);
  const [bulk, setBulk] = useState(false);
  const [version, setVersion] = useState(0);
  const latest = useRef(0);
  const canManage = can('staff.manage', true);
  const ar = i18n.language === 'ar';

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setPage(1), [query, department, entity, tab, pageSize]);

  useEffect(() => {
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

  const setTab = (value: StaffTab) => setParams((p) => (value === 'all' ? p.delete('tab') : p.set('tab', value), p), { replace: true });
  const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  const filtered = !!(query || department || entity || tab !== 'all');
  const departmentName = departments.find((d) => d.id === department);
  const entityName = entities.find((e) => e.id === entity);
  const control = { '& .MuiOutlinedInput-root': { borderRadius: wf.control, height: 40 } };
  const chip = { bgcolor: wf.goldSoft, color: wf.navy, fontWeight: 600, '& .MuiChip-deleteIcon': { color: wf.goldText } };

  return (
    <HrScope>
      <ErrorMessage messageKey={error} />
      {notice && (
        <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      <Box sx={{ ...(card as object), p: { xs: 1.5, md: 2 } }}>
        {/* Toolbar: search, status, department, registration, the total and the actions. */}
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.25, alignItems: { md: 'center' }, mb: 1.25, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label={t('workforce.ui.searchLabel')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('staff.filters.search')}
            sx={{ width: { xs: '100%', md: 300 }, ...control }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, inputLabel: { shrink: true } }}
          />
          <TextField select size="small" label={t('staff.cols.status')} value={tab} onChange={(e) => setTab(e.target.value as StaffTab)} sx={{ width: { xs: '100%', md: 180 }, ...control }}>
            {tabs.map((k) => (
              <MenuItem key={k} value={k}>
                {t(`staff.tabs.${k}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label={t('staff.filters.department')} value={department} onChange={(e) => setDepartment(e.target.value)} sx={{ width: { xs: '100%', md: 200 }, ...control }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value="">{t('staff.filters.allDepartments')}</MenuItem>
            {departments.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {ar ? d.nameAr : d.nameEn}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label={t('staff.filters.legalEntity')} value={entity} onChange={(e) => setEntity(e.target.value)} sx={{ width: { xs: '100%', md: 190 }, ...control }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value="">{t('staff.filters.allEntities')}</MenuItem>
            {entities.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {localName(e, i18n.language)}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ flex: 1 }} />
          {canManage && (
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button variant="outlined" startIcon={<SyncIcon />} disabled={busy} onClick={() => void runImport()} sx={{ height: 40, borderRadius: wf.control, borderColor: wf.border, color: wf.navy }}>
                {t('staff.import')}
              </Button>
              {can('staff.bulk_update', true) && (
                <Button variant="outlined" startIcon={<TableViewOutlinedIcon />} onClick={() => setBulk(true)} sx={{ height: 40, borderRadius: wf.control, borderColor: wf.border, color: wf.navy }}>
                  {t('staff.bulk.action')}
                </Button>
              )}
              <Button variant="contained" startIcon={<Add />} onClick={() => setHire(true)} sx={{ height: 40, borderRadius: wf.control, bgcolor: wf.navy, boxShadow: 'none', '&:hover': { bgcolor: wf.navyHover, boxShadow: 'none' } }}>
                {t('staff.new')}
              </Button>
            </Stack>
          )}
          <Box sx={{ textAlign: 'end' }}>
            <Typography sx={{ fontSize: 12, color: wf.textSecondary, lineHeight: 1.2 }}>{t('workforce.ui.total.staff')}</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 600, color: wf.navy, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>{data ? data.total.toLocaleString('en-US') : '—'}</Typography>
          </Box>
        </Stack>

        {/* The applied filters, each removable, and «clear all». */}
        {filtered && (
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, mb: 1.25, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 12.5, color: wf.textSecondary }}>{t('workforce.ui.applied')}</Typography>
            {tab !== 'all' && <Chip size="small" label={`${t('staff.cols.status')}: ${t(`staff.tabs.${tab}`)}`} onDelete={() => setTab('all')} deleteIcon={<CloseIcon />} sx={chip} />}
            {departmentName && <Chip size="small" label={`${t('staff.filters.department')}: ${ar ? departmentName.nameAr : departmentName.nameEn}`} onDelete={() => setDepartment('')} deleteIcon={<CloseIcon />} sx={chip} />}
            {entityName && <Chip size="small" label={`${t('staff.filters.legalEntity')}: ${localName(entityName, i18n.language)}`} onDelete={() => setEntity('')} deleteIcon={<CloseIcon />} sx={chip} />}
            {query && <Chip size="small" label={`${t('workforce.ui.searchLabel')}: ${query}`} onDelete={() => (setSearch(''), setQuery(''))} deleteIcon={<CloseIcon />} sx={chip} />}
            <Link component="button" onClick={() => (setSearch(''), setQuery(''), setDepartment(''), setEntity(''), setTab('all'))} sx={{ fontSize: 12.5, fontWeight: 600, color: wf.navy }}>
              {t('workforce.ui.clearAll')}
            </Link>
          </Stack>
        )}

        {!data ? (
          <Stack sx={{ gap: 0.5 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} height={40} />
            ))}
          </Stack>
        ) : data.total === 0 ? (
          <HrEmptyState icon={<PersonSearchOutlinedIcon />} title={filtered ? t('staff.noResults') : t('staff.empty')} hint={filtered ? undefined : t('staff.emptyHint')} />
        ) : (
          <>
            <TableContainer sx={{ maxHeight: 'calc(100dvh - 240px)', minHeight: 240, border: `1px solid ${wf.border}`, borderRadius: wf.control }}>
              <Table
                size="small"
                stickyHeader
                sx={{
                  borderCollapse: 'separate',
                  // !important: the HR theme (HrScope) styles table heads light; this list's head is navy, as the workers list.
                  '& thead th': { bgcolor: `${wf.navy} !important`, color: '#fff !important', fontSize: 12.5, fontWeight: 600, py: 1.25, borderBottom: '0 !important', whiteSpace: 'nowrap' },
                  '& td': { fontSize: 13, color: wf.text, height: 44, py: 0.5, borderBottom: `1px solid ${wf.subtle}` },
                  '& tbody tr:hover td': { bgcolor: wf.rowHover },
                  // The employee column stays in view while scrolling sideways.
                  '& .pin': { position: 'sticky', insetInlineStart: 0, zIndex: 2, bgcolor: wf.surface, boxShadow: `inset -1px 0 0 ${wf.border}` },
                  '& th.pin': { zIndex: 4, bgcolor: wf.navy },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell className="pin" sx={{ minWidth: 220 }}>{t('staff.cols.employee')}</TableCell>
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
                    const open = () => navigate(`/hr/employees/${r.id}`);
                    return (
                      <TableRow
                        key={r.id}
                        hover
                        tabIndex={0}
                        sx={{ cursor: 'pointer', '&:focus-visible td': { bgcolor: wf.rowHover }, '&:focus-visible': { outline: `2px solid ${wf.gold}`, outlineOffset: -2 } }}
                        onClick={open}
                        onKeyDown={(e) => e.key === 'Enter' && open()}
                      >
                        <TableCell className="pin">
                          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                            <HrAvatar name={r.nameEn || r.name} size={28} />
                            <Box sx={{ minWidth: 0, maxWidth: 240 }}>
                              <Typography sx={{ fontWeight: 600, fontSize: 13, color: wf.navy, lineHeight: 1.3 }}>{r.name}</Typography>
                              <Typography sx={{ fontSize: 11.5, color: wf.textSecondary }}>{(ar ? r.nationalityAr : r.nationalityEn) ?? ''}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', color: `${wf.textSecondary} !important` }}>
                          <bdi>{r.employeeNo}</bdi>
                        </TableCell>
                        <TableCell>{(ar ? r.departmentAr : r.departmentEn) ?? t('staff.unset')}</TableCell>
                        <TableCell>{(ar ? r.jobTitleAr : r.jobTitleEn) ?? t('staff.unset')}</TableCell>
                        <TableCell>
                          <StaffStatusBadge status={r.status} />
                        </TableCell>
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.hireDate ? date(r.hireDate) : '—'}</TableCell>
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: left !== null && left >= 0 && left <= 90 ? '#B45309 !important' : undefined, fontWeight: left !== null && left >= 0 && left <= 90 ? 700 : undefined }}>
                          {r.contractEndsOn ? date(r.contractEndsOn) : '—'}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 64, height: 6, borderRadius: 99, bgcolor: wf.subtle, overflow: 'hidden' }} role="img" aria-label={`${r.completeness}%`}>
                              <Box sx={{ height: '100%', width: `${r.completeness}%`, bgcolor: r.completeness >= 80 ? hr.success : r.completeness >= 50 ? hr.warning : hr.danger }} />
                            </Box>
                            <Typography component="span" sx={{ fontSize: 12, color: wf.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                              <bdi>{r.completeness}%</bdi>
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Button size="small" sx={{ fontWeight: 600, color: wf.navy }}>
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
              <Typography sx={{ fontSize: 12.5, color: wf.textSecondary }}>{t('staff.shown', { from, to, total: data.total })}</Typography>
              <Box sx={{ flex: 1 }} />
              <Pagination count={Math.max(1, Math.ceil(data.total / data.pageSize))} page={data.page} onChange={(_, p) => setPage(p)} shape="rounded" size="small" sx={{ '& .Mui-selected': { bgcolor: `${wf.navy} !important`, color: '#fff' } }} />
              <TextField select size="small" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} sx={{ width: 150, '& .MuiOutlinedInput-root': { borderRadius: wf.control } }}>
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
      {hire && (
        <AddStaffDialog
          onClose={() => {
            setHire(false);
            if (creating) navigate('/hr/employees');
          }}
          onCreated={() => setVersion((v) => v + 1)}
        />
      )}
      {bulk && (
        <BulkUpdateDialog
          onClose={() => setBulk(false)}
          onApplied={(changes) => {
            setBulk(false);
            setNotice(t('staff.bulk.applied', { count: changes }));
            setVersion((v) => v + 1);
          }}
        />
      )}
    </HrScope>
  );
}
