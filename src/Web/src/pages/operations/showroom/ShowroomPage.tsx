import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenOutlinedIcon from '@mui/icons-material/FullscreenOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingBasketOutlinedIcon from '@mui/icons-material/ShoppingBasketOutlined';
import SlideshowOutlinedIcon from '@mui/icons-material/SlideshowOutlined';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import { Alert, Box, Button, ButtonBase, InputAdornment, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { photoUrl, showroomApi, type Showroom, type ShowroomWorker } from '../../../api/showroom';
import { useSession } from '../../../app/session';
import { tokens } from '../../../app/theme';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { Flag } from '../../../components/workforce/Flag';
import { ShowroomFile } from './ShowroomFile';
import { WorkerShowCard } from './WorkerShowCard';
import { initialsOf, specialtyIcon, tintOf, useShowroomText } from './showroomParts';

const rise = keyframes`from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; }`;
const appear = (i: number) => ({ animation: `${rise} .5s ${Math.min(i, 12) * 0.04}s cubic-bezier(.2,.8,.2,1) both` });
type Experience = 'all' | 'experienced' | 'hotel' | 'new';
type Sort = 'experience' | 'waiting' | 'newest';

/**
 * The showroom (docs/03-migration-plan/15): the workers in housing are the company's stock, shown as a customer should
 * see them, by specialty and nationality. «Presentation» fills the screen for a customer and the server leaves out what
 * is internal. Choosing workers ends in a list for the customer (PDF) or a delivery order.
 */
export function ShowroomPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const x = useShowroomText();
  const [params, setParams] = useSearchParams();
  const presentation = params.get('present') === '1';
  const [data, setData] = useState<Showroom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [specialty, setSpecialty] = useState<string | null | undefined>(undefined);
  const [nationality, setNationality] = useState<string | null | undefined>(undefined);
  const [experience, setExperience] = useState<Experience>('all');
  const [sort, setSort] = useState<Sort>('experience');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    showroomApi.get(presentation).then(setData).catch((f) => setError(errorKey(f)));
  }, [presentation]);

  const workers = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const list = data.workers.filter(
      (w) =>
        (specialty === undefined || (w.specialty?.code ?? null) === specialty) &&
        (nationality === undefined || w.nationalityCode === nationality) &&
        (experience === 'all' || (experience === 'new' ? w.isNew : experience === 'hotel' ? w.hotelExperience : !w.isNew)) &&
        (!q || [w.name, w.workerNo, x.name(w.specialty), ...w.skills.map(x.name), ...w.languages.map(x.name)].some((v) => v.toLowerCase().includes(q))),
    );
    const by: Record<Sort, (a: ShowroomWorker, b: ShowroomWorker) => number> = {
      experience: (a, b) => b.workDays - a.workDays,
      waiting: (a, b) => (b.daysAvailable ?? 0) - (a.daysAvailable ?? 0),
      newest: (a, b) => (a.daysAvailable ?? 0) - (b.daysAvailable ?? 0),
    };
    return [...list].sort((a, b) => Number(!!a.reservedBy) - Number(!!b.reservedBy) || by[sort](a, b));
  }, [data, specialty, nationality, experience, sort, search, x]);

  if (!can('operations.showroom.view', true)) {
    return <Alert severity="warning">{t('showroom.noAccess')}</Alert>;
  }

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const present = (on: boolean) => {
    setParams(on ? { present: '1' } : {});
    setOpen(null);
    if (on) document.documentElement.requestFullscreen?.().catch(() => undefined);
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  };
  const chosen = data?.workers.filter((w) => picked.includes(w.id)) ?? [];

  const body = (
    <Box sx={{ pb: picked.length ? 10 : 2 }}>
      {!presentation && (
        <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, mb: 1.5 }}>
          <Button variant="contained" startIcon={<SlideshowOutlinedIcon />} onClick={() => present(true)} sx={{ fontWeight: 800 }}>
            {t('showroom.present')}
          </Button>
        </Stack>
      )}
      <ErrorMessage messageKey={error} />
      {!data ? !error && <Loading /> : (
        <>
          <Hero data={data} presentation={presentation} />

          <Box sx={{ bgcolor: '#fff', borderRadius: '18px', boxShadow: tokens.shadowSm, p: { xs: 2, md: 2.5 }, mb: 2 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800, mb: 0.25 }}>{t('showroom.bySpecialty')}</Typography>
            <Typography sx={{ fontSize: 12, color: tokens.gray500, mb: 1.5 }}>{t('showroom.bySpecialtyHint')}</Typography>
            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', mb: 2.25 }}>
              {data.bySpecialty.map((s, i) => {
                const on = specialty !== undefined && specialty === s.code;
                return (
                  <ButtonBase
                    key={s.code ?? 'none'}
                    onClick={() => setSpecialty(on ? undefined : s.code)}
                    aria-pressed={on}
                    sx={{
                      ...appear(i),
                      flexDirection: 'column',
                      gap: 0.75,
                      p: 1.75,
                      borderRadius: '14px',
                      border: `1.5px solid ${on ? tokens.navy700 : tokens.gray100}`,
                      bgcolor: on ? tokens.navy50 : '#fff',
                      transition: 'all .2s',
                      '&:hover': { borderColor: tokens.navy600, transform: 'translateY(-2px)', boxShadow: tokens.shadowSm },
                    }}
                  >
                    <Box sx={{ width: 46, height: 46, borderRadius: '14px', display: 'grid', placeItems: 'center', color: on ? '#fff' : tokens.navy700, bgcolor: on ? tokens.navy700 : tokens.navy50, '& svg': { fontSize: 26 } }}>
                      {specialtyIcon(s.code)}
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'center' }}>{s.code ? x.name(s) : t('showroom.noSpecialty')}</Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#0e7c86', lineHeight: 1 }}>{s.count}</Typography>
                  </ButtonBase>
                );
              })}
            </Box>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800, mb: 1.25 }}>{t('showroom.byNationality')}</Typography>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Chip on={nationality === undefined} onClick={() => setNationality(undefined)} label={t('showroom.all')} count={data.workers.length} />
              {data.byNationality.map((n) => (
                <Chip key={n.code ?? 'none'} on={nationality !== undefined && nationality === n.code} onClick={() => setNationality(nationality === n.code ? undefined : n.code)} label={x.name(n)} count={n.count} flag={n.code} />
              ))}
            </Stack>
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, mb: 2, p: 1, bgcolor: '#fff', borderRadius: '14px', boxShadow: tokens.shadowSm }}>
            <TextField
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(presentation ? 'showroom.searchCustomer' : 'showroom.search')}
              sx={{ flex: { md: '1 1 320px' }, minWidth: 0 }}
              slotProps={{ input: { startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) } }}
            />
            <TextField select size="small" label={t('showroom.experience')} value={experience} onChange={(e) => setExperience(e.target.value as Experience)} sx={{ flex: { md: '0 0 200px' } }}>
              {(['all', 'experienced', 'hotel', 'new'] as Experience[]).map((v) => (
                <MenuItem key={v} value={v}>
                  {t(`showroom.experienceOptions.${v}`)}
                </MenuItem>
              ))}
            </TextField>
            {!presentation && (
              <TextField select size="small" label={t('showroom.sort')} value={sort} onChange={(e) => setSort(e.target.value as Sort)} sx={{ flex: { md: '0 0 200px' } }}>
                {(['experience', 'waiting', 'newest'] as Sort[]).map((v) => (
                  <MenuItem key={v} value={v}>
                    {t(`showroom.sortOptions.${v}`)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>

          <Typography sx={{ fontSize: 12.5, color: tokens.gray500, mb: 1.25 }}>{t('showroom.showing', { count: workers.length, total: data.workers.length })}</Typography>
          {workers.length === 0 ? (
            <Box sx={{ bgcolor: '#fff', borderRadius: '18px', p: 5, textAlign: 'center', color: tokens.gray500 }}>
              {data.workers.length === 0 ? t('showroom.empty') : t('showroom.noResults')}
              {data.workers.length > 0 && (
                <Box>
                  <Button sx={{ mt: 1 }} onClick={() => { setSpecialty(undefined); setNationality(undefined); setExperience('all'); setSearch(''); }}>
                    {t('showroom.clear')}
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gap: 2.25, gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
              {workers.map((w, i) => (
                <Box key={w.id} sx={appear(i)}>
                  <WorkerShowCard worker={w} presentation={presentation} selected={picked.includes(w.id)} onToggle={() => toggle(w.id)} onOpen={() => setOpen(w.id)} />
                </Box>
              ))}
            </Box>
          )}
        </>
      )}

      {chosen.length > 0 && (
        <Stack
          direction="row"
          sx={{
            position: 'fixed',
            bottom: 18,
            insetInlineStart: presentation ? 24 : { xs: 16, md: 110 },
            insetInlineEnd: 24,
            zIndex: 20,
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.25,
            borderRadius: '16px',
            color: '#fff',
            bgcolor: '#082B49',
            boxShadow: '0 16px 40px rgba(8,43,73,.35)',
            animation: `${rise} .35s cubic-bezier(.2,.8,.2,1) both`,
          }}
        >
          <ShoppingBasketOutlinedIcon />
          <Typography sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{t('showroom.basket.count', { count: chosen.length })}</Typography>
          <Stack direction="row" sx={{ display: { xs: 'none', sm: 'flex' } }}>
            {chosen.slice(0, 6).map((w) => (
              <Box key={w.id} sx={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: '2px solid #082B49', marginInlineStart: '-8px', bgcolor: tintOf(w.nationalityCode), display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>
                {w.photos[0] ? <Box component="img" src={photoUrl(w.id, w.photos[0])} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsOf(w.name)}
              </Box>
            ))}
          </Stack>
          <Typography noWrap sx={{ fontSize: 12.5, opacity: 0.75, flex: 1, display: { xs: 'none', md: 'block' } }}>
            {[...new Set(chosen.map((w) => (w.specialty ? x.name(w.specialty) : t('showroom.noSpecialty'))))].join(x.ar ? '، ' : ', ')}
          </Typography>
          <Button onClick={() => setPicked([])} sx={{ color: 'rgba(255,255,255,.75)' }}>
            {t('showroom.basket.clear')}
          </Button>
          <Button variant="outlined" startIcon={<PictureAsPdfOutlinedIcon />} onClick={() => window.open(`/operations/showroom/print?ids=${picked.join(',')}`, '_blank')} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)', whiteSpace: 'nowrap' }}>
            {t('showroom.basket.pdf')}
          </Button>
          {!presentation && can('operations.delivery.create', true) && (
            <Button
              variant="contained"
              startIcon={<LocalShippingOutlinedIcon />}
              onClick={() => navigate('/operations/delivery-orders/new', { state: { workerIds: picked } })}
              sx={{ bgcolor: '#F59E0B', fontWeight: 800, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#D97706' } }}
            >
              {t('showroom.basket.order')}
            </Button>
          )}
        </Stack>
      )}

      {open && <ShowroomFile workerId={open} presentation={presentation} selected={picked.includes(open)} onToggle={() => toggle(open)} onClose={() => setOpen(null)} />}
    </Box>
  );

  if (!presentation) return body;

  // The presentation fills the window over the menu and the top bar.
  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1200, overflow: 'auto', bgcolor: '#EEF2F7' }}>
      <Stack direction="row" sx={{ position: 'sticky', top: 0, zIndex: 5, alignItems: 'center', gap: 1.5, px: { xs: 2, md: 4 }, py: 1.5, bgcolor: '#082B49', color: '#fff', boxShadow: '0 4px 18px rgba(8,43,73,.25)' }}>
        <VerifiedOutlinedIcon sx={{ color: '#FCD34D' }} />
        <Typography sx={{ fontWeight: 800, fontSize: 16, flex: 1 }}>{t('showroom.presentTitle')}</Typography>
        <Button startIcon={<FullscreenOutlinedIcon />} onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)} sx={{ color: '#fff' }}>
          {t('showroom.fullscreen')}
        </Button>
        <Button variant="outlined" startIcon={<CloseIcon />} onClick={() => present(false)} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}>
          {t('showroom.exitPresent')}
        </Button>
      </Stack>
      <Box sx={{ px: { xs: 2, md: 4 }, py: 3, maxWidth: 1600, mx: 'auto' }}>{body}</Box>
    </Box>
  );
}

function Chip({ on, onClick, label, count, flag }: { on: boolean; onClick: () => void; label: string; count: number; flag?: string | null }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={on}
      sx={{ gap: 1, paddingInlineStart: flag === undefined ? 1.75 : 0.75, paddingInlineEnd: 1, py: 0.6, borderRadius: 99, border: `1px solid ${on ? '#082B49' : tokens.gray200}`, bgcolor: on ? '#082B49' : '#fff', color: on ? '#fff' : tokens.navy800, fontWeight: 700, fontSize: 13, transition: 'all .2s', '&:hover': { borderColor: '#082B49' } }}
    >
      {flag !== undefined && <Flag code={flag} size={24} />}
      {label}
      <Box component="span" sx={{ px: 0.9, py: 0.1, borderRadius: 99, fontSize: 12, bgcolor: on ? 'rgba(255,255,255,.2)' : tokens.gray100 }}>
        {count}
      </Box>
    </ButtonBase>
  );
}

/** The banner: what is ready now, said as sales would say it. */
function Hero({ data, presentation }: { data: Showroom; presentation: boolean }) {
  const { t } = useTranslation();
  const x = useShowroomText();
  const faces = data.workers.filter((w) => !w.reservedBy).sort((a, b) => b.photos.length - a.photos.length).slice(0, 7);
  const top = data.bySpecialty.filter((s) => s.code).slice(0, 3).map((s) => x.name(s));
  const stats: [number, string][] = [
    [data.available, t('showroom.hero.available')],
    [data.nationalities, t('showroom.hero.nationalities')],
    [data.withHotelExperience, t('showroom.hero.hotel')],
  ];
  const facts = presentation
    ? [[<BoltRoundedIcon key="a" />, t('showroom.hero.fast')], [<VerifiedOutlinedIcon key="b" />, t('showroom.hero.ready')]]
    : [
        [<BoltRoundedIcon key="a" />, t('showroom.hero.fast')],
        ...(data.oldestDays !== null ? [[<HourglassBottomOutlinedIcon key="b" />, t('showroom.hero.oldest', { count: data.oldestDays })]] : []),
        ...(data.reserved ? [[<LocalShippingOutlinedIcon key="c" />, t('showroom.hero.reserved', { count: data.reserved })]] : []),
      ];
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '22px',
        mb: 2,
        p: { xs: 2.5, md: 3.5 },
        color: '#fff',
        background: 'linear-gradient(120deg, #072d43 0%, #0d4a6c 48%, #0e7c86 100%)',
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', lg: '1.3fr 1fr' },
        alignItems: 'center',
        '&::after': { content: '""', position: 'absolute', width: 420, height: 420, borderRadius: '50%', insetInlineEnd: -120, top: -180, background: 'radial-gradient(circle, rgba(252,211,77,.18), transparent 65%)' },
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Typography component="h1" sx={{ fontSize: { xs: 24, md: 31 }, fontWeight: 800, lineHeight: 1.35 }}>
          {t('showroom.hero.title1')}{' '}
          <Box component="span" sx={{ color: '#FCD34D' }}>
            {t('showroom.hero.title2')}
          </Box>
        </Typography>
        <Typography sx={{ fontSize: 14.5, opacity: 0.85, mt: 1, mb: 2, maxWidth: 620 }}>
          {top.length ? t('showroom.hero.subtitle', { specialties: top.join(x.ar ? '، ' : ', '), count: data.nationalities }) : t('showroom.hero.subtitleNone')}
        </Typography>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2.25 }}>
          {facts.map(([icon, text], i) => (
            <Stack key={i} direction="row" sx={{ alignItems: 'center', gap: 0.75, px: 1.5, py: 0.7, borderRadius: 99, fontSize: 13, fontWeight: 600, bgcolor: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', '& svg': { fontSize: 17, color: '#FCD34D' } }}>
              {icon}
              {text}
            </Stack>
          ))}
        </Stack>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          {faces.map((w, i) => (
            <Box
              key={w.id}
              title={w.name}
              sx={{ width: 46, height: 46, borderRadius: '50%', overflow: 'hidden', border: '3px solid #0d4a6c', marginInlineStart: i ? '-12px' : 0, bgcolor: tintOf(w.nationalityCode), display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, boxShadow: '0 4px 10px rgba(0,0,0,.2)' }}
            >
              {w.photos[0] ? <Box component="img" src={photoUrl(w.id, w.photos[0])} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsOf(w.name)}
            </Box>
          ))}
          {data.workers.length > faces.length && (
            <Box sx={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid #0d4a6c', marginInlineStart: '-12px', bgcolor: '#fff', color: tokens.navy800, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>
              +{data.workers.length - faces.length}
            </Box>
          )}
        </Stack>
      </Box>
      <Box sx={{ position: 'relative', zIndex: 1, display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {stats.map(([value, label], i) => (
          <Box key={label} sx={{ ...appear(i + 1), textAlign: 'center', py: 2.25, px: 1, borderRadius: '18px', bgcolor: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', backdropFilter: 'blur(8px)' }}>
            <Typography sx={{ fontSize: { xs: 30, md: 40 }, fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
            <Stack direction="row" sx={{ justifyContent: 'center', alignItems: 'center', gap: 0.4, fontSize: 12.5, opacity: 0.85 }}>
              {i === 2 && <StarRoundedIcon sx={{ fontSize: 15, color: '#FCD34D' }} />}
              {label}
            </Stack>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function Loading() {
  return (
    <Stack sx={{ gap: 2 }}>
      <Skeleton variant="rounded" height={230} sx={{ borderRadius: '22px' }} />
      <Skeleton variant="rounded" height={210} sx={{ borderRadius: '18px' }} />
      <Box sx={{ display: 'grid', gap: 2.25, gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={480} sx={{ borderRadius: '18px' }} />
        ))}
      </Box>
    </Stack>
  );
}
