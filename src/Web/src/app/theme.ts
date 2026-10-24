import createCache from '@emotion/cache';
import { createTheme } from '@mui/material/styles';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

/** Emotion caches: the RTL one mirrors every style (margins, paddings, borders) for Arabic. */
export const rtlCache = createCache({ key: 'erp-rtl', stylisPlugins: [prefixer, rtlPlugin] });
export const ltrCache = createCache({ key: 'erp-ltr', stylisPlugins: [prefixer] });

/**
 * Visual identity carried over from the CarePro portal design system (content/css/carepro-design.css):
 * petrol navy, a neutral blue-grey page, floating white cards, pill-shaped buttons and navigation.
 */
export const tokens = {
  navy50: '#eaf3f8',
  navy100: '#d6e8f1',
  navy400: '#3f86ab',
  navy500: '#1b6a92',
  navy600: '#12597f',
  navy700: '#0d4a6c',
  navy800: '#0a3c58',
  navy900: '#072d43',
  gray50: '#f5f8fa',
  gray100: '#edf2f6',
  gray200: '#e1e9ef',
  gray300: '#c9d5de',
  gray500: '#66798a',
  gray600: '#4a5c6c',
  gray700: '#33444f',
  gray900: '#102633',
  // The page background (2026-10-24): a soft navy-tinted blue that sets the white cards apart and sits with the navy and gold.
  bg: '#d6e4f0',
  tint: '#e4f0f6',
  tintStrong: '#cfe3ec',
  border: '#e1ebf1',
  success: '#23a455',
  warning: '#d98a06',
  danger: '#e03434',
  info: '#1592c4',
  teal: '#0e7c86',
  gold: '#b38a0f',
  sky: '#2bc3e1',
  radiusSm: 8,
  radius: 12,
  radiusLg: 18,
  gap: 14,
  sidebarWidth: 250,
  shadowXs: '0 1px 2px rgba(10, 60, 88, .06)',
  shadowSm: '0 4px 14px rgba(10, 60, 88, .07)',
  shadowMd: '0 12px 30px rgba(10, 60, 88, .12)',
  ring: '0 0 0 4px rgba(27, 106, 146, .16)',
} as const;

export function buildTheme(direction: 'rtl' | 'ltr') {
  return createTheme({
    direction,
    palette: {
      mode: 'light',
      primary: { main: tokens.navy700, dark: tokens.navy800, light: tokens.navy500, contrastText: '#fff' },
      secondary: { main: tokens.teal },
      success: { main: tokens.success },
      warning: { main: tokens.warning },
      error: { main: tokens.danger },
      info: { main: tokens.info },
      background: { default: tokens.bg, paper: '#ffffff' },
      text: { primary: tokens.gray900, secondary: tokens.gray600 },
      divider: tokens.border,
    },
    shape: { borderRadius: tokens.radius },
    typography: {
      fontFamily: '"IBM Plex Sans Arabic", "Segoe UI", system-ui, sans-serif',
      fontSize: 14,
      h4: { fontWeight: 700, color: tokens.navy800 },
      h5: { fontWeight: 700, fontSize: '1.3rem', color: tokens.navy800 },
      h6: { fontWeight: 700, fontSize: '1rem', color: tokens.navy800 },
      subtitle1: { fontWeight: 700, color: tokens.navy800 },
      button: { fontWeight: 600, textTransform: 'none' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: { body: { WebkitFontSmoothing: 'antialiased' }, ':root': { '--band-angle': direction === 'rtl' ? '240deg' : '120deg' } },
      },
      MuiPaper: {
        styleOverrides: {
          rounded: { borderRadius: tokens.radiusLg },
          outlined: { border: 0, boxShadow: tokens.shadowSm },
        },
      },
      MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { borderRadius: tokens.radiusLg, boxShadow: tokens.shadowSm } } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 999, paddingInline: 18, minHeight: 38, '&:focus-visible': { boxShadow: tokens.ring } },
          contained: { boxShadow: '0 6px 14px rgba(13, 74, 108, .25)', '&:hover': { backgroundColor: tokens.navy800 } },
          outlined: { backgroundColor: '#fff', borderColor: tokens.border, boxShadow: tokens.shadowXs, '&:hover': { backgroundColor: tokens.navy50, borderColor: tokens.navy100 } },
          sizeLarge: { minHeight: 48, fontSize: '0.95rem' },
          sizeSmall: { minHeight: 32, paddingInline: 14 },
        },
      },
      MuiIconButton: { styleOverrides: { root: { color: tokens.navy700, '&:hover': { backgroundColor: tokens.tint } } } },
      MuiTextField: { defaultProps: { fullWidth: true } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: '#fff',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.gray300 },
            '&.Mui-focused': { boxShadow: tokens.ring },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: tokens.navy400, borderWidth: 1 },
          },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 999 },
          outlined: { borderColor: tokens.border, backgroundColor: '#fff' },
        },
      },
      MuiDialog: { styleOverrides: { paper: { borderRadius: tokens.radiusLg } } },
      MuiDialogTitle: { styleOverrides: { root: { fontWeight: 700, color: tokens.navy800 } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: tokens.radius, alignItems: 'center' } } },
      MuiTableHead: {
        styleOverrides: {
          root: {
            // Headers wrap onto two lines rather than widen their column: the grid shows as many columns as the screen holds.
            '& .MuiTableCell-head': { backgroundColor: tokens.navy900, color: '#fff', fontWeight: 600, fontSize: 12, lineHeight: 1.25, paddingBlock: 8, whiteSpace: 'normal' },
            '& .MuiTableCell-head:first-of-type': { borderStartStartRadius: 6 },
            '& .MuiTableCell-head:last-of-type': { borderStartEndRadius: 6 },
          },
        },
      },
      MuiTableBody: {
        styleOverrides: {
          root: {
            '& .MuiTableRow-root:nth-of-type(even) .MuiTableCell-body': { backgroundColor: '#f6fafc' },
            '& .MuiTableRow-hover:hover .MuiTableCell-body': { backgroundColor: tokens.navy50 },
          },
        },
      },
      // Every grid is dense (docs/02-target-architecture/15 §6): narrow cells so the columns fit without a sideways scroll.
      MuiTableCell: { styleOverrides: { root: { borderBottomColor: tokens.gray100, paddingBlock: 6, paddingInline: 8, fontSize: 12.5 }, body: { color: tokens.gray700 } } },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: tokens.navy900, fontSize: 12 } } },
      MuiSwitch: { styleOverrides: { switchBase: { '&.Mui-checked': { color: tokens.navy700 } } } },
      MuiListSubheader: { styleOverrides: { root: { lineHeight: '32px' } } },
    },
  });
}

/** Status pill with a colored dot (the portal's .cp-status). */
export const toneColors = {
  success: { fg: tokens.success, bg: '#e9f8ef' },
  warning: { fg: tokens.warning, bg: '#fff6e5' },
  danger: { fg: tokens.danger, bg: '#fdeeee' },
  info: { fg: tokens.info, bg: '#e6f5fb' },
  primary: { fg: tokens.navy600, bg: tokens.navy50 },
  neutral: { fg: tokens.gray600, bg: tokens.gray100 },
} as const;
