import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
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
import { commercialApi, type CustomerList } from '../../api/commercial';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { Badge, Initials, PageHeader } from '../../components/ui';
import { useCommercialFormat } from './ProjectsPage';

/** Customers: cards, search (name, number, CR, VAT, mobile) and their projects and workers. */
export function CustomersPage() {
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
  const [data, setData] = useState<CustomerList | null>(null);
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
      .customers({ search, status, sort, desc, page, pageSize })
      .then((value) => !cancelled && (setData(value), setError(null)))
      .catch((failure: unknown) => !cancelled && setError(errorKey(failure)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [search, status, sort, desc, page, pageSize]);

  const sortBy = (key: string) => (sort === key ? setDesc((d) => !d) : (setSort(key), setDesc(key !== 'name')));
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
      onClick={key ? () => update({ status: status === key ? null : key }) : undefined}
    />
  );

  return (
    <Box>
      <PageHeader title={t('commercial.customers.title')} subtitle={t('commercial.customers.intro')} />
      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
        {t('commercial.readOnly')}
      </Alert>
      <ErrorMessage messageKey={error} />

      <KpiGrid count={4}>
        {card('', t('commercial.customers.cards.all'), data?.total, t('commercial.customers.cards.allFoot'), <BusinessOutlinedIcon />, tokens.navy700)}
        {card('active', t('commercial.customers.cards.active'), data?.active, t('commercial.customers.cards.activeFoot'), <VerifiedOutlinedIcon />, '#1f9d55')}
        {card('withProjects', t('commercial.customers.cards.withProjects'), data?.withProjects, t('commercial.customers.cards.withProjectsFoot'), <AccountTreeOutlinedIcon />, '#1b6a92')}
        {card('withWorkers', t('commercial.customers.cards.workers'), data?.workers, t('commercial.customers.cards.workersFoot'), <EngineeringOutlinedIcon />, '#0e7c86')}
      </KpiGrid>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <Box component="form" sx={{ display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 520 }} onSubmit={(e) => (e.preventDefault(), update({ q: text.trim() || null }))}>
            <TextField
              size="small"
              fullWidth
              placeholder={t('commercial.customers.search')}
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
            {t('commercial.customers.count', { count: data?.total ?? 0 })}
          </Box>
        </Stack>
        {busy && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{head('name', t('commercial.col.customer'))}</TableCell>
                <TableCell>{t('commercial.field.cr')}</TableCell>
                <TableCell>{t('commercial.field.vat')}</TableCell>
                <TableCell>{t('commercial.field.mobile')}</TableCell>
                <TableCell>{t('commercial.field.city')}</TableCell>
                <TableCell align="center">{t('commercial.col.projects')}</TableCell>
                <TableCell align="center">{head('workers', t('commercial.col.workers'))}</TableCell>
                <TableCell>{head('created', t('commercial.col.created'))}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((c) => (
                <TableRow key={c.id} hover sx={{ cursor: 'pointer', opacity: c.isActive ? 1 : 0.6 }} onClick={() => navigate(`/commercial/customers/${c.id}`)}>
                  <TableCell sx={{ minWidth: 240 }}>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                      <Initials name={c.name} size={30} />
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{c.name}</Typography>
                        {c.customerNo && (
                          <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                            {c.customerNo}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell dir="ltr">{c.commercialRegistration ?? '—'}</TableCell>
                  <TableCell dir="ltr">{c.vatNumber ?? '—'}</TableCell>
                  <TableCell dir="ltr">{c.mobile ?? '—'}</TableCell>
                  <TableCell>{c.city ?? '—'}</TableCell>
                  <TableCell align="center">{c.projects > 0 ? `${c.activeProjects} / ${c.projects}` : '—'}</TableCell>
                  <TableCell align="center">{c.workers > 0 ? <Badge tone="info">{c.workers}</Badge> : '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(c.createdAt)}</TableCell>
                </TableRow>
              ))}
              {data && data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {t('commercial.customers.empty')}
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
