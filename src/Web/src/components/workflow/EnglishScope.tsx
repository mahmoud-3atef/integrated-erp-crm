import { CacheProvider } from '@emotion/react';
import { Box, createTheme, ThemeProvider } from '@mui/material';
import { useMemo, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { buildTheme, ltrCache } from '../../app/theme';

/**
 * The process designer in English only (left to right), whatever the screen's language: its labels, steps and the
 * tables' and fields' names. The texts a process shows people (names, notification texts) keep their Arabic and
 * English inputs.
 */
export function EnglishScope({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const english = useMemo(() => i18n.cloneInstance({ lng: 'en' }), [i18n]);
  // Menus, lists and dialogs open outside the page (in the document's right-to-left body): left to right too.
  const theme = useMemo(() => {
    const base = buildTheme('ltr');
    const ltr = { defaultProps: { dir: 'ltr' } };
    return createTheme(base, { components: { MuiPopover: ltr, MuiPopper: ltr, MuiDialog: ltr, MuiMenu: ltr, MuiModal: ltr } });
  }, []);
  return (
    <I18nextProvider i18n={english}>
      <CacheProvider value={ltrCache}>
        <ThemeProvider theme={theme}>
          <Box dir="ltr" lang="en" sx={{ textAlign: 'left' }}>
            {children}
          </Box>
        </ThemeProvider>
      </CacheProvider>
    </I18nextProvider>
  );
}
