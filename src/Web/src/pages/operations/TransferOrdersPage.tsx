import AddIcon from '@mui/icons-material/Add';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import {
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
import { transfersApi, type TransferList } from '../../api/operations';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { Badge, Initials, PageHeader } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from './delivery';
import { TransferStatusBadge } from './transfers';

/** Transfer orders between projects: search, cards that filter, and the orders. */
export function TransferOrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const search = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1');
  const [text, setText] = useState(search);
  const [sort, setSort] = useState('created');
  const [desc, setDesc] = useState(true);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState<TransferList | null>(null);
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
    transfersApi
      .list({ search, status, sort, desc, page, pageSize })
      .then((value) => !cancelled && (setData(value), setError(null)))
      .catch((failure: unknown) => !cancelled && setError(errorKey(failure)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [search, status, sort, desc, page, pageSize]);

  const sortBy = (key: string) => (sort === key ? setDesc((d) => !d) : (setSort(key), setDesc(true)));
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
      onClick={() => update({ status: status === key ? null : key || null })}
    />
  );

  return (
    <Box>
      <PageHeader
        title={t('operations.transfer.title')}
        subtitle={t('operations.transfer.intro')}
        actions={
          can('operations.transfer.create', true) ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/operations/transfer-orders/new')}>
              {t('operations.transfer.new')}
            </Button>
          ) : undefined
        }
      />
      <ErrorMessage messageKey={error} />

      <KpiGrid count={5}>
        {card('', t('operations.transfer.cards.all'), data?.totals.all, t('operations.transfer.cards.allFoot'), <DescriptionOutlinedIcon />, tokens.navy700)}
        {card('preparing', t('operations.delivery.cards.preparing'), data?.totals.underPreparation, t('operations.delivery.cards.preparingFoot'), <EditNoteOutlinedIcon />, '#6b7a90')}
        {card('operations', t('operations.delivery.cards.operations'), data?.totals.withOperations, t('operations.delivery.cards.operationsFoot'), <HourglassBottomOutlinedIcon />, '#d9822b')}
        {card('transferred', t('operations.transfer.cards.transferred'), data?.totals.transferred, t('operations.transfer.cards.transferredFoot'), <TaskAltOutlinedIcon />, '#1f9d55')}
        {card('closed', t('operations.transfer.cards.closed'), data?.totals.closed, t('operations.transfer.cards.closedFoot'), <AssignmentTurnedInOutlinedIcon />, '#c0392b')}
      </KpiGrid>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <Box component="form" sx={{ display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 560 }} onSubmit={(e) => (e.preventDefault(), update({ q: text.trim() || null }))}>
            <TextField
              size="small"
              fullWidth
              placeholder={t('operations.transfer.search')}
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
            {t('operations.delivery.count', { count: data?.total ?? 0 })}
          </Box>
        </Stack>
        {busy && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{head('orderNo', t('operations.transfer.col.order'))}</TableCell>
                <TableCell>{t('operations.transfer.col.from')}</TableCell>
                <TableCell>{head('transferOn', t('operations.transfer.col.transferOn'))}</TableCell>
                <TableCell align="center">{head('workers', t('operations.delivery.col.workers'))}</TableCell>
                <TableCell align="center">{t('operations.delivery.monthlyTotal')}</TableCell>
                <TableCell>{t('operations.delivery.col.status')}</TableCell>
                <TableCell>{t('operations.delivery.createdBy')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((o) => (
                <TableRow key={o.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/operations/transfer-orders/${o.id}`)}>
                  <TableCell sx={{ minWidth: 240 }}>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                      <Initials name={o.projectName} size={30} />
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{o.projectName}</Typography>
                        <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                          {o.orderNo}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, maxWidth: 260 }}>{o.fromProjects ?? '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(o.transferOn)}</TableCell>
                  <TableCell align="center">
                    <Badge tone="info">{o.workers}</Badge>
                  </TableCell>
                  <TableCell align="center">{sar(o.totalPrice)}</TableCell>
                  <TableCell>
                    <TransferStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell>{o.createdByName}</TableCell>
                </TableRow>
              ))}
              {data && data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {t('operations.transfer.empty')}
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
