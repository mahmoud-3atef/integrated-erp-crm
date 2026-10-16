import { Alert, Box, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSession } from '../app/session';
import { tokens } from '../app/theme';
import { Badge, Initials, Panel } from '../components/ui';

/** Landing page inside the app shell; modules add their dashboards here as they are released. */
export function HomePage() {
  const { t } = useTranslation();
  const { me } = useSession();

  return (
    <Stack spacing={`${tokens.gap}px`}>
      <Panel padding={3}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Initials name={me.displayName} size={52} />
          <Box>
            <Typography component="h1" sx={{ fontSize: 21, fontWeight: 700, color: tokens.navy800 }}>
              {t('home.welcome', { name: me.displayName })}
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: tokens.gray600 }}>{t('home.intro')}</Typography>
            {me.isPlatformAdmin && (
              <Box sx={{ mt: 1 }}>
                <Badge tone="info">{t('home.platformAdmin')}</Badge>
              </Box>
            )}
          </Box>
        </Stack>
      </Panel>
      {me.permissions.length === 0 && <Alert severity="info">{t('home.noPermissions')}</Alert>}
    </Stack>
  );
}
