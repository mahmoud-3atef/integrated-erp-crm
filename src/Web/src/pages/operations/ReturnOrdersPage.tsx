import AddIcon from '@mui/icons-material/Add';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  InputAdornment,
  LinearProgress,
  MenuItem,
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
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { returnsApi, type ReturnList } from '../../api/operations';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, Initials } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { ReturnStatusBadge, returnTone } from './returns';
import { ReturnOrderWizard } from './ReturnOrderWizard';
import { ListHero, rowEdge, StageLine, StatusStrip, StripItem, toneHead, useCurrentStages } from '../../components/ListLayout';
import { toneColors } from '../../app/theme';

/** Return orders, as the old "أوامر التسكين" page: search, cards that filter, and the orders. */
export function ReturnOrdersPage({ creating = false }: { creating?: boolean } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [wizard, setWizard] = useState(creating);
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const status = params.get('status') ?? '';
  const source = params.get('source') ?? '';
  const search = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1');
  const [text, setText] = useState(search);
  const [sort, setSort] = useState('created');
  const [desc, setDesc] = useState(true);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState<ReturnList | null>(null);
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
    returnsApi
      .list({ search, status, source, sort, desc, page, pageSize })
      .then((value) => !cancelled && (setData(value), setError(null)))
      .catch((failure: unknown) => !cancelled && setError(errorKey(failure)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [search, status, source, sort, desc, page, pageSize]);

  const sortBy = (key: string) => (sort === key ? setDesc((d) => !d) : (setSort(key), setDesc(true)));
  const head = (key: string, label: string) => (
    <TableSortLabel active={sort === key} direction={desc ? 'desc' : 'asc'} onClick={() => sortBy(key)} sx={{ color: 'inherit !important', '& .MuiTableSortLabel-icon': { color: 'inherit !important' } }}>
      {label}
    </TableSortLabel>
  );
  const card = (key: string, label: string, value: number | undefined, foot: string, icon: React.ReactNode, tone: string) => (
    <StripItem
      label={label}
      value={(value ?? 0).toLocaleString('en-US')}
      foot={status === key ? `✓ ${t('workforce.currentFilter')}` : foot}
      icon={icon}
      tone={tone}
      active={status === key}
      onClick={() => update({ status: status === key ? null : key || null })}
    />
  );

  const stages = useCurrentStages('operations.return_order', (data?.items ?? []).map((x) => x.id));

  return (
    <Box>
      <ListHero tone="return" icon={<KeyboardReturnOutlinedIcon />}
        title={t('operations.return.title')}
        subtitle={t('operations.return.intro')}
        actions={
          can('operations.return.create', true) ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setWizard(true)}>
              {t('operations.return.new')}
            </Button>
          ) : undefined
        }
      />
      <ErrorMessage messageKey={error} />

      <StatusStrip count={5}>
        {card('', t('operations.return.cards.all'), data?.totals.all, t('operations.return.cards.allFoot'), <KeyboardReturnOutlinedIcon />, tokens.navy700)}
        {card('preparing', t('operations.return.cards.preparing'), data?.totals.underPreparation, t('operations.return.cards.preparingFoot'), <EditNoteOutlinedIcon />, '#6b7a90')}
        {card('approval', t('operations.return.cards.approval'), data?.totals.inApproval, t('operations.return.cards.approvalFoot'), <HourglassBottomOutlinedIcon />, '#d9822b')}
        {card('completed', t('operations.return.cards.completed'), data?.totals.completed, t('operations.return.cards.completedFoot'), <HotelOutlinedIcon />, '#1f9d55')}
        {card('closed', t('operations.return.cards.closed'), data?.totals.closed, t('operations.return.cards.closedFoot'), <BlockOutlinedIcon />, '#c0392b')}
      </StatusStrip>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <Box component="form" sx={{ display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 560 }} onSubmit={(e) => (e.preventDefault(), update({ q: text.trim() || null }))}>
            <TextField
              size="small"
              fullWidth
              placeholder={t('operations.return.search')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <Button type="submit" variant="contained">
              {t('workforce.searchButton')}
            </Button>
            {(search || status || source) && <Button onClick={() => (setText(''), setParams(new URLSearchParams(), { replace: true }))}>{t('workforce.reset')}</Button>}
          </Box>
          <TextField select size="small" value={source || 'all'} onChange={(e) => update({ source: e.target.value === 'all' ? null : e.target.value })} sx={{ minWidth: 200 }}>
            <MenuItem value="all">{t('operations.delivery.source.all')}</MenuItem>
            <MenuItem value="system">{t('operations.delivery.source.system')}</MenuItem>
            <MenuItem value="crm">{t('operations.delivery.source.crm')}</MenuItem>
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }}>
            {t('operations.delivery.count', { count: data?.total ?? 0 })}
          </Box>
        </Stack>
        {busy && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead sx={toneHead('return')}>
              <TableRow>
                <TableCell>{head('name', t('operations.return.col.worker'))}</TableCell>
                <TableCell>{t('operations.return.col.project')}</TableCell>
                <TableCell>{t('operations.return.col.housing')}</TableCell>
                <TableCell>{t('operations.return.col.entry')}</TableCell>
                <TableCell>{t('operations.return.col.reason')}</TableCell>
                <TableCell>{head('arrivedOn', t('operations.return.col.arrivedOn'))}</TableCell>
                <TableCell>{t('operations.delivery.col.status')}</TableCell>
                <TableCell>{t('operations.return.col.createdBy')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((o) => (
                <TableRow key={o.id} hover sx={[{ cursor: 'pointer' }, rowEdge(toneColors[returnTone[o.status]].fg)]} onClick={() => navigate(`/operations/return-orders/${o.id}`)}>
                  <TableCell sx={{ minWidth: 230 }}>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                      <Initials name={o.name} size={30} />
                      <Box>
                        <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                          {o.name}
                        </Typography>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
                          <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                            {o.orderNo} · {o.workerNo}
                          </Typography>
                          {o.source === 'Crm' && <Badge tone="neutral">{t('operations.delivery.fromCrm')}</Badge>}
                        </Stack>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ minWidth: 150 }}>{o.projectName ?? '—'}</TableCell>
                  <TableCell sx={{ minWidth: 170 }}>{o.housingName ?? '—'}</TableCell>
                  <TableCell>{t(`operations.return.entry.${o.entry}`)}</TableCell>
                  <TableCell>{t(`operations.return.reasons.${o.reason}`)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(o.arrivedOn)}</TableCell>
                  <TableCell>
                    <ReturnStatusBadge row={o} />
                    <StageLine stage={stages[o.id]} />
                  </TableCell>
                  <TableCell>{o.createdByName}</TableCell>
                </TableRow>
              ))}
              {data && data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {t('operations.delivery.empty')}
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
      {wizard && (
        <ReturnOrderWizard
          initialWorkerId={creating ? (location.state as { workerId?: string } | null)?.workerId : undefined}
          onClose={() => (creating ? navigate('/operations/return-orders') : setWizard(false))}
          onSaved={(saved, failed) => navigate(`/operations/return-orders/${saved}${failed ? `?error=errors.${failed.replace('.', '_')}` : ''}`)}
        />
      )}
    </Box>
  );
}
