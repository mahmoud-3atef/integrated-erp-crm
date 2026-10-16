import { Alert, Chip, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSession } from '../app/session';

/** Landing page inside the app shell; modules add their dashboards here as they are delivered. */
export function HomePage() {
  const { t } = useTranslation();
  const { me } = useSession();

  return (
    <Stack spacing={2} sx={{ maxWidth: 900 }}>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Stack spacing={1}>
          <Typography variant="h5" component="h1">
            {t('home.welcome', { name: me.displayName })}
          </Typography>
          <Typography color="text.secondary">{t('home.intro')}</Typography>
          {me.isPlatformAdmin && <Chip label={t('home.platformAdmin')} color="secondary" size="small" sx={{ alignSelf: 'flex-start' }} />}
        </Stack>
      </Paper>
      {me.permissions.length === 0 && <Alert severity="info">{t('home.noPermissions')}</Alert>}
    </Stack>
  );
}
