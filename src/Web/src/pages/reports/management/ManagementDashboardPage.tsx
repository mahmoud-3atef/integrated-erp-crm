import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import { Alert, Box, Button, ButtonBase, Stack, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../../api/auth';
import { managementApi } from '../../../api/management';
import type { Overview } from '../../../api/reports';
import { useSession } from '../../../app/session';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { DateField } from '../../../components/DateField';
import { presetRange } from '../reportKit';
import { FinanceTab } from './FinanceTab';
import { md } from './mdKit';
import { OverviewTab } from './OverviewTab';

type Tab = 'overview' | 'finance' | 'housing' | 'tasks';

// As the old page did, finance (and housing) open from the first month the reports read invoices (Reports:FinanceFrom)
// while the period is still the default month.
const financeFrom = '2026-06-01';

/** Each tab's colour, as the old page tinted its active tab (navy, teal, brown, green). */
const tabs: { key: Tab; icon: ReactNode; color: string }[] = [
  { key: 'overview', icon: <SpeedOutlinedIcon />, color: md.navy },
  { key: 'finance', icon: <RequestQuoteOutlinedIcon />, color: md.teal },
  { key: 'housing', icon: <BedOutlinedIcon />, color: md.brown },
  { key: 'tasks', icon: <ChecklistOutlinedIcon />, color: md.green },
];

/**
 * «لوحة الإدارة التنفيذية» as it was in the old system (ManagementDashboard.aspx, docs/03-migration-plan/19): the
 * period, then overview, finance, housing and tasks, in the old page's layout and colours, with glass tabs (the
 * user's choice). Every figure comes from the server.
 */
export function ManagementDashboardPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [tab, setTab] = useState<Tab>('overview');
  const [draft, setDraft] = useState<[string, string]>(() => presetRange('month'));
  const [period, setPeriod] = useState<[string, string]>(draft);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [defaulted, setDefaulted] = useState(true);
  const allowed = can('reports.management.view', true);
  const finance = can('billing.invoices.view', true);

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    setOverview(null);
    setError(null);
    managementApi
      .overview(period[0], period[1])
      .then((o) => live && setOverview(o))
      .catch((e) => live && setError(errorKey(e)));
    return () => {
      live = false;
    };
  }, [period, allowed]);

  if (!allowed) return <Alert severity="warning">{t('mgmt.noAccess')}</Alert>;
  const shown = tabs.filter((x) => x.key !== 'finance' || finance);
  const valid = draft[0] && draft[1] && draft[0] <= draft[1];

  return (
    <Box sx={{ color: md.ink }}>
      <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700, color: md.navy, mb: 1.5 }}>
        {t('mgmt.title')}
      </Typography>

      {/* The tabs and the period on a glass strip; each tab a translucent glass pill, the active one tinted with its colour. */}
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        sx={{
          gap: 1.5,
          alignItems: { lg: 'center' },
          justifyContent: 'space-between',
          p: '10px 12px',
          mb: 2,
          borderRadius: '18px',
          bgcolor: 'rgba(255,255,255,.55)',
          border: '1px solid rgba(255,255,255,.85)',
          backdropFilter: 'blur(14px) saturate(160%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9), 0 10px 30px rgba(10,60,88,.08)',
        }}
      >
        <Stack direction="row" role="tablist" aria-label={t('mgmt.sections')} sx={{ gap: 1, flexWrap: 'wrap' }}>
          {shown.map((x) => {
            const active = tab === x.key;
            return (
              <ButtonBase
                key={x.key}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTab(x.key);
                  if ((x.key === 'finance' || x.key === 'housing') && defaulted) {
                    const next: [string, string] = [financeFrom, period[1]];
                    setDefaulted(false);
                    setDraft(next);
                    setPeriod(next);
                  }
                }}
                sx={{
                  gap: 1.25,
                  minHeight: 52,
                  ps: 1,
                  pe: 2.25,
                  borderRadius: '14px',
                  textAlign: 'start',
                  color: active ? '#fff' : md.text,
                  bgcolor: active ? `${x.color}C7` : 'rgba(255,255,255,.42)',
                  border: `1px solid ${active ? `${x.color}` : 'rgba(255,255,255,.9)'}`,
                  backdropFilter: 'blur(10px) saturate(150%)',
                  boxShadow: active ? `0 10px 24px ${x.color}40, inset 0 1px 0 rgba(255,255,255,.35)` : 'inset 0 1px 0 rgba(255,255,255,.9), 0 2px 8px rgba(10,60,88,.05)',
                  transition: 'background-color .2s, box-shadow .2s',
                  '&:hover': { bgcolor: active ? `${x.color}D9` : 'rgba(255,255,255,.7)' },
                  '&:focus-visible': { outline: `2px solid ${x.color}`, outlineOffset: 2 },
                }}
              >
                <Box aria-hidden sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center', color: active ? '#fff' : x.color, '& svg': { fontSize: 21 } }}>
                  {x.icon}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{t(`mgmt.tab.${x.key}`)}</Typography>
                  <Typography sx={{ fontSize: 11, opacity: active ? 0.85 : 0.7, lineHeight: 1.3, display: { xs: 'none', md: 'block' } }}>{t(`mgmt.tab.${x.key}Hint`)}</Typography>
                </Box>
              </ButtonBase>
            );
          })}
        </Stack>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <DateField label={t('mgmt.from')} value={draft[0]} onChange={(e) => setDraft(([, b]) => [e.target.value, b])} sx={{ width: 170, '& .MuiOutlinedInput-root': { borderRadius: '999px', bgcolor: 'rgba(255,255,255,.8)' } }} />
          <DateField label={t('mgmt.to')} value={draft[1]} onChange={(e) => setDraft(([a]) => [a, e.target.value])} sx={{ width: 170, '& .MuiOutlinedInput-root': { borderRadius: '999px', bgcolor: 'rgba(255,255,255,.8)' } }} />
          <Button variant="contained" disableElevation disabled={!valid} onClick={() => (setDefaulted(false), setPeriod(draft))} sx={{ borderRadius: '999px', px: 2.5, height: 38, bgcolor: md.navy, fontWeight: 700, '&:hover': { bgcolor: md.navyDeep } }}>
            {t('mgmt.refresh')}
          </Button>
        </Stack>
      </Stack>

      <ErrorMessage messageKey={error} />
      {tab === 'overview' && <OverviewTab from={period[0]} to={period[1]} overview={overview} />}
      {tab === 'finance' && finance && <FinanceTab from={period[0]} to={period[1]} overview={overview} />}
      {(tab === 'housing' || tab === 'tasks') && (
        <Alert severity="info" sx={{ borderRadius: '12px' }}>
          {t(tab === 'housing' ? 'mgmt.phase2' : 'mgmt.phase3')}
        </Alert>
      )}
    </Box>
  );
}
