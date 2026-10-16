import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { Button, IconButton, InputAdornment, Stack, TextField } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi, errorKey } from '../api/auth';
import { AuthLayout, ErrorMessage } from '../auth/AuthLayout';
import { useSignInFlow } from '../auth/SignInFlow';

export function LoginPage() {
  const { t } = useTranslation();
  const { advance } = useSignInFlow();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <AuthLayout title={t('login.title')} subtitle={t('login.subtitle')}>
      <ErrorMessage messageKey={error} />
      <Stack component="form" spacing={2.5} onSubmit={submit} noValidate>
        <TextField
          label={t('login.userName')}
          helperText={t('login.userNameHint')}
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          autoComplete="username"
          autoFocus
          required
          slotProps={{ htmlInput: { dir: 'ltr', spellCheck: false } }}
        />
        <TextField
          label={t('login.password')}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          slotProps={{
            htmlInput: { dir: 'ltr' },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <Button type="submit" variant="contained" size="large" disabled={busy || !userName.trim() || !password}>
          {busy ? t('common.loading') : t('login.submit')}
        </Button>
      </Stack>
    </AuthLayout>
  );
}
