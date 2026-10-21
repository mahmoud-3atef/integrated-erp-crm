import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HourglassTopOutlinedIcon from '@mui/icons-material/HourglassTopOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  InputAdornment,
  MenuItem,
  Skeleton,
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
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { settlementsApi, type SettlementKind, type SettlementList, type SettlementParty } from '../../api/settlements';
import { useSession } from '../../app/session';
import { HrEmptyState, HrScope, hr } from '../../components/hr/Hr';
import { GlassHero, GlassKpi, GlassRow, glassButton, glassOnDark, glassPanel } from '../../components/glass';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { NewSettlementDialog } from './NewSettlementDialog';
import { Money, SettlementStatusBadge, sar, useYears } from './settlementParts';

const statuses = ['', 'Open', 'InApproval', 'Approved', 'Paid', 'Cancelled'] as const;

/**
 * The settlements (docs/03-migration-plan/18): the company's staff and its sponsored workers, vacation and end of
 * service; the KPIs over all of them from the server; filtered, sorted and paged on the server. The glass strip is the
 * list's tint (the details have the other one).
 */
export function SettlementsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { date } = useCommercialFormat();
  const years = useYears();
  const [party, setParty] = useState<SettlementParty>('Staff');
  const [kind, setKind] = useState<SettlementKind | ''>('');
  const [status, setStatus] = useState<(typeof statuses)[number]>('');
  const [search, setSearch] = useState('');
  const [typed, setTyped] = useState('');
  const [sort, setSort] = useState<{ by: string; desc: boolean }>({ by: '', desc: true });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [data, setData] = useState<SettlementList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typed.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [typed]);

  const load = useCallback(() => {
    setError(null);
    settlementsApi
      .list({ party, kind, status, search, sort: sort.by || undefined, desc: sort.desc, page: page + 1, pageSize: size })
      .then(setData)
      .catch((f: unknown) => setError(errorKey(f)));
  }, [party, kind, status, search, sort, page, size]);
  useEffect(load, [load]);

  const c = data?.counts;
  const sortBy = (by: string) => {
    setSort((s) => ({ by, desc: s.by === by ? !s.desc : true }));
    setPage(0);
  };
  const head = (by: string, label: string, align?: 'center') => (
    <TableCell align={align} sortDirection={sort.by === by ? (sort.desc ? 'desc' : 'asc') : false}>
      <TableSortLabel active={sort.by === by} direction={sort.by === by && !sort.desc ? 'asc' : 'desc'} onClick={() => sortBy(by)}>
        {label}
      </TableSortLabel>
    </TableCell>
  );
  const filtered = Boolean(search || kind || status);

  return (
    <HrScope>
      <GlassHero
        tint="list"
        overline={t('settlements.crumb')}
        title={t('settlements.title')}
        subtitle={t('settlements.subtitle')}
        actions={
          can('payroll.settlements.manage', true) && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreating(true)} sx={glassButton(true)}>
              {t('settlements.new')}
            </Button>
          )
        }
      >
        <GlassRow>
          {!c ? (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="rounded" height={104} sx={{ bgcolor: 'rgba(255,255,255,.12)', borderRadius: '16px' }} />)
          ) : (
            <>
              <GlassKpi icon={<EditNoteOutlinedIcon />} label={t('settlements.kpi.drafts')} value={c.drafts} hint={t('settlements.kpi.draftsHint')} />
              <GlassKpi
                icon={<HourglassTopOutlinedIcon />}
                label={t('settlements.kpi.inApproval')}
                value={c.inApproval}
                hint={c.oldestInApproval ? t('settlements.kpi.oldest', { date: date(c.oldestInApproval) }) : t('settlements.kpi.none')}
              />
              <GlassKpi icon={<PaymentsOutlinedIcon />} label={t('settlements.kpi.toPay')} value={c.approved} hint={`${sar(c.approvedNet)} ${t('settlements.sar')}`} />
              <GlassKpi icon={<CheckCircleOutlineIcon />} label={t('settlements.kpi.paid')} value={c.paidThisMonth} hint={`${sar(c.paidThisMonthNet)} ${t('settlements.sar')}`} />
            </>
          )}
        </GlassRow>
        <Stack direction="row" role="tablist" sx={{ ...(glassOnDark as object), display: 'inline-flex', borderRadius: 99, p: 0.5, gap: 0.5, mt: 2 }}>
          {(['Staff', 'Worker'] as const).map((p) => (
            <ButtonBase
              key={p}
              role="tab"
              aria-selected={party === p}
              onClick={() => {
                setParty(p);
                setPage(0);
              }}
              sx={{ px: 2, py: 0.75, borderRadius: 99, fontWeight: 700, fontSize: 12.5, color: party === p ? hr.navy : '#fff', bgcolor: party === p ? '#fff' : 'transparent' }}
            >
              {t(`settlements.party.${p}`)} ({c ? (p === 'Staff' ? c.staff : c.workers) : '—'})
            </ButtonBase>
          ))}
        </Stack>
      </GlassHero>

      <Box sx={{ ...(glassPanel as object), p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.25, mb: 1.5 }}>
          <TextField
            size="small"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t('settlements.search')}
            sx={{ flex: { md: '0 1 320px' } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          <TextField select size="small" label={t('settlements.col.kind')} value={kind} onChange={(e) => { setKind(e.target.value as SettlementKind | ''); setPage(0); }} sx={{ flex: { md: '0 1 200px' } }}>
            <MenuItem value="">{t('settlements.all')}</MenuItem>
            <MenuItem value="Vacation">{t('settlements.kind.Vacation')}</MenuItem>
            <MenuItem value="EndOfService">{t('settlements.kind.EndOfService')}</MenuItem>
          </TextField>
          <TextField select size="small" label={t('settlements.col.status')} value={status} onChange={(e) => { setStatus(e.target.value as (typeof statuses)[number]); setPage(0); }} sx={{ flex: { md: '0 1 200px' } }}>
            {statuses.map((s) => (
              <MenuItem key={s} value={s}>
                {s ? t(`settlements.filter.${s}`) : t('settlements.all')}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {error ? (
          <Alert severity="error" action={<Button onClick={load}>{t('settlements.retry')}</Button>}>
            {t(error)}
          </Alert>
        ) : !data ? (
          <Stack sx={{ gap: 1 }}>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} variant="rounded" height={44} />)}</Stack>
        ) : data.items.length === 0 ? (
          filtered ? (
            <HrEmptyState icon={<SearchIcon />} title={t('settlements.noResults')} hint={t('settlements.noResultsHint')} />
          ) : (
            <HrEmptyState icon={<ReceiptLongOutlinedIcon />} title={t('settlements.empty')} hint={t(party === 'Staff' ? 'settlements.emptyHint' : 'settlements.emptyWorkers')} />
          )
        ) : (
          <>
            <TableContainer>
              <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' }, '& tbody tr': { cursor: 'pointer', height: 46 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('settlements.col.no')}</TableCell>
                    {head('name', t('settlements.col.name'))}
                    <TableCell>{t('settlements.col.kind')}</TableCell>
                    <TableCell>{t('settlements.col.reason')}</TableCell>
                    {head('date', t('settlements.col.date'))}
                    <TableCell>{t('settlements.col.service')}</TableCell>
                    <TableCell align="center">{t('settlements.col.additions')}</TableCell>
                    <TableCell align="center">{t('settlements.col.deductions')}</TableCell>
                    {head('net', t('settlements.col.net'), 'center')}
                    <TableCell>{t('settlements.col.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((s) => (
                    <TableRow
                      key={s.id}
                      hover
                      tabIndex={0}
                      onClick={() => navigate(`/hr/settlements/${s.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') navigate(`/hr/settlements/${s.id}`);
                      }}
                    >
                      <TableCell>
                        <bdi>{s.settlementNo}</bdi>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{s.name}</Typography>
                        <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>
                          <bdi>{s.personNo}</bdi>
                        </Typography>
                      </TableCell>
                      <TableCell>{t(`settlements.kind.${s.kind}`)}</TableCell>
                      <TableCell>{s.reason ? t(`settlements.reason.${s.reason}`) : t('settlements.annualLeave')}</TableCell>
                      <TableCell>{date(s.leaveFrom ?? s.lastDay)}</TableCell>
                      <TableCell>{s.kind === 'EndOfService' ? years(s.serviceYears) : '—'}</TableCell>
                      <TableCell align="center">
                        <Money value={s.totalAdditions} />
                      </TableCell>
                      <TableCell align="center">
                        <Money value={s.totalDeductions} />
                      </TableCell>
                      <TableCell align="center">
                        <Money value={s.net} strong />
                      </TableCell>
                      <TableCell>
                        <SettlementStatusBadge status={s.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={data.total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={size}
              onRowsPerPageChange={(e) => {
                setSize(Number(e.target.value));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage={t('settlements.perPage')}
              labelDisplayedRows={({ from, to, count }) => t('settlements.shown', { from, to, count })}
            />
          </>
        )}
      </Box>
      {creating && <NewSettlementDialog party={party} onClose={() => setCreating(false)} onCreated={(id) => navigate(`/hr/settlements/${id}`)} />}
    </HrScope>
  );
}
