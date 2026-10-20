import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import { Box, Button, ButtonBase, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { photoUrl, type ShowroomWorker } from '../../../api/showroom';
import { tokens } from '../../../app/theme';
import { Flag } from '../../../components/workforce/Flag';
import { initialsOf, specialtyIcon, tintOf, useShowroomText } from './showroomParts';

const gold = '#F59E0B';

/** The worker's photos (or a portrait of their initials), with arrows and dots when there are several. */
export function PhotoStage({ worker, ratio = '4 / 5', rounded = 18, children }: { worker: ShowroomWorker; ratio?: string; rounded?: number; children?: ReactNode }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const [index, setIndex] = useState(0);
  const photos = worker.photos;
  const tint = tintOf(worker.nationalityCode);
  const step = (by: number) => (e: MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i + by + photos.length) % photos.length);
  };
  return (
    <Box
      sx={{
        position: 'relative',
        aspectRatio: ratio,
        borderRadius: `${rounded}px ${rounded}px 0 0`,
        overflow: 'hidden',
        background: photos.length ? '#0f172a' : `radial-gradient(120% 90% at 50% 20%, ${tint}cc 0%, ${tint} 45%, #072d43 100%)`,
        '&:hover .stage-nav': { opacity: 1 },
        '&:hover img': { transform: 'scale(1.04)' },
      }}
    >
      {photos.length > 0 ? (
        photos.map((p, i) => (
          <Box
            key={p}
            component="img"
            src={photoUrl(worker.id, p)}
            alt={i === index ? worker.name : ''}
            loading="lazy"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', opacity: i === index ? 1 : 0, transition: 'opacity .45s ease, transform .6s ease' }}
          />
        ))
      ) : (
        <Stack sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <Box
            sx={{
              width: '46%',
              aspectRatio: '1',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(255,255,255,.14)',
              border: '2px solid rgba(255,255,255,.35)',
              color: '#fff',
              fontWeight: 800,
              fontSize: 'clamp(26px, 3.4vw, 40px)',
              letterSpacing: 1,
              backdropFilter: 'blur(2px)',
            }}
          >
            <bdi>{initialsOf(worker.name)}</bdi>
          </Box>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, color: 'rgba(255,255,255,.7)', fontSize: 11.5 }}>
            <PhotoCameraOutlinedIcon sx={{ fontSize: 15 }} />
            {t('showroom.card.noPhoto')}
          </Stack>
        </Stack>
      )}
      {photos.length > 1 && (
        <>
          <IconButton className="stage-nav" size="small" onClick={step(-1)} aria-label={t('showroom.card.previousPhoto')} sx={{ ...navSx, insetInlineStart: 8 }}>
            {rtl ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
          <IconButton className="stage-nav" size="small" onClick={step(1)} aria-label={t('showroom.card.nextPhoto')} sx={{ ...navSx, insetInlineEnd: 8 }}>
            {rtl ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </>
      )}
      {children}
      {photos.length > 1 && (
        <Stack direction="row" sx={{ position: 'absolute', top: 12, left: 0, right: 0, justifyContent: 'center', gap: 0.5, pointerEvents: 'none' }}>
          {photos.map((p, i) => (
            <Box key={p} sx={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, bgcolor: i === index ? '#fff' : 'rgba(255,255,255,.55)', transition: 'width .25s' }} />
          ))}
        </Stack>
      )}
    </Box>
  );
}

const navSx = {
  position: 'absolute',
  top: '50%',
  translate: '0 -50%',
  opacity: 0,
  transition: 'opacity .2s',
  bgcolor: 'rgba(255,255,255,.85)',
  color: tokens.navy800,
  '&:hover': { bgcolor: '#fff' },
  '&:focus-visible': { opacity: 1 },
} as const;

/**
 * A worker as the showroom presents them (docs/03-migration-plan/15): the photos first, the specialty and the name on
 * them, then what a customer asks about (experience, projects, languages, skills). Inside the company the card also
 * says since when the worker waits and whether an order has them.
 */
export function WorkerShowCard({
  worker: w,
  presentation,
  selected,
  onToggle,
  onOpen,
}: {
  worker: ShowroomWorker;
  presentation: boolean;
  selected: boolean;
  onToggle?: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const x = useShowroomText();
  const reserved = !!w.reservedBy;
  const skills = w.skills.slice(0, 3);
  const facts: [string, string][] = [
    [t('showroom.card.withUs'), x.experience(w)],
    [t('showroom.card.projects'), w.projects ? String(w.projects) : '—'],
    [t('showroom.card.before'), w.priorExperienceYears ? t('showroom.card.years', { count: w.priorExperienceYears }) : '—'],
  ];
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#fff',
        borderRadius: '18px',
        boxShadow: selected ? `0 0 0 2.5px ${gold}, 0 14px 32px rgba(245,158,11,.25)` : '0 1px 2px rgba(15,39,71,.06), 0 8px 24px rgba(15,39,71,.08)',
        transition: 'transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: selected ? `0 0 0 2.5px ${gold}, 0 18px 38px rgba(245,158,11,.3)` : '0 2px 4px rgba(15,39,71,.06), 0 18px 40px rgba(15,39,71,.16)' },
        opacity: reserved ? 0.82 : 1,
      }}
    >
      <ButtonBase onClick={onOpen} sx={{ display: 'block', textAlign: 'start', borderRadius: '18px 18px 0 0' }} aria-label={t('showroom.card.open', { name: w.name })}>
        <PhotoStage worker={w}>
          {/* Top: availability and the flag. */}
          <Stack direction="row" sx={{ position: 'absolute', top: 12, insetInline: 12, justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none' }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1.1,
                py: 0.4,
                borderRadius: 99,
                fontSize: 11.5,
                fontWeight: 800,
                color: reserved ? '#92400E' : '#065F46',
                bgcolor: reserved ? '#FEF3C7' : '#D1FAE5',
                boxShadow: '0 2px 8px rgba(0,0,0,.15)',
              }}
            >
              {reserved ? <LockOutlinedIcon sx={{ fontSize: 13 }} /> : <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#10B981', boxShadow: '0 0 0 3px rgba(16,185,129,.25)' }} />}
              {reserved ? t('showroom.card.reserved') : t('showroom.card.available')}
            </Box>
            <Flag code={w.nationalityCode} size={30} title={x.nationality(w)} />
          </Stack>
          {selected && (
            <Box sx={{ position: 'absolute', top: 52, insetInlineEnd: 12, width: 30, height: 30, borderRadius: '50%', bgcolor: gold, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(245,158,11,.5)' }}>
              <CheckRoundedIcon sx={{ fontSize: 20 }} />
            </Box>
          )}
          {/* Bottom: specialty, name, nationality and age, on a shade over the photo. */}
          <Box sx={{ position: 'absolute', insetInline: 0, bottom: 0, pt: 6, pb: 1.5, px: 1.75, background: 'linear-gradient(180deg, rgba(7,45,67,0) 0%, rgba(7,45,67,.72) 45%, rgba(7,30,48,.94) 100%)', color: '#fff' }}>
            <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mb: 0.9 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.6,
                  px: 1,
                  py: 0.35,
                  borderRadius: '8px',
                  fontSize: 12,
                  fontWeight: 800,
                  color: w.specialty ? '#082B49' : '#fff',
                  bgcolor: w.specialty ? '#FCD34D' : 'rgba(255,255,255,.18)',
                  '& svg': { fontSize: 15 },
                }}
              >
                {specialtyIcon(w.specialty?.code)}
                {w.specialty ? x.name(w.specialty) : t('showroom.noSpecialty')}
                {w.specialtySuggested && !presentation && (
                  <Tooltip title={t('showroom.card.suggestedHint')}>
                    <Box component="span" sx={{ fontWeight: 600, opacity: 0.7 }}>
                      {t('showroom.card.suggested')}
                    </Box>
                  </Tooltip>
                )}
              </Box>
              {w.hotelExperience && (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.9, py: 0.35, borderRadius: '8px', fontSize: 11.5, fontWeight: 700, bgcolor: 'rgba(255,255,255,.16)', backdropFilter: 'blur(4px)' }}>
                  <StarRoundedIcon sx={{ fontSize: 14, color: '#FCD34D' }} />
                  {t('showroom.card.hotel')}
                </Box>
              )}
            </Stack>
            <Typography dir="auto" noWrap sx={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25, unicodeBidi: 'plaintext', textAlign: 'start', textShadow: '0 1px 6px rgba(0,0,0,.3)' }} title={w.name}>
              {w.name}
            </Typography>
            <Typography sx={{ fontSize: 12.5, opacity: 0.85 }}>
              {x.nationality(w)}
              {w.age ? ` · ${t('showroom.card.age', { count: w.age })}` : ''}
              {w.gender ? ` · ${t(`showroom.gender.${w.gender}`)}` : ''}
            </Typography>
          </Box>
        </PhotoStage>
      </ButtonBase>

      <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25, flex: 1, display: 'flex', flexDirection: 'column', gap: 1.1 }}>
        {/* Three facts a customer asks first. */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', bgcolor: '#F8FAFC', borderRadius: '12px', border: `1px solid ${tokens.gray100}` }}>
          {facts.map(([label, value], i) => (
            <Box key={label} sx={{ py: 0.9, px: 0.5, textAlign: 'center', borderInlineStart: i ? `1px solid ${tokens.gray100}` : 'none', minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }}>
                {value}
              </Typography>
              <Typography noWrap sx={{ fontSize: 10.5, color: tokens.gray500 }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, minHeight: 20, color: tokens.gray600 }}>
          <TranslateOutlinedIcon sx={{ fontSize: 16, color: tokens.navy600 }} />
          <Typography noWrap sx={{ fontSize: 12.5 }} title={x.list(w.languages)}>
            {w.languages.length ? x.list(w.languages) : t('showroom.card.noLanguages')}
          </Typography>
        </Stack>

        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', minHeight: 24 }}>
          {skills.map((s) => (
            <Box key={s.code} sx={{ px: 0.9, py: 0.25, borderRadius: '6px', bgcolor: tokens.navy50, color: tokens.navy700, fontSize: 11.5, fontWeight: 600 }}>
              {x.name(s)}
            </Box>
          ))}
          {w.skills.length > skills.length && <Box sx={{ px: 0.9, py: 0.25, borderRadius: '6px', bgcolor: tokens.gray100, color: tokens.gray600, fontSize: 11.5, fontWeight: 700 }}>+{w.skills.length - skills.length}</Box>}
          {w.skills.length === 0 && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t('showroom.card.noSkills')}</Typography>}
        </Stack>

        {!presentation && (
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, pt: 1, mt: 'auto', borderTop: `1px dashed ${tokens.gray200}`, color: tokens.gray500, fontSize: 11.5 }}>
            <HotelOutlinedIcon sx={{ fontSize: 15 }} />
            <Typography noWrap sx={{ fontSize: 11.5 }} title={w.lastPlace ?? undefined}>
              {reserved
                ? t('showroom.card.reservedBy', { no: w.reservedBy })
                : w.daysAvailable !== null
                  ? t('showroom.card.waiting', { count: w.daysAvailable })
                  : t('showroom.card.inHousing')}
              {w.lastPlace ? ` · ${w.lastPlace}` : ''}
            </Typography>
          </Stack>
        )}
      </Box>

      <Stack direction="row" sx={{ gap: 1, px: 1.75, pb: 1.75 }}>
        <Button fullWidth variant="outlined" onClick={onOpen} sx={{ borderRadius: '10px', fontWeight: 700 }}>
          {t('showroom.card.profile')}
        </Button>
        {onToggle && (
          <Button
            fullWidth
            variant="contained"
            disabled={reserved}
            onClick={onToggle}
            startIcon={selected ? <CheckRoundedIcon /> : <AddRoundedIcon />}
            sx={{ borderRadius: '10px', fontWeight: 800, boxShadow: 'none', bgcolor: selected ? '#B45309' : gold, '&:hover': { bgcolor: selected ? '#92400E' : '#D97706', boxShadow: 'none' } }}
          >
            {selected ? t('showroom.card.selected') : t('showroom.card.select')}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
