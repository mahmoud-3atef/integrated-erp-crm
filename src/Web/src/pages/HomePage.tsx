import AddIcon from '@mui/icons-material/Add';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Alert, Box, Button, ButtonBase, Skeleton, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, type NamedCount, type OperationsDashboard, type WorkforceDashboard } from '../api/dashboard';
import { housingApi, type HousingOverview } from '../api/housing';
import { useSession } from '../app/session';
import { Columns, Ring } from '../components/charts';
import { card, KpiCard, num, placementTone, wf } from '../components/designKit';
import type { Placement } from '../api/workforce';
import { companyName } from './ChooseCompanyPage';

const fmt = (n: number) => n.toLocaleString('en-US');
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

/** A white card with its title, a line under it and an optional link (the shared look, components/designKit). */
function Card({ title, subtitle, link, children, sx }: { title: string; subtitle?: string; link?: { label: string; to: string }; children: ReactNode; sx?: object }) {
  const navigate = useNavigate();
  return (
    <Box component="section" sx={{ ...card, p: 2.5, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, ...sx } as SxProps<Theme>}>
      <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" sx={{ m: 0, fontSize: 15, fontWeight: 700, color: wf.navy }}>
            {title}
          </Typography>
          {subtitle && <Typography sx={{ fontSize: 12.5, color: wf.textSecondary }}>{subtitle}</Typography>}
        </Box>
        {link && (
          <Button size="small" endIcon={<ArrowOutwardIcon sx={{ fontSize: '15px !important' }} />} onClick={() => navigate(link.to)} sx={{ fontSize: 12.5, color: wf.navy }}>
            {link.label}
          </Button>
        )}
      </Stack>
      {children}
    </Box>
  );
}

/** Shares as plain bars: the name, the count and its share; «not set» in grey (missing data to complete, not a category). */
function ShareBars({ items, total, onClick }: { items: { key: string; label: string; value: number; unknown?: boolean }[]; total: number; onClick?: (key: string) => void }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <Stack spacing={1.25}>
      {items.map((item) => (
        <Box
          key={item.key}
          component={onClick ? ButtonBase : 'div'}
          onClick={onClick ? () => onClick(item.key) : undefined}
          sx={{ display: 'block', width: '100%', textAlign: 'start', borderRadius: '6px' }}
        >
          <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1, mb: 0.5, fontSize: 13 }}>
            <Typography noWrap title={item.label} sx={{ flex: 1, fontSize: 13, color: item.unknown ? wf.textSecondary : wf.text, fontStyle: item.unknown ? 'italic' : 'normal' }}>
              {item.label}
            </Typography>
            <Typography sx={{ ...num, fontSize: 13, fontWeight: 700, color: wf.navy } as SxProps<Theme>}>{fmt(item.value)}</Typography>
            <Typography sx={{ ...num, fontSize: 12, color: wf.textSecondary, minWidth: 34, textAlign: 'end' } as SxProps<Theme>}>{pct(item.value, total)}</Typography>
          </Stack>
          <Box sx={{ height: 8, borderRadius: 4, bgcolor: wf.subtle, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${(item.value / max) * 100}%`, borderRadius: 4, bgcolor: item.unknown ? '#A3AEB8' : wf.navy }} />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

/** One number of the month with its change from the month before: an arrow and words, in a neutral colour (a rise is not «good» by itself). */
function MonthFigure({ label, value, before, beforeLabel, onClick }: { label: string; value: number; before?: number; beforeLabel?: string; onClick?: () => void }) {
  const { t } = useTranslation();
  const delta = before === undefined ? null : value - before;
  return (
    <ButtonBase
      onClick={onClick}
      disabled={!onClick}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'start', gap: 0.25, p: 1.75, borderRadius: wf.radius, border: `1px solid ${wf.border}`, '&:hover': onClick ? { borderColor: wf.navy } : undefined }}
    >
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: wf.textSecondary }}>{label}</Typography>
      <Typography sx={{ ...num, fontSize: 26, fontWeight: 700, color: wf.navy, lineHeight: 1.2 } as SxProps<Theme>}>{fmt(value)}</Typography>
      {delta !== null && (
        <Typography sx={{ ...num, fontSize: 12, fontWeight: 600, color: wf.textSecondary } as SxProps<Theme>}>
          {delta === 0 ? t('home.delta.same', { month: beforeLabel }) : t(delta > 0 ? 'home.delta.up' : 'home.delta.down', { n: fmt(Math.abs(delta)), month: beforeLabel })}
        </Typography>
      )}
    </ButtonBase>
  );
}

/**
 * The home page: where the workers are, how they move, the documents waiting, housing and data checks. Laid out as the
 * proposal of 2026-10-24 in the system's shared look: a plain header (no coloured band), the figures in white cards,
 * shares as plain bars, no counting animation (the numbers show as they are) and skeletons while loading. Every figure
 * comes from its module's dashboard request, as before.
 */
export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { me, can } = useSession();
  const ar = i18n.language === 'ar';
  const seeWorkforce = can('workforce.workers.view', true);
  const seeOperations = can('operations.delivery.view', true);
  const seeHousing = can('housing.view', true);
  const [workforce, setWorkforce] = useState<WorkforceDashboard | null>(null);
  const [operations, setOperations] = useState<OperationsDashboard | null>(null);
  const [housing, setHousing] = useState<HousingOverview | null>(null);

  useEffect(() => {
    if (seeWorkforce) dashboardApi.workforce().then(setWorkforce).catch(() => setWorkforce(null));
    if (seeOperations) dashboardApi.operations().then(setOperations).catch(() => setOperations(null));
    if (seeHousing) housingApi.overview().then(setHousing).catch(() => setHousing(null));
  }, [seeWorkforce, seeOperations, seeHousing]);

  const now = new Date();
  const greeting = t(now.getHours() < 12 ? 'home.morning' : 'home.evening');
  const gregorian = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  const hijri = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-GB-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  const name = (n: NamedCount) => (ar ? n.nameAr : n.nameEn);
  const monthLabel = (iso: string, long = false) =>
    new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: long ? 'long' : 'short', ...(!long && iso.slice(5, 7) === '01' ? { year: '2-digit' } : {}), timeZone: 'UTC' }).format(new Date(iso));

  const p = workforce?.placements ?? {};
  const onJob = p.Working ?? 0;
  const available = (p.Housing ?? 0) + (p.New ?? 0);
  const active = workforce?.active ?? 0;
  const where = Object.entries(p)
    .filter(([key]) => key !== 'Exited' && key !== 'Absconded')
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value, color: wf[placementTone[key as Placement] ?? 'neutral'].fg }));
  const occupancy = housing && housing.totals.capacity > 0 ? (housing.totals.occupied / housing.totals.capacity) * 100 : 0;
  const waiting = operations ? [operations.deliveries, operations.returns, operations.transfers].reduce((sum, d) => sum + d.preparing + d.inApproval, 0) : 0;
  const kindIcon = { delivery: <LocalShippingOutlinedIcon />, return: <KeyboardReturnOutlinedIcon />, transfer: <SwapHorizIcon /> };
  const kindPath = { delivery: 'delivery-orders', return: 'return-orders', transfer: 'transfer-orders' };
  const statusLabel = (kind: string, status: string) =>
    kind === 'delivery' ? t(`operations.status.${status}`) : kind === 'return' ? t(`operations.return.status.${status}`) : t(`operations.transfer.status.${status}`);
  const ago = (iso: string) => {
    const minutes = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
    const rtf = new Intl.RelativeTimeFormat(ar ? 'ar' : 'en', { numeric: 'auto' });
    return minutes < 60 ? rtf.format(-minutes, 'minute') : minutes < 1440 ? rtf.format(-Math.round(minutes / 60), 'hour') : rtf.format(-Math.round(minutes / 1440), 'day');
  };
  const moves = workforce?.moves ?? [];
  const thisMonth = moves.at(-1);
  const lastMonth = moves.at(-2);
  const shares = (list: NamedCount[]) => list.map((x, i) => ({ key: x.code ?? `x${i}`, label: name(x), value: x.count, unknown: x.code === null }));
  const loadingWorkforce = seeWorkforce && !workforce;

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" component="header" sx={{ flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" sx={{ m: 0, fontSize: 23, fontWeight: 700, color: wf.navy, lineHeight: 1.3 }}>
            {greeting}{ar ? '، ' : ', '}{me.displayName}
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 13, color: wf.textSecondary }}>
            {[me.company ? companyName(me.company, i18n.language) : null, gregorian, hijri].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        {can('operations.delivery.create', true) && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/operations/delivery-orders/new')} sx={{ borderRadius: wf.control, height: 40, bgcolor: wf.navy, boxShadow: 'none', '&:hover': { bgcolor: wf.navyHover, boxShadow: 'none' } }}>
            {t('operations.delivery.new')}
          </Button>
        )}
      </Stack>

      {me.permissions.length === 0 && <Alert severity="info">{t('home.noPermissions')}</Alert>}

      {seeWorkforce && (
        <Box component="section" aria-label={t('home.figures')} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
          <KpiCard label={t('home.stats.active')} loading={loadingWorkforce} value={workforce && fmt(active)} sub={t('home.stats.activeFoot')} onClick={() => navigate('/workforce/workers')} />
          <KpiCard
            label={t('home.stats.onJob')}
            loading={loadingWorkforce}
            value={workforce && fmt(onJob)}
            sub={t('home.stats.share', { percent: active ? Math.round((onJob / active) * 100) : 0 })}
            onClick={() => navigate('/workforce/workers?status=Working')}
          />
          <KpiCard label={t('home.stats.available')} loading={loadingWorkforce} value={workforce && fmt(available)} sub={t('home.stats.availableFoot')} onClick={() => navigate('/workforce/workers?status=Housing')} />
          <KpiCard label={t('home.stats.projects')} loading={loadingWorkforce} value={workforce && fmt(workforce.projectsWithWorkers)} sub={t('home.stats.projectsFoot')} onClick={() => navigate('/commercial/projects')} />
        </Box>
      )}

      {loadingWorkforce && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 2 }}>
          <Skeleton variant="rounded" height={280} sx={{ borderRadius: wf.radius }} />
          <Skeleton variant="rounded" height={280} sx={{ borderRadius: wf.radius }} />
        </Box>
      )}

      {seeWorkforce && workforce && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '5fr 7fr' }, gap: 2 }}>
            <Card title={t('home.where.title')} subtitle={t('home.where.count', { n: fmt(active), subtitle: t('home.where.subtitle') })} link={{ label: t('home.open'), to: '/workforce/workers' }}>
              <Box
                role="img"
                aria-label={where.map((w) => `${t(`workforce.placement.${w.key}`)} ${fmt(w.value)}`).join('، ')}
                sx={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', gap: '2px', bgcolor: wf.subtle }}
              >
                {active > 0 && where.map((w) => <Box key={w.key} sx={{ width: `${Math.max(0.6, (w.value / active) * 100)}%`, bgcolor: w.color }} />)}
              </Box>
              <Stack>
                {where.map((w) => (
                  <ButtonBase
                    key={w.key}
                    onClick={() => navigate(`/workforce/workers?status=${w.key}`)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1, px: 0.5, borderTop: `1px solid ${wf.subtle}`, textAlign: 'start', '&:hover': { bgcolor: wf.rowHover } }}
                  >
                    <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: w.color }} />
                    <Typography sx={{ flex: 1, fontSize: 13.5, color: wf.text }}>{t(`workforce.placement.${w.key}`)}</Typography>
                    <Typography sx={{ ...num, fontSize: 13.5, fontWeight: 700, color: wf.navy, minWidth: 56, textAlign: 'end' } as SxProps<Theme>}>{fmt(w.value)}</Typography>
                    <Typography sx={{ ...num, fontSize: 12.5, color: wf.textSecondary, minWidth: 40, textAlign: 'end' } as SxProps<Theme>}>{pct(w.value, active)}</Typography>
                  </ButtonBase>
                ))}
              </Stack>
              {(p.Exited ?? 0) + (p.Absconded ?? 0) > 0 && (
                <Typography sx={{ fontSize: 12.5, color: wf.textSecondary }}>{t('home.where.gone', { exited: p.Exited ?? 0, absconded: p.Absconded ?? 0 })}</Typography>
              )}
            </Card>
            <Card title={t('home.moves.title')} subtitle={t('home.moves.subtitle')}>
              {thisMonth && (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
                  <MonthFigure
                    label={`${t('home.moves.starts')} · ${monthLabel(thisMonth.month, true)}`}
                    value={thisMonth.workStarts}
                    before={lastMonth?.workStarts}
                    beforeLabel={lastMonth && monthLabel(lastMonth.month, true)}
                  />
                  <MonthFigure
                    label={`${t('home.moves.returns')} · ${monthLabel(thisMonth.month, true)}`}
                    value={thisMonth.returns}
                    before={lastMonth?.returns}
                    beforeLabel={lastMonth && monthLabel(lastMonth.month, true)}
                  />
                </Box>
              )}
              <Stack direction="row" sx={{ gap: 2 }}>
                {[
                  { color: wf.navy, label: t('home.moves.starts') },
                  { color: wf.gold, label: t('home.moves.returns') },
                ].map((s) => (
                  <Stack key={s.label} direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: s.color }} />
                    <Typography sx={{ fontSize: 12.5, color: wf.textSecondary }}>{s.label}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Columns
                categories={moves.map((m) => monthLabel(m.month))}
                series={[
                  { key: 'starts', label: t('home.moves.starts'), color: wf.navy },
                  { key: 'returns', label: t('home.moves.returns'), color: wf.gold },
                ]}
                values={[moves.map((m) => m.workStarts), moves.map((m) => m.returns)]}
              />
            </Card>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 2 }}>
            <Card title={t('home.projects.title')} subtitle={t('home.projects.subtitle', { count: workforce.projectsWithWorkers })} link={{ label: t('home.open'), to: '/commercial/projects' }}>
              <ShareBars total={onJob} items={workforce.projects.map((x) => ({ key: x.code ?? x.nameEn, label: name(x), value: x.count }))} />
            </Card>
            <Card title={t('home.nationalities.title')} subtitle={t('home.nationalities.subtitle')}>
              <ShareBars total={active} items={shares(workforce.nationalities)} />
            </Card>
            <Card title={t('home.professions.title')} subtitle={t('home.professions.subtitle')} sx={{ gridColumn: { md: '1 / -1', xl: 'auto' } }}>
              <ShareBars total={active} items={shares(workforce.professions)} />
            </Card>
          </Box>
        </>
      )}

      {seeOperations && !operations && <Skeleton variant="rounded" height={200} sx={{ borderRadius: wf.radius }} />}
      {seeOperations && operations && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '4fr 3fr 5fr' }, gap: 2 }}>
          <Card title={t('home.month.title')} subtitle={new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(now)}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.25 }}>
              <MonthFigure label={t('home.month.delivered')} value={operations.deliveredThisMonth} onClick={() => navigate('/operations/delivery-orders')} />
              <MonthFigure label={t('home.month.returned')} value={operations.returnedThisMonth} onClick={() => navigate('/operations/return-orders')} />
              <MonthFigure label={t('home.month.transferred')} value={operations.transferredThisMonth} onClick={() => navigate('/operations/transfer-orders')} />
            </Box>
          </Card>
          <Card title={t('home.waiting.title')} subtitle={t('home.waiting.subtitle', { count: waiting })}>
            <Stack spacing={1}>
              {(
                [
                  ['delivery', operations.deliveries],
                  ['return', operations.returns],
                  ['transfer', operations.transfers],
                ] as const
              ).map(([kind, open]) => (
                <ButtonBase
                  key={kind}
                  onClick={() => navigate(`/operations/${kindPath[kind]}?status=${kind === 'return' ? 'approval' : 'operations'}`)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    p: 1.25,
                    borderRadius: wf.control,
                    textAlign: 'start',
                    border: `1px solid ${open.inApproval > 0 ? '#F1D9A6' : wf.border}`,
                    bgcolor: open.inApproval > 0 ? wf.warning.bg : wf.surface,
                    '&:hover': { borderColor: wf.navy },
                  }}
                >
                  <Box sx={{ display: 'grid', placeItems: 'center', color: wf.navy, '& svg': { fontSize: 19 } }}>{kindIcon[kind]}</Box>
                  <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: wf.navy }}>{t(`home.kinds.${kind}`)}</Typography>
                  <Box sx={{ textAlign: 'center', minWidth: 54 }}>
                    <Typography sx={{ ...num, fontSize: 17, fontWeight: 700, color: wf.textSecondary, lineHeight: 1 } as SxProps<Theme>}>{open.preparing}</Typography>
                    <Typography sx={{ fontSize: 11, color: wf.textSecondary }}>{t('home.waiting.preparing')}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center', minWidth: 54 }}>
                    <Typography sx={{ ...num, fontSize: 17, fontWeight: 700, color: open.inApproval > 0 ? wf.warning.fg : wf.textSecondary, lineHeight: 1 } as SxProps<Theme>}>{open.inApproval}</Typography>
                    <Typography sx={{ fontSize: 11, color: wf.textSecondary }}>{t('home.waiting.approval')}</Typography>
                  </Box>
                </ButtonBase>
              ))}
            </Stack>
          </Card>
          <Card title={t('home.recent.title')} subtitle={t('home.recent.subtitle')}>
            {operations.recent.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: wf.textSecondary, py: 3, textAlign: 'center' }}>{t('home.recent.empty')}</Typography>
            ) : (
              <Stack>
                {operations.recent.map((r) => (
                  <ButtonBase
                    key={`${r.kind}-${r.id}`}
                    onClick={() => navigate(`/operations/${kindPath[r.kind]}/${r.id}`)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1, px: 0.5, borderTop: `1px solid ${wf.subtle}`, textAlign: 'start', '&:hover': { bgcolor: wf.rowHover } }}
                  >
                    <Box sx={{ display: 'grid', placeItems: 'center', color: wf.textSecondary, '& svg': { fontSize: 18 } }}>{kindIcon[r.kind]}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: wf.navy }}>
                        <bdi dir="ltr">{r.orderNo}</bdi> · {r.title}
                      </Typography>
                      <Typography noWrap sx={{ fontSize: 12, color: wf.textSecondary }}>
                        {statusLabel(r.kind, r.status)} · {r.createdByName} · {ago(r.createdAt)}
                      </Typography>
                    </Box>
                  </ButtonBase>
                ))}
              </Stack>
            )}
          </Card>
        </Box>
      )}

      {(seeHousing || (seeWorkforce && workforce)) && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 2 }}>
          {seeHousing && housing && (
            <Card title={t('home.housing.title')} subtitle={t('home.housing.subtitle', { count: housing.totals.buildings })} link={{ label: t('home.open'), to: '/housing' }}>
              {housing.totals.capacity === 0 ? (
                <Stack sx={{ alignItems: 'center', py: 3, gap: 1.5, color: wf.textSecondary }}>
                  <Typography sx={{ fontSize: 13 }}>{t('home.housing.empty')}</Typography>
                  <Button variant="outlined" size="small" onClick={() => navigate('/housing')}>
                    {t('housing.newBuilding')}
                  </Button>
                </Stack>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: 'center', gap: 3 }}>
                  <Ring percent={occupancy} size={140} thickness={12} color={occupancy >= 95 ? wf.danger.fg : occupancy >= 80 ? wf.warning.fg : wf.navy} label={t('home.housing.occupancy')} />
                  <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25, width: '100%' }}>
                    {(
                      [
                        [t('housing.cards.capacity'), housing.totals.capacity, false],
                        [t('housing.cards.occupied'), housing.totals.occupied, false],
                        [t('housing.cards.free'), Math.max(0, housing.totals.capacity - housing.totals.occupied), false],
                        [t('housing.cards.withoutRoom'), housing.totals.withoutRoom, housing.totals.withoutRoom > 0],
                      ] as const
                    ).map(([label, value, attention]) => (
                      <Box key={label} sx={{ p: 1.5, borderRadius: wf.control, border: `1px solid ${wf.border}` }}>
                        <Typography sx={{ ...num, fontSize: 22, fontWeight: 700, color: attention ? wf.warning.fg : wf.navy, lineHeight: 1.1 } as SxProps<Theme>}>{fmt(value)}</Typography>
                        <Typography sx={{ fontSize: 12, color: wf.textSecondary }}>{label}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Stack>
              )}
            </Card>
          )}
          {seeWorkforce && workforce && (
            <Card title={t('home.quality.title')} subtitle={t('home.quality.subtitle')}>
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: 'center', gap: 3 }}>
                {workforce.checkRate !== null ? (
                  <ButtonBase onClick={() => navigate('/workforce/invoice-check')} sx={{ borderRadius: '50%' }}>
                    <Ring percent={workforce.checkRate} size={140} thickness={12} color={workforce.checkRate >= 99 ? wf.success.fg : workforce.checkRate >= 90 ? wf.navy : wf.warning.fg} label={t('home.quality.match', { month: workforce.checkMonth ? monthLabel(workforce.checkMonth) : '' })}>
                      <Typography sx={{ ...num, fontSize: 26, fontWeight: 700, color: wf.navy } as SxProps<Theme>}>{workforce.checkRate.toFixed(1)}%</Typography>
                    </Ring>
                  </ButtonBase>
                ) : (
                  <Ring percent={0} size={140} thickness={12} color={wf.border} label={t('home.quality.noCheck')}>
                    <Typography sx={{ fontSize: 24, fontWeight: 700, color: wf.textSecondary }}>—</Typography>
                  </Ring>
                )}
                <Stack spacing={1} sx={{ flex: 1, width: '100%' }}>
                  {[
                    { icon: <RuleOutlinedIcon />, label: t('home.quality.issues'), value: workforce.historyIssues, tone: wf.navy, to: '/workforce/history-issues' as string | undefined, none: false },
                    { icon: <WarningAmberOutlinedIcon />, label: t('home.quality.iqama30'), value: workforce.iqamaExpiring30, tone: wf.warning.fg, to: undefined, none: workforce.iqamaWithExpiry === 0 },
                    { icon: <WarningAmberOutlinedIcon />, label: t('home.quality.iqamaExpired'), value: workforce.iqamaExpired, tone: wf.danger.fg, to: undefined, none: workforce.iqamaWithExpiry === 0 },
                  ].map((item) => (
                    <ButtonBase
                      key={item.label}
                      disabled={!item.to}
                      onClick={() => item.to && navigate(item.to)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, borderRadius: wf.control, border: `1px solid ${wf.border}`, textAlign: 'start', '&:hover': item.to ? { borderColor: wf.navy } : undefined }}
                    >
                      <Box sx={{ display: 'grid', placeItems: 'center', color: item.value > 0 ? item.tone : wf.textSecondary, '& svg': { fontSize: 18 } }}>{item.icon}</Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: 13, color: wf.text }}>{item.label}</Typography>
                        {item.none && <Typography sx={{ fontSize: 11.5, color: wf.textSecondary }}>{t('home.quality.noExpiry')}</Typography>}
                      </Box>
                      <Typography sx={{ ...num, fontSize: 18, fontWeight: 700, color: item.value > 0 && !item.none ? item.tone : wf.textSecondary } as SxProps<Theme>}>{item.none ? '—' : fmt(item.value)}</Typography>
                    </ButtonBase>
                  ))}
                </Stack>
              </Stack>
            </Card>
          )}
        </Box>
      )}
    </Stack>
  );
}
