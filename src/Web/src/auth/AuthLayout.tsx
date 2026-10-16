import TranslateIcon from '@mui/icons-material/Translate';
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { applyLanguage, type Language } from '../i18n';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const toggle = () => {
    const next: Language = i18n.language === 'ar' ? 'en' : 'ar';
    applyLanguage(next);
    void i18n.changeLanguage(next);
  };

  return (
    <Button size="small" startIcon={<TranslateIcon />} onClick={toggle} aria-label={t('language.label')} lang={i18n.language === 'ar' ? 'en' : 'ar'}>
      {t('language.switchTo')}
    </Button>
  );
}

/** Translated error box; renders nothing when there is no error. */
export function ErrorMessage({ messageKey }: { messageKey: string | null }) {
  const { t, i18n } = useTranslation();
  return messageKey ? (
    <Alert severity="error" sx={{ mb: 2 }} role="alert">
      {/* A code without a translation yet still shows a readable message. */}
      {t(i18n.exists(messageKey) ? messageKey : 'errors.unknown')}
    </Alert>
  ) : null;
}

/** Centered card used by every sign-in screen. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <Box
      component="main"
      sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}
    >
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" color="primary" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {t('app.name')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('app.tagline')}
            </Typography>
          </Box>
          <LanguageSwitch />
        </Stack>
        <Card variant="outlined">
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h5" component="h1" gutterBottom>
              {title}
            </Typography>
            {subtitle && (
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                {subtitle}
              </Typography>
            )}
            {children}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
