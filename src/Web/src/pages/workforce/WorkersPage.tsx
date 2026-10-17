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
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { kindPath, workforceApi, type Placement, type WorkerKind, type WorkerList, type WorkerQuery } from '../../api/workforce';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Initials, PageHeader } from '../../components/ui';
import { placementCards, placementLook } from '../../components/workforce/placement';

type Sort = NonNullable<WorkerQuery['sort']>;

/**
 * Workers, or company staff: status cards as on the old page (click to filter), search, and the old columns.
 * Staff have no supplier and no project work days.
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
  const [text, setText] = useState(search);
  const [sort, setSort] = useState<Sort>('number');
  const [desc, setDesc] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState<WorkerList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [kind, search, placement, sort, desc, page, pageSize]);

  const money = (value: number) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  const date = (value: string | null) =>
    value ? new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—';
  const withSalary = data?.items.some((i) => i.salary) ?? false;
  const sortBy = (key: Sort) => {
    if (sort === key) {
      setDesc((d) => !d);
    } else {
      setSort(key);
      setDesc(false);
    }
  };
  const head = (key: Sort, label: string) => (
    <TableSortLabel active={sort === key} direction={desc ? 'desc' : 'asc'} onClick={() => sortBy(key)} sx={{ color: 'inherit !important', '& .MuiTableSortLabel-icon': { color: 'inherit !important' } }}>
      {label}
    </TableSortLabel>
  );

  return (
    <Box>
      <PageHeader title={t(`workforce.${k}.title`)} subtitle={t(`workforce.${k}.intro`)} />
      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
        {t('workforce.readOnly')}
      </Alert>
      <ErrorMessage messageKey={error} />

      {/* Status cards (.cp-kpi): the round icon sits on the card's top edge. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: `repeat(${placementCards[kind].length}, 1fr)` }, gap: `${tokens.gap}px`, pt: '22px', mb: `${tokens.gap}px` }}>
        {placementCards[kind].map((p) => {
          const look = placementLook[p];
          const active = placement === p;
          return (
            <ButtonBase
              key={p}
              onClick={() => update({ status: active ? null : p })}
              sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                textAlign: 'start',
                bgcolor: '#fff',
                borderRadius: `${tokens.radius}px`,
                boxShadow: active ? `0 0 0 2px ${look.tone}, ${tokens.shadowMd}` : tokens.shadowSm,
                transition: 'box-shadow .15s, transform .15s',
                '&:hover': { boxShadow: tokens.shadowMd, transform: 'translateY(-2px)' },
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  top: -22,
                  insetInlineStart: 14,
                  display: 'grid',
                  placeItems: 'center',
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  bgcolor: look.tone,
                  color: '#fff',
                  boxShadow: `0 0 0 4px ${tokens.bg}, 0 6px 14px rgba(13, 74, 108, .22)`,
                  '& svg': { fontSize: 22 },
                }}
              >
                {look.icon}
              </Box>
              <Box sx={{ p: '12px 16px', textAlign: 'end' }}>
                <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>{t(staff && p === 'Exited' ? 'workforce.staffExited' : `workforce.placement.${p}`)}</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25, color: tokens.navy800, fontVariantNumeric: 'tabular-nums' }}>
                  {(data?.counts[p] ?? 0).toLocaleString('en-US')}
                </Typography>
              </Box>
              <Box sx={{ mt: 'auto', px: 2, py: 1.25, borderTop: `1px solid ${tokens.border}`, fontSize: 12.5, color: active ? look.tone : tokens.gray600, fontWeight: active ? 700 : 400 }}>
                {active ? `✓ ${t('workforce.currentFilter')}` : t(staff ? 'workforce.cardFoot.staff' : `workforce.cardFoot.${p}`)}
              </Box>
            </ButtonBase>
          );
        })}
      </Box>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <Box component="form" sx={{ display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 520 }} onSubmit={(e) => (e.preventDefault(), update({ q: text.trim() || null }))}>
            <TextField
              size="small"
              fullWidth
              placeholder={t('workforce.search')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <Button type="submit" variant="contained">
              {t('workforce.searchButton')}
            </Button>
            {(search || placement) && (
              <Button onClick={() => (setText(''), setParams(new URLSearchParams(), { replace: true }))}>{t('workforce.reset')}</Button>
            )}
          </Box>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }}>
            {t(`workforce.${k}.count`, { count: data?.total ?? 0 })}
          </Box>
        </Stack>
        {busy && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{head('name', t('workforce.col.name'))}</TableCell>
                <TableCell>{head('number', t('workforce.col.number'))}</TableCell>
                <TableCell>{t('workforce.col.status')}</TableCell>
                <TableCell>{t('workforce.col.iqama')}</TableCell>
                <TableCell>{t('workforce.col.profession')}</TableCell>
                <TableCell>{t('workforce.col.nationality')}</TableCell>
                {!staff && <TableCell>{t('workforce.col.sponsor')}</TableCell>}
                {withSalary && (
                  <>
                    <TableCell align="center">{t('workforce.salary.basic')}</TableCell>
                    <TableCell align="center">{t('workforce.salary.food')}</TableCell>
                    <TableCell align="center">{t('workforce.salary.housing')}</TableCell>
                    <TableCell align="center">{t('workforce.salary.transport')}</TableCell>
                    <TableCell align="center">{t('workforce.salary.other')}</TableCell>
                    <TableCell align="center">{head('salary', t('workforce.salary.total'))}</TableCell>
                  </>
                )}
                <TableCell>{head('joined', t(staff ? 'workforce.col.hired' : 'workforce.col.joined'))}</TableCell>
                {!staff && <TableCell align="center">{t('workforce.col.workDays')}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((w) => {
                const look = placementLook[w.placement];
                return (
                  <TableRow key={w.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/workforce/${kindPath(kind)}/${w.id}`)}>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                        <Initials name={w.name} size={30} />
                        <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 600, color: tokens.navy800 }}>
                          {w.name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell dir="ltr" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {w.workerNo}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 700, color: look.tone, bgcolor: look.soft }}>
                        <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: look.tone }} />
                        {(ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`)}
                      </Box>
                    </TableCell>
                    <TableCell dir="ltr" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {w.iqama ?? '—'}
                    </TableCell>
                    <TableCell>{(ar ? w.professionAr : w.professionEn) ?? '—'}</TableCell>
                    <TableCell>{(ar ? w.nationalityAr : w.nationalityEn) ?? '—'}</TableCell>
                    {!staff && <TableCell dir="ltr">{w.sponsor ?? '—'}</TableCell>}
                    {withSalary && (
                      <>
                        <TableCell align="center">{w.salary ? money(w.salary.basic) : '—'}</TableCell>
                        <TableCell align="center">{w.salary ? money(w.salary.food) : '—'}</TableCell>
                        <TableCell align="center">{w.salary ? money(w.salary.housing) : '—'}</TableCell>
                        <TableCell align="center">{w.salary ? money(w.salary.transport) : '—'}</TableCell>
                        <TableCell align="center">{w.salary ? money(w.salary.other) : '—'}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: tokens.navy800 }}>
                          {w.salary ? money(w.salary.total) : '—'}
                        </TableCell>
                      </>
                    )}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(w.projectJoinedOn)}</TableCell>
                    {!staff && <TableCell align="center">{w.workDays ?? '—'}</TableCell>}
                  </TableRow>
                );
              })}
              {data && data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={(withSalary ? 15 : 9) - (staff ? 2 : 0)} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {t('workforce.empty')}
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
