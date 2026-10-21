import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import WcOutlinedIcon from '@mui/icons-material/WcOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { educations, photoUrl, profileApi, religions, type ProfileLists, type ReferenceOption, type WorkerProfile, type WorkerProfileInput } from '../../api/showroom';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { specialtyIcon } from '../operations/showroom/showroomParts';

/**
 * A worker's marketing profile (docs/03-migration-plan/15): the photos and what the showroom tells a customer —
 * specialty, skills, languages and a few personal facts. Marketing or the housing officer edit it.
 */
export function WorkerProfileTab({ workerId }: { workerId: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const ar = i18n.language === 'ar';
  const editor = can('workforce.workers.profile', true);
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [lists, setLists] = useState<ProfileLists | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    profileApi.get(workerId).then(setProfile).catch((f) => setError(errorKey(f)));
  }, [workerId]);
  useEffect(() => {
    load();
    profileApi.lists().then(setLists).catch((f) => setError(errorKey(f)));
  }, [load]);

  if (!profile || !lists) return error ? <ErrorMessage messageKey={error} /> : <CircularProgress size={28} sx={{ m: 3 }} />;

  const label = (list: ReferenceOption[], code: string | null) => {
    const item = list.find((i) => i.code === code);
    return item ? (ar ? item.nameAr : item.nameEn) : code ?? '—';
  };
  const age = profile.birthDate ? Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / (365.25 * 86400000)) : null;
  const photos = profile.photos;
  const shown = photos[Math.min(current, photos.length - 1)];

  const act = async (job: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await job();
      load();
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };
  const upload = (files: FileList | null) =>
    files &&
    act(async () => {
      for (const file of Array.from(files).slice(0, 8 - photos.length)) await profileApi.addPhoto(workerId, file);
    });

  return (
    <Box>
      <ErrorMessage messageKey={error} />
      <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, mb: 2 }}>
        {can('operations.showroom.view', true) && (
          <Button startIcon={<StorefrontOutlinedIcon />} onClick={() => navigate('/housing/showroom')}>
            {t('workerProfile.toShowroom')}
          </Button>
        )}
        {editor && (
          <Button variant="contained" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(true)}>
            {t('workerProfile.edit')}
          </Button>
        )}
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '380px 1fr' }, gap: 2.5, alignItems: 'start' }}>
        <FieldSection title={t('workerProfile.photos', { count: photos.length })} icon={<CollectionsOutlinedIcon />} columns={1}>
          <Box sx={{ position: 'relative', aspectRatio: '4 / 5', borderRadius: '14px', overflow: 'hidden', bgcolor: tokens.navy50, display: 'grid', placeItems: 'center' }}>
            {shown ? (
              <Box component="img" src={photoUrl(workerId, shown)} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
            ) : (
              <Stack sx={{ alignItems: 'center', gap: 1, color: tokens.gray500, p: 3, textAlign: 'center' }}>
                <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 48, color: tokens.navy600 }} />
                <Typography sx={{ fontSize: 13 }}>{t('workerProfile.noPhotos')}</Typography>
              </Stack>
            )}
            {shown && current === 0 && (
              <Box sx={{ position: 'absolute', top: 10, insetInlineStart: 10, px: 1, py: 0.3, borderRadius: 99, bgcolor: '#FCD34D', color: '#082B49', fontSize: 11.5, fontWeight: 800 }}>{t('workerProfile.main')}</Box>
            )}
            {busy && <CircularProgress sx={{ position: 'absolute' }} />}
          </Box>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {photos.map((p, i) => (
              <Box key={p} sx={{ position: 'relative', width: 72, height: 72, borderRadius: '10px', overflow: 'hidden', outline: i === current ? '2.5px solid #F59E0B' : `1px solid ${tokens.gray200}`, outlineOffset: 1, '&:hover .tools': { opacity: 1 } }}>
                <Box component="button" type="button" onClick={() => setCurrent(i)} aria-label={t('workerProfile.view', { n: i + 1 })} sx={{ p: 0, border: 0, cursor: 'pointer', width: '100%', height: '100%' }}>
                  <Box component="img" src={photoUrl(workerId, p)} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </Box>
                {editor && (
                  <Stack className="tools" direction="row" sx={{ position: 'absolute', insetInline: 0, bottom: 0, justifyContent: 'space-between', bgcolor: 'rgba(8,43,73,.75)', opacity: 0, transition: 'opacity .2s', '&:focus-within': { opacity: 1 } }}>
                    <Tooltip title={t('workerProfile.makeMain')}>
                      <span>
                        <IconButton size="small" disabled={i === 0 || busy} onClick={() => act(() => profileApi.makeMain(workerId, p)).then(() => setCurrent(0))} sx={{ color: '#FCD34D' }} aria-label={t('workerProfile.makeMain')}>
                          {i === 0 ? <StarRoundedIcon fontSize="small" /> : <StarOutlineRoundedIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('workerProfile.deletePhoto')}>
                      <IconButton size="small" disabled={busy} onClick={() => window.confirm(t('workerProfile.deleteConfirm')) && act(() => profileApi.deletePhoto(workerId, p)).then(() => setCurrent(0))} sx={{ color: '#fff' }} aria-label={t('workerProfile.deletePhoto')}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                )}
              </Box>
            ))}
            {editor && photos.length < 8 && (
              <Box
                component="button"
                type="button"
                disabled={busy}
                onClick={() => input.current?.click()}
                sx={{ width: 72, height: 72, borderRadius: '10px', border: `1.5px dashed ${tokens.navy600}`, bgcolor: tokens.navy50, color: tokens.navy700, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                aria-label={t('workerProfile.addPhotos')}
              >
                <AddPhotoAlternateOutlinedIcon />
              </Box>
            )}
          </Stack>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
          {editor && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t('workerProfile.photoHint')}</Typography>}
        </FieldSection>

        <Stack spacing={2.5}>
          <FieldSection title={t('workerProfile.marketing')} icon={<StorefrontOutlinedIcon />} tone="gold">
            <FieldBox label={t('workerProfile.specialty')} icon={specialtyIcon(profile.specialty ?? profile.suggestedSpecialty)} wide>
              {profile.specialty ? (
                label(lists.specialties, profile.specialty)
              ) : profile.suggestedSpecialty ? (
                <>
                  {label(lists.specialties, profile.suggestedSpecialty)}{' '}
                  <Box component="span" sx={{ fontSize: 12, color: tokens.gold, fontWeight: 600 }}>
                    {t('workerProfile.suggested')}
                  </Box>
                </>
              ) : (
                '—'
              )}
            </FieldBox>
            <FieldBox label={t('workerProfile.skills')} icon={<PsychologyOutlinedIcon />} wide>
              {profile.skills.length ? (
                <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                  {profile.skills.map((s) => (
                    <Chip key={s} size="small" label={label(lists.skills, s)} sx={{ bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 600 }} />
                  ))}
                </Stack>
              ) : (
                '—'
              )}
            </FieldBox>
            <FieldBox label={t('workerProfile.languages')} icon={<TranslateOutlinedIcon />} wide>
              {profile.languages.length ? profile.languages.map((l) => label(lists.languages, l)).join(ar ? '، ' : ', ') : '—'}
            </FieldBox>
            <FieldBox label={t('workerProfile.prior')} icon={<WorkspacePremiumOutlinedIcon />}>
              {profile.priorExperienceYears !== null ? t('showroom.card.years', { count: profile.priorExperienceYears }) : '—'}
            </FieldBox>
            <FieldBox label={t('workerProfile.education')} icon={<SchoolOutlinedIcon />}>
              {profile.education ? t(`workerProfile.educations.${profile.education}`) : '—'}
            </FieldBox>
            <FieldBox label={t('workerProfile.bio')} icon={<HistoryEduOutlinedIcon />} wide multiline>
              {(ar ? profile.bioAr ?? profile.bioEn : profile.bioEn ?? profile.bioAr) ?? '—'}
            </FieldBox>
          </FieldSection>
          <FieldSection title={t('workerProfile.personal')} icon={<WcOutlinedIcon />} tone="sky">
            <FieldBox label={t('workerProfile.gender')} icon={<WcOutlinedIcon />}>
              {profile.gender ? t(`showroom.gender.${profile.gender}`) : '—'}
            </FieldBox>
            <FieldBox label={t('workerProfile.birthDate')} icon={<CakeOutlinedIcon />}>
              {profile.birthDate ? (
                <>
                  <bdi>{profile.birthDate.replaceAll('-', '/')}</bdi>
                  {age !== null && <> · {t('showroom.card.age', { count: age })}</>}
                </>
              ) : (
                '—'
              )}
            </FieldBox>
            <FieldBox label={t('workerProfile.religion')} icon={<WcOutlinedIcon />}>
              {profile.religion ? t(`workerProfile.religions.${profile.religion}`) : '—'}
            </FieldBox>
          </FieldSection>
          {profile.updatedBy && (
            <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>
              {t('workerProfile.updated', { by: profile.updatedBy, on: (profile.updatedAt ?? '').slice(0, 10).replaceAll('-', '/') })}
            </Typography>
          )}
        </Stack>
      </Box>
      {editing && <ProfileDialog workerId={workerId} profile={profile} lists={lists} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </Box>
  );
}

function ProfileDialog({ workerId, profile, lists, onClose, onSaved }: { workerId: string; profile: WorkerProfile; lists: ProfileLists; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [v, setV] = useState<WorkerProfileInput>({
    specialty: profile.specialty ?? profile.suggestedSpecialty,
    skills: profile.skills,
    languages: profile.languages,
    gender: profile.gender,
    birthDate: profile.birthDate,
    religion: profile.religion,
    education: profile.education,
    priorExperienceYears: profile.priorExperienceYears,
    bioAr: profile.bioAr,
    bioEn: profile.bioEn,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (o: ReferenceOption) => (ar ? o.nameAr : o.nameEn);
  const pick = (list: ReferenceOption[], codes: string[]) => codes.map((c) => list.find((o) => o.code === c)).filter((o): o is ReferenceOption => !!o);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await profileApi.save(workerId, v);
      onSaved();
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{t('workerProfile.editTitle')}</DialogTitle>
      <DialogContent>
        <ErrorMessage messageKey={error} />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, pt: 1 }}>
          <TextField select label={t('workerProfile.specialty')} value={v.specialty ?? ''} onChange={(e) => setV({ ...v, specialty: e.target.value || null })} helperText={!profile.specialty && profile.suggestedSpecialty ? t('workerProfile.suggestedHelp') : ' '}>
            <MenuItem value="">—</MenuItem>
            {lists.specialties.map((o) => (
              <MenuItem key={o.code} value={o.code}>
                {name(o)}
              </MenuItem>
            ))}
          </TextField>
          <TextField type="number" label={t('workerProfile.prior')} value={v.priorExperienceYears ?? ''} onChange={(e) => setV({ ...v, priorExperienceYears: e.target.value === '' ? null : Math.max(0, Math.min(40, Number(e.target.value))) })} slotProps={{ htmlInput: { min: 0, max: 40 } }} helperText={t('workerProfile.priorHelp')} />
          <Autocomplete
            multiple
            options={lists.skills}
            value={pick(lists.skills, v.skills)}
            onChange={(_, items) => setV({ ...v, skills: items.map((o) => o.code) })}
            getOptionLabel={name}
            isOptionEqualToValue={(a, b) => a.code === b.code}
            renderInput={(p) => <TextField {...p} label={t('workerProfile.skills')} />}
            sx={{ gridColumn: '1 / -1' }}
          />
          <Autocomplete
            multiple
            options={lists.languages}
            value={pick(lists.languages, v.languages)}
            onChange={(_, items) => setV({ ...v, languages: items.map((o) => o.code) })}
            getOptionLabel={name}
            isOptionEqualToValue={(a, b) => a.code === b.code}
            renderInput={(p) => <TextField {...p} label={t('workerProfile.languages')} helperText={t('workerProfile.languagesHelp')} />}
            sx={{ gridColumn: '1 / -1' }}
          />
          <TextField select label={t('workerProfile.gender')} value={v.gender ?? ''} onChange={(e) => setV({ ...v, gender: (e.target.value || null) as WorkerProfileInput['gender'] })}>
            <MenuItem value="">—</MenuItem>
            <MenuItem value="M">{t('showroom.gender.M')}</MenuItem>
            <MenuItem value="F">{t('showroom.gender.F')}</MenuItem>
          </TextField>
          <TextField type="date" label={t('workerProfile.birthDate')} value={v.birthDate ?? ''} onChange={(e) => setV({ ...v, birthDate: e.target.value || null })} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select label={t('workerProfile.religion')} value={v.religion ?? ''} onChange={(e) => setV({ ...v, religion: e.target.value || null })}>
            <MenuItem value="">—</MenuItem>
            {religions.map((r) => (
              <MenuItem key={r} value={r}>
                {t(`workerProfile.religions.${r}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label={t('workerProfile.education')} value={v.education ?? ''} onChange={(e) => setV({ ...v, education: e.target.value || null })}>
            <MenuItem value="">—</MenuItem>
            {educations.map((r) => (
              <MenuItem key={r} value={r}>
                {t(`workerProfile.educations.${r}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField multiline minRows={3} label={t('workerProfile.bioAr')} value={v.bioAr ?? ''} onChange={(e) => setV({ ...v, bioAr: e.target.value })} slotProps={{ htmlInput: { maxLength: 600 } }} helperText={`${(v.bioAr ?? '').length}/600`} />
          <TextField multiline minRows={3} label={t('workerProfile.bioEn')} value={v.bioEn ?? ''} onChange={(e) => setV({ ...v, bioEn: e.target.value })} slotProps={{ htmlInput: { maxLength: 600, dir: 'ltr' } }} helperText={`${(v.bioEn ?? '').length}/600`} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={save} disabled={busy}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
