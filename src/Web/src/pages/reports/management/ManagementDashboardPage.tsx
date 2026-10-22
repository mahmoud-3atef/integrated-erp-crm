import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import { Alert, Box, Button, ButtonBase, Stack, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { managementApi } from '../../../api/management';
import type { Overview } from '../../../api/reports';
import { useSession } from '../../../app/session';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { DateField } from '../../../components/DateField';
import { LiveProvider, useFreshKey, useLiveTick } from '../../../components/live';
import { presetRange } from '../reportKit';
import { FinanceTab } from './FinanceTab';
import { md, NightSky } from './mdKit';
import { OverviewTab } from './OverviewTab';
import { TasksTab } from './TasksTab';

type Tab = 'overview' | 'finance' | 'housing' | 'tasks';

// As the old page did, finance (and housing) open from the first month the reports read invoices (Reports:FinanceFrom)
// while the period is still the default month.
const financeFrom = '2026-06-01';

/** Each tab's colour, as the old page tinted its active tab (navy, teal, brown, green). */
const tabs: { key: Tab; icon: ReactNode; color: string }[] = [
  { key: 'overview', icon: <SpeedOutlinedIcon />, color: md.blue },
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
  const navigate = useNavigate();
  const { can } = useSession();
  const [tab, setTab] = useState<Tab>('overview');
  const [draft, setDraft] = useState<[string, string]>(() => presetRange('month'));
  const [period, setPeriod] = useState<[string, string]>(draft);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [defaulted, setDefaulted] = useState(true);
  const allowed = can('reports.management.view', true);
  const finance = can('billing.invoices.view', true);
  // Live (the user's request, 2026-10-22): any saved change refreshes the open tab quietly, without a reload.
  const tick = useLiveTick();
  const fresh = useFreshKey(`${period[0]}|${period[1]}`);

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    if (fresh()) setOverview(null);
    setError(null);
    managementApi
      .overview(period[0], period[1])
      .then((o) => live && setOverview(o))
      .catch((e) => live && setError(errorKey(e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, allowed, tick]);

  if (!allowed) return <Alert severity="warning">{t('mgmt.noAccess')}</Alert>;
  const shown = tabs.filter((x) => x.key !== 'finance' || finance);
  const valid = draft[0] && draft[1] && draft[0] <= draft[1];

  return (
    <NightSky>
      {/* The tabs and the period on a glass strip; each tab a translucent glass pill, the active one tinted with its colour. */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        sx={{
          gap: 1,
          alignItems: { md: 'center' },
          justifyContent: 'space-between',
          p: '6px 8px',
          mb: 1.75,
          borderRadius: '16px',
          bgcolor: md.glass,
          border: `1px solid ${md.border}`,
          backdropFilter: 'blur(14px) saturate(160%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 10px 30px rgba(0,0,0,.25)',
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
                  // «السكن» opens the housing report already built, the showroom (the user's choice): no second one.
                  if (x.key === 'housing') {
                    navigate('/housing/showroom');
                    return;
                  }
                  setTab(x.key);
                  if (x.key === 'finance' && defaulted) {
                    const next: [string, string] = [financeFrom, period[1]];
                    setDefaulted(false);
                    setDraft(next);
                    setPeriod(next);
                  }
                }}
                sx={{
                  gap: 0.75,
                  minHeight: 40,
                  ps: 0.75,
                  pe: 1.75,
                  borderRadius: '14px',
                  textAlign: 'start',
                  color: active ? '#fff' : md.text,
                  bgcolor: active ? `color-mix(in srgb, ${x.color} 55%, transparent)` : 'rgba(255,255,255,.05)',
                  border: `1px solid ${active ? x.color : md.border}`,
                  backdropFilter: 'blur(10px) saturate(150%)',
                  boxShadow: active ? `0 0 22px color-mix(in srgb, ${x.color} 45%, transparent), inset 0 1px 0 rgba(255,255,255,.2)` : 'inset 0 1px 0 rgba(255,255,255,.06)',
                  transition: 'background-color .2s, box-shadow .2s',
                  '&:hover': { bgcolor: active ? `color-mix(in srgb, ${x.color} 65%, transparent)` : md.glassHi },
                  '&:focus-visible': { outline: `2px solid ${x.color}`, outlineOffset: 2 },
                }}
              >
                <Box aria-hidden sx={{ width: 26, height: 26, display: 'grid', placeItems: 'center', color: active ? '#fff' : x.color, '& svg': { fontSize: 19 } }}>
                  {x.icon}
                </Box>
                <Box>
                  <Typography title={t(`mgmt.tab.${x.key}Hint`)} sx={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{t(`mgmt.tab.${x.key}`)}</Typography>
                </Box>
              </ButtonBase>
            );
          })}
        </Stack>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <DateField pickOnly label={t('mgmt.from')} value={draft[0]} onChange={(e) => setDraft(([, b]) => [e.target.value, b])} size="small" sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: '999px' } }} />
          <DateField pickOnly label={t('mgmt.to')} value={draft[1]} onChange={(e) => setDraft(([a]) => [a, e.target.value])} size="small" sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: '999px' } }} />
          <Button variant="contained" disableElevation disabled={!valid} onClick={() => (setDefaulted(false), setPeriod(draft))} sx={{ borderRadius: '999px', px: 2.25, height: 34, bgcolor: md.glow, color: md.sky, fontWeight: 700, boxShadow: '0 0 18px rgba(45,212,191,.4)', '&:hover': { bgcolor: '#7FF0DE' } }}>
            {t('mgmt.refresh')}
          </Button>
        </Stack>
      </Stack>

      <ErrorMessage messageKey={error} />
      <LiveProvider tick={tick}>
        {tab === 'overview' && <OverviewTab from={period[0]} to={period[1]} overview={overview} />}
        {tab === 'finance' && finance && <FinanceTab from={period[0]} to={period[1]} overview={overview} />}
        {tab === 'tasks' && <TasksTab from={period[0]} to={period[1]} />}
      </LiveProvider>
    </NightSky>
  );
}
