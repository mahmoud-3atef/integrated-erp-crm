import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  InputAdornment,
  LinearProgress,
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
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { receivablesApi, type Aging, type AgingRow } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { PageHeader } from '../../components/ui';
import { isoToday, sar } from '../operations/delivery';

const buckets = [
  { key: 'current', tone: '#1f9d55' },
  { key: 'days30', tone: '#7cb342' },
  { key: 'days60', tone: '#f0a20b' },
  { key: 'days90', tone: '#e8710a' },
  { key: 'days180', tone: '#d64545' },
  { key: 'over180', tone: '#8e1b1b' },
] as const;

type Group = 'project' | 'manager';

/** The debts' ages: what each project owes by days past due, its credit and its net, by project or by project manager. */
export function AgingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [asOf, setAsOf] = useState(isoToday());
  const [group, setGroup] = useState<Group>('project');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<Aging | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    receivablesApi
      .aging(asOf)
      .then((value) => {
        setData(value);
        setError(null);
      })
      .catch((failure: unknown) => setError(errorKey(failure)));
  }, [asOf]);

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

  const sum = (pick: (r: AgingRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const total = sum((r) => r.total);

  return (
    <Box>
      <PageHeader title={t('aging.title')} subtitle={t('aging.intro')} />
      <ErrorMessage messageKey={error} />

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
        <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('aging.totalOwed')}</Typography>
        <Typography sx={{ fontSize: 26, fontWeight: 800, color: tokens.navy800 }}>{sar(sum((r) => r.net))}</Typography>
        <Box sx={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', bgcolor: tokens.gray100, my: 1.5 }}>
          {total > 0 &&
            buckets.map((b) => {
              const value = sum((r) => r[b.key]);
              return value > 0 ? <Box key={b.key} title={`${t(`aging.buckets.${b.key}`)}: ${sar(value)}`} sx={{ width: `${(value / total) * 100}%`, bgcolor: b.tone }} /> : null;
            })}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(7, 1fr)' }, gap: 1.25 }}>
          {buckets.map((b) => (
            <Box key={b.key} sx={{ p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50, borderInlineStart: `4px solid ${b.tone}` }}>
              <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t(`aging.buckets.${b.key}`)}</Typography>
              <Typography sx={{ fontSize: 17, fontWeight: 800, color: tokens.navy800 }}>{sar(sum((r) => r[b.key]))}</Typography>
            </Box>
          ))}
          <Box sx={{ p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50, borderInlineStart: '4px solid #2b7bd9' }}>
            <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('aging.credit')}</Typography>
            <Typography sx={{ fontSize: 17, fontWeight: 800, color: '#2b7bd9' }}>{sar(sum((r) => r.credit))}</Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <TextField
            size="small"
            sx={{ minWidth: 280 }}
            placeholder={t('aging.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          <TextField size="small" type="date" label={t('aging.asOf')} value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Box sx={{ flex: 1 }} />
          <ToggleButtonGroup size="small" exclusive sx={{ whiteSpace: 'nowrap' }} value={group} onChange={(_, v: Group | null) => v && setGroup(v)}>
            <ToggleButton value="project">{t('aging.byProject')}</ToggleButton>
            <ToggleButton value="manager">{t('aging.byManager')}</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {!data && !error && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        <TableContainer>
          <Table size="small" sx={{ '& th, & td': { px: 1, fontSize: 12.5 }, '& th': { whiteSpace: 'nowrap' } }}>
            <TableHead>
              <TableRow>
                <TableCell>{group === 'project' ? t('commercial.col.project') : t('commercial.col.manager')}</TableCell>
                {buckets.map((b) => (
                  <TableCell key={b.key} align="center">
                    {t(`aging.buckets.${b.key}`)}
                  </TableCell>
                ))}
                <TableCell align="center">{t('aging.total')}</TableCell>
                <TableCell align="center">{t('aging.credit')}</TableCell>
                <TableCell align="center">{t('aging.net')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={group === 'project' ? r.projectCrmId : r.projectName}
                  hover
                  sx={{ cursor: group === 'project' ? 'pointer' : 'default' }}
                  onClick={() => group === 'project' && navigate(`/billing/statements/${r.projectId ?? r.projectCrmId}`)}
                >
                  <TableCell sx={{ minWidth: 190 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{r.projectName}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                      {group === 'project' ? [r.customerName, r.manager].filter(Boolean).join(' · ') || '—' : t('aging.projects', { count: r.items })}
                    </Typography>
                  </TableCell>
                  {buckets.map((b) => (
                    <TableCell key={b.key} align="center" sx={{ whiteSpace: 'nowrap', color: r[b.key] > 0 ? b.tone : tokens.gray300, fontWeight: r[b.key] > 0 ? 700 : 400 }}>
                      {r[b.key] > 0 ? sar(r[b.key]) : '—'}
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    {sar(r.total)}
                  </TableCell>
                  <TableCell align="center" sx={{ color: '#2b7bd9' }}>
                    {r.credit > 0 ? sar(r.credit) : '—'}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                    {sar(r.net)}
                  </TableCell>
                </TableRow>
              ))}
              {data && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {t('aging.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow sx={{ '& td': { fontWeight: 800, color: tokens.navy800, fontSize: 13 } }}>
                  <TableCell>{t('aging.total')}</TableCell>
                  {buckets.map((b) => (
                    <TableCell key={b.key} align="center">
                      {sar(sum((r) => r[b.key]))}
                    </TableCell>
                  ))}
                  <TableCell align="center">{sar(total)}</TableCell>
                  <TableCell align="center">{sar(sum((r) => r.credit))}</TableCell>
                  <TableCell align="center">{sar(sum((r) => r.net))}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}
