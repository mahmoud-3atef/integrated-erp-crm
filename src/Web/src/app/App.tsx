import { CacheProvider } from '@emotion/react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SignInFlowProvider } from '../auth/SignInFlow';
import { directionOf, type Language } from '../i18n';
import { ChooseCompanyPage } from '../pages/ChooseCompanyPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { MfaSetupPage } from '../pages/MfaSetupPage';
import { MfaVerifyPage } from '../pages/MfaVerifyPage';
import { NoCompanyPage } from '../pages/NoCompanyPage';
import { RecoveryCodesPage } from '../pages/RecoveryCodesPage';
import { buildTheme, ltrCache, rtlCache } from './theme';

export function App() {
  const { i18n } = useTranslation();
  const direction = directionOf(i18n.language as Language);
  const theme = useMemo(() => buildTheme(direction), [direction]);

  return (
    <CacheProvider value={direction === 'rtl' ? rtlCache : ltrCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <SignInFlowProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/login/mfa-setup" element={<MfaSetupPage />} />
              <Route path="/login/recovery-codes" element={<RecoveryCodesPage />} />
              <Route path="/login/mfa" element={<MfaVerifyPage />} />
              <Route path="/login/company" element={<ChooseCompanyPage />} />
              <Route path="/login/no-access" element={<NoCompanyPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SignInFlowProvider>
        </BrowserRouter>
      </ThemeProvider>
    </CacheProvider>
  );
}
