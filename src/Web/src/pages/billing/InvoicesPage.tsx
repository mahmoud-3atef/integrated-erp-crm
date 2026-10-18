import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
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
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { invoiceApi, type InvoiceList } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { PageHeader, PillTabs } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from '../operations/delivery';
import { InvoiceKindBadge, InvoiceStatusBadge, signed } from './invoices';

const monthIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
type StatusFilter = '' | 'Open' | 'InReview' | 'Issued';

/** The month's customer invoices and notes (the month the billing cycle ends in), with their review and issue. */
export function InvoicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ar, date } = useCommercialFormat();
  const [params, setParams] = useSearchParams();
  const month = params.get('month') ?? monthIso(new Date());
  const status = (params.get('status') ?? '') as StatusFilter;
  const kind = params.get('kind') ?? '';
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<InvoiceList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const reload = useCallback(async () => {
    try {
      setData(await invoiceApi.list({ month, status, kind, search: query }));
      setError(null);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [month, status, kind, query]);

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
    set('month', monthIso(d));
  };
  const monthName = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${month}T00:00:00`));
  const totals = data?.totals;

  return (
    <Box>
      <PageHeader title={t('invoices.title')} subtitle={t('invoices.intro')} />

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

      <KpiGrid count={5}>
        <KpiCard label={t('invoices.cards.drafts')} value={String(totals?.drafts ?? 0)} foot={t('invoices.cards.draftsFoot')} icon={<EditNoteOutlinedIcon />} tone="#6b7a90" />
        <KpiCard label={t('invoices.cards.inReview')} value={String(totals?.inReview ?? 0)} foot={t('invoices.cards.inReviewFoot')} icon={<HourglassBottomOutlinedIcon />} tone="#d9822b" />
        <KpiCard label={t('invoices.cards.issued')} value={sar(totals?.issuedTotal ?? 0)} foot={t('invoices.cards.issuedFoot', { count: totals?.issued ?? 0 })} icon={<ReceiptLongOutlinedIcon />} tone="#1f9d55" />
        <KpiCard label={t('invoices.cards.credits')} value={sar(totals?.credits ?? 0)} foot={t('invoices.cards.creditsFoot')} icon={<RemoveCircleOutlineIcon />} tone={tokens.danger} />
        <KpiCard label={t('invoices.cards.debits')} value={sar(totals?.debits ?? 0)} foot={t('invoices.cards.debitsFoot')} icon={<AddCircleOutlineIcon />} tone="#2b7bd9" />
      </KpiGrid>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <PillTabs<StatusFilter>
              value={status}
              onChange={(v) => set('status', v)}
              options={[
                { value: '', label: t('invoices.filter.all') },
                { value: 'Open', label: t('invoices.filter.open') },
                { value: 'InReview', label: t('invoices.filter.inReview') },
                { value: 'Issued', label: t('invoices.filter.issued') },
              ]}
            />
          </Box>
          <TextField select size="small" sx={{ minWidth: 170 }} label={t('invoices.col.kind')} value={kind} onChange={(e) => set('kind', e.target.value)}>
            <MenuItem value="">{t('invoices.filter.allKinds')}</MenuItem>
            {(['Invoice', 'CreditNote', 'DebitNote'] as const).map((k) => (
              <MenuItem key={k} value={k}>
                {t(`invoices.kind.${k}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            sx={{ minWidth: 260 }}
            placeholder={t('invoices.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
        </Stack>
        {!data && !error && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('invoices.col.number')}</TableCell>
                <TableCell>{t('commercial.col.project')}</TableCell>
                <TableCell>{t('invoices.col.date')}</TableCell>
                <TableCell>{t('invoices.col.due')}</TableCell>
                <TableCell align="center">{t('invoices.col.amount')}</TableCell>
                <TableCell align="center">{t('invoices.col.total')}</TableCell>
                <TableCell>{t('invoices.col.status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.rows.map((r) => (
                <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/billing/invoices/${r.id}`)}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Stack spacing={0.4} sx={{ alignItems: 'flex-start' }}>
                      <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 800, color: r.invoiceNo ? tokens.navy800 : tokens.gray500 }}>
                        {r.invoiceNo ?? t('invoices.noNumber')}
                      </Typography>
                      <InvoiceKindBadge kind={r.kind} />
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ minWidth: 240 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{r.projectName}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                      {r.customerName}
                      {r.originalInvoiceNo && ` · ${t('invoices.onInvoice', { number: r.originalInvoiceNo })}`}
                      {r.timesheetNo && ` · ${r.timesheetNo}`}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(r.invoiceDate)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(r.dueDate)}</TableCell>
                  <TableCell align="center">{sar(signed(r.kind, r.amount))}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: r.kind === 'CreditNote' ? tokens.danger : tokens.navy800 }}>
                    {sar(signed(r.kind, r.total))}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={r.status} />
                  </TableCell>
                </TableRow>
              ))}
              {data && data.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {t('invoices.empty')}
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
