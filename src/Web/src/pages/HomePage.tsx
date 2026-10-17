import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Alert, Box, Button, ButtonBase, Skeleton, Stack, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, type NamedCount, type OperationsDashboard, type WorkforceDashboard } from '../api/dashboard';
import { housingApi, type HousingOverview } from '../api/housing';
import { useSession } from '../app/session';
import { tokens } from '../app/theme';
import { Columns, CountUp, Donut, Legend, palette, RankedBars, Ring, type Slice } from '../components/charts';
import { companyName } from './ChooseCompanyPage';

const rise = keyframes`from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; }`;
const float = keyframes`0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); }`;

const placementColors: Record<string, string> = {
  Working: '#23a455',
  Housing: '#0d4a6c',
  New: '#2bc3e1',
  Vacation: '#d98a06',
  Suspended: '#e0607e',
  Absconded: '#e03434',
  Exited: '#8aa1b1',
  Other: '#7b5cd6',
};

/** A white dashboard card with a title, an optional link, and a staggered entrance. */
function Card({ title, subtitle, icon, link, delay = 0, children, sx }: { title: string; subtitle?: string; icon: ReactNode; link?: { label: string; to: string }; delay?: number; children: ReactNode; sx?: object }) {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        bgcolor: '#fff',
        borderRadius: `${tokens.radiusLg}px`,
        boxShadow: tokens.shadowSm,
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        animation: `${rise} .55s ${delay}s cubic-bezier(.2,.8,.2,1) both`,
        transition: 'box-shadow .2s',
        '&:hover': { boxShadow: tokens.shadowMd },
        ...sx,
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, mb: 2 }}>
        <Box sx={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: '11px', bgcolor: tokens.navy50, color: tokens.navy700, '& svg': { fontSize: 20 } }}>{icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800 }}>{title}</Typography>
          {subtitle && <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{subtitle}</Typography>}
        </Box>
        {link && (
          <Button size="small" endIcon={<ArrowOutwardIcon sx={{ fontSize: '15px !important' }} />} onClick={() => navigate(link.to)} sx={{ fontSize: 12.5 }}>
            {link.label}
          </Button>
        )}
      </Stack>
      {children}
    </Box>
  );
}

/** A glass tile on the hero banner. */
function HeroStat({ label, value, foot, icon, onClick }: { label: string; value: ReactNode; foot?: string; icon: ReactNode; onClick?: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={!onClick}
      sx={{
        display: 'block',
        textAlign: 'start',
        p: 2,
        borderRadius: '16px',
        bgcolor: 'rgba(255,255,255,.1)',
        border: '1px solid rgba(255,255,255,.16)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        transition: 'background-color .2s, transform .2s',
        '&:hover': onClick ? { bgcolor: 'rgba(255,255,255,.18)', transform: 'translateY(-2px)' } : undefined,
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.75, opacity: 0.85, '& svg': { fontSize: 18 } }}>
        {icon}
        <Typography sx={{ fontSize: 12.5 }}>{label}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
      {foot && <Typography sx={{ fontSize: 11.5, opacity: 0.75, mt: 0.25 }}>{foot}</Typography>}
    </ButtonBase>
  );
}

/** A coloured number tile (this month's movements). */
function MoveTile({ label, value, icon, color, onClick }: { label: string; value: number; icon: ReactNode; color: string; onClick?: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{ display: 'block', textAlign: 'start', p: 1.75, borderRadius: '14px', bgcolor: `${color}12`, border: `1px solid ${color}26`, transition: 'transform .15s', '&:hover': { transform: 'translateY(-2px)' } }}
    >
      <Box sx={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: '10px', bgcolor: color, color: '#fff', mb: 1, '& svg': { fontSize: 19 } }}>{icon}</Box>
      <Typography sx={{ fontSize: 26, fontWeight: 800, color: tokens.navy800, lineHeight: 1.1 }}>
        <CountUp value={value} />
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>{label}</Typography>
    </ButtonBase>
  );
}

/** The management dashboard: where the workers are, how they move, the documents waiting, housing and data checks. */
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
  const hour = now.getHours();
  const greeting = t(hour < 12 ? 'home.morning' : 'home.evening');
  const gregorian = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  const hijri = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-GB-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  const name = (n: NamedCount) => (ar ? n.nameAr : n.nameEn);
  const monthLabel = (iso: string) =>
    new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'short', ...(iso.slice(5, 7) === '01' ? { year: '2-digit' } : {}), timeZone: 'UTC' }).format(new Date(iso));

  const p = workforce?.placements ?? {};
  const onJob = p.Working ?? 0;
  const available = (p.Housing ?? 0) + (p.New ?? 0);
  const placementSlices: Slice[] = Object.entries(p)
    .filter(([key]) => key !== 'Exited' && key !== 'Absconded')
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, label: t(`workforce.placement.${key}`), value, color: placementColors[key] ?? palette[7]! }));
  const nationalitySlices: Slice[] = (workforce?.nationalities ?? []).map((n, i) => ({ key: n.code ?? `x${i}`, label: name(n), value: n.count, color: palette[i % palette.length]! }));
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

  return (
    <Stack spacing={`${tokens.gap + 4}px`}>
      {/* Hero: greeting, today's date in both calendars, and the headline numbers. */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '24px',
          p: { xs: 2.5, md: 3.5 },
          color: '#fff',
          background: `linear-gradient(125deg, ${tokens.navy900} 0%, ${tokens.navy700} 45%, ${tokens.teal} 100%)`,
          boxShadow: tokens.shadowMd,
          animation: `${rise} .5s cubic-bezier(.2,.8,.2,1) both`,
        }}
      >
        <Box sx={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', top: -160, insetInlineEnd: -80, background: 'radial-gradient(circle, rgba(43,195,225,.35), transparent 70%)', animation: `${float} 9s ease-in-out infinite` }} />
        <Box sx={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', bottom: -120, insetInlineStart: '30%', background: 'radial-gradient(circle, rgba(255,255,255,.12), transparent 70%)', animation: `${float} 11s ease-in-out infinite reverse` }} />
        <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ position: 'relative', gap: 3, alignItems: { lg: 'center' } }}>
          <Box sx={{ flex: '0 0 auto', minWidth: 260 }}>
            <Typography sx={{ fontSize: 13.5, opacity: 0.8 }}>{greeting}</Typography>
            <Typography component="h1" sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 800, lineHeight: 1.25 }}>
              {me.displayName}
            </Typography>
            {me.company && <Typography sx={{ fontSize: 14, opacity: 0.85, mt: 0.5 }}>{companyName(me.company, i18n.language)}</Typography>}
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
              <Box sx={{ px: 1.25, py: 0.4, borderRadius: 999, bgcolor: 'rgba(255,255,255,.14)', fontSize: 12.5 }}>{gregorian}</Box>
              <Box sx={{ px: 1.25, py: 0.4, borderRadius: 999, bgcolor: 'rgba(255,255,255,.14)', fontSize: 12.5 }}>{hijri}</Box>
            </Stack>
          </Box>
          {workforce ? (
            <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
              <HeroStat label={t('home.stats.active')} value={<CountUp value={workforce.active} />} foot={t('home.stats.activeFoot')} icon={<GroupsOutlinedIcon />} onClick={() => navigate('/workforce/workers')} />
              <HeroStat
                label={t('home.stats.onJob')}
                value={<CountUp value={onJob} />}
                foot={t('home.stats.share', { percent: workforce.active ? Math.round((onJob / workforce.active) * 100) : 0 })}
                icon={<EngineeringOutlinedIcon />}
                onClick={() => navigate('/workforce/workers?status=Working')}
              />
              <HeroStat label={t('home.stats.available')} value={<CountUp value={available} />} foot={t('home.stats.availableFoot')} icon={<HotelOutlinedIcon />} onClick={() => navigate('/workforce/workers?status=Housing')} />
              <HeroStat label={t('home.stats.projects')} value={<CountUp value={workforce.projectsWithWorkers} />} foot={t('home.stats.projectsFoot')} icon={<BusinessCenterOutlinedIcon />} onClick={() => navigate('/commercial/projects')} />
            </Box>
          ) : (
            seeWorkforce && (
              <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rounded" height={104} sx={{ bgcolor: 'rgba(255,255,255,.12)', borderRadius: '16px' }} />
                ))}
              </Box>
            )
          )}
        </Stack>
      </Box>

      {me.permissions.length === 0 && <Alert severity="info">{t('home.noPermissions')}</Alert>}

      {seeWorkforce && workforce && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '5fr 7fr' }, gap: `${tokens.gap + 4}px` }}>
            <Card title={t('home.where.title')} subtitle={t('home.where.subtitle')} icon={<InsightsOutlinedIcon />} link={{ label: t('home.open'), to: '/workforce/workers' }} delay={0.05}>
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: 'center', gap: 2.5, flex: 1 }}>
                <Donut data={placementSlices} centerLabel={t('home.where.center')} />
                <Legend data={placementSlices} onClick={(key) => navigate(`/workforce/workers?status=${key}`)} />
              </Stack>
              {(p.Exited ?? 0) + (p.Absconded ?? 0) > 0 && (
                <Typography sx={{ fontSize: 12, color: tokens.gray500, mt: 1.5 }}>{t('home.where.gone', { exited: p.Exited ?? 0, absconded: p.Absconded ?? 0 })}</Typography>
              )}
            </Card>
            <Card title={t('home.moves.title')} subtitle={t('home.moves.subtitle')} icon={<HistoryOutlinedIcon />} delay={0.1}>
              <Stack direction="row" sx={{ gap: 2, mb: 1.5 }}>
                {[
                  { color: tokens.navy700, label: t('home.moves.starts') },
                  { color: tokens.gold, label: t('home.moves.returns') },
                ].map((s) => (
                  <Stack key={s.label} direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: s.color }} />
                    <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>{s.label}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Columns
                categories={workforce.moves.map((m) => monthLabel(m.month))}
                series={[
                  { key: 'starts', label: t('home.moves.starts'), color: tokens.navy700 },
                  { key: 'returns', label: t('home.moves.returns'), color: tokens.gold },
                ]}
                values={[workforce.moves.map((m) => m.workStarts), workforce.moves.map((m) => m.returns)]}
              />
            </Card>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: '5fr 4fr 3fr' }, gap: `${tokens.gap + 4}px` }}>
            <Card title={t('home.projects.title')} subtitle={t('home.projects.subtitle', { count: workforce.projectsWithWorkers })} icon={<BusinessCenterOutlinedIcon />} link={{ label: t('home.open'), to: '/commercial/projects' }} delay={0.15}>
              <RankedBars items={workforce.projects.map((x) => ({ key: x.code ?? x.nameEn, label: name(x), value: x.count }))} />
            </Card>
            <Card title={t('home.nationalities.title')} subtitle={t('home.nationalities.subtitle')} icon={<PublicOutlinedIcon />} delay={0.2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: 'center', gap: 2 }}>
                <Donut data={nationalitySlices} size={150} thickness={20} centerLabel={t('home.nationalities.center')} />
                <Legend data={nationalitySlices} />
              </Stack>
            </Card>
            <Card title={t('home.professions.title')} subtitle={t('home.professions.subtitle')} icon={<BadgeOutlinedIcon />} delay={0.25} sx={{ gridColumn: { md: '1 / -1', xl: 'auto' } }}>
              <RankedBars color={tokens.teal} items={workforce.professions.map((x, i) => ({ key: x.code ?? `x${i}`, label: name(x), value: x.count }))} />
            </Card>
          </Box>
        </>
      )}

      {seeOperations && operations && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '4fr 3fr 5fr' }, gap: `${tokens.gap + 4}px` }}>
          <Card title={t('home.month.title')} subtitle={new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(now)} icon={<InsightsOutlinedIcon />} delay={0.3}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25 }}>
              <MoveTile label={t('home.month.delivered')} value={operations.deliveredThisMonth} icon={<LocalShippingOutlinedIcon />} color={tokens.success} onClick={() => navigate('/operations/delivery-orders')} />
              <MoveTile label={t('home.month.returned')} value={operations.returnedThisMonth} icon={<KeyboardReturnOutlinedIcon />} color={tokens.warning} onClick={() => navigate('/operations/return-orders')} />
              <MoveTile label={t('home.month.transferred')} value={operations.transferredThisMonth} icon={<SwapHorizIcon />} color={tokens.info} onClick={() => navigate('/operations/transfer-orders')} />
            </Box>
          </Card>
          <Card title={t('home.waiting.title')} subtitle={t('home.waiting.subtitle', { count: waiting })} icon={<PendingActionsOutlinedIcon />} delay={0.35}>
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
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, borderRadius: '12px', bgcolor: tokens.gray50, textAlign: 'start', '&:hover': { bgcolor: tokens.navy50 } }}
                >
                  <Box sx={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: '10px', bgcolor: '#fff', color: tokens.navy700, boxShadow: tokens.shadowXs, '& svg': { fontSize: 18 } }}>{kindIcon[kind]}</Box>
                  <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: tokens.navy800 }}>{t(`home.kinds.${kind}`)}</Typography>
                  <Box sx={{ textAlign: 'center', minWidth: 54 }}>
                    <Typography sx={{ fontSize: 17, fontWeight: 800, color: tokens.gray600, lineHeight: 1 }}>{open.preparing}</Typography>
                    <Typography sx={{ fontSize: 10.5, color: tokens.gray500 }}>{t('home.waiting.preparing')}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center', minWidth: 54 }}>
                    <Typography sx={{ fontSize: 17, fontWeight: 800, color: open.inApproval > 0 ? tokens.warning : tokens.gray500, lineHeight: 1 }}>{open.inApproval}</Typography>
                    <Typography sx={{ fontSize: 10.5, color: tokens.gray500 }}>{t('home.waiting.approval')}</Typography>
                  </Box>
                </ButtonBase>
              ))}
            </Stack>
          </Card>
          <Card title={t('home.recent.title')} subtitle={t('home.recent.subtitle')} icon={<HistoryOutlinedIcon />} delay={0.4}>
            {operations.recent.length === 0 ? (
              <Stack sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', color: tokens.gray500, py: 3, gap: 1 }}>
                <HistoryOutlinedIcon sx={{ fontSize: 34, opacity: 0.6 }} />
                <Typography sx={{ fontSize: 13 }}>{t('home.recent.empty')}</Typography>
              </Stack>
            ) : (
              <Stack sx={{ position: 'relative' }}>
                <Box sx={{ position: 'absolute', top: 12, bottom: 12, insetInlineStart: 16, borderInlineStart: `2px solid ${tokens.gray100}` }} />
                {operations.recent.map((r) => (
                  <ButtonBase
                    key={`${r.kind}-${r.id}`}
                    onClick={() => navigate(`/operations/${kindPath[r.kind]}/${r.id}`)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.9, px: 0.25, borderRadius: '10px', textAlign: 'start', position: 'relative', '&:hover': { bgcolor: tokens.gray50 } }}
                  >
                    <Box sx={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: '50%', bgcolor: '#fff', border: `2px solid ${tokens.navy100}`, color: tokens.navy700, zIndex: 1, '& svg': { fontSize: 16 } }}>
                      {kindIcon[r.kind]}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>
                        <span dir="ltr">{r.orderNo}</span> · {r.title}
                      </Typography>
                      <Typography noWrap sx={{ fontSize: 11.5, color: tokens.gray500 }}>
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
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: `${tokens.gap + 4}px` }}>
          {seeHousing && housing && (
            <Card title={t('home.housing.title')} subtitle={t('home.housing.subtitle', { count: housing.totals.buildings })} icon={<ApartmentOutlinedIcon />} link={{ label: t('home.open'), to: '/housing' }} delay={0.45}>
              {housing.totals.capacity === 0 ? (
                <Stack sx={{ alignItems: 'center', py: 3, gap: 1.5, color: tokens.gray500 }}>
                  <ApartmentOutlinedIcon sx={{ fontSize: 38, opacity: 0.6 }} />
                  <Typography sx={{ fontSize: 13 }}>{t('home.housing.empty')}</Typography>
                  <Button variant="outlined" size="small" onClick={() => navigate('/housing')}>
                    {t('housing.newBuilding')}
                  </Button>
                </Stack>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: 'center', gap: 3 }}>
                  <Ring percent={occupancy} size={150} thickness={14} color={occupancy >= 95 ? tokens.danger : occupancy >= 80 ? tokens.warning : tokens.success} label={t('home.housing.occupancy')} />
                  <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25, width: '100%' }}>
                    {[
                      [t('housing.cards.capacity'), housing.totals.capacity, tokens.navy700],
                      [t('housing.cards.occupied'), housing.totals.occupied, tokens.success],
                      [t('housing.cards.free'), Math.max(0, housing.totals.capacity - housing.totals.occupied), tokens.info],
                      [t('housing.cards.withoutRoom'), housing.totals.withoutRoom, housing.totals.withoutRoom > 0 ? tokens.warning : tokens.gray500],
                    ].map(([label, value, color]) => (
                      <Box key={label as string} sx={{ p: 1.5, borderRadius: '12px', bgcolor: tokens.gray50, borderInlineStart: `3px solid ${color as string}` }}>
                        <Typography sx={{ fontSize: 22, fontWeight: 800, color: tokens.navy800, lineHeight: 1.1 }}>
                          <CountUp value={value as number} />
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: tokens.gray600 }}>{label as string}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Stack>
              )}
            </Card>
          )}
          {seeWorkforce && workforce && (
            <Card title={t('home.quality.title')} subtitle={t('home.quality.subtitle')} icon={<FactCheckOutlinedIcon />} delay={0.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: 'center', gap: 3 }}>
                {workforce.checkRate !== null ? (
                  <ButtonBase onClick={() => navigate('/workforce/invoice-check')} sx={{ borderRadius: '50%' }}>
                    <Ring percent={workforce.checkRate} size={150} thickness={14} color={workforce.checkRate >= 99 ? tokens.success : workforce.checkRate >= 90 ? tokens.teal : tokens.warning} label={t('home.quality.match', { month: workforce.checkMonth ? monthLabel(workforce.checkMonth) : '' })}>
                      <Typography sx={{ fontSize: 28, fontWeight: 800, color: tokens.navy800 }}>{workforce.checkRate.toFixed(1)}%</Typography>
                    </Ring>
                  </ButtonBase>
                ) : (
                  <Ring percent={0} size={150} thickness={14} color={tokens.gray300} label={t('home.quality.noCheck')}>
                    <Typography sx={{ fontSize: 24, fontWeight: 800, color: tokens.gray500 }}>—</Typography>
                  </Ring>
                )}
                <Stack spacing={1.25} sx={{ flex: 1, width: '100%' }}>
                  {[
                    { icon: <RuleOutlinedIcon />, label: t('home.quality.issues'), value: workforce.historyIssues, color: tokens.navy700, to: '/workforce/history-issues' },
                    { icon: <WarningAmberOutlinedIcon />, label: t('home.quality.iqama30'), value: workforce.iqamaExpiring30, color: tokens.warning, to: undefined, none: workforce.iqamaWithExpiry === 0 },
                    { icon: <WarningAmberOutlinedIcon />, label: t('home.quality.iqamaExpired'), value: workforce.iqamaExpired, color: tokens.danger, to: undefined, none: workforce.iqamaWithExpiry === 0 },
                  ].map((item) => (
                    <ButtonBase
                      key={item.label}
                      disabled={!item.to}
                      onClick={() => item.to && navigate(item.to)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, borderRadius: '12px', bgcolor: tokens.gray50, textAlign: 'start', '&:hover': item.to ? { bgcolor: tokens.navy50 } : undefined }}
                    >
                      <Box sx={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: '10px', bgcolor: `${item.color}18`, color: item.color, '& svg': { fontSize: 18 } }}>{item.icon}</Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: 13, color: tokens.gray700 }}>{item.label}</Typography>
                        {'none' in item && item.none && <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>{t('home.quality.noExpiry')}</Typography>}
                      </Box>
                      <Typography sx={{ fontSize: 18, fontWeight: 800, color: item.value > 0 ? item.color : tokens.gray500 }}>
                        {'none' in item && item.none ? '—' : <CountUp value={item.value} />}
                      </Typography>
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
