import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  InputAdornment,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { receivablesApi, type Aging, type AgingRow } from '../../api/billing';
import { ErrorMessage } from '../../auth/AuthLayout';
import { DateField } from '../../components/DateField';
import { card, KpiCard, navyHead, num, wf } from '../../components/designKit';
import { PageHeader } from '../../components/ui';
import { isoToday } from '../operations/delivery';

// From not due yet to the oldest debt: one scale that darkens with the delay (colour is never the only sign: every
// cell also has its column's name and the amount). `heat` tints a table cell.
const buckets = [
  { key: 'current', tone: '#6B8BAE', heat: 'transparent' },
  { key: 'days30', tone: '#D9A520', heat: '#FDF4DC' },
  { key: 'days60', tone: '#D9782F', heat: '#FBE6D2' },
  { key: 'days90', tone: '#C24A33', heat: '#F8D8D0' },
  { key: 'days180', tone: '#8F1D14', heat: '#F2C2BC' },
  { key: 'over180', tone: '#4D0D08', heat: '#EAA59D' },
] as const;

type Group = 'project' | 'manager';

// Money with two decimals, so the columns line up.
const sar = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—');

/**
 * The debts' ages: what each project owes by days past due, its credit and its net, by project or by project manager.
 * Laid out as the proposal of 2026-10-24 (three figures, the distribution, a table whose cells darken with the delay),
 * in the system's shared look (components/designKit). Everything comes from one request; the grouping and search are
 * done here.
 */
export function AgingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [asOf, setAsOf] = useState(isoToday());
  const [group, setGroup] = useState<Group>('project');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<Aging | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setData(null);
    setError(null);
    receivablesApi
      .aging(asOf)
      .then(setData)
      .catch((failure: unknown) => setError(errorKey(failure)));
  }, [asOf, attempt]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (data?.rows ?? []).filter((r) => !term || [r.projectName, r.customerName, r.manager].some((v) => v?.toLowerCase().includes(term)));
    if (group === 'project') return list;
    const byManager = new Map<string, AgingRow>();
    for (const r of list) {
      const name = r.manager ?? t('aging.noManager');
      const sum = byManager.get(name);
      byManager.set(
        name,
        sum
          ? {
              ...sum,
              current: sum.current + r.current,
              days30: sum.days30 + r.days30,
              days60: sum.days60 + r.days60,
              days90: sum.days90 + r.days90,
              days180: sum.days180 + r.days180,
              over180: sum.over180 + r.over180,
              total: sum.total + r.total,
              credit: sum.credit + r.credit,
              net: sum.net + r.net,
              items: sum.items + 1,
            }
          : { ...r, projectName: name, customerName: null, items: 1 },
      );
    }

    return [...byManager.values()].sort((a, b) => b.net - a.net);
  }, [data, search, group, t]);

  // The figures and the distribution are the server's totals (all projects), whatever the search shows.
  const totals = data?.totals;
  const overdue = totals ? totals.days30 + totals.days60 + totals.days90 + totals.days180 + totals.over180 : 0;
  const over60 = totals ? totals.days90 + totals.days180 + totals.over180 : 0;
  const hasCredit = (data?.rows ?? []).some((r) => r.credit > 0);
  const sum = (pick: (r: AgingRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const filtered = search.trim() !== '';
  const columns = 2 + buckets.length + (hasCredit ? 2 : 0);

  return (
    <Box>
      <PageHeader
        title={t('aging.title')}
        subtitle={t('aging.intro')}
        actions={<DateField size="small" label={t('aging.asOf')} value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />}
      />
      {error && (
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <ErrorMessage messageKey={error} />
          </Box>
          <Button variant="outlined" onClick={() => setAttempt((n) => n + 1)}>
            {t('workforce.ui.retry')}
          </Button>
        </Stack>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2, mb: 2 }}>
        <KpiCard
          label={t('aging.totalOwed')}
          loading={!data && !error}
          value={totals ? sar(totals.net) : null}
          unit={t('aging.sar')}
          sub={totals && (totals.credit > 0 ? t('aging.kpi.netAfterCredit', { credit: sar(totals.credit) }) : t('aging.kpi.noCredit'))}
        />
        <KpiCard label={t('aging.kpi.overdue')} loading={!data && !error} value={totals ? sar(overdue) : null} unit={t('aging.sar')} sub={totals && t('aging.kpi.ofOwed', { pct: pct(overdue, totals.total) })} />
        <KpiCard
          label={t('aging.kpi.over60')}
          loading={!data && !error}
          value={totals ? sar(over60) : null}
          unit={t('aging.sar')}
          tone={over60 > 0 ? 'danger' : undefined}
          sub={totals && t('aging.kpi.over60Sub', { pct: pct(over60, totals.total) })}
        />
      </Box>

      <Box sx={{ ...card, p: 2.5, mb: 2 } as SxProps<Theme>}>
        <Typography component="h2" sx={{ m: 0, fontSize: 15, fontWeight: 700, color: wf.navy, mb: 1.5 }}>
          {t('aging.distribution')}
        </Typography>
        {totals ? (
          <>
            <Box
              role="img"
              aria-label={buckets.map((b) => `${t(`aging.buckets.${b.key}`)} ${pct(totals[b.key], totals.total)}`).join('، ')}
              sx={{ display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden', gap: '2px', bgcolor: wf.subtle }}
            >
              {totals.total > 0 && buckets.map((b) => (totals[b.key] > 0 ? <Box key={b.key} sx={{ width: `${(totals[b.key] / totals.total) * 100}%`, bgcolor: b.tone }} /> : null))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1.5, mt: 1.75 }}>
              {buckets.map((b) => (
                <Box key={b.key}>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, fontSize: 13, fontWeight: 600, color: wf.textSecondary }}>
                    <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: b.tone }} />
                    {t(`aging.buckets.${b.key}`)}
                  </Stack>
                  <Typography sx={{ ...num, fontSize: 16, fontWeight: 700, color: wf.navy } as SxProps<Theme>}>{totals[b.key] > 0 ? sar(totals[b.key]) : '—'}</Typography>
                  <Typography sx={{ ...num, fontSize: 12.5, color: wf.textSecondary } as SxProps<Theme>}>{totals[b.key] > 0 ? pct(totals[b.key], totals.total) : t('aging.none')}</Typography>
                </Box>
              ))}
            </Box>
          </>
        ) : (
          !error && <Skeleton variant="rounded" height={70} />
        )}
      </Box>

      <Box sx={{ ...card, overflow: 'hidden' } as SxProps<Theme>}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, justifyContent: 'space-between', p: 2 }}>
          <ToggleButtonGroup size="small" exclusive sx={{ whiteSpace: 'nowrap' }} value={group} onChange={(_, v: Group | null) => v && setGroup(v)}>
            <ToggleButton value="project">{t('aging.byProject')}</ToggleButton>
            <ToggleButton value="manager">{t('aging.byManager')}</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            size="small"
            sx={{ minWidth: { md: 320 } }}
            placeholder={t('aging.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': t('aging.search') } }}
          />
        </Stack>
        <TableContainer sx={{ maxHeight: 'calc(100dvh - 220px)' }}>
          <Table size="small" stickyHeader sx={{ ...navyHead, '& th, & td': { px: 1.25 }, '& td': { whiteSpace: 'nowrap' } } as SxProps<Theme>}>
            <TableHead>
              <TableRow>
                <TableCell>{group === 'project' ? t('commercial.col.project') : t('commercial.col.manager')}</TableCell>
                {buckets.map((b) => (
                  <TableCell key={b.key} align="right">
                    {t(`aging.buckets.${b.key}`)}
                  </TableCell>
                ))}
                {hasCredit && <TableCell align="right">{t('aging.total')}</TableCell>}
                {hasCredit && <TableCell align="right">{t('aging.credit')}</TableCell>}
                <TableCell align="right">{t('aging.net')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!data &&
                !error &&
                Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: columns }, (_, j) => (
                      <TableCell key={j}>
                        <Skeleton variant="text" width={j === 0 ? 180 : 80} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {rows.map((r) => (
                <TableRow
                  key={group === 'project' ? r.projectCrmId : r.projectName}
                  sx={{ cursor: group === 'project' ? 'pointer' : 'default' }}
                  onClick={() => group === 'project' && navigate(`/billing/statements/${r.projectId ?? r.projectCrmId}`)}
                >
                  <TableCell sx={{ minWidth: 200, whiteSpace: 'normal !important' }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: wf.navy }}>{r.projectName}</Typography>
                    <Typography sx={{ fontSize: 12, color: wf.textSecondary }}>
                      {group === 'project' ? [r.customerName, r.manager].filter(Boolean).join(' · ') || '—' : t('aging.projects', { count: r.items })}
                    </Typography>
                  </TableCell>
                  {buckets.map((b) => (
                    <TableCell key={b.key} align="right" sx={{ ...num, bgcolor: r[b.key] > 0 ? `${b.heat} !important` : undefined, color: r[b.key] > 0 ? wf.text : wf.border } as SxProps<Theme>}>
                      {r[b.key] > 0 ? sar(r[b.key]) : '—'}
                    </TableCell>
                  ))}
                  {hasCredit && <TableCell align="right" sx={num}>{sar(r.total)}</TableCell>}
                  {hasCredit && <TableCell align="right" sx={num}>{r.credit > 0 ? sar(r.credit) : '—'}</TableCell>}
                  <TableCell align="right" sx={{ ...num, fontWeight: 700, color: wf.navy } as SxProps<Theme>}>
                    {sar(r.net)}
                  </TableCell>
                </TableRow>
              ))}
              {data && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns} align="center" sx={{ py: 5, color: wf.textSecondary }}>
                    {filtered ? t('workforce.ui.noResults') : t('aging.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter sx={{ position: 'sticky', bottom: 0 }}>
                <TableRow>
                  <TableCell>{filtered ? t('aging.totalShown', { count: rows.length }) : t('aging.totalAll')}</TableCell>
                  {buckets.map((b) => (
                    <TableCell key={b.key} align="right" sx={num}>
                      {sar(sum((r) => r[b.key]))}
                    </TableCell>
                  ))}
                  {hasCredit && <TableCell align="right" sx={num}>{sar(sum((r) => r.total))}</TableCell>}
                  {hasCredit && <TableCell align="right" sx={num}>{sar(sum((r) => r.credit))}</TableCell>}
                  <TableCell align="right" sx={num}>{sar(sum((r) => r.net))}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}
