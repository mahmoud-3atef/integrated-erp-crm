import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Button, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi, errorKey } from '../api/auth';
import { tokens } from '../app/theme';
import { AuthLayout, ErrorMessage } from '../auth/AuthLayout';
import { useSignInFlow } from '../auth/SignInFlow';

/** The portal's large sign-in inputs: label above, icon inside, soft background. */
export const signInInput = {
  '& .MuiOutlinedInput-root': { height: 54, borderRadius: '14px', bgcolor: '#f9fbfd', fontSize: 15, fontWeight: 600 },
  '& .MuiOutlinedInput-notchedOutline': { borderWidth: '1.5px', borderColor: '#dfe7ee' },
  '& .MuiInputAdornment-positionStart svg': { color: '#9aabbb' },
  '& .Mui-focused .MuiInputAdornment-positionStart svg': { color: tokens.navy700 },
} as const;

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <Typography component="label" htmlFor={htmlFor} sx={{ display: 'block', mb: 0.9, fontSize: 13.5, fontWeight: 700, color: '#2c4054' }}>
      {children}
    </Typography>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { advance } = useSignInFlow();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      advance(await authApi.login(userName.trim(), password));
    } catch (failure) {
      setError(errorKey(failure));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  const watchCaps = (event: KeyboardEvent) => setCapsLock(event.getModifierState('CapsLock'));

  return (
    <AuthLayout title={t('login.title')} subtitle={t('login.subtitle')}>
      <ErrorMessage messageKey={error} />
      <Stack component="form" spacing={1.75} onSubmit={submit} noValidate>
        <Box>
          <FieldLabel htmlFor="login-user">{t('login.userName')}</FieldLabel>
          <TextField
            id="login-user"
            placeholder={t('login.userNamePlaceholder')}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            sx={signInInput}
            slotProps={{
              htmlInput: { dir: 'ltr', spellCheck: false, 'aria-describedby': 'login-user-hint' },
              input: { startAdornment: <InputAdornment position="start"><PersonOutlinedIcon /></InputAdornment> },
            }}
          />
          <Typography id="login-user-hint" sx={{ mt: 0.5, fontSize: 12, color: tokens.gray500 }}>
            {t('login.userNameHint')}
          </Typography>
        </Box>
        <Box>
          <FieldLabel htmlFor="login-password">{t('login.password')}</FieldLabel>
          <TextField
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={watchCaps}
            onKeyUp={watchCaps}
            onBlur={() => setCapsLock(false)}
            autoComplete="current-password"
            required
            sx={signInInput}
            slotProps={{
              htmlInput: { dir: 'ltr' },
              input: {
                startAdornment: <InputAdornment position="start"><LockOutlinedIcon /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          {capsLock && (
            <Typography role="status" sx={{ mt: 0.75, display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12.5, fontWeight: 700, color: '#8a5a00', '& svg': { fontSize: 16 } }}>
              <WarningAmberIcon />
              {t('login.capsLock')}
            </Typography>
          )}
        </Box>
        <Button type="submit" variant="contained" size="large" disabled={busy || !userName.trim() || !password} sx={{ minHeight: 52, fontSize: 16, fontWeight: 700, mt: 0.5 }}>
          {busy ? t('common.loading') : t('login.submit')}
        </Button>
        <Typography sx={{ display: 'flex', gap: 1, fontSize: 12.5, lineHeight: 1.7, color: tokens.gray500, '& svg': { fontSize: 17, mt: 0.25, color: tokens.navy400 } }}>
          <InfoOutlinedIcon />
          {t('login.hint')}
        </Typography>
      </Stack>
    </AuthLayout>
  );
}
