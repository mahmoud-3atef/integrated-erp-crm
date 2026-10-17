import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { commercialApi, type ContractStatus, type ProjectList, type ProjectRow } from '../../api/commercial';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { Badge, Initials, PageHeader, type Tone } from '../../components/ui';

export const contractStatusTone: Record<ContractStatus, Tone> = {
  Valid: 'success',
  WantsRenewal: 'info',
  NoRenewal: 'warning',
  Canceled: 'danger',
  Expired: 'neutral',
};

export function useCommercialFormat() {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  return {
    ar,
    date: (value: string | null) =>
      value ? new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—',
  };
}

/** How long is left on the contract: red once ended, amber within 60 days. */
export function DaysLeft({ days }: { days: number | null }) {
  const { t } = useTranslation();
  if (days === null) {
    return null;
  }
  const tone = days < 0 ? tokens.danger : days <= 60 ? tokens.warning : tokens.gray500;
  return (
    <Typography component="span" sx={{ fontSize: 11.5, color: tone, fontWeight: 600 }}>
      {days < 0 ? t('commercial.ended', { days: -days }) : t('commercial.daysLeft', { days })}
    </Typography>
  );
}

/** The contract period with how long is left (as the old page's "مدة العقد" column). */
export function ContractPeriod({ row }: { row: ProjectRow }) {
  const { date } = useCommercialFormat();
  if (!row.startsOn && !row.endsOn) {
    return <>—</>;
  }
  return (
    <Box sx={{ whiteSpace: 'nowrap' }}>
      <div>
        {date(row.startsOn)} ← {date(row.endsOn)}
      </div>
      <DaysLeft days={row.daysLeft} />
    </Box>
  );
}

/** Projects: the old page's cards (click to filter), search and columns. */
export function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { date } = useCommercialFormat();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const search = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1');
  const [text, setText] = useState(search);
  const [sort, setSort] = useState('created');
  const [desc, setDesc] = useState(true);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState<ProjectList | null>(null);
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
    commercialApi
      .projects({ search, status, sort, desc, page, pageSize })
      .then((value) => !cancelled && (setData(value), setError(null)))
      .catch((failure: unknown) => !cancelled && setError(errorKey(failure)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [search, status, sort, desc, page, pageSize]);

  const sortBy = (key: string) => (sort === key ? setDesc((d) => !d) : (setSort(key), setDesc(key === 'workers' || key === 'created')));
  const head = (key: string, label: string) => (
    <TableSortLabel active={sort === key} direction={desc ? 'desc' : 'asc'} onClick={() => sortBy(key)} sx={{ color: 'inherit !important', '& .MuiTableSortLabel-icon': { color: 'inherit !important' } }}>
      {label}
    </TableSortLabel>
  );
  const card = (key: string, label: string, value: number | undefined, foot: string, icon: React.ReactNode, tone: string) => (
    <KpiCard
      label={label}
      value={(value ?? 0).toLocaleString('en-US')}
      foot={status === key ? `✓ ${t('workforce.currentFilter')}` : foot}
      icon={icon}
      tone={tone}
      active={status === key}
      onClick={() => update({ status: status === key ? null : key })}
    />
  );

  return (
    <Box>
      <PageHeader title={t('commercial.projects.title')} subtitle={t('commercial.projects.intro')} />
      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
        {t('commercial.readOnly')}
      </Alert>
      <ErrorMessage messageKey={error} />

      <KpiGrid count={4}>
        {card('active', t('commercial.projects.cards.projects'), data?.totals.projects, t('commercial.projects.cards.projectsFoot'), <AccountTreeOutlinedIcon />, tokens.navy700)}
        {card('withWorkers', t('commercial.projects.cards.workers'), data?.totals.workers, t('commercial.projects.cards.workersFoot'), <EngineeringOutlinedIcon />, '#0e7c86')}
        {card('ending', t('commercial.projects.cards.ending'), data?.totals.endingSoon, t('commercial.projects.cards.endingFoot'), <EventBusyOutlinedIcon />, '#d9822b')}
        {card('noCustomer', t('commercial.projects.cards.noCustomer'), data?.totals.withoutCustomer, t('commercial.projects.cards.noCustomerFoot'), <LinkOffOutlinedIcon />, '#c0392b')}
      </KpiGrid>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <Box component="form" sx={{ display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 520 }} onSubmit={(e) => (e.preventDefault(), update({ q: text.trim() || null }))}>
            <TextField
              size="small"
              fullWidth
              placeholder={t('commercial.projects.search')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <Button type="submit" variant="contained">
              {t('workforce.searchButton')}
            </Button>
            {(search || status) && <Button onClick={() => (setText(''), setParams(new URLSearchParams(), { replace: true }))}>{t('workforce.reset')}</Button>}
          </Box>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }}>
            {t('commercial.projects.count', { count: data?.total ?? 0 })}
          </Box>
        </Stack>
        {busy && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{head('name', t('commercial.col.project'))}</TableCell>
                <TableCell>{t('commercial.col.customer')}</TableCell>
                <TableCell>{t('commercial.col.manager')}</TableCell>
                <TableCell align="center">{head('workers', t('commercial.col.workers'))}</TableCell>
                <TableCell>{t('commercial.col.contractType')}</TableCell>
                <TableCell>{head('ends', t('commercial.col.period'))}</TableCell>
                <TableCell>{head('created', t('commercial.col.created'))}</TableCell>
                <TableCell>{t('commercial.col.contractStatus')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((p) => (
                <TableRow key={p.id} hover sx={{ cursor: 'pointer', opacity: p.isActive ? 1 : 0.6 }} onClick={() => navigate(`/commercial/projects/${p.id}`)}>
                  <TableCell sx={{ minWidth: 240 }}>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                      <Initials name={p.name} size={30} />
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{p.name}</Typography>
                        <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                          {p.code}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>{p.customerName ?? <Badge tone="danger">{t('commercial.noCustomer')}</Badge>}</TableCell>
                  <TableCell>{p.manager ?? '—'}</TableCell>
                  <TableCell align="center">{p.workers > 0 ? <Badge tone="info">{p.workers}</Badge> : '—'}</TableCell>
                  <TableCell>{p.contractType ? t(`commercial.contractType.${p.contractType}`) : '—'}</TableCell>
                  <TableCell>
                    <ContractPeriod row={p} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(p.createdAt)}</TableCell>
                  <TableCell>{p.contractStatus ? <Badge tone={contractStatusTone[p.contractStatus]}>{t(`commercial.contractStatus.${p.contractStatus}`)}</Badge> : '—'}</TableCell>
                </TableRow>
              ))}
              {data && data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {t('commercial.projects.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
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
