import BusinessIcon from '@mui/icons-material/Business';
import LogoutIcon from '@mui/icons-material/Logout';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { AppBar, Box, Button, Chip, CircularProgress, Container, IconButton, Paper, Stack, Toolbar, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { authApi, type Me } from '../api/auth';
import { LanguageSwitch } from '../auth/AuthLayout';
import { companyName } from './ChooseCompanyPage';

/** Placeholder home: proves the session works; modules appear here as they are delivered. */
export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    authApi.me().then(setMe).catch(() => navigate('/login', { replace: true }));
  }, [navigate]);

  if (!me) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  const logout = async () => {
    await authApi.logout().catch(() => undefined);
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Toolbar sx={{ gap: { xs: 0.5, sm: 1 } }}>
          <Typography variant="h6" color="primary" noWrap sx={{ fontWeight: 700, flexGrow: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            {t('app.name')}
          </Typography>
          {me.company && <Chip icon={<BusinessIcon />} label={companyName(me.company, i18n.language)} variant="outlined" />}
          {me.companies.length > 1 && (
            <Button startIcon={<SwapHorizIcon />} onClick={() => navigate('/login/company')}>
              {t('company.switch')}
            </Button>
          )}
          <LanguageSwitch />
          {/* Phones: icon only, so the bar stays on one line. */}
          <Button startIcon={<LogoutIcon />} color="inherit" onClick={() => void logout()} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            {t('home.logout')}
          </Button>
          <IconButton color="inherit" onClick={() => void logout()} aria-label={t('home.logout')} sx={{ display: { sm: 'none' } }}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper variant="outlined" sx={{ p: 4 }}>
          <Stack spacing={1}>
            <Typography variant="h5" component="h1">
              {t('home.welcome', { name: me.displayName })}
            </Typography>
            <Typography color="text.secondary">{t('home.intro')}</Typography>
            {me.isPlatformAdmin && <Chip label={t('home.platformAdmin')} color="secondary" size="small" sx={{ alignSelf: 'flex-start' }} />}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
