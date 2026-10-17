import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { Alert, Box, Button, InputAdornment, LinearProgress, Stack, TablePagination, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { commercialApi, type PackageList, type WorkerPriceList } from '../../api/commercial';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { PageHeader, PillTabs } from '../../components/ui';
import { PackagesTable, WorkerPricesTable } from './pricing';

type Tab = 'packages' | 'exceptions';

/** Price packages of all projects, and the workers at a special price or without one. */
export function PricesPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'packages';
  const status = params.get('status') ?? '';
  const search = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1');
  const [text, setText] = useState(search);
  const [pageSize, setPageSize] = useState(50);
  const [packages, setPackages] = useState<PackageList | null>(null);
  const [exceptions, setExceptions] = useState<WorkerPriceList | null>(null);
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
    const load =
      tab === 'packages'
        ? commercialApi.prices(q).then((value) => !cancelled && setPackages(value))
        : Promise.all([commercialApi.priceExceptions({ ...q, sort: 'difference' }), packages ? Promise.resolve(packages) : commercialApi.prices({ page: 1, pageSize: 10 })]).then(
            ([value, totals]) => !cancelled && (setExceptions(value), setPackages((current) => current ?? totals)),
          );
    load
      .then(() => !cancelled && setError(null))
      .catch((failure: unknown) => !cancelled && setError(errorKey(failure)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [tab, search, status, page, pageSize]);

  const totals = packages?.totals;
  // The packages card shows all packages; the special and missing cards filter the workers tab; on-package is a count only.
  const card = (key: string | null, cardTab: Tab, label: string, value: number | undefined, foot: string, icon: React.ReactNode, tone: string) => {
    const active = key !== null && tab === cardTab && status === key;
    return (
      <KpiCard
        label={label}
        value={(value ?? 0).toLocaleString('en-US')}
        foot={active ? `✓ ${t('workforce.currentFilter')}` : foot}
        icon={icon}
        tone={tone}
        active={active}
        onClick={key === null ? undefined : () => update(active ? { status: null } : { tab: cardTab === 'packages' ? null : cardTab, status: key || null })}
      />
    );
  };
  const total = tab === 'packages' ? packages?.total ?? 0 : exceptions?.total ?? 0;

  return (
    <Box>
      <PageHeader title={t('commercial.prices.title')} subtitle={t('commercial.prices.intro')} />
      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
        {t('commercial.prices.derived')}
      </Alert>
      <ErrorMessage messageKey={error} />

      <KpiGrid count={4}>
        {card('', 'packages', t('commercial.prices.cards.packages'), totals?.packages, t('commercial.prices.cards.packagesFoot', { count: totals?.projects ?? 0 }), <SellOutlinedIcon />, tokens.navy700)}
        {card(null, 'packages', t('commercial.prices.cards.onPackage'), totals?.onPackage, t('commercial.prices.cards.onPackageFoot'), <TaskAltOutlinedIcon />, '#1f9d55')}
        {card('special', 'exceptions', t('commercial.prices.cards.special'), totals?.special, t('commercial.prices.cards.specialFoot'), <PriceChangeOutlinedIcon />, '#d9822b')}
        {card('missing', 'exceptions', t('commercial.prices.cards.missing'), totals?.missing, t('commercial.prices.cards.missingFoot'), <ErrorOutlineOutlinedIcon />, '#c0392b')}
      </KpiGrid>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <PillTabs
          value={tab}
          onChange={(value) => update({ tab: value === 'packages' ? null : value, status: null })}
          options={[
            { value: 'packages', label: t('commercial.prices.tabs.packages') },
            { value: 'exceptions', label: t('commercial.prices.tabs.exceptions') },
          ]}
        />
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <Box component="form" sx={{ display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 520 }} onSubmit={(e) => (e.preventDefault(), update({ q: text.trim() || null }))}>
            <TextField
              size="small"
              fullWidth
              placeholder={t(tab === 'packages' ? 'commercial.prices.search' : 'commercial.prices.searchWorkers')}
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
            {t(tab === 'packages' ? 'commercial.prices.count' : 'commercial.prices.workersCount', { count: total })}
          </Box>
        </Stack>
        {busy && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        {tab === 'packages' && packages && <PackagesTable rows={packages.items} showProject />}
        {tab === 'exceptions' && exceptions && <WorkerPricesTable rows={exceptions.items} showProject />}
        {total === 0 && !busy && (
          <Typography sx={{ py: 5, textAlign: 'center', color: tokens.gray500 }}>{t('commercial.prices.empty')}</Typography>
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
    </Box>
  );
}
