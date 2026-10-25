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
import { LightArea, md, NightSky } from './mdKit';
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
  const [preset, setPreset] = useState<'month' | 'last' | 'custom'>('month');
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
      {/*
        The tabs and the period on a white bar, as the CEO report's (the user's request, 2026-10-25): the tabs, then the
        current month, the month before, or a period from–to.
      */}
      <LightArea>
        <Stack direction="row" role="tablist" aria-label={t('mgmt.sections')} sx={{ bgcolor: '#fff', borderRadius: '16px', boxShadow: '0 1px 2px rgba(20,38,61,.06), 0 6px 18px rgba(20,38,61,.06)', border: '1px solid #E2E8F0', p: 0.75, gap: 0.5, mb: 1.75, flexWrap: 'wrap', alignItems: 'center' }}>
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
                    setPreset('custom');
                    setDraft(next);
                    setPeriod(next);
                  }
                }}
                sx={{ gap: 1, px: 2, py: 1.1, borderRadius: '10px', fontWeight: 700, fontSize: 13.5, color: active ? '#fff' : '#4a5c6c', bgcolor: active ? '#14263D' : 'transparent', '&:hover': { bgcolor: active ? '#14263D' : '#F1F5F9' }, '& svg': { fontSize: 19 } }}
              >
                {x.icon}
                {t(`mgmt.tab.${x.key}`)}
              </ButtonBase>
            );
          })}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ px: 1, fontSize: 12.5, color: '#64748B' }}>{t('mgmt.period.label')}</Typography>
          {(['month', 'last', 'custom'] as const).map((p) => (
            <ButtonBase
              key={p}
              onClick={() => {
                setPreset(p);
                setDefaulted(false);
                if (p !== 'custom') {
                  const next = presetRange(p);
                  setDraft(next);
                  setPeriod(next);
                }
              }}
              aria-pressed={preset === p}
              sx={{ px: 1.5, py: 0.75, borderRadius: 99, fontSize: 12.5, fontWeight: 700, border: `1px solid ${preset === p ? '#14263D' : '#E2E8F0'}`, bgcolor: preset === p ? '#14263D' : '#fff', color: preset === p ? '#fff' : '#14263D' }}
            >
              {t(`mgmt.period.${p}`)}
            </ButtonBase>
          ))}
          {preset === 'custom' && (
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', ps: 0.5 }}>
              <DateField pickOnly label={t('mgmt.from')} value={draft[0]} onChange={(e) => setDraft(([, b]) => [e.target.value, b])} size="small" sx={{ width: 150, '& .MuiOutlinedInput-root': { borderRadius: '999px' } }} />
              <DateField pickOnly label={t('mgmt.to')} value={draft[1]} onChange={(e) => setDraft(([a]) => [a, e.target.value])} size="small" sx={{ width: 150, '& .MuiOutlinedInput-root': { borderRadius: '999px' } }} />
              <Button variant="contained" disableElevation disabled={!valid} onClick={() => (setDefaulted(false), setPeriod(draft))} sx={{ borderRadius: '999px', px: 2.25, height: 36, bgcolor: '#14263D', color: '#fff', fontWeight: 700, '&:hover': { bgcolor: '#203B5C' } }}>
                {t('mgmt.refresh')}
              </Button>
            </Stack>
          )}
        </Stack>
      </LightArea>

      <ErrorMessage messageKey={error} />
      <LiveProvider tick={tick}>
        {tab === 'overview' && <OverviewTab from={period[0]} to={period[1]} overview={overview} />}
        {tab === 'finance' && finance && <FinanceTab from={period[0]} to={period[1]} overview={overview} />}
        {tab === 'tasks' && <TasksTab from={period[0]} to={period[1]} />}
      </LiveProvider>
    </NightSky>
  );
}
