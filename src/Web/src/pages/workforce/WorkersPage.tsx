import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
  Link,
  Box,
  Button,
  Chip,
  InputAdornment,
  LinearProgress,
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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { kindPath, workforceApi, type Placement, type WorkerKind, type WorkerList, type WorkerQuery } from '../../api/workforce';
import { ErrorMessage } from '../../auth/AuthLayout';
import { ColumnsButton, useHiddenColumns } from '../../components/hr/ColumnsMenu';
import { Initials } from '../../components/ui';
import { placementCards } from '../../components/workforce/placement';
import { card, StatusPill, wf } from './workforceUi';

type Sort = NonNullable<WorkerQuery['sort']>;
const sorts: Sort[] = ['name', 'joined', 'salary', 'number'];

// The grid's optional columns (the name, its number, the status and the salary total always show).
const optional = ['iqama', 'profession', 'nationality', 'sponsor', 'basic', 'food', 'housing', 'transport', 'other', 'joined', 'workDays'] as const;
type Column = (typeof optional)[number];
const salaryParts = ['basic', 'food', 'housing', 'transport', 'other'] as const;
const pageSizes = [25, 50, 100];

/**
 * Workers, or company staff (the user's redesign, 2026-10-23; docs/02-target-architecture/22): one toolbar
 * (search, status, columns, the total) with the applied filters, and a dense table with the worker column and the header
 * held in place — no title (the breadcrumb names the page), no status cards and no notes (the user's choice). The server pages, sorts and searches as before; the
 * search, the status, the sort, the page and its size live in the address, so coming back from a worker finds the same view.
 */
export function WorkersPage({ kind }: { kind: WorkerKind }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const ar = i18n.language === 'ar';
  const placement = (params.get('status') ?? '') as Placement | '';
  const staff = kind === 'Staff';
  const k = staff ? 'staff' : 'workers';
  const search = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1');
  const sort: Sort = sorts.includes(params.get('sort') as Sort) ? (params.get('sort') as Sort) : 'number';
  const desc = params.get('desc') === '1';
  const pageSize = pageSizes.includes(Number(params.get('size'))) ? Number(params.get('size')) : 50;
  const [text, setText] = useState(search);
  const [data, setData] = useState<WorkerList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { shown, toggle } = useHiddenColumns<Column>(`erp.cols.${k}`, optional);

  useEffect(() => setText(search), [search]);

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
      if (!('page' in changes)) {
        next.delete('page');
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    workforceApi
      .list(kind, { search, placement, sort, desc, page, pageSize })
      .then((value) => !cancelled && (setData(value), setError(null)))
      .catch((failure: unknown) => !cancelled && setError(errorKey(failure)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [kind, search, placement, sort, desc, page, pageSize, attempt]);

  const money = (value: number) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  const date = (value: string | null) => (value ? value.slice(0, 10).replaceAll('-', '/') : '—');
  const withSalary = data?.items.some((i) => i.salary) ?? false;
  const parts = salaryParts.filter(shown);
  const sortBy = (key: Sort) => update(sort === key ? { sort: key, desc: desc ? null : '1' } : { sort: key === 'number' ? null : key, desc: null });
  const head = (key: Sort, label: string) => (
    <TableSortLabel active={sort === key} direction={desc ? 'desc' : 'asc'} onClick={() => sortBy(key)} sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: `${wf.gold} !important` } }}>
      {label}
    </TableSortLabel>
  );
  const statusName = (p: Placement) => t(staff && p === 'Exited' ? 'workforce.staffExited' : `workforce.placement.${p}`);
  const filtered = !!(search || placement);
  const statusOptions: Placement[] = [...placementCards[kind], ...(staff ? [] : (['Inactive'] as Placement[]))];

  return (
    <Box>
      <Box sx={{ ...(card as object), p: { xs: 1.5, md: 2 } }}>
        {/* Toolbar: search, status, columns, the count. */}
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.25, alignItems: { md: 'center' }, mb: 1.25, flexWrap: 'wrap' }}>
          <Box component="form" role="search" sx={{ display: 'flex', gap: 1, flex: 1, minWidth: { md: 300 }, maxWidth: 480 }} onSubmit={(e) => (e.preventDefault(), update({ q: text.trim() || null }))}>
            <TextField
              size="small"
              fullWidth
              label={t('workforce.ui.searchLabel')}
              placeholder={t('workforce.search')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: wf.control, height: 40 } }}
            />
            <Button type="submit" variant="contained" sx={{ borderRadius: wf.control, height: 40, bgcolor: wf.navy, boxShadow: 'none', '&:hover': { bgcolor: wf.navyHover } }}>
              {t('workforce.searchButton')}
            </Button>
          </Box>
          <TextField
            select
            size="small"
            label={t('workforce.col.status')}
            value={placement}
            onChange={(e) => update({ status: e.target.value || null })}
            sx={{ width: { xs: '100%', md: 190 }, '& .MuiOutlinedInput-root': { borderRadius: wf.control, height: 40 } }}
          >
            <MenuItem value="">{t('workforce.ui.allStatuses')}</MenuItem>
            {statusOptions.map((p) => (
              <MenuItem key={p} value={p}>
                {statusName(p)}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ flex: 1 }} />
          <ColumnsButton
            columns={optional
              .filter((c) => !(staff && (c === 'sponsor' || c === 'workDays')) && (withSalary || !(salaryParts as readonly string[]).includes(c)))
              .map((c) => ({
                key: c,
                label: (salaryParts as readonly string[]).includes(c) ? t(`workforce.salary.short.${c}`) : t(`workforce.col.${c === 'joined' && staff ? 'hired' : c}`),
                group: (salaryParts as readonly string[]).includes(c) ? t('workforce.salary.group') : undefined,
              }))}
            shown={shown}
            toggle={toggle}
          />
          <Box sx={{ textAlign: 'end' }}>
            <Typography sx={{ fontSize: 12, color: wf.textSecondary, lineHeight: 1.2 }}>{t(`workforce.ui.total.${k}`)}</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 600, color: wf.navy, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>{data ? data.total.toLocaleString('en-US') : '—'}</Typography>
          </Box>
        </Stack>

        {/* The applied filters, each removable, and «clear all». */}
        {filtered && (
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, mb: 1.25, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 12.5, color: wf.textSecondary }}>{t('workforce.ui.applied')}</Typography>
            {placement && <Chip size="small" label={`${t('workforce.col.status')}: ${statusName(placement)}`} onDelete={() => update({ status: null })} deleteIcon={<CloseIcon />} sx={{ bgcolor: wf.goldSoft, color: wf.navy, fontWeight: 600, '& .MuiChip-deleteIcon': { color: wf.goldText } }} />}
            {search && <Chip size="small" label={`${t('workforce.ui.searchLabel')}: ${search}`} onDelete={() => (setText(''), update({ q: null }))} deleteIcon={<CloseIcon />} sx={{ bgcolor: wf.goldSoft, color: wf.navy, fontWeight: 600, '& .MuiChip-deleteIcon': { color: wf.goldText } }} />}
            <Link component="button" onClick={() => (setText(''), update({ q: null, status: null }))} sx={{ fontSize: 12.5, fontWeight: 600, color: wf.navy }}>
              {t('workforce.ui.clearAll')}
            </Link>
          </Stack>
        )}

        {error && (
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <ErrorMessage messageKey={error} />
            </Box>
            <Button size="small" onClick={() => setAttempt((n) => n + 1)}>
              {t('workforce.ui.retry')}
            </Button>
          </Stack>
        )}
        <Box sx={{ height: 4, mb: 0.5 }}>{busy && data && <LinearProgress sx={{ borderRadius: 2, '& .MuiLinearProgress-bar': { bgcolor: wf.gold }, bgcolor: wf.subtle }} />}</Box>

        <TableContainer sx={{ maxHeight: 'calc(100dvh - 180px)', minHeight: 240, border: `1px solid ${wf.border}`, borderRadius: wf.control }}>
          <Table
            size="small"
            stickyHeader
            sx={{
              borderCollapse: 'separate',
              '& th': { bgcolor: wf.navy, color: '#fff', fontSize: 12.5, fontWeight: 600, py: 1, borderBottom: 0, whiteSpace: 'nowrap' },
              '& th.grp': { textAlign: 'center', bgcolor: wf.navyHover, borderBottom: '1px solid rgba(255,255,255,.14)' },
              '& th.sub': { bgcolor: wf.navyHover, top: 37 },
              '& td': { fontSize: 13, color: wf.text, height: 44, py: 0.5, borderBottom: `1px solid ${wf.subtle}`, fontVariantNumeric: 'tabular-nums' },
              '& tbody tr:hover td': { bgcolor: wf.rowHover },
              '& .gs': { borderInlineStart: `1px solid ${wf.border}` },
              '& th.gs': { borderInlineStart: '1px solid rgba(255,255,255,.18)' },
              // The worker column stays in view while scrolling sideways.
              '& .pin': { position: 'sticky', insetInlineStart: 0, zIndex: 2, bgcolor: wf.surface, boxShadow: `inset -1px 0 0 ${wf.border}` },
              '& th.pin': { zIndex: 4, bgcolor: wf.navy },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell rowSpan={withSalary ? 2 : 1} className="pin" sx={{ minWidth: 220 }}>
                  <Stack sx={{ gap: 0.25 }}>
                    {head('name', t('workforce.col.name'))}
                    <Box sx={{ fontSize: 11, opacity: 0.85 }}>{head('number', t('workforce.col.number'))}</Box>
                  </Stack>
                </TableCell>
                <TableCell rowSpan={withSalary ? 2 : 1}>{t('workforce.col.status')}</TableCell>
                {shown('iqama') && <TableCell rowSpan={withSalary ? 2 : 1}>{t('workforce.col.iqama')}</TableCell>}
                {shown('profession') && <TableCell rowSpan={withSalary ? 2 : 1}>{t('workforce.col.profession')}</TableCell>}
                {shown('nationality') && <TableCell rowSpan={withSalary ? 2 : 1}>{t('workforce.col.nationality')}</TableCell>}
                {!staff && shown('sponsor') && <TableCell rowSpan={withSalary ? 2 : 1}>{t('workforce.col.sponsor')}</TableCell>}
                {withSalary && (
                  <TableCell className="grp gs" colSpan={parts.length + 1}>
                    {t('workforce.salary.group')}
                  </TableCell>
                )}
                {shown('joined') && <TableCell rowSpan={withSalary ? 2 : 1} className={withSalary ? 'gs' : undefined}>{head('joined', t(staff ? 'workforce.col.hired' : 'workforce.col.joined'))}</TableCell>}
                {!staff && shown('workDays') && <TableCell rowSpan={withSalary ? 2 : 1} align="center">{t('workforce.col.workDays')}</TableCell>}
              </TableRow>
              {withSalary && (
                <TableRow>
                  {parts.map((c, i) => (
                    <TableCell key={c} align="center" className={i === 0 ? 'sub gs' : 'sub'}>
                      {t(`workforce.salary.short.${c}`)}
                    </TableCell>
                  ))}
                  <TableCell align="center" className={parts.length === 0 ? 'sub gs' : 'sub'}>
                    {head('salary', t('workforce.salary.short.total'))}
                  </TableCell>
                </TableRow>
              )}
            </TableHead>
            <TableBody>
              {!data &&
                !error &&
                Array.from({ length: 8 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={20}>
                      <Skeleton height={28} />
                    </TableCell>
                  </TableRow>
                ))}
              {data?.items.map((w) => (
                <TableRow
                  key={w.id}
                  hover
                  tabIndex={0}
                  sx={{ cursor: 'pointer', '&:focus-visible td': { bgcolor: wf.rowHover }, '&:focus-visible': { outline: `2px solid ${wf.gold}`, outlineOffset: -2 } }}
                  onClick={() => navigate(`/workforce/${kindPath(kind)}/${w.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/workforce/${kindPath(kind)}/${w.id}`)}
                >
                  <TableCell className="pin">
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                      <Initials name={w.name} size={28} />
                      <Box sx={{ minWidth: 0, maxWidth: 240 }}>
                        <Typography dir="auto" sx={{ fontSize: 13, fontWeight: 600, color: wf.navy, lineHeight: 1.3, unicodeBidi: 'plaintext', textAlign: 'start' }}>
                          {w.name}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: wf.textSecondary, textAlign: 'start' }}>
                          <bdi>{w.workerNo}</bdi>
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <StatusPill placement={w.placement}>{(ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`)}</StatusPill>
                  </TableCell>
                  {shown('iqama') && (
                    <TableCell>
                      <bdi>{w.iqama ?? '—'}</bdi>
                    </TableCell>
                  )}
                  {shown('profession') && <TableCell>{(ar ? w.professionAr : w.professionEn) ?? '—'}</TableCell>}
                  {shown('nationality') && <TableCell>{(ar ? w.nationalityAr : w.nationalityEn) ?? '—'}</TableCell>}
                  {!staff && shown('sponsor') && (
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '12.5px !important' }}>
                      <bdi>{w.sponsor ?? '—'}</bdi>
                    </TableCell>
                  )}
                  {withSalary && (
                    <>
                      {parts.map((c, i) => (
                        <TableCell key={c} align="center" className={i === 0 ? 'gs' : undefined}>
                          {w.salary ? money(w.salary[c]) : '—'}
                        </TableCell>
                      ))}
                      <TableCell align="center" className={parts.length === 0 ? 'gs' : undefined} sx={{ fontWeight: 700, color: `${wf.navy} !important` }}>
                        {w.salary ? money(w.salary.total) : '—'}
                      </TableCell>
                    </>
                  )}
                  {shown('joined') && (
                    <TableCell className={withSalary ? 'gs' : undefined} sx={{ whiteSpace: 'nowrap' }}>
                      <bdi>{date(w.projectJoinedOn)}</bdi>
                    </TableCell>
                  )}
                  {!staff && shown('workDays') && <TableCell align="center">{w.workDays ?? '—'}</TableCell>}
                </TableRow>
              ))}
              {data && data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={20} align="center" sx={{ py: 5, color: `${wf.textSecondary} !important` }}>
                    {filtered ? t('workforce.ui.noResults') : t('workforce.empty')}
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
          rowsPerPageOptions={pageSizes}
          onRowsPerPageChange={(e) => update({ size: Number(e.target.value) === 50 ? null : String(e.target.value) })}
          labelRowsPerPage={t('workforce.perPage')}
          labelDisplayedRows={({ from, to, count }) => t('workforce.rows', { from, to, count })}
        />
      </Box>
    </Box>
  );
}
