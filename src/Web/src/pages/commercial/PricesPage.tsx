import AddIcon from '@mui/icons-material/Add';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { Box, Button, InputAdornment, LinearProgress, Stack, TablePagination, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { commercialApi, type PackageList, type PackageRow, type SuggestionList, type WorkerPriceList } from '../../api/commercial';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { PageHeader, PillTabs } from '../../components/ui';
import { draftFromSuggestion, PackageDialog, PackagesTable, SuggestionsTable, WorkerPricesTable, type PackageDraft } from './pricing';

type Tab = 'packages' | 'suggestions' | 'workers';

/** Price packages: the user's packages, suggestions from the old system's prices, and the workers' prices against them. */
export function PricesPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const canManage = can('commercial.prices.manage', true);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'packages';
  const status = params.get('status') ?? '';
  const search = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1');
  const [text, setText] = useState(search);
  const [pageSize, setPageSize] = useState(50);
  const [packages, setPackages] = useState<PackageList | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionList | null>(null);
  const [workers, setWorkers] = useState<WorkerPriceList | null>(null);
  const [dialog, setDialog] = useState<{ package?: PackageRow; draft?: PackageDraft } | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!('page' in changes)) {
      next.delete('page');
    }
    setParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const q = { search, status, page, pageSize };
    // The packages list carries the cards' totals, so it is loaded on every tab.
    const load = Promise.all([
      commercialApi.prices(tab === 'packages' ? q : { page: 1, pageSize: 10 }).then((value) => !cancelled && setPackages(value)),
      tab === 'suggestions' ? commercialApi.suggestions(q).then((value) => !cancelled && setSuggestions(value)) : null,
      tab === 'workers' ? commercialApi.priceWorkers({ ...q, sort: 'difference' }).then((value) => !cancelled && setWorkers(value)) : null,
    ]);
    load
      .then(() => !cancelled && setError(null))
      .catch((failure: unknown) => !cancelled && setError(errorKey(failure)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [tab, search, status, page, pageSize, reload]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);
  const toggle = async (row: PackageRow) => {
    try {
      await commercialApi.setPackageActive(row.id, !row.isActive);
      refresh();
    } catch (failure) {
      setError(errorKey(failure));
    }
  };

  const totals = packages?.totals;
  const card = (key: string, cardTab: Tab, label: string, value: number | undefined, foot: string, icon: React.ReactNode, tone: string) => {
    const active = tab === cardTab && status === key;
    return (
      <KpiCard
        label={label}
        value={(value ?? 0).toLocaleString('en-US')}
        foot={active ? `✓ ${t('workforce.currentFilter')}` : foot}
        icon={icon}
        tone={tone}
        active={active}
        onClick={() => update(active ? { status: null } : { tab: cardTab === 'packages' ? null : cardTab, status: key || null })}
      />
    );
  };
  const total = tab === 'packages' ? packages?.total ?? 0 : tab === 'suggestions' ? suggestions?.total ?? 0 : workers?.total ?? 0;

  return (
    <Box>
      <PageHeader
        title={t('commercial.prices.title')}
        subtitle={t('commercial.prices.intro')}
        actions={
          canManage ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({})}>
              {t('commercial.prices.new')}
            </Button>
          ) : undefined
        }
      />
      <ErrorMessage messageKey={error} />

      <KpiGrid count={5}>
        {card('current', 'packages', t('commercial.prices.cards.packages'), totals?.packages, t('commercial.prices.cards.packagesFoot'), <SellOutlinedIcon />, tokens.navy700)}
        {card('package', 'workers', t('commercial.prices.cards.onPackage'), totals?.onPackage, t('commercial.prices.cards.onPackageFoot'), <TaskAltOutlinedIcon />, '#1f9d55')}
        {card('special', 'workers', t('commercial.prices.cards.special'), totals?.special, t('commercial.prices.cards.specialFoot'), <PriceChangeOutlinedIcon />, '#d9822b')}
        {card('noPackage', 'workers', t('commercial.prices.cards.noPackage'), totals?.withoutPackage, t('commercial.prices.cards.noPackageFoot'), <LinkOffOutlinedIcon />, '#1b6a92')}
        {card('missing', 'workers', t('commercial.prices.cards.missing'), totals?.withoutPrice, t('commercial.prices.cards.missingFoot'), <ErrorOutlineOutlinedIcon />, '#c0392b')}
      </KpiGrid>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <PillTabs
          value={tab}
          onChange={(value) => update({ tab: value === 'packages' ? null : value, status: null })}
          options={[
            { value: 'packages', label: t('commercial.prices.tabs.packages') },
            { value: 'suggestions', label: t('commercial.prices.tabs.suggestions') },
            { value: 'workers', label: t('commercial.prices.tabs.workers') },
          ]}
        />
        {tab === 'suggestions' && <Typography sx={{ fontSize: 13, color: tokens.gray600, mb: 1.5 }}>{t('commercial.prices.suggestionsIntro')}</Typography>}
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <Box component="form" sx={{ display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 520 }} onSubmit={(e) => (e.preventDefault(), update({ q: text.trim() || null }))}>
            <TextField
              size="small"
              fullWidth
              placeholder={t(tab === 'workers' ? 'commercial.prices.searchWorkers' : 'commercial.prices.search')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <Button type="submit" variant="contained">
              {t('workforce.searchButton')}
            </Button>
            {(search || status) && <Button onClick={() => (setText(''), update({ q: null, status: null }))}>{t('workforce.reset')}</Button>}
          </Box>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }}>
            {t(`commercial.prices.count.${tab}`, { count: total })}
          </Box>
        </Stack>
        {busy && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        {tab === 'packages' && packages && (
          <PackagesTable rows={packages.items} showProject onEdit={canManage ? (row) => setDialog({ package: row }) : undefined} onToggle={canManage ? (row) => void toggle(row) : undefined} />
        )}
        {tab === 'suggestions' && suggestions && <SuggestionsTable rows={suggestions.items} showProject onCreate={canManage ? (row) => setDialog({ draft: draftFromSuggestion(row) }) : undefined} />}
        {tab === 'workers' && workers && <WorkerPricesTable rows={workers.items} showProject />}
        {total === 0 && !busy && (
          <Typography sx={{ py: 5, textAlign: 'center', color: tokens.gray500 }}>{t(tab === 'packages' && !search && !status ? 'commercial.prices.noPackagesYet' : 'commercial.prices.empty')}</Typography>
        )}
        <TablePagination
          component="div"
          count={total}
          page={Math.max(0, page - 1)}
          onPageChange={(_, p) => update({ page: String(p + 1) })}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[25, 50, 100]}
          onRowsPerPageChange={(e) => (setPageSize(Number(e.target.value)), update({ page: null }))}
          labelRowsPerPage={t('workforce.perPage')}
          labelDisplayedRows={({ from, to, count }) => t('workforce.rows', { from, to, count })}
        />
      </Box>

      {dialog && <PackageDialog package={dialog.package} draft={dialog.draft} onClose={() => setDialog(null)} onSaved={() => (setDialog(null), refresh())} />}
    </Box>
  );
}
