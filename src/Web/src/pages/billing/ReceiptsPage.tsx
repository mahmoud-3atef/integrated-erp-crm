import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import Add from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { receivablesApi, type ReceiptList } from '../../api/billing';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { PageHeader } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from '../operations/delivery';
import { monthEnd, monthStart, ReceiptStatusBadge } from './receipts';

type Filter = '' | 'Open' | 'InReview' | 'Approved' | 'Unallocated';

/** The month's receipt vouchers: drafts, in review, approved, and the credit not yet allocated to invoices. */
export function ReceiptsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { ar, date } = useCommercialFormat();
  const [params, setParams] = useSearchParams();
  const month = params.get('month') ?? monthStart(new Date());
  const [filter, setFilter] = useState<Filter>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<ReceiptList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await receivablesApi.receipts({ from: month, to: monthEnd(month), status: filter, search: query }));
      setError(null);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [month, filter, query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const shift = (by: number) => {
    const d = new Date(`${month}T00:00:00`);
    d.setMonth(d.getMonth() + by);
    setParams({ month: monthStart(d) }, { replace: true });
  };
  const monthName = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${month}T00:00:00`));
  const toggle = (value: Filter) => setFilter(filter === value ? '' : value);
  const totals = data?.totals;

  return (
    <Box>
      <PageHeader
        title={t('receipts.title')}
        subtitle={t('receipts.intro')}
        actions={
          can('billing.receipts.manage', true) ? (
            <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/billing/receipts/new')}>
              {t('receipts.new')}
            </Button>
          ) : undefined
        }
      />

      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => shift(ar ? 1 : -1)} sx={{ bgcolor: '#fff', boxShadow: tokens.shadowXs }}>
          <ChevronRightIcon />
        </IconButton>
        <Box sx={{ minWidth: 220, textAlign: 'center', px: 3, py: 1, borderRadius: 999, bgcolor: '#fff', boxShadow: tokens.shadowSm }}>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: tokens.navy800 }}>{monthName}</Typography>
        </Box>
        <IconButton onClick={() => shift(ar ? -1 : 1)} sx={{ bgcolor: '#fff', boxShadow: tokens.shadowXs }}>
          <ChevronLeftIcon />
        </IconButton>
      </Stack>
      <ErrorMessage messageKey={error} />

      <KpiGrid count={4}>
        <KpiCard active={filter === 'Open'} onClick={() => toggle('Open')} label={t('receipts.cards.drafts')} value={String(totals?.drafts ?? 0)} foot={t('receipts.cards.draftsFoot')} icon={<EditNoteOutlinedIcon />} tone="#6b7a90" />
        <KpiCard active={filter === 'InReview'} onClick={() => toggle('InReview')} label={t('receipts.cards.inReview')} value={String(totals?.inReview ?? 0)} foot={t('receipts.cards.inReviewFoot')} icon={<HourglassBottomOutlinedIcon />} tone="#d9822b" />
        <KpiCard active={filter === 'Approved'} onClick={() => toggle('Approved')} label={t('receipts.cards.approved')} value={sar(totals?.approvedAmount ?? 0)} foot={t('receipts.cards.approvedFoot', { count: totals?.approved ?? 0 })} icon={<PaymentsOutlinedIcon />} tone="#1f9d55" />
        <KpiCard active={filter === 'Unallocated'} onClick={() => toggle('Unallocated')} label={t('receipts.cards.unallocated')} value={sar(totals?.unallocated ?? 0)} foot={t('receipts.cards.unallocatedFoot')} icon={<AccountBalanceWalletOutlinedIcon />} tone="#2b7bd9" />
      </KpiGrid>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <TextField
          size="small"
          sx={{ minWidth: 300, mb: 1.5 }}
          placeholder={t('receipts.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        {!data && !error && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('receipts.col.number')}</TableCell>
                <TableCell>{t('commercial.col.project')}</TableCell>
                <TableCell>{t('receipts.col.date')}</TableCell>
                <TableCell>{t('receipts.col.method')}</TableCell>
                <TableCell align="center">{t('receipts.col.amount')}</TableCell>
                <TableCell align="center">{t('receipts.col.unallocated')}</TableCell>
                <TableCell>{t('receipts.col.status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.rows.map((r) => (
                <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/billing/receipts/${r.id}`)}>
                  <TableCell dir="ltr" sx={{ fontWeight: 800, color: r.receiptNo ? tokens.navy800 : tokens.gray500, textAlign: 'start', whiteSpace: 'nowrap' }}>
                    {r.receiptNo ?? t('receipts.noNumber')}
                  </TableCell>
                  <TableCell sx={{ minWidth: 220 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{r.projectName}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{r.customerName ?? '—'}</Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(r.receiptDate)}</TableCell>
                  <TableCell>
                    {t(`receipts.method.${r.method}`)}
                    {r.bankAccountName && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{r.bankAccountName}</Typography>}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                    {sar(r.amount)}
                  </TableCell>
                  <TableCell align="center" sx={{ color: r.amount - r.allocated > 0 ? '#2b7bd9' : tokens.gray500 }}>
                    {r.amount - r.allocated > 0 ? sar(r.amount - r.allocated) : '—'}
                  </TableCell>
                  <TableCell>
                    <ReceiptStatusBadge status={r.status} />
                  </TableCell>
                </TableRow>
              ))}
              {data && data.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {t('receipts.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}
