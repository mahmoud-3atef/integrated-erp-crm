import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseIcon from '@mui/icons-material/Close';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { Box, Button, Drawer, IconButton, LinearProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { photoUrl, showroomApi, type ShowroomWorkerFile } from '../../../api/showroom';
import { tokens } from '../../../app/theme';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { Flag } from '../../../components/workforce/Flag';
import { PhotoStage } from './WorkerShowCard';
import { specialtyIcon, useShowroomText } from './showroomParts';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ px: 3, py: 2, flex: '0 0 auto', borderBottom: `1px solid ${tokens.gray100}` }}>
      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800, mb: 1.25 }}>{title}</Typography>
      {children}
    </Box>
  );
}

function Tile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ bgcolor: '#F8FAFC', borderRadius: '12px', p: 1.25, minWidth: 0 }}>
      <Typography noWrap sx={{ fontSize: 11.5, color: tokens.gray500 }}>
        {label}
      </Typography>
      <Typography noWrap sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800 }}>
        {value}
      </Typography>
    </Box>
  );
}

/** A worker's showroom file: the photos large, what they do, where and how long they worked, and (inside) the rest. */
export function ShowroomFile({
  workerId,
  presentation,
  selected,
  onToggle,
  onClose,
}: {
  workerId: string;
  presentation: boolean;
  selected: boolean;
  onToggle?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const x = useShowroomText();
  const [file, setFile] = useState<ShowroomWorkerFile | null>(null);
  const [photo, setPhoto] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFile(null);
    showroomApi.file(workerId, presentation).then(setFile).catch((f) => setError(errorKey(f)));
  }, [workerId, presentation]);

  const w = file?.worker;
  const day = (v: string) => v.slice(0, 7).replace('-', '/');
  return (
    <Drawer anchor="left" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520 }, bgcolor: '#fff' } } }}>
      <IconButton onClick={onClose} aria-label={t('common.close')} sx={{ position: 'absolute', top: 12, insetInlineEnd: 12, zIndex: 3, bgcolor: 'rgba(255,255,255,.9)', '&:hover': { bgcolor: '#fff' } }}>
        <CloseIcon />
      </IconButton>
      <ErrorMessage messageKey={error} />
      {!w || !file ? (
        !error && <LinearProgress />
      ) : (
        <>
          <Box sx={{ position: 'relative', flex: '0 0 auto' }}>
            <PhotoStage key={photo} worker={{ ...w, photos: w.photos.length ? [w.photos[photo]!, ...w.photos.filter((_, i) => i !== photo)] : [] }} ratio="5 / 4" rounded={0}>
              <Box sx={{ position: 'absolute', insetInline: 0, bottom: 0, pt: 8, pb: 2, px: 3, color: '#fff', background: 'linear-gradient(180deg, rgba(7,45,67,0), rgba(7,30,48,.95))' }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.1, py: 0.4, borderRadius: '8px', fontSize: 13, fontWeight: 800, color: '#082B49', bgcolor: w.specialty ? '#FCD34D' : '#E2E8F0', '& svg': { fontSize: 17 } }}>
                    {specialtyIcon(w.specialty?.code)}
                    {w.specialty ? x.name(w.specialty) : t('showroom.noSpecialty')}
                  </Box>
                  {w.reservedBy && (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: '8px', fontSize: 12, fontWeight: 800, color: '#92400E', bgcolor: '#FEF3C7' }}>
                      <LockOutlinedIcon sx={{ fontSize: 14 }} />
                      {t('showroom.card.reservedBy', { no: w.reservedBy })}
                    </Box>
                  )}
                </Stack>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                  <Flag code={w.nationalityCode} size={34} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography dir="auto" sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, unicodeBidi: 'plaintext', textAlign: 'start' }}>
                      {w.name}
                    </Typography>
                    <Typography sx={{ fontSize: 13, opacity: 0.85 }}>
                      <bdi>{w.workerNo}</bdi> · {x.nationality(w)}
                      {w.age ? ` · ${t('showroom.card.age', { count: w.age })}` : ''}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </PhotoStage>
          </Box>
          {w.photos.length > 1 && (
            <Stack direction="row" sx={{ gap: 1, px: 3, pt: 1.5, pb: 0.5, overflowX: 'auto', flex: '0 0 auto' }}>
              {w.photos.map((p, i) => (
                <Box
                  key={p}
                  component="button"
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={t('showroom.file.photo', { n: i + 1 })}
                  sx={{ p: 0, border: 0, cursor: 'pointer', flex: '0 0 auto', width: 64, height: 64, borderRadius: '10px', overflow: 'hidden', outline: i === photo ? '2.5px solid #F59E0B' : '1px solid #E2E8F0', outlineOffset: 1 }}
                >
                  <Box component="img" src={photoUrl(w.id, p)} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </Box>
              ))}
            </Stack>
          )}

          <Section title={t('showroom.file.experience')}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              <Tile label={t('showroom.file.workDays')} value={w.workDays ? w.workDays.toLocaleString('en-US') : '—'} />
              <Tile label={t('showroom.card.projects')} value={w.projects || '—'} />
              <Tile label={t('showroom.file.longest')} value={file.longestStintDays ? t('showroom.card.months', { count: x.months(file.longestStintDays) }) : '—'} />
            </Box>
            {w.priorExperienceYears ? <Typography sx={{ fontSize: 12.5, color: tokens.gray600, mt: 1 }}>{t('showroom.file.prior', { count: w.priorExperienceYears })}</Typography> : null}
          </Section>

          {(x.ar ? w.bioAr ?? w.bioEn : w.bioEn ?? w.bioAr) && (
            <Section title={t('showroom.file.about')}>
              <Typography sx={{ fontSize: 13.5, lineHeight: 1.8, color: tokens.gray700 }}>{x.ar ? w.bioAr ?? w.bioEn : w.bioEn ?? w.bioAr}</Typography>
            </Section>
          )}

          <Section title={t('showroom.file.skills')}>
            <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
              {w.skills.map((s) => (
                <Box key={s.code} sx={{ px: 1.1, py: 0.4, borderRadius: '8px', bgcolor: tokens.navy50, color: tokens.navy700, fontSize: 12.5, fontWeight: 600 }}>
                  {x.name(s)}
                </Box>
              ))}
              {w.languages.map((l, i) => (
                <Box key={l.code} sx={{ px: 1.1, py: 0.4, borderRadius: '8px', bgcolor: '#ECFDF5', color: '#065F46', fontSize: 12.5, fontWeight: 600 }}>
                  {x.name(l)}
                  {i === 0 ? ` · ${t('showroom.file.mother')}` : ''}
                </Box>
              ))}
              {w.skills.length + w.languages.length === 0 && <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('showroom.file.noSkills')}</Typography>}
            </Stack>
          </Section>

          <Section title={t('showroom.file.history')}>
            {file.stints.length === 0 ? (
              <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('showroom.file.noHistory')}</Typography>
            ) : (
              <Stack sx={{ gap: 1.25, borderInlineStart: `2px solid ${tokens.gray100}`, paddingInlineStart: 2 }}>
                {file.stints.slice(0, 8).map((s, i) => (
                  <Box key={`${s.startsOn}-${i}`} sx={{ position: 'relative' }}>
                    <Box sx={{ position: 'absolute', insetInlineStart: -23, top: 4, width: 12, height: 12, borderRadius: '50%', bgcolor: i === 0 ? '#0e7c86' : '#94A3B8', boxShadow: '0 0 0 3px #fff' }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{s.place ?? t('showroom.file.project')}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                      <bdi>
                        {day(s.startsOn)} – {s.endsOn ? day(s.endsOn) : t('showroom.file.now')}
                      </bdi>{' '}
                      · {t('showroom.card.months', { count: x.months(s.days) })}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Section>

          {!presentation && (
            <Section title={t('showroom.file.internal')}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                <Tile label={t('showroom.file.waiting')} value={w.daysAvailable !== null ? t('showroom.file.days', { count: w.daysAvailable }) : '—'} />
                <Tile label={t('showroom.file.lastReturn')} value={w.lastReturnReason ? t(`operations.return.reasons.${w.lastReturnReason}`) : '—'} />
              </Box>
              <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mt: 1 }}>{t('showroom.file.internalHint')}</Typography>
            </Section>
          )}

          <Stack direction="row" sx={{ gap: 1, p: 2.5, position: 'sticky', bottom: 0, bgcolor: '#fff', borderTop: `1px solid ${tokens.gray100}`, mt: 'auto' }}>
            <Button variant="outlined" startIcon={<PictureAsPdfOutlinedIcon />} onClick={() => window.open(`/housing/showroom/print?ids=${w.id}`, '_blank')}>
              {t('showroom.file.cv')}
            </Button>
            {!presentation && (
              <Button startIcon={<OpenInNewOutlinedIcon />} onClick={() => navigate(`/workforce/workers/${w.id}?tab=profile`)}>
                {t('showroom.file.open')}
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            {onToggle && (
              <Button
                variant="contained"
                disabled={!!w.reservedBy}
                onClick={onToggle}
                startIcon={selected ? <CheckRoundedIcon /> : <AddRoundedIcon />}
                sx={{ fontWeight: 800, boxShadow: 'none', bgcolor: selected ? '#B45309' : '#F59E0B', '&:hover': { bgcolor: '#D97706', boxShadow: 'none' } }}
              >
                {selected ? t('showroom.card.selected') : t('showroom.file.select')}
              </Button>
            )}
          </Stack>
        </>
      )}
    </Drawer>
  );
}
