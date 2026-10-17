import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import SyncIcon from '@mui/icons-material/Sync';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import LinkIcon from '@mui/icons-material/Link';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { crmSyncApi, type ImportReport, type ListImportSummary, type MappedItem, type Mapping, type MappingReport, type ReferenceList, type RunStatus, type SyncMode, type SyncStatus } from '../../api/crmSync';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, EmptyState, PageHeader, Panel, PillTabs, StatusDot, type Tone } from '../../components/ui';

const runTone: Record<RunStatus, Tone> = { Queued: 'neutral', Running: 'info', Succeeded: 'success', PartlyFailed: 'warning', Failed: 'danger' };
const ruleTone: Record<string, Tone> = { Name: 'success', Duplicate: 'neutral', Spelling: 'info', EnglishName: 'info', Alias: 'primary', Conflict: 'warning', Unmapped: 'danger', Manual: 'primary' };

/** What is being merged or linked by hand. */
type Merge = { kind: 'item'; item: MappedItem } | { kind: 'record'; record: Mapping };
const pageSize = 100;

/** Copying the old CRM into staging, and turning its countries and professions into the company's lists without duplicates. */
export function CrmSyncPage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const canRun = can('crm_sync.run', true);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmFull, setConfirmFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [list, setList] = useState<ReferenceList>('nationalities');
  const [refresh, setRefresh] = useState(0);
  const active = status?.runs.some((r) => r.status === 'Queued' || r.status === 'Running') ?? false;

  const load = useCallback(async () => {
    try {
      setStatus(await crmSyncApi.status());
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // While a run is queued or running, follow it.
  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  const run = async (mode: SyncMode) => {
    setConfirmFull(false);
    setError(null);
    try {
      await crmSyncApi.run(mode);
      await load();
    } catch (failure) {
      setError(errorKey(failure));
    }
  };

  const importLists = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await crmSyncApi.importReferences());
      setRefresh((r) => r + 1);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const when = useDate();
  const day = (value: string) => new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
  const synced = (status?.entities.find((e) => e.entity === 'new_country')?.records ?? 0) > 0;

  return (
    <Box>
      <PageHeader title={t('crmSync.title')} subtitle={t('crmSync.intro')} />
      <ErrorMessage messageKey={error} />
      {status && !status.configured && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('crmSync.notConfigured')}
        </Alert>
      )}
      {status?.configured && !status.isThisCompany && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('crmSync.otherCompany', { company: status.company })}
        </Alert>
      )}

      <Panel padding={2.5} sx={{ mb: `${tokens.gap}px` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, color: tokens.navy800 }}>{t('crmSync.copyTitle')}</Typography>
            <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>
              {t('crmSync.readOnly')} {status && (status.intervalMinutes > 0 ? t('crmSync.every', { minutes: status.intervalMinutes }) : t('crmSync.manualOnly'))}
            </Typography>
          </Box>
          {canRun && status?.configured && status.isThisCompany && (
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button variant="contained" startIcon={<SyncIcon />} disabled={active} onClick={() => void run('Incremental')}>
                {t('crmSync.runIncremental')}
              </Button>
              <Button variant="outlined" startIcon={<CloudSyncOutlinedIcon />} disabled={active} onClick={() => setConfirmFull(true)}>
                {t('crmSync.runFull')}
              </Button>
            </Stack>
          )}
        </Stack>
        {active && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('crmSync.entity')}</TableCell>
                <TableCell align="center">{t('crmSync.records')}</TableCell>
                <TableCell align="center">{t('crmSync.deleted')}</TableCell>
                <TableCell>{t('crmSync.lastChange')}</TableCell>
                <TableCell>{t('crmSync.lastSuccess')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {status?.entities.map((e) => (
                <TableRow key={e.entity}>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{t(`crmSync.entities.${e.entity}`, { defaultValue: e.nameAr })}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }} dir="ltr">
                      {e.entity}
                    </Typography>
                    {e.createdFrom && <Badge tone="warning">{t('crmSync.createdFrom', { date: day(e.createdFrom) })}</Badge>}
                  </TableCell>
                  <TableCell align="center">{e.records.toLocaleString('en-US')}</TableCell>
                  <TableCell align="center">{e.deleted || '—'}</TableCell>
                  <TableCell>{e.lastChangeCopied ? when(e.lastChangeCopied) : '—'}</TableCell>
                  <TableCell>{e.lastSucceededAt ? when(e.lastSucceededAt) : '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'normal', maxWidth: 280 }}>
                    {e.lastError && (!e.lastSucceededAt || (e.lastFailedAt ?? '') > e.lastSucceededAt) ? (
                      <StatusDot tone="danger" label={e.lastError} />
                    ) : e.lastSucceededAt ? (
                      <StatusDot tone="success" label={t('crmSync.ok')} />
                    ) : (
                      <StatusDot tone="neutral" label={t('crmSync.never')} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {status && status.runs.length > 0 && (
          <Box sx={{ mt: 2.5 }}>
            <Typography sx={{ fontWeight: 700, color: tokens.navy800, mb: 1 }}>{t('crmSync.runs')}</Typography>
            <Stack spacing={0.75}>
              {status.runs.slice(0, 5).map((r) => {
                const totals = r.results.reduce((a, x) => ({ read: a.read + x.read, inserted: a.inserted + x.inserted, updated: a.updated + x.updated, deleted: a.deleted + x.deleted + (x.excluded ?? 0) }), { read: 0, inserted: 0, updated: 0, deleted: 0 });
                return (
                  <Stack key={r.id} direction="row" sx={{ gap: 1.25, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: tokens.gray600 }}>
                    <Badge tone={runTone[r.status]}>{t(`crmSync.status.${r.status}`)}</Badge>
                    <span>{t(`crmSync.mode.${r.mode}`)}</span>
                    <span>— {r.requestedBy === 'scheduled' ? t('crmSync.scheduled') : r.requestedBy}</span>
                    <span>— {when(r.requestedAt)}</span>
                    {r.finishedAt && <span>— {t('crmSync.totals', totals)}</span>}
                    {r.error && <span style={{ color: tokens.danger }}>— {r.error}</span>}
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        )}
      </Panel>

      <Panel padding={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, color: tokens.navy800 }}>{t('crmSync.referencesTitle')}</Typography>
            <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>{t('crmSync.referencesIntro')}</Typography>
          </Box>
          {canRun && status?.isThisCompany && (
            <Button variant="contained" startIcon={<PlaylistAddCheckIcon />} disabled={busy || active || !synced} onClick={() => void importLists()}>
              {busy ? t('common.loading') : t('crmSync.import')}
            </Button>
          )}
        </Stack>
        {!synced && <Typography sx={{ fontSize: 13, color: tokens.gray500, mb: 2 }}>{t('crmSync.syncFirst')}</Typography>}
        {report && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 2.5 }}>
            <Summary title={t('crmSync.lists.nationalities')} summary={report.nationalities} />
            <Summary title={t('crmSync.lists.professions')} summary={report.professions} />
          </Box>
        )}
        <PillTabs
          value={list}
          onChange={setList}
          options={[
            { value: 'nationalities', label: t('crmSync.lists.nationalities') },
            { value: 'professions', label: t('crmSync.lists.professions') },
          ]}
        />
        <MappingTable list={list} refresh={refresh} canMerge={canRun && status?.isThisCompany === true} />
      </Panel>

      <Dialog open={confirmFull} onClose={() => setConfirmFull(false)}>
        <DialogTitle>{t('crmSync.runFull')}</DialogTitle>
        <DialogContent>
          <Typography>{t('crmSync.fullHint')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmFull(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => void run('Full')}>
            {t('crmSync.runFull')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Summary({ title, summary }: { title: string; summary: ListImportSummary }) {
  const { t } = useTranslation();
  const cells: [string, number, Tone][] = [
    [t('crmSync.summary.crmRecords'), summary.crmRecords, 'neutral'],
    [t('crmSync.summary.items'), summary.items, 'primary'],
    [t('crmSync.summary.merged'), summary.merged, 'info'],
    [t('crmSync.summary.created'), summary.created, 'success'],
    [t('crmSync.summary.unmapped'), summary.unmapped, summary.unmapped ? 'danger' : 'neutral'],
    [t('crmSync.summary.needsReview'), summary.needsReview, summary.needsReview ? 'warning' : 'neutral'],
  ];
  return (
    <Box sx={{ p: 1.75, borderRadius: '14px', border: `1px solid ${tokens.border}`, bgcolor: tokens.gray50 }}>
      <Typography sx={{ fontWeight: 800, color: tokens.navy800, mb: 1 }}>{title}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        {cells.map(([label, value, tone]) => (
          <Box key={label} sx={{ p: 1, borderRadius: '10px', bgcolor: '#fff', border: `1px solid ${tokens.border}` }}>
            <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{label}</Typography>
            <Badge tone={tone}>{value.toLocaleString('en-US')}</Badge>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Each item with the CRM records merged into it, and the CRM records left unmapped. */
function MappingTable({ list, refresh, canMerge }: { list: ReferenceList; refresh: number; canMerge: boolean }) {
  const { t, i18n } = useTranslation();
  const [report, setReport] = useState<MappingReport | null>(null);
  const [merge, setMerge] = useState<Merge | null>(null);
  const [reloads, setReloads] = useState(0);
  const [search, setSearch] = useState('');
  const [mergedOnly, setMergedOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(pageSize);
  const ar = i18n.language === 'ar';

  // A new list starts empty; a reload of the same list keeps the table (and the page's scroll) until it arrives.
  useEffect(() => {
    setReport(null);
    setLimit(pageSize);
  }, [list]);

  useEffect(() => {
    crmSyncApi.report(list).then(setReport).catch(() => setReport({ listCode: list, items: [], unmapped: [] }));
  }, [list, refresh, reloads]);

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (report?.items ?? []).filter(
      (i) =>
        i.records.length > 0 &&
        (!mergedOnly || i.records.length > 1) &&
        (!query || i.code.toLowerCase().includes(query) || i.nameAr.includes(query) || i.nameEn.toLowerCase().includes(query) || i.records.some((r) => r.crmName.toLowerCase().includes(query))),
    );
  }, [report, search, mergedOnly]);

  if (!report) {
    return <LinearProgress />;
  }
  if (report.items.every((i) => i.records.length === 0) && report.unmapped.length === 0) {
    return <EmptyState text={t('crmSync.notImported')} />;
  }

  return (
    <Box>
      {report.unmapped.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, mb: 0.5 }}>{t('crmSync.unmappedTitle', { count: report.unmapped.length })}</Typography>
          <Box component="ul" sx={{ m: 0, paddingInlineStart: 2.5, fontSize: 13 }}>
            {report.unmapped.map((m) => (
              <li key={m.crmId}>
                «{m.crmName || '—'}»{m.crmCode ? ` (${m.crmCode})` : ''} — {t('crmSync.usedBy', { count: m.usage })}
                {canMerge && (
                  <Button size="small" startIcon={<LinkIcon />} onClick={() => setMerge({ kind: 'record', record: m })} sx={{ marginInlineStart: 1, py: 0 }}>
                    {t('crmSync.link')}
                  </Button>
                )}
              </li>
            ))}
          </Box>
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, alignItems: { sm: 'center' }, mb: 1.5 }}>
        <TextField size="small" placeholder={t('crmSync.search')} value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 260 }} />
        <FormControlLabel control={<Switch size="small" checked={mergedOnly} onChange={(e) => setMergedOnly(e.target.checked)} />} label={t('crmSync.mergedOnly')} />
        <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('crmSync.itemCount', { count: items.length })}</Typography>
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 44 }} />
              <TableCell>{t('crmSync.code')}</TableCell>
              <TableCell>{t('crmSync.name')}</TableCell>
              <TableCell align="center">{t('crmSync.crmCopies')}</TableCell>
              <TableCell align="center">{t('crmSync.employees')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.slice(0, limit).map((item) => (
              <ItemRows
                key={item.code}
                item={item}
                ar={ar}
                open={open === item.code}
                onToggle={() => setOpen(open === item.code ? null : item.code)}
                onMerge={canMerge ? () => setMerge({ kind: 'item', item }) : undefined}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {items.length > limit && (
        <Box sx={{ textAlign: 'center', mt: 1.5 }}>
          <Button onClick={() => setLimit((l) => l + pageSize)}>{t('crmSync.showMore')}</Button>
        </Box>
      )}
      {merge && (
        <MergeDialog
          list={list}
          merge={merge}
          items={report.items}
          onClose={() => setMerge(null)}
          onDone={() => {
            setMerge(null);
            setOpen(null);
            setReloads((r) => r + 1);
          }}
        />
      )}
    </Box>
  );
}

/** Merge an item into another, or link an unmatched CRM record to an item; later imports keep the choice. */
function MergeDialog({ list, merge, items, onClose, onDone }: { list: ReferenceList; merge: Merge; items: MappedItem[]; onClose: () => void; onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [target, setTarget] = useState<MappedItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = items.filter((i) => merge.kind === 'record' || i.code !== merge.item.code);
  const label = (i: MappedItem) => `${ar ? i.nameAr : i.nameEn} — ${i.code}`;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await crmSyncApi.merge(list, target!.code, merge.kind === 'item' ? { fromCode: merge.item.code } : { crmId: merge.record.crmId });
      onDone();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{merge.kind === 'item' ? t('crmSync.mergeTitle') : t('crmSync.linkTitle')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Typography sx={{ mb: 2, color: tokens.gray700 }}>
          {merge.kind === 'item'
            ? t('crmSync.mergeHint', { name: ar ? merge.item.nameAr : merge.item.nameEn, count: merge.item.usage })
            : t('crmSync.linkHint', { name: merge.record.crmName, count: merge.record.usage })}
        </Typography>
        <Autocomplete
          options={options}
          value={target}
          onChange={(_, value) => setTarget(value)}
          getOptionLabel={label}
          isOptionEqualToValue={(a, b) => a.code === b.code}
          renderInput={(params) => <TextField {...params} label={t('crmSync.target')} autoFocus />}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || !target}>
          {busy ? t('common.loading') : merge.kind === 'item' ? t('crmSync.merge') : t('crmSync.link')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ItemRows({ item, ar, open, onToggle, onMerge }: { item: MappedItem; ar: boolean; open: boolean; onToggle: () => void; onMerge?: () => void }) {
  const { t } = useTranslation();
  const merged = item.records.length > 1;
  return (
    <Fragment>
      <TableRow hover sx={{ cursor: 'pointer' }} onClick={onToggle}>
        <TableCell>
          <IconButton size="small" aria-label={open ? t('process.collapse') : t('process.expand')}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell dir="ltr" sx={{ fontFamily: 'monospace', fontSize: 12.5 }}>
          {item.code}
        </TableCell>
        <TableCell sx={{ whiteSpace: 'normal' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{ar ? item.nameAr : item.nameEn}</Typography>
          <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{ar ? item.nameEn : item.nameAr}</Typography>
        </TableCell>
        <TableCell align="center">{merged ? <Badge tone="info">{item.records.length}</Badge> : 1}</TableCell>
        <TableCell align="center">{item.usage || '—'}</TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={5} sx={{ bgcolor: tokens.gray50 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.navy700 }}>{t('crmSync.crmRecords')}</Typography>
              {onMerge && (
                <Button size="small" startIcon={<CallMergeIcon />} onClick={onMerge}>
                  {t('crmSync.mergeInto')}
                </Button>
              )}
            </Stack>
            <Stack spacing={0.5}>
              {item.records.map((r: Mapping) => (
                <Stack key={r.crmId} direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
                  <Badge tone={ruleTone[r.rule] ?? 'neutral'}>{t(`crmSync.rule.${r.rule}`)}</Badge>
                  <span>«{r.crmName}»</span>
                  {r.crmCode && (
                    <Box component="span" dir="ltr" sx={{ color: tokens.gray500 }}>
                      ({r.crmCode})
                    </Box>
                  )}
                  <span style={{ color: tokens.gray500 }}>— {t('crmSync.usedBy', { count: r.usage })}</span>
                </Stack>
              ))}
            </Stack>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

function useDate() {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  return (value: string) =>
    new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));
}
