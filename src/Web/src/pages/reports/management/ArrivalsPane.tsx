import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import FlightLandOutlinedIcon from '@mui/icons-material/FlightLandOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import { Box, ButtonBase, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../../api/auth';
import { managementApi, type ArrivalStatus, type NewArrivals, type NewWorker } from '../../../api/management';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { DataTable, Donut, HeroTotal, md, Pill, useNumbers, VisualCard, type Column } from './mdKit';

const statusLook: Record<ArrivalStatus, { color: string; bg: string }> = {
  working: { color: md.teal, bg: md.glassHi },
  housing: { color: md.amberDeep, bg: md.glassHi },
  vacation: { color: md.greenDeep, bg: md.glassHi },
  other: { color: md.muted, bg: md.glassHi },
};

/**
 * «العمالة دخول جديد» as the old dashboard had it: the workers who joined the company in the period, where they are
 * now, how much of their time has been work, how soon they first worked, by month and by supplier (a status or a
 * supplier narrows the table).
 */
export function ArrivalsPane({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation();
  const f = useNumbers();
  const [data, setData] = useState<NewArrivals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ status?: ArrivalStatus; supplier?: string; undelivered?: boolean }>({});

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    setFilter({});
    managementApi
      .newArrivals(from, to)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errorKey(e)));
    return () => {
      live = false;
    };
  }, [from, to]);

  const rows = useMemo(
    () =>
      (data?.rows ?? []).filter(
        (r) => (!filter.status || r.status === filter.status) && (!filter.supplier || (r.supplier ?? '—') === filter.supplier) && (!filter.undelivered || r.firstWorkOn === null),
      ),
    [data, filter],
  );

  const columns = useMemo<Column<NewWorker>[]>(
    () => [
      { key: 'arrived', label: t('mgmt.arrivals.col.arrived'), render: (r) => <bdi>{r.arrivedOn}</bdi> },
      { key: 'no', label: t('mgmt.col.no'), render: (r) => <bdi>{r.workerNo}</bdi>, text: (r) => r.workerNo },
      { key: 'name', label: t('mgmt.col.worker'), render: (r) => <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 700, color: md.ink }}><bdi>{r.name}</bdi></Typography>, text: (r) => r.name },
      { key: 'supplier', label: t('mgmt.arrivals.col.supplier'), render: (r) => <bdi>{r.supplier ?? t('mgmt.arrivals.noSupplier')}</bdi>, text: (r) => r.supplier ?? '' },
      { key: 'status', label: t('mgmt.col.status'), render: (r) => <Pill {...statusLook[r.status]}>{t(`mgmt.arrivals.status.${r.status}`)}</Pill> },
      { key: 'project', label: t('mgmt.arrivals.col.project'), render: (r) => <bdi>{r.project ?? '—'}</bdi>, text: (r) => r.project ?? '' },
      { key: 'since', label: t('mgmt.arrivals.col.since'), render: (r) => t('mgmt.arrivals.days', { count: r.daysSince }), align: 'center' },
      {
        key: 'share',
        label: t('mgmt.arrivals.col.share'),
        render: (r) => (
          <Box title={t('mgmt.arrivals.shareHint', { work: r.workDays, housing: r.housingDays })} sx={{ minWidth: 120 }}>
            <Stack direction="row" sx={{ height: 6, borderRadius: 999, overflow: 'hidden', bgcolor: md.track }}>
              <Box sx={{ width: `${r.workShare}%`, bgcolor: md.teal }} />
              <Box sx={{ width: `${r.housingShare}%`, bgcolor: md.amber }} />
            </Stack>
            <Typography sx={{ fontSize: 10.5, color: md.muted }}>{t('mgmt.arrivals.shareText', { work: f.n(Math.round(r.workShare)), housing: f.n(Math.round(r.housingShare)) })}</Typography>
          </Box>
        ),
      },
      {
        key: 'first',
        label: t('mgmt.arrivals.col.first'),
        render: (r) =>
          r.firstWorkOn ? (
            <>
              <bdi>{r.firstWorkOn}</bdi>
              <Typography sx={{ fontSize: 10.5, color: md.muted }}>{t('mgmt.arrivals.after', { count: r.daysToFirstWork ?? 0 })}</Typography>
            </>
          ) : (
            <Pill color={md.red} bg="#FDEEEE">{t('mgmt.arrivals.notYet')}</Pill>
          ),
      },
    ],
    [t, f],
  );

  if (error) return <ErrorMessage messageKey={error} />;
  if (!data) {
    return (
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '260px minmax(0,1fr)' } }}>
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: '18px' }} />
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: '14px' }} />
      </Box>
    );
  }

  const share = (n: number) => (data.total ? `${f.n(Math.round((n / data.total) * 100))}%` : '—');
  const supplierTop = Math.max(1, ...data.bySupplier.map((s) => s.total));
  const monthTop = Math.max(1, ...data.byMonth.map((m) => m.count));

  return (
    <Stack sx={{ gap: 2 }}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '260px minmax(0,1fr)' } }}>
        <HeroTotal tone="blue" icon={<FlightLandOutlinedIcon />} label={t('mgmt.arrivals.total')} value={f.n(data.total)} unit={t('mgmt.unit.worker')} note={t('mgmt.arrivals.note', { from, to })} onClick={() => setFilter({})} />
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(3, minmax(0,1fr))' } }}>
          <Mini color={md.teal} icon={<WorkOutlineOutlinedIcon />} value={f.n(data.working)} label={t('mgmt.arrivals.kpi.working')} hint={t('mgmt.arrivals.ofAll', { share: share(data.working) })} onClick={() => setFilter({ status: 'working' })} />
          <Mini color={md.amberDeep} icon={<BedOutlinedIcon />} value={f.n(data.housing)} label={t('mgmt.arrivals.kpi.housing')} hint={t('mgmt.arrivals.ofAll', { share: share(data.housing) })} onClick={() => setFilter({ status: 'housing' })} />
          <Mini color="#7C5CBF" icon={<HourglassEmptyOutlinedIcon />} value={f.n(data.notDelivered)} label={t('mgmt.arrivals.kpi.notDelivered')} hint={t('mgmt.arrivals.ofAll', { share: share(data.notDelivered) })} onClick={() => setFilter({ undelivered: true })} />
          <Mini color={md.navy} icon={<BusinessCenterOutlinedIcon />} value={f.n(data.workedOnce)} label={t('mgmt.arrivals.kpi.workedOnce')} hint={t('mgmt.arrivals.ofAll', { share: share(data.workedOnce) })} />
          <Mini
            color={md.greenDeep}
            icon={<SpeedOutlinedIcon />}
            value={data.workShare === null ? '—' : `${f.n(Math.round(data.workShare))}%`}
            label={t('mgmt.arrivals.kpi.workShare')}
            hint={
              <>
                <Stack direction="row" component="span" sx={{ display: 'flex', height: 5, borderRadius: 999, overflow: 'hidden', bgcolor: md.track, my: 0.5 }}>
                  <Box component="span" sx={{ width: `${data.workShare ?? 0}%`, bgcolor: md.teal }} />
                  <Box component="span" sx={{ width: `${data.housingShare ?? 0}%`, bgcolor: md.amber }} />
                </Stack>
                {t('mgmt.arrivals.shareText', { work: f.n(Math.round(data.workShare ?? 0)), housing: f.n(Math.round(data.housingShare ?? 0)) })}
              </>
            }
          />
          <Mini color="#7C5CBF" icon={<TimerOutlinedIcon />} value={data.daysToFirstWork === null ? '—' : t('mgmt.arrivals.days', { count: Math.round(data.daysToFirstWork) })} label={t('mgmt.arrivals.kpi.toFirst')} />
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' } }}>
        <VisualCard title={t('mgmt.arrivals.bySupplier')} icon={<LocalShippingOutlinedIcon />} hint={t('mgmt.arrivals.clickToFilter')}>
          <Stack direction="row" sx={{ gap: 1.5, fontSize: 11.5, color: md.muted, mb: 1, flexWrap: 'wrap' }}>
            {(['working', 'housing', 'vacation'] as ArrivalStatus[]).map((s) => (
              <span key={s}>
                <Box component="span" sx={{ color: statusLook[s].color }}>■</Box> {t(`mgmt.arrivals.status.${s}`)}
              </span>
            ))}
          </Stack>
          <Stack sx={{ gap: 0.5, maxHeight: 300, overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {data.bySupplier.map((s) => (
              <ButtonBase
                key={s.supplier}
                onClick={() => setFilter((x) => ({ supplier: x.supplier === s.supplier ? undefined : s.supplier }))}
                sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 120px) minmax(0,1fr) 36px 58px', gap: 1, alignItems: 'center', p: 0.6, borderRadius: '8px', textAlign: 'start', bgcolor: filter.supplier === s.supplier ? md.glassHi : 'transparent' }}
              >
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: md.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <bdi>{s.supplier === '—' ? t('mgmt.arrivals.noSupplier') : s.supplier}</bdi>
                </Typography>
                <Stack direction="row" sx={{ height: 10, borderRadius: 999, overflow: 'hidden', bgcolor: md.track, width: `${(s.total / supplierTop) * 100}%`, minWidth: 8 }}>
                  <Box sx={{ flex: s.working, bgcolor: statusLook.working.color }} />
                  <Box sx={{ flex: s.housing, bgcolor: statusLook.housing.color }} />
                  <Box sx={{ flex: s.vacation, bgcolor: statusLook.vacation.color }} />
                  <Box sx={{ flex: s.other, bgcolor: 'rgba(255,255,255,.28)' }} />
                </Stack>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: md.ink, textAlign: 'end' }}>{s.total}</Typography>
                <Typography sx={{ fontSize: 11, color: md.teal, fontWeight: 700 }}>{t('mgmt.arrivals.workPct', { rate: f.n(s.workShare) })}</Typography>
              </ButtonBase>
            ))}
          </Stack>
        </VisualCard>
        <VisualCard title={t('mgmt.arrivals.statuses')} hint={t('mgmt.arrivals.clickToFilter')}>
          <Donut
            items={data.byStatus.map((s) => ({ key: s.key, label: t(`mgmt.arrivals.status.${s.key}`), value: s.count }))}
            colors={data.byStatus.map((s) => statusLook[s.key as ArrivalStatus]?.color ?? md.muted)}
            selected={filter.status}
            onSelect={(key) => setFilter((x) => ({ status: x.status === key ? undefined : (key as ArrivalStatus) }))}
            center={
              <Box>
                <Typography sx={{ fontSize: 20, fontWeight: 700, color: md.title, lineHeight: 1 }}>{f.n(data.total)}</Typography>
                <Typography sx={{ fontSize: 10.5, color: md.muted }}>{t('mgmt.unit.worker')}</Typography>
              </Box>
            }
          />
          <Typography component="h4" sx={{ fontSize: 13, fontWeight: 700, color: md.title, mt: 1.5, mb: 0.75 }}>
            {t('mgmt.arrivals.byMonth')}
          </Typography>
          <Stack sx={{ gap: 0.5 }}>
            {data.byMonth.map((m) => (
              <Box key={m.month} sx={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 40px', gap: 1, alignItems: 'center' }}>
                <Typography sx={{ fontSize: 12, color: md.text }}>
                  <bdi>{m.month}</bdi>
                </Typography>
                <Box sx={{ height: 7, borderRadius: 999, bgcolor: md.track }}>
                  <Box sx={{ height: '100%', width: `${(m.count / monthTop) * 100}%`, borderRadius: 999, background: 'linear-gradient(135deg, #22B8E6 0%, #1F5FC2 100%)' }} />
                </Box>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: md.ink, textAlign: 'end' }}>{m.count}</Typography>
              </Box>
            ))}
          </Stack>
        </VisualCard>
      </Box>

      <DataTable
        title={t('mgmt.arrivals.table')}
        badge={filter.supplier ?? (filter.status ? t(`mgmt.arrivals.status.${filter.status}`) : filter.undelivered ? t('mgmt.arrivals.kpi.notDelivered') : t('mgmt.inPeriodShort'))}
        rows={rows}
        columns={columns}
        excel={managementApi.newArrivalsExcel(from, to)}
        empty={t('mgmt.empty')}
      />
    </Stack>
  );
}

function Mini({ color, icon, value, label, hint, onClick }: { color: string; icon: ReactNode; value: ReactNode; label: string; hint?: ReactNode; onClick?: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={!onClick}
      sx={{ justifyContent: 'flex-start', alignItems: 'flex-start', gap: 1.25, p: '12px 14px', borderRadius: '14px', bgcolor: md.glass, border: `1px solid ${md.border}`, boxShadow: `inset -3px 0 0 ${color}`, textAlign: 'start' }}
    >
      <Box aria-hidden sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: `${color}1A`, color, display: 'grid', placeItems: 'center', flex: '0 0 auto', '& svg': { fontSize: 20 } }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: md.title, lineHeight: 1.2 }}>{value}</Typography>
        <Typography sx={{ fontSize: 12, color: md.label }}>{label}</Typography>
        {hint && <Typography component="div" sx={{ fontSize: 11, color, fontWeight: 600 }}>{hint}</Typography>}
      </Box>
    </ButtonBase>
  );
}
