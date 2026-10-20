import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Link,
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
import { ColumnsButton, useHiddenColumns } from '../../components/hr/ColumnsMenu';
import { Initials, PageHeader } from '../../components/ui';
import { placementCards, placementLook } from '../../components/workforce/placement';

type Sort = NonNullable<WorkerQuery['sort']>;

// The grid's optional columns (the name, its number, the status and the salary total always show).
const optional = ['iqama', 'profession', 'nationality', 'sponsor', 'basic', 'food', 'housing', 'transport', 'other', 'joined', 'workDays'] as const;
type Column = (typeof optional)[number];
const salaryParts = ['basic', 'food', 'housing', 'transport', 'other'] as const;

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
  const { shown, toggle } = useHiddenColumns<Column>(`erp.cols.${k}`, optional);

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
  const date = (value: string | null) => (value ? value.slice(0, 10).replaceAll('-', '/') : '—');
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
      {!staff && (data?.counts.Inactive ?? 0) > 0 && (
        <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: `${tokens.gap}px` }}>
          {t('workforce.inactiveNote', { count: data?.counts.Inactive ?? 0 })}{' '}
          {placement === 'Inactive' ? (
            <Link component="button" onClick={() => update({ status: null })}>
              {t('workforce.reset')}
            </Link>
          ) : (
            <Link component="button" onClick={() => update({ status: 'Inactive' })}>
              {t('workforce.inactiveShow')}
            </Link>
          )}
        </Alert>
      )}

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
          <Box sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }}>
            {t(`workforce.${k}.count`, { count: data?.total ?? 0 })}
          </Box>
        </Stack>
        {busy && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}

        <TableContainer>
          <Table
            size="small"
            sx={{
              '& td': { fontVariantNumeric: 'tabular-nums' },
              '& th.grp': { textAlign: 'center', bgcolor: '#155f45', borderBottom: '1px solid rgba(255,255,255,.18)' },
              '& th.g-pay': { bgcolor: '#17734b' },
              '& td.g-pay': { backgroundImage: 'linear-gradient(rgba(5,150,105,.05), rgba(5,150,105,.05))' },
              '& .gs': { borderInlineStart: `2px solid ${tokens.border}` },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell rowSpan={withSalary ? 2 : 1}>
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
                  <TableCell className="grp gs" colSpan={salaryParts.filter(shown).length + 1}>
                    {t('workforce.salary.group')}
                  </TableCell>
                )}
                {shown('joined') && <TableCell rowSpan={withSalary ? 2 : 1} className={withSalary ? 'gs' : undefined}>{head('joined', t(staff ? 'workforce.col.hired' : 'workforce.col.joined'))}</TableCell>}
                {!staff && shown('workDays') && <TableCell rowSpan={withSalary ? 2 : 1} align="center">{t('workforce.col.workDays')}</TableCell>}
              </TableRow>
              {withSalary && (
                <TableRow>
                  {salaryParts.filter(shown).map((c, i) => (
                    <TableCell key={c} align="center" className={i === 0 ? 'g-pay gs' : 'g-pay'}>
                      {t(`workforce.salary.short.${c}`)}
                    </TableCell>
                  ))}
                  <TableCell align="center" className={salaryParts.filter(shown).length === 0 ? 'g-pay gs' : 'g-pay'}>
                    {head('salary', t('workforce.salary.short.total'))}
                  </TableCell>
                </TableRow>
              )}
            </TableHead>
            <TableBody>
              {data?.items.map((w) => {
                const look = placementLook[w.placement];
                const parts = salaryParts.filter(shown);
                return (
                  <TableRow key={w.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/workforce/${kindPath(kind)}/${w.id}`)}>
                    <TableCell>
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                        <Initials name={w.name} size={26} />
                        <Box sx={{ minWidth: 0, maxWidth: 230 }}>
                          <Typography dir="auto" sx={{ fontSize: 12.5, fontWeight: 600, color: tokens.navy800, lineHeight: 1.3, unicodeBidi: 'plaintext', textAlign: 'start' }}>
                            {w.name}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: tokens.gray500, textAlign: 'start' }}>
                            <bdi>{w.workerNo}</bdi>
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.25, borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: look.tone, bgcolor: look.soft }}>
                        <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: look.tone }} />
                        {(ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`)}
                      </Box>
                    </TableCell>
                    {shown('iqama') && (
                      <TableCell>
                        <bdi>{w.iqama ?? '—'}</bdi>
                      </TableCell>
                    )}
                    {shown('profession') && <TableCell>{(ar ? w.professionAr : w.professionEn) ?? '—'}</TableCell>}
                    {shown('nationality') && <TableCell>{(ar ? w.nationalityAr : w.nationalityEn) ?? '—'}</TableCell>}
                    {!staff && shown('sponsor') && (
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                        <bdi>{w.sponsor ?? '—'}</bdi>
                      </TableCell>
                    )}
                    {withSalary && (
                      <>
                        {parts.map((c, i) => (
                          <TableCell key={c} align="center" className={i === 0 ? 'g-pay gs' : 'g-pay'}>
                            {w.salary ? money(w.salary[c]) : '—'}
                          </TableCell>
                        ))}
                        <TableCell align="center" className={parts.length === 0 ? 'g-pay gs' : 'g-pay'} sx={{ fontWeight: 700, color: tokens.navy800 }}>
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
                );
              })}
              {data && data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={20} align="center" sx={{ py: 5, color: tokens.gray500 }}>
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
