import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
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
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { historyIssueCodes, workforceApi, type HistoryIssueList } from '../../api/workforce';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PageHeader } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';

/**
 * The period ledger's exceptions report: what does not add up in the workers' history in the old system (two
 * movements on one day, uncovered days, a status the history does not explain…), for operations to review.
 */
export function HistoryIssuesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { date } = useCommercialFormat();
  const [params, setParams] = useSearchParams();
  const code = params.get('code') ?? '';
  const search = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1');
  const [text, setText] = useState(search);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState<HistoryIssueList | null>(null);
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
    workforceApi
      .historyIssues({ code, search, page, pageSize })
      .then((value) => !cancelled && (setData(value), setError(null)))
      .catch((failure: unknown) => !cancelled && setError(errorKey(failure)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [code, search, page, pageSize]);

  const all = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <Box>
      <PageHeader title={t('workforce.history.title')} subtitle={t('workforce.history.intro')} />
      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
        {t('workforce.history.how')}
        {data?.builtAt && (
          <Box component="span" sx={{ display: 'block', mt: 0.5, fontSize: 12.5 }}>
            {t('workforce.history.builtAt', { at: new Date(data.builtAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }), workers: data.workers })}
          </Box>
        )}
      </Alert>
      <ErrorMessage messageKey={error} />

      {/* The kinds of issues as clickable chips with counts. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 1.25, mb: 2 }}>
        {['', ...historyIssueCodes].map((c) => {
          const active = code === c;
          const count = c ? data?.counts[c] ?? 0 : all;
          return (
            <ButtonBase
              key={c || 'all'}
              onClick={() => update({ code: c || null })}
              sx={{
                display: 'block',
                textAlign: 'start',
                p: 1.5,
                borderRadius: `${tokens.radius}px`,
                bgcolor: active ? tokens.navy700 : '#fff',
                color: active ? '#fff' : tokens.navy800,
                boxShadow: tokens.shadowSm,
              }}
            >
              <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{count.toLocaleString('en-US')}</Typography>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, opacity: 0.9 }}>{c ? t(`workforce.history.codes.${c}`) : t('workforce.history.all')}</Typography>
            </ButtonBase>
          );
        })}
      </Box>
      {code && (
        <Alert severity="warning" icon={<ErrorOutlineOutlinedIcon />} sx={{ mb: 2 }}>
          {t(`workforce.history.explain.${code}`)}
        </Alert>
      )}

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <Box component="form" sx={{ display: 'flex', gap: 1, flex: 1, maxWidth: 560 }} onSubmit={(e) => (e.preventDefault(), update({ q: text.trim() || null }))}>
            <TextField
              size="small"
              fullWidth
              placeholder={t('workforce.history.search')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <Button type="submit" variant="contained">
              {t('workforce.searchButton')}
            </Button>
            {(search || code) && <Button onClick={() => (setText(''), setParams(new URLSearchParams(), { replace: true }))}>{t('workforce.reset')}</Button>}
          </Box>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }}>
            {t('workforce.history.count', { count: data?.total ?? 0 })}
          </Box>
        </Stack>
        {busy && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('workforce.col.name')}</TableCell>
                <TableCell>{t('workforce.history.kind')}</TableCell>
                <TableCell>{t('workforce.history.on')}</TableCell>
                <TableCell>{t('workforce.history.details')}</TableCell>
                <TableCell>{t('commercial.col.project')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((i) => (
                <TableRow key={i.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/workforce/workers/${i.workerId}?tab=periods`)}>
                  <TableCell sx={{ minWidth: 180 }}>
                    <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                      {i.name}
                    </Typography>
                    <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                      {i.workerNo}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Badge tone="warning">{t(`workforce.history.codes.${i.code}`)}</Badge>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(i.on)}</TableCell>
                  <TableCell sx={{ fontSize: 13, minWidth: 320 }}>{i.details}</TableCell>
                  <TableCell>{i.projectName ?? '—'}</TableCell>
                </TableRow>
              ))}
              {data && data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {t('workforce.history.empty')}
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
