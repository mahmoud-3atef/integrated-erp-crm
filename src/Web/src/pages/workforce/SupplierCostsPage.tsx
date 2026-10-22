import Add from '@mui/icons-material/Add';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
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
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { costsApi, type CostImport, type CostInput, type CostMethod, type CostOptions, type CostOverview, type CostPackage, type SupplierWorker } from '../../api/costs';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard } from '../../components/KpiCard';
import { Badge, PageHeader, PillTabs } from '../../components/ui';
import { DateField } from '../../components/DateField';

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

/**
 * What each worker of a supplier costs the company (docs/03-migration-plan/16): the suppliers' packages (by profession
 * and nationality), the workers with their cost today, and an Excel round trip to enter the costs at once.
 */
export function SupplierCostsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const ar = i18n.language === 'ar';
  const manage = can('workforce.costs.manage', true);
  const [tab, setTab] = useState<'workers' | 'packages'>('workers');
  const [overview, setOverview] = useState<CostOverview | null>(null);
  const [options, setOptions] = useState<CostOptions | null>(null);
  const [workers, setWorkers] = useState<SupplierWorker[] | null>(null);
  const [packages, setPackages] = useState<CostPackage[] | null>(null);
  const [supplier, setSupplier] = useState<string | null>(null);
  const [missing, setMissing] = useState<boolean | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ kind: 'package'; id: string | null; input: CostInput } | { kind: 'card'; worker: SupplierWorker; input: CostInput } | null>(null);
  const [imported, setImported] = useState<CostImport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const money = (v: number) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { maximumFractionDigits: 2 }).format(v);

  const load = useCallback(() => {
    setError(null);
    costsApi.overview().then(setOverview).catch((f) => setError(errorKey(f)));
    costsApi.packages().then(setPackages).catch((f) => setError(errorKey(f)));
  }, []);
  useEffect(() => {
    load();
    costsApi.options().then(setOptions).catch((f) => setError(errorKey(f)));
  }, [load]);
  useEffect(() => {
    setWorkers(null);
    const id = setTimeout(() => costsApi.workers({ supplier, missing, search }).then(setWorkers).catch((f) => setError(errorKey(f))), search ? 300 : 0);
    return () => clearTimeout(id);
  }, [supplier, missing, search, overview]);

  if (!can('workforce.costs.view', true)) return <Alert severity="warning">{t('costs.noAccess')}</Alert>;

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      if (editing.kind === 'card') await costsApi.addCard(editing.worker.workerId, editing.input);
      else if (editing.id) await costsApi.savePackage(editing.id, editing.input);
      else await costsApi.addPackage(editing.input);
      setEditing(null);
      load();
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };
  const upload = async (picked: File | undefined) => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      setImported(await costsApi.import(picked));
      load();
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };
  const method = (m: CostMethod | null) => (m ? t(`costs.method.${m}`) : '—');
  const name = (ar_: string | null, en: string | null) => (ar ? ar_ : en) ?? '—';
  const newInput = (s: string | null): CostInput => ({ supplier: s, professionCode: null, nationalityCode: null, monthlyCost: 0, method: 'MonthlyFixed', effectiveFrom: monthStart(), notes: null });

  return (
    <Box>
      <PageHeader
        title={t('costs.title')}
        subtitle={t('costs.intro')}
        actions={
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Button startIcon={<FileDownloadOutlinedIcon />} component="a" href={costsApi.templateUrl(supplier)}>
              {t('costs.template')}
            </Button>
            {manage && (
              <>
                <Button variant="outlined" startIcon={<FileUploadOutlinedIcon />} disabled={busy} onClick={() => file.current?.click()}>
                  {t('costs.upload')}
                </Button>
                <Button variant="contained" startIcon={<Add />} onClick={() => setEditing({ kind: 'package', id: null, input: newInput(supplier) })}>
                  {t('costs.addPackage')}
                </Button>
              </>
            )}
            <input ref={file} type="file" hidden accept=".xlsx" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
          </Stack>
        }
      />
      <ErrorMessage messageKey={editing ? null : error} />
      {busy && <LinearProgress sx={{ mb: 1 }} />}

      <Box sx={{ display: 'grid', gap: `${tokens.gap}px`, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mt: 3.5, mb: `${tokens.gap}px` }}>
        <KpiCard label={t('costs.kpi.workers')} value={overview?.supplierWorkers ?? '—'} foot={t('costs.kpi.workersFoot', { count: overview?.suppliers.length ?? 0 })} icon={<GroupsOutlinedIcon />} tone={tokens.navy600} active={missing === null} onClick={() => setMissing(null)} />
        <KpiCard label={t('costs.kpi.card')} value={overview?.withCard ?? '—'} foot={t('costs.kpi.cardFoot')} icon={<PersonOutlineOutlinedIcon />} tone={tokens.success} />
        <KpiCard label={t('costs.kpi.package')} value={overview?.byPackage ?? '—'} foot={t('costs.kpi.packageFoot')} icon={<Inventory2OutlinedIcon />} tone={tokens.info} />
        <KpiCard label={t('costs.kpi.missing')} value={overview?.missing ?? '—'} foot={t('costs.kpi.missingFoot')} icon={<ReportProblemOutlinedIcon />} tone={tokens.danger} active={missing === true} onClick={() => setMissing(missing === true ? null : true)} />
      </Box>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, mb: 2, alignItems: { md: 'center' } }}>
          <PillTabs value={tab} onChange={setTab} options={[{ value: 'workers', label: t('costs.tabs.workers') }, { value: 'packages', label: t('costs.tabs.packages', { count: packages?.length ?? 0 }) }]} />
          <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', flex: 1 }}>
            <SupplierChip on={supplier === null} label={t('costs.allSuppliers')} onClick={() => setSupplier(null)} />
            {overview?.suppliers.map((s) => (
              <SupplierChip key={s.supplier} on={supplier === s.supplier} label={s.supplier} count={s.workers} warn={s.missing} onClick={() => setSupplier(supplier === s.supplier ? null : s.supplier)} />
            ))}
          </Stack>
        </Stack>

        {tab === 'workers' ? (
          <>
            <TextField
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('costs.search')}
              sx={{ mb: 1.5, maxWidth: 420 }}
              slotProps={{ input: { startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) } }}
            />
            {!workers ? (
              <LinearProgress />
            ) : workers.length === 0 ? (
              <Typography sx={{ p: 3, textAlign: 'center', color: tokens.gray500 }}>{t('costs.empty')}</Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 'calc(100vh - 360px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('costs.col.worker')}</TableCell>
                      <TableCell>{t('costs.col.supplier')}</TableCell>
                      <TableCell>{t('costs.col.profession')}</TableCell>
                      <TableCell>{t('costs.col.nationality')}</TableCell>
                      <TableCell>{t('costs.col.status')}</TableCell>
                      <TableCell align="right">{t('costs.col.cost')}</TableCell>
                      <TableCell>{t('costs.col.method')}</TableCell>
                      <TableCell>{t('costs.col.source')}</TableCell>
                      <TableCell>{t('costs.col.from')}</TableCell>
                      {manage && <TableCell />}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workers.map((w) => (
                      <TableRow key={w.workerId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/workforce/workers/${w.workerId}?tab=cost`)}>
                        <TableCell>
                          <Typography dir="auto" sx={{ fontSize: 12.5, fontWeight: 600, unicodeBidi: 'plaintext', textAlign: 'start' }}>
                            {w.name}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>
                            <bdi>{w.workerNo}</bdi>
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <bdi>{w.supplier}</bdi>
                        </TableCell>
                        <TableCell>{name(w.professionAr, w.professionEn)}</TableCell>
                        <TableCell>{name(w.nationalityAr, w.nationalityEn)}</TableCell>
                        <TableCell>{t(`workforce.placement.${w.placement}`)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                          {w.monthlyCost !== null ? money(w.monthlyCost) : '—'}
                        </TableCell>
                        <TableCell>{method(w.method)}</TableCell>
                        <TableCell>
                          {w.costSource ? <Badge tone={w.costSource === 'Card' ? 'success' : 'info'}>{t(`costs.source.${w.costSource}`)}</Badge> : <Badge tone="danger">{t('costs.source.none')}</Badge>}
                        </TableCell>
                        <TableCell>
                          <bdi>{w.effectiveFrom?.replaceAll('-', '/') ?? '—'}</bdi>
                        </TableCell>
                        {manage && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Tooltip title={t('costs.setCost')}>
                              <IconButton size="small" onClick={() => setEditing({ kind: 'card', worker: w, input: { ...newInput(w.supplier), monthlyCost: w.monthlyCost ?? 0, method: w.method ?? 'MonthlyFixed' } })} aria-label={t('costs.setCost')}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        ) : !packages ? (
          <LinearProgress />
        ) : (
          <>
            <Typography sx={{ fontSize: 12.5, color: tokens.gray500, mb: 1.5 }}>{t('costs.packagesHint')}</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('costs.col.supplier')}</TableCell>
                    <TableCell>{t('costs.col.profession')}</TableCell>
                    <TableCell>{t('costs.col.nationality')}</TableCell>
                    <TableCell align="right">{t('costs.col.cost')}</TableCell>
                    <TableCell>{t('costs.col.method')}</TableCell>
                    <TableCell>{t('costs.col.from')}</TableCell>
                    <TableCell>{t('costs.col.covered')}</TableCell>
                    {manage && <TableCell />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {packages
                    .filter((p) => supplier === null || p.supplier === supplier)
                    .map((p) => (
                      <TableRow key={p.id} hover>
                        <TableCell sx={{ fontWeight: 700 }}>
                          <bdi>{p.supplier}</bdi>
                        </TableCell>
                        <TableCell>{p.professionCode ? name(p.professionAr, p.professionEn) : t('costs.any')}</TableCell>
                        <TableCell>{p.nationalityCode ? name(p.nationalityAr, p.nationalityEn) : t('costs.any')}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>
                          {money(p.monthlyCost)}
                        </TableCell>
                        <TableCell>{method(p.method)}</TableCell>
                        <TableCell>
                          <bdi>{p.effectiveFrom.replaceAll('-', '/')}</bdi>
                        </TableCell>
                        <TableCell>{t('costs.workersCount', { count: p.workers })}</TableCell>
                        {manage && (
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <IconButton size="small" aria-label={t('common.edit')} onClick={() => setEditing({ kind: 'package', id: p.id, input: { supplier: p.supplier, professionCode: p.professionCode, nationalityCode: p.nationalityCode, monthlyCost: p.monthlyCost, method: p.method, effectiveFrom: p.effectiveFrom, notes: p.notes } })}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" aria-label={t('costs.deletePackage')} onClick={() => window.confirm(t('costs.deleteConfirm')) && costsApi.deletePackage(p.id).then(load).catch((f) => setError(errorKey(f)))}>
                              <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  {packages.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ textAlign: 'center', color: tokens.gray500, py: 3 }}>
                        {t('costs.noPackages')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Box>

      {editing && (
        <CostDialog
          title={editing.kind === 'card' ? t('costs.cardTitle', { name: editing.worker.name }) : editing.id ? t('costs.editPackage') : t('costs.addPackage')}
          input={editing.input}
          options={options}
          package={editing.kind === 'package'}
          error={error}
          busy={busy}
          onChange={(input) => setEditing({ ...editing, input } as typeof editing)}
          onClose={() => { setEditing(null); setError(null); }}
          onSave={save}
        />
      )}

      {imported && (
        <Dialog open onClose={() => setImported(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>{t('costs.imported.title')}</DialogTitle>
          <DialogContent>
            <Alert severity={imported.failed ? 'warning' : 'success'} sx={{ mb: 1.5 }}>
              {t('costs.imported.summary', { added: imported.added, failed: imported.failed })}
            </Alert>
            {imported.errors.map((e) => (
              <Typography key={e.row} sx={{ fontSize: 12.5 }}>
                {t('costs.imported.row', { row: e.row, no: e.workerNo ?? '—' })}: {e.error ? t(e.error) : ''}
              </Typography>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImported(null)}>{t('common.close')}</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

function SupplierChip({ on, label, count, warn, onClick }: { on: boolean; label: string; count?: number; warn?: number; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <ButtonBase onClick={onClick} aria-pressed={on} sx={{ gap: 0.75, px: 1.25, py: 0.5, borderRadius: 99, border: `1px solid ${on ? tokens.navy700 : tokens.gray200}`, bgcolor: on ? tokens.navy700 : '#fff', color: on ? '#fff' : tokens.navy800, fontSize: 12.5, fontWeight: 700 }}>
      <bdi>{label}</bdi>
      {count !== undefined && <Box component="span" sx={{ px: 0.75, borderRadius: 99, fontSize: 11.5, bgcolor: on ? 'rgba(255,255,255,.2)' : tokens.gray100 }}>{count}</Box>}
      {!!warn && (
        <Tooltip title={t('costs.missingTip', { count: warn })}>
          <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tokens.danger }} />
        </Tooltip>
      )}
    </ButtonBase>
  );
}

/** A package's or a worker's cost: the supplier, the monthly cost, how it is charged and from when. */
export function CostDialog({
  title,
  input,
  options,
  package: isPackage,
  error,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  title: string;
  input: CostInput;
  options: CostOptions | null;
  package: boolean;
  error: string | null;
  busy: boolean;
  onChange: (input: CostInput) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{title}</DialogTitle>
      <DialogContent>
        <ErrorMessage messageKey={error} />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, pt: 1 }}>
          <TextField select label={t('costs.col.supplier')} value={input.supplier ?? ''} disabled={!isPackage} onChange={(e) => onChange({ ...input, supplier: e.target.value })} required>
            {(options?.suppliers ?? (input.supplier ? [input.supplier] : [])).map((s) => (
              <MenuItem key={s} value={s}>
                <bdi>{s}</bdi>
              </MenuItem>
            ))}
            {input.supplier && options && !options.suppliers.includes(input.supplier) && <MenuItem value={input.supplier}>{input.supplier}</MenuItem>}
          </TextField>
          <TextField
            type="number"
            label={t('costs.col.cost')}
            value={input.monthlyCost || ''}
            onChange={(e) => onChange({ ...input, monthlyCost: Number(e.target.value) })}
            required
            slotProps={{ htmlInput: { min: 0, step: 50 }, input: { endAdornment: <InputAdornment position="end">{t('workforce.sar')}</InputAdornment> } }}
          />
          {isPackage && (
            <>
              <TextField select label={t('costs.col.profession')} value={input.professionCode ?? ''} onChange={(e) => onChange({ ...input, professionCode: e.target.value || null })} helperText={t('costs.anyHelp')}>
                <MenuItem value="">{t('costs.any')}</MenuItem>
                {options?.professions.map((o) => (
                  <MenuItem key={o.code} value={o.code}>
                    {ar ? o.nameAr : o.nameEn}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label={t('costs.col.nationality')} value={input.nationalityCode ?? ''} onChange={(e) => onChange({ ...input, nationalityCode: e.target.value || null })} helperText={t('costs.anyHelp')}>
                <MenuItem value="">{t('costs.any')}</MenuItem>
                {options?.nationalities.map((o) => (
                  <MenuItem key={o.code} value={o.code}>
                    {ar ? o.nameAr : o.nameEn}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
          <TextField select label={t('costs.col.method')} value={input.method} onChange={(e) => onChange({ ...input, method: e.target.value as CostMethod })} helperText={t(`costs.methodHelp.${input.method}`)}>
            <MenuItem value="MonthlyFixed">{t('costs.method.MonthlyFixed')}</MenuItem>
            <MenuItem value="ByWorkingDays">{t('costs.method.ByWorkingDays')}</MenuItem>
          </TextField>
          <DateField label={t('costs.col.from')} value={input.effectiveFrom} onChange={(e) => onChange({ ...input, effectiveFrom: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} required />
          <TextField label={t('costs.notes')} value={input.notes ?? ''} onChange={(e) => onChange({ ...input, notes: e.target.value || null })} sx={{ gridColumn: '1 / -1' }} slotProps={{ htmlInput: { maxLength: 300 } }} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={onSave} disabled={busy || !input.supplier || !(input.monthlyCost > 0) || !input.effectiveFrom}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
