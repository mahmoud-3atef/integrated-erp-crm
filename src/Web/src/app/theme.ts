import createCache from '@emotion/cache';
import { createTheme } from '@mui/material/styles';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

/** Emotion caches: the RTL one mirrors every style (margins, paddings, borders) for Arabic. */
export const rtlCache = createCache({ key: 'erp-rtl', stylisPlugins: [prefixer, rtlPlugin] });
export const ltrCache = createCache({ key: 'erp-ltr', stylisPlugins: [prefixer] });

export function buildTheme(direction: 'rtl' | 'ltr') {
  return createTheme({
    direction,
    palette: {
      mode: 'light',
      primary: { main: '#14457a' },
      secondary: { main: '#0f8a7e' },
      background: { default: '#f3f5f8', paper: '#ffffff' },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"IBM Plex Sans Arabic", "Segoe UI", system-ui, sans-serif',
      h5: { fontWeight: 700 },
      button: { fontWeight: 500, textTransform: 'none' },
    },
    components: {
      MuiTextField: { defaultProps: { fullWidth: true } },
      MuiButton: { defaultProps: { disableElevation: true } },
    },
  });
}
