import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { Box, Button, GlobalStyles, LinearProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { photoUrl, showroomApi, type ShowroomWorker } from '../../../api/showroom';
import { tokens } from '../../../app/theme';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { Flag } from '../../../components/workforce/Flag';
import { initialsOf, specialtyIcon, tintOf, useShowroomText } from './showroomParts';

/**
 * The chosen workers as a list for a customer (A4, to print or save as PDF): always the presentation's data, so nothing
 * internal reaches the customer.
 */
export function ShowroomPrintPage() {
  const { t } = useTranslation();
  const x = useShowroomText();
  const [params] = useSearchParams();
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
  const [workers, setWorkers] = useState<ShowroomWorker[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = ids.join(',');

  useEffect(() => {
    showroomApi
      .get(true)
      .then((d) => setWorkers(d.workers.filter((w) => key.split(',').includes(w.id))))
      .catch((f) => setError(errorKey(f)));
  }, [key]);

  const today = new Intl.DateTimeFormat(x.ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'long' }).format(new Date());
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <GlobalStyles
        styles={{
          '@page': { size: 'A4', margin: '12mm' },
          '@media print': { aside: { display: 'none !important' }, header: { display: 'none !important' }, '.no-print': { display: 'none !important' }, body: { background: '#fff' }, '.sheet': { boxShadow: 'none !important' } },
        }}
      />
      <Stack direction="row" className="no-print" sx={{ justifyContent: 'flex-end', mb: 1.5 }}>
        <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()} disabled={!workers}>
          {t('showroom.print.print')}
        </Button>
      </Stack>
      <ErrorMessage messageKey={error} />
      {!workers ? (
        !error && <LinearProgress />
      ) : (
        <Box className="sheet" sx={{ bgcolor: '#fff', borderRadius: '16px', boxShadow: tokens.shadowSm, p: 4 }}>
          <Stack direction="row" sx={{ alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '3px solid #082B49', pb: 1.5, mb: 2.5 }}>
            <Box>
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#082B49' }}>{t('showroom.print.title')}</Typography>
              <Typography sx={{ fontSize: 13, color: tokens.gray500 }}>{t('showroom.print.subtitle', { count: workers.length })}</Typography>
            </Box>
            <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{today}</Typography>
          </Stack>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
            {workers.map((w) => (
              <Stack key={w.id} direction="row" sx={{ gap: 1.75, p: 1.5, border: `1px solid ${tokens.gray200}`, borderRadius: '14px', breakInside: 'avoid' }}>
                <Box sx={{ width: 110, flex: '0 0 auto', aspectRatio: '4 / 5', borderRadius: '10px', overflow: 'hidden', bgcolor: tintOf(w.nationalityCode), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  {w.photos[0] ? <Box component="img" src={photoUrl(w.id, w.photos[0])} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsOf(w.name)}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
                    <Flag code={w.nationalityCode} size={20} />
                    <Typography dir="auto" noWrap sx={{ fontSize: 16, fontWeight: 800, unicodeBidi: 'plaintext' }}>
                      {w.name}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mb: 0.75 }}>
                    <bdi>{w.workerNo}</bdi> · {x.nationality(w)}
                    {w.age ? ` · ${t('showroom.card.age', { count: w.age })}` : ''}
                  </Typography>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, mb: 0.75, color: '#082B49', fontWeight: 800, fontSize: 13, '& svg': { fontSize: 16 } }}>
                    {specialtyIcon(w.specialty?.code)}
                    {w.specialty ? x.name(w.specialty) : t('showroom.noSpecialty')}
                    {w.hotelExperience && <StarRoundedIcon sx={{ color: '#F59E0B' }} />}
                  </Stack>
                  <Typography sx={{ fontSize: 12 }}>
                    <b>{t('showroom.card.withUs')}:</b> {x.experience(w)}
                    {w.projects ? ` · ${t('showroom.print.projects', { count: w.projects })}` : ''}
                    {w.priorExperienceYears ? ` · ${t('showroom.file.prior', { count: w.priorExperienceYears })}` : ''}
                  </Typography>
                  {w.languages.length > 0 && (
                    <Typography sx={{ fontSize: 12 }}>
                      <b>{t('showroom.print.languages')}:</b> {x.list(w.languages)}
                    </Typography>
                  )}
                  {w.skills.length > 0 && (
                    <Typography sx={{ fontSize: 12 }}>
                      <b>{t('showroom.print.skills')}:</b> {x.list(w.skills)}
                    </Typography>
                  )}
                </Box>
              </Stack>
            ))}
          </Box>
          {workers.length < ids.length && <Typography sx={{ fontSize: 12, color: tokens.gray500, mt: 2 }}>{t('showroom.print.missing')}</Typography>}
        </Box>
      )}
    </Box>
  );
}
