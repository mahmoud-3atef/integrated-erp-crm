import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DirectionsWalkOutlinedIcon from '@mui/icons-material/DirectionsWalkOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import VolunteerActivismOutlinedIcon from '@mui/icons-material/VolunteerActivismOutlined';
import { Box, ButtonBase, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../../api/auth';
import { managementApi, type Delivery, type EntryRow, type HousingEntries, type StartRow } from '../../../api/management';
import type { Overview } from '../../../api/reports';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { ArrivalsPane } from './ArrivalsPane';
import { BarList, DataTable, Donut, GlassStrip, HeroTotal, KpiCard, md, Pill, Rolling, Unknown, useNumbers, VisualCard, type Column } from './mdKit';

type Inner = 'delivery' | 'housing' | 'arrivals';

/** «نظرة عامة»: the six cards, then the project deliveries and the housing entries (docs/03-migration-plan/19). */
export function OverviewTab({ from, to, overview }: { from: string; to: string; overview: Overview | null }) {
  const { t } = useTranslation();
  const f = useNumbers();
  const [inner, setInner] = useState<Inner>('delivery');
  const rate = overview?.collectionRate.value ?? null;
  const k = overview;

  return (
    <Stack sx={{ gap: 2 }}>
      <GlassStrip>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' } }}>
        {!k
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rounded" height={118} sx={{ mt: '14px', borderRadius: '12px', bgcolor: 'rgba(255,255,255,.12)' }} />)
          : (
            <>
              <KpiCard glass color={md.gold} icon={<AccountTreeOutlinedIcon />} label={t('mgmt.kpi.projects')} value={<Rolling value={k.activeProjects} />} unit={t('mgmt.unit.project')} foot={t('mgmt.kpi.projectsFoot')} />
              <KpiCard glass color={md.green} icon={<HowToRegOutlinedIcon />} label={t('mgmt.kpi.onJob')} value={<Rolling value={k.onJob} />} unit={t('mgmt.unit.worker')} foot={t('mgmt.kpi.onJobFoot')} />
              <KpiCard glass color={md.amber} icon={<BedOutlinedIcon />} label={t('mgmt.kpi.housing')} value={<Rolling value={k.inHousing} />} unit={t('mgmt.unit.worker')} foot={t('mgmt.kpi.housingFoot')} />
              <KpiCard glass color={md.blue} icon={<SwapHorizOutlinedIcon />} label={t('mgmt.kpi.net')} value={<Rolling value={k.net.value ?? 0} />} foot={t('mgmt.kpi.netFoot', { starts: f.n(k.starts.value ?? 0), returns: f.n(k.returns.value ?? 0) })} />
              <KpiCard
                glass
                color={md.teal}
                icon={<DescriptionOutlinedIcon />}
                label={t('mgmt.kpi.invoiced')}
                value={k.invoiced.value === null ? <Unknown hint={t('mgmt.noFinance')} /> : <Rolling value={k.invoiced.value} decimals={2} />}
                unit={k.invoiced.value === null ? undefined : t('mgmt.unit.sar')}
                foot={t('mgmt.kpi.invoicedFoot')}
              />
              <KpiCard
                glass
                color={md.red}
                icon={<VolunteerActivismOutlinedIcon />}
                label={t('mgmt.kpi.rate')}
                value={rate === null ? <Unknown hint={k.financeVisible ? t('mgmt.noRate') : t('mgmt.noFinance')} /> : <><Rolling value={rate} decimals={1} />%</>}
                foot={t('mgmt.kpi.rateFoot')}
              />
            </>
          )}
      </Box>
      </GlassStrip>

      <Box sx={{ bgcolor: md.glass, border: `1px solid ${md.border}`, borderRadius: '18px', boxShadow: '0 1px 2px rgba(10,60,88,.05), 0 10px 26px rgba(10,60,88,.07)', p: { xs: 1.5, md: '14px' }, minWidth: 0 }}>
        <Stack direction="row" role="tablist" sx={{ gap: 3, borderBottom: `1px solid ${md.border}`, mb: 2, px: 1, overflowX: 'auto' }}>
          {(['delivery', 'housing', 'arrivals'] as Inner[]).map((key) => (
            <ButtonBase
              key={key}
              role="tab"
              aria-selected={inner === key}
              onClick={() => setInner(key)}
              sx={{
                font: 'inherit',
                fontSize: 14,
                fontWeight: 700,
                pt: 0.75,
                pb: 1.5,
                px: 0.25,
                whiteSpace: 'nowrap',
                color: inner === key ? md.navy : md.muted,
                boxShadow: inner === key ? `inset 0 -3px 0 ${md.navy}` : 'none',
              }}
            >
              {t(`mgmt.inner.${key}`)}
            </ButtonBase>
          ))}
        </Stack>
        {inner === 'delivery' && <DeliveryPane from={from} to={to} />}
        {inner === 'housing' && <HousingPane from={from} to={to} />}
        {inner === 'arrivals' && <ArrivalsPane from={from} to={to} />}
      </Box>
    </Stack>
  );
}

function useLoad<T>(load: () => Promise<T>, keys: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    load()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errorKey(e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, keys);
  return { data, error };
}

const day = (v: string | null) => (v ? v.slice(0, 10) : '—');

function PaneSkeleton() {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '210px minmax(0,1.25fr) minmax(0,1fr)' } }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} variant="rounded" height={240} sx={{ borderRadius: '14px' }} />
      ))}
    </Box>
  );
}

/** «تسليمات المشاريع»: the starts of the period by manager and by project; a manager or a project narrows the table. */
function DeliveryPane({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation();
  const f = useNumbers();
  const { data, error } = useLoad<Delivery>(() => managementApi.delivery(from, to), [from, to]);
  const [filter, setFilter] = useState<{ manager?: string; project?: string }>({});
  useEffect(() => setFilter({}), [from, to]);
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => (!filter.manager || (r.manager ?? '—') === filter.manager) && (!filter.project || (r.project ?? '—') === filter.project)), [data, filter]);
  const columns: Column<StartRow>[] = [
    { key: 'no', label: t('mgmt.col.no'), render: (r) => <bdi>{r.workerNo}</bdi>, text: (r) => r.workerNo },
    { key: 'name', label: t('mgmt.col.worker'), render: (r) => <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 700, color: md.ink }}><bdi>{r.name}</bdi></Typography>, text: (r) => r.name },
    { key: 'project', label: t('mgmt.col.project'), render: (r) => <bdi>{r.project ?? '—'}</bdi>, text: (r) => r.project ?? '' },
    { key: 'price', label: t('mgmt.col.price'), render: (r) => (r.price === null ? '—' : f.m(r.price)), align: 'end' },
    { key: 'manager', label: t('mgmt.col.manager'), render: (r) => <bdi>{r.manager ?? '—'}</bdi>, text: (r) => r.manager ?? '' },
    { key: 'start', label: t('mgmt.col.startsOn'), render: (r) => <bdi>{day(r.startsOn)}</bdi> },
    { key: 'end', label: t('mgmt.col.endsOn'), render: (r) => <bdi>{day(r.endsOn)}</bdi> },
    {
      key: 'status',
      label: t('mgmt.col.status'),
      render: (r) =>
        r.status === 'Working' ? <Pill color={md.greenDeep} bg="#E7F6EC">{t('mgmt.start.Working')}</Pill> : r.status === 'Ended' ? <Pill color={md.muted} bg="#EEF2F5">{t('mgmt.start.Ended')}</Pill> : <Pill color={md.amberDeep} bg="#FDF3E1">{t('mgmt.start.NotStarted')}</Pill>,
    },
    { key: 'days', label: t('mgmt.col.workDays'), render: (r) => <b>{f.n(r.days)}</b>, align: 'center' },
  ];

  if (error) return <ErrorMessage messageKey={error} />;
  if (!data) return <PaneSkeleton />;
  return (
    <Stack sx={{ gap: 2 }}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '210px minmax(0,1.25fr) minmax(0,1fr)' } }}>
        <HeroTotal icon={<DirectionsWalkOutlinedIcon />} label={t('mgmt.delivery.total')} value={f.n(data.total)} unit={t('mgmt.unit.worker')} note={t('mgmt.inPeriod')} onClick={() => setFilter({})} />
        <VisualCard title={t('mgmt.delivery.byManager')}>
          <Donut items={data.byManager.map((r) => ({ key: r.key, label: r.name, value: r.count }))} selected={filter.manager} onSelect={(key) => setFilter((x) => ({ manager: x.manager === key ? undefined : key }))} />
        </VisualCard>
        <VisualCard title={t('mgmt.delivery.byProject')}>
          <BarList items={data.byProject.map((r) => ({ key: r.key, label: r.name, value: r.count }))} selected={filter.project} onSelect={(key) => setFilter((x) => ({ project: x.project === key ? undefined : key }))} />
        </VisualCard>
      </Box>
      <DataTable
        title={t('mgmt.delivery.table')}
        badge={<><CalendarMonthOutlinedIcon />{filter.manager ?? filter.project ?? t('mgmt.inPeriodShort')}</>}
        rows={rows}
        columns={columns}
        excel={managementApi.deliveryExcel(from, to)}
        empty={t('mgmt.empty')}
      />
    </Stack>
  );
}

const entryLook: Record<string, { color: string; bg: string }> = {
  NewArrival: { color: '#1F78C8', bg: md.glassHi },
  ReturnedWorker: { color: md.amberDeep, bg: md.glassHi },
  BackFromVacation: { color: md.greenDeep, bg: md.glassHi },
};

/** «حركة دخول السكن»: the approved housing orders of the period, by manager, project, way in and reason. */
function HousingPane({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation();
  const f = useNumbers();
  const { data, error } = useLoad<HousingEntries>(() => managementApi.housingEntries(from, to), [from, to]);
  const [filter, setFilter] = useState<{ project?: string; entry?: string; reason?: string }>({});
  useEffect(() => setFilter({}), [from, to]);
  const rows = useMemo(
    () =>
      (data?.rows ?? []).filter(
        (r) => (!filter.project || (r.project ?? '—') === filter.project) && (!filter.entry || r.entry === filter.entry) && (!filter.reason || (r.entry === 'ReturnedWorker' && r.reason === filter.reason)),
      ),
    [data, filter],
  );
  const reason = (key: string) => t(`operations.return.reasons.${key}`, { defaultValue: key });
  const columns: Column<EntryRow>[] = [
    { key: 'name', label: t('mgmt.col.worker'), render: (r) => <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 700, color: md.ink }}><bdi>{r.name}</bdi></Typography>, text: (r) => r.name },
    { key: 'no', label: t('mgmt.col.no'), render: (r) => <bdi>{r.workerNo}</bdi>, text: (r) => r.workerNo },
    { key: 'project', label: t('mgmt.col.project'), render: (r) => <bdi>{r.project ?? '—'}</bdi>, text: (r) => r.project ?? '' },
    { key: 'manager', label: t('mgmt.col.manager'), render: (r) => <bdi>{r.manager ?? '—'}</bdi>, text: (r) => r.manager ?? '' },
    { key: 'on', label: t('mgmt.col.housingOn'), render: (r) => <bdi>{day(r.arrivedOn)}</bdi> },
    { key: 'entry', label: t('mgmt.col.entry'), render: (r) => <Pill {...(entryLook[r.entry] ?? entryLook.ReturnedWorker!)}>{t(`mgmt.entry.${r.entry}`)}</Pill> },
    { key: 'reason', label: t('mgmt.col.reason'), render: (r) => (r.entry === 'ReturnedWorker' ? reason(r.reason) : '—'), text: (r) => (r.entry === 'ReturnedWorker' ? reason(r.reason) : '') },
    { key: 'housing', label: t('mgmt.col.housing'), render: (r) => <bdi>{r.housing ?? '—'}</bdi>, text: (r) => r.housing ?? '' },
    { key: 'days', label: t('mgmt.col.days'), render: (r) => <b>{f.n(r.days)}</b>, align: 'center' },
  ];

  if (error) return <ErrorMessage messageKey={error} />;
  if (!data) return <PaneSkeleton />;
  const returned = data.byEntry.find((e) => e.key === 'ReturnedWorker')?.count ?? 0;
  return (
    <Stack sx={{ gap: 2 }}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '210px minmax(0,1.25fr) minmax(0,1fr)' } }}>
        <HeroTotal tone="housing" icon={<HomeOutlinedIcon />} label={t('mgmt.housingIn.total')} value={f.n(data.total)} unit={t('mgmt.unit.worker')} note={t('mgmt.housingIn.note')} onClick={() => setFilter({})} />
        <VisualCard title={t('mgmt.housingIn.byManager')}>
          <Donut items={data.byManager.map((r) => ({ key: r.key, label: r.name, value: r.count }))} />
        </VisualCard>
        <VisualCard title={t('mgmt.housingIn.byProject')}>
          <BarList
            fill="linear-gradient(135deg, #F7C25A 0%, #E39A0B 100%)"
            items={data.byProject.map((r) => ({ key: r.key, label: r.name, value: r.count }))}
            selected={filter.project}
            onSelect={(key) => setFilter((x) => ({ project: x.project === key ? undefined : key }))}
          />
        </VisualCard>
      </Box>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}>
        {(['NewArrival', 'ReturnedWorker', 'BackFromVacation'] as const).map((key) => {
          const count = data.byEntry.find((e) => e.key === key)?.count ?? 0;
          const look = entryLook[key]!;
          return (
            <ButtonBase
              key={key}
              onClick={() => setFilter((x) => ({ entry: x.entry === key ? undefined : key }))}
              sx={{ justifyContent: 'space-between', gap: 1, p: 1.5, borderRadius: '14px', border: `1px solid ${filter.entry === key ? look.color : md.border}`, bgcolor: md.glass, textAlign: 'start' }}
            >
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: md.ink }}>{t(`mgmt.entry.${key}`)}</Typography>
                <Typography sx={{ fontSize: 11.5, color: md.muted }}>{data.total ? `${f.n(Math.round((count / data.total) * 100))}%` : '—'}</Typography>
              </Box>
              <Typography sx={{ fontSize: 24, fontWeight: 700, color: look.color }}>{f.n(count)}</Typography>
            </ButtonBase>
          );
        })}
      </Box>

      <DataTable
        title={t('mgmt.housingIn.table')}
        badge={<><CheckCircleOutlineIcon />{t('mgmt.approved')}</>}
        rows={rows}
        columns={columns}
        excel={managementApi.housingEntriesExcel(from, to)}
        empty={t('mgmt.empty')}
        filters={
          data.reasons.length > 0 && (
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 1.25 }}>
              <ReasonChip label={t('mgmt.allReasons')} count={returned} active={!filter.reason} onClick={() => setFilter({})} />
              {data.reasons.map((r) => (
                <ReasonChip key={r.key} label={reason(r.key)} count={r.count} share={returned ? r.count / returned : 0} active={filter.reason === r.key} onClick={() => setFilter((x) => ({ reason: x.reason === r.key ? undefined : r.key }))} />
              ))}
            </Stack>
          )
        }
      />
    </Stack>
  );
}

function ReasonChip({ label, count, share, active, onClick }: { label: string; count: number; share?: number; active: boolean; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        gap: 1,
        px: 1.5,
        py: 0.75,
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 700,
        color: active ? '#fff' : md.text,
        bgcolor: active ? md.navy : md.glassHi,
        border: `1px solid ${active ? md.navy : md.border}`,
      }}
    >
      <span>{label}</span>
      <Box component="em" sx={{ fontStyle: 'normal', fontSize: 11.5, px: 0.75, borderRadius: 999, bgcolor: active ? 'rgba(255,255,255,.2)' : md.glassHi }}>
        {count}
      </Box>
      {share !== undefined && <Box aria-hidden sx={{ position: 'absolute', insetInlineStart: 0, bottom: 0, height: 3, width: `${share * 100}%`, bgcolor: md.amber }} />}
    </ButtonBase>
  );
}
